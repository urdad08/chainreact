import { ReactNode, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FileText,
  GitBranch,
  Layers,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Skeleton, Stat } from "../ui/primitives";
import { RUN_STATUS } from "../ui/status";
import { listExecutions, listSystems } from "../api/client";
import { useApi } from "../lib/useApi";
import { navigate } from "../lib/router";
import { formatRelativeTime } from "../lib/format";
import { SystemCard, latestRunBySystem } from "../components/systems/SystemCard";
import type { ExecutionSummary, StoredSystemSummary } from "../types/chainreact";

const PIPELINE: { label: string; hint: string; icon: ReactNode }[] = [
  { label: "Requirement", hint: "Describe the business process", icon: <FileText size={14} /> },
  { label: "Agents", hint: "Specialised agents are designed", icon: <Users size={14} /> },
  { label: "Workflow", hint: "Agents wired into a graph", icon: <GitBranch size={14} /> },
  { label: "Validation", hint: "Sandbox-tested before deploy", icon: <ShieldCheck size={14} /> },
  { label: "Execution", hint: "Run with real integrations", icon: <Play size={14} /> },
];

const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);

interface FeedItem {
  key: string;
  at: string;
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  href: string;
}

function buildFeed(systems: StoredSystemSummary[], runs: ExecutionSummary[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const s of systems) {
    items.push({
      key: `s-${s.system_id}`,
      at: s.created_at,
      icon: <Boxes size={14} />,
      title: (
        <>
          System generated: <strong>{s.process_name}</strong>
        </>
      ),
      meta: `${s.agent_count} agents · ${s.node_count} nodes`,
      href: `/systems/${s.system_id}`,
    });
  }
  for (const r of runs) {
    const label = RUN_STATUS[r.status]?.label ?? r.status;
    items.push({
      key: `r-${r.run_id}`,
      at: r.completed_at ?? r.created_at,
      icon: RUN_STATUS[r.status]?.icon(14) ?? <Activity size={14} />,
      title: (
        <>
          Run {r.status === "running" ? "started" : label.toLowerCase()}: <strong>{r.process_name}</strong>
        </>
      ),
      meta: `${r.step_count} ${r.step_count === 1 ? "step" : "steps"}`,
      href: `/executions/${r.run_id}`,
    });
  }
  return items.sort((a, b) => ts(b.at) - ts(a.at)).slice(0, 8);
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card padded style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
      <div className="row gap-3 wrap" style={{ justifyContent: "space-between" }}>
        <div className="row gap-2" style={{ minWidth: 0, color: "var(--danger)" }}>
          <AlertTriangle size={16} />
          <span className="text-sm" style={{ minWidth: 0 }}>
            {message}
          </span>
        </div>
        <Button size="sm" icon={<RefreshCw size={13} />} onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Card>
  );
}

