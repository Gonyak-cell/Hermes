import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildValidationEvidenceReceiptIntake } from "./validation-evidence-receipt-intake.mjs";

export const DEFAULT_VALIDATION_RECEIPT_CANDIDATE_QUEUE_OUT_DIR = "artifacts/validation-receipt-candidate-queue/latest";
export const DEFAULT_VALIDATION_RECEIPT_CANDIDATE_QUEUE_INPUTS = {
  schemaPath: "schemas/validation-receipt-candidate-queue.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p21601-p22000.md",
  architectureDocPath: "docs/architecture.md",
  sourceValidationEvidenceReceiptIntakePath: "artifacts/validation-evidence-receipt-intake/latest/validation-evidence-receipt-intake.json",
};

const COMMAND_NAME = "platform:validation-receipt-candidate-queue";
const SCHEMA_VERSION = "validation-receipt-candidate-queue.v1";
const CAPABILITY_ID = "platform.validation_receipt_candidate_queue";
const PROGRAM_RANGE = "P21601-P22000";
const SOURCE_PROGRAM_RANGE = "P21201-P21600";
const READY_STATUS = "ready_for_validation_receipt_candidate_queue";
const BLOCK_PENDING_STATUS = "valid_block_validation_receipt_candidate_queue_pending";
const BLOCKED_STATUS = "blocked_validation_receipt_candidate_queue";

const PHASE_SPECS = [
  ["P21601-P21640", "P21600 Source Binding", "p21600_source_binding_rows"],
  ["P21641-P21720", "Receipt Candidate Metadata Queue", "receipt_candidate_metadata_rows"],
  ["P21721-P21800", "Result Digest Redaction Index", "result_digest_redaction_index_rows"],
  ["P21801-P21880", "Acceptance Decision Matrix", "acceptance_decision_matrix_rows"],
  ["P21881-P21940", "Operator Verification Index", "operator_verification_index_rows"],
  ["P21941-P21980", "No-Finality Boundary", "no_finality_boundary_rows"],
  ["P21981-P22000", "P22000 Clean Checkpoint", "p22000_clean_checkpoint_rows"],
];

