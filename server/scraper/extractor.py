"""
LangChain-powered extraction engine for the scraper module.
Integrated with Model Hub for multi-key rotation and provider failover.
"""

import logging
import re
from typing import Dict, Any, List, Union, Optional
from langchain_core.prompts import ChatPromptTemplate

from model_hub import get_structured_model
from .utils import build_dynamic_entity_model

logger = logging.getLogger(__name__)

# ── Payload limits ────────────────────────────────────────────────────────────
# gpt-oss-20b supports 131K tokens.  We keep a generous per-chunk budget
# while still leaving headroom for the system prompt + structured output.
CHUNK_CHAR_LIMIT = 40_000          # max chars sent to the LLM in ONE call
MAX_TOTAL_CHARS  = 100_000         # beyond this we filter before chunking


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

    # ── public API ────────────────────────────────────────────────────────────

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

        schema_keys = (
            target_schema if isinstance(target_schema, list) else list(target_schema.keys())
        )

        # Step 1 – strip obvious boilerplate regardless of topic
        clean_text = self._strip_boilerplate(markdown_text)
        logger.info(
            f"[Extractor] After boilerplate removal: {len(clean_text)} chars "
            f"(was {len(markdown_text)})"
        )

        # Step 2 – if still too big, do schema-aware relevance filtering
        if len(clean_text) > MAX_TOTAL_CHARS:
            logger.info(
                f"[Extractor] Content ({len(clean_text)} chars) exceeds {MAX_TOTAL_CHARS}. "
                "Applying relevance filtering..."
            )
            clean_text = self._relevance_filter(
                clean_text, schema_keys, reason, max_chars=MAX_TOTAL_CHARS
            )

        # Step 3 – if it fits in one chunk, send it; otherwise chunk & merge
        if len(clean_text) <= CHUNK_CHAR_LIMIT:
            return self._extract_single(clean_text, target_schema, schema_keys, reason)
        else:
            return self._extract_chunked(clean_text, target_schema, schema_keys, reason)

    # ── single-call extraction ────────────────────────────────────────────────

    def _extract_single(
        self, text: str, target_schema, schema_keys: List[str], reason: Optional[str]
    ) -> List[Dict[str, Any]]:
        try:
            ContainerModel = build_dynamic_entity_model(target_schema)
            structured_llm = get_structured_model(
                schema=ContainerModel,
                temperature=self.temperature,
                reasoning_mode=False,
            )
            chain = self.prompt | structured_llm
            result = chain.invoke({
                "reason": reason or "Extract records matching the target schema.",
                "schema_keys": schema_keys,
                "markdown_text": text,
            })
            if result and hasattr(result, "items"):
                return [item.model_dump(exclude_none=True) for item in result.items]
            return []
        except Exception as e:
            logger.error(f"[Extractor] LangChain Extraction failed: {str(e)}")
            raise

    # ── chunked extraction (for very large pages) ─────────────────────────────

    def _extract_chunked(
        self, text: str, target_schema, schema_keys: List[str], reason: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Split text into overlapping chunks, extract from each, deduplicate."""
        chunks = self._split_into_chunks(text, CHUNK_CHAR_LIMIT, overlap=2000)
        logger.info(f"[Extractor] Splitting into {len(chunks)} chunks for extraction")

        all_entities: List[Dict[str, Any]] = []
        for i, chunk in enumerate(chunks):
            logger.info(f"[Extractor] Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            try:
                entities = self._extract_single(chunk, target_schema, schema_keys, reason)
                all_entities.extend(entities)
            except Exception as e:
                logger.warning(f"[Extractor] Chunk {i+1} extraction failed: {e}")

        # Deduplicate across chunks (same entity might span chunk boundary)
        return self._deduplicate_entities(all_entities, schema_keys)

    # ── boilerplate removal (topic-agnostic) ──────────────────────────────────

    @staticmethod
    def _strip_boilerplate(text: str) -> str:
        """
        Remove common web-page noise that is irrelevant regardless of what
        the user is looking for.  No hardcoded topic keywords — purely
        structural / pattern-based.
        """
        lines = text.split("\n")
        cleaned: List[str] = []

        for line in lines:
            stripped = line.strip()

            # Skip empty / whitespace-only lines (keep one blank for paragraph breaks)
            if not stripped:
                if cleaned and cleaned[-1] != "":
                    cleaned.append("")
                continue

            # Skip lines that are just markdown link clusters (nav menus)
            # e.g.  "[Home](/home) [About](/about) [Contact](/contact)"
            link_pattern = re.findall(r"\[.*?\]\(.*?\)", stripped)
            non_link_text = re.sub(r"\[.*?\]\(.*?\)", "", stripped).strip()
            if len(link_pattern) >= 3 and len(non_link_text) < 20:
                continue

            # Skip cookie banners, social media buttons, copyright lines
            low = stripped.lower()
            if any(noise in low for noise in [
                "cookie", "accept all", "privacy policy", "terms of service",
                "all rights reserved", "©", "share on twitter", "share on facebook",
                "follow us on", "subscribe to our newsletter", "sign up for",
                "toggle navigation", "skip to content", "back to top",
            ]):
                continue

            # Skip lines that are just separators (---, ===, ***)
            if re.fullmatch(r"[-=*_]{3,}", stripped):
                continue

            cleaned.append(line)

        return "\n".join(cleaned)

    # ── relevance filtering (fully dynamic, zero hardcoded keywords) ──────────

    @staticmethod
    def _derive_keywords(schema_keys: List[str], reason: Optional[str]) -> List[str]:
        """
        Derive search keywords 100% dynamically from schema field names
        and the user's reason / intent text.  NO hardcoded dictionaries.

        'funding_amount' → ['funding', 'amount']
        'founder_names'  → ['founder', 'names']
        'ingredient_list' → ['ingredient', 'list']
        'movie_rating'   → ['movie', 'rating']
        reason="Find Series A startups" → ['find', 'series', 'startups']
        """
        tokens: set = set()

        # 1. Tokenize every schema key  (split on _ and camelCase boundaries)
        for key in schema_keys:
            # snake_case split
            parts = re.split(r"[_\-\s]+", key.lower())
            tokens.update(parts)
            # camelCase split  (e.g. "fundingAmount" → "funding", "amount")
            camel_parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", key).lower().split()
            tokens.update(camel_parts)

        # 2. Tokenize the reason / intent text
        if reason:
            reason_words = re.findall(r"[a-zA-Z]{3,}", reason.lower())
            tokens.update(reason_words)

        # 3. Remove stop words that would match almost every paragraph
        stop = {
            "the", "and", "for", "are", "but", "not", "you", "all", "can",
            "had", "her", "was", "one", "our", "out", "has", "have", "from",
            "this", "that", "with", "they", "been", "will", "each", "make",
            "like", "into", "over", "such", "than", "them", "very", "some",
            "its", "also", "after", "use", "how", "any", "these", "may",
            "str", "int", "float", "bool", "list", "dict", "none", "true",
            "false", "extract", "records", "matching", "target", "schema",
        }
        tokens -= stop
        tokens.discard("")

        return list(tokens)

    def _relevance_filter(
        self, text: str, schema_keys: List[str], reason: Optional[str], max_chars: int
    ) -> str:
        """
        Keep the most relevant paragraphs based on keywords derived
        entirely from the schema + reason.  Works for ANY topic.
        """
        keywords = self._derive_keywords(schema_keys, reason)
        logger.info(f"[Extractor] Dynamic keywords ({len(keywords)}): {keywords[:15]}...")

        paragraphs = text.split("\n\n")

        # Score each paragraph by keyword hit count
        scored: List[tuple] = []
        for p in paragraphs:
            p_stripped = p.strip()
            if len(p_stripped) < 20:
                continue
            p_lower = p_stripped.lower()
            score = sum(1 for kw in keywords if kw in p_lower)
            # Bonus: paragraphs with more prose (sentences) are more likely
            # to be real content vs. nav / sidebar fragments
            sentence_count = len(re.findall(r"[.!?]\s", p_stripped))
            score += sentence_count * 0.5
            scored.append((score, p))

        # Sort by score descending
        scored.sort(key=lambda x: x[0], reverse=True)

        # Take highest-scoring paragraphs up to the char budget
        kept: List[str] = []
        total = 0
        for sc, para in scored:
            if total + len(para) + 2 > max_chars:
                break
            kept.append(para)
            total += len(para) + 2

        if kept:
            return "\n\n".join(kept)

        # Ultimate fallback — grab the middle of the page (skip header/footer)
        quarter = len(text) // 4
        return text[quarter : quarter + max_chars]

    # ── chunking helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _split_into_chunks(text: str, chunk_size: int, overlap: int = 2000) -> List[str]:
        """Split text into chunks on paragraph boundaries with overlap."""
        paragraphs = text.split("\n\n")
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_len = 0

        for para in paragraphs:
            para_len = len(para) + 2
            if current_len + para_len > chunk_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                # Keep last few paragraphs as overlap for context continuity
                overlap_parts: List[str] = []
                overlap_len = 0
                for p in reversed(current_chunk):
                    if overlap_len + len(p) + 2 > overlap:
                        break
                    overlap_parts.insert(0, p)
                    overlap_len += len(p) + 2
                current_chunk = overlap_parts
                current_len = overlap_len

            current_chunk.append(para)
            current_len += para_len

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks

    @staticmethod
    def _deduplicate_entities(
        entities: List[Dict[str, Any]], schema_keys: List[str]
    ) -> List[Dict[str, Any]]:
        """Remove duplicate entities that were extracted from overlapping chunks."""
        if not entities:
            return []

        seen_signatures: set = set()
        unique: List[Dict[str, Any]] = []

        for entity in entities:
            # Build a signature from the non-evidence fields
            sig_parts = []
            for key in sorted(entity.keys()):
                if key == "evidence":
                    continue
                val = entity.get(key)
                if val is not None:
                    sig_parts.append(f"{key}={str(val)[:80].lower().strip()}")
            sig = "|".join(sig_parts)

            if sig and sig not in seen_signatures:
                seen_signatures.add(sig)
                unique.append(entity)

        logger.info(
            f"[Extractor] Deduplication: {len(entities)} → {len(unique)} unique entities"
        )
        return unique