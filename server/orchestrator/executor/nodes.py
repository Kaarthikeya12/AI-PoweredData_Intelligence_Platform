"""
Node implementations and prompts for Workflow 2 graph.
Integrated with Model Hub for resilience.
"""

import asyncio
import json
import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from scraper.scraper import run_scraper
from .state import ExecutorState

logger = logging.getLogger(__name__)

RECONCILIATION_SYSTEM_PROMPT = """You are a Lead Data Integration Architect. 
Your task is to consolidate, deduplicate, and resolve conflicting entity records extracted from multiple web sources.

Target Schema Fields:
{schema_keys}

INPUT EXTRACTIONS BY SOURCE:
{raw_extractions_json}

RULES FOR DEDUPLICATION & CONFLICT RESOLUTION:
1. GROUP ENTITIES: Identify distinct entities (e.g., same pricing plan tier or same company/startup) across all sources.
2. MERGE INFORMATION: Combine unique attributes found in Source A with attributes found in Source B.
3. CONFLICT REASONING:
   - If Source A says "$0/mo" and Source B says "Free ($0/mo with $5 compute credits)", merge into the most comprehensive value: "$0/month ($5 included compute credit)".
   - If Source A and Source B directly contradict each other, prefer official/primary domain data if available, or state both values clearly with source attribution (e.g., "5GB (Official) / 10GB (Blog)").
4. CITATION TRACEABILITY: Include all source URLs that contributed to each consolidated entity record.
5. CONFLICT NOTES: Generate a list of clear reconciliation notes explaining any discrepancies you resolved.
"""


class EntityReconciliationOutput(BaseModel):
    class ConsolidatedEntity(BaseModel):
        entity_identifier: str = Field(description="Primary name/title of the merged entity (e.g. 'Free Tier', 'Pro Plan')")
        merged_data: Dict[str, Any] = Field(description="Merged dictionary matching target schema fields.")
        contributing_urls: List[str] = Field(description="List of source URLs that contained data for this entity.")

    class ConflictNote(BaseModel):
        entity_name: str = Field(description="Name of the entity with conflicting data")
        field_name: str = Field(description="Field key where conflict occurred (e.g. 'monthly_cost')")
        resolution_reason: str = Field(description="Explanation of how the conflict was resolved")

    consolidated_entities: List[ConsolidatedEntity]
    reconciliation_notes: List[ConflictNote]


async def scrape_task_node(state: ExecutorState) -> dict:
    idx = state["current_index"]
    task = state["tasks"][idx]
    
    print(f"\n[WORKFLOW 2] Executing Task {idx + 1}/{len(state['tasks'])}")
    print(f"  --> Target URL: {task['url']}")
    
    result = await run_scraper(task)
    
    raw_extractions = list(state.get("raw_extractions", []))
    failed_tasks = list(state.get("failed_tasks", []))
    
    if result.get("status") == "success" and result.get("extracted_entities"):
        entities_count = len(result["extracted_entities"])
        print(f"  SUCCESS: Extracted {entities_count} entity records.")
        raw_extractions.append({
            "url": task["url"],
            "reason": task.get("reason", ""),
            "entities": result["extracted_entities"],
            "evidence": result.get("evidence_snippet")
        })
    else:
        err = result.get("error_details", {}).get("message", "Unknown Error")
        print(f"  FAILED: {err}")
        failed_tasks.append({
            "task": task,
            "error": result.get("error_details")
        })
        
    # Throttle requests to avoid hitting Groq's Tokens Per Minute (TPM) rate limits
    if idx + 1 < len(state["tasks"]):
        await asyncio.sleep(4)
        
    return {
        "current_index": idx + 1,
        "raw_extractions": raw_extractions,
        "failed_tasks": failed_tasks
    }


def should_continue(state: ExecutorState) -> str:
    if state["current_index"] < len(state["tasks"]):
        return "scrape_task"
    return "reconcile"


