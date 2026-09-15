import pytest
from pydantic import ValidationError

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    Constraints,
    FailurePolicy,
    Permissions,
    ProcessSpec,
    Trigger,
)
from app.synthesis.policy import check_agent_permissions
from app.synthesis.validator import validate_process_spec


def make_spec(**overrides) -> ProcessSpec:
    defaults = dict(
        name="CRM Lead Management",
        objective="Qualify and assign incoming leads",
        users=["sales_manager", "sales_representative"],
        input_data=["name", "email", "company"],
        output_data=["lead_score", "assigned_salesperson"],
        trigger=Trigger(type="webhook", event="new_lead"),
        rules=["score lead", "enrich company", "assign salesperson", "send email after approval"],
        permissions=Permissions(allowed=["crm.read", "crm.write"], forbidden=["crm.delete"]),
        human_approval=[{"action": "send_email", "required": True}],
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="exponential_backoff", fallback="human_review"),
        success_conditions=["lead_score_generated", "lead_assigned"],
        limits=Constraints(max_cost_per_execution=0.10, max_latency_seconds=30, privacy="PII must not leave approved services"),
    )
    defaults.update(overrides)
    return ProcessSpec(**defaults)


def test_valid_spec_passes_validation():
    spec = make_spec()
    result = validate_process_spec(spec)
    assert result.valid
    assert not any(i.severity == "error" for i in result.issues)


def test_missing_rules_is_an_error():
    spec = make_spec(rules=[])
    result = validate_process_spec(spec)
    assert not result.valid
    assert any(i.field == "rules" for i in result.issues)


def test_sensitive_action_without_approval_warns():
    spec = make_spec(
        rules=["delete stale leads"],
        human_approval=[],
    )
    result = validate_process_spec(spec)
    assert any("delete" in i.message for i in result.issues)


def test_permissions_cannot_overlap_allowed_and_forbidden():
    with pytest.raises(ValidationError):
        Permissions(allowed=["crm.write"], forbidden=["crm.write"])


def test_policy_engine_rejects_agent_permission_outside_allowed_list():
    spec = make_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(
                id="rogue_agent",
                purpose="Does something it shouldn't",
                permissions=["crm.delete"],  # explicitly forbidden in spec
            )
        ],
    )
    result = check_agent_permissions(spec, arch)
    assert not result.valid
    assert any("forbidden" in i.message for i in result.issues)


def test_policy_engine_rejects_permission_not_in_allowed_list():
    spec = make_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[
            AgentDef(id="mystery_agent", purpose="Uses an undeclared permission", permissions=["payments.charge"])
        ],
    )
    result = check_agent_permissions(spec, arch)
    assert not result.valid


def test_policy_engine_accepts_valid_permissions():
    spec = make_spec()
    arch = AgentArchitecture(
        process_name=spec.name,
        agents=[AgentDef(id="reader_agent", purpose="Reads CRM data", permissions=["crm.read"])],
    )
    result = check_agent_permissions(spec, arch)
    assert result.valid
