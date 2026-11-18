import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Search, Wrench } from "lucide-react";
import { listTools } from "../api/client";
import { useApi } from "../lib/useApi";
import { Badge, Button, Card, Chip, EmptyState, PageHeader, Segmented, Skeleton } from "../ui/primitives";
import type { CapabilityKind, ToolInfo } from "../types/chainreact";

type ModeFilter = "all" | "real" | "simulated" | "unavailable";
type KindFilter = "all" | CapabilityKind;

export const KIND_TONE: Record<CapabilityKind, "cyan" | "accent" | "danger" | "warning"> = {
  read: "cyan",
  write: "accent",
  delete: "danger",
  external: "warning",
};

export const KIND_LABEL: Record<CapabilityKind, string> = {
  read: "Read",
  write: "Write",
  delete: "Delete",
  external: "External",
};

export function KindBadge({ kind }: { kind: CapabilityKind }) {
  return <Badge tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</Badge>;
}

function matchesMode(t: ToolInfo, mode: ModeFilter): boolean {
  if (mode === "real") return t.real;
  if (mode === "simulated") return !t.real;
  if (mode === "unavailable") return !t.available;
  return true;
}

function SchemaChips({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) return <span className="text-tertiary text-sm">{emptyLabel}</span>;
  return (
    <div className="row gap-1 wrap">
      {items.map((i) => (
        <Chip key={i}>
          <span className="mono">{i}</span>
        </Chip>
      ))}
    </div>
  );
}

function Availability({ tool }: { tool: ToolInfo }) {
  if (tool.available) {
    return (
      <Badge tone="success" dot>
        Available
      </Badge>
    );
  }
  return (
    <Badge tone="warning" dot title={tool.availability_reason}>
      Unavailable
    </Badge>
  );
}

export default function ToolsPage() {
  const { data, loading, error, refresh } = useApi(listTools, []);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const tools = data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter(
      (t) =>
        matchesMode(t, mode) &&
        (kind === "all" || t.kind === kind) &&
        (!q || t.capability.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    );
  }, [tools, query, mode, kind]);

  const counts = useMemo(
    () => ({
      real: tools.filter((t) => t.real).length,
      available: tools.filter((t) => t.available).length,
    }),
    [tools]
  );

  return (
    <div className="stack gap-6">
      <PageHeader
        eyebrow="Capabilities"
        title="Tool Registry"
        description="Every tool an agent can call. An agent may only call a tool whose permission it holds, and the runtime re-checks that permission at call time, so a tool never runs on a stale grant."
        actions={
          <Button icon={<RefreshCw size={14} />} onClick={refresh} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      <div className="row gap-3 wrap">
        <div className="row grow" style={{ position: "relative", minWidth: 200, maxWidth: 360 }}>
          <Search size={14} className="text-tertiary" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
          <input className="input" placeholder="Search tools" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 30, width: "100%" }} aria-label="Search tools" />
        </div>
        <Segmented<ModeFilter>
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All" },
            { value: "real", label: "Real" },
            { value: "simulated", label: "Simulated" },
            { value: "unavailable", label: "Unavailable" },
          ]}
        />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} aria-label="Filter by kind" style={{ width: "auto" }}>
          <option value="all">All kinds</option>
          <option value="read">Read</option>
          <option value="write">Write</option>
          <option value="delete">Delete</option>
          <option value="external">External</option>
        </select>
        {data && (
          <span className="text-sm text-tertiary">
            {tools.length} tools, {counts.real} with real handlers, {counts.available} available now
          </span>
        )}
      </div>

      {error && !data ? (
        <Card>
          <EmptyState
            icon={<Wrench size={20} />}
            title="Could not load the tool registry"
            description={error}
            action={
              <Button size="sm" onClick={refresh}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : loading && !data ? (
        <Card padded className="stack gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={18} />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search size={20} />}
            title={tools.length ? "No tools match these filters" : "No tools registered"}
            description={tools.length ? "Try a different search or clear the filters." : undefined}
            action={
              tools.length ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setMode("all");
                    setKind("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th>Tool / permission</th>
                <th>Description</th>
                <th>Kind</th>
                <th>Mode</th>
                <th>Availability</th>
                <th>Inputs</th>
                <th>Outputs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const open = expanded === t.capability;
                return (
                  <Fragment key={t.capability}>
                    <tr className="is-clickable" onClick={() => setExpanded(open ? null : t.capability)} aria-expanded={open}>
                      <td className="text-tertiary">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {t.capability}
                      </td>
                      <td className="text-secondary" style={{ minWidth: 220 }}>
                        {t.description || "-"}
                      </td>
                      <td>
                        <KindBadge kind={t.kind} />
                      </td>
                      <td>{t.real ? <Badge tone="success">Real</Badge> : <Badge tone="outline">Simulated</Badge>}</td>
                      <td>
                        <Availability tool={t} />
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <SchemaChips items={t.inputs} emptyLabel={t.real ? "-" : "Reads any context fields"} />
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <SchemaChips items={t.outputs} emptyLabel="-" />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td />
                        <td colSpan={7} style={{ background: "var(--surface-2)" }}>
                          <div className="grid grid-auto" style={{ gap: 16 }}>
                            <Detail label="Permission required">
                              <span className="mono">{t.capability}</span>
                            </Detail>
                            <Detail label="Category / operation">
                              <span className="mono">
                                {t.category} / {t.operation}
                              </span>
                            </Detail>
                            <Detail label="Handler">{t.real ? "Real handler; performs the action when available and real actions are enabled." : "No real handler; calls are simulated and labeled in run results."}</Detail>
                            <Detail label="Availability">
                              <span className={t.available ? "text-success" : "text-warning"}>{t.available ? "Available" : "Unavailable"}</span>
                              {t.availability_reason && <span className="text-secondary">: {t.availability_reason}</span>}
                            </Detail>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
      <span className="eyebrow">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
