import { useState } from "react";
import { Hand, Plus, X } from "lucide-react";
import HelpTip from "./HelpTip";
import { Button } from "../ui/primitives";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Actions currently marked "allowed" in the permissions editor -- offered as quick picks. */
  candidateActions: string[];
  /** Hide the "Step 3" heading and intro text (e.g. when embedded in an Advanced section that has its own title). */
  hideHeading?: boolean;
}

export default function ApprovalGatesEditor({ value, onChange, candidateActions, hideHeading = false }: Props) {
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
    <div className="stack gap-3" style={{ minWidth: 0 }}>
      {!hideHeading && (
        <div className="stack gap-1">
          <label className="row gap-2" style={{ fontWeight: 600, fontSize: 14 }}>
            Step 3: Pick what needs a human's okay first
            <HelpTip text="For anything listed here, the automation will stop and wait for a person to approve before it goes ahead. It won't just do it on its own. Good for anything sensitive or hard to undo, like sending an email or charging a card." />
          </label>
          <p className="text-sm text-secondary">
            Pick from what you allowed above, or type your own (e.g. "send_email"). Leave this empty if nothing needs
            sign-off.
          </p>
        </div>
      )}

      <div className="row gap-2 wrap">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            if (e.target.value) {
              addAction(e.target.value);
              setSelected("");
            }
          }}
          className="select"
          aria-label="Add from allowed permissions"
          disabled={availableCandidates.length === 0}
          style={{ flex: "1 1 200px", width: "auto", minWidth: 0, height: 30, fontSize: 12.5 }}
        >
          <option value="">
            {availableCandidates.length === 0 ? "No allowed permissions to pick from" : "Add from allowed permissions…"}
          </option>
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
          className="input mono"
          aria-label="Custom approval action"
          style={{ flex: "1 1 200px", width: "auto", minWidth: 0, height: 30, fontSize: 12.5 }}
        />
        <Button
          size="sm"
          icon={<Plus size={13} />}
          disabled={!customText.trim()}
          onClick={() => {
            addAction(customText);
            setCustomText("");
          }}
        >
          Add
        </Button>
      </div>

      <div className="row gap-2 wrap">
        {value.length === 0 && <span className="text-sm text-tertiary">Nothing requires approval yet.</span>}
        {value.map((action) => (
          <span
            key={action}
            className="row gap-1"
            style={{
              height: 26,
              padding: "0 6px 0 9px",
              borderRadius: "var(--r-sm)",
              background: "var(--warning-soft)",
              color: "var(--warning)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            <Hand size={12} />
            {action}
            <button
              type="button"
              onClick={() => removeAction(action)}
              aria-label={`Remove approval gate for ${action}`}
              className="row"
              style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", padding: 2, marginLeft: 2, opacity: 0.8 }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
