import type { AuditTrail } from "../types/chainreact";

const card: React.CSSProperties = {
  border: "1px solid #e2e2ea",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
};

export default function AuditTrailView({ trail }: { trail: AuditTrail }) {
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>
        Audit Trail
        <span
          style={{
            marginLeft: 10,
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 999,
            background: trail.deployment_approved ? "#e6f7ec" : "#fff5f4",
            color: trail.deployment_approved ? "#1a7f37" : "#c0341d",
          }}
        >
          {trail.deployment_approved ? "DEPLOYMENT APPROVED" : "DEPLOYMENT BLOCKED"}
        </span>
      </h3>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {trail.entries.map((e, i) => (
          <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
            <span style={{ color: "#999" }}>{e.timestamp}</span> <strong>{e.stage}</strong> — {e.summary}
          </li>
        ))}
      </ol>
    </div>
  );
}
