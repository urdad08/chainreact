import pytest

from app.synthesis.lead_csv import process_lead_csv


def test_csv_processing_qualifies_user_rows_and_assigns_reps_round_robin():
    csv_text = (
        "name,email,company,title,source\n"
        "Ada Lovelace,ada@analytical.example,Analytical Engines,CEO,referral\n"
        "Sam Reader,sam@gmail.com,,Student,website\n"
    )

    result = process_lead_csv(csv_text, ["Jordan Lee", "Casey Kim"])

    assert result["total"] == 2
    assert result["records"][0]["name"] == "Ada Lovelace"
    assert result["records"][0]["lead_score"] == 100
    assert result["records"][0]["priority"] == "high"
    assert result["records"][0]["assigned_to"] == "Jordan Lee"
    assert result["records"][1]["assigned_to"] == "Casey Kim"
    assert result["records"][1]["priority"] == "low"


def test_invalid_lead_is_preserved_and_marked_for_review():
    result = process_lead_csv("name,email\nMissing Email,not-an-email\n", [])

    assert result["records"][0]["priority"] == "review"
    assert result["records"][0]["validation_errors"] == "invalid or missing email"


@pytest.mark.parametrize(
    ("csv_text", "message"),
    [
        ("", "empty"),
        ("name,company\nAda,Analytical Engines\n", "name and email"),
        ("name,email\n", "no lead rows"),
        ("name,email\nAda,a@example.com,unexpected\n", "more values"),
    ],
)
def test_invalid_csv_is_rejected(csv_text, message):
    with pytest.raises(ValueError, match=message):
        process_lead_csv(csv_text, [])