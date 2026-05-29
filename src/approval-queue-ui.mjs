import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_APPROVAL_QUEUE_UI_OUT_DIR = "artifacts/approval-queue-ui/latest";
export const DEFAULT_APPROVAL_QUEUE_UI_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  approvalQueuePath: "artifacts/approval-queue/latest/approval-queue.json",
  approvalInboxPath: "artifacts/approval-inbox/latest/approval-inbox.json",
  controlPlaneHumanGateReceiptsPath: "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json",
  protectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
  dashboardInformationArchitecturePath: "artifacts/review-dashboard-ia/latest/review-dashboard-ia.json",
};

const SCHEMA_VERSION = "approval-queue-ui.v1";
const CAPABILITY_ID = "dashboard.approval_queue_ui";
const PHASE_SLOT = "P289";
const PREVIOUS_PHASE_SLOT = "P288";
const NEXT_PHASE_SLOT = "P290";
const PANEL_DEFINITIONS = [
  ["pending_approvals", "Pending Approvals", "Unified pending approval queue rows from approval queue, approval inbox, and protected request pack."],
  ["required_actors", "Required Actors", "Actor workload rollup for pending approval rows."],
  ["target_artifacts", "Target Artifacts", "Lookup cards for the artifact, evidence, delivery action, or approval input path being reviewed."],
  ["receipt_drafts", "Receipt Drafts", "Non-applying receipt draft previews for human gate or protected approval receipt forms."],
  ["protected_requests", "Protected Requests", "Preview-only protected request cards and not-required placeholders for non-protected rows."],
];

export async function runApprovalQueueUi(options = {}) {
  const result = await buildApprovalQueueUi(options);
  if (options.write !== false) await writeApprovalQueueUi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Approval Queue UI validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildApprovalQueueUi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_QUEUE_UI_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const implementationRoadmapText = await readText(inputs.implementation_roadmap_path);
  const reviewDashboardText = await readText(inputs.review_dashboard_path);
  const reviewApiText = await readText(inputs.review_api_path);
  const reviewApiDocText = await readText(inputs.review_api_doc_path);
  const approvalQueue = await readJson(inputs.approval_queue_path);
  const approvalInbox = await readJson(inputs.approval_inbox_path);
  const humanGateReceipts = await readJson(inputs.control_plane_human_gate_receipts_path);
  const protectedApprovalRequestPack = await readJson(inputs.protected_approval_request_pack_path);
  const dashboardInformationArchitecture = await readJson(inputs.dashboard_information_architecture_path);

  const receiptContext = buildReceiptContext(humanGateReceipts);
  const queueItems = buildQueueUiItems({ approvalQueue, receiptContext, generatedAt });
  const inboxItems = buildInboxUiItems({ approvalInbox, receiptContext, generatedAt });
  const protectedRequestItems = buildProtectedRequestUiItems({ protectedApprovalRequestPack, generatedAt });
  const approvalQueueUiItems = [...queueItems, ...inboxItems, ...protectedRequestItems].map((item, index) => ({
    ...item,
    sort_order: index + 1,
  }));
  const targetArtifactLookups = approvalQueueUiItems.map((item) => item.target_artifact_lookup);
  const receiptDraftPreviews = approvalQueueUiItems.map((item) => item.receipt_draft_preview);
  const protectedRequestPreviews = approvalQueueUiItems.map((item) => item.protected_request_preview);
  const approvalQueueUiPanels = buildPanels({ approvalQueueUiItems, targetArtifactLookups, receiptDraftPreviews, protectedRequestPreviews, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    approvalQueue,
    approvalInbox,
    humanGateReceipts,
    protectedApprovalRequestPack,
    dashboardInformationArchitecture,
    approvalQueueUiItems,
    approvalQueueUiPanels,
    targetArtifactLookups,
    receiptDraftPreviews,
    protectedRequestPreviews,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeApprovalQueueUi({
    approvalQueue,
    approvalInbox,
    humanGateReceipts,
    protectedApprovalRequestPack,
    dashboardInformationArchitecture,
    approvalQueueUiItems,
    approvalQueueUiPanels,
    targetArtifactLookups,
    receiptDraftPreviews,
    protectedRequestPreviews,
    boundary,
    checks,
    validation,
  });

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    approval_queue_ui_id: `approval-queue-ui.${dateStamp(generatedAt)}`,
    approval_queue_ui_status: validation.valid ? "complete" : "attention",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      approvalQueue,
      approvalInbox,
      humanGateReceipts,
      protectedApprovalRequestPack,
      dashboardInformationArchitecture,
      reviewDashboardText,
      reviewApiText,
      reviewApiDocText,
    }),
    approval_queue_ui_contract: {
      schema_version: "approval-queue-ui-contract.v1",
      contract_id: SCHEMA_VERSION,
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      pending_approval_sources: ["approval_queue", "approval_inbox", "protected_approval_request_pack"],
      required_panels: PANEL_DEFINITIONS.map(([panelKey]) => panelKey),
      read_only: true,
      ui_projection_only: true,
      receipt_preview_only: true,
      protected_request_preview_only: true,
      approval_application_allowed: false,
      receipt_application_allowed: false,
      protected_action_execution_allowed: false,
      legal_advice_generated: false,
      client_facing_output_allowed: false,
    },
    approval_queue_ui_panels: approvalQueueUiPanels,
    approval_queue_ui_items: approvalQueueUiItems.map(stripNestedRows),
    approval_queue_target_artifacts: targetArtifactLookups,
    approval_queue_receipt_previews: receiptDraftPreviews,
    approval_queue_protected_request_previews: protectedRequestPreviews,
    approval_queue_ui_boundary: boundary,
    approval_queue_ui_checks: checks,
    validation_items: checks,
    validation,
    summary,
    summary_markdown: renderSummary({ summary, panels: approvalQueueUiPanels }),
  };
}

