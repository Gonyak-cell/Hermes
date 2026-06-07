import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildValidationReceiptCompletionReconciliation } from "./validation-receipt-completion-reconciliation.mjs";

export const DEFAULT_RECEIPT_COMPLETION_OPERATOR_WORKBENCH_OUT_DIR = "artifacts/receipt-completion-operator-workbench/latest";
export const DEFAULT_RECEIPT_COMPLETION_OPERATOR_WORKBENCH_INPUTS = {
  schemaPath: "schemas/receipt-completion-operator-workbench.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p22401-p22800.md",
  architectureDocPath: "docs/architecture.md",
  sourceValidationReceiptCompletionReconciliationPath: "artifacts/validation-receipt-completion-reconciliation/latest/validation-receipt-completion-reconciliation.json",
};

const COMMAND_NAME = "platform:receipt-completion-operator-workbench";
const SCHEMA_VERSION = "receipt-completion-operator-workbench.v1";
const CAPABILITY_ID = "platform.receipt_completion_operator_workbench";
const PROGRAM_RANGE = "P22401-P22800";
const SOURCE_PROGRAM_RANGE = "P22001-P22400";
const READY_STATUS = "ready_for_receipt_completion_operator_workbench";
const BLOCK_PENDING_STATUS = "valid_block_receipt_completion_operator_workbench_pending";
const BLOCKED_STATUS = "blocked_receipt_completion_operator_workbench";

const PHASE_SPECS = [
  ["P22401-P22440", "P22400 Source Binding", "p22400_source_binding_rows"],
  ["P22441-P22520", "Operator Workbench Task Queue", "operator_workbench_task_rows"],
  ["P22521-P22600", "Remediation Plan Drafts", "remediation_plan_draft_rows"],
  ["P22601-P22680", "Evidence Request Packet", "evidence_request_packet_rows"],
  ["P22681-P22740", "Review Escalation Router", "review_escalation_router_rows"],
  ["P22741-P22780", "No-Apply Boundary", "no_apply_boundary_rows"],
  ["P22781-P22800", "P22800 Clean Checkpoint", "p22800_clean_checkpoint_rows"],
];

const FALLBACK_RECEIPT_TYPES = [
  "syntax_check",
  "targeted_tests",
  "adjacent_tests",
  "platform_cli_check",
  "diff_check",
  "full_npm_test",
  "claude_review",
];

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

const WORKBENCH_EXTRA_FALSE_FLAGS = [
  "command_execution_allowed_now",
  "artifact_write_allowed_now",
  "remediation_apply_allowed_now",
  "operator_task_auto_close_allowed_now",
  "receipt_completion_claim_allowed_now",
  "receipt_completion_accepted_now",
  "completion_reconciliation_final_now",
  "operator_completion_apply_allowed_now",
  "verifier_finality_allowed_now",
  "operator_merge_allowed_now",
  "raw_stdout_capture_allowed_now",
  "raw_stderr_capture_allowed_now",
  "raw_secret_material_allowed_now",
];

const REVIEW_ROUTER_SPECS = [
  ["targeted_validation", "Targeted validation remains required for changed surfaces", "required_now"],
  ["adjacent_validation", "Adjacent validation is required when contract-linked", "required_when_contract_linked"],
  ["full_npm_test", "Full npm test is conditional for broad freeze or explicit closeout", "conditional_high_risk"],
  ["claude_review", "Claude Code Opus max review is conditional for high-risk transitions", "conditional_high_risk"],
  ["human_gate", "Human gate remains excluded from this tranche", "blocked_out_of_scope"],
  ["release_approval", "Release approval remains excluded from this tranche", "blocked_out_of_scope"],
  ["production_pass", "Production PASS remains excluded from this tranche", "blocked_out_of_scope"],
];

