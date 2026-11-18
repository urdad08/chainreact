import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleX, ShieldCheck, XCircle } from "lucide-react";
import type { ProcessSpec, ValidationResult } from "../types/chainreact";
import { Badge } from "../ui/primitives";
import { humanize } from "../lib/format";

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(110px, 160px) minmax(0, 1fr)",
        gap: "var(--sp-2) var(--sp-4)",
        padding: "var(--sp-3) 0",
        borderTop: "1px solid var(--border-subtle)",
      }}
      className="cr-spec-row"
    >
      <dt className="text-sm text-tertiary" style={{ fontWeight: 550 }}>
        {label}
      </dt>
      <dd className="text-sm" style={{ margin: 0, minWidth: 0 }}>
        {children}
      </dd>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone?: "success" | "danger" }) {
  if (items.length === 0) return <span className="text-tertiary">-</span>;
  return (
    <div className="row wrap gap-1">
      {items.map((x, i) => (
        <span
          key={`${x}-${i}`}
          className="chip mono"
          style={{
            fontSize: 11,
            height: 22,
            maxWidth: "100%",
            overflowWrap: "anywhere",
            ...(tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})`, borderColor: "transparent" } : null),
          }}
        >
          {x}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <span className="text-tertiary">-</span>;
}

export default function ProcessSpecView({
  spec,
  validation,
}: {
  spec: ProcessSpec;
  validation?: ValidationResult;
}) {
  const issues = validation?.issues ?? [];
  const errors = issues.filter((i) => i.severity === "error").length;

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <style>{`@media (max-width: 560px){.cr-spec-row{grid-template-columns:minmax(0,1fr)!important;}}`}</style>
      <div className="card-header" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="stack gap-1" style={{ minWidth: 0 }}>
          <span className="eyebrow">Process specification</span>
          <h3 style={{ fontSize: 15 }}>{spec.name}</h3>
        </div>
        {validation && (
          <Badge tone={validation.valid ? "success" : errors ? "danger" : "warning"}>
            {validation.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {validation.valid ? "Valid" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>

      <div style={{ padding: "var(--sp-2) var(--sp-5) var(--sp-4)" }}>
        {spec.objective && (
          <p className="text-secondary" style={{ padding: "var(--sp-2) 0 var(--sp-3)", lineHeight: 1.6 }}>
            {spec.objective}
          </p>
        )}
        <dl style={{ margin: 0 }}>
          <Row label="Users">{spec.users.length ? spec.users.join(", ") : <Empty />}</Row>
          <Row label="Trigger">
            <span className="row wrap gap-2">
              <span className="chip mono" style={{ fontSize: 11, height: 22 }}>
                {spec.trigger.type}
              </span>
              <span className="text-secondary">{spec.trigger.event || "-"}</span>
            </span>
          </Row>
          <Row label="Inputs">
            <Chips items={spec.input_data ?? []} />
          </Row>
          <Row label="Outputs">
            <Chips items={spec.output_data ?? []} />
          </Row>
          <Row label="Rules">
            {spec.rules.length ? (
              <ol className="stack gap-2" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {spec.rules.map((r, i) => (
                  <li key={i} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <span className="mono text-xs text-tertiary" style={{ minWidth: 18, paddingTop: 1 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ minWidth: 0, lineHeight: 1.55 }}>{r}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Permissions">
            <div className="stack gap-2">
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <CheckCircle2 size={13} style={{ color: "var(--success)", marginTop: 4, flexShrink: 0 }} />
                <Chips items={spec.permissions.allowed} tone="success" />
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <CircleX size={13} style={{ color: "var(--danger)", marginTop: 4, flexShrink: 0 }} />
                <Chips items={spec.permissions.forbidden} tone="danger" />
              </div>
            </div>
          </Row>
          <Row label="Approval gates">
            {spec.human_approval.length === 0 ? (
              <span className="text-tertiary">None required</span>
            ) : (
              <div className="stack gap-2">
                {spec.human_approval.map((a, i) => (
                  <div key={i} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <ShieldCheck size={13} style={{ color: "var(--warning)", marginTop: 3, flexShrink: 0 }} />
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="row wrap gap-2">
                        <span className="mono" style={{ overflowWrap: "anywhere" }}>{a.action}</span>
                        <Badge tone={a.required ? "warning" : "outline"}>{a.required ? "Required" : "Optional"}</Badge>
                      </span>
                      {a.reason && <span className="text-xs text-tertiary">{a.reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Row>
          {spec.failure_policy && (
            <Row label="Failure policy">
              <div className="row wrap gap-2">
                <span className="chip text-xs">
                  {spec.failure_policy.max_retries} {spec.failure_policy.max_retries === 1 ? "retry" : "retries"}
                </span>
                <span className="chip text-xs">{humanize(spec.failure_policy.retry_strategy)}</span>
                {spec.failure_policy.fallback && (
                  <span className="text-secondary">Fallback: {spec.failure_policy.fallback}</span>
                )}
              </div>
            </Row>
          )}
          <Row label="Success criteria">
            {spec.success_conditions.length ? (
              <ul className="stack gap-1" style={{ margin: 0, paddingLeft: 16 }}>
                {spec.success_conditions.map((s, i) => (
                  <li key={i} style={{ lineHeight: 1.55 }}>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Limits">
            <div className="row wrap gap-2">
              <span className="chip text-xs">
                Cost ≤ <span className="mono">${spec.limits.max_cost_per_execution}</span> / run
              </span>
              <span className="chip text-xs">
                Latency ≤ <span className="mono">{spec.limits.max_latency_seconds}s</span>
              </span>
              <span className="chip text-xs">Privacy: {spec.limits.privacy || "-"}</span>
            </div>
          </Row>
          {issues.length > 0 && (
            <Row label="Validation">
              <div className="stack gap-2">
                {issues.map((issue, i) => (
                  <div key={i} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <Badge tone={issue.severity === "error" ? "danger" : "warning"}>
                      {issue.severity === "error" ? <XCircle size={11} /> : <AlertTriangle size={11} />}
                      {issue.severity}
                    </Badge>
                    <span style={{ minWidth: 0, lineHeight: 1.55 }}>
                      <span className="mono text-xs text-tertiary">{issue.field}</span>{" "}
                      <span className="text-secondary">{issue.message}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Row>
          )}
        </dl>
      </div>
    </div>
  );
}
