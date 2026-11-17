from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class GoogleConnectionStatus(BaseModel):
    connected: bool


class GmailLabelResult(BaseModel):
    sender: str
    label_name: str
    label_id: str
    matched: int
    labeled: int
    message_ids: List[str] = Field(default_factory=list)


class CalendarEvent(BaseModel):
    id: Optional[str] = None
    summary: str
    start: Optional[str] = None
    end: Optional[str] = None
    html_link: Optional[str] = None
