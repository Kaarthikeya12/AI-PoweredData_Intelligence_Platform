"""
Data extraction and normalization engine.
"""

from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
from .utils import normalize_schema, coerce_value
from .errors import ExtractionEmptyError


class StructuredExtractor:
    """Extracts structured entities matching high-level schemas from page content."""

    def __init__(self, schema: Dict[str, str]):
        self.raw_schema = schema
        self.normalized_schema = normalize_schema(schema)

    def extract(
        self,
        crawl_result: Any,
    ) -> List[Dict[str, Any]]:
        entities: List[Dict[str, Any]] = []

        # 1. Try Crawl4AI extracted JSON result if present
        extracted_content = getattr(crawl_result, "extracted_content", None)
        if extracted_content:
            import json

            try:
                data = (
                    json.loads(extracted_content)
                    if isinstance(extracted_content, str)
                    else extracted_content
                )
                if isinstance(data, list):
                    entities = data
                elif isinstance(data, dict):
                    entities = [data]
            except Exception:
                pass

        # 2. Fallback: Parse HTML structured elements heuristically if empty
        if not entities and getattr(crawl_result, "html", None):
            entities = self._heuristic_html_extract(crawl_result.html)

        # 3. Normalize & coerce entities against schema
        normalized_entities = []
        for raw_entity in entities:
            if not isinstance(raw_entity, dict):
                continue

            entity = {}
            has_data = False
            for field, field_type in self.normalized_schema.items():
                raw_val = raw_entity.get(field)
                coerced = coerce_value(raw_val, field_type)
                entity[field] = coerced
                if coerced is not None and coerced != "":
                    has_data = True

            if has_data:
                normalized_entities.append(entity)

        if not normalized_entities:
            raise ExtractionEmptyError("No structured entities could be extracted from the page")

        return normalized_entities

    def _heuristic_html_extract(self, html: str) -> List[Dict[str, Any]]:
        """Fallback DOM tree traversal for schema matching."""
        soup = BeautifulSoup(html, "html.parser")
        extracted = {}

        # Scan meta tags and standard text elements
        title_tag = soup.find("title")
        if title_tag and title_tag.text:
            for key in ("title", "name", "header", "tier_name"):
                if key in self.normalized_schema:
                    extracted[key] = title_tag.text.strip()

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            for key in ("description", "summary", "overview", "details"):
                if key in self.normalized_schema:
                    extracted[key] = meta_desc["content"].strip()

        # Look for headings and paragraph pairs
        for field in self.normalized_schema.keys():
            if field not in extracted:
                elem = soup.find(
                    lambda tag: tag.name in ["h1", "h2", "h3", "p", "div", "span"]
                    and field in tag.text.lower()
                )
                if elem:
                    extracted[field] = elem.text.strip()

        return [extracted] if extracted else []