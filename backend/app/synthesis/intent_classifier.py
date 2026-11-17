"""
Stage 0: Intent Classifier.

Runs before anything else. A free-text request can mean two very
different things in ChainReact: "automate this business process" (the
existing Requirement Analyst -> Agent Architect -> Workflow Synthesizer
pipeline) or "build me a website/page" (a new, separate generator -- see
synthesis/website_generator.py). This stage asks Gemini to decide which
one, and to extract a plain checklist of what the person actually asked
for, before either downstream path runs.

Kept as its own stage (rather than folded into requirement_parser.py) so
the user can see and override the classification -- see
synthesis/requirement_doc.py, which renders this IntentSpec into the
Markdown doc the UI shows before generation proceeds.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.llm_client import structured_completion
from app.schemas import IntentSpec

SYSTEM_PROMPT = """You are the Intent Classifier inside ChainReact, a system that can build either \
of two things from a free-text request:

1. "website" -- a page or small site the person looks at and interacts with directly: landing \
   pages, portfolios, simple informational or form-driven sites, dashboards meant to be \
   hand-designed rather than auto-templated, etc.
2. "workflow" -- a business process automated by a small team of cooperating backend agents: \
   intake/enrichment/scoring/notification-style processes, CRM/sales/ops automations, anything \
   whose output is "do this sequence of steps when X happens" rather than "show this page".

Read the request and decide which ONE of these two the person wants. "workflow" is the DEFAULT: \
choose "website" ONLY when the request explicitly asks to build a website/page/site (contains \
words like "website", "web page", "site", "landing page", "portfolio page", or unambiguously \
describes visual page content -- a gallery, a hero section, pricing tiers -- with no business \
trigger/process behind it). For anything else, including automations, integrations (email, \
calendar, CRM), or any ambiguous/underspecified request, choose "workflow".

Then write a short (2-5 word) title for this build suitable as a document heading, and extract:
- requirements: a checklist of concrete, verifiable things the output must do/contain/satisfy \
  (e.g. "has a contact form", "shows pricing in three tiers", "sends a Slack message when a lead \
  is created") -- specific enough that someone could check the finished output against each item. \
  Do not pad the list with vague restatements of the summary.
- assumptions: reasonable assumptions you had to make to fill gaps the request left unspecified \
  (e.g. "No color palette was given, so a neutral professional palette is assumed"). Leave empty \
  if the request was already fully specified.
- success_criteria: concrete, checkable conditions that tell a reviewer the finished output \
  actually satisfies this request (e.g. "Submitting the contact form shows a confirmation \
  message"). Distinct from 'requirements' -- requirements describe what to build, success \
  criteria describe how to verify it works.
- out_of_scope: things the request might seem to imply but that this build will deliberately NOT \
  cover (e.g. "Payment processing is not included"). Leave empty if nothing is worth excluding.
- relevant_integrations: which real/dedicated ChainReact UI panels this request actually needs, so \
  the frontend shows only what's relevant instead of every panel always. Choose zero or more of:
  - "gmail": the request involves reading, filtering, labeling, organizing, or sending email.
  - "calendar": the request involves scheduling, meetings, or calendar events.
  - "crm_leads": the request involves CRM/lead management -- qualifying, scoring, enriching, or \
    assigning sales leads.
  Leave this empty if the request doesn't clearly need any of these (e.g. a generic website, or a \
  workflow about something else entirely like inventory or support tickets).

If "calendar" is in relevant_integrations, also fill calendar_event with the ACTUAL event the \
request describes -- title and start/end datetime -- so the person doesn't have to retype what \
they just said into a form. Resolve any relative or partial date/time (e.g. "17 november", "next \
Monday", "tomorrow at 6") into a concrete RFC3339 datetime using the reference date given below. \
If no time is specified, default to 18:00 for a 1-hour event and note that default in \
'assumptions'. If no year is specified, use the reference date's year (or the next one, if that \
date has already passed this year).

If "gmail" is in relevant_integrations, also fill gmail_action with the ACTUAL sender email and \
label name the request describes. If the request names a person rather than an email address \
(e.g. "emails from my boss"), use that name as a best-effort guess for the sender field and note \
the guess in 'assumptions' -- do not leave the field empty.

Output must strictly match the IntentSpec JSON schema provided.
"""


def classify_intent(requirement_text: str) -> IntentSpec:
    reference_now = datetime.now(timezone.utc)
    user_prompt = (
        f"Request:\n\n{requirement_text}\n\n"
        f"Reference date/time for resolving relative or partial dates: "
        f"{reference_now.strftime('%A, %Y-%m-%d %H:%M')} UTC."
    )
    return structured_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=IntentSpec,
    )
