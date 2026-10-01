"""
Public entry point for the scraper module.
"""

import logging
from typing import Dict, Any
import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

from .utils import validate_url
from .extractor import StructuredExtractor
from .errors import classify_exception, ExtractionEmptyError, ScraperError

logger = logging.getLogger(__name__)


async def run_scraper(task: dict) -> dict:
    url = task.get("url") or task.get("URL")
    schema = task.get("extraction_schema") or task.get("payload_schema_keys") or task.get("Payload Schema Keys", [])
    reason = task.get("reason") or task.get("Reason", "")
    timeout_seconds = task.get("timeout_seconds", 45)

    response: Dict[str, Any] = {
        "status": "failed",
        "http_status": None,
        "source_url": url,
        "extracted_entities": [],
        "evidence_snippet": None,
        "error_details": None,
    }

    if not validate_url(url):
        response["error_details"] = {
            "type": "NOT_FOUND",
            "message": f"Invalid or missing HTTP/HTTPS URL provided: '{url}'",
        }
        return response

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        extra_args=[
            "--blink-settings=imagesEnabled=false",
            "--disable-remote-fonts",
        ],
    )

    crawler_config = CrawlerRunConfig(
        page_timeout=timeout_seconds * 1000,
        cache_mode=CacheMode.BYPASS,
        wait_until="domcontentloaded",
        excluded_tags=["nav", "footer", "header", "aside", "script", "style", "svg", "iframe"],
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
                    result, "error_message", "Failed to load webpage cleanly"
                )
                raise classify_exception(Exception(error_msg), http_status=http_status)

            markdown_text = (
                getattr(result, "markdown", None)
                or getattr(result, "markdown_v2", None)
                or getattr(result, "cleaned_html", "")
            )

            extractor = StructuredExtractor()
            entities = extractor.extract(
                markdown_text=markdown_text,
                target_schema=schema,
                reason=reason
            )

            if not entities:
                schema_keys = schema if isinstance(schema, list) else list(schema.keys())
                raise ExtractionEmptyError(
                    f"No entities matching schema keys {schema_keys} were found.",
                    http_status=http_status,
                )

            evidence = entities[0].get("evidence") if isinstance(entities[0], dict) else None

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
        # Try lightweight httpx fallback before giving up
        logger.info(f"[Scraper] Browser scrape failed for {url}, trying httpx fallback...")
        fallback = await _httpx_fallback(url, schema, reason, timeout_seconds)
        if fallback:
            return fallback
        return response
    except Exception as exc:
        classified = classify_exception(exc, http_status=response["http_status"])
        response["status"] = "failed"
        response["http_status"] = classified.http_status
        response["error_details"] = {
            "type": classified.error_type,
            "message": classified.message,
        }
        # Try lightweight httpx fallback before giving up
        logger.info(f"[Scraper] Browser scrape failed for {url}, trying httpx fallback...")
        fallback = await _httpx_fallback(url, schema, reason, timeout_seconds)
        if fallback:
            return fallback
        return response


async def _httpx_fallback(url: str, schema, reason: str, timeout: int) -> dict | None:
    """Lightweight fallback: fetch page via httpx + extract if we get HTML."""
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                return None
            text = resp.text
            if not text or len(text.strip()) < 100:
                return None

            extractor = StructuredExtractor()
            entities = extractor.extract(
                markdown_text=text,
                target_schema=schema,
                reason=reason,
            )
            if not entities:
                return None

            evidence = entities[0].get("evidence") if isinstance(entities[0], dict) else None
            logger.info(f"[Scraper] httpx fallback succeeded for {url}: {len(entities)} entities")
            return {
                "status": "success",
                "http_status": resp.status_code,
                "source_url": url,
                "extracted_entities": entities,
                "evidence_snippet": evidence,
                "error_details": None,
            }
    except Exception as e:
        logger.debug(f"[Scraper] httpx fallback also failed for {url}: {e}")
        return None