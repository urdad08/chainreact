"""
Minimal Policy Engine (Phase 1 scope).

Even though the Agent Architect prompt instructs the LLM to only grant
allowed permissions, we never rely on an LLM instruction as a security
boundary. This module re-checks every synthesized agent's permissions
against ProcessSpec.permissions deterministically and strips/flags
anything that shouldn't be there.
"""
from __future__ import annotations

from app.schemas import AgentArchitecture, ProcessSpec, ValidationIssue, ValidationResult


def check_agent_permissions(spec: ProcessSpec, arch: AgentArchitecture) -> ValidationResult:
    issues: list[ValidationIssue] = []
    allowed = set(spec.permissions.allowed)
    forbidden = set(spec.permissions.forbidden)

    for agent in arch.agents:
        for perm in agent.permissions:
            if perm in forbidden:
                issues.append(ValidationIssue(
                    severity="error",
                    field=f"agents.{agent.id}.permissions",
                    message=f"Agent '{agent.id}' was granted forbidden permission '{perm}'.",
                ))
            elif perm not in allowed:
                issues.append(ValidationIssue(
                    severity="error",
                    field=f"agents.{agent.id}.permissions",
                    message=(
                        f"Agent '{agent.id}' was granted permission '{perm}' which is not "
                        f"in the process's allowed list. Denied by policy engine."
                    ),
                ))

    has_errors = any(i.severity == "error" for i in issues)
    return ValidationResult(valid=not has_errors, issues=issues)


def check_tool_permission_coverage(arch: AgentArchitecture) -> ValidationResult:
    """Every agent that's wired to a tool must hold at least one permission.
    The Agent Architect prompt asks for this, but -- same principle as
    check_agent_permissions -- we never rely on the LLM alone to get it right."""
    issues: list[ValidationIssue] = []
    for agent in arch.agents:
        if agent.tools and not agent.permissions:
            tool_names = [t.name for t in agent.tools]
            issues.append(ValidationIssue(
                severity="error",
                field=f"agents.{agent.id}.permissions",
                message=(
                    f"Agent '{agent.id}' has tool bindings ({tool_names}) but was granted "
                    f"no permissions at all."
                ),
            ))
    return ValidationResult(valid=not issues, issues=issues)
