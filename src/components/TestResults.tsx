import { CheckCircle2, ScrollText, XCircle } from "lucide-react";
import type { SandboxReport, TestCategory } from "../types/chainreact";
import { Badge, CodeBlock, Disclosure } from "../ui/primitives";

const CATEGORY_LABEL: Record<TestCategory, string> = {
  structural: "Structural",
  permission: "Permissions",
  approval: "Approval gates",
  success_condition: "Success conditions",
};

const CATEGORY_ORDER: TestCategory[] = ["structural", "permission", "approval", "success_condition"];

export default function TestResults({ report }: { report: SandboxReport }) {
  const pct = report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
  const knownCategories = new Set<string>(CATEGORY_ORDER);
  const extraCategories = Array.from(
    new Set(report.outcomes.map((o) => o.test.category).filter((c) => !knownCategories.has(c)))
  );
  const categories = [...CATEGORY_ORDER, ...extraCategories];

  return (
    <div className="stack gap-4" style={{ minWidth: 0 }}>
      <div className="row wrap gap-3" style={{ justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 14 }}>Test results</h3>
        <Badge tone={report.ready_for_deployment ? "success" : "danger"}>
          {report.ready_for_deployment ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {report.ready_for_deployment ? "Ready for deployment" : "Not ready"}
        </Badge>
      </div>

      <div className="card stack gap-2" style={{ padding: "var(--sp-4) var(--sp-5)" }}>
        <div className="row wrap gap-2" style={{ justifyContent: "space-between" }}>
          <span>
            <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {report.passed}
              <span className="text-tertiary">/{report.total}</span>
            </span>{" "}
            <span className="text-sm text-secondary">tests passed</span>
          </span>
          {report.failed > 0 && <Badge tone="danger">{report.failed} failed</Badge>}
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={report.total}
          aria-valuenow={report.passed}
          style={{ height: 4, borderRadius: "var(--r-full)", background: "var(--surface-3)", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: report.failed > 0 ? "var(--warning)" : "var(--success)",
            }}
          />
        </div>
      </div>

      <div>
        {categories.map((category) => {
          const items = report.outcomes.filter((o) => o.test.category === category);
          if (items.length === 0) return null;
          const passed = items.filter((o) => o.passed).length;
          const allPassed = passed === items.length;
          return (
            <Disclosure
              key={category}
              defaultOpen={!allPassed}
              icon={
                allPassed ? (
                  <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
                ) : (
                  <XCircle size={15} style={{ color: "var(--danger)" }} />
                )
              }
              title={CATEGORY_LABEL[category as TestCategory] ?? category}
              meta={`${passed}/${items.length} passed`}
            >
              <div className="stack gap-3">
                {items.map((o) => (
                  <div key={o.test.id} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    {o.passed ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <XCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="text-sm">{o.test.description}</span>
                      {o.detail && (
                        <span className="text-xs text-tertiary" style={{ overflowWrap: "anywhere" }}>
                          {o.detail}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Disclosure>
          );
        })}
        {report.outcomes.length === 0 && <div className="text-sm text-tertiary">No tests were run.</div>}
      </div>

      <Disclosure
        icon={<ScrollText size={15} />}
        title="Execution trace"
        meta={`${report.execution_trace.length} step${report.execution_trace.length === 1 ? "" : "s"}`}
      >
        {report.execution_trace.length ? (
          <CodeBlock maxHeight={320}>{report.execution_trace.join("\n")}</CodeBlock>
        ) : (
          <span className="text-sm text-tertiary">No trace recorded.</span>
        )}
      </Disclosure>
    </div>
  );
}
