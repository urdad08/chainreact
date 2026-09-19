from __future__ import annotations

from typing import List, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas import (
    AgentArchitecture,
    ApprovalGate,
    AuditTrail,
    Permissions,
    ProcessSpec,
    RuntimeExecutionResult,
    SandboxReport,
    ValidationResult,
    WorkflowGraph,
)
from app.runtime.executor import execute_process
from app.assistant.chat import chat as assistant_chat
from app.synthesis import audit
from app.synthesis.agent_architect import synthesize_agents
from app.synthesis.dashboard_generator import generate_dashboard_html
from app.synthesis.policy import check_agent_permissions, check_tool_permission_coverage
from app.synthesis.repair import MAX_REPAIR_ATTEMPTS, agent_architecture_issues, format_feedback, workflow_issues
from app.synthesis.requirement_parser import parse_requirement
from app.synthesis.validator import validate_process_spec
from app.synthesis.workflow_generator import synthesize_workflow
from app.testing.test_runner import run_tests

router = APIRouter(prefix="/api", tags=["synthesize"])


class RequirementIn(BaseModel):
    requirement: str = Field(..., description="Plain-language description of the workflow ONLY -- no permissions.")
    allowed_permissions: List[str] = Field(default_factory=list)
    forbidden_permissions: List[str] = Field(default_factory=list)
    approval_actions: List[str] = Field(
        default_factory=list, description="Actions that must pause for human sign-off before executing."
    )

    def apply_to(self, spec: ProcessSpec) -> ProcessSpec:
        """Overwrite the LLM-parsed permissions/approval fields with the
        user's explicit, structured selections. Permissions are a security
        boundary -- they should come from deliberate UI choices, never from
        an LLM's best-effort reading of prose."""
        spec.permissions = Permissions(allowed=self.allowed_permissions, forbidden=self.forbidden_permissions)
        spec.human_approval = [ApprovalGate(action=a, required=True) for a in self.approval_actions]
        return spec


class ProcessSpecIn(BaseModel):
    spec: ProcessSpec


class ArchitectureIn(BaseModel):
    spec: ProcessSpec
    architecture: AgentArchitecture


class SandboxIn(BaseModel):
    spec: ProcessSpec
    architecture: AgentArchitecture
    workflow: WorkflowGraph


class RuntimeIn(BaseModel):
    spec: ProcessSpec
    architecture: AgentArchitecture
    workflow: WorkflowGraph
    input_data: dict = Field(default_factory=dict, description="Sample record, e.g. a fake lead.")
    auto_approve: bool = Field(True, description="Whether to simulate approving every human_approval gate encountered.")


class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    text: str


