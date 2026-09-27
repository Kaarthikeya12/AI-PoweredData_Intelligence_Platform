"""
Centralized Model Hub for LangChain & LangGraph workflows.
Handles multi-key Groq rotation and OpenRouter fallback seamlessly.
"""

import os
from typing import Type, Optional, Any
from dotenv import load_dotenv
from pydantic import BaseModel

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import Runnable

load_dotenv()


def _get_base_model_instances(
    temperature: float = 0.0, 
    reasoning_mode: bool = False
) -> list[BaseChatModel]:
    """
    Builds a list of LangChain chat model instances across all Groq keys
    and OpenRouter as a backup.
    """
    groq_keys_str = os.getenv("GROQ_API_KEYS", "")
    groq_keys = [k.strip() for k in groq_keys_str.split(",") if k.strip()]
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    models: list[BaseChatModel] = []

    # Active production models on Groq
    groq_model_name = "openai/gpt-oss-120b" if reasoning_mode else "openai/gpt-oss-20b"
    openrouter_model_name = "meta-llama/llama-3.3-70b-instruct:free"

    # 1. Create a ChatGroq instance for EACH Groq key
    for key in groq_keys:
        models.append(
            ChatGroq(
                model=groq_model_name,
                groq_api_key=key,
                temperature=temperature,
                max_retries=1  # Fail fast to immediately try the next key
            )
        )

    # 2. Add OpenRouter as the final circuit breaker fallback
    if openrouter_key:
        models.append(
            ChatOpenAI(
                model=openrouter_model_name,
                openai_api_key=openrouter_key,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=temperature,
                max_retries=2
            )
        )

    if not models:
        raise ValueError("No valid API keys found in GROQ_API_KEYS or OPENROUTER_API_KEY environment variables.")

    return models


def get_model(
    temperature: float = 0.0, 
    reasoning_mode: bool = False
) -> Runnable:
    """
    Returns a standard LangChain chat model with multi-key fallback enabled.
    """
    models = _get_base_model_instances(temperature=temperature, reasoning_mode=reasoning_mode)
    
    primary_model = models[0]
    if len(models) > 1:
        return primary_model.with_fallbacks(models[1:])
    
    return primary_model


def get_structured_model(
    schema: Type[BaseModel], 
    temperature: float = 0.0, 
    reasoning_mode: bool = True
) -> Runnable:
    """
    Returns a LangChain model configured for Pydantic Structured Output 
    with multi-key fallback enabled across all underlying models.
    """
    models = _get_base_model_instances(temperature=temperature, reasoning_mode=reasoning_mode)
    
    structured_models = [m.with_structured_output(schema) for m in models]
    
    primary_model = structured_models[0]
    if len(structured_models) > 1:
        return primary_model.with_fallbacks(structured_models[1:])
    
    return primary_model