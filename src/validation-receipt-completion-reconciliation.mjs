import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildValidationReceiptCandidateQueue } from "./validation-receipt-candidate-queue.mjs";

export const DEFAULT_VALIDATION_RECEIPT_COMPLETION_RECONCILIATION_OUT_DIR = "artifacts/validation-receipt-completion-reconciliation/latest";
export const DEFAULT_VALIDATION_RECEIPT_COMPLETION_RECONCILIATION_INPUTS = {
  schemaPath: "schemas/validation-receipt-completion-reconciliation.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p22001-p22400.md",
  architectureDocPath: "docs/architecture.md",
  sourceValidationReceiptCandidateQueuePath: "artifacts/validation-receipt-candidate-queue/latest/validation-receipt-candidate-queue.json",
};

const COMMAND_NAME = "platform:validation-receipt-completion-reconciliation";
const SCHEMA_VERSION = "validation-receipt-completion-reconciliation.v1";
const CAPABILITY_ID = "platform.validation_receipt_completion_reconciliation";
const PROGRAM_RANGE = "P22001-P22400";
const SOURCE_PROGRAM_RANGE = "P21601-P22000";
const READY_STATUS = "ready_for_validation_receipt_completion_reconciliation";
const BLOCK_PENDING_STATUS = "valid_block_validation_receipt_completion_reconciliation_pending";
const BLOCKED_STATUS = "blocked_validation_receipt_completion_reconciliation";

