import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, LayoutGrid, List, Plus, RefreshCw, Search, SearchX, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Chip, EmptyState, PageHeader, Segmented, Skeleton } from "../ui/primitives";
import { RunStatusBadge } from "../ui/status";
import { listExecutions, listSystems } from "../api/client";
import { useApi } from "../lib/useApi";
import { navigate } from "../lib/router";
import { usePref } from "../lib/prefs";
import { formatRelativeTime, shortId } from "../lib/format";
import { SystemCard, latestRunBySystem } from "../components/systems/SystemCard";

type SortKey = "newest" | "name" | "agents";
type ViewMode = "grid" | "list";

const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);

export default function SystemsPage() {
  const systems = useApi(listSystems, []);
  const runs = useApi(listExecutions, [], 10000);
  const [query, setQuery] = useState("");
  const [sort, setSort] = usePref<SortKey>("systems.sort", "newest");
  const [view, setView] = usePref<ViewMode>("systems.view", "grid");

  const lastRuns = useMemo(() => latestRunBySystem(runs.data), [runs.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (systems.data ?? []).filter(
      (s) => !q || s.process_name.toLowerCase().includes(q) || (s.objective ?? "").toLowerCase().includes(q) || s.system_id.toLowerCase().includes(q)
    );
    return list.sort((a, b) => {
      if (sort === "name") return a.process_name.localeCompare(b.process_name);
      if (sort === "agents") return b.agent_count - a.agent_count || ts(b.created_at) - ts(a.created_at);
      return ts(b.created_at) - ts(a.created_at);
    });
  }, [systems.data, query, sort]);

  const total = systems.data?.length ?? 0;
  const loading = systems.loading && !systems.data;

  return (
    <div className="stack gap-6">
      <PageHeader
        title="My Systems"
        description="Every agent system you have generated. Open one to inspect its agents, workflow and run history."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate("/build")}>
            New agent system
          </Button>
        }
      />

      {systems.error && (
        <Card padded style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
          <div className="row gap-3 wrap" style={{ justifyContent: "space-between" }}>
            <div className="row gap-2" style={{ minWidth: 0, color: "var(--danger)" }}>
              <AlertTriangle size={16} />
              <span className="text-sm">Could not load systems: {systems.error}</span>
            </div>
            <Button size="sm" icon={<RefreshCw size={13} />} onClick={systems.refresh}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {(loading || total > 0) && (
        <div className="row gap-3 wrap" style={{ justifyContent: "space-between" }}>
          <div className="row gap-2" style={{ position: "relative", flex: "1 1 260px", maxWidth: 420, minWidth: 0 }}>
            <Search size={14} className="text-tertiary" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
            <input
              className="input"
              type="search"
              placeholder="Search by name or objective"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 30, width: "100%" }}
              aria-label="Search systems"
            />
          </div>
          <div className="row gap-2 wrap">
            <Segmented<SortKey>
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "name", label: "Name" },
                { value: "agents", label: "Agents" },
              ]}
            />
            <Segmented<ViewMode>
              value={view}
              onChange={setView}
              options={[
                { value: "grid", label: "", icon: <LayoutGrid size={14} aria-label="Grid view" /> },
                { value: "list", label: "", icon: <List size={14} aria-label="List view" /> },
              ]}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-auto">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} padded>
              <div className="stack gap-3">
                <Skeleton width="60%" height={16} />
                <Skeleton width="35%" height={12} />
                <Skeleton height={12} />
                <Skeleton width="45%" height={20} />
              </div>
            </Card>
          ))}
        </div>
      ) : total === 0 ? (
        !systems.error && (
          <Card>
            <EmptyState
              icon={<Boxes size={20} />}
              title="No agent systems yet"
              description="Describe a business process and ChainReact will generate a validated multi-agent system for it."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => navigate("/build")}>
                  Build your first system
                </Button>
              }
            />
          </Card>
        )
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX size={20} />}
            title="No matching systems"
            description={`Nothing matches "${query.trim()}".`}
            action={<Button onClick={() => setQuery("")}>Clear search</Button>}
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-auto">
          {visible.map((s) => (
            <SystemCard key={s.system_id} system={s} lastRun={lastRuns.get(s.system_id)} showMeta />
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Agents</th>
                <th>Nodes</th>
                <th>Last run</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const run = lastRuns.get(s.system_id);
                const open = () => navigate(`/systems/${s.system_id}`);
                return (
                  <tr key={s.system_id} className="is-clickable" onClick={open} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open()}>
                    <td style={{ maxWidth: 360 }}>
                      <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                        <span className="row gap-2" style={{ minWidth: 0 }}>
                          <span className="truncate" style={{ fontWeight: 500 }}>
                            {s.process_name}
                          </span>
                          {s.has_approval_gate && (
                            <Badge tone="warning" title="Approval gate">
                              <ShieldCheck size={11} />
                            </Badge>
                          )}
                        </span>
                        <span className="row gap-2" style={{ minWidth: 0 }}>
                          <Chip title={s.system_id}>{shortId(s.system_id)}</Chip>
                          <span className="text-xs text-tertiary truncate" title={s.objective}>
                            {s.objective}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="mono">{s.agent_count}</td>
                    <td className="mono">{s.node_count}</td>
                    <td className="text-secondary" style={{ whiteSpace: "nowrap" }}>
                      {run ? formatRelativeTime(run.completed_at ?? run.created_at) : "Never run"}
                    </td>
                    <td>{run ? <RunStatusBadge status={run.status} /> : <Badge tone="outline">No runs</Badge>}</td>
                    <td className="text-secondary" style={{ whiteSpace: "nowrap" }}>
                      {formatRelativeTime(s.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {runs.error && total > 0 && <span className="text-xs text-tertiary">Run status unavailable: {runs.error}</span>}
    </div>
  );
}
