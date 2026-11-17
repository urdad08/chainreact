import { useState } from "react";
import { Download, FileSpreadsheet, Gauge, Upload } from "lucide-react";
import N8nNotificationBadge from "./N8nNotificationBadge";
import { processLeadCsv, scoreLead } from "../api/client";
import { Badge, Button } from "../ui/primitives";
import type { LeadCSVResult, LeadScoreResult } from "../types/chainreact";

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function priorityTone(priority: string): "danger" | "warning" | "success" | "neutral" {
  const p = priority.toLowerCase();
  if (p.includes("high") || p.includes("hot")) return "danger";
  if (p.includes("medium") || p.includes("warm")) return "warning";
  if (p.includes("low") || p.includes("cold")) return "success";
  return "neutral";
}

export default function LeadCsvRunner() {
  const [lead, setLead] = useState({ name: "", contact: "", email: "" });
  const [leadScore, setLeadScore] = useState<LeadScoreResult | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [salesRepsText, setSalesRepsText] = useState("");
  const [result, setResult] = useState<LeadCSVResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleScoreLead(event: React.FormEvent) {
    event.preventDefault();
    setScoring(true);
    setLeadError(null);
    setLeadScore(null);
    try {
      setLeadScore(await scoreLead(lead));
    } catch (e) {
      setLeadError(e instanceof Error ? e.message : "Could not score this lead.");
    } finally {
      setScoring(false);
    }
  }

  async function handleProcess() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const csvText = await file.text();
      const salesReps = salesRepsText.split(",").map((name) => name.trim()).filter(Boolean);
      setResult(await processLeadCsv(csvText, salesReps));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process this CSV file.");
    } finally {
      setLoading(false);
    }
  }

  function downloadResults() {
    if (!result || result.records.length === 0) return;
    const headers = Object.keys(result.records[0]);
    const csv = [headers.map(csvCell).join(","), ...result.records.map((record) => headers.map((header) => csvCell(record[header])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "qualified-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const headers = result ? Object.keys(result.records[0] ?? {}) : [];

  return (
    <section aria-labelledby="lead-csv-title" className="card">
      <div className="card-header">
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className="text-secondary row">
            <FileSpreadsheet size={16} />
          </span>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h3 id="lead-csv-title">Process your lead data</h3>
            <span className="text-sm text-tertiary">
              Score a single lead, or upload a CSV with <code>name</code> and <code>email</code> columns. The lead
              qualification rules add a score, priority, validation note, and optional round-robin owner.
            </span>
          </div>
        </div>
      </div>

      <div className="card-body stack gap-5">
        <form onSubmit={handleScoreLead} className="stack gap-3">
          <div className="eyebrow">Single lead</div>
          <div className="grid grid-3" style={{ gap: "var(--sp-3)" }}>
            {([
              ["name", "Name", "Full name", "text"],
              ["contact", "Contact", "Phone or contact number", "tel"],
              ["email", "Email", "name@example.com", "email"],
            ] as const).map(([key, label, placeholder, type]) => (
              <label key={key} className="field">
                <span className="field-label">{label}</span>
                <input
                  className="input"
                  type={type}
                  value={lead[key]}
                  onChange={(event) => setLead({ ...lead, [key]: event.target.value })}
                  placeholder={placeholder}
                  required
                />
              </label>
            ))}
          </div>
          <div className="row gap-3 wrap">
            <Button type="submit" variant="primary" loading={scoring} icon={<Gauge size={14} />}>
              {scoring ? "Scoring lead…" : "Process lead score"}
            </Button>
            {leadError && (
              <span role="alert" className="text-sm text-danger">
                {leadError}
              </span>
            )}
          </div>
          {leadScore && (
            <div role="status" className="card card-muted" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
              <div className="row gap-4 wrap">
                <div className="stack" style={{ gap: 0 }}>
                  <span className="text-xs text-tertiary">Lead score</span>
                  <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {leadScore.lead_score}
                    <span className="text-sm text-tertiary" style={{ fontWeight: 500 }}>/100</span>
                  </span>
                </div>
                <div className="stack gap-1">
                  <span className="text-xs text-tertiary">Priority</span>
                  <Badge tone={priorityTone(String(leadScore.priority))}>{leadScore.priority}</Badge>
                </div>
              </div>
              {leadScore.validation_errors && (
                <p className="text-sm text-warning" style={{ marginTop: 8 }}>
                  {leadScore.validation_errors}
                </p>
              )}
              <N8nNotificationBadge outcome={leadScore.n8n_notification} />
            </div>
          )}
        </form>

        <hr className="divider" />

        <div className="stack gap-3">
          <div className="eyebrow">Batch CSV</div>
          <div className="grid grid-2" style={{ gap: "var(--sp-3)", alignItems: "end" }}>
            <label className="field">
              <span className="field-label">Lead CSV (2 MB maximum)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
                style={{ minWidth: 0, maxWidth: "100%" }}
              />
            </label>
            <label className="field">
              <span className="field-label">Sales representatives (optional, comma-separated)</span>
              <input
                className="input"
                value={salesRepsText}
                onChange={(event) => setSalesRepsText(event.target.value)}
                placeholder="Jordan Lee, Casey Kim"
              />
            </label>
          </div>
          <div className="row gap-3 wrap">
            <Button variant="primary" onClick={handleProcess} disabled={!file} loading={loading} icon={<Upload size={14} />}>
              {loading ? "Processing rows…" : "Process CSV"}
            </Button>
            {file && <span className="chip truncate" style={{ maxWidth: 240 }}>{file.name}</span>}
            <span className="text-xs text-tertiary">Uploaded for in-memory processing; lead rows are not stored.</span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        {result && (
          <div className="stack gap-2">
            <div className="row gap-3 wrap" style={{ justifyContent: "space-between" }}>
              <strong className="text-sm">
                {result.total} lead{result.total === 1 ? "" : "s"} processed
              </strong>
              <Button size="sm" icon={<Download size={14} />} onClick={downloadResults} disabled={result.records.length === 0}>
                Download results CSV
              </Button>
            </div>
            {headers.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
                <table className="table" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr>
                      {headers.map((header) => (
                        <th key={header} style={{ position: "sticky", top: 0 }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.records.slice(0, 100).map((record, index) => (
                      <tr key={index}>
                        {headers.map((header) => (
                          <td key={header} style={{ padding: "7px 14px" }}>
                            {record[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.total > 100 && (
              <p className="text-xs text-tertiary">Previewing the first 100 rows. The download contains all {result.total} rows.</p>
            )}
            <N8nNotificationBadge outcome={result.n8n_notification} />
          </div>
        )}
      </div>
    </section>
  );
}
