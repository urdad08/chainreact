from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import (
    AgentArchitecture,
    AgentDef,
    ApprovalGate,
    Constraints,
    FailurePolicy,
    IntentSpec,
    N8nExecutionResult,
    Permissions,
    ProcessSpec,
    RuntimeExecutionResult,
    Trigger,
    WorkflowGraph,
    WorkflowNode,
)


client = TestClient(app)


def test_permission_suggestion_endpoint_returns_reviewable_recommendations():
    with patch(
        "app.api.synthesize.suggest_permissions",
        return_value={"allowed": ["crm.read"], "forbidden": [], "approval_actions": []},
    ):
        response = client.post(
            "/api/permissions/suggest",
            json={"requirement": "Review incoming CRM leads"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "allowed": ["crm.read"],
        "forbidden": [],
        "approval_actions": [],
    }


def test_csv_endpoint_processes_rows_and_audits_only_count():
    fake_n8n = N8nExecutionResult(configured=False, ok=False, error="not configured")
    with patch("app.api.synthesize.notify_n8n_lead_result", return_value=fake_n8n) as notify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/leads/process-csv",
            json={
                "csv_text": "name,email,company\nAda,ada@company.example,Analytical Engines\n",
                "sales_reps": ["Jordan Lee"],
            },
        )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["records"][0]["assigned_to"] == "Jordan Lee"
    assert response.json()["records"][0]["lead_score"] == 50
    assert response.json()["n8n_notification"] == {"configured": False, "ok": False, "status_code": None, "response_body": None, "error": "not configured"}
    assert audit_record.call_count == 2
    assert audit_record.call_args_list[0].args[3] == {"record_count": 1}
    notify.assert_called_once_with("lead_csv_processed", response.json()["records"])


def test_csv_endpoint_returns_readable_validation_error():
    response = client.post(
        "/api/leads/process-csv",
        json={"csv_text": "name,company\nAda,Analytical Engines\n"},
    )

    assert response.status_code == 400
    assert "name and email" in response.json()["detail"]


def test_build_plan_endpoint_classifies_and_documents_intent():
    fake_intent = IntentSpec(
        build_type="website",
        summary="A portfolio site for a photographer",
        requirements=["has a contact form"],
        reasoning="Describes a page to view, not a process.",
    )
    with patch("app.api.synthesize.classify_intent", return_value=fake_intent), \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post("/api/build/plan", json={"requirement": "Build me a photography site", "skip_clarification": True})

    assert response.status_code == 200
    body = response.json()
    assert body["intent"]["build_type"] == "website"
    assert body["intent"]["relevant_integrations"] == []
    assert "has a contact form" in body["requirements_md"]
    audit_record.assert_called_once()


def test_build_plan_endpoint_surfaces_relevant_integrations():
    fake_intent = IntentSpec(
        build_type="workflow",
        summary="Label incoming emails from a specific sender as Important.",
        requirements=["Labels matching emails as Important"],
        reasoning="Describes an email-organizing automation.",
        relevant_integrations=["gmail"],
    )
    with patch("app.api.synthesize.classify_intent", return_value=fake_intent), \
         patch("app.api.synthesize.audit.record"):
        response = client.post("/api/build/plan", json={"requirement": "Label emails from my boss as Important", "skip_clarification": True})

    assert response.status_code == 200
    assert response.json()["intent"]["relevant_integrations"] == ["gmail"]


def test_build_plan_endpoint_surfaces_calendar_event_draft():
    from app.schemas import CalendarEventDraft

    fake_intent = IntentSpec(
        build_type="workflow",
        summary="Schedule a Hostel Night event on November 17.",
        requirements=["Creates a calendar event titled Hostel Night"],
        reasoning="Describes a calendar scheduling action.",
        relevant_integrations=["calendar"],
        calendar_event=CalendarEventDraft(summary="Hostel Night", start="2026-11-17T18:00:00", end="2026-11-17T19:00:00"),
    )
    with patch("app.api.synthesize.classify_intent", return_value=fake_intent), \
         patch("app.api.synthesize.audit.record"):
        response = client.post("/api/build/plan", json={"requirement": "schedule an event in calendar on 17 november with hostelnight", "skip_clarification": True})

    assert response.status_code == 200
    draft = response.json()["intent"]["calendar_event"]
    assert draft["summary"] == "Hostel Night"
    assert draft["start"] == "2026-11-17T18:00:00"


