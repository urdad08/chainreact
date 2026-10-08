import { useState } from "react";
import HelpTip from "./HelpTip";

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
};

export interface PermissionState {
  allowed: string[];
  forbidden: string[];
}

interface Props {
  value: PermissionState;
  onChange: (next: PermissionState) => void;
}

const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  marginRight: 8,
  marginBottom: 8,
  minHeight: 36,
};

export default function PermissionsEditor({ value, onChange }: Props) {
  const [customText, setCustomText] = useState("");

  // Status of a permission: which list (if any) it currently sits in.
  function statusOf(perm: string): "allowed" | "forbidden" | "unset" {
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
    <div>
      <label style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
        Step 2 — Decide what it's allowed to touch
        <HelpTip text="This controls what the automation can actually do. Click any item below once to allow it (turns green), click again to explicitly block it (turns red), and a third click leaves it undecided. Nothing is allowed until you click it." />
      </label>
      <p style={{ fontSize: 13, color: "#666", margin: "4px 0 10px 0" }}>
        For example, allow it to read and update your CRM, but block it from deleting records.
      </p>

      {Object.entries(COMMON_PERMISSIONS).map(([group, perms]) => (
        <div key={group} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999", marginBottom: 4 }}>
            {group}
          </div>
          {perms.map((perm) => {
            const status = statusOf(perm);
            const style: React.CSSProperties = {
              ...chipBase,
              cursor: "pointer",
              border: "1px solid",
              borderColor: status === "allowed" ? "#1a7f37" : status === "forbidden" ? "#c0341d" : "#d0d0d8",
              background: status === "allowed" ? "#eafbf0" : status === "forbidden" ? "#fdeceb" : "#fff",
              color: status === "allowed" ? "#1a7f37" : status === "forbidden" ? "#c0341d" : "#555",
            };
            return (
              <span key={perm} style={style} onClick={() => cycleStatus(perm)}>
                {status === "allowed" ? "✓" : status === "forbidden" ? "✕" : "—"} {perm}
              </span>
            );
          })}
        </div>
      ))}

      {customPermissions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999", marginBottom: 4 }}>
            custom
          </div>
          {customPermissions.map((perm) => {
            const status = statusOf(perm);
            const style: React.CSSProperties = {
              ...chipBase,
              border: "1px solid",
              borderColor: status === "allowed" ? "#1a7f37" : "#c0341d",
              background: status === "allowed" ? "#eafbf0" : "#fdeceb",
              color: status === "allowed" ? "#1a7f37" : "#c0341d",
            };
            return (
              <span key={perm} style={style}>
                <span style={{ cursor: "pointer" }} onClick={() => cycleStatus(perm)}>
                  {status === "allowed" ? "✓" : "✕"} {perm}
                </span>
                <button
                  onClick={() => removePermission(perm)}
                  aria-label={`Remove ${perm}`}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "inherit",
                    fontWeight: 700,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
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
          className="cr-input"
          style={{ flex: "1 1 220px" }}
        />
        <button type="button" onClick={addCustom} className="cr-btn cr-btn-secondary">
          Add
        </button>
      </div>
    </div>
  );
}
