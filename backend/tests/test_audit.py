from app.synthesis import audit


def test_audit_records_and_retrieves_entries(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "_LOG_PATH", str(tmp_path / "audit_log.jsonl"))
    audit._TRAILS.clear()

    audit.record("Test Process", "requirement_parsed", "Parsed ok.", {"a": 1})
    audit.record("Test Process", "sandbox_run", "2/2 passed.")
    audit.set_deployment_approved("Test Process", True)

    trail = audit.get_trail("Test Process")
    assert trail.process_name == "Test Process"
    assert len(trail.entries) == 2
    assert trail.entries[0].stage == "requirement_parsed"
    assert trail.deployment_approved is True


def test_audit_trail_is_empty_for_unknown_process():
    trail = audit.get_trail("Never Recorded Process")
    assert trail.entries == []
    assert trail.deployment_approved is False


def test_rehydrate_restores_trail_after_simulated_restart(tmp_path, monkeypatch):
    log_path = str(tmp_path / "audit_log.jsonl")
    monkeypatch.setattr(audit, "_LOG_PATH", log_path)
    audit._TRAILS.clear()

    # Simulate a normal run before a restart.
    audit.record("Restart Process", "requirement_parsed", "Parsed ok.")
    audit.record("Restart Process", "sandbox_run", "3/3 passed.")
    audit.set_deployment_approved("Restart Process", True)

    # Simulate the process restarting: the in-memory dict is wiped, but the
    # JSONL file on disk (log_path) is untouched.
    audit._TRAILS.clear()
    assert audit.get_trail("Restart Process").entries == []  # confirms the wipe actually happened

    audit._rehydrate()

    trail = audit.get_trail("Restart Process")
    assert len(trail.entries) == 2
    assert trail.entries[0].stage == "requirement_parsed"
    assert trail.entries[1].summary == "3/3 passed."
    assert trail.deployment_approved is True


def test_rehydrate_skips_malformed_lines_without_losing_valid_ones(tmp_path, monkeypatch):
    log_path = tmp_path / "audit_log.jsonl"
    monkeypatch.setattr(audit, "_LOG_PATH", str(log_path))
    audit._TRAILS.clear()

    log_path.write_text(
        '{"process_name": "P", "stage": "ok_stage", "timestamp": "t", "summary": "fine", "detail": {}}\n'
        "not even json\n"
        '{"process_name": "P", "stage": "missing_fields"}\n'
    )

    audit._rehydrate()

    trail = audit.get_trail("P")
    assert len(trail.entries) == 2  # the good line + the line missing timestamp/summary (defaults applied)
    assert trail.entries[0].summary == "fine"