const FALLBACK_RECEIPT_SPECS = [
  ["syntax_check", "Syntax check evidence receipt", "required_now"],
  ["targeted_tests", "Targeted test evidence receipt", "required_now"],
  ["adjacent_tests", "Adjacent regression evidence receipt", "required_when_contract_linked"],
  ["platform_cli_check", "Platform CLI check evidence receipt", "required_now"],
  ["diff_check", "Git diff hygiene evidence receipt", "required_now"],
  ["full_npm_test", "Full npm test evidence receipt", "required_when_broad_freeze_or_explicit_closeout"],
  ["claude_review", "Claude Code Opus max review receipt", "required_when_high_risk_transition"],
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

const NO_FINALITY_EXTRA_FALSE_FLAGS = [
  "command_execution_allowed_now",
  "raw_stdout_capture_allowed_now",
  "raw_stderr_capture_allowed_now",
  "raw_secret_material_allowed_now",
  "receipt_completion_claim_allowed_now",
  "receipt_candidate_auto_accept_allowed_now",
  "verifier_finality_allowed_now",
  "operator_merge_allowed_now",
];

export async function runValidationReceiptCandidateQueue(options = {}) {
  const result = await buildValidationReceiptCandidateQueue(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Validation Receipt Candidate Queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeValidationReceiptCandidateQueue(result, result.output_dir);
  return result;
}

export async function buildValidationReceiptCandidateQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VALIDATION_RECEIPT_CANDIDATE_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "validationEvidenceReceiptIntake")
    ? normalizeInlineJsonSource("inline.validation_evidence_receipt_intake", options.validationEvidenceReceiptIntake)
    : await readJsonOrBuildP21600(inputs.source_validation_evidence_receipt_intake_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const receiptSpecs = extractReceiptSpecs(source);
  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const candidateRows = buildCandidateRows({ receiptSpecs, generatedAt });
  const digestRows = buildDigestRows({ candidateRows, generatedAt });
  const acceptanceRows = buildAcceptanceRows({ candidateRows, generatedAt });
  const operatorRows = buildOperatorRows({ candidateRows, acceptanceRows, generatedAt });
  const boundaryRows = buildNoFinalityRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, candidateRows, digestRows, acceptanceRows, operatorRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, candidateRows, digestRows, acceptanceRows, operatorRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, candidateRows, digestRows, acceptanceRows, operatorRows, boundaryRows, checkpointRows, boundary });
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
      validation_evidence_receipt_intake_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_validation_evidence_receipt_intake_summary: source.data?.summary ?? null,
    validation_receipt_candidate_queue_contract: buildContract(generatedAt),
    validation_receipt_candidate_queue_phase_rows: phaseRows,
    p21600_source_binding_rows: sourceRows,
    receipt_candidate_metadata_rows: candidateRows,
    result_digest_redaction_index_rows: digestRows,
    acceptance_decision_matrix_rows: acceptanceRows,
    operator_verification_index_rows: operatorRows,
    no_finality_boundary_rows: boundaryRows,
    p22000_clean_checkpoint_rows: checkpointRows,
    validation_receipt_candidate_queue_boundary: boundary,
    validation_receipt_candidate_queue_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "validation_receipt_candidate_queue")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_receipt_candidate_queue_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_receipt_candidate_queue_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeValidationReceiptCandidateQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "validation-receipt-candidate-queue.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p21600-source-binding-rows.json"), collectionEnvelope("p21600-source-binding-rows.v1", "p21600_source_binding_rows", result.p21600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-candidate-metadata-rows.json"), collectionEnvelope("receipt-candidate-metadata-rows.v1", "receipt_candidate_metadata_rows", result.receipt_candidate_metadata_rows, result.generated_at));
  await writeJson(path.join(outDir, "result-digest-redaction-index-rows.json"), collectionEnvelope("result-digest-redaction-index-rows.v1", "result_digest_redaction_index_rows", result.result_digest_redaction_index_rows, result.generated_at));
  await writeJson(path.join(outDir, "acceptance-decision-matrix-rows.json"), collectionEnvelope("acceptance-decision-matrix-rows.v1", "acceptance_decision_matrix_rows", result.acceptance_decision_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-verification-index-rows.json"), collectionEnvelope("operator-verification-index-rows.v1", "operator_verification_index_rows", result.operator_verification_index_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-finality-boundary-rows.json"), collectionEnvelope("no-finality-boundary-rows.v1", "no_finality_boundary_rows", result.no_finality_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p22000-clean-checkpoint-rows.json"), collectionEnvelope("p22000-clean-checkpoint-rows.v1", "p22000_clean_checkpoint_rows", result.p22000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-receipt-candidate-queue-boundary.json"), result.validation_receipt_candidate_queue_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runValidationReceiptCandidateQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runValidationReceiptCandidateQueue(args);
  console.log(`Validation Receipt Candidate Queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.validation_receipt_candidate_queue_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P21600 ready for P21601 handoff: ${result.summary.source_p21600_ready_for_p21601_handoff}`);
  console.log(`Candidate slots: ${result.summary.candidate_slot_count}`);
  console.log(`Missing candidates visible: ${result.summary.missing_candidate_count}`);
  console.log(`Accepted candidates: ${result.summary.accepted_candidate_count}`);
  console.log(`Ready for P22001 handoff: ${result.summary.ready_for_p22001_handoff}`);
  console.log(`Final automated approval allowed: ${result.summary.final_automated_approval_allowed}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.validation_evidence_receipt_intake_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p21601_handoff === true,
    status: summary.validation_evidence_receipt_intake_status ?? "missing",
    p21600ContractReady: boundary.p21600_contract_ready === true,
    receiptIntakeVisible: boundary.receipt_intake_contract_visible_now === true,
    redactedCaptureVisible: boundary.redacted_capture_contract_visible_now === true,
    freshnessGuardVisible: boundary.freshness_completeness_guard_visible_now === true,
    operatorInboxVisible: boundary.operator_evidence_inbox_visible_now === true,
    noExecutionRawClosed: boundary.no_execution_raw_boundary_closed_now === true,
    missingReceiptsVisible: Number(boundary.missing_receipt_count ?? 0) >= 0,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p21601-p22000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P21600 validation evidence receipt intake source is available", sourceState.available],
    ["program_range", "P21600 source program range is P21201-P21600", sourceState.programRangeOk],
    ["validation_valid", "P21600 source validation is valid", sourceState.validationValid],
    ["p21601_handoff_open", "P21600 source opened P21601 handoff", sourceState.sourceReady],
    ["p21600_contract_ready", "P21600 source contract is ready", sourceState.p21600ContractReady],
    ["receipt_intake_visible", "P21600 receipt intake contract is visible", sourceState.receiptIntakeVisible],
    ["redacted_capture_visible", "P21600 redacted capture contract is visible", sourceState.redactedCaptureVisible],
    ["freshness_guard_visible", "P21600 freshness guard is visible", sourceState.freshnessGuardVisible],
    ["operator_inbox_visible", "P21600 operator inbox is visible", sourceState.operatorInboxVisible],
    ["no_execution_raw_closed", "P21600 no-execution/raw boundary is closed", sourceState.noExecutionRawClosed],
    ["commit_ref_present", "Current commit ref is present for candidate queue", Boolean(commitRef)],
    ["source_blocker_visible", "P21600 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p21600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildCandidateRows({ receiptSpecs, generatedAt }) {
  return receiptSpecs.map(([receiptType, label, requirementMode], index) => row({
    row_id: `candidate.${receiptType}`,
    category: "receipt_candidate_metadata",
    label: `Candidate slot for ${label}`,
    observed: true,
    evidence_ref: "receipt_candidate_metadata_rows",
    receipt_type: receiptType,
    requirement_mode: requirementMode,
    candidate_order: index + 1,
    candidate_slot_visible_now: true,
    candidate_present_now: false,
    candidate_payload_accepted_now: false,
    raw_payload_allowed_now: false,
    source_command_id_required: true,
    candidate_state: "candidate_missing_visible",
    generated_at: generatedAt,
  }));
}

function buildDigestRows({ candidateRows, generatedAt }) {
  return candidateRows.map((item) => row({
    row_id: `digest.${item.receipt_type}`,
    category: "result_digest_redaction_index",
    label: `Redacted digest contract for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    hash_required: true,
    redacted_summary_ref_required: true,
    evidence_ref_required: true,
    source_commit_ref_required: true,
    generated_at_required: true,
    raw_stdout_allowed_now: false,
    raw_stderr_allowed_now: false,
    raw_secret_material_allowed_now: false,
    full_transcript_allowed_now: false,
    digest_state: "redacted_digest_contract_visible",
    generated_at: generatedAt,
  }));
}

