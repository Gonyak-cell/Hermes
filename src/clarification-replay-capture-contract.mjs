import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P33600_FALSE_FLAGS,
  buildUiProjectionReplayLedger,
} from "./ui-projection-replay-ledger.mjs";

export const DEFAULT_CLARIFICATION_REPLAY_CAPTURE_CONTRACT_OUT_DIR = "artifacts/clarification-replay-capture-contract/latest";
export const DEFAULT_CLARIFICATION_REPLAY_CAPTURE_CONTRACT_INPUTS = {
  schemaPath: "schemas/clarification-replay-capture-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p33601-p34000.md",
  architectureDocPath: "docs/architecture.md",
  sourceUiProjectionReplayLedgerPath: "artifacts/ui-projection-replay-ledger/latest/ui-projection-replay-ledger.json",
};

const COMMAND_NAME = "platform:clarification-replay-capture-contract";
const SCHEMA_VERSION = "clarification-replay-capture-contract.v1";
const CAPABILITY_ID = "platform.clarification_replay_capture_contract";
const PROGRAM_RANGE = "P33601-P34000";
const SOURCE_PROGRAM_RANGE = "P33201-P33600";
const READY_STATUS = "ready_for_clarification_replay_capture_contract";
const BLOCK_PENDING_STATUS = "valid_block_clarification_replay_capture_contract_pending";
const BLOCKED_STATUS = "blocked_clarification_replay_capture_contract";

const PHASE_SPECS = [
  ["P33601-P33660", "P33600 Source Binding", "p33600_source_binding_rows"],
  ["P33661-P33720", "Redacted Answer Receipt Intake Contract", "redacted_answer_receipt_intake_rows"],
  ["P33721-P33780", "Question Replay Trace Binding", "question_replay_trace_binding_rows"],
  ["P33781-P33840", "Replay Ledger Completion Candidate", "replay_ledger_completion_candidate_rows"],
  ["P33841-P33920", "Seed Recheck Candidate", "seed_recheck_candidate_rows"],
  ["P33921-P33960", "No-Execution and No-Raw Boundary", "no_execution_no_raw_boundary_rows"],
  ["P33961-P34000", "P34000 Clean Checkpoint", "p34000_clean_checkpoint_rows"],
];