class ChatIn(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Full conversation so far, oldest first.")


class ChatOut(BaseModel):
    reply: str


class DashboardIn(BaseModel):
    spec: ProcessSpec
    architecture: AgentArchitecture
    workflow: WorkflowGraph
    backend_base_url: str = Field(
        "", description="Public URL of the ChainReact backend the generated dashboard should call, e.g. https://chainreact.onrender.com"
    )


class DashboardOut(BaseModel):
    filename: str
    html: str


class PipelineResult(BaseModel):
    process_spec: ProcessSpec
    spec_validation: ValidationResult
    agent_architecture: AgentArchitecture
    policy_check: ValidationResult
    workflow: WorkflowGraph
    repair_log: List[str] = Field(default_factory=list)
    sandbox_report: SandboxReport
    audit_trail: AuditTrail
    deployment_approved: bool


# ---- Stage-by-stage endpoints (useful for debugging / demoing each step) ----

@router.post("/requirement/parse", response_model=ProcessSpec)
def api_parse_requirement(body: RequirementIn) -> ProcessSpec:
    if not body.requirement.strip():
        raise HTTPException(400, "requirement text is empty")
    spec = parse_requirement(body.requirement)
    return body.apply_to(spec)


@router.post("/requirement/validate", response_model=ValidationResult)
def api_validate(body: ProcessSpecIn) -> ValidationResult:
    return validate_process_spec(body.spec)


@router.post("/agents/synthesize", response_model=AgentArchitecture)
def api_synthesize_agents(body: ProcessSpecIn) -> AgentArchitecture:
    return synthesize_agents(body.spec)


@router.post("/workflow/synthesize", response_model=WorkflowGraph)
def api_synthesize_workflow(body: ArchitectureIn) -> WorkflowGraph:
    return synthesize_workflow(body.spec, body.architecture)


@router.post("/sandbox/run", response_model=SandboxReport)
def api_run_sandbox(body: SandboxIn) -> SandboxReport:
    """Generate tests from the spec/architecture/workflow, run them
    deterministically, and dry-run the workflow graph through the mock
    sandbox -- answers "does the generated system fulfill the requirement?"
    without calling the LLM again."""
    report = run_tests(body.spec, body.architecture, body.workflow)
    audit.record(
        body.spec.name, "sandbox_run_standalone",
        f"Sandbox (manual trigger): {report.passed}/{report.total} passed.",
        {"failed_tests": [o.test.id for o in report.outcomes if not o.passed]},
    )
    return report


@router.post("/runtime/execute", response_model=RuntimeExecutionResult)
def api_execute_runtime(body: RuntimeIn) -> RuntimeExecutionResult:
    """Actually run the process against a sample input record. Unlike
    /sandbox/run, this calls the LLM once per agent to produce real output
    values (e.g. an actual lead score), so you can watch data flow through
    the workflow step by step instead of just seeing a structural trace."""
    result = execute_process(body.spec, body.architecture, body.workflow, body.input_data, auto_approve=body.auto_approve)
    audit.record(
        body.spec.name, "runtime_executed",
        f"Runtime execution against sample input: {'halted at approval' if result.halted_at_approval else 'completed'}.",
        {"input_data": body.input_data, "halted_at_approval": result.halted_at_approval},
    )
    return result


@router.get("/audit/{process_name}", response_model=AuditTrail)
def api_get_audit_trail(process_name: str) -> AuditTrail:
    return audit.get_trail(process_name)


@router.post("/dashboard/generate", response_model=DashboardOut)
def api_generate_dashboard(body: DashboardIn) -> DashboardOut:
    """Generate the bounded operational dashboard for this specific,
    already-synthesized process -- a real, self-contained HTML file the
    person can download, open, or host anywhere, that only exposes the
    inputs/agents/approval-gates this ProcessSpec actually declared."""
    html_doc = generate_dashboard_html(body.spec, body.architecture, body.workflow, body.backend_base_url)
    slug = "".join(c if c.isalnum() else "-" for c in body.spec.name.lower()).strip("-") or "process"
    audit.record(
        body.spec.name, "dashboard_generated",
        "Operational dashboard HTML generated for this process.",
        {"backend_base_url": body.backend_base_url},
    )
    return DashboardOut(filename=f"{slug}-dashboard.html", html=html_doc)


@router.post("/chat", response_model=ChatOut)
def api_chat(body: ChatIn) -> ChatOut:
    if not body.messages:
        raise HTTPException(400, "messages cannot be empty")
    history = [{"role": m.role, "text": m.text} for m in body.messages]
    reply = assistant_chat(history)
    return ChatOut(reply=reply)


# ---- Single end-to-end pipeline endpoint (what the frontend calls by default) ----

@router.post("/synthesize", response_model=PipelineResult)
def api_full_pipeline(body: RequirementIn) -> PipelineResult:
    if not body.requirement.strip():
        raise HTTPException(400, "requirement text is empty")

    spec = parse_requirement(body.requirement)
    spec = body.apply_to(spec)  # permissions/approvals come from the UI, not the prompt
    audit.record(spec.name, "requirement_parsed", "Requirement parsed into ProcessSpec.", {"objective": spec.objective})

    spec_validation = validate_process_spec(spec)
    audit.record(spec.name, "spec_validated", f"Validation: {'PASSED' if spec_validation.valid else 'FAILED'}.",
                 {"issues": [i.model_dump() for i in spec_validation.issues]})
    if not spec_validation.valid:
        # Surface hard errors to the user rather than silently continuing.
        raise HTTPException(
            422,
            detail={
                "message": "ProcessSpec failed validation",
                "issues": [i.model_dump() for i in spec_validation.issues],
                "process_spec": spec.model_dump(),
            },
        )

    architecture = None
    agent_feedback: str | None = None
    repair_log: list[str] = []

    for attempt in range(MAX_REPAIR_ATTEMPTS):
        architecture = synthesize_agents(spec, feedback=agent_feedback)
        issues = agent_architecture_issues(spec, architecture)
        if not issues:
            if attempt > 0:
                repair_log.append(f"Agent architecture repaired after {attempt + 1} attempt(s).")
            break
        repair_log.append(f"Agent architecture attempt {attempt + 1} had issues: " + "; ".join(issues))
        agent_feedback = format_feedback(issues)

    policy_check = check_agent_permissions(spec, architecture)
    coverage_check = check_tool_permission_coverage(architecture)
    audit.record(
        spec.name, "agents_synthesized",
        f"{len(architecture.agents)} agent(s) synthesized; policy {'PASSED' if policy_check.valid else 'FAILED'}.",
        {"agent_ids": [a.id for a in architecture.agents], "repair_log": list(repair_log)},
    )
    if not policy_check.valid or not coverage_check.valid:
        # Repair loop exhausted its attempts and the problem is still there -- surface it
        # rather than silently deploying something that fails either check.
        all_issues = policy_check.issues + coverage_check.issues
        raise HTTPException(
            422,
            detail={
                "message": f"Agent architecture failed policy check after {MAX_REPAIR_ATTEMPTS} repair attempts",
                "issues": [i.model_dump() for i in all_issues],
                "process_spec": spec.model_dump(),
                "agent_architecture": architecture.model_dump(),
                "repair_log": repair_log,
            },
        )

    workflow = None
    workflow_feedback: str | None = None

    for attempt in range(MAX_REPAIR_ATTEMPTS):
        workflow = synthesize_workflow(spec, architecture, feedback=workflow_feedback)
        issues = workflow_issues(spec, workflow)
        if not issues:
            if attempt > 0:
                repair_log.append(f"Workflow repaired after {attempt + 1} attempt(s).")
            break
        repair_log.append(f"Workflow attempt {attempt + 1} had issues: " + "; ".join(issues))
        workflow_feedback = format_feedback(issues)

    audit.record(spec.name, "workflow_synthesized", f"Workflow with {len(workflow.nodes)} node(s) synthesized.",
                 {"repair_log": list(repair_log)})

    sandbox_report = run_tests(spec, architecture, workflow)
    audit.record(
        spec.name, "sandbox_run",
        f"Sandbox: {sandbox_report.passed}/{sandbox_report.total} passed; "
        f"ready_for_deployment={sandbox_report.ready_for_deployment}.",
        {"failed_tests": [o.test.id for o in sandbox_report.outcomes if not o.passed]},
    )

    deployment_approved = bool(policy_check.valid and coverage_check.valid and sandbox_report.ready_for_deployment)
    audit.set_deployment_approved(spec.name, deployment_approved)
    audit.record(
        spec.name, "deployment_gate",
        f"Deployment {'APPROVED' if deployment_approved else 'BLOCKED'}.",
        {"policy_valid": policy_check.valid, "sandbox_ready": sandbox_report.ready_for_deployment},
    )

    return PipelineResult(
        process_spec=spec,
        spec_validation=spec_validation,
        agent_architecture=architecture,
        policy_check=policy_check,
        workflow=workflow,
        repair_log=repair_log,
        sandbox_report=sandbox_report,
        audit_trail=audit.get_trail(spec.name),
        deployment_approved=deployment_approved,
    )

