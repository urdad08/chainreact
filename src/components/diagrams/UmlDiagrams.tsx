/**
 * Static UML-style diagrams for the presentation Overview page.
 * Hand-drawn as SVG (not exported from a UML tool) but structurally
 * accurate to ChainReact's actual pipeline -- every box/arrow corresponds
 * to a real module, schema, or endpoint in the codebase.
 */
import type { CSSProperties } from "react";

const wrap: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e2ea",
  borderRadius: 10,
  padding: 16,
  overflowX: "auto",
};

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 10,
  color: "#222",
};

function Frame({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div style={wrap}>
      <div style={titleStyle}>{heading}</div>
      {children}
    </div>
  );
}

/* ---------- shared SVG primitives ---------- */

function Actor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={8} fill="none" stroke="#333" strokeWidth={1.5} />
      <line x1={x} y1={y + 8} x2={x} y2={y + 28} stroke="#333" strokeWidth={1.5} />
      <line x1={x - 12} y1={y + 15} x2={x + 12} y2={y + 15} stroke="#333" strokeWidth={1.5} />
      <line x1={x} y1={y + 28} x2={x - 10} y2={y + 44} stroke="#333" strokeWidth={1.5} />
      <line x1={x} y1={y + 28} x2={x + 10} y2={y + 44} stroke="#333" strokeWidth={1.5} />
      <text x={x} y={y + 58} textAnchor="middle" fontSize={11} fill="#333">
        {label}
      </text>
    </g>
  );
}

function UseCase({ cx, cy, label, w = 150 }: { cx: number; cy: number; label: string; w?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={w / 2} ry={26} fill="#f3f0ff" stroke="#5b3df0" strokeWidth={1.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="#222">
        {label}
      </text>
    </g>
  );
}

function Link({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1.2} />;
}

/* ================= USE CASE DIAGRAMS (4 required) ================= */

export function UseCase1() {
  return (
    <Frame heading="Use Case Diagram 1 — Define & Validate a Process Requirement">
      <svg viewBox="0 0 640 260" width="100%" height="260">
        <Actor x={45} y={100} label="Process Owner" />
        <Link x1={57} y1={100} x2={155} y2={60} />
        <UseCase cx={230} cy={60} label="Enter NL requirement" />
        <Link x1={57} y1={100} x2={155} y2={130} />
        <UseCase cx={230} cy={130} label="Set permissions (allow/forbid)" w={190} />
        <Link x1={57} y1={100} x2={155} y2={200} />
        <UseCase cx={230} cy={200} label="Set approval gates" />

        <Link x1={305} y1={60} x2={415} y2={95} />
        <Link x1={325} y1={130} x2={415} y2={110} />
        <Link x1={305} y1={200} x2={415} y2={125} />
        <UseCase cx={510} cy={110} label="Parse to ProcessSpec (LLM)" w={180} />

        <Link x1={510} y1={136} x2={510} y2={170} />
        <UseCase cx={510} cy={200} label="Validate spec (deterministic)" w={200} />
        <Actor x={610} y={165} label="Validation Engine" />
        <Link x1={598} y1={200} x2={610} y2={200} />
      </svg>
    </Frame>
  );
}

export function UseCase2() {
  return (
    <Frame heading="Use Case Diagram 2 — Synthesize & Self-Repair the Agent System">
      <svg viewBox="0 0 640 240" width="100%" height="240">
        <Actor x={45} y={110} label="Process Owner" />
        <Link x1={57} y1={110} x2={140} y2={70} />
        <UseCase cx={230} cy={70} label="Generate Agent System" w={180} />

        <Link x1={230} y1={96} x2={230} y2={130} />
        <UseCase cx={230} cy={150} label="Synthesize AgentArchitecture (LLM)" w={230} />

        <Link x1={345} y1={150} x2={430} y2={150} />
        <UseCase cx={520} cy={150} label="Check permissions & tool coverage" w={200} />
        <Actor x={610} y={115} label="Policy Engine" />
        <Link x1={598} y1={150} x2={610} y2={150} />

        <Link x1={520} y1={176} x2={520} y2={205} />
        <UseCase cx={520} cy={220} label="Retry w/ feedback (self-repair, max 3x)" w={230} />
      </svg>
    </Frame>
  );
}

export function UseCase3() {
  return (
    <Frame heading="Use Case Diagram 3 — Compile Workflow & Run in Sandbox">
      <svg viewBox="0 0 640 240" width="100%" height="240">
        <Actor x={45} y={110} label="Process Owner" />
        <Link x1={57} y1={110} x2={140} y2={70} />
        <UseCase cx={225} cy={70} label="Synthesize WorkflowGraph (LLM)" w={200} />
        <Link x1={57} y1={110} x2={140} y2={160} />
        <UseCase cx={225} cy={160} label="View workflow diagram" w={170} />

        <Link x1={325} y1={70} x2={420} y2={90} />
        <UseCase cx={510} cy={100} label="Generate tests from spec" w={170} />
        <Link x1={510} y1={126} x2={510} y2={160} />
        <UseCase cx={510} cy={190} label="Run sandbox (mock tools, no live APIs)" w={220} />
        <Actor x={610} y={155} label="Sandbox Executor" />
        <Link x1={598} y1={190} x2={610} y2={185} />
      </svg>
    </Frame>
  );
}

export function UseCase4() {
  return (
    <Frame heading="Use Case Diagram 4 — Execute a Sample Run, Audit & Approve Deployment">
      <svg viewBox="0 0 640 240" width="100%" height="240">
        <Actor x={45} y={110} label="Process Owner" />
        <Link x1={57} y1={110} x2={140} y2={60} />
        <UseCase cx={230} cy={60} label="Provide sample input record" w={190} />
        <Link x1={57} y1={110} x2={140} y2={160} />
        <UseCase cx={230} cy={160} label="Inspect audit trail" w={170} />
        <Link x1={57} y1={110} x2={140} y2={210} />
        <UseCase cx={230} cy={210} label="Ask assistant chat about the run" w={210} />

        <Link x1={325} y1={60} x2={420} y2={90} />
        <UseCase cx={510} cy={100} label="Execute process (LLM plays each agent)" w={220} />
        <Actor x={610} y={65} label="Runtime Executor" />
        <Link x1={598} y1={100} x2={610} y2={90} />

        <Link x1={510} y1={126} x2={510} y2={160} />
        <UseCase cx={510} cy={190} label="Approve / block deployment" w={200} />
        <Link x1={230} y1={186} x2={420} y2={195} />
      </svg>
    </Frame>
  );
}

/* ================= SEQUENCE DIAGRAMS (5 required) ================= */

function Lifeline({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x - 60} y={10} width={120} height={26} fill="#22223b" rx={4} />
      <text x={x} y={28} textAnchor="middle" fontSize={11} fill="#fff">
        {label}
      </text>
      <line x1={x} y1={36} x2={x} y2={280} stroke="#ccc" strokeDasharray="4 3" />
    </g>
  );
}