def _programmatic_merge(raw_extractions: list, schema_keys: list) -> tuple:
    """
    Local programmatic fallback: merge entities without LLM.
    Groups by entity name similarity and combines data fields.
    """
    all_entities = []
    for source in raw_extractions:
        url = source.get("url", "")
        for entity in source.get("entities", []):
            if isinstance(entity, dict):
                all_entities.append({"data": entity, "url": url})

    if not all_entities:
        return [], [{"entity_name": "N/A", "field_name": "N/A", "resolution_reason": "No entity data was available to merge."}]

    # Try to find a name/identifier field in the entity data
    name_fields = ["name", "plan_name", "tier", "title", "product", "company", "service",
                   "entity_identifier", "plan", "provider"]
    
    def get_entity_name(entity_data: dict) -> str:
        for field in name_fields:
            if field in entity_data and entity_data[field]:
                return str(entity_data[field]).strip().lower()
        # Use first non-evidence field value as name
        for key, val in entity_data.items():
            if key != "evidence" and val:
                return str(val).strip().lower()[:50]
        return "unknown"

    # Group entities by name
    groups: Dict[str, list] = {}
    for item in all_entities:
        name = get_entity_name(item["data"])
        if name not in groups:
            groups[name] = []
        groups[name].append(item)

    consolidated = []
    notes = []

    for name, items in groups.items():
        # Merge data from all sources
        merged: Dict[str, Any] = {}
        urls = set()
        
        for item in items:
            urls.add(item["url"])
            for key, val in item["data"].items():
                if key == "evidence":
                    continue
                if key not in merged or merged[key] is None or str(merged.get(key, "")) == "N/A":
                    merged[key] = val
                elif str(val) != str(merged[key]) and val is not None and str(val) != "N/A":
                    # Conflict detected - keep the longer/more detailed value
                    if len(str(val)) > len(str(merged[key])):
                        notes.append({
                            "entity_name": name.title(),
                            "field_name": key,
                            "resolution_reason": f"Kept more detailed value from {item['url']}",
                        })
                        merged[key] = val
                    else:
                        notes.append({
                            "entity_name": name.title(),
                            "field_name": key,
                            "resolution_reason": f"Kept existing value; alternative from {item['url']} was shorter",
                        })

        # Pick a nice display name
        display_name = name.title()
        for field in name_fields:
            if field in merged and merged[field]:
                display_name = str(merged[field])
                break

        consolidated.append({
            "entity_identifier": display_name,
            "merged_data": merged,
            "contributing_urls": list(urls),
        })

    if not notes:
        notes.append({
            "entity_name": "All",
            "field_name": "N/A",
            "resolution_reason": "No conflicting values detected across sources.",
        })

    return consolidated, notes


async def merge_and_reconcile_node(state: ExecutorState) -> dict:
    raw_extractions = state.get("raw_extractions", [])
    schema_keys = state.get("payload_schema_keys", [])

    print("\n[WORKFLOW 2] All sources fetched. Running Reconciliation & Conflict Resolution...")

    if not raw_extractions:
        print("  ! No raw extractions gathered to reconcile.")
        return {
            "consolidated_dataset": [],
            "reconciliation_notes": [{"entity_name": "N/A", "field_name": "N/A", "resolution_reason": "No data scraped"}]
        }

    # Strategy 1: Try Gemini (same model as the planner - proven working)
    try:
        print("  [Reconciliation] Attempting LLM-based merge via Gemini...")
        
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
        structured_llm = llm.with_structured_output(EntityReconciliationOutput)

        prompt = ChatPromptTemplate.from_messages([
            ("system", RECONCILIATION_SYSTEM_PROMPT),
            ("human", "Execute consolidation and resolve conflicts.")
        ])

        chain = prompt | structured_llm

        # Limit payload size to avoid exceeding token limits
        extractions_payload = raw_extractions
        payload_str = json.dumps(extractions_payload, indent=2)
        if len(payload_str) > 30000:
            # Trim evidence fields and truncate entity data
            trimmed = []
            for source in raw_extractions:
                trimmed_entities = []
                for entity in source.get("entities", []):
                    if isinstance(entity, dict):
                        trimmed_entity = {k: v for k, v in entity.items() if k != "evidence"}
                        trimmed_entities.append(trimmed_entity)
                trimmed.append({
                    "url": source.get("url", ""),
                    "entities": trimmed_entities,
                })
            extractions_payload = trimmed

        response: EntityReconciliationOutput = await chain.ainvoke({
            "schema_keys": json.dumps(schema_keys, indent=2),
            "raw_extractions_json": json.dumps(extractions_payload, indent=2)
        })

        consolidated = [item.model_dump() for item in response.consolidated_entities]
        notes = [note.model_dump() for note in response.reconciliation_notes]

        if consolidated:
            print(f"  LLM Reconciliation succeeded: {len(consolidated)} entities, {len(notes)} notes.")
            return {
                "consolidated_dataset": consolidated,
                "reconciliation_notes": notes
            }
        else:
            print("  ! LLM returned empty consolidated dataset, falling back to programmatic merge...")
            
    except Exception as e:
        logger.error(f"[Reconciliation] Gemini LLM call failed: {str(e)}")
        print(f"  LLM Reconciliation failed: {str(e)[:150]}")
        print("  -> Falling back to programmatic merge...")

    # Strategy 2: Programmatic fallback - merge entities without LLM
    try:
        consolidated, notes = _programmatic_merge(raw_extractions, schema_keys)
        print(f"  Programmatic merge succeeded: {len(consolidated)} entities, {len(notes)} notes.")
        return {
            "consolidated_dataset": consolidated,
            "reconciliation_notes": notes
        }
    except Exception as e:
        logger.error(f"[Reconciliation] Programmatic merge also failed: {str(e)}")
        print(f"  Programmatic merge failed: {str(e)[:150]}")
        return {
            "consolidated_dataset": [],
            "reconciliation_notes": [{"entity_name": "Error", "field_name": "All", "resolution_reason": str(e)}]
        }


