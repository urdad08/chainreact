import { useEffect, useState } from "react";
import { ApiError, runSandbox, synthesize } from "./api/client";
import AgentList from "./components/AgentList";
import ApprovalGatesEditor from "./components/ApprovalGatesEditor";
import AuditTrailView from "./components/AuditTrailView";
import ChatWidget from "./components/ChatWidget";
import DashboardDownload from "./components/DashboardDownload";
import HelpTip from "./components/HelpTip";
import PermissionsEditor, { PermissionState } from "./components/PermissionsEditor";
import ProcessSpecView from "./components/ProcessSpecView";
import RequirementForm, { EXAMPLE_REQUIREMENT } from "./components/RequirementForm";
import RuntimeRunner from "./components/RuntimeRunner";
import StatusBar from "./components/StatusBar";
import TestResults from "./components/TestResults";
import WorkflowVisualizer from "./components/WorkflowVisualizer";
import OverviewPage from "./pages/OverviewPage";
import type { ApiErrorDetail, PipelineResult, SandboxReport } from "./types/chainreact";

const card: React.CSSProperties = {
  border: "1px solid #e2e2ea",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #5b3df0",
  background: "#fff",
  color: "#5b3df0",
  fontWeight: 600,
  cursor: "pointer",
};

const navButton = (active: boolean): React.CSSProperties => ({
  padding: "8px 18px",
  borderRadius: 8,
  border: active ? "1px solid #5b3df0" : "1px solid #ddd",
  background: active ? "#5b3df0" : "#fff",
  color: active ? "#fff" : "#333",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
});

export default function App() {
  const [page, setPage] = useState<"overview" | "demo">("overview");

  return (
    <>
      <div className="cr-nav">
        <button style={navButton(page === "overview")} onClick={() => setPage("overview")}>
          About this project
        </button>
        <button style={navButton(page === "demo")} onClick={() => setPage("demo")}>
          Try it
        </button>
      </div>
      {page === "overview" ? <OverviewPage /> : <LiveDemo />}
    </>
  );
}

