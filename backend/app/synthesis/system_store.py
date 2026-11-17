"""
System Store.

Persists a generated system (ProcessSpec + AgentArchitecture +
WorkflowGraph) under a short system_id, so it can be fetched or
re-executed later via the API instead of only ever existing for the
lifetime of the one request/response that created it.

Same deliberately-simple philosophy as synthesis/audit.py: a single
JSON file (CHAINREACT_SYSTEM_STORE, default systems_store.json next to
the backend process) rather than a real database -- there's no DB
configured for this project, and a demo app's handful of generated
systems doesn't need one. A real deployment would swap this for a
proper store without changing the module's public functions.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.schemas import AgentArchitecture, ProcessSpec, StoredSystem, StoredSystemSummary, WorkflowGraph

_LOCK = threading.Lock()
_STORE_PATH = os.environ.get(
    "CHAINREACT_SYSTEM_STORE", os.path.join(os.path.dirname(__file__), "..", "..", "systems_store.json")
)
_SYSTEMS: Dict[str, StoredSystem] = {}


def _load() -> None:
    if not os.path.exists(_STORE_PATH):
        return
    try:
        with open(_STORE_PATH) as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return
    for system_id, data in raw.items():
        try:
            _SYSTEMS[system_id] = StoredSystem(**data)
        except Exception:
            continue  # a corrupt entry shouldn't cost every other stored system


_load()


def _persist() -> None:
    try:
        with open(_STORE_PATH, "w") as f:
            json.dump({sid: s.model_dump() for sid, s in _SYSTEMS.items()}, f, default=str)
    except OSError:
        pass  # best-effort disk persistence; in-memory store is still authoritative this run


def save_system(process_spec: ProcessSpec, agent_architecture: AgentArchitecture, workflow: WorkflowGraph) -> StoredSystem:
    system_id = uuid.uuid4().hex[:12]
    stored = StoredSystem(
        system_id=system_id,
        process_name=process_spec.name,
        created_at=datetime.now(timezone.utc).isoformat(),
        process_spec=process_spec,
        agent_architecture=agent_architecture,
        workflow=workflow,
    )
    with _LOCK:
        _SYSTEMS[system_id] = stored
        _persist()
    return stored


def get_system(system_id: str) -> Optional[StoredSystem]:
    with _LOCK:
        return _SYSTEMS.get(system_id)


def list_systems() -> List[StoredSystemSummary]:
    with _LOCK:
        ordered = sorted(_SYSTEMS.values(), key=lambda s: s.created_at, reverse=True)
        return [
            StoredSystemSummary(
                system_id=s.system_id,
                process_name=s.process_name,
                created_at=s.created_at,
                objective=s.process_spec.objective,
                agent_count=len(s.agent_architecture.agents),
                node_count=len(s.workflow.nodes),
                has_approval_gate=any(n.type == "human_approval" for n in s.workflow.nodes),
            )
            for s in ordered
        ]
