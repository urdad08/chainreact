import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, FileSpreadsheet, ListTree, Loader2, Play, Sparkles, Upload, Workflow } from "lucide-react";
import WorkflowVisualizer from "../WorkflowVisualizer";
import ExecutionTimeline, { ApprovalCard, ExecutionPlan, deriveNodeStatus, labelForNode, latestStepByNode } from "./ExecutionTimeline";
import ExecutionResults, { producedOutput } from "./ExecutionResults";
import { Badge, Button, Card, CardHeader, Disclosure, Field, Switch } from "../../ui/primitives";
import { useToast } from "../../ui/feedback";
import { RunStatusBadge } from "../../ui/status";
import { ApiError, approveExecution, executionStreamUrl, getExecution, startExecution } from "../../api/client";
import { ALLOW_REAL_ACTIONS_KEY, usePref } from "../../lib/prefs";
import { durationBetween, formatDateTime, formatDuration, shortId } from "../../lib/format";
import { routeHref } from "../../lib/router";
import type { AgentArchitecture, ExecutionSnapshot, ExecutionStreamEvent, RunStatus, StepResult, WorkflowGraph } from "../../types/chainreact";

// Minimal CSV parser -- handles double-quoted fields with embedded commas
// (ticket/feedback text routinely contains commas), good enough for a
// demo-scale upload. Not a full RFC4180 implementation.
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  };
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) };
}

