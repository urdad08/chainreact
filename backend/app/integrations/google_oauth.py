"""
Google OAuth connection.

Unlike every other "tool" in ChainReact (CRM, generic email, payments --
all MockTool-simulated), Gmail and Calendar actions in this module are
REAL: they call Google's actual APIs against whatever account the person
running ChainReact connects. That connection can only happen through a
human completing Google's own consent screen in a browser -- no backend
code can do that on someone's behalf -- so this module's job is narrowly
scoped to that handshake: build the consent URL, exchange the resulting
code for tokens, and persist/refresh those tokens for later calls.

Single-tenant, deliberately simple storage (same philosophy as
synthesis/audit.py's JSONL file): this demo app has no user accounts, so
there is exactly one Google connection at a time, persisted to a local
JSON file (GOOGLE_TOKEN_STORE, default google_tokens.json next to the
backend process) so it survives a restart. A real multi-user deployment
would key this by user id in a database instead.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Optional

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
]

_LOCK = threading.Lock()
_TOKEN_STORE_PATH = os.environ.get(
    "GOOGLE_TOKEN_STORE", os.path.join(os.path.dirname(__file__), "..", "..", "google_tokens.json")
)


class GoogleNotConfiguredError(RuntimeError):
    """Raised when GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't set."""


class GoogleNotConnectedError(RuntimeError):
    """Raised when an action needs a Google connection that doesn't exist yet."""


def _redirect_uri() -> str:
    return os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/integrations/google/callback")


def _client_config() -> dict:
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise GoogleNotConfiguredError(
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the backend. Create an OAuth "
            "client at https://console.cloud.google.com/apis/credentials and set both env vars."
        )
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [_redirect_uri()],
        }
    }


def build_authorization_url() -> str:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())
    url, _state = flow.authorization_url(
        access_type="offline",       # request a refresh_token, not just a short-lived access token
        include_granted_scopes="true",
        prompt="consent",             # force the consent screen every time so a refresh_token is reliably issued
    )
    return url


def exchange_code(code: str) -> None:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())
    flow.fetch_token(code=code)
    _save_credentials(flow.credentials)


def _save_credentials(creds: Credentials) -> None:
    data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes,
    }
    with _LOCK:
        with open(_TOKEN_STORE_PATH, "w") as f:
            json.dump(data, f)


def _load_raw() -> Optional[dict]:
    with _LOCK:
        if not os.path.exists(_TOKEN_STORE_PATH):
            return None
        try:
            with open(_TOKEN_STORE_PATH) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return None


def is_connected() -> bool:
    return _load_raw() is not None


def get_credentials() -> Credentials:
    """Return valid Credentials for calling Gmail/Calendar, refreshing the
    access token first if it's expired. Raises GoogleNotConnectedError if
    nobody has completed the OAuth handshake yet."""
    raw = _load_raw()
    if raw is None:
        raise GoogleNotConnectedError("No Google account is connected yet -- visit /api/integrations/google/connect first.")

    creds = Credentials(
        token=raw.get("token"),
        refresh_token=raw.get("refresh_token"),
        token_uri=raw.get("token_uri"),
        client_id=raw.get("client_id"),
        client_secret=raw.get("client_secret"),
        scopes=raw.get("scopes"),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())
        _save_credentials(creds)
    return creds


def disconnect() -> None:
    with _LOCK:
        if os.path.exists(_TOKEN_STORE_PATH):
            os.remove(_TOKEN_STORE_PATH)
