"""
Live Execution API.

The real counterpart to /api/runtime/execute (which stays simulated for
backward compatibility -- see runtime/executor.py's docstring). This is
where allow_real_tools=True actually happens: a background thread drives
runtime/executor.iter_workflow, writing each StepResult into
runtime/execution_store.py as it completes, and the frontend watches it
happen live over Server-Sent Events instead of waiting for one big
blocking response.

Endpoints:
- POST /start          -- begin running a stored system against real input data
- GET  ""              -- list runs (newest first) for the execution-history view
- GET  /{run_id}/stream -- SSE stream of step-by-step progress (+ which nodes are running now)
- GET  /{run_id}        -- snapshot (status + steps so far), for reconnects
- POST /{run_id}/approve -- resume a run paused at a human-approval gate
"""
from __future__ import annotations

import asyncio
import json
import threading
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.runtime import execution_store
from app.runtime.executor import iter_workflow, resume_workflow
from app.schemas import RuntimeExecutionResult
from app.synthesis import audit, system_store
from app.synthesis.n8n_integration import notify_n8n_runtime_result

router = APIRouter(prefix="/api/execution", tags=["execution"])

_POLL_INTERVAL_SECONDS = 0.3


class StartExecutionIn(BaseModel):
    system_id: str = Field(..., min_length=1)
    input_data: Dict[str, Any] = Field(default_factory=dict)
    auto_approve: bool = Field(False, description="If true, human-approval gates never pause -- for a quick full run.")
    allow_real_tools: bool = Field(True, description="This endpoint's whole purpose -- real actions actually happen unless explicitly turned off.")


class StartExecutionOut(BaseModel):
    run_id: str


class ApproveIn(BaseModel):
    approved: bool


def _finish_run(run_id: str, spec, input_data: Dict[str, Any], status: str, checkpoint, context: Dict[str, Any], steps) -> None:
    execution_store.set_status(run_id, status, checkpoint=checkpoint, final_context=context)
    audit.record(
        spec.name, f"execution_{status}",
        f"Live execution run {run_id} {status}.",
        {"run_id": run_id, "step_count": len(steps)},
    )
    if status == "completed":
        result = RuntimeExecutionResult(
            process_name=spec.name, input_data=input_data, steps=steps,
            final_context=context, status=status, halted_at_approval=False,
        )
        n8n_result = notify_n8n_runtime_result(spec.name, input_data, result)
        audit.record(
            spec.name, "n8n_notified",
            f"n8n webhook notify (live execution result): {'sent' if n8n_result.ok else ('not configured' if not n8n_result.configured else 'failed')}.",
            {"configured": n8n_result.configured, "ok": n8n_result.ok, "run_id": run_id},
        )


def _run_fresh_in_background(run_id: str, spec, arch, workflow, input_data: Dict[str, Any], auto_approve: bool, allow_real_tools: bool) -> None:
    status_box: Dict[str, Any] = {}
    try:
        steps = []
        for step in iter_workflow(
            spec, arch, workflow, input_data, auto_approve=auto_approve, allow_real_tools=allow_real_tools,
            status_box=status_box, on_wave_start=lambda ids: execution_store.set_running_nodes(run_id, ids),
        ):
            execution_store.append_step(run_id, step)
            steps.append(step)
        status = status_box.get("status", "completed")
        _finish_run(run_id, spec, input_data, status, status_box.get("checkpoint"), status_box.get("context", {}), steps)
    except Exception as e:  # noqa: BLE001 -- a background thread's exception must not vanish silently
        execution_store.set_error(run_id, str(e))


def _resume_in_background(run_id: str, spec, arch, workflow, input_data: Dict[str, Any], checkpoint: Dict[str, Any], approved: bool, allow_real_tools: bool) -> None:
    status_box: Dict[str, Any] = {}
    try:
        steps = []
        for step in resume_workflow(
            spec, arch, workflow, checkpoint, approved, allow_real_tools=allow_real_tools,
            status_box=status_box, on_wave_start=lambda ids: execution_store.set_running_nodes(run_id, ids),
        ):
            execution_store.append_step(run_id, step)
            steps.append(step)
        status = status_box.get("status", "failed" if not approved else "completed")
        existing = execution_store.get_run(run_id)
        all_steps = (existing["steps"] if existing else [])
        _finish_run(run_id, spec, input_data, status, status_box.get("checkpoint"), status_box.get("context", {}), all_steps)
    except Exception as e:  # noqa: BLE001
        execution_store.set_error(run_id, str(e))


