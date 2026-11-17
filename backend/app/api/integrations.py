"""
Real external integrations -- Gmail and Google Calendar.

Deliberately a separate router from api/synthesize.py: everything in
synthesize.py is part of the requirement -> spec -> agents -> workflow
synthesis pipeline (simulated by design, per its own module docstrings).
Everything here is the opposite -- no LLM, no simulation, genuine calls
against the connected Google account's real Gmail/Calendar, triggered
on demand ("Run now") rather than on a schedule.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.integrations import calendar_actions, gmail_actions
from app.integrations.google_oauth import (
    GoogleNotConfiguredError,
    GoogleNotConnectedError,
    build_authorization_url,
    disconnect,
    exchange_code,
    is_connected,
)
from app.schemas import CalendarEvent, GmailLabelResult, GoogleConnectionStatus
from app.synthesis import audit
from app.synthesis.permission_suggester import PERMISSION_CATALOG
from app.tools.registry import describe_capabilities

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

_PROCESS_NAME = "Google Integration"


class GmailLabelIn(BaseModel):
    sender: str = Field(..., min_length=1, description="Sender email address to match, e.g. someone@example.com")
    label_name: str = Field(..., min_length=1, description="Gmail label to apply, created if it doesn't exist yet")
    max_results: int = Field(25, ge=1, le=100)


class CalendarEventIn(BaseModel):
    summary: str = Field(..., min_length=1)
    start: str = Field(..., description="RFC3339 datetime, e.g. 2026-01-15T09:00:00-05:00")
    end: str = Field(..., description="RFC3339 datetime, e.g. 2026-01-15T09:30:00-05:00")
    description: str = ""


def _frontend_origin() -> str:
    return os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173").split(",")[0].strip()


@router.get("/status")
def api_integrations_status() -> Dict[str, Any]:
    """Aggregated, booleans-only view of what's actually configured/connected,
    for the frontend's Integrations page. Never returns a URL, token, or
    secret -- only whether one is present."""
    google_configured = bool(os.environ.get("GOOGLE_CLIENT_ID", "").strip() and os.environ.get("GOOGLE_CLIENT_SECRET", "").strip())
    return {
        "google": {"configured": google_configured, "connected": is_connected()},
        "n8n": {"configured": bool(os.environ.get("N8N_WEBHOOK_URL", "").strip())},
        "slack": {"configured": bool(os.environ.get("SLACK_BOT_TOKEN", "").strip())},
        "http": {"configured": True},
    }


@router.get("/tools")
def api_list_tools() -> Dict[str, Any]:
    """The tool registry as the runtime executor actually sees it: which
    catalog permissions have a real handler, and whether that handler is
    usable right now (credentials present / account connected)."""
    return {"tools": describe_capabilities(sorted(PERMISSION_CATALOG))}


@router.get("/google/status", response_model=GoogleConnectionStatus)
def api_google_status() -> GoogleConnectionStatus:
    return GoogleConnectionStatus(connected=is_connected())


@router.get("/google/connect")
def api_google_connect():
    """Navigate the browser here directly (not a fetch call) -- it 302s
    straight to Google's own consent screen, which only a human in a real
    browser can complete."""
    try:
        url = build_authorization_url()
    except GoogleNotConfiguredError as e:
        raise HTTPException(503, str(e)) from e
    return RedirectResponse(url)


@router.get("/google/callback")
def api_google_callback(code: str | None = None, error: str | None = None):
    if error:
        return RedirectResponse(f"{_frontend_origin()}/?google_connect_error={error}")
    if not code:
        return RedirectResponse(f"{_frontend_origin()}/?google_connect_error=missing_code")
    try:
        exchange_code(code)
    except Exception as e:  # noqa: BLE001 -- surface whatever Google/oauthlib raised to the user, not a 500
        return RedirectResponse(f"{_frontend_origin()}/?google_connect_error={type(e).__name__}")
    audit.record(_PROCESS_NAME, "google_connected", "Google account connected.", {})
    return RedirectResponse(f"{_frontend_origin()}/?google_connected=1")


@router.post("/google/disconnect")
def api_google_disconnect() -> Dict[str, Any]:
    disconnect()
    audit.record(_PROCESS_NAME, "google_disconnected", "Google account disconnected.", {})
    return {"status": "disconnected"}


@router.post("/gmail/label-sender", response_model=GmailLabelResult)
def api_gmail_label_sender(body: GmailLabelIn) -> GmailLabelResult:
    try:
        result = gmail_actions.label_emails_from_sender(body.sender, body.label_name, body.max_results)
    except GoogleNotConnectedError as e:
        raise HTTPException(409, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    audit.record(
        _PROCESS_NAME, "gmail_labeled",
        f"Labeled {result['labeled']} message(s) from {body.sender} as '{body.label_name}'.",
        {"matched": result["matched"], "labeled": result["labeled"]},
    )
    return GmailLabelResult(**result)


@router.get("/calendar/events")
def api_list_calendar_events(max_results: int = 10) -> Dict[str, Any]:
    try:
        events = calendar_actions.list_upcoming_events(max_results)
    except GoogleNotConnectedError as e:
        raise HTTPException(409, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    return {"events": events}


@router.post("/calendar/events", response_model=CalendarEvent)
def api_create_calendar_event(body: CalendarEventIn) -> CalendarEvent:
    try:
        event = calendar_actions.create_event(body.summary, body.start, body.end, body.description)
    except GoogleNotConnectedError as e:
        raise HTTPException(409, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    audit.record(
        _PROCESS_NAME, "calendar_event_created",
        f"Created calendar event '{body.summary}'.",
        {"start": body.start, "end": body.end},
    )
    return CalendarEvent(**event)
