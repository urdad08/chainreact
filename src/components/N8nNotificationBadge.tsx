import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import type { N8nExecutionResult } from "../types/chainreact";

/** Small inline status line for a result that was automatically forwarded
 * to the backend's configured n8n webhook (as opposed to N8nSync's bigger
 * manual "Send to n8n" card). Renders nothing if there's nothing to say. */
export default function N8nNotificationBadge({ outcome }: { outcome?: N8nExecutionResult | null }) {
  if (!outcome) return null;

  if (!outcome.configured) {
    return (
      <p className="row gap-2 text-xs text-tertiary" style={{ marginTop: 8 }}>
        <CircleSlash size={13} style={{ flexShrink: 0 }} />
        n8n is not configured on the backend: this result wasn't forwarded anywhere.
      </p>
    );
  }

  return (
    <p
      className={`row gap-2 text-xs ${outcome.ok ? "text-success" : "text-danger"}`}
      role={outcome.ok ? "status" : "alert"}
      style={{ marginTop: 8, alignItems: "flex-start" }}
    >
      {outcome.ok ? <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span style={{ minWidth: 0 }}>
        {outcome.ok
          ? `Forwarded to n8n; responded with status ${outcome.status_code}.`
          : `Could not forward to n8n: ${outcome.error ?? "unknown error"}`}
      </span>
    </p>
  );
}