function Hero() {
  return (
    <Card variant="accent" style={{ position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at 85% 30%, black 0%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(ellipse at 85% 30%, black 0%, transparent 65%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "var(--sp-8)",
          padding: "var(--sp-8)",
          alignItems: "center",
        }}
      >
        <div className="stack gap-4" style={{ minWidth: 0 }}>
          <span className="eyebrow row gap-2" style={{ color: "var(--accent)" }}>
            <Sparkles size={13} />
            ChainReact
          </span>
          <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0, fontWeight: 600, maxWidth: 560 }}>
            Build intelligent agent systems from business requirements.
          </h1>
          <p className="text-secondary" style={{ margin: 0, maxWidth: 520, fontSize: "var(--fs-md)" }}>
            Transform business processes into autonomous, validated, and deployable multi-agent systems.
          </p>
          <div className="row gap-2 wrap" style={{ marginTop: 4 }}>
            <Button variant="primary" size="lg" icon={<Sparkles size={15} />} onClick={() => navigate("/build")}>
              Build an Agent System
            </Button>
            <Button variant="ghost" size="lg" iconRight={<ArrowRight size={15} />} onClick={() => navigate("/systems")}>
              Explore Systems
            </Button>
          </div>
        </div>

        <div
          className="stack"
          style={{
            gap: 0,
            minWidth: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
            padding: "var(--sp-2)",
          }}
          aria-label="How ChainReact works"
        >
          <span className="eyebrow" style={{ padding: "var(--sp-2) var(--sp-3)" }}>
            How it works
          </span>
          {PIPELINE.map((p, i) => (
            <div key={p.label} className="row gap-3" style={{ padding: "8px var(--sp-3)", minWidth: 0, position: "relative" }}>
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--accent-border)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {p.icon}
              </span>
              {i < PIPELINE.length - 1 && (
                <span aria-hidden style={{ position: "absolute", left: "calc(var(--sp-3) + 13.5px)", top: 36, height: 16, width: 1, background: "var(--accent-border)" }} />
              )}
              <div className="stack" style={{ gap: 1, minWidth: 0 }}>
                <span className="text-sm" style={{ fontWeight: 500 }}>
                  <span className="mono text-tertiary" style={{ marginRight: 6 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.label}
                </span>
                <span className="text-xs text-tertiary truncate">{p.hint}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const systems = useApi(listSystems, []);
  const runs = useApi(listExecutions, [], 5000);

  const counts = useMemo(() => {
    const c = { running: 0, completed: 0, failed: 0, waiting_approval: 0 };
    for (const r of runs.data ?? []) if (r.status in c) c[r.status as keyof typeof c]++;
    return c;
  }, [runs.data]);

  const lastRuns = useMemo(() => latestRunBySystem(runs.data), [runs.data]);
  const recentSystems = useMemo(
    () => [...(systems.data ?? [])].sort((a, b) => ts(b.created_at) - ts(a.created_at)).slice(0, 6),
    [systems.data]
  );
  const feed = useMemo(() => buildFeed(systems.data ?? [], runs.data ?? []), [systems.data, runs.data]);

  const runsLoading = runs.loading && !runs.data;
  const sysLoading = systems.loading && !systems.data;
  const runValue = (n: number) => (runs.error && !runs.data ? "-" : n);
  const sinceStart = "since backend start";

  return (
    <div className="stack gap-6">
      <Hero />

      {(systems.error || runs.error) && (
        <ErrorCard
          message={`Could not load ${systems.error ? "systems" : "executions"}: ${systems.error ?? runs.error}`}
          onRetry={() => {
            if (systems.error) systems.refresh();
            if (runs.error) runs.refresh();
          }}
        />
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Stat
          label="Generated systems"
          icon={<Layers size={14} />}
          value={systems.error && !systems.data ? "-" : systems.data?.length ?? 0}
          loading={sysLoading}
          foot="Stored on the backend"
        />
        <Stat label="Active executions" icon={<Activity size={14} />} value={runValue(counts.running)} loading={runsLoading} foot={sinceStart} />
        <Stat label="Successful" icon={<CheckCircle2 size={14} />} value={runValue(counts.completed)} loading={runsLoading} foot={sinceStart} />
        <Stat label="Failed" icon={<XCircle size={14} />} value={runValue(counts.failed)} loading={runsLoading} foot={sinceStart} />
        <Stat label="Pending approval" icon={<PauseCircle size={14} />} value={runValue(counts.waiting_approval)} loading={runsLoading} foot={sinceStart} />
      </div>

      <div className="row gap-5" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <section className="stack gap-3" style={{ minWidth: 0, flex: "2 1 520px" }} aria-labelledby="recent-systems">
          <div className="row gap-2" style={{ justifyContent: "space-between" }}>
            <h2 id="recent-systems" style={{ margin: 0, fontSize: "var(--fs-lg)" }}>
              Recently created systems
            </h2>
            {(systems.data?.length ?? 0) > 0 && (
              <Button variant="ghost" size="sm" iconRight={<ChevronRight size={13} />} onClick={() => navigate("/systems")}>
                View all
              </Button>
            )}
          </div>
          {sysLoading ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} padded>
                  <div className="stack gap-3">
                    <Skeleton width="60%" height={16} />
                    <Skeleton height={12} />
                    <Skeleton width="80%" height={12} />
                    <Skeleton width="40%" height={20} />
                  </div>
                </Card>
              ))}
            </div>
          ) : recentSystems.length === 0 ? (
            !systems.error && (
              <Card>
                <EmptyState
                  icon={<Boxes size={20} />}
                  title="No agent systems yet"
                  description="Describe a business process and ChainReact will design, wire and validate a multi-agent system for it."
                  action={
                    <Button variant="primary" icon={<Sparkles size={14} />} onClick={() => navigate("/build")}>
                      Build your first system
                    </Button>
                  }
                />
              </Card>
            )
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
              {recentSystems.map((s) => (
                <SystemCard key={s.system_id} system={s} lastRun={lastRuns.get(s.system_id)} />
              ))}
            </div>
          )}
        </section>

        <Card style={{ minWidth: 0, flex: "1 1 300px" }}>
          <CardHeader title="Recent activity" description="Systems and executions" icon={<Activity size={16} />} />
          {(sysLoading || runsLoading) && feed.length === 0 ? (
            <div className="stack gap-3" style={{ padding: "var(--sp-4) var(--sp-5)" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="row gap-3">
                  <Skeleton width={28} height={28} />
                  <div className="stack gap-1 grow">
                    <Skeleton width="70%" height={12} />
                    <Skeleton width="40%" height={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <EmptyState icon={<Activity size={18} />} title="No activity yet" description="Generated systems and execution runs will appear here." />
          ) : (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: "var(--sp-2)", gap: 2 }}>
              {feed.map((f) => (
                <li key={f.key}>
                  <a
                    href={`#${f.href}`}
                    className="row gap-3"
                    style={{ padding: "8px var(--sp-3)", borderRadius: "var(--r-md)", color: "inherit", textDecoration: "none", minWidth: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      className="row"
                      style={{
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: "var(--r-sm)",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {f.icon}
                    </span>
                    <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="text-sm truncate">{f.title}</span>
                      <span className="text-xs text-tertiary truncate">
                        {f.meta} · {formatRelativeTime(f.at)}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