function buildAcceptanceRows({ candidateRows, generatedAt }) {
  return candidateRows.map((item) => row({
    row_id: `acceptance.${item.receipt_type}`,
    category: "acceptance_decision_matrix",
    label: `Acceptance decision for ${item.receipt_type}`,
    observed: true,
    evidence_ref: item.row_id,
    receipt_type: item.receipt_type,
    candidate_present_now: item.candidate_present_now,
    payload_accepted_now: false,
    rejected_now: false,
    accepted_now: false,
    final_authority_granted_now: false,
    acceptance_state: "missing_candidate_blocks_acceptance",
    generated_at: generatedAt,
  }));
}

function buildOperatorRows({ candidateRows, acceptanceRows, generatedAt }) {
  const rows = candidateRows.map((item, index) => {
    const acceptance = acceptanceRows.find((rowItem) => rowItem.receipt_type === item.receipt_type);
    return row({
      row_id: `operator_verification.${item.receipt_type}`,
      category: "operator_verification_index",
      label: `Operator verification index for ${item.receipt_type}`,
      observed: true,
      evidence_ref: acceptance?.row_id ?? item.row_id,
      receipt_type: item.receipt_type,
      verification_order: index + 1,
      verification_state: item.candidate_present_now ? "candidate_present_review_pending" : "candidate_missing_visible",
      next_action: item.candidate_present_now ? "review_redacted_candidate" : "provide_redacted_receipt_candidate",
      final_approval_allowed_now: false,
      generated_at: generatedAt,
    });
  });
  rows.push(row({
    row_id: "operator_verification.blocker_visibility",
    category: "operator_verification_index",
    label: "Operator verification blocker remains visible while candidates are missing or unaccepted",
    observed: true,
    evidence_ref: "operator_verification_index_rows",
    verification_state: "blocker_visible",
    final_approval_allowed_now: false,
    generated_at: generatedAt,
  }));
  return rows;
}

