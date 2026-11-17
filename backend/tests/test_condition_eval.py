from app.runtime.condition_eval import evaluate_condition


def test_numeric_comparison_true():
    assert evaluate_condition("lead_score >= 50", {"lead_score": "72"}) is True


def test_numeric_comparison_false():
    assert evaluate_condition("lead_score >= 50", {"lead_score": "40"}) is False


def test_string_equality():
    assert evaluate_condition("priority == 'high'", {"priority": "high"}) is True
    assert evaluate_condition("priority == 'high'", {"priority": "low"}) is False


def test_boolean_and_or():
    ctx = {"lead_score": "80", "priority": "high"}
    assert evaluate_condition("lead_score >= 50 and priority == 'high'", ctx) is True
    assert evaluate_condition("lead_score >= 90 or priority == 'high'", ctx) is True
    assert evaluate_condition("lead_score >= 90 and priority == 'low'", ctx) is False


def test_missing_variable_treated_as_none_not_crash():
    # Name lookup for a missing key returns None from context.get(); comparing
    # None to a number raises TypeError internally, which is caught and
    # treated as "always take this edge" rather than crashing the run.
    assert evaluate_condition("missing_field >= 50", {}) is True


def test_unsafe_expression_rejected_and_treated_as_pass_through():
    # Function calls, attribute access, etc. are not in the allowlist --
    # rather than execute them, fall back to "always take this edge".
    assert evaluate_condition("__import__('os').system('echo hi')", {}) is True
    assert evaluate_condition("context.__class__", {}) is True


def test_in_operator():
    assert evaluate_condition("status in ['approved', 'ready']", {"status": "approved"}) is True
    assert evaluate_condition("status in ['approved', 'ready']", {"status": "rejected"}) is False


def test_malformed_syntax_treated_as_pass_through():
    assert evaluate_condition("this is not : valid python &&", {}) is True
