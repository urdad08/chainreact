"""
Sandbox Executor (Phase 4 scope, structural version).

Agents in this phase are declarative contracts, not executable code -- there's
no agent "brain" to run yet (that's the Runtime Engine, a later phase). What
we CAN do deterministically today is walk the compiled WorkflowGraph node by
node, simulate each agent's declared tool calls against mock tools, and
simulate a human-approval decision at every human_approval gate. This proves
out the graph's shape and produces a readable execution trace for the
dashboard, without touching any real system.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Set

from app.schemas import AgentArchitecture, ProcessSpec, WorkflowGraph
from app.sandbox.mocks import MockToolRegistry


@dataclass
class SandboxResult:
    trace: List[str] = field(default_factory=list)
    visited_node_ids: Set[str] = field(default_factory=set)
    halted_at_approval: bool = False


def run_sandbox(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    *,
    auto_approve: bool = True,
) -> SandboxResult:
    result = SandboxResult()
    registry = MockToolRegistry()
    agents_by_id = {a.id: a for a in arch.agents}
    nodes_by_id = {n.id: n for n in workflow.nodes}

    adjacency: dict[str, list[str]] = {}
    for e in workflow.edges:
        adjacency.setdefault(e.source, []).append(e.target)

    start = next((n for n in workflow.nodes if n.type == "start"), workflow.nodes[0])
    current = start
    guard = 0  # safety valve against accidental cycles in a malformed graph

    while current and guard < len(workflow.nodes) * 2 + 2:
        guard += 1
        result.visited_node_ids.add(current.id)

        if current.type == "start":
            result.trace.append(f"▶ start — process '{spec.name}'")

        elif current.type == "end":
            result.trace.append("■ end — workflow complete")
            break

        elif current.type == "agent":
            agent = agents_by_id.get(current.agent or "")
            if agent:
                result.trace.append(f"→ agent '{agent.id}' ({agent.purpose})")
                for binding in agent.tools:
                    mock = registry.get(binding.name)
                    for op in binding.operations:
                        mock.call(op)
                        result.trace.append(f"    • {binding.name}.{op} called")
            else:
                result.trace.append(f"→ node '{current.id}' references unknown agent '{current.agent}'")

        elif current.type == "tool":
            tool_ref = current.tool or "unknown.unknown"
            tool_name, _, op = tool_ref.partition(".")
            mock = registry.get(tool_name or "unknown")
            mock.call(op or "call")
            result.trace.append(f"→ direct tool call '{tool_ref}'")

        elif current.type == "human_approval":
            decision = "approved" if auto_approve else "rejected"
            result.trace.append(f"⏸ human approval requested — simulated decision: {decision}")
            if not auto_approve:
                result.trace.append("    execution halted: approval was rejected")
                result.halted_at_approval = True
                break

        outgoing = adjacency.get(current.id, [])
        if not outgoing:
            break
        current = nodes_by_id.get(outgoing[0])

    return result