export async function runReceiptCompletionOperatorWorkbench(options = {}) {
  const result = await buildReceiptCompletionOperatorWorkbench(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Completion Operator Workbench failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptCompletionOperatorWorkbench(result, result.output_dir);
  return result;
}

export async function buildReceiptCompletionOperatorWorkbench(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_COMPLETION_OPERATOR_WORKBENCH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "validationReceiptCompletionReconciliation")
    ? normalizeInlineJsonSource("inline.validation_receipt_completion_reconciliation", options.validationReceiptCompletionReconciliation)
    : await readJsonOrBuildP22400(inputs.source_validation_receipt_completion_reconciliation_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const receiptTypes = extractReceiptTypes(source);
  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const taskRows = buildTaskRows({ source, receiptTypes, generatedAt });
  const remediationRows = buildRemediationRows({ taskRows, generatedAt });
  const evidenceRows = buildEvidenceRequestRows({ taskRows, generatedAt });
  const reviewRows = buildReviewRouterRows(generatedAt);
  const boundaryRows = buildNoApplyRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, taskRows, remediationRows, evidenceRows, reviewRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, taskRows, remediationRows, evidenceRows, reviewRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, taskRows, remediationRows, evidenceRows, reviewRows, boundaryRows, checkpointRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      validation_receipt_completion_reconciliation_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_validation_receipt_completion_reconciliation_summary: source.data?.summary ?? null,
    receipt_completion_operator_workbench_contract: buildContract(generatedAt),
    receipt_completion_operator_workbench_phase_rows: phaseRows,
    p22400_source_binding_rows: sourceRows,
    operator_workbench_task_rows: taskRows,
    remediation_plan_draft_rows: remediationRows,
    evidence_request_packet_rows: evidenceRows,
    review_escalation_router_rows: reviewRows,
    no_apply_boundary_rows: boundaryRows,
    p22800_clean_checkpoint_rows: checkpointRows,
    receipt_completion_operator_workbench_boundary: boundary,
    receipt_completion_operator_workbench_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_completion_operator_workbench")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_completion_operator_workbench_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_completion_operator_workbench_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptCompletionOperatorWorkbench(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-completion-operator-workbench.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p22400-source-binding-rows.json"), collectionEnvelope("p22400-source-binding-rows.v1", "p22400_source_binding_rows", result.p22400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-workbench-task-rows.json"), collectionEnvelope("operator-workbench-task-rows.v1", "operator_workbench_task_rows", result.operator_workbench_task_rows, result.generated_at));
  await writeJson(path.join(outDir, "remediation-plan-draft-rows.json"), collectionEnvelope("remediation-plan-draft-rows.v1", "remediation_plan_draft_rows", result.remediation_plan_draft_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-request-packet-rows.json"), collectionEnvelope("evidence-request-packet-rows.v1", "evidence_request_packet_rows", result.evidence_request_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-escalation-router-rows.json"), collectionEnvelope("review-escalation-router-rows.v1", "review_escalation_router_rows", result.review_escalation_router_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-apply-boundary-rows.json"), collectionEnvelope("no-apply-boundary-rows.v1", "no_apply_boundary_rows", result.no_apply_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p22800-clean-checkpoint-rows.json"), collectionEnvelope("p22800-clean-checkpoint-rows.v1", "p22800_clean_checkpoint_rows", result.p22800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-completion-operator-workbench-boundary.json"), result.receipt_completion_operator_workbench_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptCompletionOperatorWorkbenchCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptCompletionOperatorWorkbench(args);
  console.log(`Receipt Completion Operator Workbench ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_completion_operator_workbench_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P22400 ready for P22401 handoff: ${result.summary.source_p22400_ready_for_p22401_handoff}`);
  console.log(`Workbench task count: ${result.summary.workbench_task_count}`);
  console.log(`Open read-only task count: ${result.summary.open_read_only_task_count}`);
  console.log(`Remediation apply allowed: ${result.summary.remediation_apply_allowed_now}`);
  console.log(`Ready for P22801 handoff: ${result.summary.ready_for_p22801_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.validation_receipt_completion_reconciliation_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p22401_handoff === true,
    status: summary.validation_receipt_completion_reconciliation_status ?? "missing",
    p22400ContractReady: boundary.p22400_contract_ready === true,
    completionGapVisible: boundary.completion_gap_ledger_visible_now === true,
    digestGuardVisible: boundary.digest_integrity_guard_visible_now === true,
    acceptanceVisible: boundary.acceptance_reconciliation_visible_now === true,
    operatorIndexVisible: boundary.operator_completion_index_visible_now === true,
    noCompletionFinalityClosed: boundary.no_completion_finality_boundary_closed_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p22401-p22800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P22400 validation receipt completion reconciliation source is available", sourceState.available],
    ["program_range", "P22400 source program range is P22001-P22400", sourceState.programRangeOk],
    ["validation_valid", "P22400 source validation is valid", sourceState.validationValid],
    ["p22401_handoff_open", "P22400 source opened P22401 handoff", sourceState.sourceReady],
    ["p22400_contract_ready", "P22400 source contract is ready", sourceState.p22400ContractReady],
    ["completion_gap_visible", "P22400 completion gap ledger is visible", sourceState.completionGapVisible],
    ["digest_guard_visible", "P22400 digest guard is visible", sourceState.digestGuardVisible],
    ["acceptance_visible", "P22400 acceptance reconciliation is visible", sourceState.acceptanceVisible],
    ["operator_index_visible", "P22400 operator completion index is visible", sourceState.operatorIndexVisible],
    ["no_completion_finality_closed", "P22400 no-completion finality boundary is closed", sourceState.noCompletionFinalityClosed],
    ["commit_ref_present", "Current commit ref is present for operator workbench", Boolean(commitRef)],
    ["source_blocker_visible", "P22400 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p22400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildTaskRows({ source, receiptTypes, generatedAt }) {
  const gapRows = Array.isArray(source.data?.receipt_completion_gap_ledger_rows)
    ? source.data.receipt_completion_gap_ledger_rows
    : [];
  return receiptTypes.map((receiptType, index) => {
    const gap = gapRows.find((item) => item.receipt_type === receiptType) ?? {};
    const gapVisible = gap.completion_gap_visible_now !== false;
    return row({
      row_id: `workbench_task.${receiptType}`,
      category: "operator_workbench_task",
      label: `Read-only workbench task for ${receiptType}`,
      observed: true,
      evidence_ref: gap.row_id ?? "receipt_completion_gap_ledger_rows",
      receipt_type: receiptType,
      task_order: index + 1,
      owner_lane: "operator",
      task_state: gapVisible ? "task_open_read_only" : "task_review_pending",
      required_evidence: "redacted_receipt_candidate",
      next_action: gapVisible ? "prepare_redacted_receipt_candidate" : "review_digest_integrity",
      command_execution_allowed_now: false,
      artifact_write_allowed_now: false,
      protected_action_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildRemediationRows({ taskRows, generatedAt }) {
  return taskRows.map((item) => row({
    row_id: `remediation_plan.${item.receipt_type}`,
    category: "remediation_plan_draft",
    label: `Advisory remediation plan for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    plan_state: "draft_advisory_only",
    suggested_action: item.next_action,
    command_execution_allowed_now: false,
    artifact_write_allowed_now: false,
    remediation_apply_allowed_now: false,
    final_approval_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildEvidenceRequestRows({ taskRows, generatedAt }) {
  return taskRows.map((item) => row({
    row_id: `evidence_request.${item.receipt_type}`,
    category: "evidence_request_packet",
    label: `Evidence request packet for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    command_id_required: true,
    source_commit_ref_required: true,
    evidence_ref_required: true,
    hash_required: true,
    redacted_summary_ref_required: true,
    freshness_window_required: true,
    raw_stdout_allowed_now: false,
    raw_stderr_allowed_now: false,
    raw_secret_material_allowed_now: false,
    full_transcript_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildReviewRouterRows(generatedAt) {
  return REVIEW_ROUTER_SPECS.map(([id, label, requirementMode]) => row({
    row_id: `review_router.${id}`,
    category: "review_escalation_router",
    label,
    observed: true,
    evidence_ref: "review_escalation_router_rows",
    review_trigger: id,
    requirement_mode: requirementMode,
    review_required_now: requirementMode === "required_now",
    claude_review_required_now: id === "claude_review" ? false : false,
    full_npm_test_required_now: id === "full_npm_test" ? false : false,
    final_authority_granted_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoApplyRows(generatedAt) {
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
    ...WORKBENCH_EXTRA_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
  ].map(([flag, label]) => row({
    row_id: `no_apply.${flag}`,
    category: "no_apply_boundary",
    label,
    observed: true,
    evidence_ref: "receipt_completion_operator_workbench_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.taskRows)
    && allPass(context.remediationRows)
    && allPass(context.evidenceRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P22400 source is ready for P22401", context.sourceState.sourceReady],
    ["workbench_tasks_visible", "Operator workbench task queue is visible", allPass(context.taskRows)],
    ["remediation_drafts_visible", "Remediation plan drafts are visible", allPass(context.remediationRows)],
    ["evidence_requests_visible", "Evidence request packets are visible", allPass(context.evidenceRows)],
    ["review_router_visible", "Review escalation router is visible", allPass(context.reviewRows)],
    ["no_apply_boundary_closed", "No-apply boundary remains closed", allPass(context.boundaryRows)],
    ["p22801_handoff_gate", "P22801 handoff opens only when operator workbench readiness conditions pass", handoffReady],
    ["p22801_handoff_blocker_visible", "P22801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p22800_checkpoint.${id}`,
    category: "p22800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p22800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const openTaskCount = context.taskRows.filter((item) => item.task_state === "task_open_read_only").length;
  const p22800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.taskRows)
    && allPass(context.remediationRows)
    && allPass(context.evidenceRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p22800_checkpoint.p22801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.taskRows)
    && allPass(context.remediationRows)
    && allPass(context.evidenceRows)
    && allPass(context.reviewRows)
    && allPass(context.boundaryRows);
  return {
    p22800_contract_ready: p22800ContractReady,
    ready_for_p22801_handoff: handoffReady,
    source_p22400_ready_for_p22401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    operator_workbench_task_queue_visible_now: allPass(context.taskRows),
    remediation_plan_drafts_visible_now: allPass(context.remediationRows),
    evidence_request_packets_visible_now: allPass(context.evidenceRows),
    review_escalation_router_visible_now: allPass(context.reviewRows),
    no_apply_boundary_closed_now: allPass(context.boundaryRows),
    workbench_task_count: context.taskRows.length,
    open_read_only_task_count: openTaskCount,
    remediation_plan_count: context.remediationRows.length,
    evidence_request_count: context.evidenceRows.length,
    review_router_count: context.reviewRows.length,
    ...Object.fromEntries(WORKBENCH_EXTRA_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P22401-P22800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P22401-P22800 Receipt Completion Operator Workbench"), "Architecture doc missing P22401-P22800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P22400 source state is not visible"),
    validationItem("workbench.tasks", "workbench", allPass(context.taskRows), "Operator workbench task rows are missing"),
    validationItem("remediation.advisory_only", "remediation", context.remediationRows.every((item) => item.remediation_apply_allowed_now === false && item.artifact_write_allowed_now === false), "Remediation draft opened apply or write"),
    validationItem("evidence.no_raw", "evidence", context.evidenceRows.every((item) => item.raw_stdout_allowed_now === false && item.full_transcript_allowed_now === false), "Raw evidence request opened"),
    validationItem("review.conditional", "review", context.reviewRows.every((item) => item.final_authority_granted_now === false), "Review router opened final authority"),
    validationItem("boundary.no_apply", "authority", context.boundary.remediation_apply_allowed_now === false && context.boundary.operator_merge_allowed_now === false, "Apply or merge opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p22800_checkpoint.p22801_handoff_blocker_visible"), "P22800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_completion_operator_workbench.contract.v1",
    generated_at: generatedAt,
    source_p22400_required_or_rebuilt: true,
    workbench_task_queue_required: true,
    remediation_plan_drafts_advisory_only: true,
    evidence_request_packets_required: true,
    p22801_handoff_is_not_receipt_completion_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p22801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p22800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_completion_operator_workbench_status: status,
    source_p22400_ready_for_p22401_handoff: boundary.source_p22400_ready_for_p22401_handoff,
    workbench_task_count: boundary.workbench_task_count,
    open_read_only_task_count: boundary.open_read_only_task_count,
    remediation_plan_count: boundary.remediation_plan_count,
    evidence_request_count: boundary.evidence_request_count,
    ready_for_p22801_handoff: validation.valid && boundary.ready_for_p22801_handoff,
    remediation_apply_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Completion Operator Workbench",
    "",
    `Status: ${result.summary.receipt_completion_operator_workbench_status}`,
    `Program: ${result.program_range}`,
    `P22400 ready for P22401 handoff: ${result.summary.source_p22400_ready_for_p22401_handoff}`,
    `Workbench task count: ${result.summary.workbench_task_count}`,
    `Open read-only task count: ${result.summary.open_read_only_task_count}`,
    `Remediation apply allowed: ${result.summary.remediation_apply_allowed_now}`,
    `Ready for P22801 handoff: ${result.summary.ready_for_p22801_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_workbench_task_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.receipt_type)}</td><td>${escapeHtml(item.task_state)}</td><td>${escapeHtml(item.next_action)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Completion Operator Workbench</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Receipt Completion Operator Workbench</h1>
    <p class="notice">This artifact exposes read-only remediation tasks and evidence requests. It does not apply fixes, write artifacts, or grant final authority.</p>
    <table><thead><tr><th>Task Row</th><th>Receipt Type</th><th>State</th><th>Next Action</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP22400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildValidationReceiptCompletionReconciliation({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.validation_receipt_completion_reconciliation", built);
}

function extractReceiptTypes(source) {
  const rows = Array.isArray(source.data?.receipt_completion_gap_ledger_rows)
    ? source.data.receipt_completion_gap_ledger_rows
    : [];
  const types = rows.map((item) => String(item.receipt_type ?? "")).filter(Boolean);
  return types.length > 0 ? types : FALLBACK_RECEIPT_TYPES;
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, text: JSON.stringify(value), data: value };
  return { path: label, available: false, text: "", data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_RECEIPT_COMPLETION_OPERATOR_WORKBENCH_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_validation_receipt_completion_reconciliation_path: path.resolve(repoRoot, options.sourceValidationReceiptCompletionReconciliationPath ?? defaults.sourceValidationReceiptCompletionReconciliationPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceValidationReceiptCompletionReconciliationPath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function row(rowData) {
  const observed = Boolean(rowData.observed);
  return {
    ...rowData,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${rowData.label} is missing or blocked.`,
  };
}

function validationItem(itemId, category, ok, message) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message: ok ? "ok" : message,
    evidence_ref: itemId,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  return allPass(rows) || rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function protectedBoundaryClosed(boundary) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, rows };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
