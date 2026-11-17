import pytest

from app.synthesis import system_store


@pytest.fixture(autouse=True)
def _isolate_system_store(tmp_path, monkeypatch):
    """Keep every test away from the real systems_store.json (the user's saved systems)."""
    monkeypatch.setattr(system_store, "_STORE_PATH", str(tmp_path / "systems_store.json"))
    monkeypatch.setattr(system_store, "_SYSTEMS", {})
