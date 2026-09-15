"""Schemas for the Audit Trail."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class AuditEntry(BaseModel):
    stage: str
    timestamp: str
    summary: str
    detail: dict = Field(default_factory=dict)


class AuditTrail(BaseModel):
    process_name: str
    entries: List[AuditEntry] = Field(default_factory=list)
    deployment_approved: bool = False
