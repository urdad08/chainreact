import type { ProcessSpec, ValidationResult } from "../types/chainreact";

const card: React.CSSProperties = {
  border: "1px solid #e2e2ea",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
};

const label: React.CSSProperties = { fontWeight: 600, fontSize: 13, color: "#555", marginTop: 10 };

export default function ProcessSpecView({
  spec,
  validation,
}: {
  spec: ProcessSpec;
  validation?: ValidationResult;
}) {
  return (
    <div style={card}>
      <h3 style={{ margin: 0 }}>{spec.name}</h3>
      <p style={{ color: "#444" }}>{spec.objective}</p>

      <div style={label}>Users</div>
      <div>{spec.users.join(", ") || "—"}</div>

      <div style={label}>Trigger</div>
      <div>{spec.trigger.type} → {spec.trigger.event}</div>

      <div style={label}>Rules</div>
      <ol style={{ margin: "4px 0" }}>
        {spec.rules.map((r, i) => <li key={i}>{r}</li>)}
      </ol>

      <div style={label}>Permissions</div>
      <div>
        <span style={{ color: "#1a7f37" }}>allowed:</span> {spec.permissions.allowed.join(", ") || "—"}
        <br />
        <span style={{ color: "#c0341d" }}>forbidden:</span> {spec.permissions.forbidden.join(", ") || "—"}
      </div>

      <div style={label}>Human approval</div>
      <div>
        {spec.human_approval.length === 0
          ? "None required"
          : spec.human_approval.map((a, i) => <div key={i}>• {a.action} (required: {String(a.required)})</div>)}
      </div>

      <div style={label}>Success conditions</div>
      <ul style={{ margin: "4px 0" }}>
        {spec.success_conditions.map((s, i) => <li key={i}>{s}</li>)}
      </ul>

      <div style={label}>Limits</div>
      <div>
        cost ≤ ${spec.limits.max_cost_per_execution} / run · latency ≤ {spec.limits.max_latency_seconds}s
        <br />
        privacy: {spec.limits.privacy}
      </div>

      {validation && validation.issues.length > 0 && (
        <>
          <div style={label}>Validation notes</div>
          <ul style={{ margin: "4px 0" }}>
            {validation.issues.map((issue, i) => (
              <li key={i} style={{ color: issue.severity === "error" ? "#c0341d" : "#8a6d00" }}>
                [{issue.severity}] {issue.field}: {issue.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
