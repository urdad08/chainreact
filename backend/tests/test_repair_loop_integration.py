"""
Verifies the repair LOOP itself (not just the pure detection functions) by
faking synthesize_agents/synthesize_workflow to fail on the first attempt
and succeed on the second -- exactly the scenario that showed up in the
real UI (an agent synthesized with tools but no permissions).
"""
from unittest.mock import patch

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    ApprovalGate,
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


def make_spec() -> ProcessSpec:
    return ProcessSpec(
        name="CRM Lead Management",
        objective="Qualify and assign incoming leads",
        users=["sales_manager"],
        input_data=["name", "email"],
        output_data=["lead_score"],
        trigger=Trigger(type="webhook", event="new_lead"),
        rules=["score lead", "send email after approval"],
        permissions=Permissions(allowed=["crm.read", "email.send"], forbidden=["crm.delete"]),
        human_approval=[ApprovalGate(action="email.send", required=True)],
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="exponential_backoff", fallback="human_review"),
        success_conditions=["lead_scored"],
        limits=Constraints(max_cost_per_execution=0.10, max_latency_seconds=30, privacy="n/a"),
    )


def broken_arch(spec: ProcessSpec) -> AgentArchitecture:
    """Simulates exactly the real bug: an agent with tools but zero permissions."""
    return AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(
                id="scorer", purpose="Score leads",
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=[],  # <-- the bug
                memory=Memory(type="none"),
            )
        ],
    )


def fixed_arch(spec: ProcessSpec) -> AgentArchitecture:
    return AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(
                id="scorer", purpose="Score leads",
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=["crm.read"],
                memory=Memory(type="none"),
            )
        ],
    )


def broken_workflow(spec: ProcessSpec, arch: AgentArchitecture) -> WorkflowGraph:
    """Simulates the other real bug: no human_approval node despite the spec requiring one."""
    return WorkflowGraph(
        process_name=spec.name,
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="scorer", type="agent", agent="scorer"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="scorer"),
            WorkflowEdge(source="scorer", target="end"),
        ],
    )


def fixed_workflow(spec: ProcessSpec, arch: AgentArchitecture) -> WorkflowGraph:
    return WorkflowGraph(
        process_name=spec.name,
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="scorer", type="agent", agent="scorer"),
            WorkflowNode(id="approval", type="human_approval"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="scorer"),
            WorkflowEdge(source="scorer", target="approval"),
            WorkflowEdge(source="approval", target="end"),
        ],
    )


def test_repair_loop_fixes_broken_agent_architecture_on_retry():
    spec = make_spec()
    calls = {"n": 0}

    def fake_synthesize_agents(spec_arg, feedback=None):
        calls["n"] += 1
        if calls["n"] == 1:
            assert feedback is None  # first attempt: no feedback yet
            return broken_arch(spec_arg)
        # second attempt: the specific bug must be named in the feedback
        assert feedback is not None and "scorer" in feedback
        return fixed_arch(spec_arg)

    with patch("app.api.synthesize.synthesize_agents", side_effect=fake_synthesize_agents), \
         patch("app.api.synthesize.synthesize_workflow", side_effect=lambda s, a, feedback=None: fixed_workflow(s, a)), \
         patch("app.api.synthesize.parse_requirement", return_value=spec):
        from app.api.synthesize import RequirementIn, api_full_pipeline

        body = RequirementIn(
            requirement="Score leads and email after approval.",
            allowed_permissions=["crm.read", "email.send"],
            forbidden_permissions=["crm.delete"],
            approval_actions=["email.send"],
        )
        result = api_full_pipeline(body)

    assert calls["n"] == 2
    assert result.policy_check.valid
    assert result.agent_architecture.agents[0].permissions == ["crm.read"]
    assert any("repaired after 2 attempt" in entry for entry in result.repair_log)


def test_repair_loop_fixes_broken_workflow_on_retry():
    spec = make_spec()
    calls = {"n": 0}

    def fake_synthesize_workflow(spec_arg, arch_arg, feedback=None):
        calls["n"] += 1
        if calls["n"] == 1:
            assert feedback is None
            return broken_workflow(spec_arg, arch_arg)
        assert feedback is not None and "human_approval" in feedback
        return fixed_workflow(spec_arg, arch_arg)

    with patch("app.api.synthesize.synthesize_agents", side_effect=lambda s, feedback=None: fixed_arch(s)), \
         patch("app.api.synthesize.synthesize_workflow", side_effect=fake_synthesize_workflow), \
         patch("app.api.synthesize.parse_requirement", return_value=spec):
        from app.api.synthesize import RequirementIn, api_full_pipeline

        body = RequirementIn(
            requirement="Score leads and email after approval.",
            allowed_permissions=["crm.read", "email.send"],
            forbidden_permissions=["crm.delete"],
            approval_actions=["email.send"],
        )
        result = api_full_pipeline(body)

    assert calls["n"] == 2
    assert any(n.type == "human_approval" for n in result.workflow.nodes)
    assert any("Workflow repaired after 2 attempt" in entry for entry in result.repair_log)


def test_repair_loop_gives_up_after_max_attempts_and_raises():
    from fastapi import HTTPException

    spec = make_spec()

    with patch("app.api.synthesize.synthesize_agents", side_effect=lambda s, feedback=None: broken_arch(s)), \
         patch("app.api.synthesize.parse_requirement", return_value=spec):
        from app.api.synthesize import RequirementIn, api_full_pipeline

        body = RequirementIn(
            requirement="Score leads and email after approval.",
            allowed_permissions=["crm.read", "email.send"],
            forbidden_permissions=["crm.delete"],
            approval_actions=["email.send"],
        )
        try:
            api_full_pipeline(body)
            assert False, "expected HTTPException"
        except HTTPException as e:
            assert e.status_code == 422
            assert "repair attempts" in e.detail["message"]
