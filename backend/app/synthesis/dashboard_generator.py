"""
Dashboard Generator.

The brief's example is explicit: for a CRM-style lead-management process,
ChainReact should construct "a bounded operational dashboard for that
process" -- not just an internal spec. This module is that: it takes a
validated ProcessSpec + AgentArchitecture + WorkflowGraph and renders one
self-contained HTML file that IS the operational interface for that
specific process -- a real, openable, deployable web page, not a mockup.

What the generated page does, entirely client-side:
- Shows the process name/objective and the synthesized agents/workflow as
  a compact read-only summary (what this dashboard is authorized to run).
- Renders an input form built from ProcessSpec.input_data -- exactly the
  fields the process declared, nothing invented.
- On submit, calls POST {backend_base_url}/api/runtime/execute against the
  live ChainReact backend, with this process's spec/architecture/workflow
  baked in as constants in the page -- so the dashboard is bounded to
  exactly this process, it cannot be repointed at a different one.
- Renders the step-by-step execution trace as it comes back, including any
  human-approval halt, using the same StepResult/RuntimeExecutionResult
  shape the backend already returns.
- Ships a "Run Sandbox" button too (POST /api/sandbox/run) so the page can
  also be used to re-validate the process, not just execute it.

This is deterministic (no LLM call) and template-based, on purpose: an
operational dashboard is a place a human runs real actions from, so its
correctness should never depend on model sampling -- it's built the same
way, byte for byte, from the same validated spec every time.

No React/build step, no external JS dependencies -- everything needed is
inlined, so the file opens and works standalone in any browser once the
person types in a reachable backend URL (or one was already baked in).
"""
from __future__ import annotations

import html
import json

from app.schemas import AgentArchitecture, ProcessSpec, WorkflowGraph


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


def _ordered_node_summaries(workflow: WorkflowGraph) -> list[dict]:
    """Best-effort topological-ish ordering (BFS from 'start') so the
    read-only workflow summary in the dashboard reads top-to-bottom in
    execution order rather than in whatever order the synthesizer emitted
    nodes. Falls back to declaration order for anything unreachable."""
    adj: dict[str, list[str]] = {}
    for e in workflow.edges:
        adj.setdefault(e.source, []).append(e.target)

    start_ids = [n.id for n in workflow.nodes if n.type == "start"]
    seen: list[str] = []
    seen_set: set[str] = set()
    frontier = list(start_ids)
    while frontier:
        cur = frontier.pop(0)
        if cur in seen_set:
            continue
        seen.append(cur)
        seen_set.add(cur)
        frontier.extend(adj.get(cur, []))

    by_id = {n.id: n for n in workflow.nodes}
    ordered = [by_id[i] for i in seen if i in by_id]
    ordered += [n for n in workflow.nodes if n.id not in seen_set]

    return [
        {"id": n.id, "type": n.type, "label": n.label or n.agent or n.tool or n.id}
        for n in ordered
    ]


