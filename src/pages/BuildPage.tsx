import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  FileText,
  Paperclip,
  Plug,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import {
  ApiError,
  BuildPlan,
  buildWebsite,
  getIntegrationsStatus,
  planBuild,
  PermissionSuggestion,
  runSandbox,
  suggestPermissions,
  synthesize,
} from "../api/client";
import type { BuildType, GeneratedWebsite, IntentSpec, IntegrationsStatus, PipelineResult, SandboxReport, ValidationIssue } from "../types/chainreact";
import PermissionsEditor, { PermissionState } from "../components/PermissionsEditor";
import ApprovalGatesEditor from "../components/ApprovalGatesEditor";
import BuildPlanReview from "../components/BuildPlanReview";
import ClarificationPrompt from "../components/ClarificationPrompt";
import RefineChat, { RefineMessage } from "../components/RefineChat";
import WebsitePreview from "../components/WebsitePreview";
import LeadCsvRunner from "../components/LeadCsvRunner";
import GoogleIntegration from "../components/GoogleIntegration";
import SystemWorkspace from "../components/workspace/SystemWorkspace";
import { EXAMPLE_REQUIREMENT } from "../components/RequirementForm";
import { navigate } from "../lib/router";
import { EMPTY_PERMISSION_DEFAULTS, PERMISSION_DEFAULTS_KEY, PermissionDefaults, usePref } from "../lib/prefs";
import { Badge, Button, Card, CardHeader, Disclosure, Field } from "../ui/primitives";
import { useToast } from "../ui/feedback";

interface Attachment {
  name: string;
  kind: "document" | "data";
  text: string;
  truncated: boolean;
}

interface AdvancedSpec {
  objective: string;
  inputs: string;
  outputs: string;
  trigger: string;
  rules: string;
  tools: string;
  failure: string;
  success: string;
  constraints: string;
}

const EMPTY_ADVANCED: AdvancedSpec = {
  objective: "",
  inputs: "",
  outputs: "",
  trigger: "",
  rules: "",
  tools: "",
  failure: "",
  success: "",
  constraints: "",
};

const ADVANCED_LABELS: Record<keyof AdvancedSpec, string> = {
  objective: "Business objective",
  inputs: "Inputs",
  outputs: "Expected outputs",
  trigger: "Trigger",
  rules: "Business rules",
  tools: "Tools and integrations to use",
  failure: "Failure handling and recovery",
  success: "Success criteria",
  constraints: "Cost, latency and security constraints",
};

const INTEGRATION_OPTIONS: { id: string; label: string; phrase: string; status: (s: IntegrationsStatus | null) => "connected" | "configured" | "missing" | "simulated" | "unknown" }[] = [
  { id: "gmail", label: "Gmail", phrase: "Gmail (email.send / email.read)", status: (s) => (!s ? "unknown" : s.google.connected ? "connected" : s.google.configured ? "configured" : "missing") },
  { id: "calendar", label: "Google Calendar", phrase: "Google Calendar (calendar.read / calendar.write)", status: (s) => (!s ? "unknown" : s.google.connected ? "connected" : s.google.configured ? "configured" : "missing") },
  { id: "slack", label: "Slack", phrase: "Slack (slack.post)", status: (s) => (!s ? "unknown" : s.slack.configured ? "connected" : "missing") },
  { id: "http", label: "REST API", phrase: "a REST API via HTTP requests (http.request)", status: (s) => (!s ? "unknown" : "connected") },
  { id: "crm", label: "CRM", phrase: "a CRM (crm.read / crm.write)", status: () => "simulated" },
  { id: "database", label: "Database", phrase: "a database (database.read / database.write)", status: () => "simulated" },
];

const INTEGRATION_STATUS_BADGE = {
  connected: { tone: "success", label: "Live" },
  configured: { tone: "warning", label: "Not connected" },
  missing: { tone: "outline", label: "Not configured" },
  simulated: { tone: "outline", label: "Simulated" },
  unknown: { tone: "outline", label: "—" },
} as const;

