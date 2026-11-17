import { Download, ExternalLink, RefreshCw, Wrench } from "lucide-react";
import HelpTip from "./HelpTip";
import { Button, Disclosure } from "../ui/primitives";
import type { GeneratedWebsite } from "../types/chainreact";

export default function WebsitePreview({
  website,
  onRegenerate,
  regenerating,
}: {
  website: GeneratedWebsite;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  function handleDownload() {
    const blob = new Blob([website.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = website.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleOpenInNewTab() {
    const blob = new Blob([website.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const repairs = website.repair_log.length;

  return (
    <div className="card card-pad stack gap-3" style={{ minWidth: 0 }}>
      <div className="row gap-3 wrap" style={{ justifyContent: "space-between" }}>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h3 className="row gap-2">
            Your website
            <HelpTip text="A single, self-contained HTML page generated from your description. Preview it below, open it full-screen in a new tab, or download it to host anywhere." />
          </h3>
          <span className="text-sm text-tertiary">Self-contained HTML page, previewed in a sandbox.</span>
        </div>
        <div className="row gap-2 wrap">
          <Button size="sm" variant="ghost" icon={<ExternalLink size={14} />} onClick={handleOpenInNewTab}>
            Open in new tab
          </Button>
          <Button size="sm" icon={<Download size={14} />} onClick={handleDownload}>
            Download
          </Button>
          <Button size="sm" variant="primary" icon={<RefreshCw size={14} />} loading={regenerating} onClick={onRegenerate}>
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          background: "var(--surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="row gap-3"
          style={{ height: 36, padding: "0 12px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
        >
          <span className="row" style={{ gap: 6, flexShrink: 0 }} aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--border-strong)" }} />
            ))}
          </span>
          <span
            className="mono text-xs text-secondary truncate"
            style={{
              flex: "1 1 auto",
              maxWidth: 420,
              margin: "0 auto",
              textAlign: "center",
              padding: "3px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
            }}
            title={website.filename}
          >
            {website.filename}
          </span>
          <span style={{ width: 39, flexShrink: 0 }} aria-hidden />
        </div>
        <iframe
          title="Generated website preview"
          srcDoc={website.html}
          sandbox=""
          style={{ display: "block", width: "100%", height: 520, border: "none", background: "#fff" }}
        />
      </div>

      {repairs > 0 && (
        <Disclosure
          title="Self-repair log"
          icon={<Wrench size={14} />}
          meta={`${repairs} event${repairs > 1 ? "s" : ""}`}
        >
          <ul className="stack gap-1 text-sm text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
            {website.repair_log.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
