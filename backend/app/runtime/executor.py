"""
Runtime Executor v2 -- a real workflow execution engine, not a linear
walk that always follows the first outgoing edge.

What changed from v1 (kept for context, since the gap mattered):
- WorkflowEdge.condition is now actually evaluated (safely -- see
  condition_eval.py) to decide which successors activate, instead of
  being dead data that every node silently ignored.
- Multiple nodes that become ready at once (a fan-out) run concurrently
  in a ThreadPoolExecutor -- genuine parallelism for independent
  branches, not just a sequential illusion of one.
- Agent permissions are re-checked at the moment a tool is actually
  invoked, not only once at architecture-generation time (policy.py).
  A tool call outside an agent's authorized permissions is BLOCKED, not
  executed, no matter what the architecture said at design time.
- Tool calls are routed through app/tools/registry.py: a capability with
  a registered real handler (and allow_real_tools=True) genuinely calls
  an external system; everything else is honestly labeled "simulated"
  instead of the old MockToolRegistry's unconditional fake "ok".
- An agent step that raises is retried up to ProcessSpec.failure_policy's
  max_retries (attempt-counted, no real wall-clock backoff delay -- this
  stays fast and deterministic for tests/demos) before the whole run is
  marked "failed" rather than propagating an uncaught exception.

Safety default: allow_real_tools=False (this module's default, and
execute_process's only mode) -- so every existing caller of
execute_process, including the dashboard-generator's standalone HTML
pages and every existing test, behaves exactly as before: demonstration
only, nothing real happens. The NEW live-execution API
(api/execution.py) is the only caller that passes allow_real_tools=True,
because actually touching a real inbox/calendar/Slack channel should be
a deliberate, visible choice, not a side effect of clicking the same
"try it" button that used to only ever simulate.
"""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Dict, List, Optional, Tuple

from pydantic import create_model

from app.core.llm_client import structured_completion
from app.integrations.google_oauth import GoogleNotConnectedError
from app.runtime.condition_eval import evaluate_condition
from app.sandbox.mocks import MockToolRegistry
from app.schemas import (
    AgentArchitecture,
    AgentDef,
    ProcessSpec,
    RuntimeExecutionResult,
    StepResult,
    ToolBinding,
    ToolCallRecord,
    WorkflowGraph,
    WorkflowNode,
)
from app.tools.registry import real_handler_for

_MAX_PARALLEL_WORKERS = 8


def _simulate_agent_output(agent: AgentDef, context: Dict[str, Any]) -> Dict[str, Any]:
    """Ask the LLM to produce this agent's declared outputs, given
    everything produced so far. Every output field is typed as a string
    for simplicity -- good enough to demonstrate real values flowing
    through the process without over-engineering a type system the
    AgentArchitect's plain-text 'outputs' list was never meant to carry."""
    if not agent.outputs:
        return {}

    fields = {name: (str, ...) for name in agent.outputs}
    OutputModel = create_model(f"{agent.id}_Output", **fields)  # type: ignore[call-overload]

    system_prompt = (
        f"You are simulating the agent '{agent.id}' inside a running business process. "
        f"Its purpose: {agent.purpose}. Given the process data accumulated so far, "
        f"produce this agent's declared outputs with realistic values consistent with "
        f"that input. Keep values short and concrete (e.g. a number as a numeral string, "
        f"a name as a plausible name). Return ONLY the requested fields."
    )
    user_prompt = f"Process data so far:\n{json.dumps(context, indent=2, default=str)}"

    result = structured_completion(system_prompt=system_prompt, user_prompt=user_prompt, response_model=OutputModel)
    return result.model_dump()


def _resolve_capability(agent_permissions: List[str], tool_category: str) -> Optional[str]:
    """Find the permission (if any) in this agent's own grant list that
    covers a tool category -- e.g. tool 'crm' matched against permission
    'crm.read'. Substring-tolerant because tool names are LLM-invented
    free text (e.g. 'company_database') while permissions come from the
    fixed catalog -- exact-prefix match first, then loose substring."""
    cat = tool_category.lower()
    for p in agent_permissions:
        if p.split(".")[0] == cat:
            return p
    for p in agent_permissions:
        prefix = p.split(".")[0]
        if prefix in cat or cat in prefix:
            return p
    return None


