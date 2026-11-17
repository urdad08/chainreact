import { useMemo } from "react";
import { Inbox, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { listExecutions, listTools } from "../api/client";
import { useApi } from "../lib/useApi";
import { EMPTY_PERMISSION_DEFAULTS, PERMISSION_DEFAULTS_KEY, PermissionDefaults, PermissionPolicy, usePref } from "../lib/prefs";
import { navigate } from "../lib/router";
import { formatDateTime, formatRelativeTime, humanize, shortId } from "../lib/format";
import { useConfirm, useToast } from "../ui/feedback";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented, Skeleton, Switch } from "../ui/primitives";
import type { CapabilityKind, ToolInfo } from "../types/chainreact";
import { KIND_LABEL, KindBadge } from "./ToolsPage";

const KIND_HELP: Record<CapabilityKind, string> = {
  read: "Reads data; changes nothing",
  write: "Creates or updates records",
  delete: "Removes data irreversibly",
  external: "Sends something outside your system",
};

function ApprovalInbox() {
  const { data, loading, error, refresh } = useApi(listExecutions, [], 5000);
  const waiting = (data ?? []).filter((r) => r.status === "waiting_approval");

  return (
    <Card>
      <CardHeader
        icon={<Inbox size={16} />}
        title="Approval inbox"
        description="Runs paused at a human-approval gate. Review each run to approve or reject it."
        actions={
          <>
            {data && waiting.length > 0 && <Badge tone="warning">{waiting.length} waiting</Badge>}
            <Button size="sm" variant="ghost" iconOnly aria-label="Refresh" icon={<RefreshCw size={14} />} onClick={refresh} />
          </>
        }
      />
      {error && !data ? (
        <EmptyState title="Could not load runs" description={error} action={<Button size="sm" onClick={refresh}>Try again</Button>} />
      ) : loading && !data ? (
        <div className="card-body stack gap-2">
          <Skeleton height={16} />
          <Skeleton height={16} width="70%" />
        </div>
      ) : waiting.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={20} />} title="No approvals waiting" description="When a run reaches an approval gate it will appear here." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Run</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {waiting.map((r) => (
                <tr key={r.run_id}>
                  <td style={{ fontWeight: 550 }}>{r.process_name || "—"}</td>
                  <td className="mono text-secondary" title={r.run_id}>
                    {shortId(r.run_id)}
                  </td>
                  <td className="text-secondary" title={formatDateTime(r.created_at)}>
                    {formatRelativeTime(r.created_at)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button size="sm" variant="primary" onClick={() => navigate("/executions/" + r.run_id)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function isSensitiveAllow(t: ToolInfo) {
  return t.kind === "delete" || t.capability.startsWith("payments.");
}

export default function PermissionsPage() {
  const { data: tools, loading, error, refresh } = useApi(listTools, []);
  const [defaults, setDefaults] = usePref<PermissionDefaults>(PERMISSION_DEFAULTS_KEY, EMPTY_PERMISSION_DEFAULTS);
  const confirm = useConfirm();
  const toast = useToast();

  const policy = defaults.policy ?? {};
  const approval = useMemo(() => new Set(defaults.requireApproval ?? []), [defaults.requireApproval]);

  const groups = useMemo(() => {
    const map = new Map<string, ToolInfo[]>();
    for (const t of tools ?? []) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  const configuredCount = Object.values(policy).filter((p) => p !== "unset").length + approval.size;

  const setPolicy = async (t: ToolInfo, next: PermissionPolicy) => {
    if (next === "allow" && isSensitiveAllow(t)) {
      const ok = await confirm({
        title: `Allow ${t.capability} by default?`,
        description:
          t.kind === "delete"
            ? "This permission deletes data. New systems will start with it granted. Keep approval required unless you are sure."
            : "This permission moves money. New systems will start with it granted. Keep approval required unless you are sure.",
        confirmLabel: "Allow",
        tone: "danger",
      });
      if (!ok) return;
    }
    const nextPolicy = { ...policy };
    if (next === "unset") delete nextPolicy[t.capability];
    else nextPolicy[t.capability] = next;
    setDefaults({ policy: nextPolicy, requireApproval: [...approval] });
  };

  const setApproval = async (t: ToolInfo, on: boolean) => {
    if (!on && (t.kind === "external" || t.kind === "delete")) {
      const ok = await confirm({
        title: `Stop requiring approval for ${t.capability}?`,
        description: `This is ${t.kind === "delete" ? "a delete" : "an external"} action. Runs will perform it without pausing for a human.`,
        confirmLabel: "Remove approval",
        tone: "danger",
      });
      if (!ok) return;
    }
    const next = new Set(approval);
    if (on) next.add(t.capability);
    else next.delete(t.capability);
    setDefaults({ policy: { ...policy }, requireApproval: [...next] });
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Reset all defaults to unset?",
      description: "Every Allow/Deny choice and approval requirement on this page will be cleared. Existing systems are not affected.",
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!ok) return;
    setDefaults({ policy: {}, requireApproval: [] });
    toast({ tone: "success", title: "Permission defaults reset" });
  };

  return (
    <div className="stack gap-6">
      <PageHeader
        eyebrow="Governance"
        title="Permissions"
        description="Review runs waiting for a human, and set the default permission policy new systems start from."
      />

      <ApprovalInbox />

      <Card>
        <CardHeader
          icon={<ShieldCheck size={16} />}
          title="Default permission policy"
          description="Applied as the starting policy each time the Build page starts a new system. Suggestions can add permissions but never override an explicit Deny."
          actions={
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset} disabled={configuredCount === 0}>
              Reset to unset
            </Button>
          }
        />
        <div className="card-body stack gap-4">
          <div className="row gap-4 wrap text-sm">
            {(Object.keys(KIND_LABEL) as CapabilityKind[]).map((k) => (
              <span key={k} className="row gap-2">
                <KindBadge kind={k} />
                <span className="text-tertiary">{KIND_HELP[k]}</span>
              </span>
            ))}
          </div>

          {error && !tools ? (
            <EmptyState title="Could not load permissions" description={error} action={<Button size="sm" onClick={refresh}>Try again</Button>} />
          ) : loading && !tools ? (
            <div className="stack gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={18} />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState title="No permissions in the catalog" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>Description</th>
                    <th>Kind</th>
                    <th>Mode</th>
                    <th>Default</th>
                    <th>Requires approval</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([category, list]) => [
                    <tr key={`cat-${category}`}>
                      <td colSpan={6} style={{ background: "var(--surface-2)", paddingTop: 8, paddingBottom: 8 }}>
                        <span className="eyebrow">{humanize(category)}</span>
                      </td>
                    </tr>,
                    ...list.map((t) => (
                      <tr key={t.capability}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {t.capability}
                        </td>
                        <td className="text-secondary" style={{ minWidth: 200 }}>
                          {t.description || "—"}
                        </td>
                        <td>
                          <KindBadge kind={t.kind} />
                        </td>
                        <td>{t.real ? <Badge tone="success">Real</Badge> : <Badge tone="outline">Simulated</Badge>}</td>
                        <td>
                          <Segmented<PermissionPolicy>
                            value={policy[t.capability] ?? "unset"}
                            onChange={(v) => void setPolicy(t, v)}
                            options={[
                              { value: "unset", label: "Unset" },
                              { value: "allow", label: "Allow" },
                              { value: "deny", label: "Deny" },
                            ]}
                          />
                        </td>
                        <td>
                          <Switch checked={approval.has(t.capability)} onChange={(v) => void setApproval(t, v)} />
                        </td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
