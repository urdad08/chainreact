import { useMemo, useState } from "react";
import { Bot, FlaskConical, GitBranch, LayoutGrid, PlayCircle, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import type {
  AgentArchitecture,
  AuditTrail,
  ProcessSpec,
  SandboxReport,
  ValidationResult,
  WorkflowGraph,
} from "../../types/chainreact";
import AgentList from "../AgentList";
import WorkflowVisualizer from "../WorkflowVisualizer";
import ProcessSpecView from "../ProcessSpecView";
import TestResults from "../TestResults";
import AuditTrailView from "../AuditTrailView";
import ExecutionConsole from "../execution/ExecutionConsole";
import { Badge, Button, Card, CardHeader, EmptyState, Stat, TabDef, Tabs } from "../../ui/primitives";
import { humanize } from "../../lib/format";

export type WorkspaceTab = "overview" | "agents" | "workflow" | "tools" | "tests" | "execution";

export interface SystemWorkspaceProps {
  systemId: string;
  spec: ProcessSpec;
  architecture: AgentArchitecture;
  workflow: WorkflowGraph;
  specValidation?: ValidationResult;
  policyCheck?: ValidationResult;
  sandboxReport?: SandboxReport | null;
  onRerunSandbox?: () => void;
  sandboxLoading?: boolean;
  sandboxError?: string | null;
  auditTrail?: AuditTrail | null;
  repairLog?: string[];
  deploymentApproved?: boolean;
  initialTab?: WorkspaceTab;
  /** Controlled tab (optional). */
  tab?: WorkspaceTab;
  onTabChange?: (t: WorkspaceTab) => void;
}

const SENSITIVE = /(delete|payments|send|post|write|charge|refund)/;

export default function SystemWorkspace(props: SystemWorkspaceProps) {
  const { systemId, spec, architecture, workflow } = props;
  const [localTab, setLocalTab] = useState<WorkspaceTab>(props.initialTab ?? "overview");
  const tab = props.tab ?? localTab;
  const setTab = (t: WorkspaceTab) => {
    setLocalTab(t);
    props.onTabChange?.(t);
  };

  const toolRows = useMemo(
    () =>
      architecture.agents.flatMap((a) =>
        a.tools.map((t) => ({ agent: a.id, tool: t.name, operations: t.operations, permissions: a.permissions }))
      ),
    [architecture]
  );
  const toolCount = new Set(architecture.agents.flatMap((a) => a.tools.map((t) => t.name))).size;
  const approvalNodes = workflow.nodes.filter((n) => n.type === "human_approval").length;
  const conditionalEdges = workflow.edges.filter((e) => e.condition).length;

  const tabs: TabDef<WorkspaceTab>[] = [
    { id: "overview", label: "Overview", icon: <LayoutGrid size={14} /> },
    { id: "agents", label: "Agents", icon: <Bot size={14} />, count: architecture.agents.length },
    { id: "workflow", label: "Workflow", icon: <GitBranch size={14} />, count: workflow.nodes.length },
    { id: "tools", label: "Tools & Permissions", icon: <Wrench size={14} /> },
    {
      id: "tests",
      label: "Tests",
      icon: <FlaskConical size={14} />,
      count: props.sandboxReport ? props.sandboxReport.passed : undefined,
    },
    { id: "execution", label: "Execution", icon: <PlayCircle size={14} /> },
  ];

  return (
    <div className="stack gap-4" style={{ minWidth: 0 }}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="stack gap-4">
          <div className="grid grid-4">
            <Stat label="Agents" value={architecture.agents.length} icon={<Bot size={15} />} />
            <Stat label="Workflow nodes" value={workflow.nodes.length} icon={<GitBranch size={15} />} foot={conditionalEdges ? `${conditionalEdges} conditional edge(s)` : undefined} />
            <Stat label="Tools" value={toolCount} icon={<Wrench size={15} />} />
            <Stat
              label="Approval gates"
              value={approvalNodes}
              icon={<ShieldCheck size={15} />}
              foot={props.deploymentApproved === undefined ? undefined : props.deploymentApproved ? "Deployment approved" : "Deployment blocked"}
            />
          </div>
          <ProcessSpecView spec={spec} validation={props.specValidation} />
          {props.policyCheck && props.policyCheck.issues.length > 0 && (
            <Card>
              <CardHeader title="Policy check" description="Agent permissions checked against the specification." />
              <div className="card-body stack gap-2">
                {props.policyCheck.issues.map((i, idx) => (
                  <div key={idx} className="row gap-2 text-sm" style={{ alignItems: "flex-start" }}>
                    <Badge tone={i.severity === "error" ? "danger" : "warning"}>{i.severity}</Badge>
                    <span>{i.message}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {props.repairLog && props.repairLog.length > 0 && (
            <Card>
              <CardHeader title="Self-repair log" description="Issues the generator found in its own output and fixed before returning." />
              <ol className="card-body text-sm stack gap-1" style={{ margin: 0, paddingLeft: 32 }}>
                {props.repairLog.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </Card>
          )}
          {props.auditTrail && <AuditTrailView trail={props.auditTrail} />}
        </div>
      )}

      {tab === "agents" && <AgentList architecture={architecture} />}

      {tab === "workflow" && (
        <Card>
          <CardHeader title="Workflow graph" description="Executable DAG. Conditional edges are evaluated at runtime against agent outputs." />
          <div className="card-body">
            <WorkflowVisualizer graph={workflow} height={520} />
          </div>
        </Card>
      )}

      {tab === "tools" && (
        <div className="stack gap-4">
          <Card>
            <CardHeader title="Tool bindings" description="Tools each agent may call. The runtime re-checks permissions at call time." />
            {toolRows.length === 0 ? (
              <div className="card-body">
                <EmptyState icon={<Wrench size={18} />} title="No tools bound" description="Agents in this system only transform data in context." />
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Tool</th>
                      <th>Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toolRows.map((r, i) => (
                      <tr key={i}>
                        <td>{humanize(r.agent)}</td>
                        <td className="mono">{r.tool}</td>
                        <td>
                          <div className="row wrap gap-1">
                            {r.operations.map((op) => {
                              const perm = `${r.tool}.${op}`;
                              const held = r.permissions.includes(perm);
                              return (
                                <Badge key={op} tone={held ? (SENSITIVE.test(perm) ? "warning" : "success") : "danger"}>
                                  {op}
                                  {held ? "" : " · no permission"}
                                </Badge>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div className="grid grid-2">
            <Card>
              <CardHeader title="Allowed permissions" />
              <div className="card-body row wrap gap-1">
                {spec.permissions.allowed.length ? spec.permissions.allowed.map((p) => <Badge key={p} tone="success">{p}</Badge>) : <span className="text-tertiary text-sm">—</span>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Forbidden permissions" />
              <div className="card-body row wrap gap-1">
                {spec.permissions.forbidden.length ? spec.permissions.forbidden.map((p) => <Badge key={p} tone="danger">{p}</Badge>) : <span className="text-tertiary text-sm">—</span>}
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader title="Human approval gates" description="The run pauses before these actions until someone approves." />
            <div className="card-body stack gap-2">
              {spec.human_approval.length === 0 ? (
                <span className="text-tertiary text-sm">No approval gates.</span>
              ) : (
                spec.human_approval.map((g, i) => (
                  <div key={i} className="row gap-2 text-sm">
                    <Badge tone="warning">{g.action}</Badge>
                    <span className="text-secondary">{g.reason ?? ""}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "tests" && (
        <div className="stack gap-3">
          {props.onRerunSandbox && (
            <div className="row gap-2">
              <Button icon={<RefreshCw size={14} />} loading={props.sandboxLoading} onClick={props.onRerunSandbox}>
                {props.sandboxReport ? "Re-run checks" : "Run checks"}
              </Button>
              {props.sandboxError && <span className="text-sm" style={{ color: "var(--danger)" }}>{props.sandboxError}</span>}
            </div>
          )}
          {props.sandboxReport ? (
            <TestResults report={props.sandboxReport} />
          ) : (
            <EmptyState icon={<FlaskConical size={18} />} title="No test report yet" description="Run the sandbox checks to validate structure, permissions, approvals and success conditions." />
          )}
        </div>
      )}

      {/* Kept mounted so a live run survives switching tabs. */}
      <div hidden={tab !== "execution"}>
        <ExecutionConsole
          systemId={systemId}
          processName={spec.name}
          workflow={workflow}
          architecture={architecture}
          inputFields={spec.input_data}
        />
      </div>
    </div>
  );
}
