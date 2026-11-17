import { ShieldCheck, ShieldOff } from "lucide-react";
import HelpTip from "./HelpTip";
import type { AuditTrail } from "../types/chainreact";
import { Badge } from "../ui/primitives";
import { formatDateTime } from "../lib/format";

export default function AuditTrailView({ trail }: { trail: AuditTrail }) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="card-header" style={{ flexWrap: "wrap" }}>
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <h3>Activity log</h3>
          <HelpTip text="A time-stamped record of everything ChainReact did while building this — what it checked, what it fixed, and whether it decided the result was safe to use. Useful if anyone later asks 'why was this approved?'" />
        </div>
        <Badge tone={trail.deployment_approved ? "success" : "danger"}>
          {trail.deployment_approved ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
          {trail.deployment_approved ? "Approved" : "Blocked"}
        </Badge>
      </div>
      <div className="card-body">
        {trail.entries.length === 0 ? (
          <span className="text-sm text-tertiary">No activity recorded.</span>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {trail.entries.map((e, i) => {
              const last = i === trail.entries.length - 1;
              const formatted = formatDateTime(e.timestamp);
              return (
                <li key={i} style={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", columnGap: 12 }}>
                  <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        marginTop: 5,
                        borderRadius: "50%",
                        background: last ? "var(--accent)" : "var(--surface)",
                        border: `1.5px solid ${last ? "var(--accent)" : "var(--border-strong)"}`,
                        zIndex: 1,
                      }}
                    />
                    {!last && (
                      <span
                        aria-hidden
                        style={{ position: "absolute", top: 16, bottom: -4, width: 1, background: "var(--border)" }}
                      />
                    )}
                  </div>
                  <div className="stack gap-1" style={{ paddingBottom: last ? 0 : "var(--sp-4)", minWidth: 0 }}>
                    <div className="row wrap gap-2">
                      <span className="mono text-xs" style={{ color: "var(--text)", fontWeight: 550 }}>
                        {e.stage}
                      </span>
                      <span className="text-xs text-tertiary" title={e.timestamp}>
                        {formatted === "—" ? e.timestamp || "—" : formatted}
                      </span>
                    </div>
                    <span className="text-sm text-secondary" style={{ lineHeight: 1.55, overflowWrap: "anywhere" }}>
                      {e.summary}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
