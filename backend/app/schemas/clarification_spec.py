from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ClarificationCheck(BaseModel):
    needs_clarification: bool = Field(
        ..., description="True only if a SPECIFIC piece of information is missing that would be unsafe or "
        "meaningless to assume (e.g. which of several plausible systems to use, a threshold with no sane "
        "default, who must approve something). False for anything workable with a reasonable, clearly-stated "
        "assumption."
    )
    question: Optional[str] = Field(
        None, description="A single, specific, answerable question -- only set when needs_clarification is true."
    )
