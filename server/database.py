"""
Supabase database integration layer.
All functions are async-safe for use in FastAPI async endpoints.
Uses asyncio.to_thread to wrap the sync supabase-py client calls.
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logger = logging.getLogger(__name__)

# ============================================================
# Client Initialization
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing Supabase credentials. Set SUPABASE_URL and "
        "SUPABASE_SERVICE_ROLE_KEY in your .env file."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================================
# Session Operations
# ============================================================

async def create_session(
    session_id: str,
    user_prompt: str,
    extraction_schema: dict,
) -> dict:
    """Insert a new session row after Workflow 1 completes."""
    def _op():
        return supabase.table("sessions").insert({
            "id": session_id,
            "user_prompt": user_prompt,
            "status": "planned",
            "extraction_schema": extraction_schema,
        }).execute()
    result = await asyncio.to_thread(_op)
    return result.data[0] if result.data else {}


async def update_session_status(
    session_id: str,
    status: str,
    completed_at: Optional[str] = None,
) -> None:
    """Update session lifecycle status (planned → executing → completed/failed)."""
    def _op():
        update_data: Dict[str, Any] = {"status": status}
        if completed_at:
            update_data["completed_at"] = completed_at
        return (
            supabase.table("sessions")
            .update(update_data)
            .eq("id", session_id)
            .execute()
        )
    await asyncio.to_thread(_op)


async def get_session(session_id: str) -> Optional[dict]:
    """Fetch a single session by ID. Returns None if not found."""
    def _op():
        result = supabase.table("sessions").select("*").eq("id", session_id).execute()
        return result.data[0] if result.data else None
    return await asyncio.to_thread(_op)


async def list_sessions() -> list:
    """List all sessions ordered by most recent first."""
    def _op():
        return supabase.table("sessions").select("*").order("created_at", desc=True).execute()
    result = await asyncio.to_thread(_op)
    return result.data or []


# ============================================================
# Planned Tasks Operations
# ============================================================

async def save_planned_tasks(session_id: str, final_tasks: list) -> None:
    """Bulk-insert all planned tasks from Workflow 1 output."""
    rows = []
    for idx, task in enumerate(final_tasks):
        ui = task.get("ui_card", {})
        scraper = task.get("scraper_task", {})
        rows.append({
            "session_id": session_id,
            "task_index": idx,
            "url": ui.get("url", ""),
            "title": ui.get("title", ""),
            "reason": ui.get("reason", ""),
            "scraper_config": {
                "timeout_seconds": scraper.get("timeout_seconds", 15),
                "wait_for_selector": scraper.get("wait_for_selector"),
                "js_code": scraper.get("js_code"),
            },
        })

    def _op():
        return supabase.table("planned_tasks").insert(rows).execute()
    await asyncio.to_thread(_op)


async def get_planned_tasks(session_id: str) -> list:
    """Fetch all planned tasks for a session, ordered by task_index."""
    def _op():
        return (
            supabase.table("planned_tasks")
            .select("*")
            .eq("session_id", session_id)
            .order("task_index")
            .execute()
        )
    result = await asyncio.to_thread(_op)
    return result.data or []


async def update_task_scrape_status(
    session_id: str,
    task_index: int,
    status: str,
    scrape_result: Optional[dict] = None,
    error_details: Optional[dict] = None,
) -> None:
    """Update a single task's scrape outcome after the scraper finishes."""
    def _op():
        update_data: Dict[str, Any] = {
            "scrape_status": status,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if scrape_result is not None:
            update_data["scrape_result"] = scrape_result
        if error_details is not None:
            update_data["error_details"] = error_details
        return (
            supabase.table("planned_tasks")
            .update(update_data)
            .eq("session_id", session_id)
            .eq("task_index", task_index)
            .execute()
        )
    await asyncio.to_thread(_op)


# ============================================================
# Session Results Operations
# ============================================================

async def save_session_results(
    session_id: str,
    consolidated_dataset: list,
    reconciliation_notes: list,
    markdown_report: str,
    raw_extractions: list,
) -> None:
    """
    Persist the final Workflow 2 output and mark the session as completed.
    """
    def _insert():
        return supabase.table("session_results").insert({
            "session_id": session_id,
            "consolidated_dataset": consolidated_dataset,
            "reconciliation_notes": reconciliation_notes,
            "markdown_report": markdown_report,
            "raw_extractions": raw_extractions,
        }).execute()
    await asyncio.to_thread(_insert)

    # Also mark the session as completed
    def _complete():
        return (
            supabase.table("sessions")
            .update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", session_id)
            .execute()
        )
    await asyncio.to_thread(_complete)


async def get_session_results(session_id: str) -> Optional[dict]:
    """Fetch consolidated results for a session. Returns None if not yet executed."""
    def _op():
        result = (
            supabase.table("session_results")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return result.data[0] if result.data else None
    return await asyncio.to_thread(_op)
