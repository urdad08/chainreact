import { ArrowRight, Brain, KeyRound, Wrench } from "lucide-react";
import type { AgentArchitecture, AgentDef } from "../types/chainreact";
import { Badge } from "../ui/primitives";
import { NodeStatusBadge, type NodeRunStatus } from "../ui/status";
import { humanize } from "../lib/format";

const AVATAR_TINTS = ["var(--accent)", "var(--cyan)", "var(--text-tertiary)"];
const SENSITIVE_PERMISSION = /delete|remove|destroy|payment|pay\b|charge|refund|transfer|send|publish/i;

const MEMORY_LABEL: Record<AgentDef["memory"]["type"], string> = {
  none: "No memory",
  short_term: "Short-term memory",
  long_term: "Long-term memory",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function monogram(id: string): string {
  const words = humanize(id).split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function MonoChip({ children, tone }: { children: string; tone?: "warning" }) {
  return (
    <span
      className="chip mono"
      title={children}
      style={{
        fontSize: 11,
        height: 22,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "inline-block",
        lineHeight: "20px",
        ...(tone === "warning"
          ? { background: "var(--warning-soft)", color: "var(--warning)", borderColor: "transparent" }
          : null),
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="row gap-1 text-xs text-tertiary" style={{ fontWeight: 550 }}>
      {icon}
      {children}
    </span>
  );
}

function AgentCard({ agent, status }: { agent: AgentDef; status?: NodeRunStatus }) {
  const tint = AVATAR_TINTS[hash(agent.id) % AVATAR_TINTS.length];
  return (
    <div className="card stack gap-4" style={{ padding: "var(--sp-4) var(--sp-5)", minWidth: 0 }}>
      <div className="row gap-3" style={{ alignItems: "flex-start", minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "var(--r-md)",
            background: "var(--surface-2)",
            border: `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`,
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {monogram(agent.id)}
        </span>
        <div className="stack grow" style={{ gap: 2 }}>
          <span className="truncate" style={{ fontWeight: 600 }} title={humanize(agent.id)}>
            {humanize(agent.id)}
          </span>
          <span className="mono text-xs text-tertiary truncate" title={agent.id}>
            {agent.id}
          </span>
        </div>
        <span style={{ flexShrink: 0 }}>
          {status ? <NodeStatusBadge status={status} /> : <Badge>Ready</Badge>}
        </span>
      </div>

      {agent.purpose && (
        <p className="text-sm text-secondary" style={{ lineHeight: 1.55 }}>
          {agent.purpose}
        </p>
      )}

      <div className="stack gap-2">
        <SectionLabel>Inputs → Outputs</SectionLabel>
        <div className="row wrap gap-1" style={{ minWidth: 0 }}>
          {agent.inputs.length ? agent.inputs.map((x) => <MonoChip key={`in-${x}`}>{x}</MonoChip>) : <span className="text-xs text-tertiary">—</span>}
          <ArrowRight size={13} className="text-tertiary" style={{ margin: "0 2px" }} />
          {agent.outputs.length ? agent.outputs.map((x) => <MonoChip key={`out-${x}`}>{x}</MonoChip>) : <span className="text-xs text-tertiary">—</span>}
        </div>
      </div>

      {agent.tools.length > 0 && (
        <div className="stack gap-2">
          <SectionLabel icon={<Wrench size={11} />}>Tools</SectionLabel>
          <div className="row wrap gap-1">
            {agent.tools.map((t, i) => (
              <span key={`${t.name}-${i}`} className="chip text-xs" style={{ maxWidth: "100%", minWidth: 0 }} title={`${t.name}: ${t.operations.join(", ")}`}>
                <span style={{ color: "var(--text)", fontWeight: 550 }}>{t.name}</span>
                {t.operations.length > 0 && (
                  <span className="mono truncate text-tertiary" style={{ fontSize: 10.5 }}>
                    {t.operations.join(", ")}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="stack gap-2">
        <SectionLabel icon={<KeyRound size={11} />}>Permissions</SectionLabel>
        <div className="row wrap gap-1">
          {agent.permissions.length ? (
            agent.permissions.map((p) => (
              <MonoChip key={p} tone={SENSITIVE_PERMISSION.test(p) ? "warning" : undefined}>
                {p}
              </MonoChip>
            ))
          ) : (
            <span className="text-xs text-tertiary">None</span>
          )}
        </div>
      </div>

      <div className="row gap-2 text-xs text-tertiary" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--sp-3)" }}>
        <Brain size={12} />
        {MEMORY_LABEL[agent.memory.type] ?? humanize(agent.memory.type)}
      </div>
    </div>
  );
}

export default function AgentList({
  architecture,
  agentStatus,
}: {
  architecture: AgentArchitecture;
  agentStatus?: Record<string, NodeRunStatus>;
}) {
  const count = architecture.agents.length;
  return (
    <div className="stack gap-3" style={{ minWidth: 0 }}>
      <div className="row gap-2">
        <h3 style={{ fontSize: 14 }}>Agents</h3>
        <Badge>{count}</Badge>
      </div>
      {count === 0 ? (
        <div className="card card-pad text-sm text-tertiary">No agents in this architecture.</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: "var(--sp-3)" }}>
          {architecture.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} status={agentStatus?.[agent.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
