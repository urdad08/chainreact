import { useState } from "react";
import { ApiError, runSandbox, synthesize } from "./api/client";
import AgentList from "./components/AgentList";
import ApprovalGatesEditor from "./components/ApprovalGatesEditor";
import AuditTrailView from "./components/AuditTrailView";
import ChatWidget from "./components/ChatWidget";
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
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 900,
          background: "#f7f7fb",
          borderBottom: "1px solid #e2e2ea",
          padding: "10px 20px",
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <button style={navButton(page === "overview")} onClick={() => setPage("overview")}>
          Project Overview
        </button>
        <button style={navButton(page === "demo")} onClick={() => setPage("demo")}>
          Live Demo
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
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>ChainReact</h1>
        <p style={{ color: "#666", marginTop: 4 }}>
          Requirement → Process Spec → Agents → Workflow → Sandbox → Repair → Audited Deployment Gate
        </p>
      </header>

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
          style={{
            alignSelf: "flex-start",
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: loading ? "#999" : "#5b3df0",
            color: "white",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Synthesizing..." : "Generate Agent System"}
        </button>
      </form>

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

          <WorkflowVisualizer graph={result.workflow} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <ProcessSpecView spec={result.process_spec} validation={result.spec_validation} />
            <AgentList architecture={result.agent_architecture} />
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0 }}>Does this fulfill the requirement?</h3>
                <p style={{ fontSize: 13, color: "#777", margin: "4px 0 0 0" }}>
                  Tests were generated from the spec and the workflow was dry-run through mock tools --
                  no real CRM/email is touched. Re-run any time to double check after edits.
                </p>
              </div>
              <button type="button" onClick={handleRunSandbox} disabled={sandboxLoading} style={secondaryButton}>
                {sandboxLoading ? "Running..." : "Re-run Sandbox"}
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

          <div style={card}>
            <RuntimeRunner result={result} />
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}