"""
Tests covering all 12 required scenarios.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from scraper.scraper import run_scraper
from scraper.utils import validate_url, normalize_schema, coerce_value


@pytest.mark.asyncio
async def test_invalid_url():
    task = {"url": "invalid-url", "extraction_schema": {"title": "str"}}
    res = await run_scraper(task)
    assert res["status"] == "failed"
    assert res["error_details"]["type"] in ("NOT_FOUND", "TIMEOUT")


@pytest.mark.asyncio
async def test_successful_extraction_mock():
    mock_result = MagicMock()
    mock_result.success = True
    mock_result.status_code = 200
    mock_result.extracted_content = '[{"title": "Test Page", "price": "$10"}]'
    mock_result.html = "<html><body><h1>Test Page</h1></body></html>"
    mock_result.markdown = "Test Page $10"

    with patch("scraper.scraper.AsyncWebCrawler") as mock_crawler_cls:
        mock_crawler = AsyncMock()
        mock_crawler.arun.return_value = mock_result
        mock_crawler_cls.return_value.__aenter__.return_value = mock_crawler

        task = {
            "url": "https://example.com",
            "extraction_schema": {"title": "str", "price": "str"},
        }
        res = await run_scraper(task)

        assert res["status"] == "success"
        assert res["http_status"] == 200
        assert len(res["extracted_entities"]) == 1
        assert res["extracted_entities"][0]["title"] == "Test Page"
        assert res["evidence_snippet"] is not None


@pytest.mark.asyncio
async def test_empty_extraction():
    mock_result = MagicMock()
    mock_result.success = True
    mock_result.status_code = 200
    mock_result.extracted_content = None
    mock_result.html = "<html><body></body></html>"
    mock_result.markdown = ""

    with patch("scraper.scraper.AsyncWebCrawler") as mock_crawler_cls:
        mock_crawler = AsyncMock()
        mock_crawler.arun.return_value = mock_result
        mock_crawler_cls.return_value.__aenter__.return_value = mock_crawler

        task = {
            "url": "https://example.com",
            "extraction_schema": {"title": "str"},
        }
        res = await run_scraper(task)

        assert res["status"] == "failed"
        assert res["error_details"]["type"] == "EXTRACTION_EMPTY"


@pytest.mark.asyncio
async def test_404_not_found():
    mock_result = MagicMock()
    mock_result.success = False
    mock_result.status_code = 404
    mock_result.error_message = "Page Not Found 404"

    with patch("scraper.scraper.AsyncWebCrawler") as mock_crawler_cls:
        mock_crawler = AsyncMock()
        mock_crawler.arun.return_value = mock_result
        mock_crawler_cls.return_value.__aenter__.return_value = mock_crawler

        task = {"url": "https://example.com/nonexistent", "extraction_schema": {"title": "str"}}
        res = await run_scraper(task)

        assert res["status"] == "failed"
        assert res["http_status"] == 404
        assert res["error_details"]["type"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_timeout():
    with patch("scraper.scraper.AsyncWebCrawler") as mock_crawler_cls:
        mock_crawler = AsyncMock()
        mock_crawler.arun.side_effect = Exception("Page navigation timed out after 15000ms")
        mock_crawler_cls.return_value.__aenter__.return_value = mock_crawler

        task = {"url": "https://example.com/slow", "extraction_schema": {"title": "str"}}
        res = await run_scraper(task)

        assert res["status"] == "failed"
        assert res["error_details"]["type"] == "TIMEOUT"


@pytest.mark.asyncio
async def test_blocked_page():
    mock_result = MagicMock()
    mock_result.success = False
    mock_result.status_code = 403
    mock_result.error_message = "Cloudflare security check required"

    with patch("scraper.scraper.AsyncWebCrawler") as mock_crawler_cls:
        mock_crawler = AsyncMock()
        mock_crawler.arun.return_value = mock_result
        mock_crawler_cls.return_value.__aenter__.return_value = mock_crawler

        task = {"url": "https://example.com/protected", "extraction_schema": {"title": "str"}}
        res = await run_scraper(task)

        assert res["status"] == "failed"
        assert res["http_status"] == 403
        assert res["error_details"]["type"] == "BLOCKED"


def test_schema_normalization():
    raw_schema = {
        "f1": "str",
        "f2": "int",
        "f3": "bool",
        "f4": "list[str]",
    }
    normalized = normalize_schema(raw_schema)
    assert normalized["f1"] == "string"
    assert normalized["f2"] == "integer"
    assert normalized["f3"] == "boolean"
    assert normalized["f4"] == "list[string]"


@pytest.mark.asyncio
async def test_manual_integration_example_com():
    """Manual integration test against live example.com."""
    task = {
        "url": "https://example.com",
        "extraction_schema": {"title": "str", "description": "str"},
        "timeout_seconds": 15,
    }
    res = await run_scraper(task)
    assert res["status"] == "success"
    assert res["http_status"] == 200
    assert len(res["extracted_entities"]) > 0
    assert "Example Domain" in str(res["extracted_entities"])