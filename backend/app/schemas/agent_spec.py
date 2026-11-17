"""
Agent Contract: the output of the Agent Architect stage. Each agent
in a ChainReact system is described declaratively -- purpose, I/O,
tools it may call, permissions it holds, and memory needs -- rather
than as free-form code. This contract is what the Policy Engine and
Test Generator consume downstream.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ToolConfig(BaseModel):
    """Fixed-shape, not a free-form dict -- Gemini's structured-output mode
    rejects a JSON schema with `additionalProperties` (an arbitrary string
    dict), so every field a tool might need has to be declared explicitly
    here, left null when it doesn't apply."""
    url: Optional[str] = Field(None, description="For an 'http' tool: the real endpoint to call.")
    method: Optional[str] = Field(None, description="For an 'http' tool: 'GET' or 'POST' (default GET).")
    channel: Optional[str] = Field(None, description="For a 'slack' tool: the channel to post to, e.g. '#sales'.")


class ToolBinding(BaseModel):
    name: str = Field(..., description="Logical tool name, e.g. 'crm', 'email'")
    operations: List[str] = Field(..., description="Operations this agent may invoke, e.g. 'read_lead'")
    config: ToolConfig = Field(
        default_factory=ToolConfig,
        description="Only relevant for 'http' (set url/method) or 'slack' (set channel) tools. Leave every "
        "field null for every other tool.",
    )


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
