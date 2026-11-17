"""
Real Gmail actions, using the connected account's own OAuth credentials
(app/integrations/google_oauth.py) -- this module genuinely reads and
modifies the person's real Gmail, unlike the simulated MockTool-based
tools used elsewhere in ChainReact.

Scope (v1, "Run now" triggered, not a persistent background watcher):
label_emails_from_sender is the direct implementation of the example that
motivated this feature -- "move emails from X into an Important label" --
built from Gmail API primitives: find-or-create the label, search for
matching messages, apply the label to each.
"""
from __future__ import annotations

from typing import Any, Dict, List

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.integrations.google_oauth import get_credentials


def _service():
    return build("gmail", "v1", credentials=get_credentials(), cache_discovery=False)


def _find_or_create_label(service, label_name: str) -> str:
    labels = service.users().labels().list(userId="me").execute().get("labels", [])
    for label in labels:
        if label["name"].lower() == label_name.lower():
            return label["id"]

    created = service.users().labels().create(
        userId="me",
        body={"name": label_name, "labelListVisibility": "labelShow", "messageListVisibility": "show"},
    ).execute()
    return created["id"]


def label_emails_from_sender(sender: str, label_name: str, max_results: int = 25) -> Dict[str, Any]:
    service = _service()
    try:
        label_id = _find_or_create_label(service, label_name)
        search = service.users().messages().list(userId="me", q=f"from:{sender}", maxResults=max_results).execute()

        message_ids = [m["id"] for m in search.get("messages", [])]
        labeled: List[str] = []
        for message_id in message_ids:
            service.users().messages().modify(userId="me", id=message_id, body={"addLabelIds": [label_id]}).execute()
            labeled.append(message_id)
    except HttpError as e:
        raise RuntimeError(f"Gmail API error: {e}") from e

    return {
        "sender": sender,
        "label_name": label_name,
        "label_id": label_id,
        "matched": len(message_ids),
        "labeled": len(labeled),
        "message_ids": labeled,
    }


def send_email(to: str, subject: str, body_text: str) -> Dict[str, Any]:
    import base64
    from email.mime.text import MIMEText

    service = _service()
    mime_message = MIMEText(body_text)
    mime_message["to"] = to
    mime_message["subject"] = subject
    raw = base64.urlsafe_b64encode(mime_message.as_bytes()).decode()

    try:
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except HttpError as e:
        raise RuntimeError(f"Gmail API error: {e}") from e
    return {"to": to, "subject": subject, "message_id": sent.get("id")}
