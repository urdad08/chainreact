"""
Test Generator (Phase 3 scope).

Deterministic, not LLM-based -- the whole point is to check whether the
LLM-synthesized architecture/workflow actually satisfies what the user
asked for, so the checker itself needs to be trustworthy and reproducible.

Generates four kinds of tests:
- structural: does the workflow graph even hold together (single start/end,
  every node reachable, every agent represented)?
- permission: does every agent's permission set stay inside what the process
  allows, and does every agent with tool bindings actually hold a permission
  for them? (This second check catches something the Policy Engine doesn't:
  an agent could pass the Policy Engine's allowed-list check while still
  being wired to a tool it has no matching permission for.)
- approval: for every human_approval gate the user configured, does a
  human_approval node actually exist in the compiled workflow?
- success_condition: for every measurable success condition in the spec, is
  there a plausible agent output or process rule that addresses it? (This one
  is a heuristic, advisory check, not a hard pass/fail gate.)
"""
from __future__ import annotations

from typing import List

from app.schemas import AgentArchitecture, ProcessSpec, TestCase, WorkflowGraph


def generate_tests(spec: ProcessSpec, arch: AgentArchitecture, workflow: WorkflowGraph) -> List[TestCase]:
    tests: List[TestCase] = []

    tests.append(TestCase(
        id="structural_start_end",
        category="structural",
        description="Workflow graph has exactly one start and one end node, and every node is reachable from start.",
    ))
    tests.append(TestCase(
        id="structural_agent_nodes",
        category="structural",
        description="Every synthesized agent has a corresponding node in the workflow graph.",
    ))

    for agent in arch.agents:
        tests.append(TestCase(
            id=f"permission_subset_{agent.id}",
            category="permission",
            description=f"Agent '{agent.id}' only holds permissions allowed by the process.",
        ))
        if agent.tools:
            tests.append(TestCase(
                id=f"permission_tool_coverage_{agent.id}",
                category="permission",
                description=f"Agent '{agent.id}' holds at least one permission covering its declared tools.",
            ))

    for gate in spec.human_approval:
        tests.append(TestCase(
            id=f"approval_gate_{gate.action}",
            category="approval",
            description=f"A human-approval node exists in the workflow gating '{gate.action}'.",
        ))

    for condition in spec.success_conditions:
        tests.append(TestCase(
            id=f"success_condition_{condition}",
            category="success_condition",
            description=f"Some agent output or process rule plausibly satisfies: '{condition}'.",
        ))

    return tests
