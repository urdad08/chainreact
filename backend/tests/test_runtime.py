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
from app.runtime.executor import execute_process


def crm_spec() -> ProcessSpec:
    return ProcessSpec(
        name="CRM Lead Management",
        objective="Qualify and assign incoming leads",
        users=["sales_manager"],
        input_data=["name", "email", "company"],
        output_data=["lead_score", "assigned_salesperson"],
        trigger=Trigger(type="webhook", event="new_lead"),
        rules=["score lead", "assign salesperson", "send email after approval"],
        permissions=Permissions(allowed=["crm.read", "crm.write", "email.send"], forbidden=["crm.delete"]),
        human_approval=[ApprovalGate(action="email.send", required=True)],
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="exponential_backoff", fallback="human_review"),
        success_conditions=["lead_score_generated"],
        limits=Constraints(max_cost_per_execution=0.10, max_latency_seconds=30, privacy="n/a"),
    )


def crm_architecture() -> AgentArchitecture:
    return AgentArchitecture(
        process_name="CRM Lead Management",
        agents=[
            AgentDef(
                id="scoring_agent", purpose="Score the lead",
                inputs=["name", "company"], outputs=["lead_score"],
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=["crm.read"], memory=Memory(type="none"),
            ),
            AgentDef(
                id="assignment_agent", purpose="Assign to a salesperson",
                inputs=["lead_score"], outputs=["assigned_salesperson"],
                tools=[ToolBinding(name="crm", operations=["update_lead"])],
                permissions=["crm.write"], memory=Memory(type="none"),
            ),
            AgentDef(
                id="communication_agent", purpose="Send follow-up email",
                inputs=["assigned_salesperson"], outputs=["crm_updated"],
                tools=[ToolBinding(name="email", operations=["send"])],
                permissions=["email.send"], memory=Memory(type="none"),
            ),
        ],
    )


def crm_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="scoring_agent", type="agent", agent="scoring_agent"),
            WorkflowNode(id="assignment_agent", type="agent", agent="assignment_agent"),
            WorkflowNode(id="approval", type="human_approval"),
            WorkflowNode(id="communication_agent", type="agent", agent="communication_agent"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="scoring_agent"),
            WorkflowEdge(source="scoring_agent", target="assignment_agent"),
            WorkflowEdge(source="assignment_agent", target="approval"),
            WorkflowEdge(source="approval", target="communication_agent"),
            WorkflowEdge(source="communication_agent", target="end"),
        ],
    )


def fake_simulate(agent, context):
    """Deterministic stand-in for the LLM call, keyed by agent id, so tests
    don't need network access and can assert on exact values."""
    if agent.id == "scoring_agent":
        return {"lead_score": "87"}
    if agent.id == "assignment_agent":
        return {"assigned_salesperson": "Jordan Lee"}
    if agent.id == "communication_agent":
        return {"crm_updated": "true"}
    return {}


def test_context_accumulates_real_values_across_agent_steps():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    sample_input = {"name": "Ada Lovelace", "email": "ada@example.com", "company": "Analytical Engines Ltd"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=fake_simulate):
        result = execute_process(spec, arch, workflow, sample_input, auto_approve=True)

    assert not result.halted_at_approval
    assert result.final_context["lead_score"] == "87"
    assert result.final_context["assigned_salesperson"] == "Jordan Lee"
    assert result.final_context["crm_updated"] == "true"
    # original input is preserved alongside agent-produced fields
    assert result.final_context["name"] == "Ada Lovelace"

    agent_steps = [s for s in result.steps if s.type == "agent"]
    assert [s.label for s in agent_steps] == ["scoring_agent", "assignment_agent", "communication_agent"]
    assert agent_steps[0].output == {"lead_score": "87"}
    assert "crm.read_lead" in agent_steps[0].tool_calls


def test_execution_halts_at_approval_when_rejected():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    sample_input = {"name": "Ada", "email": "a@b.com", "company": "X"}

    with patch("app.runtime.executor._simulate_agent_output", side_effect=fake_simulate):
        result = execute_process(spec, arch, workflow, sample_input, auto_approve=False)

    assert result.halted_at_approval
    # communication_agent must never run since the gate rejected
    assert "crm_updated" not in result.final_context
    assert not any(s.label == "communication_agent" for s in result.steps)


def test_agent_with_no_outputs_produces_empty_dict_without_calling_llm():
    agent = AgentDef(id="silent_agent", purpose="Does something with no declared output")
    from app.runtime.executor import _simulate_agent_output

    # No outputs declared -> should short-circuit before any LLM call.
    assert _simulate_agent_output(agent, {}) == {}