export const CLARIFICATION_REPLAY_CAPTURE_CONTRACT_FALSE_FLAGS = [
  "clarification_replay_answer_capture_allowed_now",
  "clarification_replay_raw_answer_persist_allowed_now",
  "clarification_replay_raw_answer_exposure_allowed_now",
  "clarification_replay_redacted_answer_receipt_auto_accept_allowed_now",
  "clarification_replay_question_trace_auto_accept_allowed_now",
  "clarification_replay_completion_allowed_now",
  "clarification_replay_verification_pass_allowed_now",
  "clarification_replay_seed_recheck_execution_allowed_now",
  "clarification_replay_seed_recheck_pass_allowed_now",
  "clarification_replay_seed_unblock_allowed_now",
  "clarification_replay_final_seed_allowed_now",
  "clarification_replay_runtime_execution_allowed_now",
  "clarification_replay_write_action_allowed_now",
  "clarification_replay_protected_action_allowed_now",
  "clarification_replay_connector_write_allowed_now",
  "clarification_replay_deployment_allowed_now",
  "clarification_replay_review_completion_allowed_now",
  "clarification_replay_final_approval_allowed_now",
  "clarification_replay_production_pass_allowed_now",
  "clarification_replay_enterprise_trust_claim_allowed_now",
  "clarification_replay_secret_read_allowed_now",
  "clarification_replay_human_gate_bypass_allowed_now",
  "clarification_replay_independent_review_bypass_allowed_now",
  "clarification_replay_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...CLARIFICATION_REPLAY_CAPTURE_CONTRACT_FALSE_FLAGS, ...P33600_FALSE_FLAGS])];

export async function runClarificationReplayCaptureContract(options = {}) {
  const result = await buildClarificationReplayCaptureContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Clarification Replay Capture Contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeClarificationReplayCaptureContract(result, result.output_dir);
  return result;
}

export async function buildClarificationReplayCaptureContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLARIFICATION_REPLAY_CAPTURE_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "uiProjectionReplayLedger")
    ? normalizeInlineJsonSource("inline.ui_projection_replay_ledger", options.uiProjectionReplayLedger)
    : await readJsonOrBuildP33600(inputs.source_ui_projection_replay_ledger_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const receiptRows = buildRedactedAnswerReceiptIntakeRows({ source, generatedAt });
  const traceRows = buildQuestionReplayTraceBindingRows({ source, receiptRows, generatedAt });
  const completionRows = buildReplayLedgerCompletionCandidateRows({ source, receiptRows, traceRows, generatedAt });
  const seedRows = buildSeedRecheckCandidateRows({ source, completionRows, generatedAt });
  const boundaryRows = buildNoExecutionNoRawBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, receiptRows, traceRows, completionRows, seedRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, receiptRows, traceRows, completionRows, seedRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, receiptRows, traceRows, completionRows, seedRows, boundaryRows, checkpointRows, boundary });
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
      ui_projection_replay_ledger_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_ui_projection_replay_ledger_summary: source.data?.summary ?? null,
    clarification_replay_capture_contract: buildContract(generatedAt),
    clarification_replay_capture_phase_rows: phaseRows,
    p33600_source_binding_rows: sourceRows,
    redacted_answer_receipt_intake_rows: receiptRows,
    question_replay_trace_binding_rows: traceRows,
    replay_ledger_completion_candidate_rows: completionRows,
    seed_recheck_candidate_rows: seedRows,
    no_execution_no_raw_boundary_rows: boundaryRows,
    p34000_clean_checkpoint_rows: checkpointRows,
    clarification_replay_capture_boundary: boundary,
    clarification_replay_capture_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "clarification_replay_capture_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.clarification_replay_capture_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.clarification_replay_capture_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeClarificationReplayCaptureContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "clarification-replay-capture-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p33600-source-binding-rows.json"), collectionEnvelope("p33600-source-binding-rows.v1", "p33600_source_binding_rows", result.p33600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "redacted-answer-receipt-intake-rows.json"), collectionEnvelope("redacted-answer-receipt-intake-rows.v1", "redacted_answer_receipt_intake_rows", result.redacted_answer_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "question-replay-trace-binding-rows.json"), collectionEnvelope("question-replay-trace-binding-rows.v1", "question_replay_trace_binding_rows", result.question_replay_trace_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-ledger-completion-candidate-rows.json"), collectionEnvelope("replay-ledger-completion-candidate-rows.v1", "replay_ledger_completion_candidate_rows", result.replay_ledger_completion_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-recheck-candidate-rows.json"), collectionEnvelope("seed-recheck-candidate-rows.v1", "seed_recheck_candidate_rows", result.seed_recheck_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-execution-no-raw-boundary-rows.json"), collectionEnvelope("no-execution-no-raw-boundary-rows.v1", "no_execution_no_raw_boundary_rows", result.no_execution_no_raw_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p34000-clean-checkpoint-rows.json"), collectionEnvelope("p34000-clean-checkpoint-rows.v1", "p34000_clean_checkpoint_rows", result.p34000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "clarification-replay-capture-boundary.json"), result.clarification_replay_capture_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runClarificationReplayCaptureContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runClarificationReplayCaptureContract(args);
  console.log(`Clarification Replay Capture Contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.clarification_replay_capture_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P33600 ready for replay capture: ${result.summary.source_p33600_ready_for_clarification_replay_capture}`);
  console.log(`Redacted answer receipt contracts: ${result.summary.redacted_answer_receipt_intake_count}`);
  console.log(`Question replay traces: ${result.summary.question_replay_trace_binding_count}`);
  console.log(`Replay completion candidates: ${result.summary.replay_ledger_completion_candidate_count}`);
  console.log(`Seed recheck candidates: ${result.summary.seed_recheck_candidate_count}`);
  console.log(`Ready for seed recheck validation handoff: ${result.summary.ready_for_seed_recheck_validation_handoff}`);
  console.log(`Answer capture allowed: ${result.summary.clarification_replay_answer_capture_allowed_now}`);
  console.log(`Replay completion allowed: ${result.summary.clarification_replay_completion_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.ui_projection_replay_ledger_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_clarification_replay_capture_handoff === true,
    status: summary.ui_projection_replay_ledger_status ?? "missing",
    p33600ContractReady: boundary.p33600_contract_ready === true,
    slotVisible: boundary.ui_projection_slot_map_visible_now === true,
    replayLedgerVisible: boundary.replay_ledger_candidate_visible_now === true,
    operatorHandoffVisible: boundary.operator_handoff_surface_visible_now === true,
    replayEvidenceVisible: boundary.replay_evidence_guard_visible_now === true,
    noActionBoundaryClosed: boundary.no_action_ui_boundary_closed_now === true,
    boundaryClosed: P33600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p33601-p34000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P33600 UI projection replay ledger source is available", sourceState.available],
    ["program_range", "P33600 source program range is P33201-P33600", sourceState.programRangeOk],
    ["validation_valid", "P33600 source validation is valid", sourceState.validationValid],
    ["replay_capture_handoff_open", "P33600 opened clarification replay capture handoff", sourceState.sourceReady],
    ["p33600_contract_ready", "P33600 source contract is ready", sourceState.p33600ContractReady],
    ["ui_projection_slots_visible", "P33600 UI projection slots are visible", sourceState.slotVisible],
    ["replay_ledger_visible", "P33600 replay ledger candidates are visible", sourceState.replayLedgerVisible],
    ["operator_handoff_visible", "P33600 operator handoff surface is visible", sourceState.operatorHandoffVisible],
    ["replay_evidence_guard_visible", "P33600 replay evidence guard is visible", sourceState.replayEvidenceVisible],
    ["no_action_boundary_closed", "P33600 no-action UI boundary is closed", sourceState.noActionBoundaryClosed],
    ["commit_ref_present", "Current commit ref is present for clarification replay capture", Boolean(commitRef)],
    ["source_blocker_visible", "P33600 source blocker is visible when replay capture is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p33600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildRedactedAnswerReceiptIntakeRows({ source, generatedAt }) {
  const evidenceRows = source.data?.replay_evidence_guard_rows ?? [];
  return evidenceRows.map((evidence) => row({
    row_id: `redacted_answer_receipt_intake.${evidence.request_id}`,
    category: "redacted_answer_receipt_intake",
    label: `Redacted answer receipt intake contract for ${evidence.request_id}`,
    observed: Boolean(evidence.request_id),
    evidence_ref: evidence.row_id,
    request_id: evidence.request_id,
    receipt_ref: `redacted_answer_receipt.${evidence.request_id}.candidate`,
    replay_ledger_ref: evidence.replay_ledger_ref,
    required_receipt_fields: [
      "answer_receipt_id",
      "question_ref",
      "redacted_answer_ref",
      "redaction_policy_ref",
      "operator_timestamp_ref",
    ],
    redacted_answer_receipt_required_now: true,
    redacted_answer_receipt_present_now: false,
    raw_answer_persist_allowed_now: false,
    raw_answer_exposure_allowed_now: false,
    answer_capture_allowed_now: false,
    receipt_auto_accept_allowed_now: false,
    receipt_metadata_only: true,
    generated_at: generatedAt,
  }));
}

function buildQuestionReplayTraceBindingRows({ source, receiptRows, generatedAt }) {
  const replayRows = source.data?.replay_ledger_candidate_rows ?? [];
  return receiptRows.map((receipt) => {
    const replay = replayRows.find((item) => item.request_id === receipt.request_id);
    return row({
      row_id: `question_replay_trace_binding.${receipt.request_id}`,
      category: "question_replay_trace_binding",
      label: `Question replay trace binding for ${receipt.request_id}`,
      observed: Boolean(replay),
      evidence_ref: replay?.row_id ?? receipt.row_id,
      request_id: receipt.request_id,
      trace_ref: `question_replay_trace.${receipt.request_id}.candidate`,
      receipt_ref: receipt.receipt_ref,
      slot_ref: replay?.slot_ref ?? null,
      required_replay_refs: replay?.required_replay_refs ?? [],
      question_replay_trace_required_now: true,
      question_replay_trace_present_now: false,
      trace_auto_accept_allowed_now: false,
      answer_receipt_required_before_unblock: true,
      trace_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildReplayLedgerCompletionCandidateRows({ source, receiptRows, traceRows, generatedAt }) {
  const replayRows = source.data?.replay_ledger_candidate_rows ?? [];
  return receiptRows.map((receipt) => {
    const trace = traceRows.find((item) => item.request_id === receipt.request_id);
    const replay = replayRows.find((item) => item.request_id === receipt.request_id);
    return row({
      row_id: `replay_ledger_completion_candidate.${receipt.request_id}`,
      category: "replay_ledger_completion_candidate",
      label: `Replay ledger completion candidate for ${receipt.request_id}`,
      observed: Boolean(trace && replay),
      evidence_ref: trace?.row_id ?? receipt.row_id,
      request_id: receipt.request_id,
      completion_candidate_ref: `replay_completion.${receipt.request_id}.candidate`,
      replay_ledger_ref: replay?.ledger_ref ?? receipt.replay_ledger_ref,
      receipt_ref: receipt.receipt_ref,
      trace_ref: trace?.trace_ref ?? null,
      redacted_answer_receipt_present_now: false,
      question_replay_trace_present_now: false,
      replay_completion_candidate_visible_now: true,
      replay_completion_allowed_now: false,
      replay_verification_pass_allowed_now: false,
      missing_evidence_blocker_visible_now: true,
      completion_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildSeedRecheckCandidateRows({ source, completionRows, generatedAt }) {
  const slotRows = source.data?.ui_projection_slot_map_rows ?? [];
  return completionRows.map((completion) => {
    const slot = slotRows.find((item) => item.request_id === completion.request_id);
    return row({
      row_id: `seed_recheck_candidate.${completion.request_id}`,
      category: "seed_recheck_candidate",
      label: `Seed recheck candidate for ${completion.request_id}`,
      observed: Boolean(slot),
      evidence_ref: completion.row_id,
      request_id: completion.request_id,
      seed_recheck_candidate_ref: `seed_recheck.${completion.request_id}.candidate`,
      completion_candidate_ref: completion.completion_candidate_ref,
      slot_ref: slot?.slot_ref ?? null,
      required_before_recheck_refs: [
        completion.receipt_ref,
        completion.trace_ref,
        "seed_candidate_recheck_receipt",
      ].filter(Boolean),
      seed_recheck_candidate_visible_now: true,
      seed_recheck_execution_allowed_now: false,
      seed_recheck_pass_allowed_now: false,
      seed_unblock_allowed_now: false,
      final_seed_allowed_now: false,
      execution_allowed_now: false,
      seed_recheck_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoExecutionNoRawBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_execution_no_raw_boundary.${flag}`,
    category: "no_execution_no_raw_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "clarification_replay_capture_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.receiptRows)
    && allPass(context.traceRows)
    && allPass(context.completionRows)
    && allPass(context.seedRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P33600 source is ready for clarification replay capture", context.sourceState.sourceReady],
    ["redacted_answer_receipt_contract_visible", "Redacted answer receipt intake rows are visible", allPass(context.receiptRows)],
    ["question_replay_trace_visible", "Question replay trace binding rows are visible", allPass(context.traceRows)],
    ["replay_completion_candidate_visible", "Replay ledger completion candidate rows are visible", allPass(context.completionRows)],
    ["seed_recheck_candidate_visible", "Seed recheck candidate rows are visible", allPass(context.seedRows)],
    ["no_execution_no_raw_boundary_closed", "No-execution and no-raw boundary remains closed", allPass(context.boundaryRows)],
    ["missing_evidence_blocker_visible", "Missing evidence blocker remains visible until receipts exist", true],
    ["raw_answer_boundary_closed", "Raw answer persist and exposure stay closed", true],
    ["seed_recheck_validation_handoff", "Seed recheck validation handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p34000_checkpoint.${id}`,
    category: "p34000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p34000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p34000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.receiptRows)
    && allPass(context.traceRows)
    && allPass(context.completionRows)
    && allPass(context.seedRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p34000_checkpoint.missing_evidence_blocker_visible")
    && visibleOrPassed(context.checkpointRows, "p34000_checkpoint.raw_answer_boundary_closed");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p34000ContractReady;
  return {
    p34000_contract_ready: p34000ContractReady,
    ready_for_seed_recheck_validation_handoff: ready,
    source_p33600_ready_for_clarification_replay_capture: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    redacted_answer_receipt_intake_visible_now: allPass(context.receiptRows),
    question_replay_trace_binding_visible_now: allPass(context.traceRows),
    replay_ledger_completion_candidate_visible_now: allPass(context.completionRows),
    seed_recheck_candidate_visible_now: allPass(context.seedRows),
    no_execution_no_raw_boundary_closed_now: allPass(context.boundaryRows),
    redacted_answer_receipt_intake_count: context.receiptRows.length,
    question_replay_trace_binding_count: context.traceRows.length,
    replay_ledger_completion_candidate_count: context.completionRows.length,
    seed_recheck_candidate_count: context.seedRows.length,
    missing_evidence_blocker_count: context.completionRows.filter((item) => item.missing_evidence_blocker_visible_now === true).length,
    answer_capture_allowed_count: context.receiptRows.filter((item) => item.answer_capture_allowed_now === true).length,
    replay_completion_allowed_count: context.completionRows.filter((item) => item.replay_completion_allowed_now === true).length,
    seed_recheck_execution_allowed_count: context.seedRows.filter((item) => item.seed_recheck_execution_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P33601-P34000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P33601-P34000 Clarification Replay Capture Contract"), "Architecture doc missing P33601-P34000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P33600 source state is not visible"),
    validationItem("redacted.receipts.visible", "clarification_replay", allPass(context.receiptRows), "Redacted answer receipt intake rows are incomplete"),
    validationItem("question.trace.visible", "clarification_replay", allPass(context.traceRows), "Question replay trace binding rows are incomplete"),
    validationItem("completion.candidate.visible", "clarification_replay", allPass(context.completionRows), "Replay ledger completion candidate rows are incomplete"),
    validationItem("seed.recheck.visible", "clarification_replay", allPass(context.seedRows), "Seed recheck candidate rows are incomplete"),
    validationItem("no.answer.capture", "authority", context.receiptRows.every((item) => item.answer_capture_allowed_now === false && item.redacted_answer_receipt_present_now === false), "Answer capture opened"),
    validationItem("no.raw.answer", "authority", context.receiptRows.every((item) => item.raw_answer_persist_allowed_now === false && item.raw_answer_exposure_allowed_now === false), "Raw answer boundary opened"),
    validationItem("no.replay.completion", "authority", context.completionRows.every((item) => item.replay_completion_allowed_now === false && item.replay_verification_pass_allowed_now === false), "Replay completion opened"),
    validationItem("no.seed.unblock", "authority", context.seedRows.every((item) => item.seed_unblock_allowed_now === false && item.final_seed_allowed_now === false && item.execution_allowed_now === false), "Seed unblock or execution opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p34000_checkpoint.missing_evidence_blocker_visible"), "P34000 checkpoint missing evidence blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "clarification_replay_capture.contract.v1",
    generated_at: generatedAt,
    source_p33600_required_or_rebuilt: true,
    redacted_answer_receipt_intake_contract_required: true,
    question_replay_trace_binding_required: true,
    replay_ledger_completion_candidate_required: true,
    seed_recheck_candidate_required: true,
    no_execution_no_raw_boundary_required: true,
    p34000_is_not_actual_answer_capture_raw_answer_replay_completion_seed_unblock_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_seed_recheck_validation_handoff
    ? READY_STATUS
    : validation.valid && boundary.p34000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    clarification_replay_capture_status: status,
    source_p33600_ready_for_clarification_replay_capture: boundary.source_p33600_ready_for_clarification_replay_capture,
    redacted_answer_receipt_intake_count: boundary.redacted_answer_receipt_intake_count,
    question_replay_trace_binding_count: boundary.question_replay_trace_binding_count,
    replay_ledger_completion_candidate_count: boundary.replay_ledger_completion_candidate_count,
    seed_recheck_candidate_count: boundary.seed_recheck_candidate_count,
    missing_evidence_blocker_count: boundary.missing_evidence_blocker_count,
    answer_capture_allowed_count: boundary.answer_capture_allowed_count,
    replay_completion_allowed_count: boundary.replay_completion_allowed_count,
    seed_recheck_execution_allowed_count: boundary.seed_recheck_execution_allowed_count,
    ready_for_seed_recheck_validation_handoff: validation.valid && boundary.ready_for_seed_recheck_validation_handoff,
    clarification_replay_answer_capture_allowed_now: false,
    clarification_replay_raw_answer_persist_allowed_now: false,
    clarification_replay_raw_answer_exposure_allowed_now: false,
    clarification_replay_redacted_answer_receipt_auto_accept_allowed_now: false,
    clarification_replay_question_trace_auto_accept_allowed_now: false,
    clarification_replay_completion_allowed_now: false,
    clarification_replay_verification_pass_allowed_now: false,
    clarification_replay_seed_recheck_execution_allowed_now: false,
    clarification_replay_seed_recheck_pass_allowed_now: false,
    clarification_replay_seed_unblock_allowed_now: false,
    clarification_replay_final_seed_allowed_now: false,
    clarification_replay_runtime_execution_allowed_now: false,
    clarification_replay_write_action_allowed_now: false,
    clarification_replay_protected_action_allowed_now: false,
    clarification_replay_final_approval_allowed_now: false,
    clarification_replay_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Clarification Replay Capture Contract",
    "",
    `Status: ${result.summary.clarification_replay_capture_status}`,
    `Program: ${result.program_range}`,
    `P33600 ready for replay capture: ${result.summary.source_p33600_ready_for_clarification_replay_capture}`,
    `Redacted answer receipt contracts: ${result.summary.redacted_answer_receipt_intake_count}`,
    `Question replay traces: ${result.summary.question_replay_trace_binding_count}`,
    `Replay completion candidates: ${result.summary.replay_ledger_completion_candidate_count}`,
    `Seed recheck candidates: ${result.summary.seed_recheck_candidate_count}`,
    `Ready for seed recheck validation handoff: ${result.summary.ready_for_seed_recheck_validation_handoff}`,
    `Answer capture allowed: ${result.summary.clarification_replay_answer_capture_allowed_now}`,
    `Replay completion allowed: ${result.summary.clarification_replay_completion_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.redacted_answer_receipt_intake_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.receipt_ref)}</td><td>${escapeHtml(item.redacted_answer_receipt_present_now)}</td><td>${escapeHtml(item.raw_answer_exposure_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Clarification Replay Capture Contract</title>
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
    <h1>Hermes Clarification Replay Capture Contract</h1>
    <p class="notice">This artifact defines redacted answer receipt and replay trace contracts only. It does not capture answers, persist raw answers, complete replay, recheck or unblock seeds, execute runtime actions, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Receipt Ref</th><th>Receipt Present</th><th>Raw Exposure</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP33600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildUiProjectionReplayLedger({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.ui_projection_replay_ledger", built);
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
  const defaults = DEFAULT_CLARIFICATION_REPLAY_CAPTURE_CONTRACT_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_ui_projection_replay_ledger_path: path.resolve(repoRoot, options.sourceUiProjectionReplayLedgerPath ?? defaults.sourceUiProjectionReplayLedgerPath),
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
      args.sourceUiProjectionReplayLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/clarification-replay-capture-contract.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P33601-P34000 Clarification Replay Capture Contract.
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