function buildNoFinalityRows(generatedAt) {
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
    ...NO_FINALITY_EXTRA_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
  ].map(([flag, label]) => row({
    row_id: `no_finality.${flag}`,
    category: "no_finality_boundary",
    label,
    observed: true,
    evidence_ref: "validation_receipt_candidate_queue_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_verification.blocker_visibility")
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P21600 source is ready for P21601", context.sourceState.sourceReady],
    ["candidate_queue_visible", "Receipt candidate metadata queue is visible", allPass(context.candidateRows)],
    ["digest_index_visible", "Result digest redaction index is visible", allPass(context.digestRows)],
    ["acceptance_matrix_visible", "Acceptance decision matrix is visible", allPass(context.acceptanceRows)],
    ["operator_index_visible", "Operator verification index is visible", visibleOrPassed(context.operatorRows, "operator_verification.blocker_visibility")],
    ["no_finality_boundary_closed", "No-finality boundary remains closed", allPass(context.boundaryRows)],
    ["p22001_handoff_gate", "P22001 handoff opens only when candidate queue contract conditions pass", handoffReady],
    ["p22001_handoff_blocker_visible", "P22001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p22000_checkpoint.${id}`,
    category: "p22000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p22000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const missingCandidateCount = context.candidateRows.filter((item) => item.candidate_present_now === false).length;
  const p22000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.candidateRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_verification.blocker_visibility")
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p22000_checkpoint.p22001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.digestRows)
    && allPass(context.acceptanceRows)
    && visibleOrPassed(context.operatorRows, "operator_verification.blocker_visibility")
    && allPass(context.boundaryRows);
  return {
    p22000_contract_ready: p22000ContractReady,
    ready_for_p22001_handoff: handoffReady,
    source_p21600_ready_for_p21601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    candidate_queue_visible_now: allPass(context.candidateRows),
    digest_redaction_index_visible_now: allPass(context.digestRows),
    acceptance_decision_matrix_visible_now: allPass(context.acceptanceRows),
    operator_verification_index_visible_now: visibleOrPassed(context.operatorRows, "operator_verification.blocker_visibility"),
    no_finality_boundary_closed_now: allPass(context.boundaryRows),
    candidate_slot_count: context.candidateRows.length,
    candidate_present_count: context.candidateRows.filter((item) => item.candidate_present_now).length,
    accepted_candidate_count: context.acceptanceRows.filter((item) => item.accepted_now).length,
    missing_candidate_count: missingCandidateCount,
    digest_index_count: context.digestRows.length,
    acceptance_matrix_count: context.acceptanceRows.length,
    operator_verification_index_count: context.operatorRows.length,
    ...Object.fromEntries(NO_FINALITY_EXTRA_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P21601-P22000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P21601-P22000 Validation Receipt Candidate Queue"), "Architecture doc missing P21601-P22000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P21600 source state is not visible"),
    validationItem("candidate.queue", "candidate", allPass(context.candidateRows), "Receipt candidate queue rows are missing"),
    validationItem("digest.no_raw", "digest", context.digestRows.every((item) => item.raw_stdout_allowed_now === false && item.raw_stderr_allowed_now === false && item.full_transcript_allowed_now === false), "Raw digest capture opened"),
    validationItem("acceptance.no_finality", "acceptance", context.acceptanceRows.every((item) => item.accepted_now === false && item.final_authority_granted_now === false), "Acceptance matrix opened finality"),
    validationItem("operator.missing_visible", "operator", context.operatorRows.some((item) => item.verification_state === "candidate_missing_visible"), "Missing candidate state is not visible"),
    validationItem("boundary.no_finality", "authority", context.boundary.final_automated_approval_allowed === false && context.boundary.receipt_candidate_auto_accept_allowed_now === false, "Finality or candidate auto-accept opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p22000_checkpoint.p22001_handoff_blocker_visible"), "P22000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "validation_receipt_candidate_queue.contract.v1",
    generated_at: generatedAt,
    source_p21600_required_or_rebuilt: true,
    receipt_candidate_queue_required: true,
    redacted_digest_index_required: true,
    acceptance_matrix_required: true,
    p22001_handoff_is_not_receipt_completion_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p22001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p22000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    validation_receipt_candidate_queue_status: status,
    source_p21600_ready_for_p21601_handoff: boundary.source_p21600_ready_for_p21601_handoff,
    candidate_slot_count: boundary.candidate_slot_count,
    candidate_present_count: boundary.candidate_present_count,
    accepted_candidate_count: boundary.accepted_candidate_count,
    missing_candidate_count: boundary.missing_candidate_count,
    ready_for_p22001_handoff: validation.valid && boundary.ready_for_p22001_handoff,
    final_automated_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Validation Receipt Candidate Queue",
    "",
    `Status: ${result.summary.validation_receipt_candidate_queue_status}`,
    `Program: ${result.program_range}`,
    `P21600 ready for P21601 handoff: ${result.summary.source_p21600_ready_for_p21601_handoff}`,
    `Candidate slots: ${result.summary.candidate_slot_count}`,
    `Missing candidates visible: ${result.summary.missing_candidate_count}`,
    `Accepted candidates: ${result.summary.accepted_candidate_count}`,
    `Ready for P22001 handoff: ${result.summary.ready_for_p22001_handoff}`,
    `Final automated approval allowed: ${result.summary.final_automated_approval_allowed}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.operator_verification_index_rows.map((item) => `<tr><td>${escapeHtml(item.row_id)}</td><td>${escapeHtml(item.receipt_type)}</td><td>${escapeHtml(item.verification_state)}</td><td>${escapeHtml(item.next_action)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Validation Receipt Candidate Queue</title>
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
    <h1>Hermes Validation Receipt Candidate Queue</h1>
    <p class="notice">This artifact defines receipt candidate slots and redacted digest metadata. Missing candidates remain visible, and no final approval or protected authority is opened.</p>
    <table><thead><tr><th>Verification Row</th><th>Receipt Type</th><th>State</th><th>Next Action</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP21600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildValidationEvidenceReceiptIntake({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.validation_evidence_receipt_intake", built);
}

function extractReceiptSpecs(source) {
  const rows = Array.isArray(source.data?.validation_evidence_receipt_schema_rows)
    ? source.data.validation_evidence_receipt_schema_rows
    : [];
  if (rows.length > 0) {
    return rows.map((item) => [
      String(item.receipt_type ?? item.row_id ?? "unknown_receipt"),
      String(item.label ?? item.receipt_type ?? "Validation receipt"),
      String(item.requirement_mode ?? "required_now"),
    ]);
  }
  return FALLBACK_RECEIPT_SPECS;
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
  const defaults = DEFAULT_VALIDATION_RECEIPT_CANDIDATE_QUEUE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_validation_evidence_receipt_intake_path: path.resolve(repoRoot, options.sourceValidationEvidenceReceiptIntakePath ?? defaults.sourceValidationEvidenceReceiptIntakePath),
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
      args.sourceValidationEvidenceReceiptIntakePath = argv[++index];
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
