import type { AgentArchitecture } from "../types/chainreact";

export default function AgentList({ architecture }: { architecture: AgentArchitecture }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 style={{ margin: "0 0 4px 0" }}>Agents ({architecture.agents.length})</h3>
      {architecture.agents.map((agent) => (
        <div
          key={agent.id}
          style={{
            border: "1px solid #e2e2ea",
            borderRadius: 10,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{agent.id}</div>
          <div style={{ color: "#444", margin: "4px 0" }}>{agent.purpose}</div>
          <div style={{ fontSize: 13, color: "#666" }}>
            in: {agent.inputs.join(", ") || "—"} → out: {agent.outputs.join(", ") || "—"}
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {agent.tools.map((t, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  background: "#f0eefe",
                  color: "#5b3df0",
                  borderRadius: 6,
                  padding: "2px 8px",
                  marginRight: 6,
                  marginBottom: 4,
                }}
              >
                {t.name}: {t.operations.join(", ")}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            permissions: {agent.permissions.join(", ") || "—"} · memory: {agent.memory.type}
          </div>
        </div>
      ))}
    </div>
  );
}
