from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas import (
    AgentArchitecture,
    AgentDef,
    ApprovalGate,
    AuditTrail,
    GeneratedWebsite,
    IntentSpec,
    N8nExecutionResult,
    Permissions,
    ProcessSpec,
    RuntimeExecutionResult,
    SandboxReport,
    StoredSystem,
    StoredSystemList,
    ValidationResult,
    WorkflowGraph,
)
from app.runtime.executor import execute_process
from app.assistant.chat import chat as assistant_chat
from app.synthesis import audit
from app.synthesis.agent_architect import synthesize_agents
from app.synthesis.clarification_checker import check_needs_clarification
from app.synthesis.dashboard_generator import generate_dashboard_html
from app.synthesis.intent_classifier import classify_intent
from app.synthesis.n8n_integration import notify_n8n, notify_n8n_lead_result, notify_n8n_runtime_result, simulate_agent_step
from app.synthesis.policy import check_agent_permissions, check_tool_permission_coverage
from app.synthesis.lead_csv import process_lead_csv, process_single_lead
from app.synthesis.permission_suggester import PermissionSuggestions, suggest_permissions
from app.synthesis.repair import MAX_REPAIR_ATTEMPTS, agent_architecture_issues, format_feedback, workflow_issues
from app.synthesis.requirement_doc import generate_requirement_md
from app.synthesis.requirement_parser import parse_requirement
from app.synthesis import system_store
from app.synthesis.validator import validate_process_spec
from app.synthesis.website_generator import MAX_WEBSITE_ATTEMPTS, generate_website
from app.synthesis.website_validator import website_issues
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


class PermissionSuggestionIn(BaseModel):
    requirement: str = Field(..., min_length=1)


class LeadCSVIn(BaseModel):
    csv_text: str = Field(..., min_length=1)
    sales_reps: List[str] = Field(default_factory=list)


class LeadScoreIn(BaseModel):
    name: str = Field(..., min_length=1)
    contact: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)


class LeadCSVOut(BaseModel):
    records: List[Dict[str, Any]]
    total: int
    n8n_notification: N8nExecutionResult | None = None


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


class BuildPlanIn(BaseModel):
    requirement: str = Field(..., min_length=1, description="Free-text description of what to build.")
    skip_clarification: bool = Field(
        False, description="Set after the user has already answered a clarification question once, to avoid "
        "an endless back-and-forth -- the next round always proceeds to classification.",
    )


class BuildPlanOut(BaseModel):
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    intent: Optional[IntentSpec] = None
    requirements_md: Optional[str] = None


class BuildWebsiteIn(BaseModel):
    requirement: str = Field(..., min_length=1)
    intent: IntentSpec = Field(..., description="The (possibly user-reviewed/overridden) IntentSpec from /api/build/plan.")


class N8nNotifyIn(BaseModel):
    process_name: str = Field(..., min_length=1)
    architecture: AgentArchitecture
    workflow: WorkflowGraph


class N8nAgentStepIn(BaseModel):
    agent: AgentDef
    context: Dict[str, Any] = Field(default_factory=dict)


class N8nAgentStepOut(BaseModel):
    output: Dict[str, Any]


class N8nApprovalResumeIn(BaseModel):
    process_name: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    approved: bool = True


class PipelineResult(BaseModel):
    system_id: str
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


@router.post("/permissions/suggest", response_model=PermissionSuggestions)
def api_suggest_permissions(body: PermissionSuggestionIn) -> PermissionSuggestions:
    if not body.requirement.strip():
        raise HTTPException(400, "requirement text is empty")
    return suggest_permissions(body.requirement)


