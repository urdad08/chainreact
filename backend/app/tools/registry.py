"""
Tool Registry.

The single place that decides which capabilities are REAL (genuinely call
an external system) versus SIMULATED (no real system exists/is connected
for this one, so the runtime executor must say so honestly instead of
faking a generic "ok" the way the old MockToolRegistry always did).

Keyed by exact permission string (the same vocabulary as
synthesis/permission_suggester.py's PERMISSION_CATALOG) rather than by
the LLM's free-form tool/operation names, because the permission catalog
is the one thing in this system with a fixed, known vocabulary -- tool
names and operations are whatever the Agent Architect happened to invent
for this particular process.

Every handler takes (operation, params, config):
- operation: the agent's free-form operation string (e.g. "send_followup_email")
  -- matched loosely by keyword, not exact equality, since the LLM invents these.
- params: the best-effort merged context (original input_data + everything
  produced so far) a handler can pull fields like 'to'/'email'/'subject' from.
- config: the ToolBinding's own config dict (e.g. {'url': ..., 'method': ...}
  for an 'http' tool, {'channel': ...} for 'slack').

A handler returns a plain dict of real output on success, or raises
RuntimeError/GoogleNotConnectedError on a real failure -- the runtime
executor converts either into a ToolCallResult.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Dict, Optional

import httpx

from app.integrations import calendar_actions, gmail_actions
from app.integrations.google_oauth import GoogleNotConnectedError, is_connected

RealHandler = Callable[[str, Dict[str, Any], Dict[str, str]], Dict[str, Any]]

_HTTP_TIMEOUT_SECONDS = 10.0


def _first(params: Dict[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        value = params.get(key)
        if value:
            return str(value)
    return None


def _looks_like(operation: str, *keywords: str) -> bool:
    op = operation.lower()
    return any(k in op for k in keywords)


def _gmail_handler(operation: str, params: Dict[str, Any], config: Dict[str, str]) -> Dict[str, Any]:
    if not is_connected():
        raise GoogleNotConnectedError(
            "No Google account is connected -- connect one in the Real Automations panel first."
        )
    if _looks_like(operation, "send", "notify", "reply"):
        to = _first(params, "to", "email", "recipient", "contact")
        if not to:
            raise RuntimeError("This email step needs a 'to' address, but none was found in the data so far.")
        subject = _first(params, "subject") or "Automated message from ChainReact"
        body = _first(params, "body", "message", "text") or ""
        return gmail_actions.send_email(to, subject, body)
    if _looks_like(operation, "read", "list", "search", "filter", "label", "monitor"):
        sender = _first(params, "sender", "from")
        label = _first(params, "label", "label_name") or "Important"
        if not sender:
            raise RuntimeError("This email step needs a 'sender' to search for, but none was found in the data so far.")
        return gmail_actions.label_emails_from_sender(sender, label)
    raise RuntimeError(f"No Gmail handler recognizes the operation '{operation}'.")


def _calendar_handler(operation: str, params: Dict[str, Any], config: Dict[str, str]) -> Dict[str, Any]:
    if not is_connected():
        raise GoogleNotConnectedError(
            "No Google account is connected -- connect one in the Real Automations panel first."
        )
    if _looks_like(operation, "write", "create", "schedule", "book", "add"):
        summary = _first(params, "summary", "title", "event_name") or "ChainReact event"
        start = _first(params, "start", "start_time", "starts_at")
        end = _first(params, "end", "end_time", "ends_at")
        if not start or not end:
            raise RuntimeError("This calendar step needs a start and end time, but none was found in the data so far.")
        return calendar_actions.create_event(summary, start, end, _first(params, "description") or "")
    if _looks_like(operation, "read", "list", "check", "view"):
        return {"events": calendar_actions.list_upcoming_events()}
    raise RuntimeError(f"No Calendar handler recognizes the operation '{operation}'.")


def _slack_handler(operation: str, params: Dict[str, Any], config: Dict[str, str]) -> Dict[str, Any]:
    token = os.environ.get("SLACK_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("SLACK_BOT_TOKEN is not set on the backend -- Slack posting isn't connected yet.")
    if not _looks_like(operation, "post", "send", "notify", "message", "alert"):
        raise RuntimeError(f"No Slack handler recognizes the operation '{operation}'.")
    channel = config.get("channel") or _first(params, "channel") or "#general"
    text = _first(params, "text", "message", "body") or "ChainReact notification"
    response = httpx.post(
        "https://slack.com/api/chat.postMessage",
        headers={"Authorization": f"Bearer {token}"},
        json={"channel": channel, "text": text},
        timeout=_HTTP_TIMEOUT_SECONDS,
    )
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack API error: {data.get('error', 'unknown error')}")
    return {"channel": channel, "ts": data.get("ts")}


def _http_handler(operation: str, params: Dict[str, Any], config: Dict[str, str]) -> Dict[str, Any]:
    url = config.get("url") or _first(params, "url")
    if not url or not url.startswith(("http://", "https://")):
        raise RuntimeError(
            "This step is a generic external API call but has no real URL configured -- set the "
            "tool's config.url (or connect the specific integration it actually needs)."
        )
    method = (config.get("method") or _first(params, "method") or "GET").upper()
    body = params.get("body") if isinstance(params.get("body"), dict) else None
    response = httpx.request(method, url, json=body, timeout=_HTTP_TIMEOUT_SECONDS)
    try:
        payload: Any = response.json()
    except ValueError:
        payload = response.text[:2000]
    if response.status_code >= 400:
        raise RuntimeError(f"{method} {url} returned HTTP {response.status_code}: {payload}")
    return {"status_code": response.status_code, "response": payload}


_REAL_HANDLERS: Dict[str, RealHandler] = {
    "email.send": _gmail_handler,
    "email.read": _gmail_handler,
    "calendar.read": _calendar_handler,
    "calendar.write": _calendar_handler,
    "slack.post": _slack_handler,
    "http.request": _http_handler,
}


def real_handler_for(permission: str) -> Optional[RealHandler]:
    return _REAL_HANDLERS.get(permission)


def is_real_capability(permission: str) -> bool:
    return permission in _REAL_HANDLERS


# Descriptive metadata for every catalog permission -- what the frontend's
# Tool Registry / Permissions pages render. "inputs" lists the context keys
# a handler actually looks up (first match wins), "outputs" the keys its
# result contributes; simulated capabilities have neither, because nothing
# real reads or returns data for them.
_CAPABILITY_INFO: Dict[str, Dict[str, Any]] = {
    "crm.read": {"kind": "read", "description": "Read customer/lead records from a CRM."},
    "crm.write": {"kind": "write", "description": "Create or update CRM records."},
    "crm.delete": {"kind": "delete", "description": "Permanently delete CRM records."},
    "email.send": {
        "kind": "external", "description": "Send an email from the connected Gmail account.",
        "inputs": ["to | email | recipient | contact", "subject", "body | message | text"],
        "outputs": ["to", "subject", "message_id"],
    },
    "email.read": {
        "kind": "read", "description": "Search the connected Gmail inbox by sender and apply a label to matches.",
        "inputs": ["sender | from", "label | label_name"],
        "outputs": ["sender", "label_name", "label_id", "matched", "labeled", "message_ids"],
    },
    "database.read": {"kind": "read", "description": "Query records from a database."},
    "database.write": {"kind": "write", "description": "Insert or update database records."},
    "payments.charge": {"kind": "external", "description": "Charge a customer's payment method."},
    "payments.refund": {"kind": "external", "description": "Refund a previous payment."},
    "slack.post": {
        "kind": "external", "description": "Post a message to a Slack channel.",
        "inputs": ["text | message | body", "channel (tool config)"],
        "outputs": ["channel", "ts"],
    },
    "slack.read": {"kind": "read", "description": "Read messages from a Slack channel."},
    "calendar.read": {
        "kind": "read", "description": "List upcoming events on the connected Google Calendar.",
        "inputs": [], "outputs": ["events"],
    },
    "calendar.write": {
        "kind": "write", "description": "Create an event on the connected Google Calendar.",
        "inputs": ["summary | title | event_name", "start | start_time", "end | end_time", "description"],
        "outputs": ["id", "summary", "start", "end", "html_link"],
    },
    "notification.send": {"kind": "external", "description": "Send a generic notification (push/SMS)."},
    "http.request": {
        "kind": "external", "description": "Call an arbitrary REST endpoint configured on the agent's tool.",
        "inputs": ["url (tool config)", "method (tool config)", "body"],
        "outputs": ["status_code", "response"],
    },
}


def _availability(permission: str) -> tuple[bool, str]:
    if permission not in _REAL_HANDLERS:
        return False, "No real integration exists for this capability -- calls run simulated and are labeled as such."
    if permission.startswith(("email.", "calendar.")):
        if is_connected():
            return True, "Google account connected."
        return False, "Real handler exists, but no Google account is connected yet."
    if permission == "slack.post":
        if os.environ.get("SLACK_BOT_TOKEN", "").strip():
            return True, "SLACK_BOT_TOKEN is configured."
        return False, "Real handler exists, but SLACK_BOT_TOKEN is not set on the backend."
    if permission == "http.request":
        return True, "Available -- each agent's tool must still configure a real URL."
    return True, "Available."


def describe_capabilities(catalog: list[str]) -> list[Dict[str, Any]]:
    out: list[Dict[str, Any]] = []
    for permission in sorted(catalog):
        info = _CAPABILITY_INFO.get(permission, {})
        available, reason = _availability(permission)
        category, _, operation = permission.partition(".")
        out.append({
            "capability": permission,
            "category": category,
            "operation": operation,
            "kind": info.get("kind", "external"),
            "description": info.get("description", ""),
            "real": permission in _REAL_HANDLERS,
            "available": available,
            "availability_reason": reason,
            "inputs": info.get("inputs", []),
            "outputs": info.get("outputs", []),
        })
    return out
