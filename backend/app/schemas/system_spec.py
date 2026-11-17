from __future__ import annotations

from typing import List

from pydantic import BaseModel

from app.schemas.agent_spec import AgentArchitecture
from app.schemas.process_spec import ProcessSpec
from app.schemas.workflow_spec import WorkflowGraph


class StoredSystem(BaseModel):
    system_id: str
    process_name: str
    created_at: str
    process_spec: ProcessSpec
    agent_architecture: AgentArchitecture
    workflow: WorkflowGraph


class StoredSystemSummary(BaseModel):
    system_id: str
    process_name: str
    created_at: str
    objective: str = ""
    agent_count: int = 0
    node_count: int = 0
    has_approval_gate: bool = False


class StoredSystemList(BaseModel):
    systems: List[StoredSystemSummary]
