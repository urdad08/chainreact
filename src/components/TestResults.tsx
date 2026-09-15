import type { SandboxReport, TestCategory } from "../types/chainreact";

const CATEGORY_LABEL: Record<TestCategory, string> = {
  structural: "Structural",
  permission: "Permissions",
  approval: "Approval gates",
  success_condition: "Success conditions",
};

const CATEGORY_ORDER: TestCategory[] = ["structural", "permission", "approval", "success_condition"];

export default function TestResults({ report }: { report: SandboxReport }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Sandbox &amp; Tests</h3>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            padding: "4px 12px",
            borderRadius: 999,
            background: report.ready_for_deployment ? "#eafbf0" : "#fdeceb",
            color: report.ready_for_deployment ? "#1a7f37" : "#c0341d",
          }}
        >
          {report.ready_for_deployment ? "✓ READY FOR DEPLOYMENT" : "✕ NOT READY"}
        </span>
      </div>

      <div style={{ fontSize: 14, marginBottom: 16, color: "#333" }}>
        <strong>
          {report.passed}/{report.total}
        </strong>{" "}
        tests passed
        {report.failed > 0 && <span style={{ color: "#c0341d" }}> · {report.failed} failed</span>}
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = report.outcomes.filter((o) => o.test.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>
              {CATEGORY_LABEL[category]}
            </div>
            {items.map((o) => (
              <div key={o.test.id} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: o.passed ? "#1a7f37" : "#c0341d", fontWeight: 700 }}>
                  {o.passed ? "✓" : "✕"}
                </span>
                <div>
                  <div style={{ color: "#222" }}>{o.test.description}</div>
                  <div style={{ color: "#888", fontSize: 12 }}>{o.detail}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5b3df0" }}>
          Execution trace ({report.execution_trace.length} steps)
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: "#faf9ff",
            border: "1px solid #e2e2ea",
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
          }}
        >
          {report.execution_trace.join("\n")}
        </pre>
      </details>
    </div>
  );
}
