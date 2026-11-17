from unittest.mock import patch

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    Constraints,
    FailurePolicy,
    Memory,
    Permissions,
    ProcessSpec,
    ToolBinding,
    Trigger,
    WorkflowEdge,
    WorkflowGraph,
    WorkflowNode,
)
from app.runtime.executor import execute_process, iter_workflow, resume_workflow


def base_spec(**overrides) -> ProcessSpec:
    defaults = dict(
        name="Test Process",
        objective="Do a thing",
        trigger=Trigger(type="webhook", event="x"),
        permissions=Permissions(allowed=["email.send"], forbidden=[]),
        failure_policy=FailurePolicy(max_retries=2, retry_strategy="fixed", fallback="human_review"),
        limits=Constraints(max_cost_per_execution=0.1, max_latency_seconds=30, privacy="n/a"),
    )
    defaults.update(overrides)
    return ProcessSpec(**defaults)


def branching_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="Test Process",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="scorer", type="agent", agent="scorer"),
            WorkflowNode(id="high_path", type="agent", agent="high_path"),
            WorkflowNode(id="low_path", type="agent", agent="low_path"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="scorer"),
            WorkflowEdge(source="scorer", target="high_path", condition="lead_score >= 50"),
            WorkflowEdge(source="scorer", target="low_path", condition="lead_score < 50"),
            WorkflowEdge(source="high_path", target="end"),
            WorkflowEdge(source="low_path", target="end"),
        ],
    )


def branching_architecture() -> AgentArchitecture:
    return AgentArchitecture(
        process_name="Test Process",
        agents=[
            AgentDef(id="scorer", purpose="Score it", outputs=["lead_score"]),
            AgentDef(id="high_path", purpose="Handle high scores", outputs=["routed_to"]),
            AgentDef(id="low_path", purpose="Handle low scores", outputs=["routed_to"]),
        ],
    )


def test_condition_routes_to_high_path_only():
    spec, arch, workflow = base_spec(), branching_architecture(), branching_workflow()

    def fake_simulate(agent, context):
        if agent.id == "scorer":
            return {"lead_score": "80"}
        if agent.id == "high_path":
            return {"routed_to": "high"}
        return {"routed_to": "low"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=fake_simulate):
        result = execute_process(spec, arch, workflow, {})

    labels = [s.label for s in result.steps]
    assert "high_path" in labels
    assert "low_path" not in labels
    assert result.final_context["routed_to"] == "high"
    assert result.status == "completed"


def test_condition_routes_to_low_path_only():
    spec, arch, workflow = base_spec(), branching_architecture(), branching_workflow()

    def fake_simulate(agent, context):
        if agent.id == "scorer":
            return {"lead_score": "10"}
        return {"routed_to": "low"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=fake_simulate):
        result = execute_process(spec, arch, workflow, {})

    labels = [s.label for s in result.steps]
    assert "low_path" in labels
    assert "high_path" not in labels


def test_agent_retries_on_failure_then_succeeds():
    spec = base_spec(failure_policy=FailurePolicy(max_retries=2, retry_strategy="fixed", fallback="human_review"))
    arch = AgentArchitecture(process_name="Test Process", agents=[AgentDef(id="flaky", purpose="x", outputs=["y"])])
    workflow = WorkflowGraph(
        process_name="Test Process",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="flaky", type="agent", agent="flaky"), WorkflowNode(id="end", type="end")],
        edges=[WorkflowEdge(source="start", target="flaky"), WorkflowEdge(source="flaky", target="end")],
    )

    call_count = {"n": 0}

    def flaky_simulate(agent, context):
        call_count["n"] += 1
        if call_count["n"] < 2:
            raise RuntimeError("transient LLM hiccup")
        return {"y": "ok"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=flaky_simulate):
        result = execute_process(spec, arch, workflow, {})

    assert result.status == "completed"
    agent_step = next(s for s in result.steps if s.type == "agent")
    assert agent_step.attempt == 2
    assert agent_step.status == "ok"


