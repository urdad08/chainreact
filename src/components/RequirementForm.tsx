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
    <div className="field">
      <label htmlFor="requirement" style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
        Step 1 — Describe what you want automated
      </label>
      <p className="text-sm text-secondary">
        Explain what starts the process, what should happen step by step, and what a successful result looks like.
        Plain English is fine — access permissions are reviewed separately below.
      </p>
      <textarea
        id="requirement"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        className="textarea"
        style={{ fontSize: 14 }}
        placeholder="e.g. When a customer submits a support ticket, categorize it, check if it's urgent, and notify the right team..."
      />
    </div>
  );
}
