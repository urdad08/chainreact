import { useState } from "react";
import { Ban, Check, Loader2, Minus, Plus, Sparkles, X } from "lucide-react";
import HelpTip from "./HelpTip";
import { Button } from "../ui/primitives";

// A starter catalog of common tool.operation permissions, grouped by tool.
// Users can check these directly, or add their own custom permission string.
const COMMON_PERMISSIONS: Record<string, string[]> = {
  crm: ["crm.read", "crm.write", "crm.delete"],
  email: ["email.send", "email.read"],
  database: ["database.read", "database.write"],
  payments: ["payments.charge", "payments.refund"],
  slack: ["slack.post", "slack.read"],
  calendar: ["calendar.read", "calendar.write"],
  notification: ["notification.send"],
  http: ["http.request"],
};

export interface PermissionState {
  allowed: string[];
  forbidden: string[];
}

interface Props {
  value: PermissionState;
  onChange: (next: PermissionState) => void;
  suggestions?: (PermissionState & { approvalActions: string[] }) | null;
  suggestionStatus?: "idle" | "loading" | "ready" | "error";
  onApplySuggestions?: () => void;
  /** Hide the "Step 2" heading and intro text (e.g. when embedded in an Advanced section that has its own title). */
  hideHeading?: boolean;
}

type PermStatus = "allowed" | "forbidden" | "unset";

const STATUS_LABEL: Record<PermStatus, string> = {
  allowed: "allowed",
  forbidden: "blocked",
  unset: "not decided",
};

function chipStyle(status: PermStatus): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 26,
    padding: "0 9px",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    whiteSpace: "nowrap",
    border: "1px solid",
    borderColor: status === "allowed" ? "transparent" : status === "forbidden" ? "transparent" : "var(--border-strong)",
    background: status === "allowed" ? "var(--success-soft)" : status === "forbidden" ? "var(--danger-soft)" : "transparent",
    color: status === "allowed" ? "var(--success)" : status === "forbidden" ? "var(--danger)" : "var(--text-secondary)",
    transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
  };
}

function StatusIcon({ status }: { status: PermStatus }) {
  if (status === "allowed") return <Check size={12} />;
  if (status === "forbidden") return <Ban size={12} />;
  return <Minus size={12} />;
}