@router.post("/leads/process-csv", response_model=LeadCSVOut)
def api_process_lead_csv(body: LeadCSVIn) -> LeadCSVOut:
    try:
        result = process_lead_csv(body.csv_text, body.sales_reps)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    audit.record(
        "CSV Lead Qualification", "lead_csv_processed",
        f"Processed {result['total']} uploaded lead row(s).",
        {"record_count": result["total"]},
    )
    # Forward the real, computed scores/assignments to n8n automatically --
    # this is a "ran it for real" action, not just a workflow's shape, so
    # it goes out immediately rather than waiting for the manual button.
    n8n_result = notify_n8n_lead_result("lead_csv_processed", result["records"])
    audit.record(
        "CSV Lead Qualification", "n8n_notified",
        f"n8n webhook notify (lead CSV result): {'sent' if n8n_result.ok else ('not configured' if not n8n_result.configured else 'failed')}.",
        {"configured": n8n_result.configured, "ok": n8n_result.ok, "status_code": n8n_result.status_code, "error": n8n_result.error},
    )
    return LeadCSVOut(**result, n8n_notification=n8n_result)


@router.post("/leads/score")
def api_score_lead(body: LeadScoreIn) -> Dict[str, Any]:
    if not body.name.strip() or not body.contact.strip() or not body.email.strip():
        raise HTTPException(400, "Name, contact, and email are required.")
    result = process_single_lead(body.name, body.contact, body.email)
    audit.record(
        "CSV Lead Qualification", "lead_scored",
        "Scored one submitted lead.",
        {"record_count": 1},
    )
    n8n_result = notify_n8n_lead_result("lead_scored", [result])
    audit.record(
        "CSV Lead Qualification", "n8n_notified",
        f"n8n webhook notify (lead score result): {'sent' if n8n_result.ok else ('not configured' if not n8n_result.configured else 'failed')}.",
        {"configured": n8n_result.configured, "ok": n8n_result.ok, "status_code": n8n_result.status_code, "error": n8n_result.error},
    )
    return {**result, "n8n_notification": n8n_result.model_dump()}


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

    # Only forward a run that actually finished -- one halted at a human
    # approval gate has no final desired result yet, so there's nothing
    # real to hand off to n8n.
    if not result.halted_at_approval:
        n8n_result = notify_n8n_runtime_result(body.spec.name, body.input_data, result)
        result.n8n_notification = n8n_result
        audit.record(
            body.spec.name, "n8n_notified",
            f"n8n webhook notify (runtime result): {'sent' if n8n_result.ok else ('not configured' if not n8n_result.configured else 'failed')}.",
            {"configured": n8n_result.configured, "ok": n8n_result.ok, "status_code": n8n_result.status_code, "error": n8n_result.error},
        )
    return result


@router.get("/audit/{process_name}", response_model=AuditTrail)
def api_get_audit_trail(process_name: str) -> AuditTrail:
    return audit.get_trail(process_name)


@router.get("/systems", response_model=StoredSystemList)
def api_list_systems() -> StoredSystemList:
    """Every generated system persists past its own request/response now --
    this lists them so one can be fetched and re-executed later without
    resending the full spec/architecture/workflow from the frontend."""
    return StoredSystemList(systems=system_store.list_systems())


@router.get("/systems/{system_id}", response_model=StoredSystem)
def api_get_system(system_id: str) -> StoredSystem:
    stored = system_store.get_system(system_id)
    if stored is None:
        raise HTTPException(404, f"No stored system with id '{system_id}'.")
    return stored


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


# ---- Build intent: classify website-vs-workflow, document the request ----

@router.post("/build/plan", response_model=BuildPlanOut)
def api_build_plan(body: BuildPlanIn) -> BuildPlanOut:
    """Step 1+2 of the build flow: first check whether anything critical
    is missing (and if so, ask -- rather than silently guessing), then
    classify what the user wants to build (website vs the existing
    agent-workflow pipeline) and render that understanding into a
    Markdown doc for the user to review/override before any generation
    runs."""
    if not body.requirement.strip():
        raise HTTPException(400, "requirement text is empty")

    if not body.skip_clarification:
        clarification = check_needs_clarification(body.requirement)
        if clarification.needs_clarification and clarification.question:
            audit.record(
                "build_plan", "clarification_requested",
                f"Asked for clarification: {clarification.question}",
                {"question": clarification.question},
            )
            return BuildPlanOut(needs_clarification=True, clarification_question=clarification.question)

    intent = classify_intent(body.requirement)
    requirements_md = generate_requirement_md(body.requirement, intent)
    audit.record(
        "build_plan", "intent_classified",
        f"Classified as '{intent.build_type}': {intent.summary}",
        {"build_type": intent.build_type, "requirements": intent.requirements},
    )
    return BuildPlanOut(intent=intent, requirements_md=requirements_md)


