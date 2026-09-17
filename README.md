# ChainReact

Agent-building-agent system: a natural-language business-process requirement
goes in, and an audited, sandbox-tested, cooperating agent system comes out.

```
Natural language requirement
        │
        ▼
Requirement Analyst      (LLM, structured output)
        │
        ▼
   ProcessSpec            (Pydantic-validated)
        │
        ▼
 Validation Engine        (deterministic business-rule checks)
        │
        ▼
  Agent Architect  ───┐   (LLM, structured output; retried up to
        │             │    MAX_REPAIR_ATTEMPTS with deterministic
        ▼             │    feedback if permission/coverage checks fail)
 AgentArchitecture     │
        │              │   Policy Engine (deterministic: permission
        ▼              │   subset check + tool/permission coverage)
Workflow Synthesizer ──┘   (LLM, structured output; same repair-before-
        │                   ship pattern for missing approval gates /
        ▼                   broken start→end connectivity)
  WorkflowGraph  ──►  React Flow visualization in the dashboard
        │
        ▼
  Sandbox Executor        (deterministic test generation + a real
        │                  node-by-node graph walk through mock tools,
        │                  with simulated human-approval decisions)
        ▼
   SandboxReport           (pass/fail per test, execution trace,
        │                   ready_for_deployment)
        ▼
   Audit Trail             (every stage timestamped; deployment gate is
        │                   the boolean AND of "policy valid" + "sandbox
        │                   ready_for_deployment")
        ▼
Deployment decision (APPROVED / BLOCKED)

                    ┌─ optional, per sample input ─┐
                    │                              │
                    ▼                              │
             Runtime Executor ────────────────────►┘
        (actually runs the process: the LLM plays each
         agent's role against real accumulated data,
         mock tool calls are recorded, human-approval
         gates can halt execution)
```

Everything the LLM produces is forced into a Pydantic schema (via structured
outputs) and re-validated on the Python side — the LLM is never trusted as
the source of truth for permissions, approval gates, or correctness. That
enforcement, plus the sandbox/runtime/audit layers below it, is the actual
engineering contribution here, not the LLM calls themselves.

## What's implemented

- **`ProcessSpec` schema** covering every input the brief requires:
  objective/users, input/output data, trigger, rules, permissions,
  human-approval gates, failure policy, success conditions, and
  cost/latency/privacy limits.
- **Requirement Analyst**: NL → `ProcessSpec` via one structured LLM call.
  **Permissions and approval gates are explicitly NOT extracted from this
  text** — they're configured separately via a dedicated permissions editor
  and approval-gates editor in the dashboard (click a permission chip to
  cycle unset → allowed → forbidden → unset), sent to the backend as
  structured lists, and become the deterministic source of truth for
  `ProcessSpec.permissions` / `ProcessSpec.human_approval` — the LLM never
  touches them.
- **Validation Engine**: deterministic checks (missing rules, no allowed
  permissions, sensitive actions without an approval gate, zero cost limit,
  etc.) that run without calling the LLM.
- **Agent Architect**: `ProcessSpec` → `AgentArchitecture` (single-purpose
  agents with declared inputs/outputs/tools/permissions/memory). If the
  deterministic Policy Engine finds a problem (a forbidden permission, an
  agent with tools but no permissions), the issue is fed back to the LLM and
  it retries — up to `MAX_REPAIR_ATTEMPTS` (3) — *before* anything ships.
- **Policy Engine**: re-checks every synthesized agent's permissions against
  `ProcessSpec.permissions` and checks that any agent with tool bindings
  actually holds a covering permission. This is a security boundary, so it
  is never left to an LLM instruction alone.
- **Workflow Synthesizer**: `ProcessSpec` + `AgentArchitecture` →
  `WorkflowGraph` (nodes + edges, human-approval gates, branch conditions).
  Same repair-before-ship pattern: if a required approval gate is missing or
  `start`→`end` isn't connected, the issue is fed back to the LLM and it
  retries.
- **Sandbox Executor**: generates a deterministic `TestCase` suite from the
  spec (structural connectivity, permission-subset checks, tool/permission
  coverage, one test per approval gate, one advisory test per success
  condition), then walks the compiled `WorkflowGraph` node by node — calling
  a `MockTool` for every agent's declared tool operations and simulating a
  decision at every `human_approval` gate — producing a readable execution
  trace and a pass/fail `SandboxReport`. **No real CRM/email/DB is ever
  touched**; structural/permission/approval failures are hard deployment
  gates, success-condition checks are advisory.
- **Runtime Executor**: goes one step further than the sandbox — for a
  sample input record you provide, it actually asks the LLM to play each
  agent's role given the declared contract and whatever earlier agents
  produced, threading real values (an actual lead score, an actual
  assignee) through the graph as shared context, while still routing every
  tool call through the same mocks and still honoring human-approval halts.
  This is what lets you watch data flow through the process step by step
  instead of only seeing a structural trace.
