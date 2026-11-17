"""
Real Google Calendar actions, using the connected account's own OAuth
credentials (app/integrations/google_oauth.py). Same "actually works"
philosophy as gmail_actions.py: these genuinely read/write the person's
real primary calendar.
"""
from __future__ import annotations

from typing import Any, Dict, List

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.integrations.google_oauth import get_credentials


def _service():
    return build("calendar", "v3", credentials=get_credentials(), cache_discovery=False)


def list_upcoming_events(max_results: int = 10) -> List[Dict[str, Any]]:
    from datetime import datetime, timezone

    service = _service()
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = service.events().list(
            calendarId="primary", timeMin=now, maxResults=max_results, singleEvents=True, orderBy="startTime",
        ).execute()
    except HttpError as e:
        raise RuntimeError(f"Google Calendar API error: {e}") from e

    return [
        {
            "id": e.get("id"),
            "summary": e.get("summary", "(no title)"),
            "start": e.get("start", {}).get("dateTime") or e.get("start", {}).get("date"),
            "end": e.get("end", {}).get("dateTime") or e.get("end", {}).get("date"),
            "html_link": e.get("htmlLink"),
        }
        for e in result.get("items", [])
    ]


def create_event(summary: str, start_iso: str, end_iso: str, description: str = "") -> Dict[str, Any]:
    service = _service()
    try:
        event = service.events().insert(
            calendarId="primary",
            body={
                "summary": summary,
                "description": description,
                "start": {"dateTime": start_iso},
                "end": {"dateTime": end_iso},
            },
        ).execute()
    except HttpError as e:
        raise RuntimeError(f"Google Calendar API error: {e}") from e

    return {
        "id": event.get("id"),
        "summary": event.get("summary"),
        "start": event.get("start", {}).get("dateTime"),
        "end": event.get("end", {}).get("dateTime"),
        "html_link": event.get("htmlLink"),
    }
