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

Rehydration on startup: the free hosting tier this runs on spins the
process down on inactivity and restarts it on the next request, which
wipes the in-memory `_TRAILS` dict but NOT the JSONL file sitting on the
same disk. Without replaying that file back into memory on import, every
cold start would silently make `GET /api/audit/{name}` return an empty
trail for processes that were actually generated minutes earlier -- a
believable, silent bug rather than a loud one, which is worse. `_rehydrate()`
below replays the file once at import time so the audit trail survives
restarts as long as the underlying disk does.
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

# A deployment-approval change is recorded as a JSONL line with this
# sentinel stage name so rehydration can tell it apart from a normal,
# user-visible AuditEntry and apply it to trail.deployment_approved instead
# of appending it to trail.entries.
_DEPLOYMENT_MARKER_STAGE = "__deployment_approved__"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_line(process_name: str, stage: str, payload: dict) -> None:
    try:
        with open(_LOG_PATH, "a") as f:
            f.write(json.dumps({"process_name": process_name, "stage": stage, **payload}) + "\n")
    except OSError:
        pass  # best-effort disk persistence; in-memory trail is still the source of truth for this process's lifetime


def _rehydrate() -> None:
    """Replay audit_log.jsonl into _TRAILS once at import time. Malformed
    or partially-written lines (e.g. from a process killed mid-write) are
    skipped rather than aborting the whole replay -- a corrupt line
    shouldn't cost every other process its history."""
    if not os.path.exists(_LOG_PATH):
        return
    try:
        with open(_LOG_PATH) as f:
            lines = f.readlines()
    except OSError:
        return

    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            process_name = row["process_name"]
            stage = row["stage"]
        except (json.JSONDecodeError, KeyError):
            continue

        trail = _TRAILS.setdefault(process_name, AuditTrail(process_name=process_name))
        if stage == _DEPLOYMENT_MARKER_STAGE:
            trail.deployment_approved = bool(row.get("approved", False))
            continue
        try:
            entry = AuditEntry(
                stage=stage,
                timestamp=row.get("timestamp", ""),
                summary=row.get("summary", ""),
                detail=row.get("detail", {}),
            )
        except Exception:
            continue
        trail.entries.append(entry)


_rehydrate()


def record(process_name: str, stage: str, summary: str, detail: dict | None = None) -> AuditEntry:
    entry = AuditEntry(stage=stage, timestamp=_now(), summary=summary, detail=detail or {})
    with _LOCK:
        trail = _TRAILS.setdefault(process_name, AuditTrail(process_name=process_name))
        trail.entries.append(entry)
        _append_line(process_name, stage, entry.model_dump())
    return entry


def set_deployment_approved(process_name: str, approved: bool) -> None:
    with _LOCK:
        trail = _TRAILS.setdefault(process_name, AuditTrail(process_name=process_name))
        trail.deployment_approved = approved
        _append_line(process_name, _DEPLOYMENT_MARKER_STAGE, {"approved": approved})


def get_trail(process_name: str) -> AuditTrail:
    with _LOCK:
        return _TRAILS.get(process_name, AuditTrail(process_name=process_name))
