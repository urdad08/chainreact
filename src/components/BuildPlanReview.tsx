import { useState } from "react";
import { Ban, CheckCircle2, Download, Eye, EyeOff, Globe, Lightbulb, ListChecks, Workflow } from "lucide-react";
import HelpTip from "./HelpTip";
import { Badge, Button } from "../ui/primitives";
import type { BuildPlan } from "../api/client";
import type { BuildType } from "../types/chainreact";

function ChecklistSection({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: string[]; emptyText: string }) {
  return (
    <div className="stack gap-2" style={{ minWidth: 0 }}>
      <div className="row gap-2 text-secondary text-sm" style={{ fontWeight: 600 }}>
        {icon}
        <span>{title}</span>
        {items.length > 0 && <span className="text-tertiary text-xs" style={{ fontWeight: 500 }}>{items.length}</span>}
      </div>
      {items.length > 0 ? (
        <ul className="cr-plan-list">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-tertiary">{emptyText}</p>
      )}
    </div>
  );
}

function TypeOption({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="row gap-3"
      style={{
        flex: "1 1 200px",
        minWidth: 0,
        padding: "12px 14px",
        textAlign: "left",
        font: "inherit",
        color: "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !active ? 0.55 : 1,
        borderRadius: "var(--r-md)",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
        background: active ? "var(--accent-soft)" : "var(--surface-2)",
        boxShadow: active ? "inset 0 0 0 1px var(--accent-border)" : "none",
        transition: "border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)",
      }}
    >
      <span
        className="row"
        style={{
          justifyContent: "center",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          background: active ? "var(--accent)" : "var(--surface-3)",
          color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        }}
      >
        {icon}
      </span>
      <span className="stack grow" style={{ gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</span>
        <span className="text-xs text-secondary">{description}</span>
      </span>
      {active && <CheckCircle2 size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />}
    </button>
  );
}

export default function BuildPlanReview({
  plan,
  buildType,
  onChangeBuildType,
  loading,
}: {
  plan: BuildPlan;
  buildType: BuildType;
  onChangeBuildType: (t: BuildType) => void;
  loading: boolean;
}) {
  const [showMd, setShowMd] = useState(false);

  function downloadMd() {
    const blob = new Blob([plan.requirements_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirements.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <style>{`
        .cr-plan-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
        .cr-plan-list li { position: relative; padding-left: 14px; font-size: var(--fs-sm); color: var(--text); line-height: 1.5; }
        .cr-plan-list li::before { content: ""; position: absolute; left: 2px; top: 0.6em; width: 4px; height: 4px; border-radius: 50%; background: var(--text-tertiary); }
      `}</style>
      <div className="card-body stack gap-4">
        <div className="stack gap-2" style={{ minWidth: 0 }}>
          <div className="row gap-2 wrap">
            <span className="eyebrow">Understanding</span>
            {buildType !== plan.intent.build_type && <Badge tone="warning">Changed from {plan.intent.build_type}</Badge>}
          </div>
          <h3 className="row gap-2" style={{ fontSize: "var(--fs-lg)" }}>
            <span style={{ minWidth: 0 }}>{plan.intent.suggested_name || "Here's what ChainReact understood"}</span>
            <HelpTip text="ChainReact read your description and automatically builds a workflow by default -- a website is only built when you explicitly ask for one. It's already building/built below; use these buttons only if it guessed wrong and you want to switch." />
          </h3>
          {plan.intent.summary && <p className="text-secondary" style={{ lineHeight: 1.6 }}>{plan.intent.summary}</p>}
        </div>

        <div className="row gap-3 wrap" role="group" aria-label="What to build">
          <TypeOption
            active={buildType === "website"}
            disabled={loading}
            icon={<Globe size={16} />}
            title="A website"
            description="A page to open and use directly."
            onClick={() => onChangeBuildType("website")}
          />
          <TypeOption
            active={buildType === "workflow"}
            disabled={loading}
            icon={<Workflow size={16} />}
            title="A workflow"
            description="Agents that automate a business process."
            onClick={() => onChangeBuildType("workflow")}
          />
        </div>
        {buildType !== plan.intent.build_type && (
          <p className="text-xs text-warning">You switched this from ChainReact's guess ({plan.intent.build_type}).</p>
        )}
        {loading && (
          <p className="text-sm text-accent" role="status" style={{ fontWeight: 550 }}>
            Building the {buildType}…
          </p>
        )}

        <hr className="divider" />

        <div className="grid grid-2" style={{ gap: "var(--sp-5)" }}>
          <ChecklistSection
            title="What the output must do"
            icon={<ListChecks size={14} />}
            items={plan.intent.requirements}
            emptyText="Nothing specific was extracted -- the request was fairly open-ended."
          />
          <ChecklistSection
            title="Assumptions ChainReact made"
            icon={<Lightbulb size={14} />}
            items={plan.intent.assumptions}
            emptyText="No assumptions were necessary -- the request was fully specified."
          />
          <ChecklistSection
            title="How to tell it worked"
            icon={<CheckCircle2 size={14} />}
            items={plan.intent.success_criteria}
            emptyText="None extracted."
          />
          <ChecklistSection
            title="Deliberately out of scope"
            icon={<Ban size={14} />}
            items={plan.intent.out_of_scope}
            emptyText="Nothing was explicitly excluded."
          />
        </div>

        <div className="row gap-2 wrap">
          <Button size="sm" icon={showMd ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setShowMd((s) => !s)}>
            {showMd ? "Hide" : "View"} requirements.md
          </Button>
          <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={downloadMd}>
            Download requirements.md
          </Button>
        </div>

        {showMd && <pre className="code-block" style={{ maxHeight: 420 }}>{plan.requirements_md}</pre>}
      </div>
    </div>
  );
}