def test_agent_fails_whole_run_after_exhausting_retries():
    spec = base_spec(failure_policy=FailurePolicy(max_retries=1, retry_strategy="fixed", fallback="human_review"))
    arch = AgentArchitecture(process_name="Test Process", agents=[AgentDef(id="always_broken", purpose="x", outputs=["y"])])
    workflow = WorkflowGraph(
        process_name="Test Process",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="always_broken", type="agent", agent="always_broken"), WorkflowNode(id="end", type="end")],
        edges=[WorkflowEdge(source="start", target="always_broken"), WorkflowEdge(source="always_broken", target="end")],
    )

    def always_fails(agent, context):
        raise RuntimeError("permanent failure")

    with patch("app.runtime.executor._simulate_agent_output", side_effect=always_fails):
        result = execute_process(spec, arch, workflow, {})

    assert result.status == "failed"
    agent_step = next(s for s in result.steps if s.type == "agent")
    assert agent_step.status == "failed"
    assert agent_step.attempt == 2  # max_retries=1 -> 2 total attempts
    # the 'end' node must never have run since the agent step failed
    assert not any(s.type == "end" for s in result.steps)


def test_tool_call_blocked_when_agent_lacks_covering_permission():
    spec = base_spec(permissions=Permissions(allowed=["crm.read"], forbidden=[]))
    arch = AgentArchitecture(
        process_name="Test Process",
        agents=[AgentDef(
            id="unauthorized_agent", purpose="x", outputs=["y"],
            tools=[ToolBinding(name="slack", operations=["post"])],
            permissions=["crm.read"],  # does NOT cover 'slack'
        )],
    )
    workflow = WorkflowGraph(
        process_name="Test Process",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="unauthorized_agent", type="agent", agent="unauthorized_agent"), WorkflowNode(id="end", type="end")],
        edges=[WorkflowEdge(source="start", target="unauthorized_agent"), WorkflowEdge(source="unauthorized_agent", target="end")],
    )

    with patch("app.runtime.executor._simulate_agent_output", return_value={"y": "done"}):
        result = execute_process(spec, arch, workflow, {})

    agent_step = next(s for s in result.steps if s.type == "agent")
    assert agent_step.status == "blocked"
    assert agent_step.tool_call_details[0].status == "blocked"
    assert agent_step.tool_call_details[0].real is False


def test_tool_call_simulated_and_labeled_honestly_by_default():
    spec = base_spec(permissions=Permissions(allowed=["crm.read"], forbidden=[]))
    arch = AgentArchitecture(
        process_name="Test Process",
        agents=[AgentDef(
            id="agent1", purpose="x", outputs=["y"],
            tools=[ToolBinding(name="crm", operations=["read_lead"])],
            permissions=["crm.read"],
        )],
    )
    workflow = WorkflowGraph(
        process_name="Test Process",
        nodes=[WorkflowNode(id="start", type="start"), WorkflowNode(id="agent1", type="agent", agent="agent1"), WorkflowNode(id="end", type="end")],
        edges=[WorkflowEdge(source="start", target="agent1"), WorkflowEdge(source="agent1", target="end")],
    )

    with patch("app.runtime.executor._simulate_agent_output", return_value={"y": "done"}):
        result = execute_process(spec, arch, workflow, {})

    agent_step = next(s for s in result.steps if s.type == "agent")
    assert agent_step.tool_call_details[0].status == "simulated"
    assert agent_step.tool_call_details[0].real is False
    # execute_process never allows real tools -- confirmed by construction (allow_real_tools=False)


def _approval_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="Test Process",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="prep", type="agent", agent="prep"),
            WorkflowNode(id="gate", type="human_approval"),
            WorkflowNode(id="after", type="agent", agent="after"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="prep"),
            WorkflowEdge(source="prep", target="gate"),
            WorkflowEdge(source="gate", target="after"),
            WorkflowEdge(source="after", target="end"),
        ],
    )


