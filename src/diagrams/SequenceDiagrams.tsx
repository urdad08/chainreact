import { DiagramFrame, LIFELINE_HEAD_H, Lifeline, SeqArrow, lifelineHeadWidth, textWidth } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

type Msg = { from: number; to: number; label: string; dashed?: boolean };

const MARGIN = 16;
const TOP = 12;
const STEP = 34;       // vertical distance between messages
const SELF_STEP = 42;  // self-calls need room for their loop

/**
 * Lays out lifelines so every message label fits between the lifelines it
 * spans and no two lifeline headers overlap. Columns are widened only as
 * much as the labels require.
 */
function SequenceDiagram({ participants, messages }: { participants: string[]; messages: Msg[] }) {
  const n = participants.length;
  const heads = participants.map(lifelineHeadWidth);

  // Minimum gap between adjacent lifelines: headers must not touch.
  const gaps = heads.slice(0, -1).map((w, i) => (w + heads[i + 1]) / 2 + 18);
  let rightExtra = heads[n - 1] / 2;

  // Self-call labels sit to the right of their lifeline.
  for (const m of messages) {
    if (m.from !== m.to) continue;
    const need = 34 + textWidth(m.label, 10) + 14;
    if (m.from < n - 1) gaps[m.from] = Math.max(gaps[m.from], need);
    else rightExtra = Math.max(rightExtra, need);
  }

  // Widen spans (shortest first) until each message label fits above its arrow.
  const spans = messages
    .filter((m) => m.from !== m.to)
    .map((m) => ({ lo: Math.min(m.from, m.to), hi: Math.max(m.from, m.to), w: textWidth(m.label, 10) + 28 }))
    .sort((a, b) => a.hi - a.lo - (b.hi - b.lo));
  for (const s of spans) {
    const have = gaps.slice(s.lo, s.hi).reduce((a, b) => a + b, 0);
    if (have < s.w) {
      const add = (s.w - have) / (s.hi - s.lo);
      for (let i = s.lo; i < s.hi; i++) gaps[i] += add;
    }
  }

  const xs = [MARGIN + heads[0] / 2];
  gaps.forEach((g) => xs.push(xs[xs.length - 1] + g));

  const ys: number[] = [];
  let y = TOP + LIFELINE_HEAD_H + 30;
  messages.forEach((m) => {
    ys.push(y);
    y += m.from === m.to ? SELF_STEP : STEP;
  });
  const bottom = y - 4;

  const width = Math.ceil(xs[n - 1] + rightExtra + MARGIN);
  const height = Math.ceil(bottom + 14);

  return (
    <DiagramFrame width={width} height={height}>
      {participants.map((p, i) => (
        <Lifeline key={p} x={xs[i]} top={TOP} bottom={bottom} label={p} />
      ))}
      {messages.map((m, i) => (
        <SeqArrow
          key={i}
          x1={xs[m.from]} x2={xs[m.to]} y={ys[i]}
          label={m.label} dashed={m.dashed} selfCall={m.from === m.to}
        />
      ))}
    </DiagramFrame>
  );
}

export function SEQ1_RequirementToSpec() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-1: Requirement → Validated ProcessSpec</h4>
      <SequenceDiagram
        participants={["Dashboard (React)", "/api/synthesize", "Requirement Parser", "Gemini LLM", "Validator"]}
        messages={[
          { from: 0, to: 1, label: "POST requirement + permissions" },
          { from: 1, to: 2, label: "parse_requirement(text)" },
          { from: 2, to: 3, label: "structured_completion(ProcessSpec schema)" },
          { from: 3, to: 2, label: "JSON → ProcessSpec", dashed: true },
          { from: 2, to: 1, label: "apply_to(): overwrite permissions/approvals", dashed: true },
          { from: 1, to: 4, label: "validate_process_spec(spec)" },
          { from: 4, to: 1, label: "ValidationResult", dashed: true },
          { from: 1, to: 0, label: "422 if invalid, else continue", dashed: true },
        ]}
      />
    </div>
  );
}

