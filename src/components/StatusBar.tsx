import type { ReactNode } from "react";
import { AlertTriangle, Bot, CheckCircle2, ShieldCheck, ShieldOff, ShieldQuestion, Wrench, XCircle } from "lucide-react";
import type { PipelineResult } from "../types/chainreact";

function Tile({ label, value, icon, color }: { label: string; value: ReactNode; icon: ReactNode; color?: string }) {
  return (
    <div className="card stat" style={{ padding: "var(--sp-3) var(--sp-4)", gap: 4, minWidth: 0 }}>
      <span className="stat-label" style={{ fontSize: 12 }}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="stat-value" style={{ fontSize: 20, color: color ?? "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export default function StatusBar({ result }: { result: PipelineResult }) {
  const toolCount = new Set(result.agent_architecture.agents.flatMap((a) => a.tools.map((t) => t.name))).size;
  const approvalGates = result.workflow.nodes.filter((n) => n.type === "human_approval").length;
  const warnings = result.spec_validation.issues.length + result.policy_check.issues.length;
  const approved = result.deployment_approved;

  return (
    <div className="stack gap-3" style={{ minWidth: 0 }}>
      <div
        className="row wrap gap-3"
        style={{
          justifyContent: "space-between",
          padding: "var(--sp-3) var(--sp-4)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: approved ? "var(--success-soft)" : "var(--danger-soft)",
        }}
      >
        <div className="row gap-2" style={{ minWidth: 0, color: approved ? "var(--success)" : "var(--danger)" }}>
          {approved ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
          <span style={{ fontWeight: 600 }}>{approved ? "Deployment approved" : "Deployment blocked"}</span>
        </div>
        <span className="text-sm text-secondary" style={{ minWidth: 0 }}>
          {approved ? "All checks passed. This system is safe to use." : "Something needs fixing before this system can run."}
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "var(--sp-3)" }}>
        <Tile label="Agents" value={result.agent_architecture.agents.length} icon={<Bot size={13} />} />
        <Tile label="Tools" value={toolCount} icon={<Wrench size={13} />} />
        <Tile
          label="Approval gates"
          value={approvalGates}
          icon={<ShieldQuestion size={13} />}
          color={approvalGates ? "var(--warning)" : undefined}
        />
        <Tile
          label="Policy check"
          value={result.policy_check.valid ? "Passed" : "Failed"}
          icon={result.policy_check.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          color={result.policy_check.valid ? "var(--success)" : "var(--danger)"}
        />
        <Tile
          label="Validation notes"
          value={warnings}
          icon={<AlertTriangle size={13} />}
          color={warnings ? "var(--warning)" : undefined}
        />
      </div>
    </div>
  );
}
