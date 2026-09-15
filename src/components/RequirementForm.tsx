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
      <label htmlFor="requirement" style={{ fontWeight: 600, fontSize: 14 }}>
        Business process requirement
      </label>
      <p style={{ fontSize: 12, color: "#777", margin: 0 }}>
        Describe the workflow only -- objective, trigger, steps, users. Configure
        permissions and approval gates below instead of writing them here.
      </p>
      <textarea
        id="requirement"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        style={{
          fontFamily: "inherit",
          fontSize: 14,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #d0d0d8",
          resize: "vertical",
        }}
        placeholder="Describe the business process in plain language..."
      />
    </div>
  );
}
