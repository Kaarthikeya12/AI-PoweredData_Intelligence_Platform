"""
Utilities for URL validation and dynamic Pydantic schema construction.
Handles both List[str] and Dict[str, Any] schema inputs from Workflow 1.
"""

import re
from typing import Dict, Any, List, Union, Optional, Type
from urllib.parse import urlparse
from pydantic import BaseModel, Field, create_model


def validate_url(url: str) -> bool:
    """Validate if a string is a properly formatted HTTP/HTTPS URL."""
    if not isinstance(url, str) or not url.strip():
        return False
    try:
        parsed = urlparse(url.strip())
        return all([parsed.scheme in ("http", "https"), parsed.netloc])
    except Exception:
        return False


def build_dynamic_entity_model(
    target_schema: Union[List[str], Dict[str, Any]]
) -> Type[BaseModel]:
    """
    Dynamically constructs a Pydantic model from Workflow 1's output.
    Supports target_schema passed as a List of field names OR a Dict of types/hints.
    """
    fields: Dict[str, Any] = {}

    # Normalize input: convert list of keys into a uniform dictionary mapping
    if isinstance(target_schema, list):
        schema_dict = {key: "str" for key in target_schema}
    elif isinstance(target_schema, dict):
        schema_dict = target_schema
    else:
        schema_dict = {}

    for field_name, field_def in schema_dict.items():
        field_str = str(field_def).strip()
        field_str_lower = field_str.lower()

        hint_match = re.search(r"\((.*?)\)", field_str)
        hint = hint_match.group(1).strip() if hint_match else ""

        desc = f"Extracted value for '{field_name}'."
        if hint:
            desc += f" Context hint: {hint}."

        if "list" in field_str_lower or "array" in field_str_lower or field_name == "investors":
            fields[field_name] = (
                Optional[List[str]],
                Field(default=None, description=f"{desc} Return a list of string items."),
            )
        elif "int" in field_str_lower:
            fields[field_name] = (
                Optional[int],
                Field(default=None, description=f"{desc} Numerical integer value."),
            )
        elif "float" in field_str_lower or "number" in field_str_lower:
            fields[field_name] = (
                Optional[float],
                Field(default=None, description=f"{desc} Decimal/float value."),
            )
        elif "bool" in field_str_lower:
            fields[field_name] = (
                Optional[bool],
                Field(default=None, description=f"{desc} Boolean flag."),
            )
        else:
            fields[field_name] = (
                Optional[str],
                Field(
                    default=None,
                    description=f"{desc} Concise string value. Omit navigation noise.",
                ),
            )

    fields["evidence"] = (
        Optional[str],
        Field(
            default=None,
            description="Exact short quote or text snippet from the page backing this record.",
        ),
    )

    EntityModel = create_model("EntityRecord", **fields)

    ContainerModel = create_model(
        "ExtractionResult",
        items=(
            List[EntityModel],
            Field(
                default=[],
                description="List of all extracted entity records matching the target schema.",
            ),
        ),
    )

    return ContainerModel