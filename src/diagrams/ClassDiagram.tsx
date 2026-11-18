import { DiagramFrame, Label, UMLClass, Wire, umlClassHeight, umlClassWidth } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

type Def = { title: string; fields?: string[]; methods?: string[] };

const C = {
  ProcessSpec: { title: "ProcessSpec", fields: ["name: str", "objective: str", "users: List[str]", "input_data: List[str]", "output_data: List[str]", "rules: List[str]", "success_conditions: List[str]"] },
  TestCase: { title: "TestCase", fields: ["id: str", "category: TestCategory", "description: str"] },
  SandboxReport: { title: "SandboxReport", fields: ["process_name: str", "total, passed, failed: int", "execution_trace: List[str]", "ready_for_deployment: bool"], methods: ["outcomes: List[TestOutcome]"] },

  Trigger: { title: "Trigger", fields: ["type: str", "event: str"] },
  Permissions: { title: "Permissions", fields: ["allowed: List[str]", "forbidden: List[str]"] },
  ApprovalGate: { title: "ApprovalGate", fields: ["action: str", "required: bool", "reason: str?"] },
  FailurePolicy: { title: "FailurePolicy", fields: ["max_retries: int", "retry_strategy: enum", "fallback: str"] },
  Constraints: { title: "Constraints", fields: ["max_cost_per_execution: float", "max_latency_seconds: int", "privacy: str"] },

  AgentArchitecture: { title: "AgentArchitecture", fields: ["process_name: str"], methods: ["agents: List[AgentDef]"] },
  AgentDef: { title: "AgentDef", fields: ["id: str", "purpose: str", "inputs: List[str]", "outputs: List[str]", "permissions: List[str]"] },
  AuditTrail: { title: "AuditTrail", fields: ["process_name: str", "deployment_approved: bool"], methods: ["entries: List[AuditEntry]"] },
  WorkflowNode: { title: "WorkflowNode", fields: ["id: str", "type: NodeType", "agent: str?", "tool: str?", "label: str?"] },

  ToolBinding: { title: "ToolBinding", fields: ["name: str", "operations: List[str]"] },
  Memory: { title: "Memory", fields: ["type: none|short_term|long_term"] },
  AuditEntry: { title: "AuditEntry", fields: ["stage: str", "timestamp: str", "summary: str", "detail: dict"] },
  WorkflowEdge: { title: "WorkflowEdge", fields: ["source: str", "target: str", "condition: str?"] },

  WorkflowGraph: { title: "WorkflowGraph", fields: ["process_name: str"], methods: ["nodes: List[WorkflowNode]", "edges: List[WorkflowEdge]"] },
} satisfies Record<string, Def>;

type Name = keyof typeof C;

// Four columns; each column is as wide as its widest class.
const COLS: Name[][] = [
  ["ProcessSpec", "TestCase", "SandboxReport"],
  ["Trigger", "Permissions", "ApprovalGate", "FailurePolicy", "Constraints", "WorkflowGraph"],
  ["AgentArchitecture", "AgentDef", "AuditTrail", "WorkflowNode"],
  ["ToolBinding", "Memory", "AuditEntry", "WorkflowEdge"],
];
const COL_GAP = 70;
const LEFT = 30;

const colW = COLS.map((col) => Math.max(...col.map((n) => umlClassWidth(C[n].title, C[n].fields, (C[n] as Def).methods))));
const colX: number[] = [];
colW.reduce((x, w, i) => ((colX[i] = x), x + w + COL_GAP), LEFT);

// Vertical position of each class (hand-picked rows so connectors line up).
const Y: Record<Name, number> = {
  ProcessSpec: 50, TestCase: 260, SandboxReport: 390,
  Trigger: 50, Permissions: 140, ApprovalGate: 230, FailurePolicy: 330, Constraints: 425,
  AgentArchitecture: 50, AgentDef: 170, AuditTrail: 345, WorkflowNode: 590,
  ToolBinding: 170, Memory: 270, AuditEntry: 345, WorkflowEdge: 590,
  WorkflowGraph: 590,
};

function box(n: Name) {
  const ci = COLS.findIndex((c) => c.includes(n));
  const x = colX[ci];
  const w = colW[ci];
  const y = Y[n];
  const h = umlClassHeight(C[n].fields, (C[n] as Def).methods);
  return { x, y, w, h, r: x + w, b: y + h, cx: x + w / 2, cy: y + h / 2 };
}