export function SampleValueHint(field: string): string {
  const lower = field.toLowerCase();
  if (lower.includes("email")) return "ada@example.com";
  if (lower.includes("name")) return "Ada Lovelace";
  if (lower.includes("company")) return "Analytical Engines Ltd";
  if (lower.includes("phone")) return "555-0100";
  if (lower.includes("title")) return "VP of Engineering";
  if (lower.includes("source")) return "website_form";
  return "sample value";
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

interface BatchRowResult {
  rowIndex: number;
  inputData: Record<string, string>;
  status: RunStatus | "error";
  runId?: string;
  finalContext?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionConsoleProps {
  systemId: string;
  processName: string;
  workflow: WorkflowGraph;
  architecture: AgentArchitecture;
  inputFields: string[];
  onRunFinished?: (runId: string) => void;
}

const MAX_STREAM_RETRIES = 5;

export default function ExecutionConsole({ systemId, processName, workflow, architecture, inputFields, onRunFinished }: ExecutionConsoleProps) {
  const toast = useToast();
  const fields = useMemo(() => (inputFields.length > 0 ? inputFields : ["name", "email", "company"]), [inputFields]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, ""])));
  const [allowRealTools, setAllowRealTools] = usePref<boolean>(ALLOW_REAL_ACTIONS_KEY, true);
  const [autoApprove, setAutoApprove] = useState(false);

  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [stepTimes, setStepTimes] = useState<string[]>([]);
  const [runningNodes, setRunningNodes] = useState<string[]>([]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [localStart, setLocalStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const generationRef = useRef(0);
  const stepCountRef = useRef(0);
  const mountedRef = useRef(true);
  const runIdRef = useRef<string | null>(null);
  const onRunFinishedRef = useRef(onRunFinished);
  onRunFinishedRef.current = onRunFinished;

  const [batchFileName, setBatchFileName] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchRowResult[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    setValues((prev) => Object.fromEntries(fields.map((f) => [f, prev[f] ?? ""])));
  }, [fields]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current++;
      eventSourceRef.current?.close();
    };
  }, []);

  const inFlight = status === "running" || status === "waiting_approval";

  useEffect(() => {
    if (!inFlight) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [inFlight]);

  const finish = useCallback(
    async (id: string, finalStatus: RunStatus, err?: string | null) => {
      if (finalStatus === "waiting_approval") {
        toast({ tone: "warning", title: "Waiting for approval", description: "The run paused at a human-approval gate." });
        return;
      }
      toast(
        finalStatus === "completed"
          ? { tone: "success", title: "Run completed", description: `${processName} finished.` }
          : { tone: "error", title: "Run failed", description: err ?? "See the timeline for the failing step." }
      );
      onRunFinishedRef.current?.(id);
      try {
        const snap = await getExecution(id);
        if (mountedRef.current && runIdRef.current === id) {
          setSnapshot(snap);
          setCreatedAt(snap.created_at);
          setCompletedAt(snap.completed_at);
        }
      } catch (e) {
        if (mountedRef.current) setError(errorMessage(e, "Could not load the final run record."));
      }
    },
    [processName, toast]
  );

  const connectStream = useCallback(
    (id: string, attempt = 0) => {
      eventSourceRef.current?.close();
      const generation = ++generationRef.current;
      const es = new EventSource(executionStreamUrl(id));
      eventSourceRef.current = es;
      let received = 0;
      es.onmessage = (event) => {
        if (generation !== generationRef.current) return;
        let payload: ExecutionStreamEvent;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "step") {
          // The stream replays every step from the start on each connection; keep only new ones.
          const index = received++;
          if (index < stepCountRef.current) return;
          stepCountRef.current = index + 1;
          setSteps((prev) => [...prev, payload.step]);
          setStepTimes((prev) => [...prev, payload.at]);
        } else if (payload.type === "running") {
          setRunningNodes(payload.node_ids);
        } else if (payload.type === "done") {
          es.close();
          eventSourceRef.current = null;
          setRunningNodes([]);
          setStatus(payload.status);
          setCompletedAt(payload.completed_at ?? null);
          if (payload.error) setError(payload.error);
          void finish(id, payload.status, payload.error);
        }
      };
      es.onerror = () => {
        if (generation !== generationRef.current) return;
        es.close();
        eventSourceRef.current = null;
        if (attempt >= MAX_STREAM_RETRIES) {
          setError("Lost the live connection to this run. Open the execution details to see its latest state.");
          return;
        }
        window.setTimeout(() => {
          if (generation === generationRef.current && mountedRef.current) connectStream(id, attempt + 1);
        }, 1000 * (attempt + 1));
      };
    },
    [finish]
  );

  function fillSampleData() {
    setValues(Object.fromEntries(fields.map((f) => [f, SampleValueHint(f)])));
  }

  async function handleRun() {
    generationRef.current++;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    stepCountRef.current = 0;
    setError(null);
    setSteps([]);
    setStepTimes([]);
    setRunningNodes([]);
    setSnapshot(null);
    setCreatedAt(null);
    setCompletedAt(null);
    setStarting(true);
    runIdRef.current = null;
    try {
      const { run_id } = await startExecution(systemId, values, autoApprove, allowRealTools);
      runIdRef.current = run_id;
      setRunId(run_id);
      setStatus("running");
      setLocalStart(Date.now());
      connectStream(run_id);
      getExecution(run_id)
        .then((snap) => {
          if (mountedRef.current && runIdRef.current === run_id) setCreatedAt(snap.created_at);
        })
        .catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e, "Could not start execution."));
      setStatus(null);
      setRunId(null);
    } finally {
      setStarting(false);
    }
  }

  async function handleDecision(approved: boolean) {
    if (!runId) return;
    try {
      await approveExecution(runId, approved);
      setStatus("running");
      setError(null);
      toast({ tone: approved ? "success" : "info", title: approved ? "Approved" : "Rejected", description: "The run is resuming." });
      connectStream(runId);
    } catch (e) {
      toast({ tone: "error", title: "Could not record the decision", description: errorMessage(e, "Approval failed.") });
    }
  }

  async function handleBatchFile(file: File) {
    setBatchError(null);
    setBatchResults([]);
    setBatchFileName(file.name);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.headers.length === 0 || parsed.rows.length === 0) throw new Error("That file has no rows to run.");
      setBatchRows(parsed);
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : "Could not read that file.");
      setBatchRows(null);
    }
  }

  async function waitForTerminal(id: string, timeoutMs = 120000): Promise<ExecutionSnapshot> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await getExecution(id);
      if (snap.status !== "running") return snap;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error("Timed out waiting for this row to finish.");
  }

  async function handleRunBatch() {
    if (!batchRows) return;
    setBatchRunning(true);
    setBatchError(null);
    setBatchResults([]);
    const { headers, rows } = batchRows;
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!mountedRef.current) return;
      const rowData: Record<string, string> = {};
      headers.forEach((h, col) => {
        rowData[h] = rows[i][col] ?? "";
      });
      let rowRunId: string | undefined;
      try {
        const { run_id } = await startExecution(systemId, rowData, true, allowRealTools);
        rowRunId = run_id;
        const snap = await waitForTerminal(run_id);
        if (snap.status === "completed") ok++;
        setBatchResults((prev) => [...prev, { rowIndex: i, inputData: rowData, status: snap.status, runId: run_id, finalContext: producedOutput(snap), error: snap.error ?? undefined }]);
      } catch (e) {
        setBatchResults((prev) => [...prev, { rowIndex: i, inputData: rowData, status: "error", runId: rowRunId, error: errorMessage(e, "Failed to run this row.") }]);
      }
    }
    if (!mountedRef.current) return;
    setBatchRunning(false);
    toast({ tone: ok === rows.length ? "success" : "warning", title: "Batch finished", description: `${ok} of ${rows.length} rows completed.` });
  }

  const hasValues = Object.values(values).some((v) => v.trim() !== "");
  const nodeStatus = useMemo(() => deriveNodeStatus(workflow, steps, status, runningNodes), [workflow, steps, status, runningNodes]);
  const latest = useMemo(() => latestStepByNode(steps), [steps]);
  const counts = useMemo(() => {
    const c = { completed: 0, failed: 0, blocked: 0, simulated: 0, approval: 0 };
    latest.forEach((s) => {
      if (s.status === "ok") c.completed++;
      else if (s.status === "failed") c.failed++;
      else if (s.status === "blocked") c.blocked++;
      else if (s.status === "simulated") c.simulated++;
      else if (s.status === "waiting_approval" && status === "waiting_approval") c.approval++;
    });
    return c;
  }, [latest, status]);
  const gateStep = useMemo(() => [...steps].reverse().find((s) => s.status === "waiting_approval") ?? null, [steps]);

  const elapsedMs = inFlight ? (localStart !== null ? now - localStart : null) : durationBetween(createdAt, completedAt);

  const terminal = status === "completed" || status === "failed";

  return (
    <div className="stack gap-4" style={{ minWidth: 0 }}>
      <Card>
        <CardHeader icon={<Play size={16} />} title="Run this system" description="Execute the real workflow on one record and watch each step as it completes." />
        <div className="card-body stack gap-4">
          <div className="grid grid-2 gap-3">
            {fields.map((field) => (
              <Field key={field} label={<span className="mono">{field}</span>} htmlFor={`exec-field-${field}`}>
                <input
                  id={`exec-field-${field}`}
                  className="input"
                  value={values[field] ?? ""}
                  onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                  placeholder={SampleValueHint(field)}
                  disabled={inFlight || starting}
                />
              </Field>
            ))}
          </div>
          <div className="stack gap-2">
            <Switch
              checked={allowRealTools}
              onChange={setAllowRealTools}
              disabled={inFlight || starting}
              label="Perform real actions where connected (Gmail / Calendar / Slack / HTTP)"
            />
            <Switch checked={autoApprove} onChange={setAutoApprove} disabled={inFlight || starting} label="Auto-approve approval gates" />
          </div>
          <div className="row wrap gap-2">
            <Button variant="ghost" icon={<Sparkles size={14} />} onClick={fillSampleData} disabled={inFlight || starting}>
              Fill sample data
            </Button>
            <span className="spacer" />
            <Button variant="primary" icon={<Play size={14} />} onClick={handleRun} loading={starting} disabled={inFlight || !hasValues}>
              {inFlight ? "Run in progress" : "Run system"}
            </Button>
          </div>
          {error && !runId && <div className="text-sm text-danger">{error}</div>}

          <Disclosure title="Run on many records from a CSV" icon={<FileSpreadsheet size={15} />} meta={batchRows ? `${batchRows.rows.length} rows loaded` : undefined}>
            <div className="stack gap-3">
              <span className="text-sm text-secondary">
                Each row runs through the same real execution, one after another. Approval gates are auto-approved so a batch doesn&apos;t stop partway.
              </span>
              <div className="row wrap gap-3">
                <label className="btn btn-sm" style={{ cursor: batchRunning ? "not-allowed" : "pointer", opacity: batchRunning ? 0.6 : 1 }}>
                  <Upload size={14} />
                  Choose CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={batchRunning}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleBatchFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {batchFileName && <span className="mono text-xs text-secondary truncate" style={{ minWidth: 0 }}>{batchFileName}</span>}
                {batchRows && (
                  <Button size="sm" variant="primary" onClick={handleRunBatch} loading={batchRunning}>
                    {batchRunning ? `Running ${batchResults.length + 1} / ${batchRows.rows.length}` : `Run all ${batchRows.rows.length} rows`}
                  </Button>
                )}
              </div>
              <span className="field-hint">
                Expected columns: <span className="mono">{fields.join(", ")}</span>
              </span>
              {batchError && <div className="text-sm text-danger">{batchError}</div>}
              {batchResults.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Input</th>
                        <th>Status</th>
                        <th>Result</th>
                        <th>Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="mono text-xs">{r.rowIndex + 1}</td>
                          <td className="truncate" style={{ maxWidth: 220 }} title={Object.values(r.inputData).join(" / ")}>
                            {Object.values(r.inputData).join(" / ")}
                          </td>
                          <td>{r.status === "error" ? <Badge tone="danger">Error</Badge> : <RunStatusBadge status={r.status} />}</td>
                          <td className="truncate text-sm text-secondary" style={{ maxWidth: 300 }}>
                            {r.error ?? (r.finalContext && Object.keys(r.finalContext).length ? Object.entries(r.finalContext).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ") : "—")}
                          </td>
                          <td>
                            {r.runId ? (
                              <a className="mono text-xs" href={routeHref(`/executions/${r.runId}`)}>
                                {shortId(r.runId)}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Disclosure>
        </div>
      </Card>

      {runId && status && (
        <Card>
          <div className="card-header" style={{ flexWrap: "wrap" }}>
            <div className="row wrap gap-3" style={{ minWidth: 0 }}>
              <Activity size={16} className="text-secondary" />
              <h3>Live execution</h3>
              <RunStatusBadge status={status} />
              <a className="chip mono" href={routeHref(`/executions/${runId}`)} title="Open execution details">
                {shortId(runId)}
              </a>
            </div>
            <div className="row wrap gap-3 text-sm text-secondary">
              <span>
                Elapsed <span className="mono" style={{ color: "var(--text)" }}>{formatDuration(elapsedMs)}</span>
              </span>
              {createdAt && <span className="text-tertiary">Started {formatDateTime(createdAt)}</span>}
              {completedAt && <span className="text-tertiary">Ended {formatDateTime(completedAt)}</span>}
            </div>
          </div>
          <div className="card-body stack gap-4">
            <div className="row wrap gap-2">
              <Badge tone="success">{counts.completed} completed</Badge>
              <Badge tone={counts.failed ? "danger" : "outline"}>{counts.failed} failed</Badge>
              <Badge tone={counts.blocked ? "danger" : "outline"}>{counts.blocked} blocked</Badge>
              <Badge tone={counts.simulated ? "warning" : "outline"}>{counts.simulated} simulated</Badge>
              <Badge tone={counts.approval ? "warning" : "outline"}>{counts.approval} pending approval</Badge>
            </div>

            {status === "running" && runningNodes.length > 0 && (
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

            {status === "waiting_approval" && <ApprovalCard step={gateStep} onDecide={handleDecision} />}
            {error && <div className="text-sm text-danger">{error}</div>}

            <WorkflowVisualizer graph={workflow} nodeStatus={nodeStatus} height={320} />

            <div className="row wrap gap-5" style={{ alignItems: "flex-start" }}>
              <div className="stack gap-3" style={{ flex: "3 1 420px", minWidth: 0 }}>
                <span className="eyebrow row gap-2">
                  <Workflow size={12} /> Activity
                </span>
                <ExecutionTimeline
                  steps={steps}
                  stepTimes={stepTimes}
                  startedAt={createdAt}
                  live
                  emptyText={status === "running" ? "Waiting for the first step to complete." : "No steps were recorded."}
                />
              </div>
              <div className="stack gap-3" style={{ flex: "1 1 260px", minWidth: 0 }}>
                <span className="eyebrow row gap-2">
                  <ListTree size={12} /> Plan
                </span>
                <ExecutionPlan workflow={workflow} nodeStatus={nodeStatus} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {terminal && snapshot && snapshot.run_id === runId && (
        <ExecutionResults run={snapshot} workflow={workflow} architecture={architecture} onRunAgain={hasValues ? handleRun : undefined} />
      )}
    </div>
  );
}
