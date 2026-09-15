"""
Repair loop helpers (Phase 5 scope).

Per the brief: "Limit iterations: MAX_REPAIR_ITERATIONS = 3. Otherwise the
LLM could continuously modify the workflow." These functions are the
"diagnose" half of Generate -> Validate -> Test -> Failure -> Diagnose ->
Repair -> Test again. They're pure Python (no LLM call), so they're cheap
to run after every synthesis attempt and are fully unit-testable without
hitting the network.

Each function returns a list of plain-English problem descriptions. An
empty list means "nothing to repair." The caller (api/synthesize.py) joins
non-empty lists into a feedback string and feeds it back into the next
LLM call via the `feedback` parameter added to synthesize_agents /
synthesize_workflow.
"""
from __future__ import annotations

from typing import List

from app.schemas import AgentArchitecture, ProcessSpec, WorkflowGraph
from app.synthesis.policy import check_agent_permissions, check_tool_permission_coverage

MAX_REPAIR_ATTEMPTS = 3


def agent_architecture_issues(spec: ProcessSpec, arch: AgentArchitecture) -> List[str]:
    """Deterministic problems with a synthesized AgentArchitecture that are
    worth sending back to the LLM for a retry."""
    issues: List[str] = []

    policy = check_agent_permissions(spec, arch)
    issues.extend(i.message for i in policy.issues)

    coverage = check_tool_permission_coverage(arch)
    issues.extend(i.message for i in coverage.issues)

    return issues


def workflow_issues(spec: ProcessSpec, workflow: WorkflowGraph) -> List[str]:
    """Deterministic problems with a synthesized WorkflowGraph that are
    worth sending back to the LLM for a retry."""
    issues: List[str] = []

    if spec.human_approval:
        has_gate = any(n.type == "human_approval" for n in workflow.nodes)
        if not has_gate:
            gated_actions = ", ".join(g.action for g in spec.human_approval)
            issues.append(
                f"The workflow has zero human_approval nodes, but the process requires "
                f"approval before: {gated_actions}. Add at least one human_approval node, "
                f"placed before the node(s) that perform those actions."
            )

    node_ids = {n.id for n in workflow.nodes}
    starts = [n for n in workflow.nodes if n.type == "start"]
    ends = [n for n in workflow.nodes if n.type == "end"]
    if len(starts) != 1 or len(ends) != 1:
        issues.append(
            f"The workflow must have exactly one start node and one end node "
            f"(found {len(starts)} start, {len(ends)} end)."
        )
    else:
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
        unreached = node_ids - visited
        if unreached:
            issues.append(f"These nodes are not reachable from 'start': {sorted(unreached)}.")

    return issues


def format_feedback(issues: List[str]) -> str:
    return "\n".join(f"- {issue}" for issue in issues)
