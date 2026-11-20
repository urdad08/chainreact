# ChainReact

**The agent engineering platform.** Describe a business process in plain
English, and ChainReact turns it into a validated, sandbox-tested,
audited multi-agent system that you can run step by step.

```
"When a new lead comes in, score it, assign it to a salesperson,
 and email them, but ask a manager before sending anything."
                              │
                              ▼
     ProcessSpec → Agents → Workflow → Tests → Audit → Approved / Blocked
```

ChainReact uses Gemini to draft each stage, but it never trusts the model
for correctness. Every LLM output is forced into a Pydantic schema and
re-validated, and permissions, approval gates and deployment decisions
are checked by deterministic Python code.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Using the app](#using-the-app)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Design principles](#design-principles)
- [Limitations and roadmap](#limitations-and-roadmap)
- [Team](#team)

---

## Features

**Synthesis pipeline**
- **Clarification checker**: asks you a question when a request is missing
  something no default can safely fill (for example, which CRM to use).
- **Intent classifier**: decides whether you want an automated process or a
  website, and routes the request to the right generator.
- **Requirement analyst**: turns free text into a structured `ProcessSpec`
  (objective, users, inputs/outputs, trigger, rules, permissions, approval
  gates, failure policy, success conditions, cost/latency/privacy limits).
- **Permission suggester**: proposes the minimum permissions and approval
  gates. These are suggestions only; you confirm them in the UI.
- **Validation engine**: deterministic business-rule checks with no LLM call.
- **Agent architect**: designs single-purpose agents with declared inputs,
  outputs, tools, permissions and memory.
- **Policy engine**: re-checks every agent's permissions against the spec
  and makes sure every tool an agent uses is covered by a permission.
- **Workflow synthesizer**: builds a graph of agents, tools, human approval
  gates and conditional branches.
- **Self-repair**: if the policy or workflow checks fail, the issues are fed
  back to the LLM and it retries (up to 3 times) before anything ships.

**Testing and execution**
- **Sandbox executor**: generates a deterministic test suite and walks the
  workflow against mock tools. Nothing real is touched.
- **Runtime executor**: runs the workflow for real against a sample input.
  It evaluates branch conditions safely (never with `eval`), runs parallel
  branches, pauses at approval gates, and streams each step live to the
  browser.
- **Deployment gate**: a system is approved only if the policy check
  **and** the sandbox run both pass.
- **Audit trail**: every stage is timestamped and saved to
  `backend/audit_log.jsonl`. The trail is reloaded after a restart.

**Integrations and outputs**
- **Google (Gmail and Calendar)**: connect your account with OAuth to run
  real actions, such as labelling emails from a sender or creating events.
- **n8n**: optionally sends a webhook when a system is built, and can
  resume runs that wait on an approval.
- **Lead CSV processing**: upload a CSV of leads, then score, prioritise and
  assign them round-robin and download the enriched file.
- **Operational dashboard generator**: downloads a self-contained HTML page
  that serves as the interface for one specific process.
- **Website generator**: builds a website when the request asks for one.
- **Assistant chat**: an in-app chat that explains ChainReact and AI agents.

**Dashboard**
- Build, review and refine systems in a React web app with a live
  workflow diagram, agent contract cards, test results, audit trail and
  execution history.
- An **About** page with the project overview and UML diagrams (use case,
  sequence and class diagrams), all drawn as inline SVG.

---

## How it works

```
 Natural-language requirement
             │
             ▼
 Clarification Checker ──► asks a question if something critical is missing
             │
             ▼
 Intent Classifier ───────► "website" ──► Website Generator
             │ "process"
             ▼
 Requirement Analyst (LLM) ──► ProcessSpec
             │
             ▼
 Validation Engine (deterministic)
             │
             ▼
 Agent Architect (LLM) ◄──┐
             │            │ self-repair feedback
             ▼            │ (up to 3 attempts)
 Policy Engine (deterministic)
             │
             ▼
 Workflow Synthesizer (LLM) ◄──┐
             │                 │ self-repair feedback
             ▼                 │
 Workflow checks (deterministic)
             │
             ▼
 Sandbox Executor (mock tools) ──► SandboxReport
             │
             ▼
 Audit Trail ──► Deployment decision: APPROVED / BLOCKED
             │
             ▼
 Runtime Executor (optional): runs the workflow against a sample input,
 streaming each step live, pausing at human approval gates
```

---

## Tech stack

| Layer    | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, React Flow, lucide-react           |
| Backend  | Python 3.11+, FastAPI, Pydantic, Uvicorn                      |
| LLM      | Google Gemini via the `google-genai` SDK (structured outputs) |
| Storage  | Local JSON / JSONL files (systems and audit trail)            |
| Deploy   | Docker and Docker Compose                                     |

---

## Quick start

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- A free Gemini API key from https://aistudio.google.com/apikey

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then add your GEMINI_API_KEY
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --reload --port 8000
```

The API runs at http://localhost:8000, with interactive docs at
http://localhost:8000/docs.

### 2. Frontend

From the repository root (the frontend is not in a subfolder):

```bash
npm install
npm run dev
```

Open http://localhost:5173.

### Or run everything with Docker

```bash
export GEMINI_API_KEY=your-key
docker compose up --build
```

---

## Configuration

Backend settings are read from environment variables (see
`backend/.env.example`).

| Variable               | Required | Description                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY`       | Yes      | Your Gemini API key.                                                |
| `CHAINREACT_MODEL`     | No       | Gemini model to use. Default: `gemini-3.5-flash-lite`.              |
| `FRONTEND_ORIGIN`      | No       | Comma-separated extra origins allowed by CORS (for production).     |
| `N8N_WEBHOOK_URL`      | No       | n8n webhook to notify when a system is built.                       |
| `GOOGLE_CLIENT_ID`     | No       | Google OAuth client ID, for Gmail and Calendar.                     |
| `GOOGLE_CLIENT_SECRET` | No       | Google OAuth client secret.                                         |
| `GOOGLE_REDIRECT_URI`  | No       | OAuth callback. Default: `http://localhost:8000/api/integrations/google/callback`. |
| `SLACK_BOT_TOKEN`      | No       | Marks Slack as configured on the Integrations page.                 |

Frontend settings:

| Variable       | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `VITE_API_URL` | Backend URL, set at build time. Default: `http://localhost:8000`. |

---

## Using the app

1. **Build**: open the Build page and describe the process you want
   automated. A CRM lead example is pre-filled.
2. **Review**: confirm the suggested permissions and approval gates, and
   answer any clarification question.
3. **Generate**: ChainReact runs the full pipeline and shows the workflow
   diagram, agents, test results, audit trail and the deployment decision.
4. **Refine**: ask for changes in the refine chat and the system is rebuilt.
5. **Run**: execute the system against a sample input and watch each step
   live, approving gates when asked.
6. **Explore**: browse saved Systems, Executions, Tools, Permissions and
   Integrations from the sidebar, or read the About page for the project
   overview and diagrams.

---

## API reference

All endpoints are under `/api`. Full request and response schemas are at
`/docs` when the backend is running.

| Method | Endpoint                               | Purpose                                   |
| ------ | -------------------------------------- | ----------------------------------------- |
| POST   | `/synthesize`                          | Run the full pipeline                     |
| POST   | `/requirement/parse`                   | Requirement → ProcessSpec                 |
| POST   | `/requirement/validate`                | Validate a ProcessSpec                    |
| POST   | `/permissions/suggest`                 | Suggest permissions and approval gates    |
| POST   | `/agents/synthesize`                   | ProcessSpec → AgentArchitecture           |
| POST   | `/workflow/synthesize`                 | Agents → WorkflowGraph                    |
| POST   | `/sandbox/run`                         | Run the test suite against mock tools     |
| POST   | `/runtime/execute`                     | Simulated run against a sample input      |
| POST   | `/build/plan`, `/build/website`        | Website build flow                        |
| POST   | `/dashboard/generate`                  | Download an operational dashboard (HTML)  |
| POST   | `/leads/score`, `/leads/process-csv`   | Lead scoring and CSV processing           |
| POST   | `/chat`                                | Assistant chat                            |
| GET    | `/systems`, `/systems/{id}`            | Saved systems                             |
| GET    | `/tools`                               | Tool registry (real vs simulated)         |
| GET    | `/audit/{process_name}`                | Audit trail for a process                 |
| POST   | `/n8n/notify`, `/n8n/agent-step`, `/n8n/approval/resume` | n8n integration |
| POST   | `/execution/start`                     | Start a live run                          |
| GET    | `/execution/{run_id}`, `/execution/{run_id}/stream` | Run status and live updates (SSE) |
| POST   | `/execution/{run_id}/approve`          | Approve or reject a paused approval gate  |
| GET    | `/integrations/status`                 | Integration status                        |
| GET    | `/integrations/google/connect`, `/integrations/google/callback`, `/integrations/google/status` | Google OAuth |
| POST   | `/integrations/google/disconnect`      | Disconnect Google                         |
| POST   | `/integrations/gmail/label-sender`     | Label Gmail messages from a sender        |
| GET/POST | `/integrations/calendar/events`      | List or create Calendar events            |

---

## Project structure

```
chainreact/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app and CORS
│   │   ├── api/               synthesize, execution (live runs), integrations
│   │   ├── assistant/         Assistant chat
│   │   ├── core/              Structured-output Gemini client
│   │   ├── integrations/      Google OAuth, Gmail and Calendar actions
│   │   ├── runtime/           Workflow executor, safe condition evaluator, run store
│   │   ├── sandbox/           Mock tools and sandbox executor
│   │   ├── schemas/           Pydantic models (ProcessSpec, agents, workflow, ...)
│   │   ├── synthesis/         Pipeline stages, policy, repair, audit, generators
│   │   ├── testing/           Test generation and test runner
│   │   └── tools/             Tool registry (real vs simulated tools)
│   ├── tests/                 pytest suite
│   ├── requirements.txt
│   └── Dockerfile
├── src/                       React frontend
│   ├── api/                   API client
│   ├── components/            UI components (workflow diagram, editors, chat, ...)
│   ├── diagrams/              UML diagrams for the About page (inline SVG)
│   ├── layout/                Sidebar and app shell
│   ├── lib/                   Router, formatting, theme, hooks
│   ├── pages/                 Build, Systems, Executions, Tools, About, ...
│   ├── types/                 TypeScript types mirroring the Pydantic schemas
│   └── ui/                    Shared UI primitives
├── docker-compose.yml
├── Dockerfile                 Frontend image
├── index.html
├── package.json
└── vite.config.ts
```

---

## Testing

Backend tests use pytest:

```bash
cd backend
pytest tests/ -v
```

Most tests are deterministic and need no API key. Some tests (such as the
repair-loop and runtime tests) may call Gemini, so set `GEMINI_API_KEY`
before running the full suite.

Frontend type-check and production build:

```bash
npm run build
```

---

## Design principles

- **Structured outputs, not prompt-and-hope.** Every LLM response is
  parsed into the exact Pydantic model and re-validated. If validation
  fails, the error is sent back so the model can correct itself.
- **Security checks are deterministic.** The policy engine, not the LLM,
  decides whether an agent's permissions are allowed.
- **Repair before shipping.** Problems are fixed inside the synthesis loop,
  so a broken first draft never reaches the user.
- **Sandbox and runtime are separate on purpose.** The sandbox is fast,
  reproducible and never calls the LLM; it gates deployment. The runtime
  shows real data flowing through the process.
- **Honest about what is real.** The tool registry marks each tool as real
  or simulated, and the runtime reports simulated calls as simulated.
- **Everything is auditable.** Every stage, including self-repair attempts,
  is recorded so you can always answer "why was this approved or blocked?"

---

## Limitations and roadmap

**Current limitations**
- Most tools (CRM, generic email, payments) are simulated. Only Gmail and
  Google Calendar make real calls.
- Systems and the audit trail are stored in local JSON files, not a
  database.
- An approved system gets a deployment decision, not an automatic rollout.

**Next steps**
- Real tool integrations (for example via MCP) behind the existing tool
  contracts.
- Database storage with a tamper-evident audit trail.
- A real deployment target triggered by the deployment gate.

---

## Team

| Name         |
| ------------ |
| Nilesh Jain  |
| Aksh Chawla  |
| Aniket Verma |
| Adesh Pratap |

Team roles are listed on the About page (`src/pages/OverviewPage.tsx`).
