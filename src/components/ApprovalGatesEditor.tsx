import { useState } from "react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Actions currently marked "allowed" in the permissions editor -- offered as quick picks. */
  candidateActions: string[];
}

export default function ApprovalGatesEditor({ value, onChange, candidateActions }: Props) {
  const [selected, setSelected] = useState("");
  const [customText, setCustomText] = useState("");

  function addAction(action: string) {
    const a = action.trim();
    if (a && !value.includes(a)) {
      onChange([...value, a]);
    }
  }

  function removeAction(action: string) {
    onChange(value.filter((a) => a !== action));
  }

  const availableCandidates = candidateActions.filter((a) => !value.includes(a));

  return (
    <div>
      <label style={{ fontWeight: 600, fontSize: 14 }}>Human approval required before...</label>
      <p style={{ fontSize: 12, color: "#777", margin: "2px 0 10px 0" }}>
        Pick from allowed permissions, or type a custom action (e.g. "send_email").
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            if (e.target.value) {
              addAction(e.target.value);
              setSelected("");
            }
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d0d0d8",
            fontSize: 13,
            background: "#fff",
          }}
        >
          <option value="">+ add from allowed permissions...</option>
          {availableCandidates.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAction(customText);
              setCustomText("");
            }
          }}
          placeholder="custom action, e.g. send_email"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d0d0d8",
            fontSize: 13,
            flex: 1,
            minWidth: 160,
          }}
        />
        <button
          type="button"
          onClick={() => {
            addAction(customText);
            setCustomText("");
          }}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #d97706",
            background: "#fff",
            color: "#d97706",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add gate
        </button>
      </div>

      <div>
        {value.length === 0 && <span style={{ fontSize: 13, color: "#999" }}>No approval gates configured.</span>}
        {value.map((action) => (
          <span
            key={action}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #f0c26b",
              background: "#fff8ec",
              color: "#8a6d00",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 13,
              marginRight: 6,
              marginBottom: 6,
            }}
          >
            ⏸ {action}
            <button
              onClick={() => removeAction(action)}
              aria-label={`Remove approval gate for ${action}`}
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
        ))}
      </div>
    </div>
  );
}