def _execute_tool_call(
    binding_name: str,
    operation: str,
    config: Dict[str, str],
    capability: Optional[str],
    context_snapshot: Dict[str, Any],
    registry: MockToolRegistry,
    allow_real_tools: bool,
) -> Tuple[ToolCallRecord, Dict[str, Any]]:
    if capability is None:
        return ToolCallRecord(
            capability=f"{binding_name}.{operation}", real=False, status="blocked",
            detail=f"No permission in this agent's grant covers the '{binding_name}' tool.",
        ), {}

    handler = real_handler_for(capability) if allow_real_tools else None
    if handler is not None:
        try:
            real_output = handler(operation, context_snapshot, config)
            context_contribution = {
                f"{capability.replace('.', '_')}_result": real_output,
                **{k: v for k, v in real_output.items() if isinstance(v, (str, int, float))},
            }
            return ToolCallRecord(capability=capability, real=True, status="ok"), context_contribution
        except GoogleNotConnectedError as e:
            return ToolCallRecord(capability=capability, real=True, status="failed", detail=str(e)), {}
        except RuntimeError as e:
            return ToolCallRecord(capability=capability, real=True, status="failed", detail=str(e)), {}

    mock = registry.get(binding_name)
    mock.call(operation, **{k: v for k, v in context_snapshot.items() if isinstance(v, (str, int, float))})
    return ToolCallRecord(
        capability=capability, real=False, status="simulated",
        detail="No real integration is connected for this capability yet." if allow_real_tools else None,
    ), {}


def _run_agent_node(
    spec: ProcessSpec,
    agent: AgentDef,
    node: WorkflowNode,
    context_snapshot: Dict[str, Any],
    registry: MockToolRegistry,
    allow_real_tools: bool,
) -> Tuple[StepResult, Dict[str, Any]]:
    max_attempts = spec.failure_policy.max_retries + 1
    output: Optional[Dict[str, Any]] = None
    last_error: Optional[Exception] = None
    attempt = 0

    for attempt in range(1, max_attempts + 1):
        try:
            output = _simulate_agent_output(agent, context_snapshot)
            break
        except Exception as e:  # noqa: BLE001 -- any LLM/JSON failure is retried the same way
            last_error = e

    if output is None:
        note = f"Failed after {attempt} attempt(s): {last_error}"
        return StepResult(node_id=node.id, type="agent", label=agent.id, status="failed", attempt=attempt, note=note), {}

    tool_calls: List[str] = []
    tool_call_details: List[ToolCallRecord] = []
    tool_context_updates: Dict[str, Any] = {}
    merged_for_tools = {**context_snapshot, **output}
    for binding in agent.tools:
        for operation in binding.operations:
            capability = _resolve_capability(agent.permissions, binding.name)
            record, extra_context = _execute_tool_call(
                binding.name, operation, binding.config.model_dump(exclude_none=True), capability, merged_for_tools, registry, allow_real_tools
            )
            tool_calls.append(f"{binding.name}.{operation}")
            tool_call_details.append(record)
            tool_context_updates.update(extra_context)

    worst = "ok"
    for r in tool_call_details:
        if r.status == "failed":
            worst = "failed"
            break
        if r.status == "blocked" and worst != "failed":
            worst = "blocked"
        elif r.status == "simulated" and worst == "ok":
            worst = "simulated"

    step = StepResult(
        node_id=node.id, type="agent", label=agent.id, status=worst, attempt=attempt,
        output=output, tool_calls=tool_calls, tool_call_details=tool_call_details, note=agent.purpose,
    )
    return step, {**output, **tool_context_updates}


def _run_tool_node(
    spec: ProcessSpec,
    node: WorkflowNode,
    context_snapshot: Dict[str, Any],
    registry: MockToolRegistry,
    allow_real_tools: bool,
) -> Tuple[StepResult, Dict[str, Any]]:
    tool_ref = node.tool or "unknown.unknown"
    category, _, operation = tool_ref.partition(".")
    capability = tool_ref if tool_ref in spec.permissions.allowed else None
    record, extra_context = _execute_tool_call(category or "unknown", operation or "call", {}, capability, context_snapshot, registry, allow_real_tools)
    step = StepResult(
        node_id=node.id, type="tool", label=tool_ref, status=record.status,
        tool_calls=[tool_ref], tool_call_details=[record],
    )
    return step, extra_context


