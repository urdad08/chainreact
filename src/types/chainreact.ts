// These mirror backend/app/schemas exactly. Keep in sync manually for Phase 1;
// a later phase could generate this file from the FastAPI OpenAPI schema.

export interface Trigger {
  type: string;
  event: string;
}

export interface Permissions {
  allowed: string[];
  forbidden: string[];
}

export interface ApprovalGate {
  action: string;
  required: boolean;
  reason?: string | null;
}

export interface FailurePolicy {
  max_retries: number;
  retry_strategy: "fixed" | "exponential_backoff" | "none";
  fallback: string;
}

export interface Constraints {
  max_cost_per_execution: number;
  max_latency_seconds: number;
  privacy: string;
}

export interface ProcessSpec {
  name: string;
  objective: string;
  users: string[];
  input_data: string[];
  output_data: string[];
  trigger: Trigger;
  rules: string[];
  permissions: Permissions;
  human_approval: ApprovalGate[];
  failure_policy: FailurePolicy;
  success_conditions: string[];
  limits: Constraints;
}

export interface ToolBinding {
  name: string;
  operations: string[];
}

export interface Memory {
  type: "none" | "short_term" | "long_term";
}

export interface AgentDef {
  id: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  tools: ToolBinding[];
  permissions: string[];
  memory: Memory;
}

export interface AgentArchitecture {
  process_name: string;
  agents: AgentDef[];
}

export interface WorkflowNode {
  id: string;
  type: "agent" | "tool" | "human_approval" | "start" | "end";
  agent?: string | null;
  tool?: string | null;
  label?: string | null;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string | null;
}

export interface WorkflowGraph {
  process_name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface AuditEntry {
  stage: string;
  timestamp: string;
  summary: string;
  detail: Record<string, unknown>;
}

export interface AuditTrail {
  process_name: string;
  entries: AuditEntry[];
  deployment_approved: boolean;
}

export interface PipelineResult {
  process_spec: ProcessSpec;
  spec_validation: ValidationResult;
  agent_architecture: AgentArchitecture;
  policy_check: ValidationResult;
  workflow: WorkflowGraph;
  repair_log: string[];
  sandbox_report: SandboxReport;
  audit_trail: AuditTrail;
  deployment_approved: boolean;
}

export type TestCategory = "structural" | "permission" | "approval" | "success_condition";

export interface TestCase {
  id: string;
  category: TestCategory;
  description: string;
}

export interface TestOutcome {
  test: TestCase;
  passed: boolean;
  detail: string;
}

export interface SandboxReport {
  process_name: string;
  total: number;
  passed: number;
  failed: number;
  outcomes: TestOutcome[];
  execution_trace: string[];
  ready_for_deployment: boolean;
}

export interface ApiErrorDetail {
  message: string;
  issues: ValidationIssue[];
  process_spec?: ProcessSpec;
  agent_architecture?: AgentArchitecture;
  retryable?: boolean;
}

export interface StepResult {
  node_id: string;
  type: "start" | "agent" | "tool" | "human_approval" | "end";
  label: string;
  output?: Record<string, string> | null;
  tool_calls: string[];
  note?: string | null;
}

export interface RuntimeExecutionResult {
  process_name: string;
  input_data: Record<string, string>;
  steps: StepResult[];
  final_context: Record<string, string>;
  halted_at_approval: boolean;
}
