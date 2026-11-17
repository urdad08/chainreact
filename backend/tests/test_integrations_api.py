from unittest.mock import patch

from fastapi.testclient import TestClient

from app.integrations.google_oauth import GoogleNotConfiguredError, GoogleNotConnectedError
from app.main import app

client = TestClient(app)


def test_google_status_reports_connected():
    with patch("app.api.integrations.is_connected", return_value=True):
        response = client.get("/api/integrations/google/status")
    assert response.status_code == 200
    assert response.json() == {"connected": True}


def test_google_status_reports_not_connected():
    with patch("app.api.integrations.is_connected", return_value=False):
        response = client.get("/api/integrations/google/status")
    assert response.status_code == 200
    assert response.json() == {"connected": False}


def test_google_connect_redirects_to_authorization_url():
    with patch("app.api.integrations.build_authorization_url", return_value="https://accounts.google.com/o/oauth2/auth?x=1"):
        response = client.get("/api/integrations/google/connect", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert response.headers["location"] == "https://accounts.google.com/o/oauth2/auth?x=1"


def test_google_connect_returns_503_when_not_configured():
    with patch("app.api.integrations.build_authorization_url", side_effect=GoogleNotConfiguredError("not configured")):
        response = client.get("/api/integrations/google/connect", follow_redirects=False)
    assert response.status_code == 503


def test_google_callback_exchanges_code_and_redirects_to_frontend():
    with patch("app.api.integrations.exchange_code") as exchange, \
         patch("app.api.integrations.audit.record") as audit_record:
        response = client.get("/api/integrations/google/callback?code=abc123", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "google_connected=1" in response.headers["location"]
    exchange.assert_called_once_with("abc123")
    audit_record.assert_called_once()


def test_google_callback_redirects_with_error_on_failure():
    with patch("app.api.integrations.exchange_code", side_effect=RuntimeError("boom")):
        response = client.get("/api/integrations/google/callback?code=abc123", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "google_connect_error=RuntimeError" in response.headers["location"]


def test_google_callback_redirects_with_error_when_google_reports_one():
    response = client.get("/api/integrations/google/callback?error=access_denied", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "google_connect_error=access_denied" in response.headers["location"]


def test_gmail_label_sender_endpoint_returns_result_and_audits():
    fake_result = {
        "sender": "boss@example.com", "label_name": "Important", "label_id": "Label_1",
        "matched": 2, "labeled": 2, "message_ids": ["m1", "m2"],
    }
    with patch("app.api.integrations.gmail_actions.label_emails_from_sender", return_value=fake_result), \
         patch("app.api.integrations.audit.record") as audit_record:
        response = client.post(
            "/api/integrations/gmail/label-sender",
            json={"sender": "boss@example.com", "label_name": "Important"},
        )
    assert response.status_code == 200
    assert response.json()["labeled"] == 2
    audit_record.assert_called_once()


def test_gmail_label_sender_endpoint_returns_409_when_not_connected():
    with patch("app.api.integrations.gmail_actions.label_emails_from_sender", side_effect=GoogleNotConnectedError("connect first")):
        response = client.post(
            "/api/integrations/gmail/label-sender",
            json={"sender": "boss@example.com", "label_name": "Important"},
        )
    assert response.status_code == 409


def test_create_calendar_event_endpoint_returns_result_and_audits():
    fake_event = {"id": "evt1", "summary": "Sync", "start": "2026-01-15T09:00:00-05:00", "end": "2026-01-15T09:30:00-05:00", "html_link": "https://calendar.google.com/evt1"}
    with patch("app.api.integrations.calendar_actions.create_event", return_value=fake_event), \
         patch("app.api.integrations.audit.record") as audit_record:
        response = client.post(
            "/api/integrations/calendar/events",
            json={"summary": "Sync", "start": "2026-01-15T09:00:00-05:00", "end": "2026-01-15T09:30:00-05:00"},
        )
    assert response.status_code == 200
    assert response.json()["html_link"] == "https://calendar.google.com/evt1"
    audit_record.assert_called_once()


def test_list_calendar_events_endpoint_returns_409_when_not_connected():
    with patch("app.api.integrations.calendar_actions.list_upcoming_events", side_effect=GoogleNotConnectedError("connect first")):
        response = client.get("/api/integrations/calendar/events")
    assert response.status_code == 409


def test_create_calendar_event_endpoint_returns_502_on_google_api_error():
    with patch(
        "app.api.integrations.calendar_actions.create_event",
        side_effect=RuntimeError("Google Calendar API error: API not enabled"),
    ):
        response = client.post(
            "/api/integrations/calendar/events",
            json={"summary": "Sync", "start": "2026-01-15T09:00:00-05:00", "end": "2026-01-15T09:30:00-05:00"},
        )
    assert response.status_code == 502
    assert "API not enabled" in response.json()["detail"]


def test_gmail_label_sender_endpoint_returns_502_on_google_api_error():
    with patch(
        "app.api.integrations.gmail_actions.label_emails_from_sender",
        side_effect=RuntimeError("Gmail API error: API not enabled"),
    ):
        response = client.post(
            "/api/integrations/gmail/label-sender",
            json={"sender": "boss@example.com", "label_name": "Important"},
        )
    assert response.status_code == 502
    assert "API not enabled" in response.json()["detail"]


def test_integrations_status_returns_booleans_only(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://secret.example/webhook")
    monkeypatch.delenv("SLACK_BOT_TOKEN", raising=False)
    with patch("app.api.integrations.is_connected", return_value=False):
        body = client.get("/api/integrations/status").json()
    assert body["n8n"] == {"configured": True}
    assert body["slack"] == {"configured": False}
    assert body["google"]["connected"] is False
    assert "secret.example" not in str(body)


def test_tools_registry_labels_real_and_simulated(monkeypatch):
    monkeypatch.delenv("SLACK_BOT_TOKEN", raising=False)
    tools = {t["capability"]: t for t in client.get("/api/integrations/tools").json()["tools"]}
    assert tools["crm.read"]["real"] is False and tools["crm.read"]["available"] is False
    assert tools["slack.post"]["real"] is True and tools["slack.post"]["available"] is False
    assert tools["http.request"]["available"] is True
    assert tools["crm.delete"]["kind"] == "delete"
    assert tools["email.send"]["outputs"] == ["to", "subject", "message_id"]
