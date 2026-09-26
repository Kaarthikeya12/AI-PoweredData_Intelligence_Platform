"""
Error types and error handling utilities for the scraper.
"""

import re
from typing import Dict, Any, Optional


class ScraperError(Exception):
    """Base exception for all scraper errors."""

    def __init__(
        self,
        error_type: str,
        message: str,
        http_status: Optional[int] = None,
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


def sanitize_error_message(msg: str) -> str:
    """Strip out sensitive environment variables or local paths from error messages."""
    if not msg:
        return "Unknown scraper error occurred"

    # Remove filesystem paths
    msg = re.sub(r"/[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)+", "[path]", msg)

    # Mask API key patterns
    msg = re.sub(
        r"(api[-_]?key|secret|auth|token)=['\"]?[a-zA-Z0-9_\-\.]{8,}['\"]?",
        r"\1=***",
        msg,
        flags=re.IGNORECASE,
    )

    return msg.strip()


def classify_exception(exc: Exception, http_status: Optional[int] = None) -> ScraperError:
    """Classify arbitrary exceptions into standard ScraperError types."""
    if isinstance(exc, ScraperError):
        return exc

    msg = str(exc)
    msg_lower = msg.lower()

    if http_status == 404 or "404" in msg_lower or "not found" in msg_lower:
        return NotFoundError(f"Resource not found: {sanitize_error_message(msg)}", http_status=404)

    if (
        http_status in (403, 429)
        or "403" in msg_lower
        or "cloudflare" in msg_lower
        or "captcha" in msg_lower
        or "access denied" in msg_lower
        or "blocked" in msg_lower
    ):
        return BlockedError(
            f"Access blocked by target server or security check: {sanitize_error_message(msg)}",
            http_status=http_status or 403,
        )

    if "timeout" in msg_lower or "timed out" in msg_lower or "navigation failed" in msg_lower:
        return TimeoutError(
            f"Operation timed out: {sanitize_error_message(msg)}",
            http_status=http_status,
        )

    # Default fallback to TIMEOUT if it looks like a network failure, otherwise BLOCKED
    return ScraperError(
        error_type="TIMEOUT" if "connection" in msg_lower else "BLOCKED",
        message=sanitize_error_message(msg),
        http_status=http_status,
    )