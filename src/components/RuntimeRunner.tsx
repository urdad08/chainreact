import { useState } from "react";
import { ApiError, runExecution } from "../api/client";
import type { PipelineResult, RuntimeExecutionResult, StepResult } from "../types/chainreact";

const TYPE_ICON: Record<StepResult["type"], string> = {
  start: "▶",
  end: "■",
  agent: "🤖",
  tool: "🔧",
  human_approval: "⏸",
};

function SampleValueHint(field: string): string {
  const lower = field.toLowerCase();
  if (lower.includes("email")) return "ada@example.com";
  if (lower.includes("name")) return "Ada Lovelace";
  if (lower.includes("company")) return "Analytical Engines Ltd";
  if (lower.includes("phone")) return "555-0100";
  if (lower.includes("title")) return "VP of Engineering";
  if (lower.includes("source")) return "website_form";
  return "sample value";
}

export default function RuntimeRunner({ result }: { result: PipelineResult }) {
  const fields = result.process_spec.input_data.length > 0
    ? result.process_spec.input_data
    : ["name", "email", "company"]; // fallback if the spec didn't declare any

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, ""]))
  );
  const [autoApprove, setAutoApprove] = useState(true);
  const [loading, setLoading] = useState(false);
  const [execution, setExecution] = useState<RuntimeExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fillSampleData() {
    setValues(Object.fromEntries(fields.map((f) => [f, SampleValueHint(f)])));
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setExecution(null);
    try {
      const res = await runExecution(result, values, autoApprove);
      setExecution(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Execution failed");
    } finally {
      setLoading(false);
    }
  }

  const hasValues = Object.values(values).some((v) => v.trim() !== "");

  return (
    <div>
      <h3 style={{ margin: "0 0 4px 0" }}>Run with sample data</h3>
      <p style={{ fontSize: 13, color: "#777", margin: "0 0 12px 0" }}>
        Each agent actually runs (via the LLM) on this sample record, so you can watch real
        values -- a score, an assignment -- accumulate step by step. This calls the LLM once
        per agent.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {fields.map((field) => (
          <div key={field}>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 2 }}>{field}</label>
            <input
              value={values[field] ?? ""}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              placeholder={SampleValueHint(field)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #d0d0d8",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <button
          type="button"
          onClick={fillSampleData}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d0d0d8",
            background: "#fff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Fill sample data
        </button>

        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
          Auto-approve human-approval gates
        </label>

        <button
          type="button"
          onClick={handleRun}
          disabled={loading || !hasValues}
          style={{
            marginLeft: "auto",
            padding: "8px 18px",
            borderRadius: 8,
            border: "none",
            background: loading || !hasValues ? "#999" : "#0f9d58",
            color: "white",
            fontWeight: 600,
            cursor: loading || !hasValues ? "default" : "pointer",
          }}
        >
          {loading ? "Running..." : "Run process"}
        </button>
      </div>

      {error && <div style={{ color: "#c0341d", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {execution && (
        <div>
          {execution.halted_at_approval && (
            <div
              style={{
                background: "#fff8ec",
                border: "1px solid #f0c26b",
                color: "#8a6d00",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              ⏸ Execution halted -- a human-approval gate was rejected (uncheck "auto-approve" was
              on, or try again with it checked to see the full run).
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {execution.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  border: "1px solid #e2e2ea",
                  borderRadius: 8,
                  padding: "10px 14px",
                  background: "#fafafe",
                }}
              >
                <div style={{ fontSize: 18 }}>{TYPE_ICON[step.type]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{step.label}</div>
                  {step.note && <div style={{ fontSize: 12, color: "#777" }}>{step.note}</div>}
                  {step.tool_calls.length > 0 && (
                    <div style={{ fontSize: 12, color: "#5b3df0", marginTop: 4 }}>
                      tools: {step.tool_calls.join(", ")}
                    </div>
                  )}
                  {step.output && Object.keys(step.output).length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      {Object.entries(step.output).map(([k, v]) => (
                        <span
                          key={k}
                          style={{
                            display: "inline-block",
                            background: "#eafbf0",
                            color: "#1a7f37",
                            borderRadius: 6,
                            padding: "2px 8px",
                            marginRight: 6,
                            marginTop: 4,
                          }}
                        >
                          {k} = {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5b3df0" }}>
              Final data record
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: "#faf9ff",
                border: "1px solid #e2e2ea",
                borderRadius: 8,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(execution.final_context, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