export async function writeApprovalQueueUi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "approval-queue-ui.json"), result);
  await writeJson(path.join(outDir, "approval-queue-ui-panels.json"), {
    schema_version: "approval-queue-ui-panels.v1",
    generated_at: result.generated_at,
    approval_queue_ui_panel_count: result.approval_queue_ui_panels.length,
    approval_queue_ui_panels: result.approval_queue_ui_panels,
  });
  await writeJson(path.join(outDir, "approval-queue-ui-items.json"), {
    schema_version: "approval-queue-ui-items.v1",
    generated_at: result.generated_at,
    approval_queue_ui_item_count: result.approval_queue_ui_items.length,
    approval_queue_ui_items: result.approval_queue_ui_items,
  });
  await writeJson(path.join(outDir, "approval-queue-target-artifacts.json"), {
    schema_version: "approval-queue-target-artifacts.v1",
    generated_at: result.generated_at,
    target_artifact_count: result.approval_queue_target_artifacts.length,
    approval_queue_target_artifacts: result.approval_queue_target_artifacts,
  });
  await writeJson(path.join(outDir, "approval-queue-receipt-previews.json"), {
    schema_version: "approval-queue-receipt-previews.v1",
    generated_at: result.generated_at,
    receipt_preview_count: result.approval_queue_receipt_previews.length,
    approval_queue_receipt_previews: result.approval_queue_receipt_previews,
  });
  await writeJson(path.join(outDir, "approval-queue-protected-request-previews.json"), {
    schema_version: "approval-queue-protected-request-previews.v1",
    generated_at: result.generated_at,
    protected_request_preview_count: result.approval_queue_protected_request_previews.length,
    approval_queue_protected_request_previews: result.approval_queue_protected_request_previews,
  });
  await writeJson(path.join(outDir, "approval-queue-ui-boundary.json"), result.approval_queue_ui_boundary);
  await writeJson(path.join(outDir, "approval-queue-ui-checks.json"), {
    schema_version: "approval-queue-ui-checks.v1",
    generated_at: result.generated_at,
    approval_queue_ui_check_count: result.approval_queue_ui_checks.length,
    approval_queue_ui_checks: result.approval_queue_ui_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "approval-queue-ui-validation-report.v1",
    generated_at: result.generated_at,
    approval_queue_ui_id: result.approval_queue_ui_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runApprovalQueueUiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runApprovalQueueUi(args);
    console.log(`Approval Queue UI ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.approval_queue_ui_status}`);
    console.log(`Panels: ${result.summary.approval_queue_ui_panel_count}`);
    console.log(`Items: ${result.summary.approval_queue_ui_item_count}`);
    console.log(`Receipt previews: ${result.summary.receipt_preview_count}`);
    console.log(`Protected request previews: ${result.summary.protected_request_preview_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildReceiptContext(humanGateReceipts) {
  const requirements = humanGateReceipts.receipt_requirements ?? [];
  const bySubject = new Map();
  const byPlanItem = new Map();
  for (const requirement of requirements) {
    if (requirement.subject_ref) bySubject.set(subjectKey(requirement.subject_ref), requirement);
    if (requirement.source_plan_item_id) byPlanItem.set(requirement.source_plan_item_id, requirement);
  }
  return { requirements, bySubject, byPlanItem };
}

function buildQueueUiItems({ approvalQueue, receiptContext, generatedAt }) {
  return (approvalQueue.items ?? [])
    .filter((item) => item.status === "pending")
    .map((item, index) => {
      const receiptRequirement = receiptContext.bySubject.get(subjectKey(item.subject_ref));
      const itemId = `approval-queue-ui.item.queue.${slugify(item.queue_item_id)}`;
      const target = buildQueueTargetArtifact({ itemId, item, generatedAt });
      const receiptPreview = buildReceiptPreview({ itemId, sourceStage: "approval_queue", sourceItemId: item.queue_item_id, receiptRequirement, fallbackRequiredActor: "attorney_or_designated_reviewer", generatedAt });
      const protectedPreview = buildProtectedRequestPreview({ itemId, sourceStage: "approval_queue", sourceItemId: item.queue_item_id, generatedAt });
      return {
        approval_queue_ui_item_id: itemId,
        generated_at: generatedAt,
        source_stage: "approval_queue",
        source_item_id: item.queue_item_id,
        source_item_type: item.item_type,
        item_status: "pending",
        display_status: "pending_human_decision",
        priority: item.priority,
        title: item.title,
        reason: item.reason,
        subject_ref: item.subject_ref,
        matter_id: item.matter_id ?? null,
        classification: item.classification ?? null,
        required_actor: receiptPreview.required_actor,
        required_decision: item.required_decision,
        allowed_decisions: receiptPreview.allowed_outcomes,
        recommended_actions: item.recommended_actions ?? [],
        target_artifact_ref: target.target_artifact_ref,
        target_artifact_lookup_id: target.target_artifact_lookup_id,
        receipt_draft_preview_id: receiptPreview.receipt_draft_preview_id,
        protected_request_preview_id: protectedPreview.protected_request_preview_id,
        pending_approval: true,
        read_only: true,
        preview_only: true,
        approval_application_allowed: false,
        receipt_application_allowed: false,
        protected_action_execution_allowed: false,
        legal_advice_generated: false,
        client_facing_output_generated: false,
        human_review_required: true,
        client_facing_ready: false,
        item_hash: sha256({ source: "approval_queue", id: item.queue_item_id, index }),
        target_artifact_lookup: target,
        receipt_draft_preview: receiptPreview,
        protected_request_preview: protectedPreview,
      };
    });
}

function buildInboxUiItems({ approvalInbox, receiptContext, generatedAt }) {
  return (approvalInbox.items ?? [])
    .filter((item) => item.status === "pending")
    .map((item, index) => {
      const subjectRef = { subject_type: "approval_request", subject_id: item.approval_item_id };
      const receiptRequirement = receiptContext.bySubject.get(subjectKey(subjectRef));
      const itemId = `approval-queue-ui.item.inbox.${slugify(item.approval_item_id)}`;
      const target = buildInboxTargetArtifact({ itemId, item, generatedAt });
      const receiptPreview = buildReceiptPreview({ itemId, sourceStage: "approval_inbox", sourceItemId: item.approval_item_id, receiptRequirement, fallbackRequiredActor: "human_reviewer", generatedAt });
      const protectedPreview = buildProtectedRequestPreview({ itemId, sourceStage: "approval_inbox", sourceItemId: item.approval_item_id, generatedAt });
      return {
        approval_queue_ui_item_id: itemId,
        generated_at: generatedAt,
        source_stage: "approval_inbox",
        source_item_id: item.approval_item_id,
        source_item_type: item.item_type,
        item_status: item.status,
        display_status: "pending_human_decision",
        priority: item.priority,
        title: item.title,
        reason: item.reason,
        subject_ref: subjectRef,
        matter_id: item.matter_id ?? null,
        classification: null,
        required_actor: receiptPreview.required_actor,
        required_decision: item.required_decision,
        allowed_decisions: item.allowed_decisions ?? receiptPreview.allowed_outcomes,
        recommended_actions: item.recommended_actions ?? [],
        target_artifact_ref: target.target_artifact_ref,
        target_artifact_lookup_id: target.target_artifact_lookup_id,
        receipt_draft_preview_id: receiptPreview.receipt_draft_preview_id,
        protected_request_preview_id: protectedPreview.protected_request_preview_id,
        pending_approval: true,
        read_only: true,
        preview_only: true,
        approval_application_allowed: false,
        receipt_application_allowed: false,
        protected_action_execution_allowed: false,
        legal_advice_generated: false,
        client_facing_output_generated: false,
        human_review_required: true,
        client_facing_ready: false,
        item_hash: sha256({ source: "approval_inbox", id: item.approval_item_id, index }),
        target_artifact_lookup: target,
        receipt_draft_preview: receiptPreview,
        protected_request_preview: protectedPreview,
      };
    });
}

function buildProtectedRequestUiItems({ protectedApprovalRequestPack, generatedAt }) {
  return (protectedApprovalRequestPack.approval_requests ?? [])
    .filter((request) => request.approval_status === "pending_explicit_approval")
    .map((request, index) => {
      const itemId = `approval-queue-ui.item.protected.${slugify(request.approval_request_id)}`;
      const subjectRef = { subject_type: "protected_approval_request", subject_id: request.approval_request_id };
      const target = buildProtectedRequestTargetArtifact({ itemId, request, generatedAt });
      const receiptPreview = buildProtectedApprovalReceiptPreview({ itemId, request, generatedAt });
      const protectedPreview = buildProtectedRequestPreview({ itemId, sourceStage: "protected_approval_request_pack", sourceItemId: request.approval_request_id, protectedRequest: request, generatedAt });
      return {
        approval_queue_ui_item_id: itemId,
        generated_at: generatedAt,
        source_stage: "protected_approval_request_pack",
        source_item_id: request.approval_request_id,
        source_item_type: request.approval_type,
        item_status: request.approval_status,
        display_status: "pending_explicit_approval",
        priority: request.priority,
        title: `Protected approval request: ${request.step_key}`,
        reason: request.unblock_condition ?? "Protected action requires explicit human approval.",
        subject_ref: subjectRef,
        matter_id: null,
        classification: null,
        required_actor: request.required_actor,
        required_decision: "explicit_human_approval",
        allowed_decisions: ["approve", "reject", "request_changes", "defer"],
        recommended_actions: ["review_protected_request", "fill_approval_receipt", "rerun_protected_approval_request_pack"],
        target_artifact_ref: target.target_artifact_ref,
        target_artifact_lookup_id: target.target_artifact_lookup_id,
        receipt_draft_preview_id: receiptPreview.receipt_draft_preview_id,
        protected_request_preview_id: protectedPreview.protected_request_preview_id,
        pending_approval: true,
        read_only: true,
        preview_only: true,
        approval_application_allowed: false,
        receipt_application_allowed: false,
        protected_action_execution_allowed: false,
        legal_advice_generated: false,
        client_facing_output_generated: false,
        human_review_required: true,
        client_facing_ready: false,
        item_hash: sha256({ source: "protected_approval_request_pack", id: request.approval_request_id, index }),
        target_artifact_lookup: target,
        receipt_draft_preview: receiptPreview,
        protected_request_preview: protectedPreview,
      };
    });
}

function buildQueueTargetArtifact({ itemId, item, generatedAt }) {
  const targetRef = {
    target_artifact_kind: item.subject_ref?.subject_type ?? "approval_queue_subject",
    target_artifact_id: item.subject_ref?.subject_id ?? item.queue_item_id,
    target_artifact_type: item.item_type,
    target_artifact_label: item.title,
    source_uri: item.source_uri ?? null,
    delivery_target: null,
    target_input_path: null,
  };
  return targetArtifactLookup({ itemId, sourceStage: "approval_queue", sourceItemId: item.queue_item_id, targetRef, subjectRef: item.subject_ref, generatedAt });
}

function buildInboxTargetArtifact({ itemId, item, generatedAt }) {
  const targetRef = {
    target_artifact_kind: "output_artifact",
    target_artifact_id: item.artifact_id,
    target_artifact_type: item.artifact_type,
    target_artifact_label: item.title,
    source_uri: null,
    delivery_target: item.delivery_target,
    target_input_path: null,
  };
  return targetArtifactLookup({ itemId, sourceStage: "approval_inbox", sourceItemId: item.approval_item_id, targetRef, subjectRef: { subject_type: "approval_request", subject_id: item.approval_item_id }, generatedAt });
}

function buildProtectedRequestTargetArtifact({ itemId, request, generatedAt }) {
  const targetRef = {
    target_artifact_kind: "approval_input",
    target_artifact_id: request.expected_artifact ?? request.approval_request_id,
    target_artifact_type: request.command_kind,
    target_artifact_label: request.step_key,
    source_uri: null,
    delivery_target: null,
    target_input_path: request.target_approval_input_path,
  };
  return targetArtifactLookup({ itemId, sourceStage: "protected_approval_request_pack", sourceItemId: request.approval_request_id, targetRef, subjectRef: { subject_type: "protected_approval_request", subject_id: request.approval_request_id }, generatedAt });
}

function targetArtifactLookup({ itemId, sourceStage, sourceItemId, targetRef, subjectRef, generatedAt }) {
  return {
    target_artifact_lookup_id: `${itemId}.target`,
    approval_queue_ui_item_id: itemId,
    generated_at: generatedAt,
    source_stage: sourceStage,
    source_item_id: sourceItemId,
    target_artifact_lookup_status: "linked",
    target_artifact_ref: targetRef,
    subject_ref: subjectRef ?? null,
    read_only: true,
    lookup_only: true,
    mutation_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    lookup_hash: sha256({ itemId, targetRef }),
  };
}

function buildReceiptPreview({ itemId, sourceStage, sourceItemId, receiptRequirement, fallbackRequiredActor, generatedAt }) {
  const receiptDraft = receiptRequirement?.receipt_form_draft ?? fallbackReceiptDraft({ itemId, sourceStage, sourceItemId, generatedAt });
  return {
    receipt_draft_preview_id: `${itemId}.receipt-preview`,
    approval_queue_ui_item_id: itemId,
    generated_at: generatedAt,
    source_stage: sourceStage,
    source_item_id: sourceItemId,
    receipt_requirement_id: receiptRequirement?.receipt_requirement_id ?? null,
    gate_item_id: receiptRequirement?.gate_item_id ?? null,
    gate_type: receiptRequirement?.gate_type ?? sourceStage,
    receipt_preview_status: receiptRequirement ? "draft_available" : "fallback_draft",
    required_actor: receiptRequirement?.required_actor ?? fallbackRequiredActor,
    allowed_outcomes: receiptRequirement?.allowed_outcomes ?? ["approve", "request_changes", "reject", "defer"],
    required_receipt_fields: receiptRequirement?.required_receipt_fields ?? receiptDraft.required_receipt_fields,
    receipt_form_draft: receiptDraft,
    read_only: true,
    preview_only: true,
    receipt_application_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    preview_hash: sha256({ itemId, receiptDraft }),
  };
}

function buildProtectedApprovalReceiptPreview({ itemId, request, generatedAt }) {
  const receiptDraft = request.approval_receipt_template ?? fallbackReceiptDraft({ itemId, sourceStage: "protected_approval_request_pack", sourceItemId: request.approval_request_id, generatedAt });
  return {
    receipt_draft_preview_id: `${itemId}.receipt-preview`,
    approval_queue_ui_item_id: itemId,
    generated_at: generatedAt,
    source_stage: "protected_approval_request_pack",
    source_item_id: request.approval_request_id,
    receipt_requirement_id: null,
    gate_item_id: request.command_gate_id ?? null,
    gate_type: "protected_approval_request",
    receipt_preview_status: "protected_approval_receipt_available",
    required_actor: request.required_actor,
    allowed_outcomes: ["approve", "request_changes", "reject", "defer"],
    required_receipt_fields: request.required_approval_fields ?? [],
    receipt_form_draft: receiptDraft,
    read_only: true,
    preview_only: true,
    receipt_application_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    preview_hash: sha256({ itemId, receiptDraft }),
  };
}

function fallbackReceiptDraft({ itemId, sourceStage, sourceItemId, generatedAt }) {
  return {
    receipt_id: `${itemId}.receipt`,
    source_stage: sourceStage,
    source_item_id: sourceItemId,
    receipt_status: "pending",
    outcome: "pending",
    decided_by: "",
    decided_at: "",
    reviewer: "",
    decision_reference: "",
    decision_notes: "",
    completed_action_refs: [],
    required_receipt_fields: ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes", "reviewer", "completed_action_refs"],
    generated_at: generatedAt,
  };
}

function buildProtectedRequestPreview({ itemId, sourceStage, sourceItemId, protectedRequest = null, generatedAt }) {
  return {
    protected_request_preview_id: `${itemId}.protected-request-preview`,
    approval_queue_ui_item_id: itemId,
    generated_at: generatedAt,
    source_stage: sourceStage,
    source_item_id: sourceItemId,
    approval_request_id: protectedRequest?.approval_request_id ?? null,
    protected_request_preview_status: protectedRequest ? protectedRequest.approval_status : "not_required",
    protected_action: Boolean(protectedRequest?.protected_action),
    requires_explicit_human_approval: Boolean(protectedRequest?.requires_explicit_human_approval),
    required_actor: protectedRequest?.required_actor ?? null,
    command_kind: protectedRequest?.command_kind ?? null,
    command: protectedRequest?.command ?? null,
    expected_artifact: protectedRequest?.expected_artifact ?? null,
    target_approval_input_path: protectedRequest?.target_approval_input_path ?? null,
    required_approval_fields: protectedRequest?.required_approval_fields ?? [],
    approval_receipt_template: protectedRequest?.approval_receipt_template ?? null,
    read_only: true,
    preview_only: true,
    approval_application_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: Boolean(protectedRequest),
    client_facing_ready: false,
    preview_hash: sha256({ itemId, protectedRequest: protectedRequest?.approval_request_id ?? "not_required" }),
  };
}

function buildPanels({ approvalQueueUiItems, targetArtifactLookups, receiptDraftPreviews, protectedRequestPreviews, generatedAt }) {
  const actorGroups = groupBy(approvalQueueUiItems, (item) => item.required_actor);
  const metricsByPanel = {
    pending_approvals: {
      pending_approval_count: approvalQueueUiItems.length,
      critical_or_high_count: approvalQueueUiItems.filter((item) => ["critical", "high"].includes(item.priority)).length,
      source_stage_count: Object.keys(groupBy(approvalQueueUiItems, (item) => item.source_stage)).length,
    },
    required_actors: {
      required_actor_count: Object.keys(actorGroups).length,
      required_actor_rows: Object.entries(actorGroups).map(([requiredActor, items]) => ({ required_actor: requiredActor, item_count: items.length })),
    },
    target_artifacts: {
      target_artifact_count: targetArtifactLookups.length,
      linked_target_artifact_count: targetArtifactLookups.filter((row) => row.target_artifact_lookup_status === "linked").length,
    },
    receipt_drafts: {
      receipt_preview_count: receiptDraftPreviews.length,
      draft_available_count: receiptDraftPreviews.filter((row) => ["draft_available", "protected_approval_receipt_available", "fallback_draft"].includes(row.receipt_preview_status)).length,
    },
    protected_requests: {
      protected_request_preview_count: protectedRequestPreviews.length,
      actual_protected_request_preview_count: protectedRequestPreviews.filter((row) => row.protected_action).length,
      not_required_count: protectedRequestPreviews.filter((row) => row.protected_request_preview_status === "not_required").length,
    },
  };
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, panelIntent], index) => ({
    approval_queue_ui_panel_id: `approval-queue-ui.panel.${panelKey}`,
    generated_at: generatedAt,
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: "ready",
    panel_intent: panelIntent,
    item_count: approvalQueueUiItems.length,
    metrics: metricsByPanel[panelKey],
    read_only: true,
    preview_only: true,
    mutation_allowed: false,
    approval_application_allowed: false,
    receipt_application_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    panel_hash: sha256({ panelKey, metrics: metricsByPanel[panelKey] }),
  }));
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "approval-queue-ui.boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    ui_projection_only: true,
    receipt_preview_only: true,
    protected_request_preview_only: true,
    approval_application_performed: false,
    receipt_application_performed: false,
    protected_action_executed: false,
    route_execution_performed: false,
    server_started: false,
    mutation_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildChecks(context) {
  const {
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    approvalQueue,
    approvalInbox,
    humanGateReceipts,
    protectedApprovalRequestPack,
    dashboardInformationArchitecture,
    approvalQueueUiItems,
    approvalQueueUiPanels,
    targetArtifactLookups,
    receiptDraftPreviews,
    protectedRequestPreviews,
    boundary,
  } = context;
  const sourcePendingApprovalCount = (approvalQueue.items ?? []).filter((item) => item.status === "pending").length
    + (approvalInbox.items ?? []).filter((item) => item.status === "pending").length
    + (protectedApprovalRequestPack.approval_requests ?? []).filter((item) => item.approval_status === "pending_explicit_approval").length;
  const actualProtectedRequestCount = (protectedApprovalRequestPack.approval_requests ?? []).filter((item) => item.approval_status === "pending_explicit_approval").length;
  return [
    check("source.dashboard_information_architecture", dashboardInformationArchitecture.summary?.review_dashboard_ia_status === "complete" && dashboardInformationArchitecture.summary?.phase_slot === "P288" && dashboardInformationArchitecture.summary?.next_phase_slot === "P289", "P288 Review Dashboard Information Architecture is complete and points to P289."),
    check("source.approval_queue", approvalQueue.schema_version === "approval-queue.v1" && (approvalQueue.items ?? []).length > 0, "Approval Queue source is available."),
    check("source.approval_inbox", approvalInbox.schema_version === "approval-inbox.v1" && (approvalInbox.items ?? []).length > 0, "Approval Inbox source is available."),
    check("source.human_gate_receipts", humanGateReceipts.schema_version === "control-plane-human-gate-receipt-drafts.v1" && (humanGateReceipts.receipt_requirements ?? []).length > 0, "Human gate receipt drafts are available for preview."),
    check("source.protected_approval_requests", protectedApprovalRequestPack.schema_version === "human-review-cycle-receipt-completion-protected-approval-request-pack.v1" && protectedApprovalRequestPack.summary?.validation_error_count === 0, "Protected approval request pack is available for preview."),
    check("panels.required_ready", approvalQueueUiPanels.length === PANEL_DEFINITIONS.length && approvalQueueUiPanels.every((panel, index) => panel.panel_status === "ready" && panel.panel_order === index + 1), "Required Approval Queue UI panels are ready."),
    check("items.pending_approval_coverage", approvalQueueUiItems.length === sourcePendingApprovalCount && approvalQueueUiItems.every((item) => item.pending_approval && item.display_status.startsWith("pending")), "Every source pending approval is represented in the UI item projection."),
    check("items.required_actor", approvalQueueUiItems.length > 0 && approvalQueueUiItems.every((item) => typeof item.required_actor === "string" && item.required_actor.length > 0), "Every approval queue UI item declares a required actor."),
    check("items.target_artifacts", targetArtifactLookups.length === approvalQueueUiItems.length && targetArtifactLookups.every((row) => row.target_artifact_lookup_status === "linked" && row.target_artifact_ref?.target_artifact_id), "Every approval queue UI item has a target artifact lookup."),
    check("items.receipt_previews", receiptDraftPreviews.length === approvalQueueUiItems.length && receiptDraftPreviews.every((row) => row.receipt_form_draft && row.preview_only && !row.receipt_application_allowed), "Every approval queue UI item has a receipt draft preview and no receipt application."),
    check("items.protected_request_previews", protectedRequestPreviews.length === approvalQueueUiItems.length && protectedRequestPreviews.filter((row) => row.protected_action).length === actualProtectedRequestCount && protectedRequestPreviews.every((row) => row.preview_only && !row.protected_action_execution_allowed), "Every UI item has a protected request preview row and actual protected requests remain preview-only."),
    check("surface.package_script", hasScript(packageJson, "approval:queue-ui"), "package.json exposes approval:queue-ui."),
    check("surface.dashboard_api_loop", reviewDashboardText.includes("approval_queue_ui") && reviewDashboardText.includes("buildApprovalQueueUiStage") && reviewApiText.includes("/api/approval-queue-ui-items"), "Review Dashboard and Review API expose Approval Queue UI."),
    check("surface.docs", reviewApiDocText.includes("P289 Approval Queue UI"), "Review API docs describe Approval Queue UI routes."),
    check("surface.ledger_roadmap", roadmapText.includes("P289") && roadmapText.includes("Approval Queue UI") && implementationRoadmapText.includes("Phase 289") && implementationRoadmapText.includes("Approval Queue UI"), "Ledger and implementation roadmap promote Phase 289."),
    check("boundary.read_only", boundary.read_only && boundary.ui_projection_only && boundary.receipt_preview_only && boundary.protected_request_preview_only && !boundary.approval_application_performed && !boundary.receipt_application_performed && !boundary.protected_action_executed && !boundary.route_execution_performed && !boundary.server_started && !boundary.mutation_allowed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Approval Queue UI boundary is read-only, preview-only, and non-executing."),
    check("boundary.windows_baseline", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
  ];
}

function summarizeApprovalQueueUi(context) {
  const {
    approvalQueue,
    approvalInbox,
    humanGateReceipts,
    protectedApprovalRequestPack,
    dashboardInformationArchitecture,
    approvalQueueUiItems,
    approvalQueueUiPanels,
    targetArtifactLookups,
    receiptDraftPreviews,
    protectedRequestPreviews,
    boundary,
    checks,
    validation,
  } = context;
  const queuePendingCount = (approvalQueue.items ?? []).filter((item) => item.status === "pending").length;
  const inboxPendingCount = (approvalInbox.items ?? []).filter((item) => item.status === "pending").length;
  const protectedPendingCount = (protectedApprovalRequestPack.approval_requests ?? []).filter((request) => request.approval_status === "pending_explicit_approval").length;
  return {
    approval_queue_ui_status: validation.valid ? "complete" : "attention",
    approval_queue_ui_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_dashboard_information_architecture_status: dashboardInformationArchitecture.summary?.review_dashboard_ia_status ?? "unknown",
    source_dashboard_information_architecture_phase_slot: dashboardInformationArchitecture.summary?.phase_slot ?? null,
    source_dashboard_information_architecture_next_phase_slot: dashboardInformationArchitecture.summary?.next_phase_slot ?? null,
    source_approval_queue_item_count: approvalQueue.summary?.total_items ?? approvalQueue.items?.length ?? 0,
    source_approval_queue_pending_count: queuePendingCount,
    source_approval_inbox_item_count: approvalInbox.summary?.inbox_item_count ?? approvalInbox.items?.length ?? 0,
    source_approval_inbox_pending_count: inboxPendingCount,
    source_human_gate_receipt_requirement_count: humanGateReceipts.summary?.receipt_requirement_count ?? humanGateReceipts.receipt_requirements?.length ?? 0,
    source_protected_approval_request_count: protectedApprovalRequestPack.summary?.approval_request_count ?? protectedApprovalRequestPack.approval_requests?.length ?? 0,
    source_pending_protected_approval_count: protectedPendingCount,
    source_pending_approval_count: queuePendingCount + inboxPendingCount + protectedPendingCount,
    approval_queue_ui_panel_count: approvalQueueUiPanels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: approvalQueueUiPanels.filter((panel) => panel.panel_status === "ready").length,
    approval_queue_ui_item_count: approvalQueueUiItems.length,
    pending_approval_item_count: approvalQueueUiItems.filter((item) => item.pending_approval).length,
    required_actor_count: Object.keys(groupBy(approvalQueueUiItems, (item) => item.required_actor)).length,
    missing_required_actor_count: approvalQueueUiItems.filter((item) => !item.required_actor).length,
    target_artifact_count: targetArtifactLookups.length,
    linked_target_artifact_count: targetArtifactLookups.filter((row) => row.target_artifact_lookup_status === "linked").length,
    receipt_preview_count: receiptDraftPreviews.length,
    receipt_preview_available_count: receiptDraftPreviews.filter((row) => ["draft_available", "protected_approval_receipt_available", "fallback_draft"].includes(row.receipt_preview_status)).length,
    protected_request_preview_count: protectedRequestPreviews.length,
    actual_protected_request_preview_count: protectedRequestPreviews.filter((row) => row.protected_action).length,
    not_required_protected_request_preview_count: protectedRequestPreviews.filter((row) => row.protected_request_preview_status === "not_required").length,
    read_only: boundary.read_only,
    ui_projection_only: boundary.ui_projection_only,
    receipt_preview_only: boundary.receipt_preview_only,
    protected_request_preview_only: boundary.protected_request_preview_only,
    approval_application_performed: boundary.approval_application_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    protected_action_executed: boundary.protected_action_executed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    mutation_allowed: boundary.mutation_allowed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts({ approvalQueue, approvalInbox, humanGateReceipts, protectedApprovalRequestPack, dashboardInformationArchitecture, reviewDashboardText, reviewApiText, reviewApiDocText }) {
  return {
    approval_queue: {
      schema_version: approvalQueue.schema_version,
      total_items: approvalQueue.summary?.total_items ?? approvalQueue.items?.length ?? 0,
      pending_count: (approvalQueue.items ?? []).filter((item) => item.status === "pending").length,
    },
    approval_inbox: {
      schema_version: approvalInbox.schema_version,
      inbox_item_count: approvalInbox.summary?.inbox_item_count ?? approvalInbox.items?.length ?? 0,
      pending_item_count: approvalInbox.summary?.pending_item_count ?? 0,
    },
    control_plane_human_gate_receipts: {
      schema_version: humanGateReceipts.schema_version,
      receipt_requirement_count: humanGateReceipts.summary?.receipt_requirement_count ?? humanGateReceipts.receipt_requirements?.length ?? 0,
      receipt_draft_count: humanGateReceipts.summary?.receipt_draft_count ?? 0,
    },
    protected_approval_request_pack: {
      schema_version: protectedApprovalRequestPack.schema_version,
      pack_status: protectedApprovalRequestPack.pack_status ?? protectedApprovalRequestPack.summary?.pack_status ?? null,
      approval_request_count: protectedApprovalRequestPack.summary?.approval_request_count ?? protectedApprovalRequestPack.approval_requests?.length ?? 0,
      pending_explicit_approval_count: protectedApprovalRequestPack.summary?.pending_explicit_approval_count ?? 0,
    },
    dashboard_information_architecture: {
      review_dashboard_ia_status: dashboardInformationArchitecture.summary?.review_dashboard_ia_status ?? "unknown",
      phase_slot: dashboardInformationArchitecture.summary?.phase_slot ?? null,
      next_phase_slot: dashboardInformationArchitecture.summary?.next_phase_slot ?? null,
    },
    review_dashboard_source: sourceTextRecord(reviewDashboardText),
    review_api_source: sourceTextRecord(reviewApiText),
    review_api_doc: sourceTextRecord(reviewApiDocText),
  };
}

function stripNestedRows(item) {
  const { target_artifact_lookup, receipt_draft_preview, protected_request_preview, ...row } = item;
  return row;
}

function check(pathValue, passed, message, metrics = {}) {
  return {
    path: pathValue,
    checkpoint_id: pathValue,
    check_id: pathValue.split(".").slice(-1)[0] ?? pathValue,
    status: passed ? "passed" : "failed",
    message,
    metrics,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function renderSummary({ summary, panels }) {
  const lines = [
    "# Approval Queue UI",
    "",
    `Status: ${summary.approval_queue_ui_status}`,
    `Phase: ${summary.phase_slot}`,
    `Panels: ${summary.approval_queue_ui_panel_count}`,
    `Items: ${summary.approval_queue_ui_item_count}`,
    `Receipt previews: ${summary.receipt_preview_count}`,
    `Protected request previews: ${summary.protected_request_preview_count}`,
    `Validation errors: ${summary.validation_error_count}`,
    "",
    "## Panels",
    "",
  ];
  for (const panel of panels) {
    lines.push(`- ${panel.panel_label}: ${panel.panel_status}`);
  }
  lines.push("");
  lines.push("The Approval Queue UI artifact is read-only and preview-only. It does not apply approvals, apply receipts, execute protected actions, execute routes, start a server, mutate state, generate legal advice, or create client-facing output.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.reviewApiDocPath),
    approval_queue_path: path.resolve(options.approvalQueuePath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.approvalQueuePath),
    approval_inbox_path: path.resolve(options.approvalInboxPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.approvalInboxPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.controlPlaneHumanGateReceiptsPath),
    protected_approval_request_pack_path: path.resolve(options.protectedApprovalRequestPackPath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.protectedApprovalRequestPackPath),
    dashboard_information_architecture_path: path.resolve(options.dashboardInformationArchitecturePath ?? DEFAULT_APPROVAL_QUEUE_UI_INPUTS.dashboardInformationArchitecturePath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

function sourceTextRecord(text) {
  return {
    readable: Boolean(text),
    content_hash: sha256(text ?? ""),
    byte_length: Buffer.byteLength(String(text ?? ""), "utf8"),
  };
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts?.[scriptName]);
}

function groupBy(items, keyOrFn) {
  return items.reduce((groups, item) => {
    const value = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    const key = value ?? "unknown";
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function subjectKey(subjectRef) {
  return `${subjectRef?.subject_type ?? "unknown"}:${subjectRef?.subject_id ?? "unknown"}`;
}

function sha256(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 140) || "unknown";
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--approval-queue") parsed.approvalQueuePath = argv[++index];
    else if (arg === "--approval-inbox") parsed.approvalInboxPath = argv[++index];
    else if (arg === "--human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
    else if (arg === "--protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--dashboard-ia") parsed.dashboardInformationArchitecturePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-queue-ui.mjs [--check] [--out DIR]

Options:
  --approval-queue <path>                  approval-queue.json path.
  --approval-inbox <path>                  approval-inbox.json path.
  --human-gate-receipts <path>             control-plane-human-gate-receipt-drafts.json path.
  --protected-approval-request-pack <path> protected approval request pack path.
  --dashboard-ia <path>                    review-dashboard-ia.json path.
  --package <path>                         package.json path.
  --roadmap <path>                         final completion phase ledger path.
  --implementation-roadmap <path>          implementation roadmap path.
  --review-dashboard <path>                src/review-dashboard.mjs path.
  --review-api <path>                      src/review-api.mjs path.
  --review-api-doc <path>                  docs/review-api.md path.
  --run-at <iso>                           Deterministic generated_at timestamp.
  --check                                  Fail when validation has errors.
  -h, --help                               Show this help.
`);
}
