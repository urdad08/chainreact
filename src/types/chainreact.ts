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
  config: Record<string, string>;
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
  system_id: string;
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

export type StepStatus = "ok" | "failed" | "blocked" | "simulated" | "waiting_approval" | "retrying";
export type RunStatus = "running" | "completed" | "failed" | "waiting_approval";

export interface ToolCallRecord {
  capability: string;
  real: boolean;
  status: "ok" | "simulated" | "blocked" | "failed";
  detail?: string | null;
}

export interface StepResult {
  node_id: string;
  type: "start" | "agent" | "tool" | "human_approval" | "end";
  label: string;
  status: StepStatus;
  output?: Record<string, string> | null;
  tool_calls: string[];
  tool_call_details: ToolCallRecord[];
  attempt: number;
  note?: string | null;
}

export interface RuntimeExecutionResult {
  process_name: string;
  input_data: Record<string, string>;
  steps: StepResult[];
  final_context: Record<string, string>;
  status: RunStatus;
  halted_at_approval: boolean;
  n8n_notification?: N8nExecutionResult | null;
}

export type BuildType = "website" | "workflow";

export type RelevantIntegration = "gmail" | "calendar" | "crm_leads";

export interface CalendarEventDraft {
  summary: string;
  start: string;
  end: string;
}

export interface GmailActionDraft {
  sender: string;
  label_name: string;
}

export interface IntentSpec {
  build_type: BuildType;
  suggested_name: string;
  summary: string;
  requirements: string[];
  assumptions: string[];
  success_criteria: string[];
  out_of_scope: string[];
  reasoning: string;
  relevant_integrations: RelevantIntegration[];
  calendar_event?: CalendarEventDraft | null;
  gmail_action?: GmailActionDraft | null;
}

export interface GeneratedWebsite {
  filename: string;
  html: string;
  repair_log: string[];
}

export interface N8nExecutionResult {
  configured: boolean;
  ok: boolean;
  status_code?: number | null;
  response_body?: string | null;
  error?: string | null;
}

export interface GoogleConnectionStatus {
  connected: boolean;
}

export interface GmailLabelResult {
  sender: string;
  label_name: string;
  label_id: string;
  matched: number;
  labeled: number;
  message_ids: string[];
}

export interface CalendarEvent {
  id?: string | null;
  summary: string;
  start?: string | null;
  end?: string | null;
  html_link?: string | null;
}

export interface LeadCSVResult {
  records: Record<string, string | number>[];
  total: number;
  n8n_notification?: N8nExecutionResult | null;
}

export interface LeadScoreResult extends Record<string, string | number | N8nExecutionResult | null | undefined> {
  name: string;
  contact: string;
  email: string;
  lead_score: number;
  priority: string;
  assigned_to: string;
  validation_errors: string;
  n8n_notification?: N8nExecutionResult | null;
}

export interface ExecutionSummary {
  run_id: string;
  system_id: string;
  process_name: string;
  status: RunStatus;
  created_at: string;
  completed_at: string | null;
  step_count: number;
  agent_count: number | null;
  error?: string | null;
  awaiting_approval: boolean;
  running_nodes: string[];
}

export interface ExecutionSnapshot extends ExecutionSummary {
  steps: StepResult[];
  step_times: string[];
  final_context: Record<string, unknown>;
  input_data: Record<string, unknown>;
}

/** Events emitted by GET /api/execution/{run_id}/stream. */
export type ExecutionStreamEvent =
  | { type: "step"; step: StepResult; at: string }
  | { type: "running"; node_ids: string[] }
  | { type: "done"; status: RunStatus; final_context: Record<string, unknown>; error?: string | null; completed_at?: string | null };

export interface StoredSystemSummary {
  system_id: string;
  process_name: string;
  created_at: string;
  objective: string;
  agent_count: number;
  node_count: number;
  has_approval_gate: boolean;
}

export interface StoredSystem {
  system_id: string;
  process_name: string;
  created_at: string;
  process_spec: ProcessSpec;
  agent_architecture: AgentArchitecture;
  workflow: WorkflowGraph;
}

export interface IntegrationsStatus {
  google: { configured: boolean; connected: boolean };
  n8n: { configured: boolean };
  slack: { configured: boolean };
  http: { configured: boolean };
}

export type CapabilityKind = "read" | "write" | "delete" | "external";

export interface ToolInfo {
  capability: string;
  category: string;
  operation: string;
  kind: CapabilityKind;
  description: string;
  real: boolean;
  available: boolean;
  availability_reason: string;
  inputs: string[];
  outputs: string[];
}

export interface ClarificationResult {
  needs_clarification: boolean;
  clarification_question?: string | null;
  intent?: IntentSpec | null;
  requirements_md?: string | null;
}