- **Audit Trail**: every stage (parse → validate → synthesize agents →
  policy check → synthesize workflow → sandbox run → deployment gate →
  any runtime executions) is recorded with a timestamp, in memory and
  appended to `backend/audit_log.jsonl`. The full trail is returned in the
  `/api/synthesize` response and retrievable later via
  `GET /api/audit/{process_name}`. **Survives restarts**: the free hosting
  tier spins the backend process down on inactivity and restarts it on the
  next request, which would otherwise silently wipe the in-memory trail
  even though the JSONL file on disk is untouched — `audit.py` replays that
  file back into memory once at import time, so a trail generated before a
  spin-down is still there after the server wakes back up.
- **Deployment gate**: `PipelineResult.deployment_approved` is `true` only
  when the Policy Engine (including tool/permission coverage) is valid
  **and** the sandbox run is `ready_for_deployment`. The dashboard shows
  this as a clear Approved/Blocked stat, plus the full test table, the
  self-repair log, the audit trail, and an interactive runtime runner.
- **Project Overview page**: a second view (toggle at the top of the app,
  "Project Overview" vs "Live Demo") built into the same hosted site,
  covering the problem/users/motivation, the solution and user journey,
  what's complete/limited/next, team contributions, and — all inline as
  hand-built SVG, zero external dependencies — the 4 required Use Case
  Diagrams, 5 required Sequence Diagrams, and the Class Diagram
  (`src/pages/OverviewPage.tsx`, `src/diagrams/`). **Edit the `TEAM` array
  in `OverviewPage.tsx` with your real teammates before presenting** — it
  currently has placeholder names.
- **In-app Assistant Chat**: a floating chat widget (bottom-right of the
  dashboard) backed by `POST /api/chat`, using the same Gemini client as
  every other stage but with plain-text conversation instead of a
  structured schema. It can answer questions about how ChainReact itself
  works (what the policy engine does, why an approval gate exists) as well
  as general questions about AI agents/agentic systems — handy for live
  Q&A during a demo.
- **React + TypeScript dashboard**: requirement textbox → status bar
  (agent/tool/approval-gate counts, policy result, deployment gate) →
  React Flow workflow diagram → ProcessSpec detail panel → agent contract
  cards → sandbox test results → audit trail → runtime runner (type in a
  sample record, watch it execute step by step).

Not yet in scope: real MCP/tool integrations (mock tools are used
everywhere — sandbox and runtime alike — since there are no live CRM/email/
DB adapters yet), and an actual deployment target (the gate currently
produces a decision, not a rollout).

## Repository layout

```
chainreact/
├── backend/
│   ├── app/
│   │   ├── main.py                    FastAPI app + CORS
│   │   ├── api/synthesize.py          Endpoints (per-stage + full pipeline)
│   │   ├── schemas/                   ProcessSpec, AgentArchitecture,
│   │   │                               WorkflowGraph, TestCase/SandboxReport,
│   │   │                               StepResult/RuntimeExecutionResult,
│   │   │                               AuditEntry/AuditTrail
│   │   ├── synthesis/
│   │   │   ├── requirement_parser.py  Stage 1
│   │   │   ├── validator.py           Deterministic validation
│   │   │   ├── agent_architect.py     Stage 2 (accepts repair feedback)
│   │   │   ├── policy.py              Deterministic permission + tool-coverage checks
│   │   │   ├── repair.py              Deterministic issue-finders + feedback formatting
│   │   │   ├── workflow_generator.py  Stage 3 (accepts repair feedback)
│   │   │   └── audit.py               Append-only audit trail (in-memory + JSONL)
│   │   ├── testing/
│   │   │   ├── test_generator.py      Deterministic TestCase generation
│   │   │   └── test_runner.py         Runs tests + sandbox dry-run → SandboxReport
│   │   ├── sandbox/
│   │   │   ├── mocks.py               MockTool / MockToolRegistry
│   │   │   └── executor.py            Structural graph walk with mock tool calls
│   │   ├── runtime/
│   │   │   └── executor.py            Real per-agent LLM execution against sample input
│   │   └── core/llm_client.py         Structured-output LLM wrapper
│   ├── tests/                         test_validation, test_sandbox, test_repair,
│   │                                   test_repair_loop_integration, test_runtime
│   └── requirements.txt
│
└── src/                                (frontend root; see package.json)
    ├── App.tsx
    ├── api/client.ts
    ├── components/                     RequirementForm, PermissionsEditor,
    │                                    ApprovalGatesEditor, StatusBar,
    │                                    WorkflowVisualizer (React Flow),
    │                                    ProcessSpecView, AgentList, TestResults,
    │                                    AuditTrailView, RuntimeRunner
    └── types/chainreact.ts             TS types mirroring the Pydantic schemas
```

## Running it (Apple Silicon / macOS)