def test_build_plan_endpoint_rejects_empty_requirement():
    response = client.post("/api/build/plan", json={"requirement": "   "})
    assert response.status_code == 400


def test_build_plan_endpoint_asks_for_clarification_when_needed():
    from app.schemas import ClarificationCheck

    fake_check = ClarificationCheck(needs_clarification=True, question="Which CRM system should this connect to?")
    with patch("app.api.synthesize.check_needs_clarification", return_value=fake_check), \
         patch("app.api.synthesize.classify_intent") as classify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post("/api/build/plan", json={"requirement": "Sync leads into our CRM"})

    assert response.status_code == 200
    body = response.json()
    assert body["needs_clarification"] is True
    assert body["clarification_question"] == "Which CRM system should this connect to?"
    assert body["intent"] is None
    classify.assert_not_called()  # classification never runs when a question is pending
    audit_record.assert_called_once()


def test_build_plan_endpoint_skips_clarification_when_flagged():
    fake_intent = IntentSpec(
        build_type="workflow", summary="x", requirements=[], reasoning="x",
    )
    with patch("app.api.synthesize.check_needs_clarification") as check, \
         patch("app.api.synthesize.classify_intent", return_value=fake_intent), \
         patch("app.api.synthesize.audit.record"):
        response = client.post(
            "/api/build/plan",
            json={"requirement": "Sync leads into our CRM (using HubSpot)", "skip_clarification": True},
        )

    assert response.status_code == 200
    assert response.json()["needs_clarification"] is False
    check.assert_not_called()


def test_build_website_endpoint_generates_html_and_stops_once_clean():
    intent = {
        "build_type": "website",
        "summary": "A portfolio site",
        "requirements": [],
        "reasoning": "Describes a page to view.",
    }
    clean_html = "<!doctype html><html><body>" + ("x" * 200) + "</body></html>"
    with patch("app.api.synthesize.generate_website", return_value=clean_html) as generate, \
         patch("app.api.synthesize.audit.record"):
        response = client.post(
            "/api/build/website",
            json={"requirement": "Build me a photography site", "intent": intent},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["html"] == clean_html
    assert body["repair_log"] == []
    generate.assert_called_once()


def test_build_website_endpoint_retries_with_feedback_on_issues():
    intent = {
        "build_type": "website",
        "summary": "A portfolio site",
        "requirements": ["shows pricing in three tiers"],
        "reasoning": "Describes a page to view.",
    }
    bad_html = "<!doctype html><html><body>" + ("x" * 200) + "</body></html>"
    good_html = "<!doctype html><html><body>" + ("x" * 200) + "<p>pricing tiers here</p></body></html>"
    with patch("app.api.synthesize.generate_website", side_effect=[bad_html, good_html]) as generate, \
         patch("app.api.synthesize.audit.record"):
        response = client.post(
            "/api/build/website",
            json={"requirement": "Build me a photography site", "intent": intent},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["html"] == good_html
    assert len(body["repair_log"]) == 2  # one "had issues" entry, one "repaired after" entry
    assert generate.call_count == 2


def test_n8n_notify_endpoint_records_audit_and_returns_result():
    fake_result = N8nExecutionResult(configured=True, ok=True, status_code=200, response_body="ok")
    architecture = AgentArchitecture(process_name="CRM", agents=[AgentDef(id="scorer", purpose="Score leads")])
    workflow = WorkflowGraph(
        process_name="CRM",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="end", type="end")],
        edges=[],
    )
    with patch("app.api.synthesize.notify_n8n", return_value=fake_result) as notify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/n8n/notify",
            json={
                "process_name": "CRM",
                "architecture": architecture.model_dump(),
                "workflow": workflow.model_dump(),
            },
        )

    assert response.status_code == 200
    assert response.json() == {"configured": True, "ok": True, "status_code": 200, "response_body": "ok", "error": None}
    notify.assert_called_once()
    audit_record.assert_called_once()


def test_n8n_notify_endpoint_reports_not_configured():
    fake_result = N8nExecutionResult(configured=False, ok=False, error="N8N_WEBHOOK_URL is not set.")
    architecture = AgentArchitecture(process_name="CRM", agents=[])
    workflow = WorkflowGraph(process_name="CRM", nodes=[WorkflowNode(id="start", type="start")], edges=[])
    with patch("app.api.synthesize.notify_n8n", return_value=fake_result), \
         patch("app.api.synthesize.audit.record"):
        response = client.post(
            "/api/n8n/notify",
            json={
                "process_name": "CRM",
                "architecture": architecture.model_dump(),
                "workflow": workflow.model_dump(),
            },
        )

    assert response.status_code == 200
    assert response.json()["configured"] is False


