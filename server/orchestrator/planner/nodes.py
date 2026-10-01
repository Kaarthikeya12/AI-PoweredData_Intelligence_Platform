import os
import asyncio
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse
from dotenv import load_dotenv
import httpx
from ddgs import DDGS
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from orchestrator.planner.state import PlannerState

load_dotenv()


# ==========================================
# Pydantic Output Schemas
# ==========================================
class LLMPlan(BaseModel):
    search_queries: List[str] = Field(
        description="Exactly 3 distinct, keyword-focused search queries targeting: 1) Official source, 2) Industry comparison/directory, 3) Technical documentation/breakdown. Max 4-5 words per query."
    )
    extraction_schema: Dict[str, str] = Field(
        description="Flat dictionary mapping snake_case field names to Python types with short format hints (e.g. {'monthly_price': 'str (e.g. $20/mo or custom)'})."
    )

class ReasonItem(BaseModel):
    item_id: int = Field(description="The numeric ID corresponding to the target item.")
    reason: str = Field(description="A concise 1-sentence explanation of what data lives on this page.")

class TaskReasons(BaseModel):
    items: List[ReasonItem]


# ==========================================
# Node 1: Dynamic Planner
# ==========================================
async def generate_plan(state: PlannerState) -> Dict[str, Any]:
    user_prompt = state.get("user_prompt", "")
    if not user_prompt:
        return {"error": "No user prompt provided."}

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    structured_llm = llm.with_structured_output(LLMPlan)

    prompt_template = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an AI Data Intelligence Architect designing an autonomous web discovery plan.\n"
            "Analyze the user's business extraction request and output:\n"
            "1. Exactly 3 distinct, keyword-dense search queries for DuckDuckGo (max 4-5 words each):\n"
            "   - Query 1 (Official Primary Source): Targets primary vendors, career pages, or official portals.\n"
            "   - Query 2 (Aggregator/Comparison): Targets directories, industry roundups, or comparison tables.\n"
            "   - Query 3 (Documentation/Deep Detail): Targets technical documentation, pricing breakdowns, or funding press releases.\n"
            "   CRITICAL SEARCH CONSTRAINT: Every query MUST include the core subject modifier from the prompt "
            "(e.g., if the prompt asks for 'pricing', every query must contain 'pricing', 'cost', 'plans', or 'tiers'; "
            "if asking for 'salaries', every query must contain 'salary', 'compensation', or 'pay').\n"
            "   Avoid generic filler words ('best', 'top', 'overview').\n\n"
            "2. A precise extraction schema as a flat dictionary where keys are snake_case field names "
            "and values are Python data types accompanied by a short format hint."
        ),
        ("human", "User Request: {user_prompt}")
    ])

    chain = prompt_template | structured_llm
    plan_result: LLMPlan = await chain.ainvoke({"user_prompt": user_prompt})

    return {
        "search_queries": plan_result.search_queries,
        "extraction_schema": plan_result.extraction_schema
    }


# ==========================================
# Node 2: Async Web Scout
# ==========================================
async def search_web(state: PlannerState) -> Dict[str, Any]:
    queries = state.get("search_queries", [])
    if not queries:
        return {"discovered_items": [], "error": "No search queries available."}

    discovered_items: List[Dict[str, str]] = []
    seen_urls = set()
    domain_counts: Dict[str, int] = {}
    MAX_PER_DOMAIN = 2

    # Wrap blocking DDGS calls in a thread so asyncio is never blocked
    def run_ddgs():
        items = []
        with DDGS() as ddgs:
            for query in queries:
                try:
                    results = ddgs.text(query, max_results=5)
                    for item in results:
                        url = item.get("href")
                        if not url or url in seen_urls:
                            continue

                        domain = urlparse(url).netloc.lower()
                        if domain_counts.get(domain, 0) >= MAX_PER_DOMAIN:
                            continue

                        seen_urls.add(url)
                        domain_counts[domain] = domain_counts.get(domain, 0) + 1
                        items.append({
                            "url": url,
                            "title": item.get("title", ""),
                            "snippet": item.get("body", "")
                        })
                except Exception as e:
                    print(f"[Search Warning] Query '{query}' failed: {e}")
        return items

    discovered_items = await asyncio.to_thread(run_ddgs)
    return {"discovered_items": discovered_items}


# ==========================================
# Node 3: Fast Streamed URL Validator
# ==========================================
async def validate_urls(state: PlannerState) -> Dict[str, Any]:
    discovered_items = state.get("discovered_items", [])
    if not discovered_items:
        return {"validated_items": []}

    validated_items: List[Dict[str, str]] = []
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    }

    async with httpx.AsyncClient(timeout=4.0, follow_redirects=True, headers=headers) as client:
        async def ping(item: Dict[str, str]):
            url = item.get("url", "")
            try:
                # 1. Fast HEAD check
                res = await client.head(url)
                if res.status_code < 400:
                    return item

                # 2. Fallback to lightweight stream check without downloading body
                if res.status_code in [403, 405]:
                    async with client.stream("GET", url) as stream_res:
                        if stream_res.status_code < 400:
                            return item
            except Exception:
                return None
            return None

        results = await asyncio.gather(*(ping(item) for item in discovered_items))
        validated_items = [valid for valid in results if valid is not None]

    return {"validated_items": validated_items}


# ==========================================
# Node 4: Payload and Reason Builder (ID-Matched)
# ==========================================
async def build_payloads(state: PlannerState) -> Dict[str, Any]:
    # Fixed fallback logic: only fall back if validate_urls did not run at all
    validated_items = state.get("validated_items")
    items_to_process = validated_items if validated_items is not None else state.get("discovered_items", [])
    schema = state.get("extraction_schema", {})

    if not items_to_process:
        return {"final_tasks": []}

    # Pass indexed items to eliminate URL string mutations by the LLM
    items_context = "\n".join([
        f"[{idx}] Title: {i.get('title')}\nSnippet: {i.get('snippet')}\n"
        for idx, i in enumerate(items_to_process, 1)
    ])

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    structured_llm = llm.with_structured_output(TaskReasons)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a web intelligence planner. For each numbered item below, provide its `item_id` and "
            "a single concise sentence stating what relevant data can be extracted from that source."
        ),
        ("human", "Items:\n{items_context}")
    ])

    try:
        reasoning_result: TaskReasons = await (prompt | structured_llm).ainvoke({"items_context": items_context})
        reasons_map = {item.item_id: item.reason for item in reasoning_result.items}
    except Exception:
        reasons_map = {}

    final_tasks = []
    for idx, item in enumerate(items_to_process, 1):
        url = item["url"]
        final_tasks.append({
            "ui_card": {
                "title": item.get("title", ""),
                "url": url,
                "reason": reasons_map.get(idx, "Extracting requested data points from this source.")
            },
            "scraper_task": {
                "url": url,
                "extraction_schema": schema,
                "timeout_seconds": 30,
                "wait_for_selector": None,
                "js_code": None,
                "session_id": None
            }
        })

    return {"final_tasks": final_tasks}