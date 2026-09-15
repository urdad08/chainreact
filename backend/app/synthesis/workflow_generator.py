"""
Stage 3: Workflow Synthesizer.

ProcessSpec + AgentArchitecture -> WorkflowGraph.

Builds the machine-readable execution graph: which agent/tool runs
when, where human_approval gates sit, and what conditions branch the
flow. This graph is what gets rendered in the React Flow dashboard and
(in later phases) executed by the runtime engine.
"""
from __future__ import annotations

from app.core.llm_client import structured_completion
from app.schemas import AgentArchitecture, ProcessSpec, WorkflowGraph

SYSTEM_PROMPT = """You are the Workflow Synthesizer inside ChainReact.

Given a ProcessSpec and its AgentArchitecture, produce a WorkflowGraph: a directed \
graph of nodes (agents, tool calls, human-approval gates) and edges connecting them, \
representing the order of execution described by the process's rules.

Rules:
- Include a 'start' node and an 'end' node.
- One node per agent in the architecture, type='agent', with 'agent' set to that \
  agent's id. Node id and agent id may be the same string.
- HARD RULE: if ProcessSpec.human_approval is non-empty, the graph MUST contain at \
  least one node with type='human_approval' -- one per distinct gated action is fine, \
  but there must be at least one such node in total. A workflow with a non-empty \
  human_approval list in the spec but zero human_approval nodes in the graph is an \
  invalid output -- never produce one. Place each gate BEFORE the node that performs \
  the action it gates.
- Add type='tool' nodes for direct tool actions not already represented by an agent \
  node (e.g. a final 'email.send' step), only if that action isn't naturally the \
  output of an existing agent node.
- Use edge.condition (plain text like 'score >= 50') to represent branching described \
  in the process rules. Omit condition for unconditional edges.
- The graph must be a single connected flow from 'start' to 'end' -- every node should \
  be reachable.
- Output must strictly match the WorkflowGraph JSON schema provided.
"""


def synthesize_workflow(spec: ProcessSpec, arch: AgentArchitecture, feedback: str | None = None) -> WorkflowGraph:
    user_prompt = (
        f"ProcessSpec:\n\n{spec.model_dump_json(indent=2)}\n\n"
        f"AgentArchitecture:\n\n{arch.model_dump_json(indent=2)}"
    )
    if feedback:
        user_prompt += (
            f"\n\nYour previous attempt had these problems -- fix them in this attempt:\n{feedback}"
        )
    return structured_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=WorkflowGraph,
    )
