import { ClassLink, DiagramFrame, UMLClass } from "./primitives";

const card: React.CSSProperties = { border: "1px solid #e2e2ea", borderRadius: 10, padding: 16, background: "#fff" };

export function ClassDiagram() {
  return (
    <div style={card}>
      <h4 style={{ marginTop: 0 }}>Class Diagram: Core Domain Model</h4>
      <DiagramFrame width={960} height={760}>
        {/* ProcessSpec cluster */}
        <UMLClass
          x={20} y={20} w={220}
          title="ProcessSpec"
          fields={["name: str", "objective: str", "users: List[str]", "input_data: List[str]", "output_data: List[str]", "rules: List[str]", "success_conditions: List[str]"]}
        />
        <UMLClass x={280} y={20} w={170} title="Trigger" fields={["type: str", "event: str"]} />
        <UMLClass x={280} y={140} w={170} title="Permissions" fields={["allowed: List[str]", "forbidden: List[str]"]} />
        <UMLClass x={280} y={250} w={170} title="ApprovalGate" fields={["action: str", "required: bool", "reason: str?"]} />
        <UMLClass x={280} y={370} w={170} title="FailurePolicy" fields={["max_retries: int", "retry_strategy: enum", "fallback: str"]} />
        <UMLClass x={280} y={480} w={170} title="Constraints" fields={["max_cost_per_execution: float", "max_latency_seconds: int", "privacy: str"]} />

        <ClassLink x1={240} y1={60} x2={280} y2={45} label="1" diamond />
        <ClassLink x1={240} y1={90} x2={280} y2={165} label="1" diamond />
        <ClassLink x1={240} y1={110} x2={280} y2={275} label="0..*" diamond />
        <ClassLink x1={240} y1={130} x2={280} y2={395} label="1" diamond />
        <ClassLink x1={240} y1={150} x2={280} y2={505} label="1" diamond />

        {/* AgentArchitecture cluster */}
        <UMLClass
          x={520} y={20} w={220}
          title="AgentArchitecture"
          fields={["process_name: str"]}
          methods={["agents: List[AgentDef]"]}
        />
        <UMLClass
          x={520} y={140} w={220}
          title="AgentDef"
          fields={["id: str", "purpose: str", "inputs: List[str]", "outputs: List[str]", "permissions: List[str]"]}
        />
        <UMLClass x={780} y={140} w={170} title="ToolBinding" fields={["name: str", "operations: List[str]"]} />
        <UMLClass x={780} y={260} w={170} title="Memory" fields={["type: none|short_term|long_term"]} />

        <ClassLink x1={630} y1={95} x2={630} y2={140} label="1..*" diamond />
        <ClassLink x1={740} y1={175} x2={780} y2={175} label="0..*" diamond />
        <ClassLink x1={740} y1={210} x2={780} y2={280} label="1" diamond />

        {/* WorkflowGraph cluster */}
        <UMLClass
          x={20} y={600} w={220}
          title="WorkflowGraph"
          fields={["process_name: str"]}
          methods={["nodes: List[WorkflowNode]", "edges: List[WorkflowEdge]"]}
        />
        <UMLClass x={280} y={600} w={190} title="WorkflowNode" fields={["id: str", "type: agent|tool|human_approval|start|end", "agent: str?", "tool: str?", "label: str?"]} />
        <UMLClass x={510} y={600} w={190} title="WorkflowEdge" fields={["source: str", "target: str", "condition: str?"]} />

        <ClassLink x1={240} y1={640} x2={280} y2={640} label="1..*" diamond />
        <ClassLink x1={240} y1={660} x2={510} y2={660} label="1..*" diamond />

        {/* Testing / Sandbox cluster */}
        <UMLClass x={20} y={380} w={220} title="TestCase" fields={["id: str", "category: structural|permission|approval|success_condition", "description: str"]} />
        <UMLClass
          x={20} y={480} w={220}
          title="SandboxReport"
          fields={["process_name: str", "total, passed, failed: int", "execution_trace: List[str]", "ready_for_deployment: bool"]}
          methods={["outcomes: List[TestOutcome]"]}
        />
        <ClassLink x1={130} y1={430} x2={130} y2={480} label="1..*" diamond />

        {/* Audit cluster */}
        <UMLClass x={780} y={400} w={170} title="AuditEntry" fields={["stage: str", "timestamp: str", "summary: str", "detail: dict"]} />
        <UMLClass
          x={780} y={540} w={170}
          title="AuditTrail"
          fields={["process_name: str", "deployment_approved: bool"]}
          methods={["entries: List[AuditEntry]"]}
        />
        <ClassLink x1={865} y1={450} x2={865} y2={540} label="1..*" diamond />

        {/* Cross-cluster links */}
        <ClassLink x1={240} y1={40} x2={520} y2={40} label="drives synthesis of" />
        <ClassLink x1={520} y1={100} x2={230} y2={620} label="compiled into" />
        <ClassLink x1={130} y1={420} x2={130} y2={600} label="checked against" />
        <ClassLink x1={950} y1={470} x2={780} y2={470} label="records stage" />
      </DiagramFrame>
      <p style={{ fontSize: 12, color: "#666" }}>
        A ProcessSpec (validated requirement) drives synthesis of an AgentArchitecture, which is
        compiled into a WorkflowGraph; TestCases are generated from the spec and checked against the
        workflow, producing a SandboxReport; every stage's outcome is recorded as an AuditEntry
        inside the process's AuditTrail.
      </p>
    </div>
  );
}