@router.post("/start", response_model=StartExecutionOut)
def api_start_execution(body: StartExecutionIn) -> StartExecutionOut:
    stored = system_store.get_system(body.system_id)
    if stored is None:
        raise HTTPException(404, f"No stored system with id '{body.system_id}'.")

    run_id = execution_store.create_run(body.system_id, stored.process_name, body.input_data)
    audit.record(stored.process_name, "execution_started", f"Live execution run {run_id} started.", {"run_id": run_id, "input_data": body.input_data})

    thread = threading.Thread(
        target=_run_fresh_in_background,
        args=(run_id, stored.process_spec, stored.agent_architecture, stored.workflow, body.input_data, body.auto_approve, body.allow_real_tools),
        daemon=True,
    )
    thread.start()
    return StartExecutionOut(run_id=run_id)


def _serialize_run(run: Dict[str, Any], *, include_steps: bool) -> Dict[str, Any]:
    stored = system_store.get_system(run["system_id"])
    data: Dict[str, Any] = {
        "run_id": run["run_id"],
        "system_id": run["system_id"],
        "process_name": run["process_name"],
        "status": run["status"],
        "created_at": run["created_at"],
        "completed_at": run["completed_at"],
        "step_count": len(run["steps"]),
        "agent_count": len(stored.agent_architecture.agents) if stored else None,
        "error": run["error"],
        "awaiting_approval": run["status"] == "waiting_approval",
        "running_nodes": run["running_nodes"],
    }
    if include_steps:
        data["steps"] = [s.model_dump() for s in run["steps"]]
        data["step_times"] = run["step_times"]
        data["final_context"] = run["final_context"]
        data["input_data"] = run["input_data"]
    return data


@router.get("")
def api_list_executions() -> Dict[str, Any]:
    return {"runs": [_serialize_run(r, include_steps=False) for r in execution_store.list_runs()]}


@router.get("/{run_id}")
def api_get_execution(run_id: str) -> Dict[str, Any]:
    run = execution_store.get_run(run_id)
    if run is None:
        raise HTTPException(404, f"No execution run with id '{run_id}'.")
    return _serialize_run(run, include_steps=True)


@router.get("/{run_id}/stream")
async def api_stream_execution(run_id: str) -> StreamingResponse:
    if execution_store.get_run(run_id) is None:
        raise HTTPException(404, f"No execution run with id '{run_id}'.")

    async def event_source():
        sent = 0
        last_running: list = []
        while True:
            run = execution_store.get_run(run_id)
            if run is None:
                break
            for i in range(sent, len(run["steps"])):
                payload = {"type": "step", "step": run["steps"][i].model_dump(), "at": run["step_times"][i]}
                yield "data: " + json.dumps(payload) + "\n\n"
            sent = len(run["steps"])

            if run["running_nodes"] != last_running:
                last_running = run["running_nodes"]
                yield "data: " + json.dumps({"type": "running", "node_ids": last_running}) + "\n\n"

            if run["status"] != "running":
                done = {
                    "type": "done", "status": run["status"], "final_context": run["final_context"],
                    "error": run["error"], "completed_at": run["completed_at"],
                }
                yield "data: " + json.dumps(done) + "\n\n"
                break
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)

    return StreamingResponse(event_source(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/{run_id}/approve")
def api_approve_execution(run_id: str, body: ApproveIn) -> Dict[str, Any]:
    run = execution_store.get_run(run_id)
    if run is None:
        raise HTTPException(404, f"No execution run with id '{run_id}'.")
    if run["status"] != "waiting_approval" or not run["checkpoint"]:
        raise HTTPException(409, f"Run '{run_id}' is not waiting for approval (status: {run['status']}).")

    stored = system_store.get_system(run["system_id"])
    if stored is None:
        raise HTTPException(404, f"The stored system for this run no longer exists.")

    execution_store.set_status(run_id, "running")
    audit.record(stored.process_name, "approval_decided", f"Run {run_id} {'approved' if body.approved else 'rejected'}.", {"run_id": run_id, "approved": body.approved})

    thread = threading.Thread(
        target=_resume_in_background,
        args=(run_id, stored.process_spec, stored.agent_architecture, stored.workflow, run["input_data"], run["checkpoint"], body.approved, True),
        daemon=True,
    )
    thread.start()
    return {"status": "resumed"}
