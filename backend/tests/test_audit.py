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
