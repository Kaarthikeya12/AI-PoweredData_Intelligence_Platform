import asyncio
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

# 1. Initialize Graph
builder = StateGraph(PlannerState)

# 2. Add Nodes
builder.add_node("plan", generate_plan)
builder.add_node("search", search_web)
builder.add_node("validate", validate_urls)
builder.add_node("build", build_payloads)

# 3. Define Flow Edges
builder.add_edge(START, "plan")
builder.add_edge("plan", "search")
builder.add_edge("search", "validate")
builder.add_edge("validate", "build")
builder.add_edge("build", END)

# 4. Compile Graph
planner_graph = builder.compile()


# --- Standalone Test Runner ---
if __name__ == "__main__":
    import json

    async def run_graph():
        print("--> Executing Planner Graph (plan -> search -> validate -> build)...")
        test_state = {
            "user_prompt": "Find seed-funded B2B fintech startups in Bangalore"
        }

        result = await planner_graph.ainvoke(test_state)

        print("\n=== FINAL GENERATED TASKS (Workflow 1 Complete) ===")
        tasks = result.get("final_tasks", [])
        print(f"Total Tasks Prepared: {len(tasks)}\n")

        for idx, task in enumerate(tasks, 1):
            card = task["ui_card"]
            payload = task["scraper_task"]
            print(f"{idx}")
            print(f"    URL:    {card['url']}")
            print(f"    Reason: {card['reason']}")
            print(f"    Payload Schema Keys: {list(payload['extraction_schema'].keys())}\n")

    asyncio.run(run_graph())