import { useState } from "react";
import { UC1_DefineRequirement, UC2_SynthesizeSystem, UC3_TestAndSandbox, UC4_RuntimeAndReview } from "../diagrams/UseCaseDiagrams";
import {
  SEQ1_RequirementToSpec,
  SEQ2_AgentSynthesisRepair,
  SEQ3_WorkflowSynthesisRepair,
  SEQ4_SandboxExecution,
  SEQ5_RuntimeExecution,
} from "../diagrams/SequenceDiagrams";
import { ClassDiagram } from "../diagrams/ClassDiagram";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 20, background: "#fff" };
const sectionTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "0 0 12px 0" };

type Tab = "overview" | "usecase" | "sequence" | "class";

const tabButton = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px",
  borderRadius: 8,
  border: active ? "1px solid #5b3df0" : "1px solid #ddd",
  background: active ? "#5b3df0" : "#fff",
  color: active ? "#fff" : "#333",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
});

// ---- EDIT THIS SECTION with your real team details before presenting ----
const TEAM = [
  {
    name: "Member 1 name",
    role: "Backend — Synthesis Pipeline",
    contribution:
      "Requirement Analyst, Agent Architect, Policy Engine, and the self-repair loop that feeds deterministic validation issues back into the LLM before anything ships.",
    evidence: "backend/app/synthesis/, backend/tests/test_repair*.py",
  },
  {
    name: "Member 2 name",
    role: "Backend — Sandbox, Runtime & Audit",
    contribution:
      "Sandbox Executor with mock tool calls, the Runtime Executor that plays each agent against sample data, and the Audit Trail module recording every pipeline stage.",
    evidence: "backend/app/sandbox/, backend/app/runtime/, backend/app/synthesis/audit.py",
  },
  {
    name: "Member 3 name",
    role: "Frontend — Dashboard",
    contribution:
      "React + TypeScript dashboard: requirement form, permissions/approval editors, React Flow workflow visualizer, test results view, audit trail view, runtime runner.",
    evidence: "src/components/, src/App.tsx",
  },
  {
    name: "Member 4 name",
    role: "Integration & Assistant Chat",
    contribution:
      "Wired the full pipeline end to end (frontend ↔ FastAPI ↔ Gemini), added the in-app assistant chat, deployment setup and documentation.",
    evidence: "backend/app/assistant/, backend/app/api/synthesize.py, README.md",
  },
];
// ---------------------------------------------------------------------

