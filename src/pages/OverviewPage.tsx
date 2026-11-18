import { useState } from "react";
import { ArrowRight, BookOpen, Boxes, CheckCircle2, CircleDashed, GitBranch, Network, Users, Workflow } from "lucide-react";
import { UC1_DefineRequirement, UC2_SynthesizeSystem, UC3_TestAndSandbox, UC4_RuntimeAndReview } from "../diagrams/UseCaseDiagrams";
import {
  SEQ1_RequirementToSpec,
  SEQ2_AgentSynthesisRepair,
  SEQ3_WorkflowSynthesisRepair,
  SEQ4_SandboxExecution,
  SEQ5_RuntimeExecution,
} from "../diagrams/SequenceDiagrams";
import { ClassDiagram } from "../diagrams/ClassDiagram";
import { Badge, Button, PageHeader, Tabs, type TabDef } from "../ui/primitives";
import { navigate, routeHref } from "../lib/router";

type Tab = "overview" | "usecase" | "sequence" | "class";

const TABS: TabDef<Tab>[] = [
  { id: "overview", label: "Overview", icon: <BookOpen size={14} /> },
  { id: "usecase", label: "Use case diagrams", icon: <Users size={14} />, count: 4 },
  { id: "sequence", label: "Sequence diagrams", icon: <GitBranch size={14} />, count: 5 },
  { id: "class", label: "Class diagram", icon: <Boxes size={14} /> },
];

// ---- EDIT THIS SECTION with your real team details before presenting ----
const TEAM = [
  {
    name: "Nilesh Jain",
    role: "Backend: Synthesis Pipeline",
    contribution:
      "Requirement Analyst, Agent Architect, Policy Engine, and the self-repair loop that feeds deterministic validation issues back into the LLM before anything ships.",
    evidence: "backend/app/synthesis/, backend/tests/test_repair*.py",
  },
  {
    name: "Aksh Chawla",
    role: "Backend: Sandbox, Runtime & Audit",
    contribution:
      "Sandbox Executor with mock tool calls, the Runtime Executor that plays each agent against sample data, and the Audit Trail module recording every pipeline stage.",
    evidence: "backend/app/sandbox/, backend/app/runtime/, backend/app/synthesis/audit.py",
  },
  {
    name: "Aniket Verma",
    role: "Frontend: Dashboard",
    contribution:
      "React + TypeScript dashboard: requirement form, permissions/approval editors, React Flow workflow visualizer, test results view, audit trail view, runtime runner.",
    evidence: "src/components/, src/App.tsx",
  },
  {
    name: "Adesh Pratap",
    role: "Integration & Assistant Chat",
    contribution:
      "Wired the full pipeline end to end (frontend ↔ FastAPI ↔ Gemini), added the in-app assistant chat, deployment setup and documentation.",
    evidence: "backend/app/assistant/, backend/app/api/synthesize.py, README.md",
  },
];
// ---------------------------------------------------------------------

const PROSE: React.CSSProperties = { maxWidth: 760, lineHeight: 1.7, color: "var(--text-secondary)" };

function DocSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad stack gap-3" style={{ minWidth: 0 }}>
      <div className="row gap-3" style={{ alignItems: "baseline" }}>
        <span className="mono text-xs text-tertiary" style={{ flexShrink: 0 }}>
          {number}
        </span>
        <h2 style={{ fontSize: "var(--fs-md)" }}>{title}</h2>
      </div>
      <div className="stack gap-3 cr-doc-prose" style={PROSE}>
        {children}
      </div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function StatusColumn({ tone, icon, title, items }: { tone: "success" | "warning" | "cyan"; icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="card card-muted" style={{ padding: "var(--sp-4)", minWidth: 0 }}>
      <div className="row gap-2" style={{ marginBottom: 10 }}>
        <Badge tone={tone}>
          {icon}
          {title}
        </Badge>
        <span className="text-xs text-tertiary">{items.length}</span>
      </div>
      <ul className="stack gap-1 text-sm" style={{ margin: 0, paddingLeft: 16, color: "var(--text)" }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/** Diagram SVGs use fixed light colors, so they sit on a light-scoped "paper" surface that stays legible in dark mode. */
function DiagramPaper({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="light"
      className="stack gap-5"
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--sp-5)",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export default function OverviewPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="cr-page">
      <style>{`
        .cr-doc-prose strong { color: var(--text); font-weight: 600; }
        .cr-doc-prose code { padding: 1px 5px; border-radius: 4px; background: var(--surface-3); color: var(--text); font-size: 0.86em; }
        .cr-doc-prose ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
        .cr-doc-prose ol li::marker { color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
      `}</style>

      <PageHeader
        eyebrow="About ChainReact"
        title="Project overview"
        description={
          <>
            You describe a business task in plain English, and ChainReact builds, tests, and safety-checks a small team of
            automated helpers to do it, and then lets you try it out.
          </>
        }
        actions={
          <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => navigate("/build")}>
            Try it
          </Button>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div className="tab-panel" key={tab}>
        {tab === "overview" && (
          <div className="stack gap-4">
            <div className="card card-accent card-pad row gap-4 wrap" style={{ alignItems: "flex-start" }}>
              <span
                className="row"
                style={{
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: "var(--r-md)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <Network size={18} />
              </span>
              <div className="stack gap-1 grow" style={{ flexBasis: 260 }}>
                <strong>An agent-building-agent system</strong>
                <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                  Natural-language requirement → validated, tested, sandboxed, and audited multi-agent system. Open{" "}
                  <a href={routeHref("/build")}>Build</a> to see it work.
                </p>
              </div>
            </div>

            <DocSection number="01" title="Problem, users & motivation">
              <p>
                Standing up a multi-agent AI system for a real business process today means manually designing agent roles,
                wiring permissions, building a workflow, and inventing safety checks by hand: slow, easy to get wrong, and
                hard to audit after the fact. Nobody wants to hand-author a permission boundary and then trust an LLM not to
                violate it.
              </p>
              <p>
                <strong>Intended users:</strong> process owners and technical teams who need to stand up an agentic workflow
                (CRM lead management, approvals, onboarding, etc.) quickly, with permissions, human-approval points, and
                safety checks specified up front rather than bolted on afterward.
              </p>
              <p>
                <strong>Why we picked it:</strong> most "AI agent" demos stop at prompt → JSON → API call. We wanted to build
                the actual engineering underneath that: requirement representation, agent-system synthesis, deterministic
                policy enforcement, automated testing in a sandbox, self-repair, and an audit trail: the parts that make an
                agent system trustworthy enough to actually deploy.
              </p>
            </DocSection>

            <DocSection number="02" title="Solution & main user journey">
              <p>
                A user types a plain-English process requirement and explicitly sets permissions and approval gates in the UI
                (never inferred from prose). ChainReact then:
              </p>
              <ol>
                <li>
                  Parses the requirement into a validated <code>ProcessSpec</code>.
                </li>
                <li>
                  Synthesizes an <code>AgentArchitecture</code> (single-purpose agents with declared
                  inputs/outputs/tools/permissions), self-repairing against a deterministic Policy Engine if it oversteps its
                  permission boundary.
                </li>
                <li>
                  Compiles a <code>WorkflowGraph</code> (agents, tool calls, human-approval gates), visualized live with React
                  Flow.
                </li>
                <li>
                  Generates tests from the spec and runs them in a Sandbox Executor against mock tools; no real CRM/email/DB
                  is ever touched.
                </li>
                <li>Computes a deployment decision (approved/blocked) and records every stage to an Audit Trail.</li>
                <li>
                  Optionally runs the process against a real sample input via the Runtime Executor, watching real values flow
                  step by step through the graph.
                </li>
                <li>
                  Generates an actual, standalone <strong>operational dashboard</strong> for this specific process: a real,
                  deployable HTML page (its own read-only summary of the agents/workflow/approval gates, an input form built
                  from exactly this process's declared fields, and buttons to run it or re-check it) that talks to the live
                  ChainReact backend. This is the "bounded operational dashboard" the brief calls for, not a mockup:
                  download it and open it in any browser.
                </li>
              </ol>
            </DocSection>

            <DocSection number="03 / 04" title="Live demo & integration">
              <p>
                The live demo runs directly from the <a href={routeHref("/build")}>Build</a> page: a real requirement is
                submitted, hits our FastAPI backend, which calls the Gemini API for each synthesis stage, re-validates every
                LLM output against Pydantic schemas, runs deterministic policy/sandbox checks, and returns one unified result
                rendered live: workflow diagram, agent contracts, test results, audit trail, and an interactive runtime run,
                all against the real running system, not fixed sample output.
              </p>
              <span className="eyebrow">Integration points demonstrated live</span>
              <div className="row gap-2 wrap">
                {[
                  "React frontend",
                  "FastAPI backend",
                  "Google Gemini API (structured outputs)",
                  "Deterministic Python validation (Pydantic + policy/sandbox)",
                  "In-app assistant chat (same LLM client, plain text)",
                ].map(
                  (label, i, arr) => (
                    <span key={label} className="row gap-2">
                      <span className="chip" style={{ fontFamily: "var(--font-sans)", whiteSpace: "normal", height: "auto", minHeight: 24, padding: "3px 8px" }}>
                        {label}
                      </span>
                      {i < arr.length - 1 && <span className="text-tertiary">↔</span>}
                    </span>
                  )
                )}
              </div>
            </DocSection>

            <section className="card card-pad stack gap-4">
              <div className="row gap-3" style={{ alignItems: "baseline" }}>
                <span className="mono text-xs text-tertiary">05</span>
                <h2 style={{ fontSize: "var(--fs-md)" }}>Status: complete, limited, next</h2>
              </div>
              <div className="grid grid-3" style={{ gap: "var(--sp-3)" }}>
                <StatusColumn
                  tone="success"
                  icon={<CheckCircle2 size={12} />}
                  title="Complete"
                  items={[
                    "Requirement → ProcessSpec (LLM, structured, validated)",
                    "Agent Architect + Policy Engine + self-repair loop",
                    "Workflow Synthesizer + self-repair loop",
                    "Test generation + Sandbox Executor (mock tools)",
                    "Audit trail + deployment gate",
                    "Runtime Executor (real per-agent LLM execution)",
                    "Generated operational dashboard (standalone HTML app per process)",
                    "In-app assistant chat",
                  ]}
                />
                <StatusColumn
                  tone="warning"
                  icon={<CircleDashed size={12} />}
                  title="Limited"
                  items={[
                    "Tools are mocked (no live CRM/email/DB adapters yet)",
                    "Audit trail persists to a local JSONL file, not a database",
                    "Success-condition tests are heuristic/advisory, not exact",
                    "Single in-memory process at a time, no multi-tenant storage",
                  ]}
                />
                <StatusColumn
                  tone="cyan"
                  icon={<ArrowRight size={12} />}
                  title="Next"
                  items={[
                    "Real MCP/tool integrations behind existing ToolBinding contracts",
                    "Persist audit trail to a real, tamper-evident store",
                    "An actual deployment target, not just a decision",
                  ]}
                />
              </div>
            </section>

            <section className="card card-pad stack gap-4">
              <div className="stack gap-1">
                <div className="row gap-3" style={{ alignItems: "baseline" }}>
                  <span className="mono text-xs text-tertiary">06</span>
                  <h2 style={{ fontSize: "var(--fs-md)" }}>Team contributions</h2>
                </div>
                <p className="text-xs text-tertiary">
                  Team details live in <code className="mono">src/pages/OverviewPage.tsx</code>; update them there before
                  presenting.
                </p>
              </div>
              <div className="grid grid-2" style={{ gap: "var(--sp-3)" }}>
                {TEAM.map((m) => (
                  <div key={m.name} className="card card-muted stack gap-3" style={{ padding: "var(--sp-4)", minWidth: 0 }}>
                    <div className="row gap-3" style={{ minWidth: 0 }}>
                      <span className="avatar" aria-hidden>
                        {initials(m.name)}
                      </span>
                      <div className="stack" style={{ minWidth: 0, lineHeight: 1.3 }}>
                        <strong className="truncate">{m.name}</strong>
                        <span className="text-sm text-accent truncate">{m.role}</span>
                      </div>
                    </div>
                    <p className="text-sm" style={{ lineHeight: 1.6 }}>
                      {m.contribution}
                    </p>
                    <div className="row gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
                      <span className="text-xs text-tertiary" style={{ flexShrink: 0, paddingTop: 1 }}>
                        Evidence
                      </span>
                      <span className="mono text-xs text-secondary" style={{ overflowWrap: "anywhere", minWidth: 0 }}>
                        {m.evidence}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card-pad stack gap-3">
              <div className="row gap-3" style={{ alignItems: "baseline" }}>
                <span className="mono text-xs text-tertiary">07</span>
                <h2 style={{ fontSize: "var(--fs-md)" }}>Diagrams</h2>
              </div>
              <p className="text-secondary">UML diagrams for the system, drawn from the implemented pipeline.</p>
              <div className="row gap-2 wrap">
                <Button size="sm" icon={<Users size={14} />} onClick={() => setTab("usecase")}>
                  Use case diagrams (4)
                </Button>
                <Button size="sm" icon={<Workflow size={14} />} onClick={() => setTab("sequence")}>
                  Sequence diagrams (5)
                </Button>
                <Button size="sm" icon={<Boxes size={14} />} onClick={() => setTab("class")}>
                  Class diagram
                </Button>
              </div>
            </section>
          </div>
        )}

        {tab === "usecase" && (
          <DiagramPaper>
            <UC1_DefineRequirement />
            <UC2_SynthesizeSystem />
            <UC3_TestAndSandbox />
            <UC4_RuntimeAndReview />
          </DiagramPaper>
        )}

        {tab === "sequence" && (
          <DiagramPaper>
            <SEQ1_RequirementToSpec />
            <SEQ2_AgentSynthesisRepair />
            <SEQ3_WorkflowSynthesisRepair />
            <SEQ4_SandboxExecution />
            <SEQ5_RuntimeExecution />
          </DiagramPaper>
        )}

        {tab === "class" && (
          <DiagramPaper>
            <ClassDiagram />
          </DiagramPaper>
        )}
      </div>
    </div>
  );
}
