"""
n8n Webhook Integration.

ChainReact does not manage workflows inside n8n via n8n's own management
API (no n8n API key is used anywhere in this module). Instead, it POSTs
JSON to a single, pre-configured n8n webhook URL -- exactly what an n8n
"Webhook" trigger node expects to receive -- at two distinct moments:

1. `notify_n8n`: once a process has been synthesized, sends a summary of
   its shape (workflow id/name, synthesized agents, workflow graph).
   Manually triggered from the frontend's "Send to n8n" button.
2. `notify_n8n_runtime_result` / `notify_n8n_lead_result`: once a task has
   actually been RUN against real data the person provided (a sample
   runtime execution, a single lead score, or a batch of leads from a
   CSV) and ChainReact has computed a real result, sends that computed
   result. This is what lets n8n do something concrete with it -- e.g.
   write it into a real CRM node the person has wired up on n8n's side --
   rather than only ever receiving an abstract workflow shape. Triggered
   automatically by api/synthesize.py whenever one of those "run it for
   real" actions completes, not gated behind the manual button.

Every payload carries an "event" field so a single n8n webhook can branch
on what kind of ChainReact activity it's seeing (a Switch node on
`{{$json.event}}`, for example).

The webhook URL is read from the N8N_WEBHOOK_URL environment variable on
the backend ONLY, at call time (not cached at import), and it is never
part of any response sent to the frontend -- the integration can't be
triggered or discovered from client-side code, only from this server
process deciding to call out.

Two companion endpoints (wired in api/synthesize.py) exist for an n8n
workflow to call BACK into ChainReact, for anyone who wires an HTTP
Request / Wait node to use them:
- POST /api/n8n/agent-step runs one synthesized agent's simulated output
  for a given context (the same LLM-roleplay logic runtime/executor.py
  already uses per node), so an n8n workflow can execute a real
  ChainReact agent step instead of only receiving a static snapshot.
- POST /api/n8n/approval/resume lets an n8n workflow (e.g. after its own
  Wait node resumes following a human decision) tell ChainReact's audit
  trail that a human-approval gate was resolved, keeping both systems'
  records in sync even though n8n's own pause/resume mechanics live
  entirely on n8n's side.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

from app.runtime.executor import _simulate_agent_output as simulate_agent_step  # re-exported for /api/n8n/agent-step
from app.schemas import AgentArchitecture, N8nExecutionResult, RuntimeExecutionResult, WorkflowGraph

__all__ = [
    "build_payload",
    "notify_n8n",
    "notify_n8n_runtime_result",
    "notify_n8n_lead_result",
    "simulate_agent_step",
]

_TIMEOUT_SECONDS = 10.0
_MAX_RESPONSE_BODY_CHARS = 2000


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-") or "process"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _post_webhook(payload: Dict[str, Any]) -> N8nExecutionResult:
    webhook_url = os.environ.get("N8N_WEBHOOK_URL", "").strip()
    if not webhook_url:
        return N8nExecutionResult(
            configured=False, ok=False,
            error="N8N_WEBHOOK_URL is not set on the backend -- nothing was sent.",
        )

    try:
        response = httpx.post(webhook_url, json=payload, timeout=_TIMEOUT_SECONDS)
        ok = response.is_success
        return N8nExecutionResult(
            configured=True,
            ok=ok,
            status_code=response.status_code,
            response_body=response.text[:_MAX_RESPONSE_BODY_CHARS],
            error=None if ok else f"n8n responded with status {response.status_code}.",
        )
    except httpx.HTTPError as e:
        return N8nExecutionResult(configured=True, ok=False, error=f"Could not reach the n8n webhook: {e}")


def build_payload(process_name: str, architecture: AgentArchitecture, workflow: WorkflowGraph) -> Dict[str, Any]:
    return {
        "event": "workflow_synthesized",
        "workflow_id": _slug(process_name),
        "workflow_name": process_name,
        "sent_at": _now_iso(),
        "agents": [a.model_dump() for a in architecture.agents],
        "workflow_graph": workflow.model_dump(),
    }


def notify_n8n(process_name: str, architecture: AgentArchitecture, workflow: WorkflowGraph) -> N8nExecutionResult:
    """Manual action (the frontend's "Send to n8n" button): push the shape
    of a synthesized process, before it's necessarily been run with any
    real data."""
    return _post_webhook(build_payload(process_name, architecture, workflow))


def notify_n8n_runtime_result(
    process_name: str, input_data: Dict[str, Any], result: RuntimeExecutionResult
) -> N8nExecutionResult:
    """Automatic: a person ran the synthesized workflow against a real
    sample record (RuntimeRunner's "Run process"), and ChainReact computed
    a real result (final_context) for it -- forward that computed result
    to n8n so n8n can act on it (e.g. write it into a real CRM node),
    instead of n8n only ever seeing the workflow's abstract shape."""
    payload = {
        "event": "runtime_result",
        "workflow_id": _slug(process_name),
        "workflow_name": process_name,
        "sent_at": _now_iso(),
        "input_data": input_data,
        "final_context": result.final_context,
        "halted_at_approval": result.halted_at_approval,
        "steps": [s.model_dump() for s in result.steps],
    }
    return _post_webhook(payload)


def notify_n8n_lead_result(event: str, records: List[Dict[str, Any]]) -> N8nExecutionResult:
    """Automatic: a person scored a real lead or processed a real lead CSV
    through ChainReact's CRM lead-management demo (lead_csv.py) -- forward
    the computed scores/assignments to n8n, one webhook call per action
    (not per row), so a bulk CSV upload doesn't spam the webhook."""
    payload = {"event": event, "sent_at": _now_iso(), "records": records}
    return _post_webhook(payload)
