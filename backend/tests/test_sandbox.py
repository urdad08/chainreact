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
from app.sandbox.executor import run_sandbox
from app.testing.test_generator import generate_tests
from app.testing.test_runner import run_tests


def crm_spec() -> ProcessSpec:
    return ProcessSpec(
        name="CRM Lead Management",
        objective="Qualify and assign incoming leads",
        users=["sales_manager", "sales_representative"],
        input_data=["name", "email", "company"],
        output_data=["lead_score", "assigned_salesperson"],
        trigger=Trigger(type="webhook", event="new_lead"),
        rules=["validate lead", "enrich company", "score lead", "assign salesperson", "send email after approval", "update crm"],
        permissions=Permissions(allowed=["crm.read", "crm.write", "email.send"], forbidden=["crm.delete"]),
        human_approval=[ApprovalGate(action="email.send", required=True)],
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="exponential_backoff", fallback="human_review"),
        success_conditions=["lead_score_generated", "lead_assigned", "crm_updated"],
        limits=Constraints(max_cost_per_execution=0.10, max_latency_seconds=30, privacy="PII must not leave approved services"),
    )


def crm_architecture() -> AgentArchitecture:
    return AgentArchitecture(
        process_name="CRM Lead Management",
        agents=[
            AgentDef(
                id="intake_agent", purpose="Validate incoming lead",
                inputs=["lead"], outputs=["validated_lead"],
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=["crm.read"], memory=Memory(type="none"),
            ),
            AgentDef(
                id="qualification_agent", purpose="Score the lead",
                inputs=["validated_lead"], outputs=["lead_score"],
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=["crm.read"], memory=Memory(type="none"),
            ),
            AgentDef(
                id="assignment_agent", purpose="Assign lead to a salesperson",
                inputs=["lead_score"], outputs=["assigned_salesperson"],
                tools=[ToolBinding(name="crm", operations=["update_lead"])],
                permissions=["crm.write"], memory=Memory(type="none"),
            ),
            AgentDef(
                id="communication_agent", purpose="Send follow-up email",
                inputs=["assigned_salesperson"], outputs=["crm_updated"],
                tools=[ToolBinding(name="email", operations=["send"]), ToolBinding(name="crm", operations=["update_lead"])],
                permissions=["email.send", "crm.write"], memory=Memory(type="none"),
            ),
        ],
    )


def crm_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="intake_agent", type="agent", agent="intake_agent"),
            WorkflowNode(id="qualification_agent", type="agent", agent="qualification_agent"),
            WorkflowNode(id="assignment_agent", type="agent", agent="assignment_agent"),
            WorkflowNode(id="approval", type="human_approval"),
            WorkflowNode(id="communication_agent", type="agent", agent="communication_agent"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="intake_agent"),
            WorkflowEdge(source="intake_agent", target="qualification_agent"),
            WorkflowEdge(source="qualification_agent", target="assignment_agent"),
            WorkflowEdge(source="assignment_agent", target="approval"),
            WorkflowEdge(source="approval", target="communication_agent"),
            WorkflowEdge(source="communication_agent", target="end"),
        ],
    )


# ---- Test Generator ----

def test_generator_produces_one_test_per_agent_and_condition():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    tests = generate_tests(spec, arch, workflow)

    ids = {t.id for t in tests}
    assert "structural_start_end" in ids
    assert "structural_agent_nodes" in ids
    for agent in arch.agents:
        assert f"permission_subset_{agent.id}" in ids
        assert f"permission_tool_coverage_{agent.id}" in ids
    assert "approval_gate_email.send" in ids
    for cond in spec.success_conditions:
        assert f"success_condition_{cond}" in ids


# ---- Sandbox Executor ----

def test_sandbox_walks_full_graph_when_approved():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    result = run_sandbox(spec, arch, workflow, auto_approve=True)
    assert not result.halted_at_approval
    assert "end" in result.visited_node_ids
    assert any("approved" in line for line in result.trace)


def test_sandbox_halts_at_approval_when_rejected():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    result = run_sandbox(spec, arch, workflow, auto_approve=False)
    assert result.halted_at_approval
    assert "end" not in result.visited_node_ids
    assert any("rejected" in line for line in result.trace)


# ---- Test Runner / full report ----

def test_well_formed_crm_system_is_ready_for_deployment():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    report = run_tests(spec, arch, workflow)

    assert report.ready_for_deployment
    assert report.failed == 0
    assert report.total == report.passed
    assert len(report.execution_trace) > 0


def test_missing_approval_node_fails_deployment_gate():
    spec, arch = crm_spec(), crm_architecture()
    # Build a workflow that skips the approval node entirely.
    workflow = WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="intake_agent", type="agent", agent="intake_agent"),
            WorkflowNode(id="qualification_agent", type="agent", agent="qualification_agent"),
            WorkflowNode(id="assignment_agent", type="agent", agent="assignment_agent"),
            WorkflowNode(id="communication_agent", type="agent", agent="communication_agent"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="intake_agent"),
            WorkflowEdge(source="intake_agent", target="qualification_agent"),
            WorkflowEdge(source="qualification_agent", target="assignment_agent"),
            WorkflowEdge(source="assignment_agent", target="communication_agent"),
            WorkflowEdge(source="communication_agent", target="end"),
        ],
    )
    report = run_tests(spec, arch, workflow)

    assert not report.ready_for_deployment
    approval_outcomes = [o for o in report.outcomes if o.test.category == "approval"]
    assert approval_outcomes and not approval_outcomes[0].passed


def test_agent_with_no_permissions_fails_tool_coverage_check():
    spec, workflow = crm_spec(), crm_workflow()
    arch = crm_architecture()
    # Strip permissions from an agent that still has tool bindings -- a design flaw.
    arch.agents[0].permissions = []
    report = run_tests(spec, arch, workflow)

    assert not report.ready_for_deployment
    bad = [o for o in report.outcomes if o.test.id == "permission_tool_coverage_intake_agent"]
    assert bad and not bad[0].passed


def test_unreachable_node_fails_structural_check():
    spec, arch = crm_spec(), crm_architecture()
    workflow = crm_workflow()
    # Add a node with no incoming edge -- unreachable from start.
    workflow.nodes.append(WorkflowNode(id="orphan", type="agent", agent="intake_agent"))
    report = run_tests(spec, arch, workflow)

    assert not report.ready_for_deployment
    structural = [o for o in report.outcomes if o.test.id == "structural_start_end"]
    assert structural and not structural[0].passed
