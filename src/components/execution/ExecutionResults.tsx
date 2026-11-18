import { ReactNode, useMemo } from "react";
import { AlertTriangle, Braces, ArrowUpRight, CheckCircle2, ClipboardCopy, Download, FileOutput, ListChecks, RotateCcw, Users, Wrench, XCircle } from "lucide-react";
import { Badge, Button, Card, CardHeader, CodeBlock, Disclosure, EmptyState } from "../../ui/primitives";
import { useToast } from "../../ui/feedback";
import { NodeStatusBadge, RunStatusBadge, StepStatusBadge } from "../../ui/status";
import { durationBetween, formatDuration, humanize } from "../../lib/format";
import { navigate } from "../../lib/router";
import type { AgentArchitecture, ExecutionSnapshot, StepResult, WorkflowGraph } from "../../types/chainreact";
import { OutputChips, deriveNodeStatus, labelForNode, latestStepByNode, nodeTypeIcon } from "./ExecutionTimeline";

export interface ExecutionResultsProps {
  run: ExecutionSnapshot;
  workflow?: WorkflowGraph | null;
  architecture?: AgentArchitecture | null;
  onRunAgain?: () => void;
  /** Hide "View execution details" when already on the detail page. */
  hideDetailsLink?: boolean;
}

/** Fields the run produced: everything in the final context that wasn't part of the input. */
export function producedOutput(run: Pick<ExecutionSnapshot, "final_context" | "input_data">): Record<string, unknown> {
  const inputKeys = new Set(Object.keys(run.input_data ?? {}));
  return Object.fromEntries(Object.entries(run.final_context ?? {}).filter(([k]) => !inputKeys.has(k)));
}

type Shape =
  | { kind: "number"; value: string }
  | { kind: "category"; value: string }
  | { kind: "text"; value: string }
  | { kind: "table"; rows: Record<string, unknown>[]; columns: string[] }
  | { kind: "json"; value: unknown }
  | { kind: "empty" };

function isFlatObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every((x) => x === null || typeof x !== "object");
}

function classify(raw: unknown): Shape {
  let v = raw;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return { kind: "empty" };
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        v = JSON.parse(t);
      } catch {
        v = t;
      }
    }
  }
  if (v === null || v === undefined) return { kind: "empty" };
  if (typeof v === "number") return { kind: "number", value: String(v) };
  if (typeof v === "boolean") return { kind: "category", value: v ? "true" : "false" };
  if (typeof v === "string") {
    if (/^-?\d+(\.\d+)?%?$/.test(v.trim())) return { kind: "number", value: v.trim() };
    const words = v.trim().split(/\s+/).length;
    if (v.length <= 40 && words <= 4 && !/[.!?]\s/.test(v)) return { kind: "category", value: v };
    return { kind: "text", value: v };
  }
  if (Array.isArray(v) && v.length > 0 && v.every(isFlatObject)) {
    const columns = Array.from(new Set(v.flatMap((r) => Object.keys(r as object))));
    if (columns.length <= 8) return { kind: "table", rows: v as Record<string, unknown>[], columns };
  }
  return { kind: "json", value: v };
}