function Msg({ x1, x2, y, label, dashed = false }: { x1: number; x2: number; y: number; label: string; dashed?: boolean }) {
  const dir = x2 > x1 ? 1 : -1;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#5b3df0" strokeWidth={1.4} strokeDasharray={dashed ? "5 3" : undefined} />
      <polygon
        points={`${x2},${y} ${x2 - dir * 7},${y - 4} ${x2 - dir * 7},${y + 4}`}
        fill="#5b3df0"
      />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#333">
        {label}
      </text>
    </g>
  );
}

export function SequenceParse() {
  return (
    <Frame heading="Sequence Diagram 1 — Requirement Parsing & Validation">
      <svg viewBox="0 0 620 300" width="100%" height="300">
        <Lifeline x={70} label="Dashboard" />
        <Lifeline x={230} label="API /synthesize" />
        <Lifeline x={390} label="Requirement Analyst (LLM)" />
        <Lifeline x={540} label="Validation Engine" />

        <Msg x1={70} x2={230} y={60} label="POST requirement + permissions" />
        <Msg x1={230} x2={390} y={95} label="parse_requirement(text)" />
        <Msg x1={390} x2={230} y={130} label="ProcessSpec (structured JSON)" dashed />
        <Msg x1={230} x2={230} y={155} label="apply_to(): overwrite perms/gates" />
        <Msg x1={230} x2={540} y={190} label="validate_process_spec(spec)" />
        <Msg x1={540} x2={230} y={225} label="ValidationResult" dashed />
        <Msg x1={230} x2={70} y={260} label="422 if invalid, else continue" dashed />
      </svg>
    </Frame>
  );
}

export function SequenceAgentRepair() {
  return (
    <Frame heading="Sequence Diagram 2 — Agent Synthesis with Self-Repair Loop">
      <svg viewBox="0 0 620 320" width="100%" height="320">
        <Lifeline x={70} label="API /synthesize" />
        <Lifeline x={230} label="Agent Architect (LLM)" />
        <Lifeline x={390} label="Policy Engine" />
        <Lifeline x={540} label="repair.py" />

        <Msg x1={70} x2={230} y={60} label="synthesize_agents(spec)" />
        <Msg x1={230} x2={70} y={90} label="AgentArchitecture" dashed />
        <Msg x1={70} x2={390} y={120} label="check_agent_permissions + coverage" />
        <Msg x1={390} x2={70} y={150} label="issues found" dashed />
        <Msg x1={70} x2={540} y={180} label="format_feedback(issues)" />
        <Msg x1={540} x2={70} y={210} label="feedback string" dashed />
        <Msg x1={70} x2={230} y={240} label="synthesize_agents(spec, feedback)  [retry]" />
        <Msg x1={230} x2={70} y={270} label="corrected AgentArchitecture" dashed />
      </svg>
    </Frame>
  );
}