def _process_node(
    node: WorkflowNode,
    spec: ProcessSpec,
    agents_by_id: Dict[str, AgentDef],
    context_snapshot: Dict[str, Any],
    registry: MockToolRegistry,
    allow_real_tools: bool,
    auto_approve: bool,
    approval_overrides: Optional[Dict[str, bool]] = None,
) -> Tuple[StepResult, Dict[str, Any]]:
    if node.type == "start":
        return StepResult(node_id=node.id, type="start", label="start", note=f"Process '{spec.name}' begins."), {}

    if node.type == "end":
        return StepResult(node_id=node.id, type="end", label="end", note="Process complete."), {}

    if node.type == "agent":
        agent = agents_by_id.get(node.agent or "")
        if not agent:
            return StepResult(
                node_id=node.id, type="agent", label=node.id, status="failed",
                note=f"No matching AgentDef for '{node.agent}'.",
            ), {}
        return _run_agent_node(spec, agent, node, context_snapshot, registry, allow_real_tools)

    if node.type == "tool":
        return _run_tool_node(spec, node, context_snapshot, registry, allow_real_tools)

    if node.type == "human_approval":
        decision = approval_overrides.get(node.id) if approval_overrides and node.id in approval_overrides else auto_approve
        if decision:
            return StepResult(node_id=node.id, type="human_approval", label="human_approval", status="ok", note="Approved"), {}
        return StepResult(node_id=node.id, type="human_approval", label="human_approval", status="waiting_approval", note="Waiting for a human decision"), {}

    return StepResult(node_id=node.id, type=node.type, label=node.id, status="failed", note=f"Unknown node type '{node.type}'."), {}


def _drive(
    spec: ProcessSpec,
    nodes_by_id: Dict[str, WorkflowNode],
    agents_by_id: Dict[str, AgentDef],
    adjacency: Dict[str, List],
    registry: MockToolRegistry,
    context: Dict[str, Any],
    visited: set,
    frontier: List[str],
    *,
    auto_approve: bool,
    allow_real_tools: bool,
    approval_overrides: Optional[Dict[str, bool]],
    status_box: Optional[Dict[str, Any]],
    guard_budget: int,
    on_wave_start: Optional[Callable[[List[str]], None]] = None,
):
    """The actual wave-by-wave traversal, shared by a fresh run
    (iter_workflow) and a resumed one (resume_workflow) -- the only
    difference between them is what visited/frontier/context they start
    from. See iter_workflow's docstring for the yield/status_box contract."""
    guard = 0
    final_status = "completed"

    while frontier and guard < guard_budget:
        guard += 1
        wave_ids = frontier
        frontier = []
        context_snapshot = dict(context)
        if on_wave_start is not None:
            on_wave_start(list(wave_ids))

        if len(wave_ids) == 1:
            node = nodes_by_id.get(wave_ids[0])
            results = [(wave_ids[0], _process_node(node, spec, agents_by_id, context_snapshot, registry, allow_real_tools, auto_approve, approval_overrides))] if node else []
        else:
            results = []
            with ThreadPoolExecutor(max_workers=min(_MAX_PARALLEL_WORKERS, len(wave_ids))) as pool:
                futures = {
                    pool.submit(_process_node, nodes_by_id[nid], spec, agents_by_id, context_snapshot, registry, allow_real_tools, auto_approve, approval_overrides): nid
                    for nid in wave_ids if nid in nodes_by_id
                }
                for future in as_completed(futures):
                    results.append((futures[future], future.result()))

        should_halt = False
        pending_approval_ids: List[str] = []
        completed_ids: List[str] = []
        for node_id, (step, output_update) in results:
            yield step
            context.update(output_update)
            if step.status == "failed":
                final_status = "failed"
                should_halt = True
            elif step.status == "waiting_approval":
                final_status = "waiting_approval"
                should_halt = True
                pending_approval_ids.append(node_id)
            else:
                completed_ids.append(node_id)

        if should_halt:
            if status_box is not None:
                status_box["checkpoint"] = {
                    "visited": list(visited),
                    "context": dict(context),
                    "pending_approval_ids": pending_approval_ids,
                    "completed_ids": completed_ids,
                }
            break

        for node_id, _ in results:
            for edge in adjacency.get(node_id, []):
                if edge.target in visited:
                    continue
                if edge.condition and not evaluate_condition(edge.condition, context):
                    continue
                visited.add(edge.target)
                frontier.append(edge.target)

    if status_box is not None:
        status_box["status"] = final_status
        status_box["context"] = context


def _build_adjacency(workflow: WorkflowGraph) -> Dict[str, List]:
    adjacency: Dict[str, List] = {}
    for e in workflow.edges:
        adjacency.setdefault(e.source, []).append(e)
    return adjacency