export default function PermissionsEditor({
  value,
  onChange,
  suggestions,
  suggestionStatus = "idle",
  onApplySuggestions,
  hideHeading = false,
}: Props) {
  const [customText, setCustomText] = useState("");

  // Status of a permission: which list (if any) it currently sits in.
  function statusOf(perm: string): PermStatus {
    if (value.allowed.includes(perm)) return "allowed";
    if (value.forbidden.includes(perm)) return "forbidden";
    return "unset";
  }

  function cycleStatus(perm: string) {
    const current = statusOf(perm);
    const allowed = value.allowed.filter((p) => p !== perm);
    const forbidden = value.forbidden.filter((p) => p !== perm);
    if (current === "unset") {
      onChange({ allowed: [...allowed, perm], forbidden });
    } else if (current === "allowed") {
      onChange({ allowed, forbidden: [...forbidden, perm] });
    } else {
      onChange({ allowed, forbidden });
    }
  }

  function removePermission(perm: string) {
    onChange({
      allowed: value.allowed.filter((p) => p !== perm),
      forbidden: value.forbidden.filter((p) => p !== perm),
    });
  }

  function addCustom() {
    const perm = customText.trim();
    if (!perm) return;
    if (!value.allowed.includes(perm) && !value.forbidden.includes(perm)) {
      onChange({ allowed: [...value.allowed, perm], forbidden: value.forbidden });
    }
    setCustomText("");
  }

  const customPermissions = [...value.allowed, ...value.forbidden].filter(
    (p) => !Object.values(COMMON_PERMISSIONS).flat().includes(p)
  );

  return (
    <div className="stack gap-3" style={{ minWidth: 0 }}>
      {!hideHeading && (
        <div className="stack gap-1">
          <label className="row gap-2" style={{ fontWeight: 600, fontSize: 14 }}>
            Step 2 — Decide what it's allowed to touch
            <HelpTip text="This controls what the automation can actually do. Click any item below once to allow it (turns green), click again to explicitly block it (turns red), and a third click leaves it undecided. Nothing is allowed until you click it." />
          </label>
          <p className="text-sm text-secondary">
            For example, allow it to read and update your CRM, but block it from deleting records.
          </p>
        </div>
      )}

      <div className="row gap-3 wrap text-xs text-tertiary">
        <span className="row gap-1"><span style={{ ...chipStyle("allowed"), height: 18, padding: "0 5px" }}><Check size={11} /></span> allowed</span>
        <span className="row gap-1"><span style={{ ...chipStyle("forbidden"), height: 18, padding: "0 5px" }}><Ban size={11} /></span> blocked</span>
        <span className="row gap-1"><span style={{ ...chipStyle("unset"), height: 18, padding: "0 5px" }}><Minus size={11} /></span> not decided</span>
        <span>Click a permission to cycle.</span>
      </div>

      {suggestionStatus !== "idle" && (
        <div
          className="row gap-3 wrap"
          style={{
            padding: "8px 10px",
            borderRadius: "var(--r-md)",
            border: `1px solid ${suggestionStatus === "error" ? "transparent" : "var(--border)"}`,
            background: suggestionStatus === "error" ? "var(--danger-soft)" : "var(--surface-2)",
          }}
        >
          <span
            role="status"
            className={`row gap-2 text-sm grow ${suggestionStatus === "error" ? "text-danger" : "text-secondary"}`}
          >
            {suggestionStatus === "loading" ? (
              <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
            ) : (
              <Sparkles size={13} style={{ flexShrink: 0, color: suggestionStatus === "error" ? undefined : "var(--accent)" }} />
            )}
            <span style={{ minWidth: 0 }}>
              {suggestionStatus === "loading" && "Analyzing the request for minimum required permissions…"}
              {suggestionStatus === "ready" && suggestions && `Suggestions: ${suggestions.allowed.length} allowed, ${suggestions.forbidden.length} forbidden, ${suggestions.approvalActions.length} approval gate(s).`}
              {suggestionStatus === "error" && "Could not generate suggestions. You can still configure permissions below."}
            </span>
          </span>
          {suggestionStatus === "ready" && onApplySuggestions && (
            <Button size="sm" variant="primary" onClick={onApplySuggestions}>
              Apply suggestions
            </Button>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 10 }}>
        {Object.entries(COMMON_PERMISSIONS).map(([group, perms]) => (
          <div key={group} className="row gap-3" style={{ alignItems: "flex-start", minWidth: 0 }}>
            <div className="eyebrow" style={{ width: 92, flexShrink: 0, paddingTop: 6 }}>
              {group}
            </div>
            <div className="row gap-2 wrap grow">
              {perms.map((perm) => {
                const status = statusOf(perm);
                return (
                  <button
                    key={perm}
                    type="button"
                    style={{ ...chipStyle(status), cursor: "pointer" }}
                    onClick={() => cycleStatus(perm)}
                    aria-label={`${perm}: ${STATUS_LABEL[status]}. Click to change.`}
                    title={STATUS_LABEL[status]}
                  >
                    <StatusIcon status={status} />
                    {perm}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {customPermissions.length > 0 && (
          <div className="row gap-3" style={{ alignItems: "flex-start", minWidth: 0 }}>
            <div className="eyebrow" style={{ width: 92, flexShrink: 0, paddingTop: 6 }}>
              custom
            </div>
            <div className="row gap-2 wrap grow">
              {customPermissions.map((perm) => {
                const status = statusOf(perm);
                return (
                  <span key={perm} style={chipStyle(status)}>
                    <button
                      type="button"
                      onClick={() => cycleStatus(perm)}
                      aria-label={`${perm}: ${STATUS_LABEL[status]}. Click to change.`}
                      title={STATUS_LABEL[status]}
                      className="row gap-1"
                      style={{ border: "none", background: "none", color: "inherit", font: "inherit", padding: 0, cursor: "pointer" }}
                    >
                      <StatusIcon status={status} />
                      {perm}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePermission(perm)}
                      aria-label={`Remove ${perm}`}
                      className="row"
                      style={{ border: "none", background: "none", color: "inherit", padding: 0, marginLeft: 2, cursor: "pointer", opacity: 0.75 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="row gap-2 wrap">
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Something else, e.g. inventory.write"
          className="input mono"
          aria-label="Custom permission"
          style={{ flex: "1 1 220px", width: "auto", minWidth: 0, height: 30, fontSize: 12.5 }}
        />
        <Button size="sm" icon={<Plus size={13} />} onClick={addCustom} disabled={!customText.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
