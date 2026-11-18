import { useMemo, useState } from "react";
import { History, PauseCircle, RefreshCw, Search, ServerCrash } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented, Skeleton } from "../ui/primitives";
import { RunStatusBadge } from "../ui/status";
import { listExecutions } from "../api/client";
import { useApi } from "../lib/useApi";
import { durationBetween, formatDateTime, formatDuration, formatRelativeTime, shortId } from "../lib/format";
import { navigate, routeHref } from "../lib/router";
import type { ExecutionSummary, RunStatus } from "../types/chainreact";

type Filter = "all" | RunStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "waiting_approval", label: "Pending approval" },
];

function durationCell(run: ExecutionSummary) {
  if (run.completed_at) return <span className="mono text-sm">{formatDuration(durationBetween(run.created_at, run.completed_at))}</span>;
  return <span className="text-sm text-tertiary">In progress</span>;
}

export default function ExecutionsPage() {
  const { data, loading, error, refresh } = useApi(listExecutions, [], 4000);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const runs = data ?? [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: runs.length, completed: 0, failed: 0, running: 0, waiting_approval: 0 };
    runs.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1;
    });
    return c;
  }, [runs]);

  const pending = runs.filter((r) => r.status === "waiting_approval");
  const q = query.trim().toLowerCase();
  const visible = runs.filter(
    (r) => (filter === "all" || r.status === filter) && (!q || r.process_name.toLowerCase().includes(q) || r.run_id.toLowerCase().includes(q) || r.system_id.toLowerCase().includes(q))
  );

  return (
    <div className="stack gap-5" style={{ minWidth: 0 }}>
      <PageHeader
        eyebrow="Operations"
        title="Execution History"
        description="Every run of your systems: status, timing and outcome. Updates automatically."
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {pending.length > 0 && (
        <Card style={{ borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
          <div className="stack gap-3" style={{ padding: "var(--sp-4) var(--sp-5)" }}>
            <div className="row gap-2">
              <PauseCircle size={16} style={{ color: "var(--warning)" }} />
              <strong>
                {pending.length} run{pending.length === 1 ? "" : "s"} waiting for approval
              </strong>
            </div>
            <div className="stack gap-2">
              {pending.map((r) => (
                <div key={r.run_id} className="row wrap gap-3" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, minWidth: 0 }} className="truncate">
                    {r.process_name}
                  </span>
                  <span className="mono text-xs text-tertiary">{shortId(r.run_id)}</span>
                  <span className="text-xs text-tertiary">started {formatRelativeTime(r.created_at)}</span>
                  <span className="spacer" />
                  <Button size="sm" variant="primary" onClick={() => navigate(`/executions/${r.run_id}`)}>
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="row wrap gap-3">
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({
              value: f.value,
              label: (
                <span className="row gap-2">
                  {f.label}
                  <span className="text-tertiary mono text-xs">{data ? counts[f.value] : "-"}</span>
                </span>
              ),
            }))}
          />
        </div>
        <span className="spacer" />
        <div style={{ position: "relative", flex: "0 1 300px", minWidth: 180 }}>
          <Search size={14} className="text-tertiary" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Search system or run id" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search executions" />
        </div>
      </div>

      {loading && !data ? (
        <div className="table-wrap">
          <div className="stack gap-3" style={{ padding: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={18} />
            ))}
          </div>
        </div>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon={<ServerCrash size={20} />}
            title="Could not load execution history"
            description={error}
            action={
              <Button size="sm" icon={<RefreshCw size={14} />} onClick={refresh}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={20} />}
            title="No executions yet"
            description="Runs appear here as soon as you execute a system. History is kept in memory by the backend, so it starts empty each time the backend restarts."
            action={
              <Button size="sm" variant="primary" onClick={() => navigate("/systems")}>
                Go to systems
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search size={20} />}
            title="No matching runs"
            description="Try a different filter or search term."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>System</th>
                <th>Run ID</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Steps</th>
                <th>Agents</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.run_id} className="is-clickable" onClick={() => navigate(`/executions/${r.run_id}`)}>
                  <td style={{ maxWidth: 260 }}>
                    <a href={routeHref(`/systems/${r.system_id}`)} onClick={(e) => e.stopPropagation()} className="truncate" style={{ display: "block", fontWeight: 550 }}>
                      {r.process_name}
                    </a>
                  </td>
                  <td className="mono text-xs" title={r.run_id}>
                    {shortId(r.run_id)}
                  </td>
                  <td className="text-sm" style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                  <td className="text-sm" style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.completed_at)}</td>
                  <td>
                    <span className="row gap-2">
                      <RunStatusBadge status={r.status} />
                      {r.error && r.status !== "failed" && <Badge tone="danger" title={r.error}>error</Badge>}
                    </span>
                  </td>
                  <td>{durationCell(r)}</td>
                  <td className="mono text-sm">{r.step_count}</td>
                  <td className="mono text-sm">{r.agent_count ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
