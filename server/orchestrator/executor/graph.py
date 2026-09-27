"""
Workflow 2: Executor & Aggregator LangGraph Pipeline.
"""

from langgraph.graph import StateGraph, END
from .state import ExecutorState
from .nodes import scrape_task_node, should_continue, merge_and_reconcile_node, format_dataset_node


def build_executor_graph():
    """Builds and compiles the Executor StateGraph."""
    workflow = StateGraph(ExecutorState)

    workflow.add_node("scrape_task", scrape_task_node)
    workflow.add_node("reconcile", merge_and_reconcile_node)
    workflow.add_node("format_output", format_dataset_node)

    workflow.set_entry_point("scrape_task")

    workflow.add_conditional_edges(
        "scrape_task",
        should_continue,
        {
            "scrape_task": "scrape_task",
            "reconcile": "reconcile"
        }
    )

    workflow.add_edge("reconcile", "format_output")
    workflow.add_edge("format_output", END)

    return workflow.compile()


executor_graph = build_executor_graph()