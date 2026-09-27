"""
LangChain-powered extraction engine for the scraper module.
"""

import logging
from typing import Dict, Any, List, Union, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from .utils import build_dynamic_entity_model

logger = logging.getLogger(__name__)


class StructuredExtractor:
    def __init__(self, model_name: str = "gemini-2.5-flash", temperature: float = 0.0):
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            max_retries=5,  # Automatic exponential backoff retries for 503/429 errors
        )

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

        try:
            ContainerModel = build_dynamic_entity_model(target_schema)
            structured_llm = self.llm.with_structured_output(ContainerModel)

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
            # Re-raise so scraper.py classifies the failure correctly (e.g. LLM_UNAVAILABLE)
            raise e