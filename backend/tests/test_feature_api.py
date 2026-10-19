from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_permission_suggestion_endpoint_returns_reviewable_recommendations():
    with patch(
        "app.api.synthesize.suggest_permissions",
        return_value={"allowed": ["crm.read"], "forbidden": [], "approval_actions": []},
    ):
        response = client.post(
            "/api/permissions/suggest",
            json={"requirement": "Review incoming CRM leads"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "allowed": ["crm.read"],
        "forbidden": [],
        "approval_actions": [],
    }


def test_csv_endpoint_processes_rows_and_audits_only_count():
    with patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/leads/process-csv",
            json={
                "csv_text": "name,email,company\nAda,ada@company.example,Analytical Engines\n",
                "sales_reps": ["Jordan Lee"],
            },
        )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["records"][0]["assigned_to"] == "Jordan Lee"
    assert response.json()["records"][0]["lead_score"] == 50
    audit_record.assert_called_once()
    assert audit_record.call_args.args[3] == {"record_count": 1}


def test_csv_endpoint_returns_readable_validation_error():
    response = client.post(
        "/api/leads/process-csv",
        json={"csv_text": "name,company\nAda,Analytical Engines\n"},
    )

    assert response.status_code == 400
    assert "name and email" in response.json()["detail"]


def test_single_lead_endpoint_scores_name_contact_and_email():
    with patch("app.api.synthesize.audit.record") as audit_record:
        response = client.post(
            "/api/leads/score",
            json={"name": "Ada Lovelace", "contact": "555-0100", "email": "ada@company.example"},
        )

    assert response.status_code == 200
    assert response.json()["name"] == "Ada Lovelace"
    assert response.json()["contact"] == "555-0100"
    assert response.json()["lead_score"] == 40
    audit_record.assert_called_once()
    assert audit_record.call_args.args[3] == {"record_count": 1}