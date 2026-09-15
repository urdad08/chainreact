"""
Workflow Graph: the machine-readable execution graph produced by the
Workflow Synthesizer. Nodes are agents, tool calls, or human-approval
gates; edges connect them and may carry a condition (for branching,
e.g. score >= 50).
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class WorkflowNode(BaseModel):
    id: str
    type: Literal["agent", "tool", "human_approval", "start", "end"]
    agent: Optional[str] = Field(None, description="Set when type == 'agent'; must match an AgentDef.id")
    tool: Optional[str] = Field(None, description="Set when type == 'tool', e.g. 'email.send'")
    label: Optional[str] = None


class WorkflowEdge(BaseModel):
    source: str
    target: str
    condition: Optional[str] = Field(None, description="Branch condition, e.g. 'score >= 50'")


class WorkflowGraph(BaseModel):
    process_name: str
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]

    @field_validator("edges")
    @classmethod
    def edges_reference_known_nodes(cls, edges: List[WorkflowEdge], info) -> List[WorkflowEdge]:
        nodes = info.data.get("nodes", []) or []
        node_ids = {n.id for n in nodes}
        for e in edges:
            if e.source not in node_ids:
                raise ValueError(f"Edge source '{e.source}' does not match any node id")
            if e.target not in node_ids:
                raise ValueError(f"Edge target '{e.target}' does not match any node id")
        return edges
