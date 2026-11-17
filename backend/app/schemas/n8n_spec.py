from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class N8nExecutionResult(BaseModel):
    configured: bool  # False if N8N_WEBHOOK_URL isn't set on the backend at all
    ok: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
