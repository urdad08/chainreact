from unittest.mock import patch

import httpx

from app.schemas import AgentArchitecture, AgentDef, WorkflowGraph, WorkflowNode
from app.synthesis.n8n_integration import build_payload, notify_n8n


def base_architecture() -> AgentArchitecture:
    return AgentArchitecture(
        process_name="CRM Lead Management",
        agents=[AgentDef(id="scorer", purpose="Score leads")],
    )


def base_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="end", type="end")],
        edges=[],
    )


def test_build_payload_shape():
    payload = build_payload("CRM Lead Management", base_architecture(), base_workflow())
    assert payload["workflow_id"] == "crm-lead-management"
    assert payload["workflow_name"] == "CRM Lead Management"
    assert payload["agents"][0]["id"] == "scorer"
    assert payload["workflow_graph"]["nodes"][0]["id"] == "start"
    assert "sent_at" in payload


def test_notify_n8n_returns_not_configured_without_env_var(monkeypatch):
    monkeypatch.delenv("N8N_WEBHOOK_URL", raising=False)
    result = notify_n8n("CRM Lead Management", base_architecture(), base_workflow())
    assert result.configured is False
    assert result.ok is False


def test_notify_n8n_posts_payload_and_returns_ok(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://example.com/webhook/abc")

    class FakeResponse:
        status_code = 200
        is_success = True
        text = '{"received":true}'

    with patch("app.synthesis.n8n_integration.httpx.post", return_value=FakeResponse()) as post:
        result = notify_n8n("CRM Lead Management", base_architecture(), base_workflow())

    assert result.configured is True
    assert result.ok is True
    assert result.status_code == 200
    assert result.response_body == '{"received":true}'
    post.assert_called_once()
    assert post.call_args.args[0] == "https://example.com/webhook/abc"


def test_notify_n8n_handles_non_2xx_response(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://example.com/webhook/abc")

    class FakeResponse:
        status_code = 500
        is_success = False
        text = "internal error"

    with patch("app.synthesis.n8n_integration.httpx.post", return_value=FakeResponse()):
        result = notify_n8n("CRM Lead Management", base_architecture(), base_workflow())

    assert result.configured is True
    assert result.ok is False
    assert result.status_code == 500
    assert "500" in result.error


def test_notify_n8n_handles_network_error(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://example.com/webhook/abc")

    with patch("app.synthesis.n8n_integration.httpx.post", side_effect=httpx.ConnectError("boom")):
        result = notify_n8n("CRM Lead Management", base_architecture(), base_workflow())

    assert result.configured is True
    assert result.ok is False
    assert "boom" in result.error