export function SEQ2_AgentSynthesisRepair() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-2: Agent Synthesis with Self-Repair</h4>
      <SequenceDiagram
        participants={["/api/synthesize", "Agent Architect", "Gemini LLM", "Policy Engine"]}
        messages={[
          { from: 0, to: 1, label: "synthesize_agents(spec, feedback=None)" },
          { from: 1, to: 2, label: "structured_completion" },
          { from: 2, to: 1, label: "AgentArchitecture", dashed: true },
          { from: 1, to: 0, label: "architecture (attempt 1)", dashed: true },
          { from: 0, to: 3, label: "check_agent_permissions + tool coverage" },
          { from: 3, to: 0, label: "issues found", dashed: true },
          { from: 0, to: 1, label: "synthesize_agents(spec, feedback=issues)" },
          { from: 1, to: 2, label: "structured_completion (retry)" },
          { from: 2, to: 1, label: "corrected AgentArchitecture", dashed: true },
          { from: 1, to: 0, label: "architecture (attempt 2)", dashed: true },
          { from: 0, to: 3, label: "re-check" },
          { from: 3, to: 0, label: "PASSED", dashed: true },
        ]}
      />
      <p style={{ fontSize: 12, color: "#666" }}>Repeats up to MAX_REPAIR_ATTEMPTS (3) before failing the request.</p>
    </div>
  );
}

export function SEQ3_WorkflowSynthesisRepair() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-3: Workflow Synthesis with Self-Repair</h4>
      <SequenceDiagram
        participants={["/api/synthesize", "Workflow Synthesizer", "Gemini LLM", "workflow_issues()"]}
        messages={[
          { from: 0, to: 1, label: "synthesize_workflow(spec, arch)" },
          { from: 1, to: 2, label: "structured_completion" },
          { from: 2, to: 1, label: "WorkflowGraph", dashed: true },
          { from: 1, to: 0, label: "graph (attempt 1)", dashed: true },
          { from: 0, to: 3, label: "check start→end connectivity, approval gates" },
          { from: 3, to: 0, label: "missing approval node for 'send_email'", dashed: true },
          { from: 0, to: 1, label: "synthesize_workflow(spec, arch, feedback)" },
          { from: 1, to: 2, label: "structured_completion (retry)" },
          { from: 2, to: 1, label: "corrected WorkflowGraph", dashed: true },
          { from: 1, to: 0, label: "graph (attempt 2)", dashed: true },
        ]}
      />
    </div>
  );
}

export function SEQ4_SandboxExecution() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-4: Test Generation &amp; Sandbox Execution</h4>
      <SequenceDiagram
        participants={["Dashboard", "/api/synthesize", "Test Generator", "Sandbox Executor", "Mock Tool Registry", "Audit Trail"]}
        messages={[
          { from: 1, to: 2, label: "generate_tests(spec, arch, workflow)" },
          { from: 2, to: 1, label: "TestCase[]", dashed: true },
          { from: 1, to: 3, label: "run_tests(spec, arch, workflow)" },
          { from: 3, to: 4, label: "mock.call(operation) per agent tool" },
          { from: 4, to: 3, label: "{status: ok}", dashed: true },
          { from: 3, to: 3, label: "simulate human_approval" },
          { from: 3, to: 1, label: "SandboxReport (pass/fail, trace)", dashed: true },
          { from: 1, to: 5, label: "record('sandbox_run', summary)" },
          { from: 1, to: 5, label: "set_deployment_approved(bool)" },
          { from: 1, to: 0, label: "PipelineResult", dashed: true },
        ]}
      />
    </div>
  );
}

export function SEQ5_RuntimeExecution() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-5: Runtime Execution Against Sample Input</h4>
      <SequenceDiagram
        participants={["Dashboard", "/api/runtime/execute", "Runtime Executor", "Gemini LLM", "Mock Tools"]}
        messages={[
          { from: 0, to: 1, label: "POST sample input_data" },
          { from: 1, to: 2, label: "execute_process(spec, arch, workflow, input)" },
          { from: 2, to: 3, label: "simulate agent output (per node)" },
          { from: 3, to: 2, label: "{lead_score: '78', ...}", dashed: true },
          { from: 2, to: 4, label: "mock.call(tool.op, **output)" },
          { from: 2, to: 2, label: "merge output into context" },
          { from: 2, to: 2, label: "repeat per agent node until end" },
          { from: 2, to: 1, label: "RuntimeExecutionResult (steps, final_context)", dashed: true },
          { from: 1, to: 0, label: "render step-by-step trace", dashed: true },
        ]}
      />
    </div>
  );
}
