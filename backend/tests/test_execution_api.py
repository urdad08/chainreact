import time
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import (
    AgentArchitecture,
    AgentDef,
    Constraints,
    FailurePolicy,
    Permissions,
    ProcessSpec,
    Trigger,
    WorkflowEdge,
    WorkflowGraph,
    WorkflowNode,
)
from app.schemas import N8nExecutionResult
from app.synthesis import system_store

client = TestClient(app)

_FAKE_N8N = N8nExecutionResult(configured=False, ok=False, error="not configured")


def _simple_spec() -> ProcessSpec:
    return ProcessSpec(
        name="Execution Test Process", objective="x", trigger=Trigger(type="webhook", event="x"),
        permissions=Permissions(allowed=[], forbidden=[]),
        failure_policy=FailurePolicy(max_retries=1, retry_strategy="fixed", fallback="human_review"),
        limits=Constraints(max_cost_per_execution=0.1, max_latency_seconds=30, privacy="n/a"),
    )


def _simple_arch() -> AgentArchitecture:
    return AgentArchitecture(process_name="Execution Test Process", agents=[AgentDef(id="worker", purpose="x", outputs=["result"])])


def _simple_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="Execution Test Process",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="worker", type="agent", agent="worker"), WorkflowNode(id="end", type="end")],
        edges=[WorkflowEdge(source="start", target="worker"), WorkflowEdge(source="worker", target="end")],
    )


def _approval_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="Execution Test Process",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="worker", type="agent", agent="worker"),
            WorkflowNode(id="gate", type="human_approval"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="worker"),
            WorkflowEdge(source="worker", target="gate"),
            WorkflowEdge(source="gate", target="end"),
        ],
    )


def _wait_for_status(run_id: str, terminal_statuses, timeout: float = 5.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = client.get(f"/api/execution/{run_id}")
        if resp.json()["status"] in terminal_statuses:
            return resp.json()
        time.sleep(0.05)
    raise AssertionError(f"Run {run_id} did not reach {terminal_statuses} within {timeout}s")


def test_start_execution_runs_in_background_to_completion():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _simple_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}), \
         patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N) as notify:
        response = client.post("/api/execution/start", json={"system_id": stored.system_id, "input_data": {}, "auto_approve": True, "allow_real_tools": False})
        assert response.status_code == 200
        run_id = response.json()["run_id"]

        final = _wait_for_status(run_id, {"completed", "failed"})

    assert final["status"] == "completed"
    assert final["final_context"]["result"] == "done"
    assert any(s["type"] == "end" for s in final["steps"])
    notify.assert_called_once()


def test_start_execution_unknown_system_returns_404():
    response = client.post("/api/execution/start", json={"system_id": "does-not-exist"})
    assert response.status_code == 404


def test_get_unknown_run_returns_404():
    response = client.get("/api/execution/does-not-exist")
    assert response.status_code == 404


def test_stream_execution_emits_step_and_done_events():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _simple_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}), \
         patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": True, "allow_real_tools": False}).json()["run_id"]

        events = []
        with client.stream("GET", f"/api/execution/{run_id}/stream") as resp:
            assert resp.status_code == 200
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    import json as _json
                    events.append(_json.loads(line[len("data: "):]))
                if events and events[-1].get("type") == "done":
                    break

    assert any(e["type"] == "step" for e in events)
    assert events[-1]["type"] == "done"
    assert events[-1]["status"] == "completed"


def test_approve_resumes_paused_run_and_reaches_end():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _approval_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": False, "allow_real_tools": False}).json()["run_id"]
        waiting = _wait_for_status(run_id, {"waiting_approval", "failed", "completed"})
        assert waiting["status"] == "waiting_approval"
        assert waiting["awaiting_approval"] is True

        with patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N):
            approve_resp = client.post(f"/api/execution/{run_id}/approve", json={"approved": True})
            assert approve_resp.status_code == 200

            final = _wait_for_status(run_id, {"completed", "failed"})

    assert final["status"] == "completed"
    assert any(s["type"] == "end" for s in final["steps"])


def test_approve_rejected_marks_run_failed():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _approval_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": False, "allow_real_tools": False}).json()["run_id"]
        _wait_for_status(run_id, {"waiting_approval"})

        approve_resp = client.post(f"/api/execution/{run_id}/approve", json={"approved": False})
        assert approve_resp.status_code == 200
        final = _wait_for_status(run_id, {"completed", "failed"})

    assert final["status"] == "failed"
    assert not any(s["type"] == "end" for s in final["steps"])


def test_approve_when_not_waiting_returns_409():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _simple_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}), \
         patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": True, "allow_real_tools": False}).json()["run_id"]
        _wait_for_status(run_id, {"completed", "failed"})

        response = client.post(f"/api/execution/{run_id}/approve", json={"approved": True})
    assert response.status_code == 409


def test_list_executions_includes_started_run_with_timestamps():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _simple_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}), \
         patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": True, "allow_real_tools": False}).json()["run_id"]
        final = _wait_for_status(run_id, {"completed", "failed"})

    runs = client.get("/api/execution").json()["runs"]
    row = next(r for r in runs if r["run_id"] == run_id)
    assert row["system_id"] == stored.system_id
    assert row["status"] == "completed"
    assert row["agent_count"] == 1
    assert row["created_at"] and row["completed_at"]
    assert "steps" not in row  # list view stays lightweight
    assert len(final["step_times"]) == len(final["steps"])
    assert final["running_nodes"] == []


def test_stream_emits_running_events_before_steps_complete():
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _simple_workflow())

    def slow(agent, context):
        time.sleep(0.6)
        return {"result": "done"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=slow), \
         patch("app.api.execution.notify_n8n_runtime_result", return_value=_FAKE_N8N):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": True, "allow_real_tools": False}).json()["run_id"]
        import json as _json
        events = []
        with client.stream("GET", f"/api/execution/{run_id}/stream") as resp:
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    events.append(_json.loads(line[len("data: "):]))
                if events and events[-1].get("type") == "done":
                    break

    running = [e for e in events if e["type"] == "running" and e["node_ids"]]
    assert any("worker" in e["node_ids"] for e in running)
    assert all("at" in e for e in events if e["type"] == "step")


def test_resume_after_approval_keeps_the_runs_original_real_tools_setting():
    """Regression: a run started with allow_real_tools=False must not turn real tools on when resumed."""
    stored = system_store.save_system(_simple_spec(), _simple_arch(), _approval_workflow())
    with patch("app.runtime.executor._simulate_agent_output", return_value={"result": "done"}):
        run_id = client.post("/api/execution/start", json={"system_id": stored.system_id, "auto_approve": False, "allow_real_tools": False}).json()["run_id"]
        _wait_for_status(run_id, {"waiting_approval"})
        with patch("app.api.execution._resume_in_background") as resume:
            assert client.post(f"/api/execution/{run_id}/approve", json={"approved": True}).status_code == 200
            time.sleep(0.2)
    assert resume.call_args.args[-1] is False
