import { ReactNode } from "react";
import { CheckCircle2, CircleDashed, CircleSlash, Clock, Loader2, PauseCircle, ShieldOff, XCircle, FlaskConical } from "lucide-react";
import { Badge, Tone } from "./primitives";
import type { RunStatus, StepStatus } from "../types/chainreact";

// One mapping from backend status values to visual treatment, so a "failed"
// run looks the same on the dashboard, history table and live console.

export type NodeRunStatus = "queued" | "running" | "completed" | "failed" | "waiting_approval" | "blocked" | "simulated" | "skipped";

interface StatusVisual {
  label: string;
  tone: Tone;
  icon: (size?: number) => ReactNode;
}

export const RUN_STATUS: Record<RunStatus, StatusVisual> = {
  running: { label: "Running", tone: "accent", icon: (s = 14) => <Loader2 size={s} className="spin" /> },
  completed: { label: "Completed", tone: "success", icon: (s = 14) => <CheckCircle2 size={s} /> },
  failed: { label: "Failed", tone: "danger", icon: (s = 14) => <XCircle size={s} /> },
  waiting_approval: { label: "Awaiting approval", tone: "warning", icon: (s = 14) => <PauseCircle size={s} /> },
};

export const STEP_STATUS: Record<StepStatus, StatusVisual> = {
  ok: { label: "Completed", tone: "success", icon: (s = 14) => <CheckCircle2 size={s} /> },
  simulated: { label: "Simulated", tone: "warning", icon: (s = 14) => <FlaskConical size={s} /> },
  blocked: { label: "Blocked", tone: "danger", icon: (s = 14) => <ShieldOff size={s} /> },
  failed: { label: "Failed", tone: "danger", icon: (s = 14) => <XCircle size={s} /> },
  waiting_approval: { label: "Awaiting approval", tone: "warning", icon: (s = 14) => <PauseCircle size={s} /> },
  retrying: { label: "Retrying", tone: "warning", icon: (s = 14) => <Loader2 size={s} className="spin" /> },
};

export const NODE_STATUS: Record<NodeRunStatus, StatusVisual> = {
  queued: { label: "Queued", tone: "neutral", icon: (s = 14) => <Clock size={s} /> },
  running: { label: "Running", tone: "accent", icon: (s = 14) => <Loader2 size={s} className="spin" /> },
  completed: { label: "Completed", tone: "success", icon: (s = 14) => <CheckCircle2 size={s} /> },
  failed: { label: "Failed", tone: "danger", icon: (s = 14) => <XCircle size={s} /> },
  waiting_approval: { label: "Awaiting approval", tone: "warning", icon: (s = 14) => <PauseCircle size={s} /> },
  blocked: { label: "Blocked", tone: "danger", icon: (s = 14) => <ShieldOff size={s} /> },
  simulated: { label: "Simulated", tone: "warning", icon: (s = 14) => <FlaskConical size={s} /> },
  skipped: { label: "Not reached", tone: "outline", icon: (s = 14) => <CircleSlash size={s} /> },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const v = RUN_STATUS[status] ?? { label: status, tone: "neutral" as Tone, icon: () => <CircleDashed size={14} /> };
  return (
    <Badge tone={v.tone}>
      {v.icon(12)}
      {v.label}
    </Badge>
  );
}

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const v = STEP_STATUS[status];
  return (
    <Badge tone={v.tone}>
      {v.icon(12)}
      {v.label}
    </Badge>
  );
}

export function NodeStatusBadge({ status }: { status: NodeRunStatus }) {
  const v = NODE_STATUS[status];
  return (
    <Badge tone={v.tone}>
      {v.icon(12)}
      {v.label}
    </Badge>
  );
}

/** Map a completed StepResult's status onto the node-level vocabulary. */
export function nodeStatusFromStep(status: StepStatus): NodeRunStatus {
  switch (status) {
    case "ok":
      return "completed";
    case "retrying":
      return "running";
    default:
      return status;
  }
}
