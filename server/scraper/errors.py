"""
Standardized error types for the scraper module.
Workflow 2 will read these error_types to handle retries or logging.
"""

from typing import Optional


class ScraperError(Exception):
    """Base exception for all scraper errors."""

    def __init__(
        self, error_type: str, message: str, http_status: Optional[int] = None
    ):
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.http_status = http_status


class BlockedError(ScraperError):
    def __init__(self, message: str, http_status: Optional[int] = 403):
        super().__init__("BLOCKED", message, http_status)


class TimeoutError(ScraperError):
    def __init__(self, message: str, http_status: Optional[int] = None):
        super().__init__("TIMEOUT", message, http_status)


class NotFoundError(ScraperError):
    def __init__(self, message: str, http_status: Optional[int] = 404):
        super().__init__("NOT_FOUND", message, http_status)


class ExtractionEmptyError(ScraperError):
    def __init__(self, message: str, http_status: Optional[int] = 200):
        super().__init__("EXTRACTION_EMPTY", message, http_status)


class LLMError(ScraperError):
    def __init__(self, message: str, http_status: Optional[int] = 503):
        super().__init__("LLM_UNAVAILABLE", message, http_status)


def classify_exception(
    exc: Exception, http_status: Optional[int] = None
) -> ScraperError:
    """Classify arbitrary exceptions into standard ScraperError types for Workflow 2."""
    if isinstance(exc, ScraperError):
        return exc

    msg = str(exc).lower()

    if "503" in msg or "unavailable" in msg or "high demand" in msg or "resourceexhausted" in msg or "429" in msg:
        return LLMError(
            f"LLM API temporarily unavailable or rate limited: {str(exc)}",
            http_status=503,
        )

    if http_status == 404 or "404" in msg or "not found" in msg:
        return NotFoundError(f"Resource not found: {str(exc)}", http_status=404)

    if (
        http_status in (403, 429)
        or "cloudflare" in msg
        or "captcha" in msg
        or "blocked" in msg
    ):
        return BlockedError(
            f"Access blocked by target server: {str(exc)}",
            http_status=http_status or 403,
        )

    if "timeout" in msg or "timed out" in msg or "navigation failed" in msg:
        return TimeoutError(
            f"Operation timed out: {str(exc)}",
            http_status=http_status,
        )

    return ScraperError(
        error_type="TIMEOUT" if "connection" in msg else "SYSTEM_ERROR",
        message=str(exc),
        http_status=http_status,
    )