async def format_dataset_node(state: ExecutorState) -> dict:
    print("\n[WORKFLOW 2] Generating Final Consolidated Dataset Report...")
    
    consolidated = state.get("consolidated_dataset", [])
    notes = state.get("reconciliation_notes", [])
    schema_keys = state.get("payload_schema_keys", [])

    markdown_lines = [
        "# Consolidated Intelligence Dataset\n",
        f"**Total Sources Scraped:** {len(state.get('raw_extractions', []))} / {len(state.get('tasks', []))}\n",
        f"**Consolidated Entities:** {len(consolidated)}\n",
        "---",
        "## Merged Entity Table\n"
    ]

    if consolidated and schema_keys:
        headers = ["Entity / Plan"] + [k.replace("_", " ").title() for k in schema_keys] + ["Sources"]
        markdown_lines.append("| " + " | ".join(headers) + " |")
        markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

        for item in consolidated:
            entity_id = item.get("entity_identifier", "Unknown")
            data = item.get("merged_data", {})
            
            # Safely extract domain from contributing URLs
            source_domains = []
            for u in item.get("contributing_urls", []):
                try:
                    source_domains.append(u.split("/")[2])
                except (IndexError, AttributeError):
                    source_domains.append(str(u)[:30])
            urls = ", ".join(source_domains)

            row_vals = [entity_id]
            for key in schema_keys:
                val = data.get(key, "N/A")
                if isinstance(val, list):
                    val = ", ".join(map(str, val))
                row_vals.append(str(val).replace("\n", " "))
            row_vals.append(urls)

            markdown_lines.append("| " + " | ".join(row_vals) + " |")
    elif consolidated:
        # No schema keys but we have consolidated data - dump as bullet points
        for item in consolidated:
            entity_id = item.get("entity_identifier", "Unknown")
            data = item.get("merged_data", {})
            markdown_lines.append(f"\n### {entity_id}\n")
            for key, val in data.items():
                if isinstance(val, list):
                    val = ", ".join(map(str, val))
                markdown_lines.append(f"- **{key.replace('_', ' ').title()}**: {val}")
    else:
        markdown_lines.append("\n*No entities were consolidated. Check source scraping results for details.*\n")

    markdown_lines.append("\n---")
    markdown_lines.append("## Conflict Resolution & Data Synthesis Notes\n")

    if notes:
        for note in notes:
            markdown_lines.append(
                f"* **[{note.get('entity_name')}] `{note.get('field_name')}`**: {note.get('resolution_reason')}"
            )
    else:
        markdown_lines.append("No conflicting values were detected across the sources.")

    final_report = "\n".join(markdown_lines)
    return {"final_markdown_report": final_report}