function cell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function OutputView({ output }: { output: Record<string, unknown> }) {
  const entries = Object.entries(output).map(([k, v]) => ({ key: k, shape: classify(v) }));
  const tiles = entries.filter((e) => e.shape.kind === "number" || e.shape.kind === "category" || e.shape.kind === "empty");
  const blocks = entries.filter((e) => !tiles.includes(e));

  return (
    <div className="stack gap-5">
      {tiles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
          {tiles.map(({ key, shape }) => (
            <div key={key} className="stack gap-2" style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface-2)", minWidth: 0 }}>
              <span className="text-xs text-tertiary truncate" title={key}>{humanize(key)}</span>
              {shape.kind === "number" && (
                <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{shape.value}</span>
              )}
              {shape.kind === "category" && (
                <span>
                  <Badge tone="accent">{shape.value}</Badge>
                </span>
              )}
              {shape.kind === "empty" && <span className="text-tertiary">-</span>}
            </div>
          ))}
        </div>
      )}
      {blocks.map(({ key, shape }) => (
        <div key={key} className="stack gap-2" style={{ minWidth: 0 }}>
          <span className="row gap-2">
            <span className="text-sm" style={{ fontWeight: 600 }}>{humanize(key)}</span>
            <span className="mono text-xs text-tertiary">{key}</span>
          </span>
          {shape.kind === "text" && (
            <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text-secondary)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: 820 }}>{shape.value}</p>
          )}
          {shape.kind === "table" && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {shape.columns.map((c) => (
                      <th key={c}>{humanize(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shape.rows.map((r, i) => (
                    <tr key={i}>
                      {shape.columns.map((c) => (
                        <td key={c}>{cell(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shape.kind === "json" && <CodeBlock maxHeight={320}>{JSON.stringify(shape.value, null, 2)}</CodeBlock>}
        </div>
      ))}
    </div>
  );
}

function SummaryCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack gap-1" style={{ minWidth: 0 }}>
      <span className="text-xs text-tertiary">{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}

function agentPurpose(step: StepResult, workflow?: WorkflowGraph | null, architecture?: AgentArchitecture | null): string | null {
  const agentId = workflow?.nodes.find((n) => n.id === step.node_id)?.agent ?? step.node_id;
  return architecture?.agents.find((a) => a.id === agentId)?.purpose ?? null;
}

export default function ExecutionResults({ run, workflow, architecture, onRunAgain, hideDetailsLink }: ExecutionResultsProps) {
  const toast = useToast();
  const output = useMemo(() => producedOutput(run), [run]);
  const steps = run.steps ?? [];

  const toolCalls = steps.flatMap((s) => s.tool_call_details.map((c) => ({ step: s, call: c })));
  const realCount = toolCalls.filter((t) => t.call.real).length;
  const simulatedCount = toolCalls.filter((t) => !t.call.real).length;
  const problemSteps = steps.filter((s) => s.status === "failed" || s.status === "blocked");
  const agentSteps = steps.filter((s) => s.type === "agent");
  const agentsInvolved = new Set(agentSteps.map((s) => s.node_id)).size;
  const duration = durationBetween(run.created_at, run.completed_at);
  const latest = latestStepByNode(steps);
  const nodeStatus = deriveNodeStatus(workflow, steps, run.status, run.running_nodes ?? []);
  const validationIds = workflow ? workflow.nodes.map((n) => n.id) : Array.from(latest.keys());

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      toast({ tone: "success", title: "Result copied", description: `${Object.keys(output).length} produced field(s) copied as JSON.` });
    } catch {
      toast({ tone: "error", title: "Could not copy", description: "Clipboard access was blocked by the browser." });
    }
  }

  function downloadJson() {
    const payload = {
      run_id: run.run_id,
      system_id: run.system_id,
      process_name: run.process_name,
      status: run.status,
      created_at: run.created_at,
      completed_at: run.completed_at,
      input_data: run.input_data,
      output,
      final_context: run.final_context,
      steps: run.steps,
      step_times: run.step_times,
      error: run.error ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-${run.run_id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="stack gap-4" style={{ minWidth: 0 }}>
      <Card>
        <CardHeader
          icon={run.status === "failed" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          title="Execution result"
          description={run.process_name}
          actions={<RunStatusBadge status={run.status} />}
        />
        <div className="card-body stack gap-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            <SummaryCell label="Duration">{formatDuration(duration)}</SummaryCell>
            <SummaryCell label="Steps">{steps.length}</SummaryCell>
            <SummaryCell label="Agents involved">
              {agentsInvolved}
              {run.agent_count != null && <span className="text-tertiary" style={{ fontWeight: 400 }}> / {run.agent_count}</span>}
            </SummaryCell>
            <SummaryCell label="Real tool calls">{realCount}</SummaryCell>
            <SummaryCell label="Simulated calls">{simulatedCount}</SummaryCell>
            <SummaryCell label="Blocked / failed">
              <span style={{ color: problemSteps.length ? "var(--danger)" : undefined }}>{problemSteps.length}</span>
            </SummaryCell>
          </div>
          <div className="row wrap gap-2">
            <Button size="sm" icon={<ClipboardCopy size={14} />} onClick={copyResult}>
              Copy result
            </Button>
            <Button size="sm" icon={<Download size={14} />} onClick={downloadJson}>
              Download JSON
            </Button>
            {!hideDetailsLink && (
              <Button size="sm" variant="ghost" icon={<ArrowUpRight size={14} />} onClick={() => navigate(`/executions/${run.run_id}`)}>
                View execution details
              </Button>
            )}
            {onRunAgain && (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={onRunAgain}>
                Run again
              </Button>
            )}
          </div>
        </div>
      </Card>

      {(run.error || problemSteps.length > 0 || simulatedCount > 0) && (
        <Card>
          <CardHeader icon={<AlertTriangle size={16} />} title="Warnings & errors" />
          <div className="card-body stack gap-3">
            {run.error && (
              <div className="row gap-2" style={{ alignItems: "flex-start", color: "var(--danger)" }}>
                <XCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span className="text-sm" style={{ overflowWrap: "anywhere" }}>{run.error}</span>
              </div>
            )}
            {problemSteps.map((s, i) => (
              <div key={i} className="row wrap gap-2" style={{ alignItems: "flex-start" }}>
                <StepStatusBadge status={s.status} />
                <span className="text-sm" style={{ fontWeight: 600 }}>{s.label}</span>
                {s.note && <span className="text-sm text-secondary" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{s.note}</span>}
              </div>
            ))}
            {simulatedCount > 0 && (
              <div className="row gap-2 text-sm text-secondary" style={{ alignItems: "flex-start" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2, color: "var(--warning)" }} />
                <span>
                  {simulatedCount} tool call{simulatedCount === 1 ? " was" : "s were"} simulated, not performed against a real service. Connect the integration and enable
                  real actions to perform them.
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader icon={<FileOutput size={16} />} title="Output" description="Fields this run produced, beyond the input it was given" />
        <div className="card-body">
          {Object.keys(output).length > 0 ? (
            <OutputView output={output} />
          ) : (
            <EmptyState title="No new fields produced" description="The final data record contains only the input fields." />
          )}
        </div>
      </Card>

      {agentSteps.some((s) => s.output && Object.keys(s.output).length > 0) && (
        <Card>
          <CardHeader icon={<Users size={16} />} title="Agent contributions" />
          <div className="card-body stack gap-4">
            {agentSteps
              .filter((s) => s.output && Object.keys(s.output).length > 0)
              .map((s, i) => {
                const purpose = agentPurpose(s, workflow, architecture);
                return (
                  <div key={i} className="stack gap-2" style={{ minWidth: 0 }}>
                    <div className="row wrap gap-2">
                      <span style={{ fontWeight: 600 }}>{s.label}</span>
                      <StepStatusBadge status={s.status} />
                    </div>
                    {purpose && <span className="text-sm text-tertiary">{purpose}</span>}
                    <OutputChips output={s.output as Record<string, unknown>} />
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader icon={<Wrench size={16} />} title="Tool execution results" description={`${toolCalls.length} call${toolCalls.length === 1 ? "" : "s"}`} />
        {toolCalls.length > 0 ? (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Capability</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {toolCalls.map(({ step, call }, i) => (
                  <tr key={i}>
                    <td>{step.label}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{call.capability}</td>
                    <td>
                      <Badge tone={call.real ? "success" : "outline"}>{call.real ? "REAL" : "SIMULATED"}</Badge>
                    </td>
                    <td>
                      <Badge tone={call.status === "ok" ? "success" : call.status === "simulated" ? "warning" : "danger"}>{humanize(call.status)}</Badge>
                    </td>
                    <td className="text-sm text-secondary" style={{ minWidth: 200 }}>{call.detail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body text-sm text-tertiary">No tool calls were made in this run.</div>
        )}
      </Card>

      <Disclosure title="Final data record" icon={<Braces size={15} />} meta={`${Object.keys(run.final_context ?? {}).length} fields`}>
        <CodeBlock maxHeight={360}>{JSON.stringify(run.final_context ?? {}, null, 2)}</CodeBlock>
      </Disclosure>

      <Card>
        <CardHeader icon={<ListChecks size={16} />} title="Validation" description="Outcome of every node in the workflow" />
        <div className="card-body stack gap-1">
          {validationIds.map((id) => {
            const status = nodeStatus[id];
            const step = latest.get(id);
            const pass = status === "completed" || status === "simulated";
            const type = step?.type ?? workflow?.nodes.find((n) => n.id === id)?.type ?? "agent";
            return (
              <div key={id} className="row gap-3" style={{ padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", minWidth: 0 }}>
                <span className="row" style={{ color: pass ? "var(--success)" : status === "skipped" ? "var(--text-tertiary)" : "var(--danger)", flexShrink: 0 }}>
                  {pass ? <CheckCircle2 size={15} /> : status === "skipped" ? nodeTypeIcon(type, 15) : <XCircle size={15} />}
                </span>
                <span className="truncate grow text-sm" style={{ minWidth: 0 }}>{step?.label ?? labelForNode(id, workflow)}</span>
                {status && <NodeStatusBadge status={status} />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
