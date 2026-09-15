"""
Validation Engine (Phase 1 scope: business-rule checks on top of the
Pydantic schema validation that already happens on parse).

This is deliberately rule-based, not LLM-based -- validation is where
you want determinism, not another model call that can hallucinate.
"""
from __future__ import annotations

from app.schemas import ProcessSpec, ValidationIssue, ValidationResult


def validate_process_spec(spec: ProcessSpec) -> ValidationResult:
    issues: list[ValidationIssue] = []

    if not spec.rules:
        issues.append(ValidationIssue(
            severity="error", field="rules",
            message="No process rules/steps were extracted. The workflow synthesizer has nothing to build from.",
        ))

    if not spec.permissions.allowed:
        issues.append(ValidationIssue(
            severity="warning", field="permissions.allowed",
            message="No allowed actions specified. Every agent action will be denied by the policy engine by default.",
        ))

    if not spec.success_conditions:
        issues.append(ValidationIssue(
            severity="warning", field="success_conditions",
            message="No measurable success conditions given -- the test generator will have nothing to assert on.",
        ))

    # Heuristic: if a rule mentions a sensitive verb (send/delete/pay/charge) but there's
    # no approval gate covering it, warn -- this mirrors the professor's requirement that
    # points needing human approval be explicit.
    sensitive_verbs = ["send", "delete", "pay", "charge", "refund", "transfer"]
    approval_actions = {a.action.lower() for a in spec.human_approval}
    for rule in spec.rules:
        rule_lower = rule.lower()
        for verb in sensitive_verbs:
            if verb in rule_lower and not any(verb in a for a in approval_actions):
                issues.append(ValidationIssue(
                    severity="warning",
                    field="human_approval",
                    message=(
                        f"Rule '{rule}' contains a sensitive action ('{verb}') "
                        f"with no matching human-approval gate. Confirm this is intentional."
                    ),
                ))
                break

    if spec.limits.max_cost_per_execution == 0:
        issues.append(ValidationIssue(
            severity="warning", field="limits.max_cost_per_execution",
            message="Cost limit is zero -- no LLM-calling agent will be able to execute.",
        ))

    has_errors = any(i.severity == "error" for i in issues)
    return ValidationResult(valid=not has_errors, issues=issues)