const PHASE_SPECS = [
  ["P22001-P22040", "P22000 Source Binding", "p22000_source_binding_rows"],
  ["P22041-P22120", "Receipt Completion Gap Ledger", "receipt_completion_gap_ledger_rows"],
  ["P22121-P22200", "Digest Integrity Guard", "digest_integrity_guard_rows"],
  ["P22201-P22280", "Acceptance Reconciliation", "acceptance_reconciliation_rows"],
  ["P22281-P22340", "Operator Completion Index", "operator_completion_index_rows"],
  ["P22341-P22380", "No-Completion Finality Boundary", "no_completion_finality_boundary_rows"],
  ["P22381-P22400", "P22400 Clean Checkpoint", "p22400_clean_checkpoint_rows"],
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

const COMPLETION_EXTRA_FALSE_FLAGS = [
  "command_execution_allowed_now",
  "raw_stdout_capture_allowed_now",
  "raw_stderr_capture_allowed_now",
  "raw_secret_material_allowed_now",
  "receipt_completion_claim_allowed_now",
  "receipt_completion_accepted_now",
  "completion_reconciliation_final_now",
  "operator_completion_apply_allowed_now",
  "verifier_finality_allowed_now",
  "operator_merge_allowed_now",
];

export async function runValidationReceiptCompletionReconciliation(options = {}) {
  const result = await buildValidationReceiptCompletionReconciliation(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Validation Receipt Completion Reconciliation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeValidationReceiptCompletionReconciliation(result, result.output_dir);
  return result;
}

export async function buildValidationReceiptCompletionReconciliation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VALIDATION_RECEIPT_COMPLETION_RECONCILIATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "validationReceiptCandidateQueue")
    ? normalizeInlineJsonSource("inline.validation_receipt_candidate_queue", options.validationReceiptCandidateQueue)
    : await readJsonOrBuildP22000(inputs.source_validation_receipt_candidate_queue_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const receiptTypes = extractReceiptTypes(source);
  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const gapRows = buildGapRows({ source, receiptTypes, generatedAt });
  const digestRows = buildDigestRows({ gapRows, generatedAt });
  const acceptanceRows = buildAcceptanceRows({ gapRows, generatedAt });
  const operatorRows = buildOperatorRows({ gapRows, acceptanceRows, generatedAt });
  const boundaryRows = buildNoCompletionFinalityRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, gapRows, digestRows, acceptanceRows, operatorRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, gapRows, digestRows, acceptanceRows, operatorRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, gapRows, digestRows, acceptanceRows, operatorRows, boundaryRows, checkpointRows, boundary });
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
      validation_receipt_candidate_queue_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_validation_receipt_candidate_queue_summary: source.data?.summary ?? null,
    validation_receipt_completion_reconciliation_contract: buildContract(generatedAt),
    validation_receipt_completion_reconciliation_phase_rows: phaseRows,
    p22000_source_binding_rows: sourceRows,
    receipt_completion_gap_ledger_rows: gapRows,
    digest_integrity_guard_rows: digestRows,
    acceptance_reconciliation_rows: acceptanceRows,
    operator_completion_index_rows: operatorRows,
    no_completion_finality_boundary_rows: boundaryRows,
    p22400_clean_checkpoint_rows: checkpointRows,
    validation_receipt_completion_reconciliation_boundary: boundary,
    validation_receipt_completion_reconciliation_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "validation_receipt_completion_reconciliation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_receipt_completion_reconciliation_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_receipt_completion_reconciliation_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeValidationReceiptCompletionReconciliation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "validation-receipt-completion-reconciliation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p22000-source-binding-rows.json"), collectionEnvelope("p22000-source-binding-rows.v1", "p22000_source_binding_rows", result.p22000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-completion-gap-ledger-rows.json"), collectionEnvelope("receipt-completion-gap-ledger-rows.v1", "receipt_completion_gap_ledger_rows", result.receipt_completion_gap_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "digest-integrity-guard-rows.json"), collectionEnvelope("digest-integrity-guard-rows.v1", "digest_integrity_guard_rows", result.digest_integrity_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "acceptance-reconciliation-rows.json"), collectionEnvelope("acceptance-reconciliation-rows.v1", "acceptance_reconciliation_rows", result.acceptance_reconciliation_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-completion-index-rows.json"), collectionEnvelope("operator-completion-index-rows.v1", "operator_completion_index_rows", result.operator_completion_index_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-completion-finality-boundary-rows.json"), collectionEnvelope("no-completion-finality-boundary-rows.v1", "no_completion_finality_boundary_rows", result.no_completion_finality_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p22400-clean-checkpoint-rows.json"), collectionEnvelope("p22400-clean-checkpoint-rows.v1", "p22400_clean_checkpoint_rows", result.p22400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-receipt-completion-reconciliation-boundary.json"), result.validation_receipt_completion_reconciliation_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runValidationReceiptCompletionReconciliationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runValidationReceiptCompletionReconciliation(args);
  console.log(`Validation Receipt Completion Reconciliation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.validation_receipt_completion_reconciliation_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P22000 ready for P22001 handoff: ${result.summary.source_p22000_ready_for_p22001_handoff}`);
  console.log(`Completion item count: ${result.summary.completion_item_count}`);
  console.log(`Completion gap count: ${result.summary.completion_gap_count}`);
  console.log(`Completion accepted count: ${result.summary.completion_accepted_count}`);
  console.log(`Ready for P22401 handoff: ${result.summary.ready_for_p22401_handoff}`);
  console.log(`Receipt completion claim allowed: ${result.summary.receipt_completion_claim_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.validation_receipt_candidate_queue_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p22001_handoff === true,
    status: summary.validation_receipt_candidate_queue_status ?? "missing",
    p22000ContractReady: boundary.p22000_contract_ready === true,
    candidateQueueVisible: boundary.candidate_queue_visible_now === true,
    digestIndexVisible: boundary.digest_redaction_index_visible_now === true,
    acceptanceMatrixVisible: boundary.acceptance_decision_matrix_visible_now === true,
    operatorIndexVisible: boundary.operator_verification_index_visible_now === true,
    noFinalityClosed: boundary.no_finality_boundary_closed_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p22001-p22400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P22000 validation receipt candidate queue source is available", sourceState.available],
    ["program_range", "P22000 source program range is P21601-P22000", sourceState.programRangeOk],
    ["validation_valid", "P22000 source validation is valid", sourceState.validationValid],
    ["p22001_handoff_open", "P22000 source opened P22001 handoff", sourceState.sourceReady],
    ["p22000_contract_ready", "P22000 source contract is ready", sourceState.p22000ContractReady],
    ["candidate_queue_visible", "P22000 candidate queue is visible", sourceState.candidateQueueVisible],
    ["digest_index_visible", "P22000 digest index is visible", sourceState.digestIndexVisible],
    ["acceptance_matrix_visible", "P22000 acceptance matrix is visible", sourceState.acceptanceMatrixVisible],
    ["operator_index_visible", "P22000 operator verification index is visible", sourceState.operatorIndexVisible],
    ["no_finality_closed", "P22000 no-finality boundary is closed", sourceState.noFinalityClosed],
    ["commit_ref_present", "Current commit ref is present for completion reconciliation", Boolean(commitRef)],
    ["source_blocker_visible", "P22000 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p22000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildGapRows({ source, receiptTypes, generatedAt }) {
  const candidateRows = Array.isArray(source.data?.receipt_candidate_metadata_rows)
    ? source.data.receipt_candidate_metadata_rows
    : [];
  return receiptTypes.map((receiptType, index) => {
    const candidate = candidateRows.find((item) => item.receipt_type === receiptType) ?? {};
    const candidatePresent = candidate.candidate_present_now === true;
    const candidateAccepted = candidate.candidate_payload_accepted_now === true;
    return row({
      row_id: `completion_gap.${receiptType}`,
      category: "receipt_completion_gap_ledger",
      label: `Completion gap for ${receiptType}`,
      observed: true,
      evidence_ref: candidate.row_id ?? "receipt_candidate_metadata_rows",
      receipt_type: receiptType,
      completion_order: index + 1,
      candidate_present_now: candidatePresent,
      candidate_payload_accepted_now: candidateAccepted,
      completion_claimed_now: false,
      completion_accepted_now: false,
      completion_gap_visible_now: !candidatePresent || !candidateAccepted,
      completion_state: candidatePresent && candidateAccepted ? "candidate_review_pending" : "completion_gap_visible",
      generated_at: generatedAt,
    });
  });
}

function buildDigestRows({ gapRows, generatedAt }) {
  return gapRows.map((item) => row({
    row_id: `digest_integrity.${item.receipt_type}`,
    category: "digest_integrity_guard",
    label: `Digest integrity guard for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    hash_required: true,
    redacted_summary_ref_required: true,
    evidence_ref_required: true,
    source_commit_ref_required: true,
    command_id_required: true,
    freshness_window_required: true,
    raw_stdout_allowed_now: false,
    raw_stderr_allowed_now: false,
    raw_secret_material_allowed_now: false,
    full_transcript_allowed_now: false,
    integrity_state: "digest_requirements_visible",
    generated_at: generatedAt,
  }));
}

