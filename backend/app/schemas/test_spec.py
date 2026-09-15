"""
Schemas for the Test Generator and Sandbox Executor (Phase 3/4 scope).

Tests are generated deterministically from the ProcessSpec + AgentArchitecture +
WorkflowGraph -- no LLM call is involved in generating or checking them, which
keeps "does the generated system fulfill the requirement?" fast and reproducible.
"""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel

TestCategory = Literal["structural", "permission", "approval", "success_condition"]


class TestCase(BaseModel):
    id: str
    category: TestCategory
    description: str


class TestOutcome(BaseModel):
    test: TestCase
    passed: bool
    detail: str


class SandboxReport(BaseModel):
    process_name: str
    total: int
    passed: int
    failed: int
    outcomes: List[TestOutcome]
    execution_trace: List[str]
    ready_for_deployment: bool
