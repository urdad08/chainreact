import type {
  ApiErrorDetail,
  CalendarEvent,
  ExecutionSnapshot,
  GeneratedWebsite,
  ExecutionSummary,
  GmailLabelResult,
  GoogleConnectionStatus,
  IntegrationsStatus,
  IntentSpec,
  AuditTrail,
  StoredSystem,
  StoredSystemSummary,
  ToolInfo,
  LeadCSVResult,
  LeadScoreResult,
  PipelineResult,
  SandboxReport,
} from "../types/chainreact";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  detail: ApiErrorDetail;
  constructor(detail: ApiErrorDetail) {
    super(detail.message);
    this.detail = detail;
  }
}

// Parses a failed fetch response into a normalized ApiErrorDetail. Three
// distinct shapes can come back from the backend: FastAPI's HTTPException(...,
// detail={...}) wraps our dict under "detail" (used for validation/policy
// failures), HTTPException(..., "plain string") puts a bare string there
// (used by the integrations endpoints for simple errors like "not
// connected yet"), while our LLMUnavailableError handler returns {message,
// retryable} directly at the top level (used when Gemini itself is
// overloaded). This normalizes all three into one shape the UI can rely on.
async function parseApiError(res: Response, fallbackMessage: string): Promise<ApiErrorDetail> {
  const body = await res.json().catch(() => ({}));
  if (typeof body.detail === "string") {
    return { message: body.detail, issues: [] };
  }
  if (body.detail) {
    return body.detail as ApiErrorDetail;
  }
  if (body.message) {
    return { message: body.message, issues: [], retryable: body.retryable ?? false };
  }
  return { message: fallbackMessage, issues: [], retryable: res.status === 503 };
}

export interface SynthesizeInput {
  requirement: string;
  allowedPermissions: string[];
  forbiddenPermissions: string[];
  approvalActions: string[];
}

export interface PermissionSuggestion {
  allowed: string[];
  forbidden: string[];
  approval_actions: string[];
}

export async function suggestPermissions(requirement: string): Promise<PermissionSuggestion> {
  const res = await fetch(`${BASE_URL}/api/permissions/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Permission suggestions failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function processLeadCsv(csvText: string, salesReps: string[]): Promise<LeadCSVResult> {
  const res = await fetch(`${BASE_URL}/api/leads/process-csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv_text: csvText, sales_reps: salesReps }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Lead CSV processing failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function scoreLead(input: { name: string; contact: string; email: string }): Promise<LeadScoreResult> {
  const res = await fetch(`${BASE_URL}/api/leads/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Lead scoring failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export interface BuildPlan {
  intent: IntentSpec;
  requirements_md: string;
}

export interface BuildPlanResponse {
  needs_clarification: boolean;
  clarification_question?: string | null;
  intent?: IntentSpec | null;
  requirements_md?: string | null;
}

export async function planBuild(requirement: string, skipClarification = false): Promise<BuildPlanResponse> {
  const res = await fetch(`${BASE_URL}/api/build/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement, skip_clarification: skipClarification }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Build planning failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function buildWebsite(requirement: string, intent: IntentSpec): Promise<GeneratedWebsite> {
  const res = await fetch(`${BASE_URL}/api/build/website`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement, intent }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Website generation failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function synthesize(input: SynthesizeInput): Promise<PipelineResult> {
  const res = await fetch(`${BASE_URL}/api/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requirement: input.requirement,
      allowed_permissions: input.allowedPermissions,
      forbidden_permissions: input.forbiddenPermissions,
      approval_actions: input.approvalActions,
    }),
  });

  if (!res.ok) {
    const detail = await parseApiError(res, `Request failed with status ${res.status}`);
    throw new ApiError(detail);
  }

  return res.json();
}

export async function runSandbox(result: PipelineResult): Promise<SandboxReport> {
  const res = await fetch(`${BASE_URL}/api/sandbox/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spec: result.process_spec,
      architecture: result.agent_architecture,
      workflow: result.workflow,
    }),
  });

  if (!res.ok) {
    const detail = await parseApiError(res, `Sandbox run failed with status ${res.status}`);
    throw new ApiError(detail);
  }

  return res.json();
}

