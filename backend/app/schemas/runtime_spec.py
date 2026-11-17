"""
Schemas for the Runtime Executor.

Distinct from SandboxReport (which only checks the *shape* of a design):
this represents an actual run with a sample input record, where each agent
node produces real output values that accumulate into a shared context as
the process proceeds.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.n8n_spec import N8nExecutionResult

StepStatus = Literal["ok", "failed", "blocked", "simulated", "waiting_approval", "retrying"]
RunStatus = Literal["running", "completed", "failed", "waiting_approval"]


class ToolCallRecord(BaseModel):
    capability: str = Field(..., description="The permission string this call was authorized/checked against, e.g. 'email.send'.")
    real: bool = Field(..., description="True if this genuinely called an external system.")
    status: Literal["ok", "simulated", "blocked", "failed"]
    detail: Optional[str] = None


class StepResult(BaseModel):
    node_id: str
    type: str  # "start" | "agent" | "tool" | "human_approval" | "end"
    label: str
    status: StepStatus = "ok"
    output: Optional[Dict[str, Any]] = None
    tool_calls: List[str] = Field(default_factory=list)
    tool_call_details: List[ToolCallRecord] = Field(default_factory=list)
    attempt: int = 1
    note: Optional[str] = None


class RuntimeExecutionResult(BaseModel):
    process_name: str
    input_data: Dict[str, Any]
    steps: List[StepResult]
    final_context: Dict[str, Any]
    status: RunStatus = "completed"
    halted_at_approval: bool = False
    n8n_notification: Optional[N8nExecutionResult] = Field(
        None, description="Outcome of automatically forwarding this run's computed result to the backend's "
        "configured n8n webhook, if any. None only when that forwarding wasn't attempted at all."
    )