def test_n8n_agent_step_endpoint_runs_one_agent():
    with patch("app.api.synthesize.simulate_agent_step", return_value={"lead_score": "72"}) as step:
        response = client.post(
            "/api/n8n/agent-step",
            json={"agent": {"id": "scorer", "purpose": "Score leads", "outputs": ["lead_score"]}, "context": {"name": "Ada"}},
        )

    assert response.status_code == 200
    assert response.json() == {"output": {"lead_score": "72"}}
    step.assert_called_once()


def test_n8n_approval_resume_endpoint_records_audit():
    with patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/n8n/approval/resume",
            json={"process_name": "CRM", "action": "email.send", "approved": True},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "recorded"}
    audit_record.assert_called_once()
    assert audit_record.call_args.args[1] == "approval_resumed"


def _minimal_spec() -> ProcessSpec:
    return ProcessSpec(
        name="CRM Lead Management",
        objective="Qualify incoming leads",
        trigger=Trigger(type="webhook", event="new_lead"),
        permissions=Permissions(allowed=["crm.read"], forbidden=[]),
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="exponential_backoff", fallback="human_review"),
        limits=Constraints(max_cost_per_execution=0.1, max_latency_seconds=30, privacy="n/a"),
    )


def _minimal_architecture() -> AgentArchitecture:
    return AgentArchitecture(process_name="CRM Lead Management", agents=[AgentDef(id="scorer", purpose="Score leads")])


def _minimal_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="end", type="end")],
        edges=[{"source": "start", "target": "end"}],
    )


def test_runtime_execute_endpoint_notifies_n8n_when_completed():
    fake_result = RuntimeExecutionResult(
        process_name="CRM Lead Management", input_data={"name": "Ada"}, steps=[],
        final_context={"name": "Ada", "lead_score": "80"}, halted_at_approval=False,
    )
    fake_n8n = N8nExecutionResult(configured=True, ok=True, status_code=200, response_body="ok")
    with patch("app.api.synthesize.execute_process", return_value=fake_result), \
         patch("app.api.synthesize.notify_n8n_runtime_result", return_value=fake_n8n) as notify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/runtime/execute",
            json={
                "spec": _minimal_spec().model_dump(),
                "architecture": _minimal_architecture().model_dump(),
                "workflow": _minimal_workflow().model_dump(),
                "input_data": {"name": "Ada"},
                "auto_approve": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["n8n_notification"] == {"configured": True, "ok": True, "status_code": 200, "response_body": "ok", "error": None}
    notify.assert_called_once()
    assert audit_record.call_count == 2


def test_runtime_execute_endpoint_skips_n8n_when_halted_at_approval():
    fake_result = RuntimeExecutionResult(
        process_name="CRM Lead Management", input_data={"name": "Ada"}, steps=[],
        final_context={"name": "Ada"}, halted_at_approval=True,
    )
    with patch("app.api.synthesize.execute_process", return_value=fake_result), \
         patch("app.api.synthesize.notify_n8n_runtime_result") as notify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/runtime/execute",
            json={
                "spec": _minimal_spec().model_dump(),
                "architecture": _minimal_architecture().model_dump(),
                "workflow": _minimal_workflow().model_dump(),
                "input_data": {"name": "Ada"},
                "auto_approve": False,
            },
        )

    assert response.status_code == 200
    assert response.json()["n8n_notification"] is None
    notify.assert_not_called()
    assert audit_record.call_count == 1


def test_single_lead_endpoint_scores_name_contact_and_email():
    fake_n8n = N8nExecutionResult(configured=False, ok=False, error="not configured")
    with patch("app.api.synthesize.notify_n8n_lead_result", return_value=fake_n8n) as notify, \
         patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/leads/score",
            json={"name": "Ada Lovelace", "contact": "555-0100", "email": "ada@company.example"},
        )

    assert response.status_code == 200
    assert response.json()["name"] == "Ada Lovelace"
    assert response.json()["contact"] == "555-0100"
    assert response.json()["lead_score"] == 40
    assert response.json()["n8n_notification"]["configured"] is False
    assert audit_record.call_count == 2
    assert audit_record.call_args_list[0].args[3] == {"record_count": 1}
    notify.assert_called_once()
    assert notify.call_args.args[0] == "lead_scored"