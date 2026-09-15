"""
Runtime Executor (concrete execution, not just structural dry-run).

The Sandbox Executor (app/sandbox/executor.py) only checks the *shape* of a
workflow -- is it connected, does the approval gate exist -- and never asks
an LLM anything. This module actually runs the process against a sample
input record: for every agent node, it asks the LLM to play that agent's
role given its declared contract and whatever data earlier agents have
produced, and the agent's declared outputs get merged into a shared
context that flows through the rest of the graph. This is what lets you
watch real values (a lead score, an assigned salesperson) accumulate step
by step instead of just seeing "agent X would run".

This is a demonstration-grade runtime: agents are still declarative
contracts, and their "logic" is an LLM roleplaying them plausibly for the
given input -- not real deterministic code or live tool integrations. A
production Runtime Engine (a later phase) would replace the LLM call with
real code/tool calls per agent.
"""
from __future__ import annotations

import json
from typing import Any, Dict

from pydantic import create_model

from app.core.llm_client import structured_completion
from app.sandbox.mocks import MockToolRegistry
from app.schemas import AgentArchitecture, AgentDef, ProcessSpec, RuntimeExecutionResult, StepResult, WorkflowGraph


def _simulate_agent_output(agent: AgentDef, context: Dict[str, Any]) -> Dict[str, Any]:
    """Ask the LLM to produce this agent's declared outputs, given
    everything produced so far. Every output field is typed as a string
    for simplicity -- good enough to demonstrate real values flowing
    through the process without over-engineering a type system the
    AgentArchitect's plain-text 'outputs' list was never meant to carry."""
    if not agent.outputs:
        return {}

    fields = {name: (str, ...) for name in agent.outputs}
    OutputModel = create_model(f"{agent.id}_Output", **fields)  # type: ignore[call-overload]

    system_prompt = (
        f"You are simulating the agent '{agent.id}' inside a running business process. "
        f"Its purpose: {agent.purpose}. Given the process data accumulated so far, "
        f"produce this agent's declared outputs with realistic values consistent with "
        f"that input. Keep values short and concrete (e.g. a number as a numeral string, "
        f"a name as a plausible name). Return ONLY the requested fields."
    )
    user_prompt = f"Process data so far:\n{json.dumps(context, indent=2, default=str)}"

    result = structured_completion(system_prompt=system_prompt, user_prompt=user_prompt, response_model=OutputModel)
    return result.model_dump()


def execute_process(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    input_data: Dict[str, Any],
    *,
    auto_approve: bool = True,
) -> RuntimeExecutionResult:
    registry = MockToolRegistry()
    agents_by_id = {a.id: a for a in arch.agents}
    nodes_by_id = {n.id: n for n in workflow.nodes}

    adjacency: dict[str, list[str]] = {}
    for e in workflow.edges:
        adjacency.setdefault(e.source, []).append(e.target)

    context: Dict[str, Any] = dict(input_data)
    steps: list[StepResult] = []
    halted = False

    start = next((n for n in workflow.nodes if n.type == "start"), workflow.nodes[0])
    current = start
    guard = 0

    while current and guard < len(workflow.nodes) * 2 + 2:
        guard += 1

        if current.type == "start":
            steps.append(StepResult(node_id=current.id, type="start", label="start", note=f"Process '{spec.name}' begins."))

        elif current.type == "end":
            steps.append(StepResult(node_id=current.id, type="end", label="end", note="Process complete."))
            break

        elif current.type == "agent":
            agent = agents_by_id.get(current.agent or "")
            if agent:
                output = _simulate_agent_output(agent, context)
                context.update(output)

                tool_calls: list[str] = []
                for binding in agent.tools:
                    mock = registry.get(binding.name)
                    for op in binding.operations:
                        mock.call(op, **{k: context.get(k) for k in output.keys()})
                        tool_calls.append(f"{binding.name}.{op}")

                steps.append(StepResult(
                    node_id=current.id, type="agent", label=agent.id,
                    output=output, tool_calls=tool_calls,
                    note=agent.purpose,
                ))
            else:
                steps.append(StepResult(
                    node_id=current.id, type="agent", label=current.id,
                    note=f"No matching AgentDef for '{current.agent}' -- skipped.",
                ))

        elif current.type == "tool":
            tool_ref = current.tool or "unknown.unknown"
            tool_name, _, op = tool_ref.partition(".")
            mock = registry.get(tool_name or "unknown")
            mock.call(op or "call")
            steps.append(StepResult(node_id=current.id, type="tool", label=tool_ref, tool_calls=[tool_ref]))

        elif current.type == "human_approval":
            decision = "approved" if auto_approve else "rejected"
            steps.append(StepResult(
                node_id=current.id, type="human_approval", label="human_approval",
                note=f"Simulated decision: {decision}",
            ))
            if not auto_approve:
                halted = True
                break

        outgoing = adjacency.get(current.id, [])
        if not outgoing:
            break
        current = nodes_by_id.get(outgoing[0])

    return RuntimeExecutionResult(
        process_name=spec.name,
        input_data=input_data,
        steps=steps,
        final_context=context,
        halted_at_approval=halted,
    )
