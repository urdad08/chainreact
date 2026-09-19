import { useState } from "react";
import { ApiError, generateDashboard } from "../api/client";
import type { PipelineResult } from "../types/chainreact";

const DEFAULT_BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };
const primaryButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#5b3df0",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
const secondaryButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #5b3df0",
  background: "#fff",
  color: "#5b3df0",
  fontWeight: 600,
  cursor: "pointer",
};

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
      <h3 style={{ marginTop: 0 }}>Operational Dashboard</h3>
      <p style={{ fontSize: 13, color: "#777" }}>
        Generates a real, self-contained website for this process — its own agents, workflow, and
        input form, bounded to exactly what this ProcessSpec declares. Preview it right here, or
        download it to open directly in a browser or host anywhere; either way it talks to the
        backend URL below.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="https://your-chainreact-backend.onrender.com"
          style={{
            flex: 1,
            minWidth: 260,
            padding: "8px 10px",
            border: "1px solid #e2e2ea",
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        <button type="button" onClick={() => handleGenerate("preview")} disabled={loading !== null} style={secondaryButton}>
          {loading === "preview" ? "Generating..." : "Preview in New Tab"}
        </button>
        <button type="button" onClick={() => handleGenerate("download")} disabled={loading !== null} style={primaryButton}>
          {loading === "download" ? "Generating..." : "Download Operational Dashboard"}
        </button>
      </div>
      {lastFilename && !error && (
        <p style={{ marginTop: 10, fontSize: 13, color: "#1a7f37" }}>Ready: {lastFilename}.</p>
      )}
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0341d" }}>{error}</p>}
    </div>
  );
}
