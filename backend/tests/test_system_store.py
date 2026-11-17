import pytest

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    Constraints,
    FailurePolicy,
    Permissions,
    ProcessSpec,
    Trigger,
    WorkflowGraph,
    WorkflowNode,
)
from app.synthesis import system_store


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    store_path = tmp_path / "systems_store.json"
    monkeypatch.setattr(system_store, "_STORE_PATH", str(store_path))
    monkeypatch.setattr(system_store, "_SYSTEMS", {})
    yield store_path


def _spec(name="Test Process") -> ProcessSpec:
    return ProcessSpec(
        name=name, objective="x", trigger=Trigger(type="webhook", event="x"),
        permissions=Permissions(allowed=[], forbidden=[]),
        failure_policy=FailurePolicy(max_retries=3, retry_strategy="fixed", fallback="human_review"),
        limits=Constraints(max_cost_per_execution=0.1, max_latency_seconds=30, privacy="n/a"),
    )


def _arch(name="Test Process") -> AgentArchitecture:
    return AgentArchitecture(process_name=name, agents=[AgentDef(id="a1", purpose="x")])


def _workflow(name="Test Process") -> WorkflowGraph:
    return WorkflowGraph(process_name=name, nodes=[WorkflowNode(id="start", type="start")], edges=[])


def test_save_and_get_round_trip():
    stored = system_store.save_system(_spec(), _arch(), _workflow())
    fetched = system_store.get_system(stored.system_id)
    assert fetched is not None
    assert fetched.process_name == "Test Process"
    assert fetched.agent_architecture.agents[0].id == "a1"


def test_get_unknown_id_returns_none():
    assert system_store.get_system("does-not-exist") is None


def test_list_systems_most_recent_first():
    first = system_store.save_system(_spec("First"), _arch("First"), _workflow("First"))
    second = system_store.save_system(_spec("Second"), _arch("Second"), _workflow("Second"))
    summaries = system_store.list_systems()
    ids = [s.system_id for s in summaries]
    assert ids.index(second.system_id) < ids.index(first.system_id)


def test_persisted_to_disk_and_reloadable(tmp_path, monkeypatch):
    system_store.save_system(_spec(), _arch(), _workflow())
    assert system_store._STORE_PATH and __import__("os").path.exists(system_store._STORE_PATH)

    # Simulate a fresh process: clear memory, reload from the same file.
    saved_path = system_store._STORE_PATH
    system_store._SYSTEMS.clear()
    monkeypatch.setattr(system_store, "_STORE_PATH", saved_path)
    system_store._load()
    assert len(system_store.list_systems()) == 1


def test_list_systems_summary_includes_counts():
    system_store.save_system(_spec(), _arch(), _workflow())
    summary = system_store.list_systems()[0]
    assert summary.agent_count == 1
    assert summary.node_count == 1
    assert summary.objective == "x"
    assert summary.has_approval_gate is False
