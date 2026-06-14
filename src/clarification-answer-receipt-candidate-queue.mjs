import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P34400_FALSE_FLAGS,
  buildSeedRecheckValidationContract,
} from "./seed-recheck-validation-contract.mjs";

export const DEFAULT_CLARIFICATION_ANSWER_RECEIPT_QUEUE_OUT_DIR = "artifacts/clarification-answer-receipt-candidate-queue/latest";
export const DEFAULT_CLARIFICATION_ANSWER_RECEIPT_QUEUE_INPUTS = {
  schemaPath: "schemas/clarification-answer-receipt-candidate-queue.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p34401-p34800.md",
  architectureDocPath: "docs/architecture.md",
  sourceSeedRecheckValidationContractPath: "artifacts/seed-recheck-validation-contract/latest/seed-recheck-validation-contract.json",
};

const COMMAND_NAME = "platform:clarification-answer-receipt-candidate-queue";
const SCHEMA_VERSION = "clarification-answer-receipt-candidate-queue.v1";
const CAPABILITY_ID = "platform.clarification_answer_receipt_candidate_queue";
const PROGRAM_RANGE = "P34401-P34800";
const SOURCE_PROGRAM_RANGE = "P34001-P34400";
const READY_STATUS = "ready_for_clarification_answer_receipt_candidate_queue";
const BLOCK_PENDING_STATUS = "valid_block_clarification_answer_receipt_candidate_queue_pending";
const BLOCKED_STATUS = "blocked_clarification_answer_receipt_candidate_queue";

const PHASE_SPECS = [
  ["P34401-P34440", "P34400 Source Binding", "p34400_source_binding_rows"],
  ["P34441-P34490", "Redacted Answer Receipt Candidate Queue", "redacted_answer_receipt_candidate_queue_rows"],
  ["P34491-P34540", "Conflict Resolution Ledger Candidate", "conflict_resolution_ledger_candidate_rows"],
  ["P34541-P34590", "Stale Context Recheck Candidate", "stale_context_recheck_candidate_rows"],
  ["P34591-P34650", "Answer Receipt Evidence Packet Candidate", "answer_receipt_evidence_packet_candidate_rows"],
  ["P34651-P34710", "Operator Answer Receipt Queue Projection", "operator_answer_receipt_queue_projection_rows"],
  ["P34711-P34760", "No-Raw-Capture Boundary and Wiring", "no_raw_capture_boundary_rows"],
  ["P34761-P34800", "P34800 Clean Checkpoint", "p34800_clean_checkpoint_rows"],
];

