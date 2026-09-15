"""
ProcessSpec: the structured, validated representation of a business
requirement. This is the heart of ChainReact -- every later stage
(agent synthesis, workflow compilation, policy checks, test generation)
consumes a ProcessSpec, never raw natural language.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class RetryStrategy(str, Enum):
    fixed = "fixed"
    exponential_backoff = "exponential_backoff"
    none = "none"


class Trigger(BaseModel):
    type: str = Field(..., description="e.g. webhook, schedule, manual, event")
    event: str = Field(..., description="Name of the event/condition that starts the process")


class Permissions(BaseModel):
    allowed: List[str] = Field(default_factory=list)
    forbidden: List[str] = Field(default_factory=list)

    @field_validator("forbidden")
    @classmethod
    def no_overlap(cls, forbidden: List[str], info) -> List[str]:
        allowed = info.data.get("allowed", []) or []
        overlap = set(allowed) & set(forbidden)
        if overlap:
            raise ValueError(f"Actions cannot be both allowed and forbidden: {overlap}")
        return forbidden


class ApprovalGate(BaseModel):
    action: str = Field(..., description="The action that requires human sign-off")
    required: bool = True
    reason: Optional[str] = None


class FailurePolicy(BaseModel):
    max_retries: int = Field(3, ge=0, le=10)
    retry_strategy: RetryStrategy = RetryStrategy.exponential_backoff
    fallback: str = Field("human_review", description="What happens after retries are exhausted")


class Constraints(BaseModel):
    max_cost_per_execution: float = Field(..., ge=0)
    max_latency_seconds: int = Field(..., ge=1)
    privacy: str = Field(..., description="Data-handling / PII constraint statement")


class ProcessSpec(BaseModel):
    """The full formal specification of a business process, derived from
    a free-text requirement and validated before any agent synthesis happens."""

    name: str
    objective: str
    users: List[str] = Field(default_factory=list, description="Intended human users/roles")

    input_data: List[str] = Field(default_factory=list)
    output_data: List[str] = Field(default_factory=list)

    trigger: Trigger
    rules: List[str] = Field(default_factory=list, description="Ordered process rules / steps")

    permissions: Permissions
    human_approval: List[ApprovalGate] = Field(default_factory=list)
    failure_policy: FailurePolicy
    success_conditions: List[str] = Field(default_factory=list)
    limits: Constraints

    class Config:
        use_enum_values = True


class ValidationIssue(BaseModel):
    severity: str  # "error" | "warning"
    field: str
    message: str


class ValidationResult(BaseModel):
    valid: bool
    issues: List[ValidationIssue] = Field(default_factory=list)
