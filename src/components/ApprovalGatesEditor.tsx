import { useState } from "react";
import HelpTip from "./HelpTip";

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
      <label style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
        Step 3 — Pick what needs a human's okay first
        <HelpTip text="For anything listed here, the automation will stop and wait for a person to approve before it goes ahead — it won't just do it on its own. Good for anything sensitive or hard to undo, like sending an email or charging a card." />
      </label>
      <p style={{ fontSize: 13, color: "#666", margin: "4px 0 10px 0" }}>
        Pick from what you allowed above, or type your own (e.g. "send_email"). Leave this empty
        if nothing needs sign-off.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            if (e.target.value) {
              addAction(e.target.value);
              setSelected("");
            }
          }}
          className="cr-input"
          style={{ background: "#fff" }}
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
          placeholder="Or type your own, e.g. send_email"
          className="cr-input"
          style={{ flex: "1 1 200px" }}
        />
        <button
          type="button"
          onClick={() => {
            addAction(customText);
            setCustomText("");
          }}
          className="cr-btn"
          style={{ border: "1px solid #d97706", background: "#fff", color: "#d97706" }}
        >
          Add
        </button>
      </div>

      <div>
        {value.length === 0 && <span style={{ fontSize: 13, color: "#999" }}>Nothing requires approval yet.</span>}
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
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              marginRight: 8,
              marginBottom: 8,
              minHeight: 36,
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
