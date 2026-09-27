"""
LangChain-powered extraction engine for the scraper module.
Integrated with Model Hub for multi-key rotation and provider failover.
"""

import logging
from typing import Dict, Any, List, Union, Optional
from langchain_core.prompts import ChatPromptTemplate

from model_hub import get_structured_model
from .utils import build_dynamic_entity_model

logger = logging.getLogger(__name__)

# Maximum character limit per LLM call to safely stay below Groq's 8,000 TPM window
MAX_CHAR_LIMIT = 12000


class StructuredExtractor:
    def __init__(self, temperature: float = 0.0):
        self.temperature = temperature
        self.prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a data extraction node in a LangGraph pipeline. Your job is to extract structured entities "
                "matching the target schema from raw webpage markdown.\n\n"
                "CONTEXT / EXTRACTION INTENT:\n{reason}\n\n"
                "CRITICAL RULES:\n"
                "1. ONLY extract individual target entities matching the schema.\n"
                "2. SKIP website headers, navigation menus, footers, ads, and general SEO fluff.\n"
                "3. Keep field values concise and accurate. Do not copy paragraphs.\n"
                "4. Attach a short 'evidence' quote for each extracted entity to prove where it came from.\n"
                "5. If no entities match the schema, return an empty array `[]`."
            ),
            (
                "human",
                "Target Schema Fields: {schema_keys}\n\n"
                "Source Content:\n{markdown_text}"
            ),
        ])

    def extract(
        self,
        markdown_text: str,
        target_schema: Union[List[str], Dict[str, Any]],
        reason: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not markdown_text or not markdown_text.strip():
            logger.warning("[Extractor] Empty text provided for extraction.")
            return []

        if not target_schema:
            logger.error("[Extractor] No target_schema provided.")
            return []

        # =========================================================================
        # PAYLOAD SIZE PROTECTION (Prevents HTTP 413 / TPM rate limits)
        # =========================================================================
        if len(markdown_text) > MAX_CHAR_LIMIT:
            logger.info(
                f"[Extractor] Payload length ({len(markdown_text)} chars) exceeds safety limit ({MAX_CHAR_LIMIT} chars). "
                "Applying smart section filtering..."
            )
            markdown_text = self._smart_truncate(markdown_text, max_chars=MAX_CHAR_LIMIT)

        try:
            ContainerModel = build_dynamic_entity_model(target_schema)

            # Get structured model from Model Hub
            structured_llm = get_structured_model(
                schema=ContainerModel,
                temperature=self.temperature,
                reasoning_mode=False
            )

            extraction_chain = self.prompt | structured_llm

            schema_keys = (
                target_schema if isinstance(target_schema, list) else list(target_schema.keys())
            )

            result = extraction_chain.invoke({
                "reason": reason or "Extract records matching the target schema.",
                "schema_keys": schema_keys,
                "markdown_text": markdown_text,
            })

            if result and hasattr(result, "items"):
                return [item.model_dump(exclude_none=True) for item in result.items]
            return []

        except Exception as e:
            logger.error(f"[Extractor] LangChain Extraction failed: {str(e)}")
            raise e

    def _smart_truncate(self, text: str, max_chars: int) -> str:
        """
        Filters out non-relevant paragraphs by checking for schema/pricing keywords
        before falling back to direct character truncation.
        """
        keywords = ["price", "pricing", "$", "tier", "plan", "cost", "free", "pro", "enterprise", "month", "feature", "limit"]
        paragraphs = text.split("\n\n")

        # Keep paragraphs that contain relevant keywords
        relevant_paragraphs = [
            p for p in paragraphs if any(kw in p.lower() for kw in keywords)
        ]

        filtered_text = "\n\n".join(relevant_paragraphs)

        # Use the keyword-filtered text if it fits within the limit
        if filtered_text and len(filtered_text) <= max_chars:
            return filtered_text

        # If still over limit or no keywords matched, truncate directly
        return text[:max_chars]