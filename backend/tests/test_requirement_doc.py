from app.schemas import IntentSpec
from app.synthesis.requirement_doc import generate_requirement_md


def test_generate_requirement_md_renders_all_sections():
    intent = IntentSpec(
        build_type="website",
        suggested_name="Photography Portfolio Site",
        summary="A portfolio site for a photographer",
        requirements=["has a contact form", "shows a gallery"],
        assumptions=["No color palette was given, so a neutral palette is assumed"],
        success_criteria=["Submitting the contact form shows a confirmation message"],
        out_of_scope=["Payment processing is not included"],
        reasoning="Describes a page to view, not a business process.",
    )
    md = generate_requirement_md("Build me a photography portfolio site", intent)

    assert "# Photography Portfolio Site" in md
    assert "Website" in md
    assert intent.reasoning in md
    assert intent.summary in md
    assert "- has a contact form" in md
    assert "- shows a gallery" in md
    assert "- No color palette was given, so a neutral palette is assumed" in md
    assert "- Submitting the contact form shows a confirmation message" in md
    assert "- Payment processing is not included" in md
    assert "> Build me a photography portfolio site" in md


def test_generate_requirement_md_handles_empty_optional_fields():
    intent = IntentSpec(
        build_type="workflow",
        summary="Qualify and route incoming leads",
        requirements=[],
        reasoning="Describes a trigger-driven business process.",
    )
    md = generate_requirement_md("Score leads when they come in", intent)

    assert "# Build Request" in md  # falls back when suggested_name is blank
    assert "Workflow" in md
    assert "(none extracted)" in md
    assert "No assumptions were necessary" in md
    assert "Nothing was explicitly excluded" in md
