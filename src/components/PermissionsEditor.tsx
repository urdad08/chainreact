import { useState } from "react";

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
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 13,
  marginRight: 6,
  marginBottom: 6,
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
      <label style={{ fontWeight: 600, fontSize: 14 }}>Permissions</label>
      <p style={{ fontSize: 12, color: "#777", margin: "2px 0 10px 0" }}>
        Click a permission to cycle: unset → allowed → forbidden → unset.
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

      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="custom.permission, e.g. inventory.write"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d0d0d8",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={addCustom}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #5b3df0",
            background: "#fff",
            color: "#5b3df0",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
