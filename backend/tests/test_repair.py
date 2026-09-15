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
from app.synthesis.repair import agent_architecture_issues, format_feedback, workflow_issues


def base_spec(**overrides) -> ProcessSpec:
    defaults = dict(
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
    defaults.update(overrides)
    return ProcessSpec(**defaults)


def test_agent_architecture_issues_empty_for_well_formed_architecture():
    spec = base_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(
                id="scorer", purpose="Score leads",
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=["crm.read"], memory=Memory(type="none"),
            )
        ],
    )
    assert agent_architecture_issues(spec, arch) == []


def test_agent_architecture_issues_flags_missing_permissions():
    spec = base_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(
                id="scorer", purpose="Score leads",
                tools=[ToolBinding(name="crm", operations=["read_lead"])],
                permissions=[],  # bug: has a tool but no permission
                memory=Memory(type="none"),
            )
        ],
    )
    issues = agent_architecture_issues(spec, arch)
    assert len(issues) == 1
    assert "scorer" in issues[0]


def test_agent_architecture_issues_flags_forbidden_permission():
    spec = base_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[AgentDef(id="rogue", purpose="Deletes leads", permissions=["crm.delete"])],
    )
    issues = agent_architecture_issues(spec, arch)
    assert any("forbidden" in i for i in issues)


def _crm_nodes_with_approval():
    return [
        WorkflowNode(id="start", type="start"),
        WorkflowNode(id="scorer", type="agent", agent="scorer"),
        WorkflowNode(id="approval", type="human_approval"),
        WorkflowNode(id="end", type="end"),
    ]


def _crm_edges_with_approval():
    return [
        WorkflowEdge(source="start", target="scorer"),
        WorkflowEdge(source="scorer", target="approval"),
        WorkflowEdge(source="approval", target="end"),
    ]


def test_workflow_issues_empty_for_well_formed_workflow():
    spec = base_spec()
    workflow = WorkflowGraph(
        process_name=spec.name, nodes=_crm_nodes_with_approval(), edges=_crm_edges_with_approval()
    )
    assert workflow_issues(spec, workflow) == []


def test_workflow_issues_flags_missing_approval_node():
    spec = base_spec()  # requires approval for email.send
    workflow = WorkflowGraph(
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
    issues = workflow_issues(spec, workflow)
    assert any("human_approval" in i for i in issues)
    assert any("email.send" in i for i in issues)


def test_workflow_issues_flags_unreachable_node():
    spec = base_spec(human_approval=[])  # no approval requirement, isolate the reachability check
    nodes = _crm_nodes_with_approval() + [WorkflowNode(id="orphan", type="agent", agent="scorer")]
    workflow = WorkflowGraph(process_name=spec.name, nodes=nodes, edges=_crm_edges_with_approval())
    issues = workflow_issues(spec, workflow)
    assert any("orphan" in i for i in issues)


def test_format_feedback_produces_bulleted_list():
    text = format_feedback(["problem one", "problem two"])
    assert text == "- problem one\n- problem two"
