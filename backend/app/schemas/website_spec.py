from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class GeneratedWebsite(BaseModel):
    filename: str
    html: str
    repair_log: List[str] = Field(default_factory=list)
