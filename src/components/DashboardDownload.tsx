import { useState } from "react";
import HelpTip from "./HelpTip";
import { ApiError, generateDashboard } from "../api/client";
import type { PipelineResult } from "../types/chainreact";

const DEFAULT_BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

export default function DashboardDownload({ result }: { result: PipelineResult }) {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [loading, setLoading] = useState<"download" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  async function handleGenerate(mode: "download" | "preview") {
    setLoading(mode);
    setError(null);
    try {
      const { filename, html } = await generateDashboard(result, backendUrl.trim());
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      if (mode === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
        // Don't revoke immediately -- the new tab needs the blob URL to stay
        // alive. The browser releases it once that tab is closed/navigated.
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setLastFilename(filename);
    } catch (e) {
      if (e instanceof ApiError && e.detail.retryable) {
        setError("The AI model is briefly overloaded — try again in a moment. (This step doesn't call the model though, so retry should be quick.)");
      } else {
        setError(e instanceof Error ? e.message : "Dashboard generation failed");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
        Get a ready-made mini app
        <HelpTip text="ChainReact can package everything it just built into a small, standalone web page that's specific to this task — with its own input form and a Run button. You can preview it right now or download the file and open it in any browser." />
      </h3>
      <p style={{ fontSize: 13, color: "#777" }}>
        Turns this into a simple web page you can use right away — it has a form for your
        details and a Run button. Preview it now, or download it to keep.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => handleGenerate("preview")} disabled={loading !== null} className="cr-btn cr-btn-secondary">
          {loading === "preview" ? "Generating..." : "Preview"}
        </button>
        <button type="button" onClick={() => handleGenerate("download")} disabled={loading !== null} className="cr-btn cr-btn-primary">
          {loading === "download" ? "Generating..." : "Download"}
        </button>
      </div>
      <details style={{ marginTop: 12, fontSize: 12, color: "#777" }}>
        <summary style={{ cursor: "pointer" }}>Advanced</summary>
        <p style={{ margin: "8px 0 4px 0" }}>
          Address of the ChainReact service the mini app will talk to (already filled in — you
          normally don't need to change this).
        </p>
        <input
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="https://your-chainreact-backend.onrender.com"
          className="cr-input"
          style={{ width: "100%", fontSize: 13 }}
        />
      </details>
      {lastFilename && !error && (
        <p style={{ marginTop: 10, fontSize: 13, color: "#1a7f37" }}>Ready: {lastFilename}.</p>
      )}
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0341d" }}>{error}</p>}
    </div>
  );
}
