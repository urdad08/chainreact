import { DiagramFrame, Lifeline, SeqArrow } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

export function SEQ1_RequirementToSpec() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-1: Requirement → Validated ProcessSpec</h4>
      <DiagramFrame width={620} height={300}>
        <Lifeline x={70} top={40} bottom={270} label="Dashboard (React)" />
        <Lifeline x={220} top={40} bottom={270} label="/api/synthesize" />
        <Lifeline x={370} top={40} bottom={270} label="Requirement Parser" />
        <Lifeline x={500} top={40} bottom={270} label="Gemini LLM" />
        <Lifeline x={610 - 40} top={40} bottom={270} label="Validator" />
        <SeqArrow x1={70} x2={220} y={70} label="POST requirement + permissions" />
        <SeqArrow x1={220} x2={370} y={100} label="parse_requirement(text)" />
        <SeqArrow x1={370} x2={500} y={130} label="structured_completion(ProcessSpec schema)" />
        <SeqArrow x1={500} x2={370} y={160} label="JSON → ProcessSpec" dashed />
        <SeqArrow x1={370} x2={220} y={185} label="apply_to(): overwrite permissions/approvals" />
        <SeqArrow x1={220} x2={570} y={210} label="validate_process_spec(spec)" />
        <SeqArrow x1={570} x2={220} y={235} label="ValidationResult" dashed />
        <SeqArrow x1={220} x2={70} y={260} label="422 if invalid, else continue" dashed />
      </DiagramFrame>
    </div>
  );
}

export function SEQ2_AgentSynthesisRepair() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-2: Agent Synthesis with Self-Repair</h4>
      <DiagramFrame width={620} height={340}>
        <Lifeline x={80} top={40} bottom={310} label="/api/synthesize" />
        <Lifeline x={230} top={40} bottom={310} label="Agent Architect" />
        <Lifeline x={370} top={40} bottom={310} label="Gemini LLM" />
        <Lifeline x={500} top={40} bottom={310} label="Policy Engine" />
        <SeqArrow x1={80} x2={230} y={70} label="synthesize_agents(spec, feedback=None)" />
        <SeqArrow x1={230} x2={370} y={95} label="structured_completion" />
        <SeqArrow x1={370} x2={230} y={120} label="AgentArchitecture" dashed />
        <SeqArrow x1={230} x2={80} y={145} label="architecture (attempt 1)" dashed />
        <SeqArrow x1={80} x2={500} y={170} label="check_agent_permissions + tool coverage" />
        <SeqArrow x1={500} x2={80} y={195} label="issues found" dashed />
        <SeqArrow x1={80} x2={230} y={225} label="synthesize_agents(spec, feedback=issues)" />
        <SeqArrow x1={230} x2={370} y={250} label="structured_completion (retry)" />
        <SeqArrow x1={370} x2={80} y={275} label="corrected AgentArchitecture" dashed />
        <SeqArrow x1={80} x2={500} y={300} label="re-check → PASSED" />
      </DiagramFrame>
      <p style={{ fontSize: 12, color: "#666" }}>Repeats up to MAX_REPAIR_ATTEMPTS (3) before failing the request.</p>
    </div>
  );
}

export function SEQ3_WorkflowSynthesisRepair() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-3: Workflow Synthesis with Self-Repair</h4>
      <DiagramFrame width={620} height={300}>
        <Lifeline x={80} top={40} bottom={270} label="/api/synthesize" />
        <Lifeline x={240} top={40} bottom={270} label="Workflow Synthesizer" />
        <Lifeline x={400} top={40} bottom={270} label="Gemini LLM" />
        <Lifeline x={560} top={40} bottom={270} label="workflow_issues()" />
        <SeqArrow x1={80} x2={240} y={70} label="synthesize_workflow(spec, arch)" />
        <SeqArrow x1={240} x2={400} y={95} label="structured_completion" />
        <SeqArrow x1={400} x2={240} y={120} label="WorkflowGraph" dashed />
        <SeqArrow x1={240} x2={80} y={145} label="graph (attempt 1)" dashed />
        <SeqArrow x1={80} x2={560} y={170} label="check start→end connectivity, approval gates" />
        <SeqArrow x1={560} x2={80} y={195} label="missing approval node for 'send_email'" dashed />
        <SeqArrow x1={80} x2={240} y={220} label="synthesize_workflow(spec, arch, feedback)" />
        <SeqArrow x1={240} x2={80} y={250} label="corrected WorkflowGraph" dashed />
      </DiagramFrame>
    </div>
  );
}

export function SEQ4_SandboxExecution() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-4: Test Generation &amp; Sandbox Execution</h4>
      <DiagramFrame width={620} height={340}>
        <Lifeline x={70} top={40} bottom={310} label="/api/synthesize" />
        <Lifeline x={210} top={40} bottom={310} label="Test Generator" />
        <Lifeline x={350} top={40} bottom={310} label="Sandbox Executor" />
        <Lifeline x={480} top={40} bottom={310} label="Mock Tool Registry" />
        <Lifeline x={600 - 20} top={40} bottom={310} label="Audit Trail" />
        <SeqArrow x1={70} x2={210} y={70} label="generate_tests(spec, arch, workflow)" />
        <SeqArrow x1={210} x2={70} y={95} label="TestCase[]" dashed />
        <SeqArrow x1={70} x2={350} y={120} label="run_tests(spec, arch, workflow)" />
        <SeqArrow x1={350} x2={480} y={150} label="mock.call(operation) per agent tool" />
        <SeqArrow x1={480} x2={350} y={175} label="{status: ok}" dashed />
        <SeqArrow x1={350} x2={350} y={200} label="simulate human_approval decision" selfCall />
        <SeqArrow x1={350} x2={70} y={230} label="SandboxReport (pass/fail, trace)" dashed />
        <SeqArrow x1={70} x2={580} y={255} label="record('sandbox_run', summary)" />
        <SeqArrow x1={70} x2={580} y={280} label="set_deployment_approved(bool)" />
        <SeqArrow x1={70} x2={20} y={305} label="return PipelineResult" dashed />
      </DiagramFrame>
    </div>
  );
}

export function SEQ5_RuntimeExecution() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>SEQ-5: Runtime Execution Against Sample Input</h4>
      <DiagramFrame width={620} height={340}>
        <Lifeline x={70} top={40} bottom={310} label="Dashboard" />
        <Lifeline x={210} top={40} bottom={310} label="/api/runtime/execute" />
        <Lifeline x={350} top={40} bottom={310} label="Runtime Executor" />
        <Lifeline x={480} top={40} bottom={310} label="Gemini LLM" />
        <Lifeline x={600 - 20} top={40} bottom={310} label="Mock Tools" />
        <SeqArrow x1={70} x2={210} y={70} label="POST sample input_data" />
        <SeqArrow x1={210} x2={350} y={95} label="execute_process(spec, arch, workflow, input)" />
        <SeqArrow x1={350} x2={480} y={120} label="simulate agent output (per node)" />
        <SeqArrow x1={480} x2={350} y={145} label="{lead_score: '78', ...}" dashed />
        <SeqArrow x1={350} x2={580} y={170} label="mock.call(tool.op, **output)" />
        <SeqArrow x1={350} x2={350} y={195} label="merge output into shared context" selfCall />
        <SeqArrow x1={350} x2={350} y={225} label="repeat per agent node until end/halt" selfCall />
        <SeqArrow x1={350} x2={210} y={260} label="RuntimeExecutionResult (steps, final_context)" dashed />
        <SeqArrow x1={210} x2={70} y={285} label="render step-by-step trace" dashed />
      </DiagramFrame>
    </div>
  );
}
