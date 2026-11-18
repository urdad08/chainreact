import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, FileInput, ListTree, Loader2, RefreshCw, SearchX, ServerCrash, Workflow } from "lucide-react";
import WorkflowVisualizer from "../components/WorkflowVisualizer";
import ExecutionTimeline, { ApprovalCard, ExecutionPlan, deriveNodeStatus, labelForNode } from "../components/execution/ExecutionTimeline";
import ExecutionResults from "../components/execution/ExecutionResults";
import { Badge, Button, Card, CardHeader, CodeBlock, Disclosure, EmptyState, PageHeader, Skeleton } from "../ui/primitives";
import { useToast } from "../ui/feedback";
import { RunStatusBadge } from "../ui/status";
import { approveExecution, getExecution, getSystem } from "../api/client";
import { useApi } from "../lib/useApi";
import { durationBetween, formatDateTime, formatDuration } from "../lib/format";
import { navigate } from "../lib/router";
import type { StoredSystem } from "../types/chainreact";

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack gap-1" style={{ minWidth: 0 }}>
      <span className="text-xs text-tertiary">{label}</span>
      <span className="text-sm" style={{ fontWeight: 550 }}>{children}</span>
    </div>
  );
}

export default function ExecutionDetailPage({ runId }: { runId: string }) {
  const toast = useToast();
  const [pollMs, setPollMs] = useState<number | undefined>(undefined);
  const runApi = useApi(() => getExecution(runId), [runId], pollMs);
  const run = runApi.data;
  const live = run?.status === "running" || run?.status === "waiting_approval";
  useEffect(() => {
    setPollMs(live ? 1500 : undefined);
  }, [live]);

  const systemId = run?.system_id;
  const systemApi = useApi<StoredSystem | null>(
    () => (systemId ? getSystem(systemId).catch(() => null) : Promise.resolve(null)),
    [systemId]
  );
  const system = systemApi.data;
  const workflow = system?.workflow ?? null;

  const nodeStatus = useMemo(
    () => (run ? deriveNodeStatus(workflow, run.steps ?? [], run.status, run.running_nodes ?? []) : {}),
    [run, workflow]
  );

  async function decide(approved: boolean) {
    try {
      await approveExecution(runId, approved);
      toast({ tone: approved ? "success" : "info", title: approved ? "Approved" : "Rejected", description: "The run is resuming." });
      runApi.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Could not record the decision", description: e instanceof Error ? e.message : "Approval failed." });
    }
  }

  const backButton = (
    <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate("/executions")}>
      Execution history
    </Button>
  );

  if (!run) {
    if (runApi.loading) {
      return (
        <div className="stack gap-4">
          <Skeleton width={220} height={14} />
          <Skeleton width={360} height={26} />
          <Skeleton height={120} />
          <Skeleton height={240} />
        </div>
      );
    }
    const notFound = runApi.error && (/no execution run/i.test(runApi.error) || /404/.test(runApi.error));
    return (
      <Card>
        <EmptyState
          icon={notFound ? <SearchX size={20} /> : <ServerCrash size={20} />}
          title={notFound ? "Execution not found" : "Could not load this execution"}
          description={
            notFound
              ? "This run isn't in the backend's history. History is kept in memory, so runs disappear when the backend restarts."
              : runApi.error ?? undefined
          }
          action={
            <div className="row wrap gap-2" style={{ justifyContent: "center" }}>
              {!notFound && (
                <Button size="sm" icon={<RefreshCw size={14} />} onClick={runApi.refresh}>
                  Try again
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => navigate("/executions")}>
                Back to history
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  const isLive = run.status === "running" || run.status === "waiting_approval";
  const gateStep = [...(run.steps ?? [])].reverse().find((s) => s.status === "waiting_approval") ?? null;
  const terminal = run.status === "completed" || run.status === "failed";
  const runningNodes = run.status === "running" ? run.running_nodes ?? [] : [];

  return (
    <div className="stack gap-5" style={{ minWidth: 0 }}>
      <PageHeader
        eyebrow={
          <span className="row gap-2">
            Execution <span className="mono" style={{ textTransform: "none", letterSpacing: 0 }}>{run.run_id}</span>
          </span>
        }
        title={
          <span className="row wrap gap-3">
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{run.process_name}</span>
            <RunStatusBadge status={run.status} />
          </span>
        }
        actions={
          <>
            {backButton}
            <Button size="sm" icon={<Boxes size={14} />} onClick={() => navigate(`/systems/${run.system_id}`)} disabled={!systemApi.loading && !system}>
              Open system
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", padding: "var(--sp-4) var(--sp-5)" }}>
          <MetaItem label="Started">{formatDateTime(run.created_at)}</MetaItem>
          <MetaItem label="Completed">{formatDateTime(run.completed_at)}</MetaItem>
          <MetaItem label="Duration">
            {run.completed_at ? <span className="mono">{formatDuration(durationBetween(run.created_at, run.completed_at))}</span> : <span className="text-tertiary">In progress</span>}
          </MetaItem>
          <MetaItem label="Steps">
            <span className="mono">{run.step_count}</span>
          </MetaItem>
          <MetaItem label="Agents">
            <span className="mono">{run.agent_count ?? "-"}</span>
          </MetaItem>
          <MetaItem label="System">
            <span className="mono text-xs">{run.system_id}</span>
          </MetaItem>
        </div>
      </Card>

      {!systemApi.loading && !system && (
        <div className="text-sm text-tertiary">The system this run belongs to is no longer stored, so the workflow plan can't be shown.</div>
      )}

      {run.status === "waiting_approval" && <ApprovalCard step={gateStep} onDecide={decide} />}

      {runningNodes.length > 0 && (
        <div className="row wrap gap-2" style={{ padding: "8px 12px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
          <Loader2 size={14} className="spin" style={{ color: "var(--accent)" }} />
          <span className="text-sm" style={{ fontWeight: 600 }}>Currently running</span>
          {runningNodes.map((id) => (
            <Badge key={id} tone="accent">
              {labelForNode(id, workflow)}
            </Badge>
          ))}
        </div>
      )}

      {workflow && (
        <Card>
          <CardHeader icon={<Workflow size={16} />} title="Workflow" description={isLive ? "Live node status, refreshed while the run is in progress" : "Node status for this run"} />
          <div className="card-body">
            <WorkflowVisualizer graph={workflow} nodeStatus={nodeStatus} height={320} />
          </div>
        </Card>
      )}

      <div className="row wrap gap-5" style={{ alignItems: "flex-start" }}>
        <Card style={{ flex: "3 1 440px", minWidth: 0 }}>
          <CardHeader icon={<ListTree size={16} />} title="Activity" description={`${(run.steps ?? []).length} step event${(run.steps ?? []).length === 1 ? "" : "s"}`} />
          <div className="card-body">
            <ExecutionTimeline steps={run.steps ?? []} stepTimes={run.step_times ?? []} startedAt={run.created_at} live={isLive} />
          </div>
        </Card>
        {workflow && (
          <Card style={{ flex: "1 1 260px", minWidth: 0 }}>
            <CardHeader title="Plan" description={`${workflow.nodes.length} nodes`} />
            <div className="card-body" style={{ padding: "var(--sp-3)" }}>
              <ExecutionPlan workflow={workflow} nodeStatus={nodeStatus} />
            </div>
          </Card>
        )}
      </div>

      {terminal && <ExecutionResults run={run} workflow={workflow} architecture={system?.agent_architecture ?? null} hideDetailsLink />}

      <Disclosure title="Input data" icon={<FileInput size={15} />} meta={`${Object.keys(run.input_data ?? {}).length} fields`}>
        <CodeBlock maxHeight={320}>{JSON.stringify(run.input_data ?? {}, null, 2)}</CodeBlock>
      </Disclosure>
    </div>
  );
}

