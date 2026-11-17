import { Bot, Clock, GitBranch, ShieldCheck } from "lucide-react";
import { Badge, Card, Chip } from "../../ui/primitives";
import { RunStatusBadge } from "../../ui/status";
import { navigate } from "../../lib/router";
import { formatRelativeTime, shortId } from "../../lib/format";
import type { ExecutionSummary, StoredSystemSummary } from "../../types/chainreact";

/** Latest execution per system_id, by created_at. */
export function latestRunBySystem(runs: ExecutionSummary[] | null | undefined): Map<string, ExecutionSummary> {
  const map = new Map<string, ExecutionSummary>();
  for (const r of runs ?? []) {
    const prev = map.get(r.system_id);
    if (!prev || new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()) map.set(r.system_id, r);
  }
  return map;
}

export const clamp2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export function SystemCard({ system, lastRun, showMeta = false }: { system: StoredSystemSummary; lastRun?: ExecutionSummary; showMeta?: boolean }) {
  return (
    <Card interactive padded onClick={() => navigate(`/systems/${system.system_id}`)} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div className="row gap-3" style={{ alignItems: "flex-start", justifyContent: "space-between", minWidth: 0 }}>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h3 className="truncate" title={system.process_name} style={{ margin: 0 }}>
            {system.process_name}
          </h3>
          {showMeta && (
            <div className="row gap-2 wrap">
              <Chip title={system.system_id}>{shortId(system.system_id)}</Chip>
              <span className="text-xs text-tertiary">Created {formatRelativeTime(system.created_at)}</span>
            </div>
          )}
        </div>
        {lastRun ? <RunStatusBadge status={lastRun.status} /> : <Badge tone="outline">No runs</Badge>}
      </div>

      <p className="text-sm text-secondary" style={{ ...clamp2, margin: 0, minHeight: "2.9em" }} title={system.objective}>
        {system.objective || "No objective recorded."}
      </p>

      <div className="row gap-2 wrap">
        <Badge tone="neutral">
          <Bot size={12} />
          {system.agent_count} {system.agent_count === 1 ? "agent" : "agents"}
        </Badge>
        <Badge tone="neutral">
          <GitBranch size={12} />
          {system.node_count} {system.node_count === 1 ? "node" : "nodes"}
        </Badge>
        {system.has_approval_gate && (
          <Badge tone="warning">
            <ShieldCheck size={12} />
            Approval gate
          </Badge>
        )}
      </div>

      <div className="row gap-2 text-xs text-tertiary" style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
        <Clock size={12} />
        <span className="truncate">{lastRun ? `Last run ${formatRelativeTime(lastRun.completed_at ?? lastRun.created_at)}` : "Never run"}</span>
      </div>
    </Card>
  );
}

export default SystemCard;
