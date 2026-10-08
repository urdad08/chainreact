export const EXAMPLE_REQUIREMENT =
  "Build a CRM lead management process. When a new lead arrives, validate it, " +
  "enrich company information, calculate a lead score, and assign it to the " +
  "appropriate salesperson. Update the CRM once the process completes. " +
  "Only sales_manager and sales_representative should use this process.";

interface Props {
  value: string;
  onChange: (text: string) => void;
}

export default function RequirementForm({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor="requirement" style={{ fontWeight: 600, fontSize: 15 }}>
        Step 1 — Describe what you want automated
      </label>
      <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
        Write it like you're explaining it to a new employee: what triggers it, what should
        happen step by step, and who's allowed to use it. Plain English is fine — no technical
        terms needed.
      </p>
      <textarea
        id="requirement"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        className="cr-input"
        style={{
          fontFamily: "inherit",
          fontSize: 14,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #d0d0d8",
          resize: "vertical",
          width: "100%",
          minHeight: "auto",
        }}
        placeholder="e.g. When a customer submits a support ticket, categorize it, check if it's urgent, and notify the right team..."
      />
    </div>
  );
}
