import { ReactNode, useState } from "react";
import { Bot, Check, Flag, Play, UserCheck, Wrench, X } from "lucide-react";
import { Badge, Button, Tone } from "../../ui/primitives";
import { useConfirm } from "../../ui/feedback";
import { NODE_STATUS, NodeRunStatus, NodeStatusBadge, STEP_STATUS, StepStatusBadge, nodeStatusFromStep } from "../../ui/status";
import { durationBetween, formatDuration, humanize } from "../../lib/format";
import type { RunStatus, StepResult, WorkflowGraph, WorkflowNode } from "../../types/chainreact";

export const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--text-tertiary)",
  outline: "var(--text-tertiary)",
  accent: "var(--accent)",
  cyan: "var(--cyan)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export const TONE_SOFT: Record<Tone, string> = {
  neutral: "var(--neutral-soft)",
  outline: "var(--neutral-soft)",
  accent: "var(--accent-soft)",
  cyan: "var(--cyan-soft)",
  success: "var(--success-soft)",
  warning: "var(--warning-soft)",
  danger: "var(--danger-soft)",
};

const NODE_TYPE_LABEL: Record<string, string> = {
  start: "Start",
  end: "End",
  agent: "Agent",
  tool: "Tool",
  human_approval: "Approval",
};

export function nodeTypeIcon(type: string, size = 14): ReactNode {
  switch (type) {
    case "start":
      return <Play size={size} />;
    case "end":
      return <Flag size={size} />;
    case "agent":
      return <Bot size={size} />;
    case "tool":
      return <Wrench size={size} />;
    case "human_approval":
      return <UserCheck size={size} />;
    default:
      return <Bot size={size} />;
  }
}

export function nodeTypeLabel(type: string): string {
  return NODE_TYPE_LABEL[type] ?? humanize(type);
}

export function workflowNodeLabel(node: WorkflowNode): string {
  if (node.label) return node.label;
  if (node.agent) return humanize(node.agent);
  if (node.tool) return humanize(node.tool);
  return humanize(node.id);
}

/** Label for a node id, preferring the workflow's own label; falls back to a humanized id. */
export function labelForNode(id: string, workflow?: WorkflowGraph | null): string {
  const node = workflow?.nodes.find((n) => n.id === id);
  return node ? workflowNodeLabel(node) : humanize(id);
}

/** Latest step per node id (a node can produce more than one step, e.g. an approval gate resumed). */
export function latestStepByNode(steps: StepResult[]): Map<string, StepResult> {
  const map = new Map<string, StepResult>();
  steps.forEach((s) => map.set(s.node_id, s));
  return map;
}

/**
 * Derive each workflow node's status purely from real run data: completed steps,
 * the engine-reported running set, and whether the run is still in flight.
 */
