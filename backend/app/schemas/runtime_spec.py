"""
Schemas for the Runtime Executor.

Distinct from SandboxReport (which only checks the *shape* of a design):
this represents an actual run with a sample input record, where each agent
node produces real output values that accumulate into a shared context as
the process proceeds.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StepResult(BaseModel):
    node_id: str
    type: str  # "start" | "agent" | "tool" | "human_approval" | "end"
    label: str
    output: Optional[Dict[str, Any]] = None
    tool_calls: List[str] = Field(default_factory=list)
    note: Optional[str] = None


class RuntimeExecutionResult(BaseModel):
    process_name: str
    input_data: Dict[str, Any]
    steps: List[StepResult]
    final_context: Dict[str, Any]
    halted_at_approval: bool
