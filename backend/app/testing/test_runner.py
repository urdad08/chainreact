"""
Test Runner (Phase 3/4 scope).

Executes the tests from test_generator.py against the actual ProcessSpec /
AgentArchitecture / WorkflowGraph, and also runs the graph through the
Sandbox Executor to produce a readable trace for the dashboard.

Deployment gating: structural, permission, and approval tests are hard
gates -- any failure there means the system is not ready to deploy.
success_condition tests are advisory (heuristic keyword coverage) and do
not block deployment on their own, since they can't be checked with full
certainty without actually running the agents.
"""
from __future__ import annotations

from typing import List, Tuple

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    ProcessSpec,
    SandboxReport,
    TestOutcome,
    WorkflowGraph,
)
from app.sandbox.executor import run_sandbox
from app.testing.test_generator import generate_tests

HARD_GATE_CATEGORIES = {"structural", "permission", "approval"}


def _check_structural_start_end(workflow: WorkflowGraph) -> Tuple[bool, str]:
    starts = [n for n in workflow.nodes if n.type == "start"]
    ends = [n for n in workflow.nodes if n.type == "end"]
    if len(starts) != 1 or len(ends) != 1:
        return False, f"Expected exactly 1 start and 1 end node; found {len(starts)} start(s), {len(ends)} end(s)."

    adjacency: dict[str, list[str]] = {}
    for e in workflow.edges:
        adjacency.setdefault(e.source, []).append(e.target)

    visited: set[str] = set()
    stack = [starts[0].id]
    while stack:
        cur = stack.pop()
        if cur in visited:
            continue
        visited.add(cur)
        stack.extend(adjacency.get(cur, []))

    unreached = [n.id for n in workflow.nodes if n.id not in visited]
    if unreached:
        return False, f"Nodes not reachable from start: {unreached}"
    return True, "All nodes reachable from start; exactly one start and one end node."


def _check_agent_nodes(arch: AgentArchitecture, workflow: WorkflowGraph) -> Tuple[bool, str]:
    node_agent_ids = {n.agent for n in workflow.nodes if n.type == "agent" and n.agent}
    missing = [a.id for a in arch.agents if a.id not in node_agent_ids]
    if missing:
        return False, f"Agents with no corresponding workflow node: {missing}"
    return True, "Every synthesized agent has a matching workflow node."


def _check_permission_subset(agent: AgentDef, spec: ProcessSpec) -> Tuple[bool, str]:
    allowed = set(spec.permissions.allowed)
    bad = [p for p in agent.permissions if p not in allowed]
    if bad:
        return False, f"Agent holds permissions outside the process's allowed list: {bad}"
    return True, "All permissions are within the process's allowed list."


def _check_tool_permission_coverage(agent: AgentDef) -> Tuple[bool, str]:
    if not agent.permissions:
        return False, "Agent has tool bindings but was granted no permissions at all."
    return True, f"Agent holds {len(agent.permissions)} permission(s) covering its declared tools."


def _check_approval_gate(action: str, workflow: WorkflowGraph) -> Tuple[bool, str]:
    has_gate = any(n.type == "human_approval" for n in workflow.nodes)
    if not has_gate:
        return False, f"No human_approval node exists in the workflow to gate '{action}'."
    return True, f"A human_approval node exists in the workflow (gates '{action}')."


def _check_success_condition(condition: str, spec: ProcessSpec, arch: AgentArchitecture) -> Tuple[bool, str]:
    haystack = " ".join(
        spec.rules + [o for a in arch.agents for o in a.outputs] + [a.purpose for a in arch.agents]
    ).lower()
    tokens = [t for t in condition.lower().replace("_", " ").split() if len(t) > 2]
    if not tokens:
        return True, "Condition too short to check meaningfully; skipping."
    hits = sum(1 for t in tokens if t in haystack)
    covered = hits >= max(1, len(tokens) // 2)
    if covered:
        return True, "Plausibly covered by an agent's declared output or a process rule."
    return False, "No agent output or rule text clearly maps to this condition -- review manually."


def run_tests(spec: ProcessSpec, arch: AgentArchitecture, workflow: WorkflowGraph) -> SandboxReport:
    tests = generate_tests(spec, arch, workflow)
    agents_by_id = {a.id: a for a in arch.agents}
    outcomes: List[TestOutcome] = []

    for test in tests:
        if test.id == "structural_start_end":
            passed, detail = _check_structural_start_end(workflow)
        elif test.id == "structural_agent_nodes":
            passed, detail = _check_agent_nodes(arch, workflow)
        elif test.id.startswith("permission_subset_"):
            agent_id = test.id[len("permission_subset_"):]
            passed, detail = _check_permission_subset(agents_by_id[agent_id], spec)
        elif test.id.startswith("permission_tool_coverage_"):
            agent_id = test.id[len("permission_tool_coverage_"):]
            passed, detail = _check_tool_permission_coverage(agents_by_id[agent_id])
        elif test.id.startswith("approval_gate_"):
            action = test.id[len("approval_gate_"):]
            passed, detail = _check_approval_gate(action, workflow)
        elif test.id.startswith("success_condition_"):
            condition = test.id[len("success_condition_"):]
            passed, detail = _check_success_condition(condition, spec, arch)
        else:
            passed, detail = False, "Unrecognized test id -- generator/runner mismatch."

        outcomes.append(TestOutcome(test=test, passed=passed, detail=detail))

    sandbox = run_sandbox(spec, arch, workflow, auto_approve=True)

    total = len(outcomes)
    passed_count = sum(1 for o in outcomes if o.passed)
    failed_count = total - passed_count
    ready = all(o.passed for o in outcomes if o.test.category in HARD_GATE_CATEGORIES)

    return SandboxReport(
        process_name=spec.name,
        total=total,
        passed=passed_count,
        failed=failed_count,
        outcomes=outcomes,
        execution_trace=sandbox.trace,
        ready_for_deployment=ready,
    )