const MAX_ATTACHMENT_CHARS = 20000;

function errorMessage(err: unknown): { message: string; issues: ValidationIssue[] } {
  if (err instanceof ApiError) return { message: err.detail.message, issues: err.detail.issues ?? [] };
  if (err instanceof Error) return { message: err.message, issues: [] };
  return { message: "Something went wrong.", issues: [] };
}

function applyDefaults(base: PermissionState, defaults: PermissionDefaults): PermissionState {
  const allowed = new Set(base.allowed);
  const forbidden = new Set(base.forbidden);
  for (const [perm, policy] of Object.entries(defaults.policy)) {
    if (policy === "allow" && !forbidden.has(perm)) allowed.add(perm);
    if (policy === "deny") {
      forbidden.add(perm);
      allowed.delete(perm);
    }
  }
  return { allowed: [...allowed], forbidden: [...forbidden] };
}

export default function BuildPage() {
  const toast = useToast();
  const [defaults] = usePref<PermissionDefaults>(PERMISSION_DEFAULTS_KEY, EMPTY_PERMISSION_DEFAULTS);

  // Composer
  const [requirement, setRequirement] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationsStatus | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedSpec>(EMPTY_ADVANCED);
  const docInput = useRef<HTMLInputElement>(null);
  const dataInput = useRef<HTMLInputElement>(null);

  // Access policy
  const [permissions, setPermissions] = useState<PermissionState>(() => applyDefaults({ allowed: [], forbidden: [] }, defaults));
  const [approvalActions, setApprovalActions] = useState<string[]>(() => [...defaults.requireApproval]);
  const [suggestion, setSuggestion] = useState<PermissionSuggestion | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const accessTouched = useRef(false);

  // Pipeline
  const [phase, setPhase] = useState<"idle" | "planning" | "building">("idle");
  const [slow, setSlow] = useState(false);
  const [plan, setPlan] = useState<BuildPlan | null>(null);
  const [buildType, setBuildType] = useState<BuildType>("workflow");
  const [clarification, setClarification] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [website, setWebsite] = useState<GeneratedWebsite | null>(null);
  const [error, setError] = useState<{ message: string; issues: ValidationIssue[] } | null>(null);
  const [lastText, setLastText] = useState("");
  const [submittedBase, setSubmittedBase] = useState("");

  // Sandbox re-run
  const [sandboxReport, setSandboxReport] = useState<SandboxReport | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // Refinement chat
  const [refinements, setRefinements] = useState<string[]>([]);
  const [chat, setChat] = useState<RefineMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const busy = phase !== "idle";

  useEffect(() => {
    getIntegrationsStatus().then(setIntegrationStatus).catch(() => setIntegrationStatus(null));
  }, []);

  // Honest cold-start hint: only shown while a real request is still pending.
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [busy]);

  // Debounced permission suggestions from the requirement text.
  useEffect(() => {
    const text = requirement.trim();
    if (text.length < 20) {
      setSuggestion(null);
      setSuggestionStatus("idle");
      return;
    }
    setSuggestionStatus("loading");
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const s = await suggestPermissions(text);
        if (stale) return;
        setSuggestion(s);
        setSuggestionStatus("ready");
        if (!accessTouched.current) applySuggestion(s);
      } catch {
        if (!stale) setSuggestionStatus("error");
      }
    }, 700);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirement]);

  function applySuggestion(s: PermissionSuggestion) {
    // An explicit Deny in the defaults is never overridden by a suggestion.
    const denied = new Set(Object.entries(defaults.policy).filter(([, p]) => p === "deny").map(([k]) => k));
    const next = applyDefaults(
      { allowed: s.allowed.filter((p) => !denied.has(p)), forbidden: s.forbidden },
      defaults
    );
    setPermissions(next);
    setApprovalActions([...new Set([...s.approval_actions, ...defaults.requireApproval])]);
  }

  function composeRequirement(): string {
    const parts = [requirement.trim()];
    const adv = (Object.keys(ADVANCED_LABELS) as (keyof AdvancedSpec)[])
      .filter((k) => advanced[k].trim())
      .map((k) => `${ADVANCED_LABELS[k]}: ${advanced[k].trim()}`);
    if (adv.length) parts.push(`Additional specification:\n${adv.map((l) => `- ${l}`).join("\n")}`);
    if (integrations.length) {
      const phrases = INTEGRATION_OPTIONS.filter((o) => integrations.includes(o.id)).map((o) => o.phrase);
      parts.push(`Use these integrations: ${phrases.join("; ")}.`);
    }
    for (const a of attachments) {
      const heading = a.kind === "data" ? `Sample data from ${a.name}` : `Reference document ${a.name}`;
      parts.push(`${heading}${a.truncated ? " (truncated)" : ""}:\n"""\n${a.text}\n"""`);
    }
    return parts.filter(Boolean).join("\n\n");
  }

  function effectiveText(base: string, log: string[]): string {
    if (!log.length) return base;
    return `${base}\n\nAdditional refinements requested by the user (apply all of these):\n${log.map((r) => `- ${r}`).join("\n")}`;
  }

  async function runBuild(type: BuildType, intent: IntentSpec, text: string): Promise<{ ok: boolean; summary: string; message?: string }> {
    setPhase("building");
    setError(null);
    try {
      if (type === "website") {
        const site = await buildWebsite(text, intent);
        setWebsite(site);
        setResult(null);
        return { ok: true, summary: `Generated ${site.filename}.` };
      }
      const res = await synthesize({
        requirement: text,
        allowedPermissions: permissions.allowed,
        forbiddenPermissions: permissions.forbidden,
        approvalActions,
      });
      setResult(res);
      setWebsite(null);
      setSandboxReport(res.sandbox_report);
      setSandboxError(null);
      return {
        ok: true,
        summary: `${res.agent_architecture.agents.length} agents, ${res.workflow.nodes.length} workflow nodes, ${res.sandbox_report.passed}/${res.sandbox_report.total} checks passing.`,
      };
    } catch (err) {
      const e = errorMessage(err);
      setError(e);
      return { ok: false, summary: "", message: e.message };
    } finally {
      setPhase("idle");
    }
  }

  async function planAndBuild(text: string, skipClarification: boolean): Promise<{ ok: boolean; summary: string; message?: string }> {
    setPhase("planning");
    setError(null);
    setLastText(text);
    try {
      const res = await planBuild(text, skipClarification);
      if (res.needs_clarification && res.clarification_question) {
        setClarification(res.clarification_question);
        setPhase("idle");
        return { ok: false, summary: "", message: res.clarification_question };
      }
      setClarification(null);
      if (!res.intent) throw new Error("The planner returned no interpretation of the requirement.");
      const nextPlan: BuildPlan = { intent: res.intent, requirements_md: res.requirements_md ?? "" };
      setPlan(nextPlan);
      setBuildType(res.intent.build_type);
      return await runBuild(res.intent.build_type, res.intent, text);
    } catch (err) {
      const e = errorMessage(err);
      setError(e);
      setPhase("idle");
      return { ok: false, summary: "", message: e.message };
    }
  }

  function handleGenerate() {
    const base = composeRequirement();
    if (!requirement.trim() || busy) return;
    setRefinements([]);
    setChat([]);
    setPlan(null);
    setResult(null);
    setWebsite(null);
    setSubmittedBase(base);
    planAndBuild(base, false);
  }

  function handleAnswerClarification(answer: string) {
    if (!clarification) return;
    const base = `${submittedBase}\n\nClarification: ${clarification}\nAnswer: ${answer}`;
    setSubmittedBase(base);
    setRequirement((r) => `${r}\n\nClarification: ${clarification}\nAnswer: ${answer}`);
    planAndBuild(effectiveText(base, refinements), true);
  }

  function handleOverrideBuildType(t: BuildType) {
    if (!plan || busy) return;
    setBuildType(t);
    runBuild(t, { ...plan.intent, build_type: t }, lastText);
  }

  async function handleRefine(message: string) {
    const log = [...refinements, message];
    setRefinements(log);
    setChat((c) => [...c, { role: "user", text: message }]);
    setChatLoading(true);
    const out = await planAndBuild(effectiveText(submittedBase, log), true);
    setChatLoading(false);
    setChat((c) => [
      ...c,
      { role: "assistant", text: out.ok ? `Done — rebuilt with that applied. ${out.summary}` : `I couldn't apply that: ${out.message ?? "unknown error"}` },
    ]);
  }

  async function handleRerunSandbox() {
    if (!result) return;
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      setSandboxReport(await runSandbox(result));
    } catch (err) {
      setSandboxError(errorMessage(err).message);
    } finally {
      setSandboxLoading(false);
    }
  }

  function handleReset() {
    setRequirement("");
    setAttachments([]);
    setIntegrations([]);
    setAdvanced(EMPTY_ADVANCED);
    setPlan(null);
    setResult(null);
    setWebsite(null);
    setError(null);
    setClarification(null);
    setRefinements([]);
    setChat([]);
    setSandboxReport(null);
    accessTouched.current = false;
    setPermissions(applyDefaults({ allowed: [], forbidden: [] }, defaults));
    setApprovalActions([...defaults.requireApproval]);
  }

  async function handleFiles(files: FileList | null, kind: Attachment["kind"]) {
    if (!files) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      try {
        const text = await f.text();
        added.push({ name: f.name, kind, text: text.slice(0, MAX_ATTACHMENT_CHARS), truncated: text.length > MAX_ATTACHMENT_CHARS });
      } catch {
        toast({ tone: "error", title: `Couldn't read ${f.name}` });
      }
    }
    if (added.length) {
      setAttachments((a) => [...a.filter((x) => !added.some((n) => n.name === x.name)), ...added]);
      toast({ tone: "success", title: `Attached ${added.length} file${added.length > 1 ? "s" : ""}`, description: "Its contents are included as context when you generate." });
    }
  }

  const relevant = plan?.intent.relevant_integrations ?? [];
  const showGmail = relevant.includes("gmail");
  const showCalendar = relevant.includes("calendar");
  const showCrm = relevant.includes("crm_leads");
  const advancedCount = useMemo(() => Object.values(advanced).filter((v) => v.trim()).length, [advanced]);
  const hasOutput = !!(result || website);

  return (
    <div className="stack gap-5" style={{ minWidth: 0 }}>
      {!hasOutput && (
        <div style={{ paddingTop: 8 }}>
          <div className="eyebrow">Builder</div>
          <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", margin: "6px 0 6px" }}>Build your agent system</h1>
          <p className="text-secondary" style={{ margin: 0, maxWidth: 680 }}>
            Describe what you want to automate. ChainReact will engineer the agents, workflows, tools, and execution logic.
          </p>
        </div>
      )}

      {/* Composer */}
      <Card variant={hasOutput ? undefined : "accent"}>
        <div style={{ padding: 4 }}>
          <textarea
            className="textarea"
            aria-label="Describe the business process"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
            placeholder="Example: When a customer submits a support ticket, classify it, determine urgency, notify the right team, create a task, and send a confirmation email."
            rows={hasOutput ? 3 : 6}
            style={{ border: "none", background: "transparent", boxShadow: "none", resize: "vertical", fontSize: 15, lineHeight: 1.6, padding: "14px 14px 8px" }}
          />
          {(attachments.length > 0 || integrations.length > 0) && (
            <div className="row wrap gap-1" style={{ padding: "0 12px 8px" }}>
              {attachments.map((a) => (
                <span key={a.name} className="chip">
                  {a.kind === "data" ? <Table2 size={12} /> : <FileText size={12} />}
                  {a.name}
                  {a.truncated && <span className="text-tertiary">(truncated)</span>}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ height: 18, width: 18 }} aria-label={`Remove ${a.name}`} onClick={() => setAttachments((x) => x.filter((y) => y.name !== a.name))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              {integrations.map((id) => (
                <span key={id} className="chip">
                  <Plug size={12} />
                  {INTEGRATION_OPTIONS.find((o) => o.id === id)?.label}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ height: 18, width: 18 }} aria-label="Remove integration" onClick={() => setIntegrations((x) => x.filter((y) => y !== id))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="row wrap gap-1" style={{ padding: "8px 8px", borderTop: "1px solid var(--border)" }}>
            <input ref={dataInput} type="file" hidden multiple accept=".csv,.json,.tsv,.txt" onChange={(e) => { handleFiles(e.target.files, "data"); e.target.value = ""; }} />
            <input ref={docInput} type="file" hidden multiple accept=".md,.txt,.json,.yaml,.yml,.html,.csv" onChange={(e) => { handleFiles(e.target.files, "document"); e.target.value = ""; }} />
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => dataInput.current?.click()} disabled={busy}>
              Add files
            </Button>
            <Button variant="ghost" size="sm" icon={<Paperclip size={14} />} onClick={() => docInput.current?.click()} disabled={busy}>
              Attach docs
            </Button>
            <Button variant="ghost" size="sm" icon={<Plug size={14} />} onClick={() => setShowIntegrations((v) => !v)} aria-expanded={showIntegrations}>
              Integrations{integrations.length ? ` · ${integrations.length}` : ""}
            </Button>
            <Button variant="ghost" size="sm" icon={<SlidersHorizontal size={14} />} onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}>
              Advanced{advancedCount ? ` · ${advancedCount}` : ""}
            </Button>
            <div className="spacer" />
            {!requirement && !hasOutput && (
              <Button variant="ghost" size="sm" onClick={() => setRequirement(EXAMPLE_REQUIREMENT)}>
                Fill in an example
              </Button>
            )}
            {hasOutput && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={handleReset} disabled={busy}>
                Start over
              </Button>
            )}
            <span className="desktop-only text-xs text-tertiary" style={{ marginRight: 4 }}>
              <span className="kbd">Ctrl</span> <span className="kbd">Enter</span>
            </span>
            <Button variant="primary" icon={<Sparkles size={15} />} loading={busy} disabled={!requirement.trim() || busy} onClick={handleGenerate}>
              {hasOutput ? "Regenerate" : "Generate Agent System"}
            </Button>
          </div>
        </div>
      </Card>

      {showIntegrations && (
        <Card>
          <CardHeader
            title="Select integrations"
            description="Selected integrations are added to the requirement so agents get the matching tools. Status is read live from the backend."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate("/integrations")}>
                Manage
              </Button>
            }
          />
          <div className="card-body grid grid-3">
            {INTEGRATION_OPTIONS.map((o) => {
              const st = INTEGRATION_STATUS_BADGE[o.status(integrationStatus)];
              const on = integrations.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  className="card card-interactive"
                  aria-pressed={on}
                  onClick={() => setIntegrations((x) => (on ? x.filter((y) => y !== o.id) : [...x, o.id]))}
                  style={{ padding: "10px 12px", textAlign: "left", display: "flex", alignItems: "center", gap: 8, borderColor: on ? "var(--accent)" : undefined, background: on ? "var(--accent-soft)" : undefined, color: "inherit", font: "inherit" }}
                >
                  {on ? <CheckCircle2 size={15} style={{ color: "var(--accent)" }} /> : <Plug size={15} className="text-tertiary" />}
                  <span style={{ fontWeight: 550 }}>{o.label}</span>
                  <span className="spacer" />
                  <Badge tone={st.tone}>{st.label}</Badge>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {showAdvanced && (
        <Card>
          <CardHeader title="Advanced settings" description="Optional. Filled-in fields are appended to the requirement as a structured specification." />
          <div className="card-body stack gap-2">
            <Disclosure title="Business objective" meta={advanced.objective ? <Badge tone="accent">set</Badge> : undefined} defaultOpen>
              <AdvancedText value={advanced.objective} onChange={(v) => setAdvanced({ ...advanced, objective: v })} placeholder="What outcome should this system achieve for the business?" />
            </Disclosure>
            <Disclosure title="Inputs and outputs" meta={advanced.inputs || advanced.outputs ? <Badge tone="accent">set</Badge> : undefined}>
              <div className="grid grid-2">
                <Field label="Inputs">
                  <AdvancedText value={advanced.inputs} onChange={(v) => setAdvanced({ ...advanced, inputs: v })} placeholder="e.g. ticket_text, customer_email" />
                </Field>
                <Field label="Expected outputs">
                  <AdvancedText value={advanced.outputs} onChange={(v) => setAdvanced({ ...advanced, outputs: v })} placeholder="e.g. urgency, assigned_team, confirmation_sent" />
                </Field>
              </div>
            </Disclosure>
            <Disclosure title="Trigger and business rules" meta={advanced.trigger || advanced.rules ? <Badge tone="accent">set</Badge> : undefined}>
              <div className="stack gap-3">
                <Field label="Trigger">
                  <AdvancedText value={advanced.trigger} onChange={(v) => setAdvanced({ ...advanced, trigger: v })} placeholder="e.g. a new ticket arrives via webhook" />
                </Field>
                <Field label="Rules">
                  <AdvancedText value={advanced.rules} onChange={(v) => setAdvanced({ ...advanced, rules: v })} placeholder="e.g. tickets mentioning outage are always urgent" />
                </Field>
              </div>
            </Disclosure>
            <Disclosure title="Tools" meta={advanced.tools ? <Badge tone="accent">set</Badge> : undefined}>
              <AdvancedText value={advanced.tools} onChange={(v) => setAdvanced({ ...advanced, tools: v })} placeholder="Specific tools, endpoints, or channels to use" />
            </Disclosure>
            <Disclosure title="Permissions" meta={<Badge tone="outline">{permissions.allowed.length} allowed · {permissions.forbidden.length} blocked</Badge>}>
              <PermissionsEditor
                hideHeading
                value={permissions}
                onChange={(p) => {
                  accessTouched.current = true;
                  setPermissions(p);
                }}
                suggestions={suggestion ? { allowed: suggestion.allowed, forbidden: suggestion.forbidden, approvalActions: suggestion.approval_actions } : null}
                suggestionStatus={suggestionStatus}
                onApplySuggestions={() => suggestion && applySuggestion(suggestion)}
              />
            </Disclosure>
            <Disclosure title="Human approval" meta={<Badge tone="outline">{approvalActions.length} gate(s)</Badge>}>
              <ApprovalGatesEditor
                value={approvalActions}
                onChange={(a) => {
                  accessTouched.current = true;
                  setApprovalActions(a);
                }}
                candidateActions={permissions.allowed}
              />
            </Disclosure>
            <Disclosure title="Failure handling and recovery" meta={advanced.failure ? <Badge tone="accent">set</Badge> : undefined}>
              <AdvancedText value={advanced.failure} onChange={(v) => setAdvanced({ ...advanced, failure: v })} placeholder="e.g. retry twice with backoff, then escalate to a human" />
            </Disclosure>
            <Disclosure title="Success criteria" meta={advanced.success ? <Badge tone="accent">set</Badge> : undefined}>
              <AdvancedText value={advanced.success} onChange={(v) => setAdvanced({ ...advanced, success: v })} placeholder="How do we know a run succeeded?" />
            </Disclosure>
            <Disclosure title="Cost and security constraints" meta={advanced.constraints ? <Badge tone="accent">set</Badge> : undefined}>
              <AdvancedText value={advanced.constraints} onChange={(v) => setAdvanced({ ...advanced, constraints: v })} placeholder="e.g. no PII leaves the EU, keep each run under 30 seconds" />
            </Disclosure>
          </div>
        </Card>
      )}

      {busy && (
        <Card padded>
          <div className="row gap-3" style={{ alignItems: "flex-start" }}>
            <span className="dot-pulse" style={{ marginTop: 6 }} />
            <div className="stack gap-1">
              <strong>{phase === "planning" ? "Understanding your requirement…" : buildType === "website" ? "Building the website…" : "Engineering agents, workflow, tools and tests…"}</strong>
              <span className="text-sm text-secondary">
                {phase === "planning"
                  ? "Interpreting intent, checking for missing details and writing requirements.md."
                  : buildType === "website"
                    ? "Generating and validating a single-file site."
                    : "Specifying the process, designing agents, wiring the workflow, then validating and self-repairing."}
              </span>
              {slow && <span className="text-xs text-tertiary">Still working — the model can take a little longer on the first request.</span>}
            </div>
          </div>
        </Card>
      )}

      {clarification && !busy && (
        <ClarificationPrompt question={clarification} loading={busy} onAnswer={handleAnswerClarification} />
      )}

      {error && !busy && (
        <Card>
          <div className="card-pad stack gap-2" style={{ borderLeft: "3px solid var(--danger)" }}>
            <div className="row gap-2">
              <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
              <strong>Generation failed</strong>
            </div>
            <span className="text-sm">{error.message}</span>
            {error.issues.length > 0 && (
              <ul className="text-sm text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
                {error.issues.map((i, idx) => (
                  <li key={idx}>
                    <Badge tone={i.severity === "error" ? "danger" : "warning"}>{i.severity}</Badge> <span className="mono">{i.field}</span> — {i.message}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => (plan ? runBuild(buildType, plan.intent, lastText) : planAndBuild(lastText || composeRequirement(), true))}>
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {plan && <BuildPlanReview plan={plan} buildType={buildType} onChangeBuildType={handleOverrideBuildType} loading={busy} />}

      {plan && (showGmail || showCalendar) && (
        <GoogleIntegration showGmail={showGmail} showCalendar={showCalendar} gmailDraft={plan.intent.gmail_action ?? null} calendarDraft={plan.intent.calendar_event ?? null} />
      )}
      {plan && showCrm && <LeadCsvRunner />}

      {website && <WebsitePreview website={website} onRegenerate={() => plan && runBuild("website", plan.intent, lastText)} regenerating={busy} />}

      {result && (
        <>
          <Card>
            <div className="card-pad row wrap gap-3">
              <div className="stack gap-1 grow" style={{ minWidth: 0 }}>
                <div className="row wrap gap-2">
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650 }} className="truncate">
                    {result.process_spec.name}
                  </h2>
                  <Badge tone={result.deployment_approved ? "success" : "warning"} dot>
                    {result.deployment_approved ? "Deployment approved" : "Deployment blocked"}
                  </Badge>
                  <span className="chip mono">{result.system_id}</span>
                </div>
                <span className="text-sm text-secondary">{result.process_spec.objective}</span>
              </div>
              <Button icon={<Boxes size={14} />} onClick={() => navigate(`/systems/${result.system_id}`)}>
                Open in My Systems <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
          <SystemWorkspace
            key={result.system_id}
            systemId={result.system_id}
            spec={result.process_spec}
            architecture={result.agent_architecture}
            workflow={result.workflow}
            specValidation={result.spec_validation}
            policyCheck={result.policy_check}
            sandboxReport={sandboxReport}
            onRerunSandbox={handleRerunSandbox}
            sandboxLoading={sandboxLoading}
            sandboxError={sandboxError}
            auditTrail={result.audit_trail}
            repairLog={result.repair_log}
            deploymentApproved={result.deployment_approved}
          />
        </>
      )}

      {hasOutput && <RefineChat messages={chat} loading={chatLoading} onSend={handleRefine} />}
    </div>
  );
}

function AdvancedText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <textarea className="textarea" rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
