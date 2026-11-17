"""
Stage 2: Agent Architect.

ProcessSpec -> AgentArchitecture (a set of single-purpose agents with
declared inputs/outputs/tools/permissions/memory).

Key design principle carried over from the brief: don't create one
giant agent. Each agent should have one clear purpose, and its
'permissions' must be a subset of ProcessSpec.permissions.allowed --
that constraint is enforced here in the prompt AND re-checked in
policy.py downstream (never trust the LLM alone for a security check).
"""
from __future__ import annotations

from app.core.llm_client import structured_completion
from app.schemas import AgentArchitecture, ProcessSpec

SYSTEM_PROMPT = """You are the Agent Architect inside ChainReact.

Given a validated ProcessSpec, decide what cooperating agents are needed to carry \
out the process, and define each agent's contract.

Rules:
- Prefer several small, single-purpose agents over one large agent. A typical process \
  needs 3-7 agents (e.g. intake, enrichment, scoring, assignment, notification).
- Every agent's 'permissions' list must only contain items that appear in the \
  ProcessSpec's permissions.allowed list. Never grant an agent a forbidden permission.
- HARD RULE: if an agent has ANY entry in 'tools', it MUST have at least one entry in \
  'permissions' that covers that tool (e.g. an agent with a 'crm' tool needs a \
  permission like 'crm.read' or 'crm.write' from the allowed list). An agent with \
  tools and zero permissions is an invalid output -- never produce one.
- Each agent's 'tools' should reference logical tool names implied by the process \
  (e.g. 'crm', 'email', 'company_database') with the specific operations that agent needs.
- If an agent's tool is a generic external API call (the process mentions calling a specific \
  third-party service/endpoint not covered by crm/email/calendar/slack/database/payments), set \
  that tool's name to 'http' and fill 'config' with {'url': '<the actual endpoint, if the \
  process stated one, else a clearly-labeled placeholder>', 'method': 'GET' or 'POST'}.
- If an agent's tool is 'slack', fill 'config' with {'channel': '<the channel named in the \
  process, else \"#general\">'}. Every other tool's 'config' stays empty.
- Give each agent a short snake_case id.
- HARD RULE: every string in 'inputs' and 'outputs' must be a valid Python identifier in \
  snake_case (e.g. 'sentiment_classification_result', 'lead_score') -- NOT a human-readable \
  phrase (e.g. NOT "Sentiment classification result"). These exact strings become literal \
  variable names in the running process's shared data -- the Workflow Synthesizer's branch \
  conditions and every later agent's own 'inputs' will reference them verbatim, so a vague \
  or inconsistent name here breaks branching and data hand-off downstream.
- memory.type should be 'none' unless the agent genuinely needs to remember something \
  across steps (short_term) or across runs (long_term).
- Output must strictly match the AgentArchitecture JSON schema provided.
"""


def synthesize_agents(spec: ProcessSpec, feedback: str | None = None) -> AgentArchitecture:
    user_prompt = f"ProcessSpec:\n\n{spec.model_dump_json(indent=2)}"
    if feedback:
        user_prompt += (
            f"\n\nYour previous attempt had these problems -- fix them in this attempt:\n{feedback}"
        )
    result = structured_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=AgentArchitecture,
    )
    return result
