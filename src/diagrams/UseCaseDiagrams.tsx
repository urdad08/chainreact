import { ACTOR_LABEL_WIDTH, Actor, DiagramFrame, Label, SystemBoundary, UCLink, UseCase, textWidth, useCaseWidth } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

const ROW = 58;      // vertical distance between use cases
const UC_H = 40;     // ellipse height
const PAD = 24;      // padding inside the system boundary
const TITLE_H = 34;  // room for the boundary title

/**
 * Lays out an actor on the left, a system boundary with one column of use
 * cases, and an optional <<extend>> use case in a second column. All sizes
 * come from the label text so nothing overflows or overlaps.
 */
function UseCaseDiagram({
  actor, system, cases, extend,
}: {
  actor: string;
  system: string;
  cases: string[];
  extend?: { label: string; from: number[] };
}) {
  const actorColW = Math.max(90, ACTOR_LABEL_WIDTH(actor) + 24);
  const actorX = 16 + actorColW / 2;

  const caseW = Math.max(...cases.map(useCaseWidth));
  const extW = extend ? useCaseWidth(extend.label) : 0;
  const colGap = extend ? 110 : 0;

  const boxX = 16 + actorColW + 40;
  const boxY = 12;
  const boxW = PAD + caseW + colGap + extW + PAD;
  const boxW2 = Math.max(boxW, textWidth(system, 12) + 40);
  const boxH = TITLE_H + cases.length * ROW - (ROW - UC_H) + PAD;

  const caseCX = boxX + PAD + caseW / 2;
  const caseY = (i: number) => boxY + TITLE_H + UC_H / 2 + i * ROW;
  const midY = (caseY(0) + caseY(cases.length - 1)) / 2;

  const width = boxX + boxW2 + 16;
  const height = boxY + boxH + 12;

  // Actor body is drawn from y-8 (head) to y+48 (feet); center it on the column of cases.
  const actorY = midY - 22;
  const handY = actorY + 16;

  let ext = null;
  if (extend) {
    const ex = boxX + PAD + caseW + colGap + extW / 2;
    const ey = extend.from.reduce((s, i) => s + caseY(i), 0) / extend.from.length;
    ext = (
      <g>
        {extend.from.map((i) => (
          <UCLink key={i} x1={ex - extW / 2} y1={ey} x2={caseCX + caseW / 2} y2={caseY(i)} dashed />
        ))}
        <Label x={caseCX + caseW / 2 + colGap / 2} y={ey - 30} size={10} color="#666">«extend»</Label>
        <UseCase x={ex} y={ey} w={extW} h={UC_H} label={extend.label} />
      </g>
    );
  }

  return (
    <DiagramFrame width={width} height={height}>
      <SystemBoundary x={boxX} y={boxY} w={boxW2} h={boxH} label={system} />
      {cases.map((_, i) => (
        <UCLink key={i} x1={actorX + 16} y1={handY} x2={caseCX - caseW / 2} y2={caseY(i)} />
      ))}
      {ext}
      {cases.map((c, i) => (
        <UseCase key={c} x={caseCX} y={caseY(i)} w={caseW} h={UC_H} label={c} />
      ))}
      <Actor x={actorX} y={actorY} label={actor} />
    </DiagramFrame>
  );
}

export function UC1_DefineRequirement() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>UC-1: Define Process Requirement</h4>
      <UseCaseDiagram
        actor="Process Owner"
        system="ChainReact — Requirement Intake"
        cases={[
          "Enter NL Requirement",
          "Set Allowed / Forbidden Permissions",
          "Configure Approval Gates",
          "Submit for Synthesis",
        ]}
      />
      <p style={{ fontSize: 12, color: "#666" }}>
        The Process Owner supplies the requirement text plus explicit, structured permission and
        approval-gate choices — these never come from LLM-parsed prose (security boundary set by
        the UI, not inferred).
      </p>
    </div>
  );
}

export function UC2_SynthesizeSystem() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>UC-2: Synthesize Agent System</h4>
      <UseCaseDiagram
        actor={"ChainReact\nPipeline"}
        system="Synthesis Engine"
        cases={[
          "Parse Requirement → ProcessSpec",
          "Validate ProcessSpec",
          "Synthesize Agent Architecture",
          "Check Policy (permissions)",
          "Synthesize Workflow Graph",
        ]}
        extend={{ label: "Self-Repair (feedback loop)", from: [2, 3, 4] }}
      />
      <p style={{ fontSize: 12, color: "#666" }}>
        &lt;&lt;extend&gt;&gt; Self-Repair fires (dashed) when the deterministic Policy Engine or
        workflow checks fail — up to MAX_REPAIR_ATTEMPTS retries before anything ships.
      </p>
    </div>
  );
}

export function UC3_TestAndSandbox() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>UC-3: Test, Sandbox &amp; Gate Deployment</h4>
      <UseCaseDiagram
        actor={"ChainReact\nPipeline"}
        system="Sandbox & Audit"
        cases={[
          "Generate Test Cases",
          "Run Sandbox (mock tools)",
          "Record Audit Trail Entry",
          "Compute Deployment Gate",
        ]}
      />
      <p style={{ fontSize: 12, color: "#666" }}>
        No real CRM/email/DB is ever touched here — the Sandbox Executor walks the compiled graph
        against in-memory mock tools only. Deployment is approved only if the policy check AND the
        sandbox run both pass.
      </p>
    </div>
  );
}

export function UC4_RuntimeAndReview() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>UC-4: Runtime Execution &amp; Review</h4>
      <UseCaseDiagram
        actor="Process Owner"
        system="Runtime & Dashboard"
        cases={[
          "Run Sample Execution",
          "Watch Step-by-Step Data Flow",
          "View Audit Trail",
          "Review Deployment Decision",
          "Ask Assistant Chat",
        ]}
      />
      <p style={{ fontSize: 12, color: "#666" }}>
        The Runtime Executor calls the LLM once per agent against a real sample record, so real
        values (e.g. an actual lead score) accumulate step by step instead of a static trace.
      </p>
    </div>
  );
}
