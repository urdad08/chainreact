"""
Mock tools for the Sandbox Executor.

Per the brief: generated agents must never freely access real APIs. Every
tool call during a sandbox run goes through one of these in-memory mocks
instead -- no real CRM, email, or database is ever touched.
"""
from __future__ import annotations

from typing import Dict, List, Tuple


class MockTool:
    def __init__(self, name: str):
        self.name = name
        self.calls: List[Tuple[str, dict]] = []

    def call(self, operation: str, **kwargs) -> dict:
        self.calls.append((operation, kwargs))
        return {"tool": self.name, "operation": operation, "status": "ok", **kwargs}


class MockToolRegistry:
    """Lazily creates one MockTool per logical tool name encountered during a run."""

    def __init__(self):
        self._tools: Dict[str, MockTool] = {}

    def get(self, name: str) -> MockTool:
        if name not in self._tools:
            self._tools[name] = MockTool(name)
        return self._tools[name]

    def all_calls(self) -> Dict[str, List[Tuple[str, dict]]]:
        return {name: tool.calls for name, tool in self._tools.items()}