function LiveDemo() {
  const [requirement, setRequirement] = useState(EXAMPLE_REQUIREMENT);
  const [permissions, setPermissions] = useState<PermissionState>({
    allowed: ["crm.read", "crm.write"],
    forbidden: ["crm.delete"],
  });
  const [approvalActions, setApprovalActions] = useState<string[]>(["email.send"]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxReport, setSandboxReport] = useState<SandboxReport | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // The backend runs on a free-tier host that spins down when idle, so the
  // first request after inactivity can take 30-60s just to wake up before
  // any real work happens. Show a reassuring hint after a few seconds
  // rather than leaving the person staring at a plain spinner wondering if
  // it's broken.
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowColdStartHint(false);
      return;
    }
    const timer = setTimeout(() => setShowColdStartHint(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirement.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSandboxReport(null);
    setSandboxError(null);
    try {
      const res = await synthesize({
        requirement: requirement.trim(),
        allowedPermissions: permissions.allowed,
        forbiddenPermissions: permissions.forbidden,
        approvalActions,
      });
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.detail);
      } else {
        setError({ message: e instanceof Error ? e.message : "Unknown error", issues: [] });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSandbox() {
    if (!result) return;
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      const report = await runSandbox(result);
      setSandboxReport(report);
    } catch (e) {
      setSandboxError(e instanceof Error ? e.message : "Sandbox run failed");
    } finally {
      setSandboxLoading(false);
    }
  }

  return (
    <div className="cr-page">
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 32px)" }}>ChainReact</h1>
        <p style={{ color: "#555", marginTop: 6, fontSize: 15, lineHeight: 1.5 }}>
          Describe a business task in plain English, and ChainReact builds a small team of
          automated helpers (we call them "agents") to do it — then tests that it works safely
          before you rely on it.
        </p>
      </header>

      <div style={{ ...card, marginBottom: 20, background: "#faf9ff", borderColor: "#e3defc" }}>
        <strong style={{ fontSize: 15 }}>How it works — 4 easy steps</strong>
        <div className="cr-guide-steps" style={{ marginTop: 12 }}>
          {[
            ["1", "Describe it", "Write what you want automated, in your own words."],
            ["2", "Set the limits", "Choose what it may touch, and what needs a person's okay first."],
            ["3", "Click Generate", "ChainReact designs the helpers and tests them for you."],
            ["4", "Review & try it", "Check the results, then run it on a sample or download it as a mini app."],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#5b3df0",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {num}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "12px 0 0 0" }}>
          Tip: the form below is pre-filled with an example (a sales-lead process), so you can
          just click <strong>Generate</strong> to see how it works. Look for the little{" "}
          <span className="cr-help-badge" style={{ display: "inline-flex", cursor: "default" }}>?</span>{" "}
          icons anywhere you'd like something explained.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={card}>
          <RequirementForm value={requirement} onChange={setRequirement} />
        </div>

        <div style={card}>
          <PermissionsEditor value={permissions} onChange={setPermissions} />
        </div>

        <div style={card}>
          <ApprovalGatesEditor
            value={approvalActions}
            onChange={setApprovalActions}
            candidateActions={permissions.allowed}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !requirement.trim()}
          className="cr-btn cr-btn-primary"
          style={{
            alignSelf: "flex-start",
            fontSize: 16,
            padding: "12px 28px",
            background: loading ? "#999" : "#5b3df0",
            borderColor: loading ? "#999" : "#5b3df0",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Building your system..." : "Step 4 — Generate"}
        </button>
      </form>

      {loading && (
        <p style={{ marginTop: 10, fontSize: 14, color: "#8a6d00", lineHeight: 1.5 }}>
          {showColdStartHint
            ? "Still working — the service sleeps when nobody's using it, so the first request can take up to a minute to wake up. Hang tight, nothing is wrong."
            : "Building your system... this usually takes 10–30 seconds."}
        </p>
      )}

      {error && (
        <div
          style={{
            marginTop: 20,
            border: "1px solid #f3c6c1",
            background: "#fff5f4",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <strong style={{ color: "#c0341d" }}>{error.message}</strong>
          {error.issues.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {error.issues.map((issue, i) => (
                <li key={i} style={{ color: issue.severity === "error" ? "#c0341d" : "#8a6d00" }}>
                  [{issue.severity}] {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          )}
          {error.retryable && (
            <button
              type="button"
              onClick={handleSubmit as unknown as () => void}
              style={{ ...secondaryButton, marginTop: 12 }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          <StatusBar result={result} />

          {result.repair_log.length > 0 && (
            <div
              style={{
                border: "1px solid #cfe0fd",
                background: "#f3f8ff",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <strong style={{ color: "#1a56db", fontSize: 14 }}>
                🔧 Self-repair log ({result.repair_log.length} event{result.repair_log.length > 1 ? "s" : ""})
              </strong>
              <ul style={{ margin: "8px 0 0 0", fontSize: 13, color: "#333" }}>
                {result.repair_log.map((entry, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 6 }}>
              The plan, step by step
              <HelpTip text="This is a map of what happens, in order. Each box is one step. Boxes marked as needing approval will pause and wait for a person before continuing. Drag to move around, scroll to zoom." />
            </h3>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 10px 0" }}>
              Follow the arrows from start to finish.
            </p>
            <WorkflowVisualizer graph={result.workflow} />
          </div>

          <div>
            <h3 style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 6 }}>
              What was built
              <HelpTip text="On the left: a summary of your request as ChainReact understood it. On the right: the automated helpers (agents) it created, what each one is responsible for, and what each is allowed to touch." />
            </h3>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 10px 0" }}>
              Check that this matches what you meant. If not, tweak your description above and generate again.
            </p>
            <div className="cr-grid-2">
              <ProcessSpecView spec={result.process_spec} validation={result.spec_validation} />
              <AgentList architecture={result.agent_architecture} />
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  Safety check: does it do what you asked?
                  <HelpTip text="ChainReact automatically wrote a set of tests from your request and ran the whole process against pretend (fake) tools — nothing real, like an actual CRM or email, was touched. Green means a check passed; red means something needs attention." />
                </h3>
                <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0 0" }}>
                  Tested using pretend data — nothing real was changed or sent. You can re-run the
                  check any time.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunSandbox}
                disabled={sandboxLoading}
                className="cr-btn cr-btn-secondary"
              >
                {sandboxLoading ? "Checking..." : "Re-run check"}
              </button>
            </div>

            {sandboxError && (
              <div style={{ marginTop: 12, color: "#c0341d", fontSize: 13 }}>{sandboxError}</div>
            )}

            <div style={{ marginTop: 16 }}>
              <TestResults report={sandboxReport ?? result.sandbox_report} />
            </div>
          </div>

          <AuditTrailView trail={result.audit_trail} />

          <DashboardDownload result={result} />

          <div style={card}>
            <RuntimeRunner result={result} />
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}