export function deriveNodeStatus(
  workflow: WorkflowGraph | null | undefined,
  steps: StepResult[],
  runStatus: RunStatus | null,
  runningNodes: string[]
): Record<string, NodeRunStatus> {
  const result: Record<string, NodeRunStatus> = {};
  if (!runStatus) return result;
  const latest = latestStepByNode(steps);
  const running = new Set(runStatus === "running" ? runningNodes : []);
  const inFlight = runStatus === "running" || runStatus === "waiting_approval";
  const ids = workflow ? workflow.nodes.map((n) => n.id) : Array.from(latest.keys());
  ids.forEach((id) => {
    const step = latest.get(id);
    if (running.has(id)) result[id] = "running";
    else if (step) {
      const s = nodeStatusFromStep(step.status);
      result[id] = s === "running" && !inFlight ? "failed" : s;
    } else result[id] = inFlight ? "queued" : "skipped";
  });
  return result;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const LONG_VALUE = 64;

export function OutputChips({ output }: { output: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const entries = Object.entries(output);
  if (entries.length === 0) return null;
  return (
    <div className="row wrap gap-2" style={{ alignItems: "flex-start" }}>
      {entries.map(([k, raw]) => {
        const v = typeof raw === "string" ? raw : JSON.stringify(raw);
        const long = v.length > LONG_VALUE;
        const open = !!expanded[k];
        return (
          <span
            key={k}
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              maxWidth: "100%",
              minWidth: 0,
              padding: "3px 8px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              fontSize: 11.5,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{k}</span>
            <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>=</span>
            <span style={{ color: "var(--text)", minWidth: 0, overflowWrap: "anywhere", whiteSpace: open ? "pre-wrap" : undefined }}>
              {long && !open ? `${v.slice(0, LONG_VALUE)}…` : v}
            </span>
            {long && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ height: 18, padding: "0 4px", fontSize: 11, flexShrink: 0 }}
                onClick={() => setExpanded((e) => ({ ...e, [k]: !open }))}
              >
                {open ? "Less" : "More"}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function TimelineRow({ step, at, startedAt, animate, last }: { step: StepResult; at?: string; startedAt?: string | null; animate: boolean; last: boolean }) {
  const visual = STEP_STATUS[step.status];
  const delta = at && startedAt ? durationBetween(startedAt, at) : null;
  const hasOutput = step.output && Object.keys(step.output).length > 0;
  return (
    <div className="row gap-3" style={{ alignItems: "stretch", animation: animate ? "fade-in 260ms var(--ease)" : undefined }}>
      <div className="stack" style={{ alignItems: "center", flexShrink: 0, width: 26 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--r-full)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: TONE_COLOR[visual.tone],
            background: TONE_SOFT[visual.tone],
            flexShrink: 0,
          }}
        >
          {visual.icon(14)}
        </span>
        {!last && <span style={{ flex: 1, width: 1, background: "var(--border)", marginTop: 4 }} />}
      </div>
      <div className="stack gap-2 grow" style={{ minWidth: 0, paddingBottom: last ? 0 : 18 }}>
        <div className="row wrap gap-2" style={{ minHeight: 26 }}>
          <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{step.label}</span>
          <span className="row gap-1 text-xs text-tertiary">
            {nodeTypeIcon(step.type, 12)}
            {nodeTypeLabel(step.type)}
          </span>
          <StepStatusBadge status={step.status} />
          {step.attempt > 1 && <Badge tone="warning">attempt {step.attempt}</Badge>}
          <span className="spacer" />
          {at && (
            <span className="mono text-xs text-tertiary" title={at}>
              {formatClock(at)}
              {delta !== null && <span style={{ marginLeft: 6 }}>+{formatDuration(delta)}</span>}
            </span>
          )}
        </div>
        {step.note && <div className="text-sm text-secondary" style={{ overflowWrap: "anywhere" }}>{step.note}</div>}
        {step.tool_call_details.length > 0 && (
          <div className="stack gap-1">
            {step.tool_call_details.map((call, j) => (
              <div key={j} className="row wrap gap-2 text-sm" style={{ minWidth: 0 }}>
                <Badge tone={call.real ? "success" : "outline"}>{call.real ? "REAL" : "SIMULATED"}</Badge>
                <span className="mono" style={{ fontSize: 12 }}>{call.capability}</span>
                {(call.status === "blocked" || call.status === "failed") && <Badge tone="danger">{humanize(call.status)}</Badge>}
                {call.detail && (
                  <span
                    className="text-xs"
                    style={{ color: call.status === "blocked" || call.status === "failed" ? "var(--danger)" : "var(--text-tertiary)", minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {call.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {hasOutput && <OutputChips output={step.output as Record<string, unknown>} />}
      </div>
    </div>
  );
}

export interface ExecutionTimelineProps {
  steps: StepResult[];
  /** ISO completion times aligned with `steps` (step_times from the snapshot, or `at` from stream events). */
  stepTimes?: (string | undefined)[];
  /** Run start (backend created_at), used for the +delta column. */
  startedAt?: string | null;
  /** Fade in rows as they arrive (live console). */
  live?: boolean;
  emptyText?: ReactNode;
}

export default function ExecutionTimeline({ steps, stepTimes = [], startedAt, live = false, emptyText }: ExecutionTimelineProps) {
  if (steps.length === 0) {
    return <div className="text-sm text-tertiary" style={{ padding: "8px 0" }}>{emptyText ?? "No steps have completed yet."}</div>;
  }
  return (
    <div className="stack">
      {steps.map((step, i) => (
        <TimelineRow key={i} step={step} at={stepTimes[i]} startedAt={startedAt} animate={live} last={i === steps.length - 1} />
      ))}
    </div>
  );
}

export function ExecutionPlan({ workflow, nodeStatus }: { workflow: WorkflowGraph; nodeStatus: Record<string, NodeRunStatus> }) {
  return (
    <div className="stack gap-1">
      {workflow.nodes.map((node) => {
        const status = nodeStatus[node.id];
        return (
          <div
            key={node.id}
            className="row gap-2"
            style={{ padding: "6px 8px", borderRadius: "var(--r-md)", background: status === "running" ? "var(--accent-soft)" : undefined, minWidth: 0 }}
          >
            <span className="row text-tertiary" style={{ flexShrink: 0, color: status ? TONE_COLOR[NODE_STATUS[status].tone] : undefined }}>
              {nodeTypeIcon(node.type, 13)}
            </span>
            <span className="truncate grow text-sm" style={{ minWidth: 0 }} title={node.id}>
              {workflowNodeLabel(node)}
            </span>
            {status ? <NodeStatusBadge status={status} /> : <span className="text-xs text-tertiary">{nodeTypeLabel(node.type)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Prominent card for a run paused at a human-approval gate. Reject is confirmed first. */
export function ApprovalCard({ step, onDecide, busy }: { step?: StepResult | null; onDecide: (approved: boolean) => void | Promise<void>; busy?: boolean }) {
  const confirm = useConfirm();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function decide(approved: boolean) {
    if (!approved) {
      const ok = await confirm({
        title: "Reject this approval gate?",
        description: "The run will resume down its rejection path. Actions behind this gate will not be performed.",
        confirmLabel: "Reject",
        tone: "danger",
      });
      if (!ok) return;
    }
    setPending(approved ? "approve" : "reject");
    try {
      await onDecide(approved);
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      className="card"
      style={{ borderColor: "var(--warning)", background: "var(--warning-soft)", padding: "var(--sp-4) var(--sp-5)", animation: "fade-in 260ms var(--ease)" }}
    >
      <div className="row wrap gap-4" style={{ justifyContent: "space-between" }}>
        <div className="row gap-3" style={{ alignItems: "flex-start", minWidth: 0, flex: "1 1 320px" }}>
          <span style={{ color: "var(--warning)", marginTop: 2, flexShrink: 0 }}>
            <UserCheck size={18} />
          </span>
          <div className="stack gap-1" style={{ minWidth: 0 }}>
            <strong>Human approval required{step ? `: ${step.label}` : ""}</strong>
            <span className="text-sm text-secondary" style={{ overflowWrap: "anywhere" }}>
              {step?.note || "This run is paused at an approval gate and will not continue until someone decides."}
            </span>
            {step && <span className="mono text-xs text-tertiary">{step.node_id}</span>}
          </div>
        </div>
        <div className="row gap-2" style={{ flexShrink: 0 }}>
          <Button variant="danger" icon={<X size={14} />} onClick={() => decide(false)} disabled={busy || pending !== null} loading={pending === "reject"}>
            Reject
          </Button>
          <Button variant="success" icon={<Check size={14} />} onClick={() => decide(true)} disabled={busy || pending !== null} loading={pending === "approve"}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
