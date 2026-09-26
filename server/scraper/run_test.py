import asyncio
from scraper.scraper import run_scraper

async def main():
    # Test task matching the schema for pricing tiers and features
    task = {
        "url": "https://getcreatr.com/ai-coding-assistant-pricing-2026",
        "extraction_schema": {
            "title": "str",
            "tier_name": "str",
            "price": "str",
            "features": "list[str]"
        },
        "timeout_seconds": 20,
        "wait_for_selector": None,
        "js_code": None,
        "session_id": None
    }

    print("Running scraper on target URL...\n")
    result = await run_scraper(task)

    print("--- SCRAPER RESULT ---")
    import json
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())