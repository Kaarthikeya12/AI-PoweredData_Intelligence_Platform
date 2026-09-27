"""
State definition for Workflow 2 (Executor & Aggregator Graph).
"""

from typing import TypedDict, List, Dict, Any, Optional

class ExecutorState(TypedDict):
    # Inputs from Workflow 1
    tasks: List[Dict[str, Any]]
    payload_schema_keys: List[str]
    
    # Internal execution tracking
    current_index: int
    raw_extractions: List[Dict[str, Any]]
    failed_tasks: List[Dict[str, Any]]
    
    # Aggregation & Reconciliation results
    consolidated_dataset: List[Dict[str, Any]]
    reconciliation_notes: List[Dict[str, Any]]
    final_markdown_report: str