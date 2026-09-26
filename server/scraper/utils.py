"""
Utilities for URL validation, schema parsing, type normalization, and evidence generation.
"""

from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
from bs4 import BeautifulSoup


TYPE_MAPPING = {
    "str": "string",
    "string": "string",
    "int": "integer",
    "integer": "integer",
    "float": "float",
    "bool": "boolean",
    "boolean": "boolean",
    "list[str]": "list[string]",
    "list[string]": "list[string]",
}


def validate_url(url: str) -> bool:
    """Check if string is a valid HTTP/HTTPS URL."""
    if not isinstance(url, str) or not url:
        return False
    try:
        result = urlparse(url)
        return all([result.scheme in ("http", "https"), result.netloc])
    except Exception:
        return False


def normalize_schema(schema: Dict[str, str]) -> Dict[str, str]:
    """Normalize input schema types into standardized string types."""
    normalized = {}
    for key, val_type in schema.items():
        val_str = str(val_type).strip().lower()
        normalized[key] = TYPE_MAPPING.get(val_str, "string")
    return normalized


def coerce_value(val: Any, target_type: str) -> Any:
    """Safely coerce extracted raw value into target type."""
    if val is None:
        return None

    target = TYPE_MAPPING.get(target_type.lower(), target_type.lower())

    if target == "string":
        return str(val).strip()

    if target == "integer":
        try:
            # Handle float strings like "29.0"
            return int(float(str(val).replace("$", "").replace(",", "").strip()))
        except (ValueError, TypeError):
            return str(val).strip()

    if target == "float":
        try:
            return float(str(val).replace("$", "").replace(",", "").strip())
        except (ValueError, TypeError):
            return str(val).strip()

    if target == "boolean":
        if isinstance(val, bool):
            return val
        s = str(val).strip().lower()
        if s in ("true", "1", "yes"):
            return True
        if s in ("false", "0", "no"):
            return False
        return str(val).strip()

    if target == "list[string]":
        if isinstance(val, list):
            return [str(item).strip() for item in val if item is not None]
        if isinstance(val, str):
            return [item.strip() for item in val.split(",") if item.strip()]
        return [str(val).strip()]

    return val


def generate_evidence_snippet(
    extracted_entities: List[Dict[str, Any]],
    raw_html: Optional[str] = None,
    markdown_text: Optional[str] = None,
    max_length: int = 250,
) -> Optional[str]:
    """Generate a readable, truthful evidence snippet from the source content."""
    if not extracted_entities:
        return None

    # Collect key words/values from entities
    search_terms = []
    for entity in extracted_entities:
        for val in entity.values():
            if isinstance(val, str) and len(val) > 2:
                search_terms.append(val)
            elif isinstance(val, list):
                search_terms.extend([str(x) for x in val if len(str(x)) > 2])

    # Search in markdown text first if available
    if markdown_text:
        lines = [line.strip() for line in markdown_text.split("\n") if line.strip()]
        for line in lines:
            if any(term in line for term in search_terms[:5]):
                return line[:max_length]

    # Search in HTML if markdown yielded no result
    if raw_html:
        try:
            soup = BeautifulSoup(raw_html, "html.parser")
            text = soup.get_text(separator=" ", strip=True)
            if text:
                for term in search_terms[:5]:
                    pos = text.find(term)
                    if pos != -1:
                        start = max(0, pos - 50)
                        end = min(len(text), pos + max_length)
                        return text[start:end].strip()
        except Exception:
            pass

    # Fallback to formatting top entity attributes
    first_entity = extracted_entities[0]
    parts = [f"{k}: {v}" for k, v in first_entity.items() if v is not None]
    if parts:
        return ", ".join(parts)[:max_length]

    return None