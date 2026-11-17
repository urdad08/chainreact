"""Generate editable, least-privilege permission recommendations."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field

from app.core.llm_client import structured_completion


PERMISSION_CATALOG = {
    "crm.read",
    "crm.write",
    "crm.delete",
    "email.send",
    "email.read",
    "database.read",
    "database.write",
    "payments.charge",
    "payments.refund",
    "slack.post",
    "slack.read",
    "calendar.read",
    "calendar.write",
    "notification.send",
    "http.request",
}


class PermissionSuggestions(BaseModel):
    allowed: List[str] = Field(default_factory=list)
    forbidden: List[str] = Field(default_factory=list)
    approval_actions: List[str] = Field(default_factory=list)


class _PermissionProposal(BaseModel):
    allowed: List[str] = Field(default_factory=list)
    forbidden: List[str] = Field(default_factory=list)
    approval_actions: List[str] = Field(default_factory=list)


def suggest_permissions(requirement: str) -> PermissionSuggestions:
    """Suggest catalogued scopes; callers must let the user review them."""
    proposal = structured_completion(
        system_prompt=(
            "Recommend the minimum permissions needed for the described business process. "
            "Use only this exact catalog: " + ", ".join(sorted(PERMISSION_CATALOG)) + ". "
            "Do not grant permissions just because a tool might be useful. Include crm.delete, "
            "payments.charge, or payments.refund only when the requirement explicitly asks for "
            "that action. Put external side effects such as email.send, payments.charge, and "
            "payments.refund in approval_actions when they are needed. Return forbidden scopes "
            "only when the requirement explicitly prohibits them. These are recommendations, "
            "not authorization."
        ),
        user_prompt=f"Business process requirement:\n\n{requirement}",
        response_model=_PermissionProposal,
    )

    allowed = list(dict.fromkeys(p for p in proposal.allowed if p in PERMISSION_CATALOG))
    forbidden = list(
        dict.fromkeys(p for p in proposal.forbidden if p in PERMISSION_CATALOG and p not in allowed)
    )
    approval_actions = list(
        dict.fromkeys(p for p in proposal.approval_actions if p in allowed)
    )
    return PermissionSuggestions(
        allowed=allowed,
        forbidden=forbidden,
        approval_actions=approval_actions,
    )