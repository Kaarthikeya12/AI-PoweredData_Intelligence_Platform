from typing import TypedDict, List, Dict, Any, Optional

class PlannerState(TypedDict, total=False):
    user_prompt: str
    search_queries: List[str]
    discovered_items: List[Dict[str, str]]
    validated_items: Optional[List[Dict[str, str]]]
    extraction_schema: Dict[str, str]
    final_tasks: List[Dict[str, Any]]
    error: Optional[str]