### Backend

Requires Python 3.11+ (FastAPI and the `google-genai` SDK both run natively
on Apple Silicon — no Rosetta needed). If you don't have it:

```bash
brew install python@3.12
```

Get a free Gemini API key at https://aistudio.google.com/apikey (Google
account, no billing required for the free tier).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cp .env.example .env                 # then put your real GEMINI_API_KEY in .env
export $(grep -v '^#' .env | xargs)

uvicorn app.main:app --reload --port 8000
```

Runs at `http://localhost:8000` (interactive docs at `/docs`).

Run the unit tests any time — `test_validation.py` and `test_sandbox.py`
need no LLM call; `test_repair*.py` and `test_runtime.py` may hit the LLM
depending on how they're written, so check before running them without a
key configured:

```bash
pytest tests/ -v
```

### Frontend

Requires Node 18+. If you don't have `npm`:

```bash
brew install node
node -v && npm -v   # sanity check
```

The frontend lives at the repo root (not in a `frontend/` subfolder):

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173` and talks to the backend at
`http://localhost:8000` by default (override with `VITE_API_URL`).

### Docker (optional, works the same on Apple Silicon)

Both images are built from multi-arch bases (`python:3.12-slim`,
`node:20-slim`), so this runs natively on M-series Macs via Docker
Desktop — no `--platform` flag needed.

```bash
export GEMINI_API_KEY=your-real-key
docker compose up --build
```

## Demo flow

1. Open the frontend. A CRM lead-management requirement is pre-filled —
   edit it or paste your own.
2. Click **Generate Agent System**. The backend runs Requirement Analyst →
   Validation → Agent Architect (with up to 3 self-repair attempts) →
   Policy Check → Workflow Synthesizer (same self-repair pattern) →
   Sandbox → deployment gate, all in one call, and records every step to
   the audit trail.
3. If the ProcessSpec has a hard validation error, or the architecture/
   workflow still fails its checks after repair attempts are exhausted,
   the pipeline stops and the frontend shows exactly why.
4. On success you get: a stat bar (agents/tools/approval gates/policy
   result/deployment gate), any self-repair events, the workflow diagram,
   the full ProcessSpec, every agent's contract, the sandbox test table
   with a re-run button, the full audit trail, and a runtime runner where
   you can type in a sample record (e.g. a fake lead) and watch it execute
   step by step with real LLM-generated values flowing through the graph.

## Design notes worth knowing for the write-up / presentation

- **Structured outputs, not prompt-and-hope.** Every LLM call in
  `core/llm_client.py` uses a `response_schema` built from the exact
  Pydantic model, is parsed, and is re-validated with `model_validate`. On
  failure it retries once with the validation error appended so the model
  can self-correct.
- **Security checks are deterministic, not delegated to the model.** The
  Agent Architect prompt asks the LLM to only grant allowed permissions,
  but `policy.py` re-checks every agent's permissions in plain Python
  against `ProcessSpec.permissions`, and separately checks that every
  agent with tool bindings holds a covering permission — this is what
  actually blocks a rogue or hallucinated permission or an under-permissioned
  tool call from reaching the workflow stage.
- **Repair happens before anything ships, not after.** Rather than
  generating once and patching a broken result, `agent_architect.py` and
  `workflow_generator.py` are called in a loop (`repair.py` finds the
  deterministic issues, `format_feedback` turns them into a prompt
  addendum) up to `MAX_REPAIR_ATTEMPTS` times, so a first-draft mistake
  never needs to leave the synthesis stage.
- **Sandbox vs. Runtime is a deliberate split.** The Sandbox Executor never
  calls the LLM — it's a fast, reproducible structural check of what was
  synthesized (is it connected, does the approval gate exist, do
  permissions match) that gates deployment. The Runtime Executor is the
  opposite: it *does* call the LLM, once per agent, to produce plausible
  real values and show them flowing through the process — useful for a
  demo, but explicitly documented as demonstration-grade, not a
  replacement for real per-agent code or live tool integrations.
- **The audit trail is the paper trail for the deployment decision.**
  Every stage's outcome — including which self-repair attempts fired and
  what the sandbox found — is timestamped and retrievable per process
  name, so "why was this approved/blocked" is always answerable after the
  fact, not just in the moment.
- **The workflow graph is the contract between backend and frontend**, not
  prose. `WorkflowGraph` validates that every edge references a real node
  id before it's ever returned, so the frontend never has to defend
  against a malformed graph.

## Next phases

- Real MCP/tool integrations behind the same `ToolBinding` contracts
  already declared on each `AgentDef`, replacing the in-memory mocks used
  by both the sandbox and the runtime executor.
- Persisting the audit trail to a real database with tamper-evident
  hashing instead of an append-only local JSONL file.
- An actual deployment target, so `deployment_approved` triggers a real
  rollout instead of only a decision.
