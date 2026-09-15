"""
Stage 1: Requirement Analyst.

Natural language business requirement -> ProcessSpec.

This stage's ONLY job is extraction and structuring. It must not
invent agents or workflow -- that happens in later stages. If the
requirement is missing information ChainReact needs (per the professor's
brief: objective/users, I/O, trigger/rules, permissions, approvals,
failure handling, success conditions, limits), this stage should fill
sane, clearly-labelled defaults rather than silently guessing important
details -- validation.py is responsible for flagging gaps to the user.
"""
from __future__ import annotations

from app.core.llm_client import structured_completion
from app.schemas import ProcessSpec

SYSTEM_PROMPT = """You are the Requirement Analyst inside ChainReact, a system that turns \
business-process requirements into formal specifications for an agent-building-agent \
system.

Extract a ProcessSpec from the user's natural-language requirement, covering: business \
objective and intended users; input data and expected output; trigger and the ordered \
process rules/steps; exceptions/failure/retry/recovery behaviour; measurable success \
conditions; and cost/latency/privacy/security limits.

IMPORTANT: Permissions (allowed/forbidden actions) and human-approval gates are configured \
separately by the user through a dedicated UI control -- NOT extracted from this text. \
Always return permissions.allowed = [], permissions.forbidden = [], and human_approval = [] \
regardless of what the requirement text says about access or approval; the caller will \
overwrite these fields with the user's explicit selections.

Rules:
- Do not invent agent names or workflow steps -- that is a later stage's job.
- 'rules' should be the ordered process steps described by the user, in their own words.
- If the user doesn't specify a limit (cost, latency, retries), use a conservative \
  reasonable default and keep it simple -- do not leave fields empty if the schema \
  requires them.
- Output must strictly match the ProcessSpec JSON schema provided.
"""


def parse_requirement(requirement_text: str) -> ProcessSpec:
    user_prompt = f"Business requirement:\n\n{requirement_text}"
    return structured_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=ProcessSpec,
    )
