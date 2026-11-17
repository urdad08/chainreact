"""
IntentSpec: what the user is actually asking ChainReact to build, before
any workflow- or website-specific synthesis happens.

This is deliberately upstream of ProcessSpec. ProcessSpec always models a
business *process* (trigger/rules/agents-to-be) -- it has no way to
represent "build me a landing page". IntentSpec is the one classification
step that decides which downstream generator (the existing n8n-style
workflow pipeline, or the website generator) a free-text requirement
should be routed to, plus a plain-English checklist of what the person
asked for that the chosen generator's output can be checked against.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

BuildType = Literal["website", "workflow"]
RelevantIntegration = Literal["gmail", "calendar", "crm_leads"]


class CalendarEventDraft(BaseModel):
    summary: str = Field(..., description="Event title, e.g. 'Hostel Night'.")
    start: str = Field(..., description="RFC3339 datetime, e.g. 2026-11-17T18:00:00. Resolve any relative/partial "
        "date in the request (e.g. '17 november') against the reference date given in the prompt.")
    end: str = Field(..., description="RFC3339 datetime, e.g. 2026-11-17T19:00:00.")


class GmailActionDraft(BaseModel):
    sender: str = Field(..., description="Sender email address to match, e.g. someone@example.com.")
    label_name: str = Field(..., description="Gmail label to apply, e.g. 'Important'.")


class IntentSpec(BaseModel):
    build_type: BuildType = Field(
        ..., description="'website' if the person wants a page/site/UI to look at and use directly; "
        "'workflow' if they want a business process automated by cooperating agents (the existing "
        "ChainReact pipeline)."
    )
    suggested_name: str = Field(
        "", description="A short (2-5 word) title for this build, suitable as a document heading, "
        "e.g. 'Photography Portfolio Site' or 'CRM Lead Management Workflow'."
    )
    summary: str = Field(..., description="One or two sentences restating what the person wants, in plain English.")
    requirements: List[str] = Field(
        default_factory=list,
        description="A checklist of the concrete things the output must do/contain/satisfy, extracted from the "
        "request. Specific and verifiable, not restatements of the summary.",
    )
    assumptions: List[str] = Field(
        default_factory=list,
        description="Reasonable assumptions made to fill gaps the request left unspecified (e.g. 'No color "
        "palette was given, so a neutral professional palette is assumed'). Empty if the request left nothing "
        "ambiguous.",
    )
    success_criteria: List[str] = Field(
        default_factory=list,
        description="Concrete, checkable conditions that tell you the finished output actually satisfies this "
        "request -- e.g. 'Submitting the contact form shows a confirmation message'.",
    )
    out_of_scope: List[str] = Field(
        default_factory=list,
        description="Things the request might imply but that this build deliberately will NOT cover (e.g. "
        "'Payment processing is not included'). Empty if there's nothing worth excluding explicitly.",
    )
    reasoning: str = Field(..., description="One sentence on why build_type was chosen.")
    relevant_integrations: List[RelevantIntegration] = Field(
        default_factory=list,
        description="Which of ChainReact's real/dedicated UI panels this request actually needs, so the "
        "frontend only shows what's relevant instead of every panel always: 'gmail' if the request involves "
        "reading/filtering/labeling/sending email; 'calendar' if it involves scheduling or calendar events; "
        "'crm_leads' if it involves CRM/lead scoring, qualification, or sales-pipeline assignment. Can include "
        "more than one, or be empty if none apply (e.g. a generic website or unrelated workflow request).",
    )
    calendar_event: Optional[CalendarEventDraft] = Field(
        None, description="Only when 'calendar' is in relevant_integrations: the actual event the request "
        "describes, with any relative/partial date resolved to a concrete datetime, pre-filled so the person "
        "doesn't have to retype it into the real Calendar action's form.",
    )
    gmail_action: Optional[GmailActionDraft] = Field(
        None, description="Only when 'gmail' is in relevant_integrations: the actual sender/label the request "
        "describes, pre-filled so the person doesn't have to retype it into the real Gmail action's form.",
    )
