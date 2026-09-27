"""
FastAPI server for the AI Data Intelligence Platform.

Endpoints:
  POST /api/plan              → Run Workflow 1, return UI cards, save session to Supabase
  POST /api/execute/{id}      → Run Workflow 2 with SSE streaming, save results to Supabase
  GET  /api/session/{id}      → Retrieve full session (plan + results) from Supabase
  GET  /api/sessions          → List all sessions
"""

import sys
import os
import asyncio

# Windows fixes — must be set before any other imports
if sys.platform == "win32":
    # 1. Force ALL Python IO to UTF-8 so Unicode symbols (✓, ✗) in executor
    #    print() statements don't crash on Windows' default cp1252 codec.
    os.environ["PYTHONUTF8"] = "1"

    # 2. Playwright/Crawl4AI needs ProactorEventLoop to spawn browser subprocesses.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # 3. Reconfigure already-opened stdout/stderr streams
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


import json
import uuid
import logging
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from orchestrator.planner.graph import planner_graph
from orchestrator.executor.graph import build_executor_graph
from database import (
    create_session,
    update_session_status,
    get_session,
    list_sessions as db_list_sessions,
    save_planned_tasks,
    get_planned_tasks,
    update_task_scrape_status,
    save_session_results,
    get_session_results,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================
# App Setup
# ============================================================

app = FastAPI(
    title="AI Data Intelligence Platform",
    description="Autonomous web intelligence pipeline with structured data extraction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Request / Response Schemas
# ============================================================

class PlanRequest(BaseModel):
    user_prompt: str


class PlanResponse(BaseModel):
    session_id: str
    ui_cards: list
    extraction_schema: dict


# ============================================================
# Helper: Map Planner output → Executor initial state
# ============================================================

def map_planner_to_executor_state(
    planned_tasks: list,
    extraction_schema: dict,
) -> dict:
    """
    Transforms Supabase planned_tasks rows + the session's extraction_schema
    into the initial state dictionary that the Executor LangGraph expects.
    """
    tasks = []
    for t in planned_tasks:
        scraper_config = t.get("scraper_config", {})
        tasks.append({
            "url": t["url"],
            "extraction_schema": extraction_schema,
            "reason": t.get("reason", ""),
            "timeout_seconds": scraper_config.get("timeout_seconds", 15),
            "wait_for_selector": scraper_config.get("wait_for_selector"),
            "js_code": scraper_config.get("js_code"),
            "session_id": scraper_config.get("session_id"),
        })

    return {
        "tasks": tasks,
        "payload_schema_keys": list(extraction_schema.keys()),
        "current_index": 0,
        "raw_extractions": [],
        "failed_tasks": [],
        "consolidated_dataset": [],
        "reconciliation_notes": [],
        "final_markdown_report": "",
    }


# ============================================================
# Endpoint 1 — POST /api/plan
# ============================================================

@app.post("/api/plan", response_model=PlanResponse)
async def generate_plan(body: PlanRequest):
    """
    Run Workflow 1 (Planner):
      user prompt → search queries + schema → DuckDuckGo discovery →
      URL validation → payload + reason builder.

    Returns UI cards for the frontend and persists everything in Supabase.
    """
    if not body.user_prompt.strip():
        raise HTTPException(status_code=400, detail="user_prompt cannot be empty")

    try:
        # Execute the full planner graph
        planner_result = await planner_graph.ainvoke({
            "user_prompt": body.user_prompt,
        })

        final_tasks = planner_result.get("final_tasks", [])
        extraction_schema = planner_result.get("extraction_schema", {})

        if planner_result.get("error"):
            raise HTTPException(status_code=422, detail=planner_result["error"])

        if not final_tasks:
            raise HTTPException(
                status_code=422,
                detail="Planner could not discover any usable URLs. Try a more specific prompt.",
            )

        # Persist to Supabase
        session_id = str(uuid.uuid4())
        await create_session(session_id, body.user_prompt, extraction_schema)
        await save_planned_tasks(session_id, final_tasks)

        # Build frontend-friendly UI cards
        ui_cards = [task["ui_card"] for task in final_tasks]

        return PlanResponse(
            session_id=session_id,
            ui_cards=ui_cards,
            extraction_schema=extraction_schema,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Planner execution failed")
        raise HTTPException(status_code=500, detail=f"Planner failed: {str(e)}")


# ============================================================
# Endpoint 2 — POST /api/execute/{session_id}  (SSE Stream)
# ============================================================

@app.post("/api/execute/{session_id}")
async def execute_plan(session_id: str):
    """
    Run Workflow 2 (Executor) for a planned session.
    Streams real-time progress via Server-Sent Events (SSE):
      → started → task_complete (×N) → reconciliation_complete → complete

    Each task's scrape result is saved to Supabase as it completes.
    Final consolidated dataset + report are saved at the end.
    """
    # ---- Validate session ----
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    if session["status"] == "completed":
        raise HTTPException(
            status_code=409,
            detail="Session already executed. Use GET /api/session/{id} to retrieve results.",
        )

    if session["status"] == "executing":
        raise HTTPException(
            status_code=409,
            detail="Session is currently being executed.",
        )

    # ---- Load tasks from Supabase ----
    planned_tasks = await get_planned_tasks(session_id)
    if not planned_tasks:
        raise HTTPException(status_code=404, detail="No planned tasks found for this session")

    extraction_schema = session.get("extraction_schema", {})
    initial_state = map_planner_to_executor_state(planned_tasks, extraction_schema)

    # ---- Mark session as executing ----
    await update_session_status(session_id, "executing")

    # ---- SSE Generator ----
    async def sse_event_stream() -> AsyncGenerator[str, None]:
        total_tasks = len(initial_state["tasks"])

        # Track counts to detect success vs failure per iteration
        prev_raw_count = 0
        prev_fail_count = 0

        # Accumulate final state from streamed chunks
        accumulated_raw_extractions: list = []
        accumulated_consolidated: list = []
        accumulated_notes: list = []
        accumulated_report: str = ""

        # -- Initial event --
        yield _sse({"event": "started", "session_id": session_id, "total_tasks": total_tasks})

        try:
            executor_app = build_executor_graph()

            async for chunk in executor_app.astream(initial_state, stream_mode="updates"):

                # ---- Scrape task completed ----
                if "scrape_task" in chunk:
                    data = chunk["scrape_task"]
                    completed_index = data["current_index"] - 1
                    task_info = initial_state["tasks"][completed_index]

                    new_raw_count = len(data.get("raw_extractions", []))
                    new_fail_count = len(data.get("failed_tasks", []))

                    accumulated_raw_extractions = data.get("raw_extractions", [])

                    if new_raw_count > prev_raw_count:
                        # SUCCESS — new entity extracted
                        latest = data["raw_extractions"][-1]
                        entities_count = len(latest.get("entities", []))

                        await update_task_scrape_status(
                            session_id, completed_index, "success",
                            scrape_result={
                                "entities": latest.get("entities", []),
                                "evidence": latest.get("evidence"),
                            },
                        )

                        yield _sse({
                            "event": "task_complete",
                            "task_index": completed_index,
                            "url": task_info["url"],
                            "status": "success",
                            "entities_count": entities_count,
                            "completed": data["current_index"],
                            "total": total_tasks,
                        })

                    elif new_fail_count > prev_fail_count:
                        # FAILED — scraper error
                        latest_fail = data["failed_tasks"][-1]
                        error_info = latest_fail.get("error", {})
                        error_msg = error_info.get("message", "Unknown error") if isinstance(error_info, dict) else str(error_info)

                        await update_task_scrape_status(
                            session_id, completed_index, "failed",
                            error_details=error_info if isinstance(error_info, dict) else {"message": str(error_info)},
                        )

                        yield _sse({
                            "event": "task_complete",
                            "task_index": completed_index,
                            "url": task_info["url"],
                            "status": "failed",
                            "error": error_msg,
                            "completed": data["current_index"],
                            "total": total_tasks,
                        })

                    prev_raw_count = new_raw_count
                    prev_fail_count = new_fail_count

                # ---- Reconciliation completed ----
                if "reconcile" in chunk:
                    rec_data = chunk["reconcile"]
                    accumulated_consolidated = rec_data.get("consolidated_dataset", [])
                    accumulated_notes = rec_data.get("reconciliation_notes", [])

                    yield _sse({
                        "event": "reconciliation_complete",
                        "consolidated_entities": len(accumulated_consolidated),
                        "conflict_notes": len(accumulated_notes),
                    })

                # ---- Final report formatted ----
                if "format_output" in chunk:
                    accumulated_report = chunk["format_output"].get("final_markdown_report", "")

                    yield _sse({"event": "formatting_complete"})

            # ---- Persist final results to Supabase ----
            await save_session_results(
                session_id=session_id,
                consolidated_dataset=accumulated_consolidated,
                reconciliation_notes=accumulated_notes,
                markdown_report=accumulated_report,
                raw_extractions=accumulated_raw_extractions,
            )

            yield _sse({
                "event": "complete",
                "session_id": session_id,
                "consolidated_dataset": accumulated_consolidated,
                "reconciliation_notes": accumulated_notes,
                "report": accumulated_report,
            })

        except Exception as e:
            logger.exception("Executor stream failed")
            await update_session_status(session_id, "failed")
            yield _sse({"event": "error", "message": str(e)})

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",      # Prevents nginx buffering
        },
    )


# ============================================================
# Endpoint 3 — GET /api/session/{session_id}
# ============================================================

@app.get("/api/session/{session_id}")
async def get_session_detail(session_id: str):
    """
    Retrieve the full session: metadata, planned tasks (with scrape results),
    and final consolidated output.
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    planned_tasks = await get_planned_tasks(session_id)
    results = await get_session_results(session_id)

    return {
        "session": session,
        "planned_tasks": planned_tasks,
        "results": results,         # None if not yet executed
    }


# ============================================================
# Endpoint 4 — GET /api/sessions
# ============================================================

@app.get("/api/sessions")
async def list_all_sessions():
    """List all sessions, most recent first."""
    sessions = await db_list_sessions()
    return {"sessions": sessions}


# ============================================================
# Utility
# ============================================================

def _sse(data: dict) -> str:
    """Format a dictionary as a single SSE data frame."""
    return f"data: {json.dumps(data)}\n\n"