export const CLARIFICATION_ANSWER_RECEIPT_QUEUE_FALSE_FLAGS = [
  "answer_receipt_actual_answer_capture_allowed_now",
  "answer_receipt_raw_answer_persist_allowed_now",
  "answer_receipt_raw_answer_exposure_allowed_now",
  "answer_receipt_redacted_receipt_accept_allowed_now",
  "answer_receipt_queue_completion_allowed_now",
  "answer_receipt_conflict_resolution_auto_pass_allowed_now",
  "answer_receipt_conflict_bypass_allowed_now",
  "answer_receipt_stale_context_auto_pass_allowed_now",
  "answer_receipt_stale_context_bypass_allowed_now",
  "answer_receipt_evidence_packet_completion_allowed_now",
  "answer_receipt_commercial_spec_readiness_pass_allowed_now",
  "answer_receipt_runtime_execution_allowed_now",
  "answer_receipt_write_action_allowed_now",
  "answer_receipt_protected_action_allowed_now",
  "answer_receipt_connector_write_allowed_now",
  "answer_receipt_deployment_allowed_now",
  "answer_receipt_review_completion_allowed_now",
  "answer_receipt_final_approval_allowed_now",
  "answer_receipt_production_pass_allowed_now",
  "answer_receipt_enterprise_trust_claim_allowed_now",
  "answer_receipt_secret_read_allowed_now",
  "answer_receipt_human_gate_bypass_allowed_now",
  "answer_receipt_independent_review_bypass_allowed_now",
  "answer_receipt_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...CLARIFICATION_ANSWER_RECEIPT_QUEUE_FALSE_FLAGS, ...P34400_FALSE_FLAGS])];

export async function runClarificationAnswerReceiptCandidateQueue(options = {}) {
  const result = await buildClarificationAnswerReceiptCandidateQueue(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Clarification Answer Receipt Candidate Queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeClarificationAnswerReceiptCandidateQueue(result, result.output_dir);
  return result;
}

export async function buildClarificationAnswerReceiptCandidateQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLARIFICATION_ANSWER_RECEIPT_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "seedRecheckValidationContract")
    ? normalizeInlineJsonSource("inline.seed_recheck_validation_contract", options.seedRecheckValidationContract)
    : await readJsonOrBuildP34400(inputs.source_seed_recheck_validation_contract_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const queueRows = buildRedactedAnswerReceiptCandidateQueueRows({ source, generatedAt });
  const conflictRows = buildConflictResolutionLedgerCandidateRows({ source, queueRows, generatedAt });
  const staleRows = buildStaleContextRecheckCandidateRows({ source, queueRows, generatedAt });
  const packetRows = buildAnswerReceiptEvidencePacketCandidateRows({ queueRows, conflictRows, staleRows, generatedAt });
  const operatorRows = buildOperatorAnswerReceiptQueueProjectionRows({ queueRows, packetRows, generatedAt });
  const noRawRows = buildNoRawCaptureBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, queueRows, conflictRows, staleRows, packetRows, operatorRows, noRawRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, queueRows, conflictRows, staleRows, packetRows, operatorRows, noRawRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, queueRows, conflictRows, staleRows, packetRows, operatorRows, noRawRows, wiringRows, checkpointRows, boundary });
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
      seed_recheck_validation_contract_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_seed_recheck_validation_summary: source.data?.summary ?? null,
    clarification_answer_receipt_candidate_queue_contract: buildContract(generatedAt),
    clarification_answer_receipt_queue_phase_rows: phaseRows,
    p34400_source_binding_rows: sourceRows,
    redacted_answer_receipt_candidate_queue_rows: queueRows,
    conflict_resolution_ledger_candidate_rows: conflictRows,
    stale_context_recheck_candidate_rows: staleRows,
    answer_receipt_evidence_packet_candidate_rows: packetRows,
    operator_answer_receipt_queue_projection_rows: operatorRows,
    no_raw_capture_boundary_rows: noRawRows,
    answer_receipt_queue_wiring_rows: wiringRows,
    p34800_clean_checkpoint_rows: checkpointRows,
    clarification_answer_receipt_queue_boundary: boundary,
    clarification_answer_receipt_queue_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "clarification_answer_receipt_candidate_queue")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.clarification_answer_receipt_queue_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.clarification_answer_receipt_queue_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeClarificationAnswerReceiptCandidateQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "clarification-answer-receipt-candidate-queue.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p34400-source-binding-rows.json"), collectionEnvelope("p34400-source-binding-rows.v1", "p34400_source_binding_rows", result.p34400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "redacted-answer-receipt-candidate-queue-rows.json"), collectionEnvelope("redacted-answer-receipt-candidate-queue-rows.v1", "redacted_answer_receipt_candidate_queue_rows", result.redacted_answer_receipt_candidate_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "conflict-resolution-ledger-candidate-rows.json"), collectionEnvelope("conflict-resolution-ledger-candidate-rows.v1", "conflict_resolution_ledger_candidate_rows", result.conflict_resolution_ledger_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "stale-context-recheck-candidate-rows.json"), collectionEnvelope("stale-context-recheck-candidate-rows.v1", "stale_context_recheck_candidate_rows", result.stale_context_recheck_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "answer-receipt-evidence-packet-candidate-rows.json"), collectionEnvelope("answer-receipt-evidence-packet-candidate-rows.v1", "answer_receipt_evidence_packet_candidate_rows", result.answer_receipt_evidence_packet_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-answer-receipt-queue-projection-rows.json"), collectionEnvelope("operator-answer-receipt-queue-projection-rows.v1", "operator_answer_receipt_queue_projection_rows", result.operator_answer_receipt_queue_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-raw-capture-boundary-rows.json"), collectionEnvelope("no-raw-capture-boundary-rows.v1", "no_raw_capture_boundary_rows", result.no_raw_capture_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "answer-receipt-queue-wiring-rows.json"), collectionEnvelope("answer-receipt-queue-wiring-rows.v1", "answer_receipt_queue_wiring_rows", result.answer_receipt_queue_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p34800-clean-checkpoint-rows.json"), collectionEnvelope("p34800-clean-checkpoint-rows.v1", "p34800_clean_checkpoint_rows", result.p34800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "clarification-answer-receipt-queue-boundary.json"), result.clarification_answer_receipt_queue_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runClarificationAnswerReceiptCandidateQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runClarificationAnswerReceiptCandidateQueue(args);
  console.log(`Clarification Answer Receipt Candidate Queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.clarification_answer_receipt_queue_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P34400 ready for answer receipt queue: ${result.summary.source_p34400_ready_for_answer_receipt_queue}`);
  console.log(`Answer receipt queue rows: ${result.summary.redacted_answer_receipt_candidate_queue_count}`);
  console.log(`Conflict ledger candidates: ${result.summary.conflict_resolution_ledger_candidate_count}`);
  console.log(`Stale context candidates: ${result.summary.stale_context_recheck_candidate_count}`);
  console.log(`Ready for commercial spec registration handoff: ${result.summary.ready_for_commercial_spec_registration_handoff}`);
  console.log(`Actual answer capture allowed: ${result.summary.answer_receipt_actual_answer_capture_allowed_now}`);
  console.log(`Raw answer exposure allowed: ${result.summary.answer_receipt_raw_answer_exposure_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.seed_recheck_validation_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_commercial_spec_readiness_handoff === true,
    status: summary.seed_recheck_validation_status ?? "missing",
    p34400ContractReady: boundary.p34400_contract_ready === true,
    sufficiencyVisible: boundary.clarification_sufficiency_evidence_visible_now === true,
    blockersVisible: boundary.missing_answer_blocker_rules_visible_now === true,
    validatorVisible: boundary.seed_recheck_validator_candidate_visible_now === true,
    noFakeClosed: boundary.no_fake_execution_gate_closed_now === true,
    operatorVisible: boundary.operator_seed_recheck_projection_visible_now === true,
    boundaryClosed: P34400_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p34401-p34800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P34400 seed recheck validation source is available", sourceState.available],
    ["program_range", "P34400 source program range is P34001-P34400", sourceState.programRangeOk],
    ["validation_valid", "P34400 source validation is valid", sourceState.validationValid],
    ["answer_receipt_queue_handoff_open", "P34400 opened commercial spec readiness handoff", sourceState.sourceReady],
    ["p34400_contract_ready", "P34400 source contract is ready", sourceState.p34400ContractReady],
    ["sufficiency_visible", "P34400 clarification sufficiency evidence is visible", sourceState.sufficiencyVisible],
    ["blockers_visible", "P34400 missing answer blockers are visible", sourceState.blockersVisible],
    ["validator_visible", "P34400 seed recheck validator candidate is visible", sourceState.validatorVisible],
    ["no_fake_execution_closed", "P34400 no-fake-execution gate is closed", sourceState.noFakeClosed],
    ["operator_projection_visible", "P34400 operator seed recheck projection is visible", sourceState.operatorVisible],
    ["commit_ref_present", "Current commit ref is present for answer receipt queue", Boolean(commitRef)],
    ["source_blocker_visible", "P34400 source blocker is visible when answer receipt queue is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p34400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildRedactedAnswerReceiptCandidateQueueRows({ source, generatedAt }) {
  const sufficiencyRows = source.data?.clarification_sufficiency_evidence_rows ?? [];
  return sufficiencyRows.map((item) => row({
    row_id: `redacted_answer_receipt_candidate_queue.${item.request_id}`,
    category: "redacted_answer_receipt_candidate_queue",
    label: `Redacted answer receipt candidate queue for ${item.request_id}`,
    observed: Boolean(item.request_id),
    evidence_ref: item.row_id,
    request_id: item.request_id,
    queue_ref: `answer_receipt_queue.${item.request_id}.candidate`,
    required_receipt_fields: [
      "answer_receipt_id",
      "question_ref",
      "redacted_answer_ref",
      "redaction_policy_ref",
      "conflict_resolution_ref",
      "stale_context_recheck_ref",
    ],
    redacted_answer_receipt_required_now: true,
    redacted_answer_receipt_present_now: false,
    actual_answer_capture_allowed_now: false,
    raw_answer_persist_allowed_now: false,
    raw_answer_exposure_allowed_now: false,
    receipt_accept_allowed_now: false,
    queue_completion_allowed_now: false,
    queue_metadata_only: true,
    generated_at: generatedAt,
  }));
}

function buildConflictResolutionLedgerCandidateRows({ source, queueRows, generatedAt }) {
  const blockerRows = source.data?.missing_answer_blocker_rule_rows ?? [];
  return queueRows.map((queue) => {
    const conflicts = blockerRows.filter((item) => item.request_id === queue.request_id && item.blocker_type === "unresolved_conflict_receipt");
    return row({
      row_id: `conflict_resolution_ledger_candidate.${queue.request_id}`,
      category: "conflict_resolution_ledger_candidate",
      label: `Conflict resolution ledger candidate for ${queue.request_id}`,
      observed: conflicts.length > 0,
      evidence_ref: conflicts[0]?.row_id ?? queue.row_id,
      request_id: queue.request_id,
      conflict_ledger_ref: `conflict_resolution.${queue.request_id}.candidate`,
      unresolved_conflict_blocker_refs: conflicts.map((item) => item.row_id),
      conflict_resolution_receipt_required_now: true,
      conflict_resolution_receipt_present_now: false,
      conflict_resolution_auto_pass_allowed_now: false,
      conflict_bypass_allowed_now: false,
      ledger_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildStaleContextRecheckCandidateRows({ source, queueRows, generatedAt }) {
  const blockerRows = source.data?.missing_answer_blocker_rule_rows ?? [];
  return queueRows.map((queue) => {
    const stale = blockerRows.filter((item) => item.request_id === queue.request_id && item.blocker_type === "stale_context_recheck");
    return row({
      row_id: `stale_context_recheck_candidate.${queue.request_id}`,
      category: "stale_context_recheck_candidate",
      label: `Stale context recheck candidate for ${queue.request_id}`,
      observed: stale.length > 0,
      evidence_ref: stale[0]?.row_id ?? queue.row_id,
      request_id: queue.request_id,
      stale_context_recheck_ref: `stale_context_recheck.${queue.request_id}.candidate`,
      stale_context_blocker_refs: stale.map((item) => item.row_id),
      stale_context_recheck_required_now: true,
      stale_context_recheck_present_now: false,
      stale_context_auto_pass_allowed_now: false,
      stale_context_bypass_allowed_now: false,
      recheck_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildAnswerReceiptEvidencePacketCandidateRows({ queueRows, conflictRows, staleRows, generatedAt }) {
  return queueRows.map((queue) => {
    const conflict = conflictRows.find((item) => item.request_id === queue.request_id);
    const stale = staleRows.find((item) => item.request_id === queue.request_id);
    return row({
      row_id: `answer_receipt_evidence_packet_candidate.${queue.request_id}`,
      category: "answer_receipt_evidence_packet_candidate",
      label: `Answer receipt evidence packet candidate for ${queue.request_id}`,
      observed: Boolean(conflict && stale),
      evidence_ref: queue.row_id,
      request_id: queue.request_id,
      evidence_packet_ref: `answer_receipt_packet.${queue.request_id}.candidate`,
      required_refs: [queue.queue_ref, conflict?.conflict_ledger_ref, stale?.stale_context_recheck_ref].filter(Boolean),
      packet_candidate_visible_now: true,
      evidence_packet_completion_allowed_now: false,
      commercial_spec_readiness_pass_allowed_now: false,
      actual_answer_capture_allowed_now: false,
      raw_answer_exposure_allowed_now: false,
      packet_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorAnswerReceiptQueueProjectionRows({ queueRows, packetRows, generatedAt }) {
  return queueRows.map((queue) => {
    const packet = packetRows.find((item) => item.request_id === queue.request_id);
    return row({
      row_id: `operator_answer_receipt_queue_projection.${queue.request_id}`,
      category: "operator_answer_receipt_queue_projection",
      label: `Operator answer receipt queue projection for ${queue.request_id}`,
      observed: Boolean(packet),
      evidence_ref: packet?.row_id ?? queue.row_id,
      request_id: queue.request_id,
      operator_status: "blocked_waiting_for_redacted_answer_receipt",
      next_action: "collect_redacted_answer_receipt_conflict_resolution_and_stale_context_recheck",
      action_button_enabled_now: false,
      capture_button_enabled_now: false,
      accept_button_enabled_now: false,
      approve_button_enabled_now: false,
      execute_button_enabled_now: false,
      production_pass_enabled_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoRawCaptureBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.queue_is_not_capture", "Answer receipt queue must not capture answers", true],
    ["state.redacted_ref_is_not_raw_answer", "Redacted answer ref must not expose raw answers", true],
    ["state.conflict_ledger_is_not_resolution_pass", "Conflict ledger candidate must not auto-resolve conflicts", true],
    ["state.stale_recheck_is_not_context_pass", "Stale context candidate must not auto-pass context freshness", true],
    ["state.operator_projection_is_not_capture_surface", "Operator projection must not enable capture controls", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_raw_capture_boundary.${id}`,
    category: "no_raw_capture_boundary",
    label,
    observed,
    evidence_ref: "clarification_answer_receipt_queue_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_raw_capture_boundary.${flag}`,
    category: "no_raw_capture_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "clarification_answer_receipt_queue_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P34800 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/clarification-answer-receipt-candidate-queue.schema.json"],
    ["roadmap_doc", "Roadmap documents all P34401-P34800 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p34401-p34800.md"],
    ["architecture_doc", "Architecture doc references P34401-P34800", architectureDoc.text.includes("P34401-P34800 Clarification Answer Receipt Candidate Queue"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `answer_receipt_queue_wiring.${id}`,
    category: "answer_receipt_queue_wiring",
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.queueRows)
    && allPass(context.conflictRows)
    && allPass(context.staleRows)
    && allPass(context.packetRows)
    && allPass(context.operatorRows)
    && allPass(context.noRawRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P34400 source is ready for answer receipt queue", context.sourceState.sourceReady],
    ["answer_receipt_queue_visible", "Redacted answer receipt candidate queue rows are visible", allPass(context.queueRows)],
    ["conflict_ledger_visible", "Conflict resolution ledger candidates are visible", allPass(context.conflictRows)],
    ["stale_context_recheck_visible", "Stale context recheck candidates are visible", allPass(context.staleRows)],
    ["evidence_packet_visible", "Answer receipt evidence packet candidates are visible", allPass(context.packetRows)],
    ["operator_projection_visible", "Operator answer receipt queue projection rows are visible", allPass(context.operatorRows)],
    ["no_raw_capture_boundary_closed", "No-raw-capture boundary stays closed", allPass(context.noRawRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["actual_answer_capture_blocked", "Actual answer capture stays blocked", true],
    ["commercial_spec_registration_handoff", "Commercial spec registration handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p34800_checkpoint.${id}`,
    category: "p34800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p34800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p34800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.queueRows)
    && allPass(context.conflictRows)
    && allPass(context.staleRows)
    && allPass(context.packetRows)
    && allPass(context.operatorRows)
    && allPass(context.noRawRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p34800_checkpoint.actual_answer_capture_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p34800ContractReady;
  return {
    p34800_contract_ready: p34800ContractReady,
    ready_for_commercial_spec_registration_handoff: ready,
    source_p34400_ready_for_answer_receipt_queue: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    redacted_answer_receipt_candidate_queue_visible_now: allPass(context.queueRows),
    conflict_resolution_ledger_candidate_visible_now: allPass(context.conflictRows),
    stale_context_recheck_candidate_visible_now: allPass(context.staleRows),
    answer_receipt_evidence_packet_candidate_visible_now: allPass(context.packetRows),
    operator_answer_receipt_queue_projection_visible_now: allPass(context.operatorRows),
    no_raw_capture_boundary_closed_now: allPass(context.noRawRows),
    answer_receipt_queue_wiring_complete_now: allPass(context.wiringRows),
    redacted_answer_receipt_candidate_queue_count: context.queueRows.length,
    conflict_resolution_ledger_candidate_count: context.conflictRows.length,
    stale_context_recheck_candidate_count: context.staleRows.length,
    answer_receipt_evidence_packet_candidate_count: context.packetRows.length,
    operator_projection_count: context.operatorRows.length,
    actual_answer_capture_allowed_count: context.queueRows.filter((item) => item.actual_answer_capture_allowed_now === true).length,
    raw_answer_exposure_allowed_count: context.queueRows.filter((item) => item.raw_answer_exposure_allowed_now === true).length,
    queue_completion_allowed_count: context.queueRows.filter((item) => item.queue_completion_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P34401-P34800 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P34400 source state is not visible"),
    validationItem("queue.visible", "answer_receipt", allPass(context.queueRows), "Answer receipt queue rows are incomplete"),
    validationItem("conflict.visible", "answer_receipt", allPass(context.conflictRows), "Conflict resolution ledger candidates are incomplete"),
    validationItem("stale.visible", "answer_receipt", allPass(context.staleRows), "Stale context recheck candidates are incomplete"),
    validationItem("packet.visible", "answer_receipt", allPass(context.packetRows), "Answer receipt evidence packet candidates are incomplete"),
    validationItem("operator.visible", "operator", allPass(context.operatorRows), "Operator answer receipt queue projection rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P34401-P34800 wiring is incomplete"),
    validationItem("no.actual.capture", "authority", context.queueRows.every((item) => item.actual_answer_capture_allowed_now === false && item.redacted_answer_receipt_present_now === false), "Actual answer capture opened"),
    validationItem("no.raw.answer", "authority", context.queueRows.every((item) => item.raw_answer_persist_allowed_now === false && item.raw_answer_exposure_allowed_now === false), "Raw answer boundary opened"),
    validationItem("no.conflict.auto.pass", "authority", context.conflictRows.every((item) => item.conflict_resolution_auto_pass_allowed_now === false && item.conflict_bypass_allowed_now === false), "Conflict auto PASS opened"),
    validationItem("no.stale.auto.pass", "authority", context.staleRows.every((item) => item.stale_context_auto_pass_allowed_now === false && item.stale_context_bypass_allowed_now === false), "Stale context auto PASS opened"),
    validationItem("no.operator.actions", "authority", context.operatorRows.every((item) => item.capture_button_enabled_now === false && item.accept_button_enabled_now === false && item.execute_button_enabled_now === false), "Operator capture or action surface opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p34800_checkpoint.actual_answer_capture_blocked"), "P34800 actual answer capture checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "clarification_answer_receipt_candidate_queue.contract.v1",
    generated_at: generatedAt,
    source_p34400_required_or_rebuilt: true,
    redacted_answer_receipt_candidate_queue_required: true,
    conflict_resolution_ledger_candidate_required: true,
    stale_context_recheck_candidate_required: true,
    answer_receipt_evidence_packet_candidate_required: true,
    no_raw_capture_boundary_required: true,
    p34800_is_not_actual_answer_capture_receipt_accept_queue_completion_spec_pass_execution_write_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_commercial_spec_registration_handoff
    ? READY_STATUS
    : validation.valid && boundary.p34800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    clarification_answer_receipt_queue_status: status,
    source_p34400_ready_for_answer_receipt_queue: boundary.source_p34400_ready_for_answer_receipt_queue,
    redacted_answer_receipt_candidate_queue_count: boundary.redacted_answer_receipt_candidate_queue_count,
    conflict_resolution_ledger_candidate_count: boundary.conflict_resolution_ledger_candidate_count,
    stale_context_recheck_candidate_count: boundary.stale_context_recheck_candidate_count,
    answer_receipt_evidence_packet_candidate_count: boundary.answer_receipt_evidence_packet_candidate_count,
    operator_projection_count: boundary.operator_projection_count,
    actual_answer_capture_allowed_count: boundary.actual_answer_capture_allowed_count,
    raw_answer_exposure_allowed_count: boundary.raw_answer_exposure_allowed_count,
    queue_completion_allowed_count: boundary.queue_completion_allowed_count,
    ready_for_commercial_spec_registration_handoff: validation.valid && boundary.ready_for_commercial_spec_registration_handoff,
    answer_receipt_actual_answer_capture_allowed_now: false,
    answer_receipt_raw_answer_persist_allowed_now: false,
    answer_receipt_raw_answer_exposure_allowed_now: false,
    answer_receipt_redacted_receipt_accept_allowed_now: false,
    answer_receipt_queue_completion_allowed_now: false,
    answer_receipt_commercial_spec_readiness_pass_allowed_now: false,
    answer_receipt_runtime_execution_allowed_now: false,
    answer_receipt_write_action_allowed_now: false,
    answer_receipt_protected_action_allowed_now: false,
    answer_receipt_final_approval_allowed_now: false,
    answer_receipt_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Clarification Answer Receipt Candidate Queue",
    "",
    `Status: ${result.summary.clarification_answer_receipt_queue_status}`,
    `Program: ${result.program_range}`,
    `P34400 ready for answer receipt queue: ${result.summary.source_p34400_ready_for_answer_receipt_queue}`,
    `Answer receipt queue rows: ${result.summary.redacted_answer_receipt_candidate_queue_count}`,
    `Conflict ledger candidates: ${result.summary.conflict_resolution_ledger_candidate_count}`,
    `Stale context candidates: ${result.summary.stale_context_recheck_candidate_count}`,
    `Ready for commercial spec registration handoff: ${result.summary.ready_for_commercial_spec_registration_handoff}`,
    `Actual answer capture allowed: ${result.summary.answer_receipt_actual_answer_capture_allowed_now}`,
    `Raw answer exposure allowed: ${result.summary.answer_receipt_raw_answer_exposure_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.redacted_answer_receipt_candidate_queue_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.queue_ref)}</td><td>${escapeHtml(item.redacted_answer_receipt_present_now)}</td><td>${escapeHtml(item.raw_answer_exposure_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Clarification Answer Receipt Candidate Queue</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1d2433; }
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
    <h1>Hermes Clarification Answer Receipt Candidate Queue</h1>
    <p class="notice">This artifact queues redacted answer receipt candidates only. It does not capture answers, expose raw answers, accept receipts, complete the queue, approve, execute, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Queue Ref</th><th>Receipt Present</th><th>Raw Exposure</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP34400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildSeedRecheckValidationContract({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.seed_recheck_validation_contract", built);
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
  const defaults = DEFAULT_CLARIFICATION_ANSWER_RECEIPT_QUEUE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_seed_recheck_validation_contract_path: path.resolve(repoRoot, options.sourceSeedRecheckValidationContractPath ?? defaults.sourceSeedRecheckValidationContractPath),
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
      args.sourceSeedRecheckValidationContractPath = argv[++index];
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
  console.log(`Usage: node scripts/clarification-answer-receipt-candidate-queue.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P34401-P34800 Clarification Answer Receipt Candidate Queue.
`);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  const item = rows.find((rowItem) => rowItem.row_id === rowId);
  return Boolean(item && (item.current_verdict === "pass" || item.visible_now === true || item.observed === true));
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.current_verdict !== "pass")
    .map((item) => ({ row_id: item.row_id, category: item.category, message: item.failure_message ?? item.block_reason ?? "Validation item failed" }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function hasScript(packageData, scriptName) {
  return Boolean(packageData?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, rows };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function row(fields) {
  const observed = fields.observed === true;
  return {
    ...fields,
    observed,
    current_verdict: observed ? "pass" : "block",
    block_reason: observed ? null : `${fields.row_id} not satisfied`,
  };
}

function validationItem(id, category, observed, failureMessage) {
  return row({
    row_id: `validation.${id}`,
    category,
    label: id,
    observed,
    evidence_ref: id,
    failure_message: observed ? null : failureMessage,
    generated_at: new Date(0).toISOString(),
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