def iter_workflow(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    input_data: Dict[str, Any],
    *,
    auto_approve: bool = True,
    allow_real_tools: bool = False,
    status_box: Optional[Dict[str, Any]] = None,
    on_wave_start: Optional[Callable[[List[str]], None]] = None,
):
    """Generator yielding StepResult as each node completes, from a fresh
    start. Nodes whose predecessors just activated run concurrently (real
    parallelism for independent branches, via a thread pool -- fine here
    since every worker does blocking I/O: an LLM call or a tool's HTTP
    call).

    `status_box`, if given, is written with the final run status
    ("completed" | "failed" | "waiting_approval") once the generator is
    exhausted, and -- when the run halted waiting for approval -- a
    "checkpoint" dict that resume_workflow can continue from later.
    Generators can't easily return extra data alongside their yields,
    and this side-channel is simpler than wrapping every yield in a tuple."""
    registry = MockToolRegistry()
    agents_by_id = {a.id: a for a in arch.agents}
    nodes_by_id = {n.id: n for n in workflow.nodes}
    adjacency = _build_adjacency(workflow)

    context: Dict[str, Any] = dict(input_data)
    start = next((n for n in workflow.nodes if n.type == "start"), workflow.nodes[0])

    yield from _drive(
        spec, nodes_by_id, agents_by_id, adjacency, registry,
        context, {start.id}, [start.id],
        auto_approve=auto_approve, allow_real_tools=allow_real_tools, approval_overrides=None,
        status_box=status_box, guard_budget=len(workflow.nodes) * 3 + 5, on_wave_start=on_wave_start,
    )


def resume_workflow(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    checkpoint: Dict[str, Any],
    approved: bool,
    *,
    allow_real_tools: bool = False,
    status_box: Optional[Dict[str, Any]] = None,
    on_wave_start: Optional[Callable[[List[str]], None]] = None,
):
    """Continue a run that iter_workflow (or a previous resume_workflow
    call) halted at a human-approval checkpoint. `checkpoint` is exactly
    what the earlier run's status_box["checkpoint"] contained.

    On rejection, the run ends as "failed" (an approval gate exists
    precisely so a rejection stops the process, not routes around it) --
    no further nodes run, matching the rest of ChainReact's "never bypass
    the permission configuration" principle for approval gates too."""
    registry = MockToolRegistry()
    agents_by_id = {a.id: a for a in arch.agents}
    nodes_by_id = {n.id: n for n in workflow.nodes}
    adjacency = _build_adjacency(workflow)

    visited = set(checkpoint.get("visited", []))
    context: Dict[str, Any] = dict(checkpoint.get("context", {}))
    pending_ids: List[str] = checkpoint.get("pending_approval_ids", [])
    completed_ids: List[str] = checkpoint.get("completed_ids", [])

    if not approved:
        if status_box is not None:
            status_box["status"] = "failed"
            status_box["context"] = context
        return

    # Already-completed siblings from the halted wave only need their
    # successors activated (re-running the sibling itself could re-fire a
    # real, side-effecting tool call a second time -- unsafe). The
    # approval node(s) themselves are re-processed once more (cheap, no
    # side effects) so the caller sees an explicit "approved" step.
    frontier: List[str] = []
    for node_id in completed_ids:
        for edge in adjacency.get(node_id, []):
            if edge.target in visited:
                continue
            if edge.condition and not evaluate_condition(edge.condition, context):
                continue
            visited.add(edge.target)
            frontier.append(edge.target)

    approval_overrides = {nid: True for nid in pending_ids}
    frontier = list(pending_ids) + frontier

    yield from _drive(
        spec, nodes_by_id, agents_by_id, adjacency, registry,
        context, visited, frontier,
        auto_approve=True, allow_real_tools=allow_real_tools, approval_overrides=approval_overrides,
        status_box=status_box, guard_budget=len(workflow.nodes) * 3 + 5, on_wave_start=on_wave_start,
    )


def execute_process(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    input_data: Dict[str, Any],
    *,
    auto_approve: bool = True,
) -> RuntimeExecutionResult:
    """Backward-compatible synchronous entry point -- always
    allow_real_tools=False, so this behaves identically to before for
    every existing caller (the dashboard-generator's standalone HTML
    pages call this exact endpoint). Real execution only happens through
    the new live-execution API (api/execution.py), which calls
    iter_workflow directly with allow_real_tools=True."""
    status_box: Dict[str, Any] = {}
    steps = list(
        iter_workflow(spec, arch, workflow, input_data, auto_approve=auto_approve, allow_real_tools=False, status_box=status_box)
    )
    status = status_box.get("status", "completed")
    context = status_box.get("context", dict(input_data))
    return RuntimeExecutionResult(
        process_name=spec.name,
        input_data=input_data,
        steps=steps,
        final_context=context,
        status=status,
        halted_at_approval=(status == "waiting_approval"),
    )
