import asyncio
import json
from scraper.scraper import run_scraper

async def main():
    # Task 1 payload directly extracted from Workflow 1 planner output
    task = {
        "url": "https://supabase.com/pricing",
        "reason": "This source provides official information on Supabase pricing plans, compute credits, and how to estimate monthly costs.",
        "payload_schema_keys": [
            "plan_name",
            "monthly_cost",
            "user_limit_description",
            "included_features",
            "data_transfer_limit",
            "storage_limit",
            "compute_tier",
            "support_level"
        ]
    }

    print("Testing isolated scraper execution on Task 1 (https://supabase.com/pricing)...\n")
    result = await run_scraper(task)

    print("--- SCRAPER OUTPUT ---")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())