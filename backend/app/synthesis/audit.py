"""
Audit Trail.

Every pipeline stage appends one AuditEntry as it runs: requirement parsed,
spec validated, agents synthesized (with repair attempts), policy checked,
workflow synthesized (with repair attempts), sandbox run, runtime execution
(if requested), and the final deployment decision. This is what makes
"generate -> test -> sandbox -> repair -> deploy" reviewable after the
fact, per process name, with a timestamp on every step.

Scope: in-memory + append-only JSON-lines file on disk (`audit_log.jsonl`
next to the backend process). A real deployment would put this in a
database with tamper-evident hashing; the append-only file is a
deliberately simple stand-in that already gives a durable, inspectable
record.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from app.schemas import AuditEntry, AuditTrail

_LOCK = threading.Lock()
_LOG_PATH = os.environ.get(
    "CHAINREACT_AUDIT_LOG", os.path.join(os.path.dirname(__file__), "..", "..", "audit_log.jsonl")
)
_TRAILS: dict[str, AuditTrail] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def record(process_name: str, stage: str, summary: str, detail: dict | None = None) -> AuditEntry:
    entry = AuditEntry(stage=stage, timestamp=_now(), summary=summary, detail=detail or {})
    with _LOCK:
        trail = _TRAILS.setdefault(process_name, AuditTrail(process_name=process_name))
        trail.entries.append(entry)
        try:
            with open(_LOG_PATH, "a") as f:
                f.write(json.dumps({"process_name": process_name, **entry.model_dump()}) + "\n")
        except OSError:
            pass  # best-effort disk persistence; in-memory trail is the source of truth for the response
    return entry


def set_deployment_approved(process_name: str, approved: bool) -> None:
    with _LOCK:
        trail = _TRAILS.setdefault(process_name, AuditTrail(process_name=process_name))
        trail.deployment_approved = approved


def get_trail(process_name: str) -> AuditTrail:
    with _LOCK:
        return _TRAILS.get(process_name, AuditTrail(process_name=process_name))
