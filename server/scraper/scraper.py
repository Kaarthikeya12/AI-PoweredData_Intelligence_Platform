"""
Public entry point implementing run_scraper(task: dict) -> dict.
"""

import asyncio
from typing import Dict, Any, Optional
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from .utils import validate_url, generate_evidence_snippet
from .extractor import StructuredExtractor
from .errors import classify_exception, ScraperError


async def run_scraper(task: dict) -> dict:
    """
    Execute ONE URL per call and return the standardized result contract.
    No exceptions escape this function.
    """
    url = task.get("url")
    schema = task.get("extraction_schema", {})
    timeout_seconds = task.get("timeout_seconds", 15)
    wait_for_selector = task.get("wait_for_selector")
    js_code = task.get("js_code")
    session_id = task.get("session_id")

    # Construct base response template
    response: Dict[str, Any] = {
        "status": "failed",
        "http_status": None,
        "source_url": url,
        "extracted_entities": [],
        "evidence_snippet": None,
        "error_details": None,
    }

    # Validate input URL
    if not validate_url(url):
        response["error_details"] = {
            "type": "TIMEOUT" if not url else "NOT_FOUND",
            "message": f"Invalid HTTP/HTTPS URL provided: '{url}'",
        }
        return response

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
    )

    crawler_config = CrawlerRunConfig(
        page_timeout=timeout_seconds * 1000,
        wait_for=wait_for_selector if wait_for_selector else None,
        js_code=js_code if js_code else None,
        session_id=session_id,
        cache_mode=CacheMode.BYPASS,
    )

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=crawler_config)

            http_status = getattr(result, "status_code", None) or getattr(
                result, "http_status", 200
            )
            response["http_status"] = http_status

            if not getattr(result, "success", False):
                error_msg = getattr(
                    result, "error_message", "Failed to load page cleanly"
                )
                raise classify_exception(Exception(error_msg), http_status=http_status)

            # Extract structured entities
            extractor = StructuredExtractor(schema=schema)
            entities = extractor.extract(crawl_result=result)

            # Generate evidence snippet
            evidence = generate_evidence_snippet(
                extracted_entities=entities,
                raw_html=getattr(result, "html", None),
                markdown_text=getattr(result, "markdown", None),
            )

            response["status"] = "success"
            response["extracted_entities"] = entities
            response["evidence_snippet"] = evidence
            response["error_details"] = None
            return response

    except ScraperError as err:
        response["status"] = "failed"
        response["http_status"] = err.http_status or response["http_status"]
        response["error_details"] = {
            "type": err.error_type,
            "message": err.message,
        }
        return response
    except Exception as exc:
        classified = classify_exception(exc, http_status=response["http_status"])
        response["status"] = "failed"
        response["http_status"] = classified.http_status
        response["error_details"] = {
            "type": classified.error_type,
            "message": classified.message,
        }
        return response