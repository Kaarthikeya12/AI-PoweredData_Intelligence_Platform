import logging
from dotenv import load_dotenv
from langgraph.graph import StateGraph, START, END
from orchestrator.planner.state import PlannerState
from orchestrator.planner.nodes import (
    generate_plan,
    search_web,
    validate_urls,
    build_payloads
)

load_dotenv()

# Initialize Graph
builder = StateGraph(PlannerState)

# Add Nodes
builder.add_node("plan", generate_plan)
builder.add_node("search", search_web)
builder.add_node("validate", validate_urls)
builder.add_node("build", build_payloads)

# Define Flow Edges
builder.add_edge(START, "plan")
builder.add_edge("plan", "search")
builder.add_edge("search", "validate")
builder.add_edge("validate", "build")
builder.add_edge("build", END)

# Compile Planner Graph
planner_graph = builder.compile()