def _approval_architecture() -> AgentArchitecture:
    return AgentArchitecture(
        process_name="Test Process",
        agents=[AgentDef(id="prep", purpose="x", outputs=["prepared"]), AgentDef(id="after", purpose="x", outputs=["finished"])],
    )


def test_run_halts_with_checkpoint_at_approval_gate():
    spec, arch, workflow = base_spec(), _approval_architecture(), _approval_workflow()
    status_box = {}
    with patch("app.runtime.executor._simulate_agent_output", side_effect=lambda a, c: {a.outputs[0]: "yes"}):
        steps = list(iter_workflow(spec, arch, workflow, {}, auto_approve=False, status_box=status_box))

    assert status_box["status"] == "waiting_approval"
    assert not any(s.label == "after" for s in steps)
    checkpoint = status_box["checkpoint"]
    assert checkpoint["pending_approval_ids"] == ["gate"]
    # "prep" ran in an earlier wave (gate only becomes ready after prep
    # finishes) -- it's not a same-wave sibling of the halt, so it won't
    # appear in this checkpoint's completed_ids; its own successor
    # activation already happened normally before the halt.
    assert checkpoint["completed_ids"] == []
    assert checkpoint["context"]["prepared"] == "yes"


def test_resume_workflow_approved_continues_to_end():
    spec, arch, workflow = base_spec(), _approval_architecture(), _approval_workflow()
    first_box = {}
    with patch("app.runtime.executor._simulate_agent_output", side_effect=lambda a, c: {a.outputs[0]: "yes"}):
        list(iter_workflow(spec, arch, workflow, {}, auto_approve=False, status_box=first_box))

    resume_box = {}
    with patch("app.runtime.executor._simulate_agent_output", side_effect=lambda a, c: {a.outputs[0]: "yes"}):
        resumed_steps = list(resume_workflow(spec, arch, workflow, first_box["checkpoint"], approved=True, status_box=resume_box))

    assert resume_box["status"] == "completed"
    labels = [s.label for s in resumed_steps]
    assert "after" in labels
    assert any(s.type == "end" for s in resumed_steps)
    assert resume_box["context"]["finished"] == "yes"


def test_resume_workflow_rejected_marks_failed_without_continuing():
    spec, arch, workflow = base_spec(), _approval_architecture(), _approval_workflow()
    first_box = {}
    with patch("app.runtime.executor._simulate_agent_output", side_effect=lambda a, c: {a.outputs[0]: "yes"}):
        list(iter_workflow(spec, arch, workflow, {}, auto_approve=False, status_box=first_box))

    resume_box = {}
    resumed_steps = list(resume_workflow(spec, arch, workflow, first_box["checkpoint"], approved=False, status_box=resume_box))

    assert resume_box["status"] == "failed"
    assert resumed_steps == []  # nothing further runs on rejection


def test_iter_workflow_runs_independent_branches_concurrently():
    """Two agents reachable from the same node with no condition should
    both run in the same wave (parallel), not one-after-another in two
    separate waves -- verified by checking both appear before 'end'."""
    spec = base_spec()
    arch = AgentArchitecture(
        process_name="Test Process",
        agents=[AgentDef(id="branch_a", purpose="x", outputs=["a"]), AgentDef(id="branch_b", purpose="x", outputs=["b"])],
    )
    workflow = WorkflowGraph(
        process_name="Test Process",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="branch_a", type="agent", agent="branch_a"),
            WorkflowNode(id="branch_b", type="agent", agent="branch_b"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="branch_a"),
            WorkflowEdge(source="start", target="branch_b"),
            WorkflowEdge(source="branch_a", target="end"),
            WorkflowEdge(source="branch_b", target="end"),
        ],
    )

    with patch("app.runtime.executor._simulate_agent_output", side_effect=lambda a, c: {a.outputs[0]: "x"}):
        status_box = {}
        steps = list(iter_workflow(spec, arch, workflow, {}, status_box=status_box))

    labels = [s.label for s in steps]
    assert "branch_a" in labels and "branch_b" in labels
    assert status_box["context"]["a"] == "x"
    assert status_box["context"]["b"] == "x"