export function SequenceWorkflow() {
  return (
    <Frame heading="Sequence Diagram 3 — Workflow Synthesis with Self-Repair Loop">
      <svg viewBox="0 0 620 300" width="100%" height="300">
        <Lifeline x={70} label="API /synthesize" />
        <Lifeline x={250} label="Workflow Synthesizer (LLM)" />
        <Lifeline x={440} label="workflow_issues()" />
        <Lifeline x={560} label="Dashboard" />

        <Msg x1={70} x2={250} y={60} label="synthesize_workflow(spec, arch)" />
        <Msg x1={250} x2={70} y={90} label="WorkflowGraph" dashed />
        <Msg x1={70} x2={440} y={120} label="check start/end connectivity, approval gates" />
        <Msg x1={440} x2={70} y={150} label="issue list (e.g. missing approval node)" dashed />
        <Msg x1={70} x2={250} y={180} label="synthesize_workflow(spec, arch, feedback)  [retry]" />
        <Msg x1={250} x2={70} y={210} label="corrected WorkflowGraph" dashed />
        <Msg x1={70} x2={560} y={240} label="render React Flow diagram" />
      </svg>
    </Frame>
  );
}

export function SequenceSandbox() {
  return (
    <Frame heading="Sequence Diagram 4 — Sandbox Execution & Deployment Gate">
      <svg viewBox="0 0 620 320" width="100%" height="320">
        <Lifeline x={70} label="API /synthesize" />
        <Lifeline x={240} label="test_generator.py" />
        <Lifeline x={400} label="sandbox executor" />
        <Lifeline x={550} label="audit.py" />

        <Msg x1={70} x2={240} y={60} label="generate_tests(spec, arch, workflow)" />
        <Msg x1={240} x2={70} y={90} label="TestCase[] (structural/permission/approval/success)" dashed />
        <Msg x1={70} x2={400} y={120} label="run_tests() -> walk graph, call MockTool" />
        <Msg x1={400} x2={70} y={155} label="SandboxReport (pass/fail, trace, ready_for_deployment)" dashed />
        <Msg x1={70} x2={70} y={185} label="deployment_approved = policy AND sandbox ready" />
        <Msg x1={70} x2={550} y={215} label="record(stage, summary, detail)" />
        <Msg x1={550} x2={70} y={245} label="AuditTrail" dashed />
      </svg>
    </Frame>
  );
}

export function SequenceRuntime() {
  return (
    <Frame heading="Sequence Diagram 5 — Runtime Execution Against a Sample Input">
      <svg viewBox="0 0 620 320" width="100%" height="320">
        <Lifeline x={70} label="Dashboard (RuntimeRunner)" />
        <Lifeline x={260} label="API /runtime/execute" />
        <Lifeline x={430} label="Runtime Executor" />
        <Lifeline x={560} label="LLM (per agent)" />

        <Msg x1={70} x2={260} y={60} label="POST spec, arch, workflow, sample input" />
        <Msg x1={260} x2={430} y={90} label="execute_process(...)" />
        <Msg x1={430} x2={560} y={120} label="_simulate_agent_output(agent, context)  [per node]" />
        <Msg x1={560} x2={430} y={150} label="typed output fields" dashed />
        <Msg x1={430} x2={430} y={175} label="merge into context, record MockTool calls" />
        <Msg x1={430} x2={430} y={200} label="if human_approval & !auto_approve: halt" />
        <Msg x1={430} x2={260} y={230} label="RuntimeExecutionResult (steps, final_context)" dashed />
        <Msg x1={260} x2={70} y={260} label="render step-by-step trace" dashed />
      </svg>
    </Frame>
  );
}

/* ================= CLASS DIAGRAM (1 required) ================= */

function ClassBox({
  x, y, w, h, name, fields,
}: { x: number; y: number; w: number; h: number; name: string; fields: string[] }) {
  const rowH = 15;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#5b3df0" strokeWidth={1.3} rx={4} />
      <rect x={x} y={y} width={w} height={22} fill="#f3f0ff" stroke="#5b3df0" strokeWidth={1.3} rx={4} />
      <text x={x + w / 2} y={y + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#222">
        {name}
      </text>
      <line x1={x} y1={y + 22} x2={x + w} y2={y + 22} stroke="#5b3df0" strokeWidth={1} />
      {fields.map((f, i) => (
        <text key={i} x={x + 8} y={y + 22 + 16 + i * rowH} fontSize={9.5} fill="#333">
          {f}
        </text>
      ))}
    </g>
  );
}

