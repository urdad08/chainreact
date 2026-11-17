"""
Tool Registry schemas.

A "tool" in ChainReact is a capability an agent can invoke at runtime --
distinct from AgentDef.tools (ToolBinding), which only declares INTENT
("this agent may use the 'email' tool for 'send'"). ToolSpec is the
registry-side counterpart: the actual callable, what permission it
requires, and whether it is REAL (genuinely calls an external system) or
SIMULATED (no real external system is touched, honestly labeled as such
rather than faking a generic "ok").
"""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field

ToolCallStatus = Literal["ok", "simulated", "blocked", "failed"]


class ToolCallResult(BaseModel):
    status: ToolCallStatus
    real: bool = Field(..., description="True if an actual external system was called; False if simulated.")
    output: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