@router.post("/build/website", response_model=GeneratedWebsite)
def api_build_website(body: BuildWebsiteIn) -> GeneratedWebsite:
    """Step 3+4 of the build flow when the user wants a website: generate
    a single self-contained HTML page from the requirement + reviewed
    IntentSpec, then deterministically check the result against the
    IntentSpec's requirements checklist and retry with feedback on a miss
    (same generate -> diagnose -> feedback -> retry shape as the workflow
    pipeline's repair loop)."""
    if not body.requirement.strip():
        raise HTTPException(400, "requirement text is empty")

    html_doc = ""
    feedback: str | None = None
    repair_log: list[str] = []

    for attempt in range(MAX_WEBSITE_ATTEMPTS):
        html_doc = generate_website(body.requirement, body.intent, feedback=feedback)
        issues = website_issues(body.intent, html_doc)
        if not issues:
            if attempt > 0:
                repair_log.append(f"Website repaired after {attempt + 1} attempt(s).")
            break
        repair_log.append(f"Website attempt {attempt + 1} had issues: " + "; ".join(issues))
        feedback = "\n".join(f"- {issue}" for issue in issues)

    slug = "".join(c if c.isalnum() else "-" for c in body.intent.summary.lower()).strip("-")[:60] or "website"
    audit.record(
        "build_plan", "website_generated",
        f"Website generated for: {body.intent.summary}",
        {"repair_log": repair_log},
    )
    return GeneratedWebsite(filename=f"{slug}.html", html=html_doc, repair_log=repair_log)


# ---- n8n webhook integration ----

@router.post("/n8n/notify", response_model=N8nExecutionResult)
def api_n8n_notify(body: N8nNotifyIn) -> N8nExecutionResult:
    """Push a JSON summary of the synthesized process (id/name, agents,
    workflow graph) to the backend-configured n8n webhook (N8N_WEBHOOK_URL).
    The URL itself never leaves the backend -- this endpoint is the only
    way to trigger it, and the result returned to the frontend carries no
    URL, only outcome/status."""
    result = notify_n8n(body.process_name, body.architecture, body.workflow)
    audit.record(
        body.process_name, "n8n_notified",
        f"n8n webhook notify: {'sent' if result.ok else ('not configured' if not result.configured else 'failed')}.",
        {"configured": result.configured, "ok": result.ok, "status_code": result.status_code, "error": result.error},
    )
    return result


@router.post("/n8n/agent-step", response_model=N8nAgentStepOut)
def api_n8n_agent_step(body: N8nAgentStepIn) -> N8nAgentStepOut:
    """Callback target for an n8n HTTP Request node: runs ONE synthesized
    agent's simulated output for the given context, so an n8n workflow
    wired to this endpoint executes real ChainReact agent logic step by
    step instead of only acting on the static snapshot /n8n/notify sent."""
    output = simulate_agent_step(body.agent, body.context)
    return N8nAgentStepOut(output=output)


@router.post("/n8n/approval/resume")
def api_n8n_approval_resume(body: N8nApprovalResumeIn) -> Dict[str, Any]:
    """Callback target for an n8n workflow to call after ITS OWN Wait node
    resumes following a human decision -- records the outcome in
    ChainReact's audit trail so both systems agree on what happened, even
    though n8n's own pause/resume mechanics are outside ChainReact."""
    audit.record(
        body.process_name, "approval_resumed",
        f"Approval for '{body.action}' {'approved' if body.approved else 'rejected'} (resumed from n8n).",
        {"action": body.action, "approved": body.approved, "source": "n8n"},
    )
    return {"status": "recorded"}


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
        issues = workflow_issues(spec, workflow, architecture)
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

    stored = system_store.save_system(spec, architecture, workflow)

    return PipelineResult(
        system_id=stored.system_id,
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

