from app.schemas import IntentSpec
from app.synthesis.website_validator import website_issues


def base_intent(**overrides) -> IntentSpec:
    defaults = dict(
        build_type="website",
        summary="A portfolio site for a photographer",
        requirements=["has a contact form", "shows a gallery of photos"],
        reasoning="The request describes a page to look at, not a business process.",
    )
    defaults.update(overrides)
    return IntentSpec(**defaults)


def test_website_issues_empty_for_well_formed_page():
    intent = base_intent()
    html = "<!doctype html><html><body>" + (
        "<h1>Gallery</h1><p>A collection of photographs from recent work.</p>"
        "<form>contact form here, send us a message about a shoot</form>"
    ) * 2 + "</body></html>"
    assert website_issues(intent, html) == []


def test_website_issues_flags_missing_html_structure():
    intent = base_intent(requirements=[])
    issues = website_issues(intent, "<div>not a full document</div>")
    assert any("<html>" in i for i in issues)
    assert any("<body>" in i for i in issues)


def test_website_issues_flags_too_short_output():
    intent = base_intent(requirements=[])
    issues = website_issues(intent, "<html><body>hi</body></html>")
    assert any("too short" in i for i in issues)


def test_website_issues_flags_unaddressed_requirement():
    intent = base_intent(requirements=["shows pricing in three tiers"])
    html = "<!doctype html><html><body>" + "x" * 200 + "</body></html>"
    issues = website_issues(intent, html)
    assert any("pricing" in i for i in issues)


def test_website_issues_matches_requirement_when_keyword_present():
    intent = base_intent(requirements=["shows pricing information"])
    html = "<!doctype html><html><body>" + "x" * 150 + "<p>Our pricing is simple.</p></body></html>"
    issues = website_issues(intent, html)
    assert not any("pricing" in i for i in issues)