export function ClassDiagram() {
  const B = Object.fromEntries((Object.keys(C) as Name[]).map((n) => [n, box(n)])) as Record<Name, ReturnType<typeof box>>;
  const width = Math.ceil(colX[3] + colW[3] + LEFT);
  const height = Math.ceil(Math.max(B.WorkflowNode.b, B.WorkflowEdge.b, B.WorkflowGraph.b) + 50);

  // ProcessSpec composition bus between column 1 and column 2.
  const ps = B.ProcessSpec;
  const busX = ps.r + COL_GAP / 2;
  const parts: [Name, string][] = [["Trigger", "1"], ["Permissions", "1"], ["ApprovalGate", "0..*"], ["FailurePolicy", "1"], ["Constraints", "1"]];
  const busTop = B.Trigger.cy;
  const busBottom = B.Constraints.cy;

  const aa = B.AgentArchitecture, ad = B.AgentDef, tb = B.ToolBinding, mem = B.Memory;
  const wg = B.WorkflowGraph, wn = B.WorkflowNode, we = B.WorkflowEdge;
  const at = B.AuditTrail, ae = B.AuditEntry, tc = B.TestCase, sr = B.SandboxReport;
  const gap23 = colX[2] - COL_GAP / 2;            // corridor between col 2 and col 3
  const gap34 = colX[3] - COL_GAP / 2;            // corridor between col 3 and col 4
  const below = Math.max(wg.b, wn.b, we.b) + 22;  // corridor under the bottom row
  const topLane = 24;                             // corridor above the top row

  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>Class Diagram: Core Domain Model</h4>
      <DiagramFrame width={width} height={height}>
        {/* ---- connectors first, so classes sit on top ---- */}

        {/* ProcessSpec ◆— its parts */}
        <Wire points={[[ps.r, ps.y + 40], [busX, ps.y + 40]]} diamond />
        <Wire points={[[busX, Math.min(busTop, ps.y + 40)], [busX, busBottom]]} />
        {parts.map(([n, mult]) => (
          <g key={n}>
            <Wire points={[[busX, B[n].cy], [B[n].x, B[n].cy]]} />
            <Label x={B[n].x - 4} y={B[n].cy - 5} anchor="end" size={9} color="#555">{mult}</Label>
          </g>
        ))}

        {/* ProcessSpec → AgentArchitecture: drives synthesis of (over the top) */}
        <Wire points={[[ps.cx, ps.y], [ps.cx, topLane], [aa.cx, topLane], [aa.cx, aa.y]]} arrow />
        <Label x={(ps.cx + aa.cx) / 2} y={topLane - 5} size={10} color="#444">drives synthesis of</Label>

        {/* AgentArchitecture ◆— AgentDef */}
        <Wire points={[[aa.cx, aa.b], [aa.cx, ad.y]]} diamond />
        <Label x={aa.cx + 6} y={ad.y - 6} anchor="start" size={9} color="#555">1..*</Label>

        {/* AgentDef ◆— ToolBinding, Memory */}
        <Wire points={[[ad.r, tb.cy], [tb.x, tb.cy]]} diamond />
        <Label x={tb.x - 4} y={tb.cy - 5} anchor="end" size={9} color="#555">0..*</Label>
        <Wire points={[[ad.r, ad.b - 20], [gap34, ad.b - 20], [gap34, mem.cy], [mem.x, mem.cy]]} diamond />
        <Label x={mem.x - 4} y={mem.cy - 5} anchor="end" size={9} color="#555">1</Label>

        {/* AgentArchitecture → WorkflowGraph: compiled into (down the col2/col3 corridor) */}
        <Wire points={[[aa.x, aa.cy], [gap23, aa.cy], [gap23, wg.y - 22], [wg.cx, wg.y - 22], [wg.cx, wg.y]]} arrow />
        <Label x={gap23 - 6} y={(aa.cy + wg.y) / 2} size={10} color="#444" rotate={-90}>compiled into</Label>

        {/* WorkflowGraph ◆— WorkflowNode, WorkflowEdge */}
        <Wire points={[[wg.r, wg.y + 40], [wn.x, wg.y + 40]]} diamond />
        <Label x={wn.x - 4} y={wg.y + 35} anchor="end" size={9} color="#555">1..*</Label>
        <Wire points={[[wg.cx, wg.b], [wg.cx, below], [we.cx, below], [we.cx, we.b]]} diamond />
        <Label x={we.cx + 6} y={we.b + 14} anchor="start" size={9} color="#555">1..*</Label>

        {/* WorkflowEdge → WorkflowNode: source / target */}
        <Wire points={[[we.x, we.y + 50], [wn.r, we.y + 50]]} arrow />
        <Label x={(we.x + wn.r) / 2} y={we.y + 45} size={9} color="#555">source, target</Label>

        {/* TestCase → SandboxReport */}
        <Wire points={[[tc.cx, tc.b], [tc.cx, sr.y]]} arrow />
        <Label x={tc.cx + 6} y={(tc.b + sr.y) / 2 + 4} anchor="start" size={9} color="#555">1..* outcomes</Label>

        {/* TestCase → WorkflowGraph: checked against (down the left margin, under col 1) */}
        <Wire points={[[tc.x, tc.cy], [12, tc.cy], [12, wg.cy], [wg.x, wg.cy]]} arrow dashed />
        <Label x={(12 + wg.x) / 2} y={wg.cy - 6} size={10} color="#444">checked against</Label>

        {/* AuditTrail ◆— AuditEntry */}
        <Wire points={[[at.r, ae.y + 40], [ae.x, ae.y + 40]]} diamond />
        <Label x={ae.x - 4} y={ae.y + 35} anchor="end" size={9} color="#555">1..*</Label>

        {/* SandboxReport ⇢ AuditTrail: recorded in (under col 2's stack) */}
        <Wire
          points={[[sr.cx, sr.b], [sr.cx, sr.b + 22], [gap23 + 14, sr.b + 22], [gap23 + 14, at.cy + 20], [at.x, at.cy + 20]]}
          arrow dashed
        />
        <Label x={(sr.cx + gap23) / 2} y={sr.b + 17} size={10} color="#444">recorded in</Label>

        {/* ---- classes ---- */}
        {(Object.keys(C) as Name[]).map((n) => (
          <UMLClass key={n} x={B[n].x} y={B[n].y} w={B[n].w} title={C[n].title} fields={C[n].fields} methods={(C[n] as Def).methods} />
        ))}
      </DiagramFrame>
      <p style={{ fontSize: 12, color: "#666" }}>
        A ProcessSpec (validated requirement) drives synthesis of an AgentArchitecture, which is
        compiled into a WorkflowGraph; TestCases are generated from the spec and checked against the
        workflow, producing a SandboxReport; every stage's outcome is recorded as an AuditEntry
        inside the process's AuditTrail. Filled diamonds mark composition (the owner holds its
        parts). <code>TestCategory</code> = structural | permission | approval | success_condition;{" "}
        <code>NodeType</code> = agent | tool | human_approval | start | end.
      </p>
    </div>
  );
}
