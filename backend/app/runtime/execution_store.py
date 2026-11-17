"""
Execution Store.

Tracks live (and recently-finished) workflow runs in memory, so the SSE
endpoint (api/execution.py) can poll "what's new since step N" while a
background thread actually drives the run via runtime/executor.py's
generator. In-memory only (not file-persisted like audit.py/system_store.py)
-- a run's live status is inherently a point-in-time thing; the permanent
record of what happened is the audit trail, which every stage still
writes to. A backend restart therefore empties the execution history list.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.schemas import RunStatus, StepResult

_LOCK = threading.Lock()
_RUNS: Dict[str, Dict[str, Any]] = {}

_TERMINAL = {"completed", "failed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_run(system_id: str, process_name: str, input_data: Dict[str, Any]) -> str:
    run_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _RUNS[run_id] = {
            "run_id": run_id,
            "system_id": system_id,
            "process_name": process_name,
            "input_data": input_data,
            "status": "running",
            "steps": [],
            "step_times": [],
            "running_nodes": [],
            "checkpoint": None,
            "final_context": {},
            "created_at": _now(),
            "completed_at": None,
            "error": None,
        }
    return run_id


def append_step(run_id: str, step: StepResult) -> None:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is not None:
            run["steps"].append(step)
            run["step_times"].append(_now())
            run["running_nodes"] = [n for n in run["running_nodes"] if n != step.node_id]


def set_running_nodes(run_id: str, node_ids: List[str]) -> None:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is not None:
            run["running_nodes"] = list(node_ids)


def set_status(run_id: str, status: RunStatus, *, checkpoint: Optional[Dict[str, Any]] = None, final_context: Optional[Dict[str, Any]] = None) -> None:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is None:
            return
        run["status"] = status
        if status != "running":
            run["running_nodes"] = []
        if status in _TERMINAL:
            run["completed_at"] = _now()
        if checkpoint is not None:
            run["checkpoint"] = checkpoint
        if final_context is not None:
            run["final_context"] = final_context


def set_error(run_id: str, message: str) -> None:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is not None:
            run["status"] = "failed"
            run["error"] = message
            run["running_nodes"] = []
            run["completed_at"] = _now()


def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is None:
            return None
        return {**run, "steps": list(run["steps"]), "step_times": list(run["step_times"]), "running_nodes": list(run["running_nodes"])}


def get_steps_since(run_id: str, index: int) -> List[StepResult]:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is None:
            return []
        return list(run["steps"][index:])


def list_runs() -> List[Dict[str, Any]]:
    with _LOCK:
        runs = [
            {**r, "steps": list(r["steps"]), "step_times": list(r["step_times"]), "running_nodes": list(r["running_nodes"])}
            for r in _RUNS.values()
        ]
    return sorted(runs, key=lambda r: r["created_at"], reverse=True)
