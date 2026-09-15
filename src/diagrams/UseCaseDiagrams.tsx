import { Actor, DiagramFrame, SystemBoundary, UCLink, UseCase } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

export function UC1_DefineRequirement() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>UC-1: Define Process Requirement</h4>
      <DiagramFrame width={560} height={300}>
        <Actor x={45} y={120} label="Process Owner" />
        <SystemBoundary x={140} y={30} w={380} h={230} label="ChainReact — Requirement Intake" />
        <UseCase x={330} y={70} label="Enter NL Requirement" />
        <UseCase x={330} y={130} label="Set Allowed / Forbidden Permissions" />
        <UseCase x={330} y={190} label="Configure Approval Gates" />
        <UseCase x={330} y={240} label="Submit for Synthesis" />
        <UCLink x1={53} y1={112} x2={255} y2={70} />
        <UCLink x1={53} y1={120} x2={255} y2={130} />
        <UCLink x1={53} y1={128} x2={255} y2={190} />
        <UCLink x1={53} y1={135} x2={255} y2={240} />
      </DiagramFrame>
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
      <DiagramFrame width={560} height={340}>
        <Actor x={45} y={140} label="ChainReact\nPipeline" />
        <SystemBoundary x={140} y={20} w={400} h={300} label="Synthesis Engine" />
        <UseCase x={340} y={55} label="Parse Requirement → ProcessSpec" />
        <UseCase x={340} y={110} label="Validate ProcessSpec" />
        <UseCase x={340} y={165} label="Synthesize Agent Architecture" />
        <UseCase x={340} y={220} label="Check Policy (permissions)" />
        <UseCase x={340} y={275} label="Synthesize Workflow Graph" />
        <UseCase x={130} y={330} w={170} label="Self-Repair (feedback loop)" />
        <UCLink x1={53} y1={135} x2={265} y2={55} />
        <UCLink x1={53} y1={138} x2={265} y2={110} />
        <UCLink x1={53} y1={141} x2={265} y2={165} />
        <UCLink x1={53} y1={144} x2={265} y2={220} />
        <UCLink x1={53} y1={147} x2={265} y2={275} />
        <UCLink x1={265} y1={165} x2={195} y2={310} dashed />
        <UCLink x1={265} y1={220} x2={195} y2={310} dashed />
        <UCLink x1={265} y1={275} x2={195} y2={310} dashed />
      </DiagramFrame>
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
      <DiagramFrame width={560} height={300}>
        <Actor x={45} y={120} label="ChainReact\nPipeline" />
        <SystemBoundary x={140} y={30} w={400} h={230} label="Sandbox & Audit" />
        <UseCase x={340} y={70} label="Generate Test Cases" />
        <UseCase x={340} y={125} label="Run Sandbox (mock tools)" />
        <UseCase x={340} y={180} label="Record Audit Trail Entry" />
        <UseCase x={340} y={235} label="Compute Deployment Gate" />
        <UCLink x1={53} y1={112} x2={265} y2={70} />
        <UCLink x1={53} y1={118} x2={265} y2={125} />
        <UCLink x1={53} y1={124} x2={265} y2={180} />
        <UCLink x1={53} y1={130} x2={265} y2={235} />
      </DiagramFrame>
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
      <DiagramFrame width={560} height={320}>
        <Actor x={45} y={140} label="Process Owner" />
        <SystemBoundary x={140} y={20} w={400} h={280} label="Runtime & Dashboard" />
        <UseCase x={340} y={60} label="Run Sample Execution" />
        <UseCase x={340} y={115} label="Watch Step-by-Step Data Flow" />
        <UseCase x={340} y={170} label="View Audit Trail" />
        <UseCase x={340} y={225} label="Review Deployment Decision" />
        <UseCase x={340} y={280} label="Ask Assistant Chat" />
        <UCLink x1={53} y1={132} x2={265} y2={60} />
        <UCLink x1={53} y1={135} x2={265} y2={115} />
        <UCLink x1={53} y1={138} x2={265} y2={170} />
        <UCLink x1={53} y1={141} x2={265} y2={225} />
        <UCLink x1={53} y1={144} x2={265} y2={280} />
      </DiagramFrame>
      <p style={{ fontSize: 12, color: "#666" }}>
        The Runtime Executor calls the LLM once per agent against a real sample record, so real
        values (e.g. an actual lead score) accumulate step by step instead of a static trace.
      </p>
    </div>
  );
}
