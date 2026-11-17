"""
Website Generator.

The counterpart to the workflow pipeline (requirement_parser -> \
agent_architect -> workflow_generator) when the Intent Classifier decides \
the person wants a website rather than an automated process. Unlike that \
pipeline, there is no fixed structural schema to force onto the output --
a website's content and layout are exactly what free text is good at
describing -- so this stage uses llm_client.generate_text() (plain
completion) rather than structured_completion(), and asks for a single,
complete, self-contained HTML document (inline <style>/<script>, no
external dependencies) that a browser can open directly.

"Ensure the generated output follows the user's requirements" is handled
the same way the workflow pipeline handles it: a deterministic check
(website_validator.website_issues, no LLM call) runs after generation and,
on a miss, feeds the gap back into a retry -- mirroring synthesis/repair.py's
generate -> diagnose -> feedback -> retry loop, capped the same way.
"""
from __future__ import annotations

from app.core.llm_client import generate_text
from app.schemas import IntentSpec

MAX_WEBSITE_ATTEMPTS = 3

SYSTEM_PROMPT = """You are the Website Builder inside ChainReact.

Given a description of a basic website and a checklist of requirements it must satisfy, \
produce ONE complete, self-contained HTML document that a browser can open directly:
- A single <!doctype html> document with inline <style> and (if needed) inline <script> only --
  no external stylesheets, scripts, fonts, or images from a network location.
- Clean, readable, reasonably attractive styling -- this should look like a real basic website,
  not an unstyled wall of text.
- Cover every item in the requirements checklist.
- Use placeholder/sample content where the request doesn't specify exact copy -- a basic,
  functional website, not a blank shell.

Return ONLY the HTML document. No markdown code fences, no explanation, no text before
<!doctype html> or after </html>.
"""


def _strip_code_fence(text: str) -> str:
    """Gemini occasionally wraps output in a ```html ... ``` fence despite
    being told not to -- strip it rather than shipping it as part of the
    page (it would render as literal text at the top of the body)."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        lines = lines[1:]  # drop opening ``` or ```html
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


def generate_website(requirement_text: str, intent: IntentSpec, feedback: str | None = None) -> str:
    requirements_block = "\n".join(f"- {r}" for r in intent.requirements) or "- (no specific items extracted)"
    user_prompt = (
        f"Request:\n{requirement_text}\n\n"
        f"Summary: {intent.summary}\n\n"
        f"Requirements checklist:\n{requirements_block}"
    )
    if feedback:
        user_prompt += f"\n\nYour previous attempt had issues -- fix these in this attempt:\n{feedback}"

    raw = generate_text(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt, temperature=0.4)
    return _strip_code_fence(raw)
