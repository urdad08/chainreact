"""
Requirement Doc Generator.

Renders the classified IntentSpec into a Markdown document the user
reviews (and can act on: confirm the detected build type, or flip it)
before any website/workflow generation runs. Deterministic templating,
same reasoning as dashboard_generator.py: this document's job is to
faithfully reflect what the Intent Classifier already decided, not to
re-interpret it, so there's no reason to spend another LLM call (or
introduce another source of sampling variance) rendering it.
"""
from __future__ import annotations

from app.schemas import IntentSpec

_BUILD_TYPE_LABEL = {"website": "Website", "workflow": "Workflow (multi-agent automation)"}


def _bullet_list(items: list[str], empty_label: str) -> str:
    return "\n".join(f"- {item}" for item in items) or f"- {empty_label}"


def generate_requirement_md(requirement_text: str, intent: IntentSpec) -> str:
    title = intent.suggested_name.strip() or "Build Request"
    quoted_request = "\n".join(f"> {line}" for line in requirement_text.strip().splitlines())

    return f"""# {title}

## Detected build type
**{_BUILD_TYPE_LABEL.get(intent.build_type, intent.build_type)}**

{intent.reasoning}

## Summary
{intent.summary}

## Requirements
{_bullet_list(intent.requirements, "(none extracted)")}

## Assumptions
{_bullet_list(intent.assumptions, "No assumptions were necessary -- the request was fully specified.")}

## Success criteria
{_bullet_list(intent.success_criteria, "(none extracted)")}

## Out of scope
{_bullet_list(intent.out_of_scope, "Nothing was explicitly excluded.")}

## Original request
{quoted_request}
"""
