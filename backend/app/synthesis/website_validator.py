"""
Deterministic checks for a generated website, in the same spirit as
synthesis/repair.py's agent_architecture_issues/workflow_issues: pure
Python, no LLM call, cheap to run after every generation attempt, and
feeds its output straight into website_generator.generate_website's
`feedback` parameter on retry.

The requirement-coverage check is a heuristic (keyword overlap, not
semantic understanding) -- it cannot prove a requirement was satisfied,
only flag likely misses worth a retry. That's consistent with how the
rest of ChainReact treats LLM output: never trust it blindly, but also
don't pretend a cheap deterministic pass is a substitute for a human
actually looking at the result.
"""
from __future__ import annotations

import re
from typing import List

from app.schemas import IntentSpec

_STOPWORDS = {
    "with", "that", "this", "have", "from", "your", "page", "site", "website", "should",
    "which", "there", "their", "about", "when", "where", "into", "also", "each", "need",
    "needs", "must", "will", "using", "user", "users", "them", "they", "basic", "build",
}


def _significant_words(text: str) -> List[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9]{3,}", text.lower())
    return [w for w in words if w not in _STOPWORDS]


def website_issues(intent: IntentSpec, html: str) -> List[str]:
    issues: List[str] = []

    lowered = html.lower()
    if "<html" not in lowered:
        issues.append("Output is missing an <html> tag -- it must be a complete HTML document.")
    if "<body" not in lowered:
        issues.append("Output is missing a <body> tag -- it must be a complete HTML document.")
    if len(html.strip()) < 200:
        issues.append("Output is too short to be a real page -- it looks like a stub or placeholder.")

    for requirement in intent.requirements:
        keywords = _significant_words(requirement)
        if keywords and not any(k in lowered for k in keywords):
            issues.append(
                f"Requirement likely not addressed: \"{requirement}\" -- none of its key terms "
                f"({', '.join(keywords[:5])}) appear anywhere in the page."
            )

    return issues
