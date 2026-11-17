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

import ast
import re
from typing import List

from app.schemas import AgentArchitecture, ProcessSpec, WorkflowGraph
from app.synthesis.policy import check_agent_permissions, check_tool_permission_coverage

MAX_REPAIR_ATTEMPTS = 3

_SNAKE_CASE_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def _condition_names(condition: str) -> List[str]:
    """Every bare identifier referenced in a condition string -- same AST
    walk runtime/condition_eval.py uses to evaluate one, just collecting
    names instead of a truth value, so a mismatch can be caught and
    repaired before execution ever sees it."""
    try:
        tree = ast.parse(condition, mode="eval")
    except SyntaxError:
        return []
    return [node.id for node in ast.walk(tree) if isinstance(node, ast.Name)]


def agent_architecture_issues(spec: ProcessSpec, arch: AgentArchitecture) -> List[str]:
    """Deterministic problems with a synthesized AgentArchitecture that are
    worth sending back to the LLM for a retry."""
    issues: List[str] = []

    policy = check_agent_permissions(spec, arch)
    issues.extend(i.message for i in policy.issues)

    coverage = check_tool_permission_coverage(arch)
    issues.extend(i.message for i in coverage.issues)

    for agent in arch.agents:
        for field_name, values in (("inputs", agent.inputs), ("outputs", agent.outputs)):
            for name in values:
                if not _SNAKE_CASE_RE.match(name):
                    issues.append(
                        f"Agent '{agent.id}' has a non-snake_case {field_name[:-1]} name '{name}' -- "
                        f"every input/output must be a valid snake_case identifier (e.g. "
                        f"'lead_score'), not a human-readable phrase, because it becomes a literal "
                        f"variable name at runtime."
                    )

    return issues


def workflow_issues(spec: ProcessSpec, workflow: WorkflowGraph, arch: AgentArchitecture | None = None) -> List[str]:
    """Deterministic problems with a synthesized WorkflowGraph that are
    worth sending back to the LLM for a retry."""
    issues: List[str] = []

    if arch is not None:
        known_names = set(spec.input_data) | {o for a in arch.agents for o in a.outputs}
        for edge in workflow.edges:
            if not edge.condition:
                continue
            unknown = [n for n in _condition_names(edge.condition) if n not in known_names]
            if unknown:
                issues.append(
                    f"Edge {edge.source} -> {edge.target} has condition \"{edge.condition}\" referencing "
                    f"{unknown}, which {'is' if len(unknown) == 1 else 'are'} not among any agent's "
                    f"declared outputs or the process's input_data -- this edge will never activate "
                    f"correctly. Use the exact output name(s) from the AgentArchitecture instead."
                )

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
