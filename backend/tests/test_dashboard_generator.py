import json

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
from app.synthesis.dashboard_generator import generate_dashboard_html


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
        ],
    )


def crm_workflow() -> WorkflowGraph:
    return WorkflowGraph(
        process_name="CRM Lead Management",
        nodes=[
            WorkflowNode(id="start", type="start"),
            WorkflowNode(id="intake_agent", type="agent", agent="intake_agent"),
            WorkflowNode(id="qualification_agent", type="agent", agent="qualification_agent"),
            WorkflowNode(id="approval", type="human_approval"),
            WorkflowNode(id="end", type="end"),
        ],
        edges=[
            WorkflowEdge(source="start", target="intake_agent"),
            WorkflowEdge(source="intake_agent", target="qualification_agent"),
            WorkflowEdge(source="qualification_agent", target="approval"),
            WorkflowEdge(source="approval", target="end"),
        ],
    )


def test_generate_dashboard_is_self_contained_and_deterministic():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()

    html_a = generate_dashboard_html(spec, arch, workflow, backend_base_url="https://api.example.com")
    html_b = generate_dashboard_html(spec, arch, workflow, backend_base_url="https://api.example.com")

    assert html_a == html_b  # no LLM call in the loop -- must be byte-identical given the same input
    assert html_a.startswith("<!doctype html>")
    assert "<script>" in html_a and "</script>" in html_a
    # no external JS/CSS dependency -- the whole page must work standalone
    assert "cdn." not in html_a
    assert "unpkg.com" not in html_a


def test_generate_dashboard_bakes_in_only_this_processs_input_fields():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    html_doc = generate_dashboard_html(spec, arch, workflow)

    for field in spec.input_data:
        assert f'name="{field}"' in html_doc
    # an unrelated field name must not appear as an input
    assert 'name="unrelated_field_xyz"' not in html_doc


def test_generate_dashboard_lists_every_agent_and_approval_gate():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    html_doc = generate_dashboard_html(spec, arch, workflow)

    for agent in arch.agents:
        assert agent.id in html_doc
    for gate in spec.human_approval:
        assert gate.action in html_doc


def test_generate_dashboard_embeds_exact_spec_as_json_for_the_runtime_call():
    spec, arch, workflow = crm_spec(), crm_architecture(), crm_workflow()
    html_doc = generate_dashboard_html(spec, arch, workflow)

    # the page must call /api/runtime/execute and /api/sandbox/run with this
    # exact process baked in -- never a URL param that could be swapped for
    # a different process's spec.
    assert "/api/runtime/execute" in html_doc
    assert "/api/sandbox/run" in html_doc
    assert json.dumps(spec.model_dump(), default=str) in html_doc
