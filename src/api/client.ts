import type { ApiErrorDetail, PipelineResult, RuntimeExecutionResult, SandboxReport } from "../types/chainreact";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  detail: ApiErrorDetail;
  constructor(detail: ApiErrorDetail) {
    super(detail.message);
    this.detail = detail;
  }
}

export interface SynthesizeInput {
  requirement: string;
  allowedPermissions: string[];
  forbiddenPermissions: string[];
  approvalActions: string[];
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
    const body = await res.json().catch(() => ({}));
    // FastAPI wraps our detail dict under "detail" for HTTPException(422, detail={...})
    const detail: ApiErrorDetail = body.detail ?? {
      message: `Request failed with status ${res.status}`,
      issues: [],
    };
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
    const body = await res.json().catch(() => ({}));
    const detail: ApiErrorDetail = body.detail ?? {
      message: `Sandbox run failed with status ${res.status}`,
      issues: [],
    };
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
    const body = await res.json().catch(() => ({}));
    const detail: ApiErrorDetail = body.detail ?? {
      message: `Chat failed with status ${res.status}`,
      issues: [],
    };
    throw new ApiError(detail);
  }

  const data = await res.json();
  return data.reply as string;
}

export async function runExecution(
  result: PipelineResult,
  inputData: Record<string, string>,
  autoApprove: boolean
): Promise<RuntimeExecutionResult> {
  const res = await fetch(`${BASE_URL}/api/runtime/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spec: result.process_spec,
      architecture: result.agent_architecture,
      workflow: result.workflow,
      input_data: inputData,
      auto_approve: autoApprove,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail: ApiErrorDetail = body.detail ?? {
      message: `Execution failed with status ${res.status}`,
      issues: [],
    };
    throw new ApiError(detail);
  }

  return res.json();
}