function buildAcceptanceRows({ gapRows, generatedAt }) {
  return gapRows.map((item) => row({
    row_id: `acceptance_reconciliation.${item.receipt_type}`,
    category: "acceptance_reconciliation",
    label: `Acceptance reconciliation for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    candidate_present_now: item.candidate_present_now,
    candidate_payload_accepted_now: item.candidate_payload_accepted_now,
    completion_claimed_now: false,
    completion_accepted_now: false,
    reconciliation_complete_now: false,
    final_authority_granted_now: false,
    reconciliation_state: "completion_gap_blocks_reconciliation",
    generated_at: generatedAt,
  }));
}

function buildOperatorRows({ gapRows, acceptanceRows, generatedAt }) {
  const rows = gapRows.map((item, index) => {
    const acceptance = acceptanceRows.find((rowItem) => rowItem.receipt_type === item.receipt_type);
    return row({
      row_id: `operator_completion.${item.receipt_type}`,
      category: "operator_completion_index",
      label: `Operator completion index for ${item.receipt_type}`,
      observed: true,
      evidence_ref: acceptance?.row_id ?? item.row_id,
      receipt_type: item.receipt_type,
      completion_order: index + 1,
      completion_state: item.completion_gap_visible_now ? "completion_gap_visible" : "completion_review_pending",
      next_action: item.completion_gap_visible_now ? "provide_redacted_receipt_candidate" : "review_digest_integrity",
      completion_apply_allowed_now: false,
      final_approval_allowed_now: false,
      generated_at: generatedAt,
    });
  });
  rows.push(row({
    row_id: "operator_completion.blocker_visibility",
    category: "operator_completion_index",
    label: "Operator completion blocker remains visible while receipt completion is not reconciled",
    observed: true,
    evidence_ref: "operator_completion_index_rows",
    completion_state: "blocker_visible",
    completion_apply_allowed_now: false,
    final_approval_allowed_now: false,
    generated_at: generatedAt,
  }));
  return rows;
}

function buildNoCompletionFinalityRows(generatedAt) {
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
    ...COMPLETION_EXTRA_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
  ].map(([flag, label]) => row({
    row_id: `no_completion_finality.${flag}`,
    category: "no_completion_finality_boundary",
    label,
    observed: true,
    evidence_ref: "validation_receipt_completion_reconciliation_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.gapRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_completion.blocker_visibility")
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P22000 source is ready for P22001", context.sourceState.sourceReady],
    ["gap_ledger_visible", "Receipt completion gap ledger is visible", allPass(context.gapRows)],
    ["digest_guard_visible", "Digest integrity guard is visible", allPass(context.digestRows)],
    ["acceptance_reconciliation_visible", "Acceptance reconciliation is visible", allPass(context.acceptanceRows)],
    ["operator_completion_index_visible", "Operator completion index is visible", visibleOrPassed(context.operatorRows, "operator_completion.blocker_visibility")],
    ["no_completion_finality_boundary_closed", "No-completion finality boundary remains closed", allPass(context.boundaryRows)],
    ["p22401_handoff_gate", "P22401 handoff opens only when completion reconciliation readiness conditions pass", handoffReady],
    ["p22401_handoff_blocker_visible", "P22401 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p22400_checkpoint.${id}`,
    category: "p22400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p22400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const completionGapCount = context.gapRows.filter((item) => item.completion_gap_visible_now).length;
  const p22400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.gapRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_completion.blocker_visibility")
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p22400_checkpoint.p22401_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.gapRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_completion.blocker_visibility")
    && allPass(context.boundaryRows);
  return {
    p22400_contract_ready: p22400ContractReady,
    ready_for_p22401_handoff: handoffReady,
    source_p22000_ready_for_p22001_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    completion_gap_ledger_visible_now: allPass(context.gapRows),
    digest_integrity_guard_visible_now: allPass(context.digestRows),
    acceptance_reconciliation_visible_now: allPass(context.acceptanceRows),
    operator_completion_index_visible_now: visibleOrPassed(context.operatorRows, "operator_completion.blocker_visibility"),
    no_completion_finality_boundary_closed_now: allPass(context.boundaryRows),
    completion_item_count: context.gapRows.length,
    completion_gap_count: completionGapCount,
    completion_claimed_count: context.gapRows.filter((item) => item.completion_claimed_now).length,
    completion_accepted_count: context.gapRows.filter((item) => item.completion_accepted_now).length,
    digest_guard_count: context.digestRows.length,
    acceptance_reconciliation_count: context.acceptanceRows.length,
    operator_completion_index_count: context.operatorRows.length,
    ...Object.fromEntries(COMPLETION_EXTRA_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P22001-P22400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P22001-P22400 Validation Receipt Completion Reconciliation Readiness"), "Architecture doc missing P22001-P22400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P22000 source state is not visible"),
    validationItem("gap.ledger", "completion", allPass(context.gapRows), "Completion gap ledger rows are missing"),
    validationItem("digest.no_raw", "digest", context.digestRows.every((item) => item.raw_stdout_allowed_now === false && item.raw_stderr_allowed_now === false && item.full_transcript_allowed_now === false), "Raw digest capture opened"),
    validationItem("acceptance.no_completion_claim", "acceptance", context.acceptanceRows.every((item) => item.completion_claimed_now === false && item.final_authority_granted_now === false), "Acceptance reconciliation opened completion or finality"),
    validationItem("operator.gap_visible", "operator", context.operatorRows.some((item) => item.completion_state === "completion_gap_visible"), "Completion gap state is not visible"),
    validationItem("boundary.no_completion_finality", "authority", context.boundary.receipt_completion_claim_allowed_now === false && context.boundary.completion_reconciliation_final_now === false, "Completion finality opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p22400_checkpoint.p22401_handoff_blocker_visible"), "P22400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "validation_receipt_completion_reconciliation.contract.v1",
    generated_at: generatedAt,
    source_p22000_required_or_rebuilt: true,
    completion_gap_ledger_required: true,
    digest_integrity_guard_required: true,
    acceptance_reconciliation_required: true,
    p22401_handoff_is_not_receipt_completion_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p22401_handoff
    ? READY_STATUS
    : validation.valid && boundary.p22400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    validation_receipt_completion_reconciliation_status: status,
    source_p22000_ready_for_p22001_handoff: boundary.source_p22000_ready_for_p22001_handoff,
    completion_item_count: boundary.completion_item_count,
    completion_gap_count: boundary.completion_gap_count,
    completion_claimed_count: boundary.completion_claimed_count,
    completion_accepted_count: boundary.completion_accepted_count,
    ready_for_p22401_handoff: validation.valid && boundary.ready_for_p22401_handoff,
    receipt_completion_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Validation Receipt Completion Reconciliation",
    "",
    `Status: ${result.summary.validation_receipt_completion_reconciliation_status}`,
    `Program: ${result.program_range}`,
    `P22000 ready for P22001 handoff: ${result.summary.source_p22000_ready_for_p22001_handoff}`,
    `Completion item count: ${result.summary.completion_item_count}`,
    `Completion gap count: ${result.summary.completion_gap_count}`,
    `Completion accepted count: ${result.summary.completion_accepted_count}`,
    `Ready for P22401 handoff: ${result.summary.ready_for_p22401_handoff}`,
    `Receipt completion claim allowed: ${result.summary.receipt_completion_claim_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_completion_index_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.receipt_type)}</td><td>${escapeHtml(item.completion_state)}</td><td>${escapeHtml(item.next_action)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Validation Receipt Completion Reconciliation</title>
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
    <h1>Hermes Validation Receipt Completion Reconciliation</h1>
    <p class="notice">This artifact exposes receipt completion gaps and digest integrity requirements. It does not claim completion, final approval, or protected authority.</p>
    <table><thead><tr><th>Completion Row</th><th>Receipt Type</th><th>State</th><th>Next Action</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP22000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildValidationReceiptCandidateQueue({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.validation_receipt_candidate_queue", built);
}

function extractReceiptTypes(source) {
  const rows = Array.isArray(source.data?.receipt_candidate_metadata_rows)
    ? source.data.receipt_candidate_metadata_rows
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
  const defaults = DEFAULT_VALIDATION_RECEIPT_COMPLETION_RECONCILIATION_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_validation_receipt_candidate_queue_path: path.resolve(repoRoot, options.sourceValidationReceiptCandidateQueuePath ?? defaults.sourceValidationReceiptCandidateQueuePath),
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
      args.sourceValidationReceiptCandidateQueuePath = argv[++index];
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
