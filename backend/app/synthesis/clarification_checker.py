"""
Clarification Checker.

Runs before intent classification. Previously (and still, as a
fallback within requirement_parser.py), ChainReact filled any gap in a
request with a "sane default" and moved on silently. That is fine for
genuinely minor gaps, but wrong when the missing piece is something no
default could safely stand in for (which specific CRM/calendar/channel to
use when several are plausible, what counts as "urgent", who is allowed
to approve a refund). This stage asks a narrow question first: is there
ONE specific thing worth asking about, or is this workable as-is?

Deliberately capped by the caller (api/synthesize.py) at a small number
of rounds -- this is a quick sanity check, not an interview.
"""
from __future__ import annotations

from app.core.llm_client import structured_completion
from app.schemas import ClarificationCheck

SYSTEM_PROMPT = """You are a pre-check inside ChainReact, run before any system is designed from a \
request.

Decide if there is ONE specific, important piece of information missing that genuinely cannot be \
safely assumed -- not a style preference, not a minor default (those are fine to assume and note \
later). Examples worth asking about:
- The request names an action but not which of several plausible systems/accounts it applies to.
- A threshold or limit with real consequences (e.g. a refund amount) and no stated value.
- Who must approve a sensitive action, when the request implies approval is needed but doesn't say \
  by whom.
- HARD RULE: the request says to notify/send/route something to a "team", "the right person", "the \
  support team", or similar, WITHOUT naming the actual, concrete destination (a specific Slack \
  channel, an email address, a named person/group). This is always worth asking about -- guessing a \
  channel name means a REAL action (an actual Slack message, an actual email) silently goes to the \
  wrong place, which is a different class of problem than guessing a color or a default limit. Ask \
  something concrete and answerable, e.g. "Which Slack channel or email address should urgent \
  tickets go to?" -- not a vague "can you clarify the team?".

Examples NOT worth asking about: exact color scheme, exact wording, a specific date/time when "the \
next occurrence" is a reasonable assumption, a cost/latency limit (a conservative default is fine), \
or any destination the request already named concretely (a specific channel, address, or person).

Be conservative about everything EXCEPT the named-but-unlocated destination case above, which you \
should treat as needing a question by default.

Output must strictly match the ClarificationCheck JSON schema provided.
"""


def check_needs_clarification(requirement_text: str) -> ClarificationCheck:
    return structured_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=f"Request:\n\n{requirement_text}",
        response_model=ClarificationCheck,
    )
