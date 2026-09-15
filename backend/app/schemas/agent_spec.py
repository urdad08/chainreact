"""
Agent Contract: the output of the Agent Architect stage. Each agent
in a ChainReact system is described declaratively -- purpose, I/O,
tools it may call, permissions it holds, and memory needs -- rather
than as free-form code. This contract is what the Policy Engine and
Test Generator consume downstream.
"""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class ToolBinding(BaseModel):
    name: str = Field(..., description="Logical tool name, e.g. 'crm', 'email'")
    operations: List[str] = Field(..., description="Operations this agent may invoke, e.g. 'read_lead'")


class Memory(BaseModel):
    type: Literal["none", "short_term", "long_term"] = "none"


class AgentDef(BaseModel):
    id: str = Field(..., description="Unique snake_case identifier, e.g. 'qualification_agent'")
    purpose: str
    inputs: List[str] = Field(default_factory=list)
    outputs: List[str] = Field(default_factory=list)
    tools: List[ToolBinding] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list, description="dot.notation permissions, e.g. 'crm.read'")
    memory: Memory = Field(default_factory=Memory)


class AgentArchitecture(BaseModel):
    process_name: str
    agents: List[AgentDef]