def generate_dashboard_html(
    spec: ProcessSpec,
    arch: AgentArchitecture,
    workflow: WorkflowGraph,
    backend_base_url: str = "",
) -> str:
    spec_json = json.dumps(spec.model_dump(), default=str)
    arch_json = json.dumps(arch.model_dump(), default=str)
    workflow_json = json.dumps(workflow.model_dump(), default=str)

    input_fields_html = "\n".join(
        f'''<label class="field">
              <span>{_esc(field)}</span>
              <input type="text" name="{_esc(field)}" placeholder="{_esc(field)}" />
            </label>'''
        for field in spec.input_data
    ) or '<p class="muted">This process declares no input_data fields.</p>'

    agents_html = "\n".join(
        f'''<div class="agent-card">
              <strong>{_esc(a.id)}</strong>
              <p>{_esc(a.purpose)}</p>
              <p class="muted">permissions: {_esc(", ".join(a.permissions) or "none")}</p>
            </div>'''
        for a in arch.agents
    )

    steps_summary = _ordered_node_summaries(workflow)
    workflow_html = "\n".join(
        f'<li><span class="node-type node-{_esc(s["type"])}">{_esc(s["type"])}</span> {_esc(s["label"])}</li>'
        for s in steps_summary
    )

    approval_html = "\n".join(
        f'<li><strong>{_esc(g.action)}</strong>{" — " + _esc(g.reason) if g.reason else ""}</li>'
        for g in spec.human_approval
    ) or '<li class="muted">No human-approval gates declared for this process.</li>'

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{_esc(spec.name)} — Operational Dashboard</title>
<style>
  :root {{ --purple: #5b3df0; --bg: #f7f7fb; --card: #fff; --border: #e2e2ea; --danger: #c0341d; --ok: #1a7f37; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: #222; }}
  header {{ padding: 28px 20px 16px; max-width: 900px; margin: 0 auto; }}
  header h1 {{ margin: 0 0 4px; font-size: 24px; }}
  header p {{ color: #666; margin: 0; }}
  main {{ max-width: 900px; margin: 0 auto; padding: 0 20px 60px; display: flex; flex-direction: column; gap: 20px; }}
  .card {{ background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }}
  .card h2 {{ margin-top: 0; font-size: 16px; }}
  .muted {{ color: #888; font-size: 13px; }}
  .agents-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }}
  .agent-card {{ border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-size: 13px; }}
  .agent-card p {{ margin: 4px 0 0; }}
  ol#workflow-list {{ padding-left: 20px; font-size: 14px; }}
  .node-type {{ font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; margin-right: 6px; background: #eee; color: #555; }}
  .node-human_approval {{ background: #fff3cd; color: #8a6d00; }}
  .node-agent {{ background: #eef0ff; color: var(--purple); }}
  form {{ display: flex; flex-direction: column; gap: 12px; }}
  .field {{ display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; }}
  .field input {{ font-weight: 400; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; }}
  .row {{ display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }}
  button {{ padding: 10px 18px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }}
  .btn-primary {{ background: var(--purple); color: #fff; }}
  .btn-secondary {{ background: #fff; color: var(--purple); border: 1px solid var(--purple); }}
  button:disabled {{ opacity: 0.6; cursor: default; }}
  #backend-url {{ flex: 1; min-width: 240px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; }}
  .step {{ border-left: 3px solid var(--border); padding: 8px 0 8px 14px; margin-bottom: 8px; }}
  .step.halt {{ border-left-color: #8a6d00; }}
  .step-head {{ font-weight: 600; font-size: 13px; }}
  pre {{ background: #f5f5f8; padding: 10px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin: 6px 0 0; }}
  .badge {{ display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }}
  .badge-ok {{ background: #e6f7ec; color: var(--ok); }}
  .badge-bad {{ background: #fff5f4; color: var(--danger); }}
  #status {{ font-size: 13px; margin-top: 10px; }}
</style>
</head>
<body>
<header>
  <h1>{_esc(spec.name)}</h1>
  <p>{_esc(spec.objective)}</p>
  <p class="muted">Generated operational dashboard — bounded to this process's declared inputs, agents, and approval gates. No action beyond what this page shows is possible from here.</p>
</header>
<main>

  <div class="card">
    <h2>Backend connection</h2>
    <div class="row">
      <input id="backend-url" type="text" value="{_esc(backend_base_url)}" placeholder="https://your-chainreact-backend.onrender.com" />
    </div>
    <p class="muted">This dashboard talks to the ChainReact backend above via its public API — it does not run any logic itself.</p>
  </div>

  <div class="card">
    <h2>Synthesized agents ({len(arch.agents)})</h2>
    <div class="agents-grid">
      {agents_html}
    </div>
  </div>

  <div class="card">
    <h2>Workflow (execution order)</h2>
    <ol id="workflow-list">
      {workflow_html}
    </ol>
  </div>

  <div class="card">
    <h2>Human approval required before…</h2>
    <ul>
      {approval_html}
    </ul>
  </div>

  <div class="card">
    <h2>Run this process</h2>
    <form id="run-form">
      {input_fields_html}
      <div class="row">
        <button type="submit" class="btn-primary" id="run-btn">Run Process</button>
        <button type="button" class="btn-secondary" id="sandbox-btn">Re-run Sandbox Check</button>
        <label class="row" style="font-size:13px; font-weight:400;">
          <input type="checkbox" id="auto-approve" checked /> Auto-approve gates (demo mode)
        </label>
      </div>
    </form>
    <div id="status"></div>
  </div>

  <div class="card" id="results-card" style="display:none;">
    <h2>Execution trace</h2>
    <div id="results"></div>
  </div>

</main>

<script>
const SPEC = {spec_json};
const ARCHITECTURE = {arch_json};
const WORKFLOW = {workflow_json};

function backendUrl() {{
  return document.getElementById('backend-url').value.trim().replace(/\\/$/, '');
}}

function setStatus(text, ok) {{
  const el = document.getElementById('status');
  el.textContent = text;
  el.style.color = ok === undefined ? '#666' : (ok ? 'var(--ok)' : 'var(--danger)');
}}

document.getElementById('sandbox-btn').addEventListener('click', async () => {{
  const url = backendUrl();
  if (!url) {{ setStatus('Enter the backend URL above first.', false); return; }}
  setStatus('Running sandbox check…');
  try {{
    const res = await fetch(url + '/api/sandbox/run', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ spec: SPEC, architecture: ARCHITECTURE, workflow: WORKFLOW }})
    }});
    const data = await res.json();
    if (!res.ok) {{ setStatus('Sandbox check failed: ' + (data.message || res.status), false); return; }}
    setStatus(`Sandbox: ${{data.passed}}/${{data.total}} passed. Ready for deployment: ${{data.ready_for_deployment}}.`, data.ready_for_deployment);
  }} catch (e) {{
    setStatus('Could not reach backend: ' + e.message, false);
  }}
}});

document.getElementById('run-form').addEventListener('submit', async (e) => {{
  e.preventDefault();
  const url = backendUrl();
  if (!url) {{ setStatus('Enter the backend URL above first.', false); return; }}

  const formData = new FormData(e.target);
  const inputData = {{}};
  for (const [k, v] of formData.entries()) inputData[k] = v;

  const runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  setStatus('Running… (the backend may take up to a minute to wake up if idle)');
  document.getElementById('results-card').style.display = 'none';

  try {{
    const res = await fetch(url + '/api/runtime/execute', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{
        spec: SPEC, architecture: ARCHITECTURE, workflow: WORKFLOW,
        input_data: inputData,
        auto_approve: document.getElementById('auto-approve').checked
      }})
    }});
    const data = await res.json();
    if (!res.ok) {{ setStatus('Run failed: ' + (data.message || res.status), false); return; }}

    setStatus(data.halted_at_approval ? 'Run halted at a human-approval gate.' : 'Run completed.', !data.halted_at_approval);

    const results = document.getElementById('results');
    results.innerHTML = '';
    for (const step of data.steps) {{
      const div = document.createElement('div');
      div.className = 'step' + (step.type === 'human_approval' ? ' halt' : '');
      const toolLine = step.tool_calls && step.tool_calls.length ? `<div class="muted">tools: ${{step.tool_calls.join(', ')}}</div>` : '';
      const noteLine = step.note ? `<div class="muted">${{step.note}}</div>` : '';
      const outputBlock = step.output && Object.keys(step.output).length
        ? `<pre>${{JSON.stringify(step.output, null, 2)}}</pre>` : '';
      div.innerHTML = `<div class="step-head">[${{step.type}}] ${{step.label}}</div>${{toolLine}}${{noteLine}}${{outputBlock}}`;
      results.appendChild(div);
    }}
    const finalBlock = document.createElement('div');
    finalBlock.innerHTML = '<h3 style="font-size:13px;">Final context</h3><pre>' + JSON.stringify(data.final_context, null, 2) + '</pre>';
    results.appendChild(finalBlock);
    document.getElementById('results-card').style.display = 'block';
  }} catch (e) {{
    setStatus('Could not reach backend: ' + e.message, false);
  }} finally {{
    runBtn.disabled = false;
  }}
}});
</script>
</body>
</html>
"""
