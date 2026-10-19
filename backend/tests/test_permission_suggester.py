from types import SimpleNamespace
from unittest.mock import patch

from app.synthesis.permission_suggester import suggest_permissions


def test_permission_suggestions_are_catalogued_and_conflicts_are_removed():
    proposal = SimpleNamespace(
        allowed=["crm.read", "crm.write", "unlisted.permission"],
        forbidden=["crm.read", "crm.delete", "unlisted.permission"],
        approval_actions=["crm.write", "crm.delete", "outside.catalog"],
    )

    with patch("app.synthesis.permission_suggester.structured_completion", return_value=proposal):
        suggestions = suggest_permissions("Read and update CRM leads")

    assert suggestions.allowed == ["crm.read", "crm.write"]
    assert suggestions.forbidden == ["crm.delete"]
    assert suggestions.approval_actions == ["crm.write"]