export async function sendChatMessage(
  messages: { role: "user" | "model"; text: string }[]
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const detail = await parseApiError(res, `Chat failed with status ${res.status}`);
    throw new ApiError(detail);
  }

  const data = await res.json();
  return data.reply as string;
}

export function googleConnectUrl(): string {
  return `${BASE_URL}/api/integrations/google/connect`;
}

export async function getGoogleStatus(): Promise<GoogleConnectionStatus> {
  const res = await fetch(`${BASE_URL}/api/integrations/google/status`);
  if (!res.ok) throw new Error(`Could not check Google connection status (${res.status})`);
  return res.json();
}

export async function disconnectGoogle(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/integrations/google/disconnect`, { method: "POST" });
  if (!res.ok) throw new Error(`Could not disconnect Google account (${res.status})`);
}

export async function labelEmailsFromSender(sender: string, labelName: string): Promise<GmailLabelResult> {
  const res = await fetch(`${BASE_URL}/api/integrations/gmail/label-sender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender, label_name: labelName }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Gmail labeling failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function listCalendarEvents(): Promise<{ events: CalendarEvent[] }> {
  const res = await fetch(`${BASE_URL}/api/integrations/calendar/events`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Listing calendar events failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function createCalendarEvent(
  summary: string,
  start: string,
  end: string,
  description = ""
): Promise<CalendarEvent> {
  const res = await fetch(`${BASE_URL}/api/integrations/calendar/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary, start, end, description }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Creating calendar event failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

// ---- Live execution (real DAG traversal, real/simulated tool calls, human-approval pause/resume) ----

export async function startExecution(
  systemId: string,
  inputData: Record<string, string>,
  autoApprove: boolean,
  allowRealTools: boolean
): Promise<{ run_id: string }> {
  const res = await fetch(`${BASE_URL}/api/execution/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_id: systemId, input_data: inputData, auto_approve: autoApprove, allow_real_tools: allowRealTools }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Starting execution failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function getExecution(runId: string): Promise<ExecutionSnapshot> {
  const res = await fetch(`${BASE_URL}/api/execution/${runId}`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Fetching execution failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function approveExecution(runId: string, approved: boolean): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/execution/${runId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Approval failed with status ${res.status}`);
    throw new ApiError(detail);
  }
}

export function executionStreamUrl(runId: string): string {
  return `${BASE_URL}/api/execution/${runId}/stream`;
}

export async function listExecutions(): Promise<ExecutionSummary[]> {
  const res = await fetch(`${BASE_URL}/api/execution`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Listing executions failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return (await res.json()).runs;
}

// ---- Stored systems ----

export async function listSystems(): Promise<StoredSystemSummary[]> {
  const res = await fetch(`${BASE_URL}/api/systems`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Listing systems failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return (await res.json()).systems;
}

export async function getSystem(systemId: string): Promise<StoredSystem> {
  const res = await fetch(`${BASE_URL}/api/systems/${systemId}`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Fetching system failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

export async function getAuditTrail(processName: string): Promise<AuditTrail> {
  const res = await fetch(`${BASE_URL}/api/audit/${encodeURIComponent(processName)}`);
  if (!res.ok) {
    const detail = await parseApiError(res, `Fetching audit trail failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

/** Sandbox-test a stored system (spec/architecture/workflow) without rebuilding it. */
export async function runSandboxFor(system: Pick<StoredSystem, "process_spec" | "agent_architecture" | "workflow">): Promise<SandboxReport> {
  const res = await fetch(`${BASE_URL}/api/sandbox/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec: system.process_spec, architecture: system.agent_architecture, workflow: system.workflow }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res, `Sandbox run failed with status ${res.status}`);
    throw new ApiError(detail);
  }
  return res.json();
}

// ---- Integrations & tool registry (booleans only -- secrets never leave the backend) ----

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  const res = await fetch(`${BASE_URL}/api/integrations/status`);
  if (!res.ok) throw new Error(`Could not load integration status (${res.status})`);
  return res.json();
}

export async function listTools(): Promise<ToolInfo[]> {
  const res = await fetch(`${BASE_URL}/api/integrations/tools`);
  if (!res.ok) throw new Error(`Could not load the tool registry (${res.status})`);
  return (await res.json()).tools;
}

export const API_BASE_URL = BASE_URL;

