import { useState } from "react";
import { processLeadCsv, scoreLead } from "../api/client";
import type { LeadCSVResult, LeadScoreResult } from "../types/chainreact";

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
    <section aria-labelledby="lead-csv-title" style={{ border: "1px solid #d8d8d8", borderRadius: 8, padding: 16, background: "#fff" }}>
      <h3 id="lead-csv-title" style={{ margin: "0 0 4px" }}>Process your lead data</h3>
      <p style={{ color: "#666", fontSize: 13, margin: "0 0 14px" }}>
        Upload a CSV with <code>name</code> and <code>email</code> columns. The lead qualification rules run on your rows and add a score, priority, validation note, and optional round-robin owner.
      </p>
      <form onSubmit={handleScoreLead}>
        <div className="cr-grid-3" style={{ gap: 12 }}>
          {([
            ["name", "Name", "Full name", "text"],
            ["contact", "Contact", "Phone or contact number", "tel"],
            ["email", "Email", "name@example.com", "email"],
          ] as const).map(([key, label, placeholder, type]) => (
            <label key={key} style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              {label}
              <input
                className="cr-input"
                type={type}
                value={lead[key]}
                onChange={(event) => setLead({ ...lead, [key]: event.target.value })}
                placeholder={placeholder}
                required
              />
            </label>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button type="submit" disabled={scoring} className="cr-btn cr-btn-primary">
            {scoring ? "Scoring lead..." : "Process lead score"}
          </button>
          {leadError && <span role="alert" style={{ color: "#c0341d", fontSize: 13 }}>{leadError}</span>}
        </div>
        {leadScore && (
          <div role="status" style={{ marginTop: 12, padding: 12, background: "#f4f7f4", border: "1px solid #d5e2d5", borderRadius: 6 }}>
            <strong>Lead score: {leadScore.lead_score}/100</strong>
            <span style={{ marginLeft: 12 }}>Priority: {leadScore.priority}</span>
            {leadScore.validation_errors && <p style={{ color: "#9b4a00", margin: "6px 0 0", fontSize: 13 }}>{leadScore.validation_errors}</p>}
          </div>
        )}
      </form>
      <hr style={{ border: 0, borderTop: "1px solid #e5e5e5", margin: "18px 0" }} />
      <div className="cr-grid-2" style={{ alignItems: "end", gap: 12 }}>
        <label style={{ fontSize: 13, display: "grid", gap: 6 }}>
          Lead CSV (2 MB maximum)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
          />
        </label>
        <label style={{ fontSize: 13, display: "grid", gap: 6 }}>
          Sales representatives (optional, comma-separated)
          <input
            className="cr-input"
            value={salesRepsText}
            onChange={(event) => setSalesRepsText(event.target.value)}
            placeholder="Jordan Lee, Casey Kim"
          />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={handleProcess} disabled={!file || loading} className="cr-btn cr-btn-primary">
          {loading ? "Processing rows..." : "Process CSV"}
        </button>
        {file && <span style={{ color: "#666", fontSize: 12 }}>{file.name}</span>}
        <span style={{ color: "#777", fontSize: 12 }}>Uploaded for in-memory processing; lead rows are not stored.</span>
      </div>
      {error && <p role="alert" style={{ color: "#c0341d", fontSize: 13 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{result.total} lead{result.total === 1 ? "" : "s"} processed</strong>
            <button type="button" onClick={downloadResults} className="cr-btn cr-btn-secondary">Download results CSV</button>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid #dedede" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
              <thead>
                <tr>{headers.map((header) => <th key={header} style={{ background: "#f4f5f3", borderBottom: "1px solid #dedede", padding: "8px 10px", textAlign: "left" }}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {result.records.slice(0, 100).map((record, index) => (
                  <tr key={index}>
                    {headers.map((header) => <td key={header} style={{ borderBottom: "1px solid #eee", padding: "7px 10px" }}>{record[header]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.total > 100 && <p style={{ color: "#777", fontSize: 12 }}>Previewing the first 100 rows. The download contains all {result.total} rows.</p>}
        </div>
      )}
    </section>
  );
}