function Rel({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1.2} />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize={9} fill="#666">
          {label}
        </text>
      )}
    </g>
  );
}

export function ClassDiagram() {
  return (
    <Frame heading="Detailed Class Diagram — Core Schemas & Their Relationships">
      <svg viewBox="0 0 940 640" width="100%" height="640">
        <ClassBox
          x={30} y={20} w={230} h={200} name="ProcessSpec"
          fields={[
            "name: str", "objective: str", "users: List[str]",
            "input_data / output_data: List[str]", "trigger: Trigger",
            "rules: List[str]", "permissions: Permissions",
            "human_approval: List[ApprovalGate]",
            "failure_policy: FailurePolicy",
            "success_conditions: List[str]", "limits: Constraints",
          ]}
        />
        <ClassBox
          x={300} y={20} w={190} h={80} name="Permissions"
          fields={["allowed: List[str]", "forbidden: List[str]"]}
        />
        <ClassBox
          x={300} y={115} w={190} h={65} name="ApprovalGate"
          fields={["action: str", "required: bool"]}
        />
        <ClassBox
          x={300} y={195} w={190} h={65} name="FailurePolicy"
          fields={["max_retries: int", "retry_strategy, fallback: str"]}
        />

        <ClassBox
          x={30} y={260} w={230} h={150} name="AgentArchitecture"
          fields={["process_name: str", "agents: List[AgentDef]"]}
        />
        <ClassBox
          x={300} y={260} w={230} h={190} name="AgentDef"
          fields={[
            "id: str", "purpose: str", "inputs/outputs: List[str]",
            "tools: List[ToolBinding]", "permissions: List[str]",
            "memory: Memory",
          ]}
        />
        <ClassBox
          x={570} y={260} w={190} h={70} name="ToolBinding"
          fields={["name: str", "operations: List[str]"]}
        />

        <ClassBox
          x={30} y={440} w={230} h={130} name="WorkflowGraph"
          fields={["process_name: str", "nodes: List[WorkflowNode]", "edges: List[WorkflowEdge]"]}
        />
        <ClassBox
          x={300} y={480} w={190} h={90} name="WorkflowNode"
          fields={["id, type: str", "agent?, tool?, label?: str"]}
        />
        <ClassBox
          x={530} y={480} w={190} h={70} name="WorkflowEdge"
          fields={["source, target: str", "condition?: str"]}
        />

        <ClassBox
          x={570} y={20} w={190} h={110} name="SandboxReport"
          fields={[
            "process_name: str", "total/passed/failed: int",
            "outcomes: List[TestOutcome]", "ready_for_deployment: bool",
          ]}
        />
        <ClassBox
          x={780} y={20} w={150} h={90} name="TestCase"
          fields={["id: str", "category: TestCategory", "description: str"]}
        />
        <ClassBox
          x={780} y={130} w={150} h={90} name="RuntimeExecutionResult"
          fields={["steps: List[StepResult]", "final_context: dict", "halted_at_approval: bool"]}
        />
        <ClassBox
          x={780} y={440} w={150} h={90} name="AuditTrail"
          fields={["process_name: str", "entries: List[AuditEntry]", "deployment_approved: bool"]}
        />

        {/* relationships */}
        <Rel x1={260} y1={70} x2={300} y2={60} label="has" />
        <Rel x1={260} y1={140} x2={300} y2={148} label="has *" />
        <Rel x1={260} y1={210} x2={300} y2={225} label="has" />
        <Rel x1={145} y1={220} x2={145} y2={260} label="uses" />
        <Rel x1={260} y1={330} x2={300} y2={330} label="1..*" />
        <Rel x1={490} y1={330} x2={570} y2={310} label="each agent has *" />
        <Rel x1={145} y1={410} x2={145} y2={440} label="drives synthesis of" />
        <Rel x1={260} y1={490} x2={300} y2={510} label="1..*" />
        <Rel x1={490} y1={520} x2={530} y2={510} label="1..*" />
        <Rel x1={490} y1={80} x2={570} y2={70} label="checked against" />
        <Rel x1={720} y1={70} x2={780} y2={65} label="1..*" />
        <Rel x1={665} y1={130} x2={780} y2={170} label="records" />
        <Rel x1={665} y1={480} x2={780} y2={470} label="every stage recorded to" />
      </svg>
    </Frame>
  );
}
