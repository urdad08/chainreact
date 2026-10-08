import type { PipelineResult } from "../types/chainreact";

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      style={{
        flex: "1 1 130px",
        minWidth: 110,
        border: "1px solid #e2e2ea",
        borderRadius: 10,
        padding: "12px 16px",
        background: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "#222" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function StatusBar({ result }: { result: PipelineResult }) {
  const toolCount = new Set(
    result.agent_architecture.agents.flatMap((a) => a.tools.map((t) => t.name))
  ).size;
  const approvalGates = result.workflow.nodes.filter((n) => n.type === "human_approval").length;
  const warnings = result.spec_validation.issues.length + result.policy_check.issues.length;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 10px 0" }}>
        Here's what was built, at a glance — <strong>Deployment: Approved</strong> means it's
        safe to use; <strong>Blocked</strong> means something needs fixing first.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Stat label="Agents" value={result.agent_architecture.agents.length} />
        <Stat label="Tools" value={toolCount} />
        <Stat label="Approval gates" value={approvalGates} color={approvalGates ? "#d97706" : undefined} />
        <Stat
          label="Policy check"
          value={result.policy_check.valid ? "Passed" : "Failed"}
          color={result.policy_check.valid ? "#1a7f37" : "#c0341d"}
        />
        <Stat label="Validation notes" value={warnings} color={warnings ? "#8a6d00" : "#1a7f37"} />
        <Stat
          label="Deployment"
          value={result.deployment_approved ? "Approved" : "Blocked"}
          color={result.deployment_approved ? "#1a7f37" : "#c0341d"}
        />
      </div>
    </div>
  );
}