export default function OverviewPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>ChainReact — Project Overview</h1>
        <p style={{ color: "#666", marginTop: 4 }}>
          An agent-building-agent system: natural-language requirement → validated, tested,
          sandboxed, and audited multi-agent system.
        </p>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button style={tabButton(tab === "overview")} onClick={() => setTab("overview")}>Overview</button>
        <button style={tabButton(tab === "usecase")} onClick={() => setTab("usecase")}>Use Case Diagrams (4)</button>
        <button style={tabButton(tab === "sequence")} onClick={() => setTab("sequence")}>Sequence Diagrams (5)</button>
        <button style={tabButton(tab === "class")} onClick={() => setTab("class")}>Class Diagram</button>
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <h2 style={sectionTitle}>1. Problem, Users &amp; Motivation</h2>
            <p>
              Standing up a multi-agent AI system for a real business process today means manually
              designing agent roles, wiring permissions, building a workflow, and inventing safety
              checks by hand — slow, easy to get wrong, and hard to audit after the fact. Nobody
              wants to hand-author a permission boundary and then trust an LLM not to violate it.
            </p>
            <p>
              <strong>Intended users:</strong> process owners and technical teams who need to stand
              up an agentic workflow (CRM lead management, approvals, onboarding, etc.) quickly,
              with permissions, human-approval points, and safety checks specified up front rather
              than bolted on afterward.
            </p>
            <p>
              <strong>Why we picked it:</strong> most "AI agent" demos stop at prompt → JSON → API
              call. We wanted to build the actual engineering underneath that: requirement
              representation, agent-system synthesis, deterministic policy enforcement, automated
              testing in a sandbox, self-repair, and an audit trail — the parts that make an agent
              system trustworthy enough to actually deploy.
            </p>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>2. Solution &amp; Main User Journey</h2>
            <p>
              A user types a plain-English process requirement and explicitly sets permissions and
              approval gates in the UI (never inferred from prose). ChainReact then:
            </p>
            <ol>
              <li>Parses the requirement into a validated <code>ProcessSpec</code>.</li>
              <li>Synthesizes an <code>AgentArchitecture</code> (single-purpose agents with declared
                inputs/outputs/tools/permissions), self-repairing against a deterministic Policy
                Engine if it oversteps its permission boundary.</li>
              <li>Compiles a <code>WorkflowGraph</code> (agents, tool calls, human-approval gates),
                visualized live with React Flow.</li>
              <li>Generates tests from the spec and runs them in a Sandbox Executor against mock
                tools — no real CRM/email/DB is ever touched.</li>
              <li>Computes a deployment decision (approved/blocked) and records every stage to an
                Audit Trail.</li>
              <li>Optionally runs the process against a real sample input via the Runtime Executor,
                watching real values flow step by step through the graph.</li>
            </ol>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>3 &amp; 4. Live Demo &amp; Integration</h2>
            <p>
              The live demo runs directly from the dashboard (linked in the nav above): a real
              requirement is submitted, hits our FastAPI backend, which calls the Gemini API for
              each synthesis stage, re-validates every LLM output against Pydantic schemas, runs
              deterministic policy/sandbox checks, and returns one unified result rendered live —
              workflow diagram, agent contracts, test results, audit trail, and an interactive
              runtime run, all against the real running system, not fixed sample output.
            </p>
            <p style={{ color: "#666", fontSize: 13 }}>
              Integration points demonstrated live: React frontend ↔ FastAPI backend ↔ Google
              Gemini API (structured outputs) ↔ deterministic Python validation (Pydantic +
              custom policy/sandbox logic) ↔ in-app assistant chat (same LLM client, plain text).
            </p>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>5. Status: Complete, Limited, Next</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <h4 style={{ color: "#1a7f37" }}>Complete</h4>
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  <li>Requirement → ProcessSpec (LLM, structured, validated)</li>
                  <li>Agent Architect + Policy Engine + self-repair loop</li>
                  <li>Workflow Synthesizer + self-repair loop</li>
                  <li>Test generation + Sandbox Executor (mock tools)</li>
                  <li>Audit trail + deployment gate</li>
                  <li>Runtime Executor (real per-agent LLM execution)</li>
                  <li>In-app assistant chat</li>
                </ul>
              </div>
              <div>
                <h4 style={{ color: "#8a6d00" }}>Limited</h4>
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  <li>Tools are mocked (no live CRM/email/DB adapters yet)</li>
                  <li>Audit trail persists to a local JSONL file, not a database</li>
                  <li>Success-condition tests are heuristic/advisory, not exact</li>
                  <li>Single in-memory process at a time, no multi-tenant storage</li>
                </ul>
              </div>
              <div>
                <h4 style={{ color: "#c0341d" }}>Next</h4>
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  <li>Real MCP/tool integrations behind existing ToolBinding contracts</li>
                  <li>Persist audit trail to a real, tamper-evident store</li>
                  <li>An actual deployment target, not just a decision</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>6. Team Contributions</h2>
            <p style={{ fontSize: 12, color: "#999", marginTop: -6 }}>
              (Replace the placeholder names/roles in <code>src/pages/OverviewPage.tsx</code> with
              your actual team before presenting.)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TEAM.map((m, i) => (
                <div key={i} style={{ borderTop: i > 0 ? "1px solid #eee" : undefined, paddingTop: i > 0 ? 12 : 0 }}>
                  <strong>{m.name}</strong> — <span style={{ color: "#5b3df0" }}>{m.role}</span>
                  <p style={{ margin: "4px 0", fontSize: 13 }}>{m.contribution}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Evidence: {m.evidence}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>7. Diagrams</h2>
            <p>
              See the <strong>Use Case Diagrams (4)</strong>, <strong>Sequence Diagrams (5)</strong>,
              and <strong>Class Diagram</strong> tabs above.
            </p>
          </div>
        </div>
      )}

      {tab === "usecase" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <UC1_DefineRequirement />
          <UC2_SynthesizeSystem />
          <UC3_TestAndSandbox />
          <UC4_RuntimeAndReview />
        </div>
      )}

      {tab === "sequence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SEQ1_RequirementToSpec />
          <SEQ2_AgentSynthesisRepair />
          <SEQ3_WorkflowSynthesisRepair />
          <SEQ4_SandboxExecution />
          <SEQ5_RuntimeExecution />
        </div>
      )}

      {tab === "class" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <ClassDiagram />
        </div>
      )}
    </div>
  );
}
