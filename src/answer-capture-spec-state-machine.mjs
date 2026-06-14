import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P32000_FALSE_FLAGS,
  buildQuestionPlannerConflictDetector,
} from "./question-planner-conflict-detector.mjs";

export const DEFAULT_ANSWER_CAPTURE_SPEC_STATE_MACHINE_OUT_DIR = "artifacts/answer-capture-spec-state-machine/latest";
export const DEFAULT_ANSWER_CAPTURE_SPEC_STATE_MACHINE_INPUTS = {
  schemaPath: "schemas/answer-capture-spec-state-machine.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p32001-p32400.md",
  architectureDocPath: "docs/architecture.md",
  sourceQuestionPlannerConflictDetectorPath: "artifacts/question-planner-conflict-detector/latest/question-planner-conflict-detector.json",
};

const COMMAND_NAME = "platform:answer-capture-spec-state-machine";
const SCHEMA_VERSION = "answer-capture-spec-state-machine.v1";
const CAPABILITY_ID = "platform.answer_capture_spec_state_machine";
const PROGRAM_RANGE = "P32001-P32400";
const SOURCE_PROGRAM_RANGE = "P31601-P32000";
const READY_STATUS = "ready_for_answer_capture_spec_state_machine";
const BLOCK_PENDING_STATUS = "valid_block_answer_capture_spec_state_machine_pending";
const BLOCKED_STATUS = "blocked_answer_capture_spec_state_machine";

const PHASE_SPECS = [
  ["P32001-P32040", "P32000 Source Binding", "p32000_source_binding_rows"],
  ["P32041-P32120", "Answer Capture Contract", "answer_capture_contract_rows"],
  ["P32121-P32200", "Spec State Machine", "spec_state_machine_rows"],
  ["P32201-P32280", "Answer Redaction Boundary", "answer_redaction_boundary_rows"],
  ["P32281-P32340", "State Transition Validator", "state_transition_validator_rows"],
  ["P32341-P32380", "No-Seed-Synthesis Boundary", "no_seed_synthesis_boundary_rows"],
  ["P32381-P32400", "P32400 Clean Checkpoint", "p32400_clean_checkpoint_rows"],
];

const STATE_TRANSITIONS = [
  ["question_planned", "awaiting_user_answer", "Question plan is ready but no answer is captured"],
  ["awaiting_user_answer", "answer_receipt_candidate", "A future answer receipt may be referenced after redaction"],
  ["answer_receipt_candidate", "spec_update_candidate", "A redacted answer can propose slot updates"],
  ["spec_update_candidate", "seed_readiness_candidate", "A complete spec can be handed to the later seed readiness gate"],
];

export const ANSWER_CAPTURE_SPEC_STATE_MACHINE_FALSE_FLAGS = [
  "answer_capture_live_answer_capture_allowed_now",
  "answer_capture_raw_answer_persist_allowed_now",
  "answer_capture_raw_answer_exposure_allowed_now",
  "answer_capture_seed_synthesis_allowed_now",
  "answer_capture_seed_auto_apply_allowed_now",
  "answer_capture_runtime_execution_allowed_now",
  "answer_capture_write_action_allowed_now",
  "answer_capture_protected_action_allowed_now",
  "answer_capture_connector_write_allowed_now",
  "answer_capture_deployment_allowed_now",
  "answer_capture_review_completion_allowed_now",
  "answer_capture_final_approval_allowed_now",
  "answer_capture_production_pass_allowed_now",
  "answer_capture_enterprise_trust_claim_allowed_now",
  "answer_capture_secret_read_allowed_now",
  "answer_capture_human_gate_bypass_allowed_now",
  "answer_capture_independent_review_bypass_allowed_now",
  "answer_capture_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...ANSWER_CAPTURE_SPEC_STATE_MACHINE_FALSE_FLAGS, ...P32000_FALSE_FLAGS])];

export async function runAnswerCaptureSpecStateMachine(options = {}) {
  const result = await buildAnswerCaptureSpecStateMachine(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Answer Capture Spec State Machine failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeAnswerCaptureSpecStateMachine(result, result.output_dir);
  return result;
}

export async function buildAnswerCaptureSpecStateMachine(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ANSWER_CAPTURE_SPEC_STATE_MACHINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "questionPlannerConflictDetector")
    ? normalizeInlineJsonSource("inline.question_planner_conflict_detector", options.questionPlannerConflictDetector)
    : await readJsonOrBuildP32000(inputs.source_question_planner_conflict_detector_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const answerRows = buildAnswerCaptureContractRows({ source, generatedAt });
  const stateRows = buildSpecStateMachineRows({ source, answerRows, generatedAt });
  const redactionRows = buildAnswerRedactionBoundaryRows({ answerRows, generatedAt });
  const transitionRows = buildStateTransitionValidatorRows({ stateRows, redactionRows, generatedAt });
  const boundaryRows = buildNoSeedSynthesisBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, answerRows, stateRows, redactionRows, transitionRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, answerRows, stateRows, redactionRows, transitionRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, answerRows, stateRows, redactionRows, transitionRows, boundaryRows, checkpointRows, boundary });
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
      question_planner_conflict_detector_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_question_planner_conflict_detector_summary: source.data?.summary ?? null,
    answer_capture_spec_state_machine_contract: buildContract(generatedAt),
    answer_capture_spec_state_machine_phase_rows: phaseRows,
    p32000_source_binding_rows: sourceRows,
    answer_capture_contract_rows: answerRows,
    spec_state_machine_rows: stateRows,
    answer_redaction_boundary_rows: redactionRows,
    state_transition_validator_rows: transitionRows,
    no_seed_synthesis_boundary_rows: boundaryRows,
    p32400_clean_checkpoint_rows: checkpointRows,
    answer_capture_spec_state_machine_boundary: boundary,
    answer_capture_spec_state_machine_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "answer_capture_spec_state_machine")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.answer_capture_spec_state_machine_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.answer_capture_spec_state_machine_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeAnswerCaptureSpecStateMachine(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "answer-capture-spec-state-machine.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p32000-source-binding-rows.json"), collectionEnvelope("p32000-source-binding-rows.v1", "p32000_source_binding_rows", result.p32000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "answer-capture-contract-rows.json"), collectionEnvelope("answer-capture-contract-rows.v1", "answer_capture_contract_rows", result.answer_capture_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "spec-state-machine-rows.json"), collectionEnvelope("spec-state-machine-rows.v1", "spec_state_machine_rows", result.spec_state_machine_rows, result.generated_at));
  await writeJson(path.join(outDir, "answer-redaction-boundary-rows.json"), collectionEnvelope("answer-redaction-boundary-rows.v1", "answer_redaction_boundary_rows", result.answer_redaction_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "state-transition-validator-rows.json"), collectionEnvelope("state-transition-validator-rows.v1", "state_transition_validator_rows", result.state_transition_validator_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-seed-synthesis-boundary-rows.json"), collectionEnvelope("no-seed-synthesis-boundary-rows.v1", "no_seed_synthesis_boundary_rows", result.no_seed_synthesis_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p32400-clean-checkpoint-rows.json"), collectionEnvelope("p32400-clean-checkpoint-rows.v1", "p32400_clean_checkpoint_rows", result.p32400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "answer-capture-spec-state-machine-boundary.json"), result.answer_capture_spec_state_machine_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runAnswerCaptureSpecStateMachineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runAnswerCaptureSpecStateMachine(args);
  console.log(`Answer Capture Spec State Machine ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.answer_capture_spec_state_machine_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P32000 ready for answer capture: ${result.summary.source_p32000_ready_for_answer_capture}`);
  console.log(`Answer contract rows: ${result.summary.answer_capture_contract_count}`);
  console.log(`Spec state rows: ${result.summary.spec_state_machine_count}`);
  console.log(`Transition validator rows: ${result.summary.state_transition_validator_count}`);
  console.log(`Ready for seed readiness gate: ${result.summary.ready_for_seed_readiness_gate}`);
  console.log(`Live answer capture allowed: ${result.summary.answer_capture_live_answer_capture_allowed_now}`);
  console.log(`Seed synthesis allowed: ${result.summary.answer_capture_seed_synthesis_allowed_now}`);
  console.log(`Runtime allowed: ${result.summary.answer_capture_runtime_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.question_planner_conflict_detector_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_answer_capture_state_machine === true,
    status: summary.question_planner_conflict_detector_status ?? "missing",
    p32000ContractReady: boundary.p32000_contract_ready === true,
    questionPlannerVisible: boundary.question_planner_visible_now === true,
    conflictDetectorVisible: boundary.question_conflict_detector_visible_now === true,
    bundleVisible: boundary.clarification_bundle_visible_now === true,
    priorityPolicyVisible: boundary.question_priority_policy_visible_now === true,
    noAutoQuestionClosed: boundary.no_auto_question_boundary_closed_now === true,
    boundaryClosed: P32000_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p32001-p32400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P32000 question planner conflict detector source is available", sourceState.available],
    ["program_range", "P32000 source program range is P31601-P32000", sourceState.programRangeOk],
    ["validation_valid", "P32000 source validation is valid", sourceState.validationValid],
    ["answer_capture_handoff_open", "P32000 opened answer capture state machine handoff", sourceState.sourceReady],
    ["p32000_contract_ready", "P32000 source contract is ready", sourceState.p32000ContractReady],
    ["question_planner_visible", "P32000 question planner rows are visible", sourceState.questionPlannerVisible],
    ["conflict_detector_visible", "P32000 conflict detector rows are visible", sourceState.conflictDetectorVisible],
    ["clarification_bundle_visible", "P32000 clarification bundle rows are visible", sourceState.bundleVisible],
    ["priority_policy_visible", "P32000 priority policy rows are visible", sourceState.priorityPolicyVisible],
    ["no_auto_question_boundary_closed", "P32000 no-auto-question boundary is closed", sourceState.noAutoQuestionClosed],
    ["commit_ref_present", "Current commit ref is present for answer capture state machine", Boolean(commitRef)],
    ["source_blocker_visible", "P32000 source blocker is visible when answer capture is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p32000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildAnswerCaptureContractRows({ source, generatedAt }) {
  const bundleRows = source.data?.clarification_bundle_rows ?? [];
  const priorityRows = source.data?.question_priority_policy_rows ?? [];
  return bundleRows.map((bundle) => {
    const priorities = priorityRows.filter((item) => item.request_id === bundle.request_id);
    return row({
      row_id: `answer_capture_contract.${bundle.request_id}`,
      category: "answer_capture_contract",
      label: `Answer capture contract for ${bundle.request_id}`,
      observed: bundle.question_count > 0 && Array.isArray(bundle.question_ids),
      evidence_ref: bundle.row_id,
      request_id: bundle.request_id,
      expected_question_ids: bundle.question_ids,
      expected_answer_ref: `answer_ref.${bundle.request_id}.pending`,
      answer_receipt_required: true,
      answer_receipt_present_now: false,
      raw_answer_persisted_now: false,
      raw_answer_exposed_now: false,
      redacted_answer_summary_allowed_later: true,
      source_priority_bands: [...new Set(priorities.map((item) => item.priority_band))],
      live_answer_capture_allowed_now: false,
      seed_synthesis_allowed_now: false,
      contract_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildSpecStateMachineRows({ source, answerRows, generatedAt }) {
  const conflictRows = source.data?.question_conflict_detector_rows ?? [];
  const rows = [];
  for (const answer of answerRows) {
    const conflict = conflictRows.find((item) => item.request_id === answer.request_id);
    for (const [fromState, toState, description] of STATE_TRANSITIONS) {
      const canTransitionNow = fromState === "question_planned" && toState === "awaiting_user_answer";
      rows.push(row({
        row_id: `spec_state_machine.${answer.request_id}.${fromState}.to.${toState}`,
        category: "spec_state_machine",
        label: description,
        observed: Boolean(answer.request_id),
        evidence_ref: answer.row_id,
        request_id: answer.request_id,
        from_state: fromState,
        to_state: toState,
        transition_allowed_later: true,
        transition_allowed_now: canTransitionNow,
        answer_receipt_required: toState !== "awaiting_user_answer",
        answer_receipt_present_now: false,
        conflict_refs: conflict?.conflict_refs ?? [],
        spec_mutation_allowed_now: false,
        seed_synthesis_allowed_now: false,
        state_metadata_only: true,
        generated_at: generatedAt,
      }));
    }
  }
  return rows;
}

function buildAnswerRedactionBoundaryRows({ answerRows, generatedAt }) {
  return answerRows.map((answer) => row({
    row_id: `answer_redaction_boundary.${answer.request_id}`,
    category: "answer_redaction_boundary",
    label: `Answer redaction boundary for ${answer.request_id}`,
    observed: answer.raw_answer_persisted_now === false && answer.raw_answer_exposed_now === false,
    evidence_ref: answer.row_id,
    request_id: answer.request_id,
    raw_answer_persisted_now: false,
    raw_answer_exposed_now: false,
    secret_scan_required_before_answer_receipt: true,
    pii_or_secret_redaction_required: true,
    answer_hash_or_ref_required: true,
    redacted_summary_ui_only: true,
    live_answer_capture_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildStateTransitionValidatorRows({ stateRows, redactionRows, generatedAt }) {
  return stateRows.map((state) => {
    const redaction = redactionRows.find((item) => item.request_id === state.request_id);
    const redactionClosed = redaction?.raw_answer_persisted_now === false && redaction?.raw_answer_exposed_now === false;
    const blockedUntilReceipt = state.answer_receipt_required === true && state.answer_receipt_present_now === false;
    return row({
      row_id: `state_transition_validator.${state.request_id}.${state.from_state}.to.${state.to_state}`,
      category: "state_transition_validator",
      label: `Transition validator for ${state.request_id} ${state.from_state} to ${state.to_state}`,
      observed: Boolean(redaction) && redactionClosed,
      evidence_ref: state.row_id,
      request_id: state.request_id,
      from_state: state.from_state,
      to_state: state.to_state,
      redaction_boundary_closed: redactionClosed,
      blocked_until_answer_receipt: blockedUntilReceipt,
      transition_allowed_now: state.transition_allowed_now === true && !blockedUntilReceipt,
      spec_mutation_allowed_now: false,
      seed_synthesis_allowed_now: false,
      validator_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoSeedSynthesisBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_seed_synthesis.${flag}`,
    category: "no_seed_synthesis_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "answer_capture_spec_state_machine_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.answerRows)
    && allPass(context.stateRows)
    && allPass(context.redactionRows)
    && allPass(context.transitionRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P32000 source is ready for answer capture state machine", context.sourceState.sourceReady],
    ["answer_capture_contract_visible", "Answer capture contract rows are visible", allPass(context.answerRows)],
    ["spec_state_machine_visible", "Spec state machine rows are visible", allPass(context.stateRows)],
    ["answer_redaction_boundary_visible", "Answer redaction boundary rows are visible", allPass(context.redactionRows)],
    ["state_transition_validator_visible", "State transition validator rows are visible", allPass(context.transitionRows)],
    ["no_seed_synthesis_boundary_closed", "No-seed-synthesis boundary remains closed", allPass(context.boundaryRows)],
    ["seed_readiness_gate", "Seed readiness gate handoff opens only when answer capture contract metadata is valid", ready],
    ["seed_readiness_blocker_visible", "Seed readiness blocker is visible while seed synthesis remains closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p32400_checkpoint.${id}`,
    category: "p32400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p32400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p32400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.answerRows)
    && allPass(context.stateRows)
    && allPass(context.redactionRows)
    && allPass(context.transitionRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p32400_checkpoint.seed_readiness_blocker_visible");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p32400ContractReady;
  return {
    p32400_contract_ready: p32400ContractReady,
    ready_for_seed_readiness_gate: ready,
    source_p32000_ready_for_answer_capture: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    answer_capture_contract_visible_now: allPass(context.answerRows),
    spec_state_machine_visible_now: allPass(context.stateRows),
    answer_redaction_boundary_visible_now: allPass(context.redactionRows),
    state_transition_validator_visible_now: allPass(context.transitionRows),
    no_seed_synthesis_boundary_closed_now: allPass(context.boundaryRows),
    answer_capture_contract_count: context.answerRows.length,
    spec_state_machine_count: context.stateRows.length,
    answer_redaction_boundary_count: context.redactionRows.length,
    state_transition_validator_count: context.transitionRows.length,
    answer_receipt_present_count: context.answerRows.filter((item) => item.answer_receipt_present_now === true).length,
    seed_synthesis_candidate_count: 0,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P32001-P32400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P32001-P32400 Answer Capture and Spec State Machine"), "Architecture doc missing P32001-P32400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P32000 source state is not visible"),
    validationItem("answer.contract.visible", "answer_capture", allPass(context.answerRows), "Answer capture contract rows are incomplete"),
    validationItem("state.machine.visible", "answer_capture", allPass(context.stateRows), "Spec state machine rows are incomplete"),
    validationItem("redaction.boundary.visible", "answer_capture", allPass(context.redactionRows), "Answer redaction boundary rows are incomplete"),
    validationItem("transition.validator.visible", "answer_capture", allPass(context.transitionRows), "State transition validator rows are incomplete"),
    validationItem("answer.no_raw", "authority", context.redactionRows.every((item) => item.raw_answer_persisted_now === false && item.raw_answer_exposed_now === false), "Raw answer exposure opened"),
    validationItem("answer.not_captured", "authority", context.answerRows.every((item) => item.answer_receipt_present_now === false && item.live_answer_capture_allowed_now === false), "Live answer capture opened"),
    validationItem("state.no_seed", "authority", context.transitionRows.every((item) => item.seed_synthesis_allowed_now === false), "Seed synthesis opened in state validator"),
    validationItem("boundary.no_seed", "authority", context.boundary.answer_capture_seed_synthesis_allowed_now === false && context.boundary.answer_capture_live_answer_capture_allowed_now === false && context.boundary.answer_capture_production_pass_allowed_now === false, "Answer capture authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p32400_checkpoint.seed_readiness_blocker_visible"), "P32400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "answer_capture_spec_state_machine.contract.v1",
    generated_at: generatedAt,
    source_p32000_required_or_rebuilt: true,
    answer_capture_contract_required: true,
    spec_state_machine_required: true,
    answer_redaction_boundary_required: true,
    state_transition_validator_required: true,
    no_seed_synthesis_boundary_required: true,
    seed_synthesis_deferred_to_p32401_p32800: true,
    defaults_assumptions_deferred_to_p32801_p33200: true,
    p32400_is_not_live_answer_capture_seed_synthesis_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_seed_readiness_gate
    ? READY_STATUS
    : validation.valid && boundary.p32400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    answer_capture_spec_state_machine_status: status,
    source_p32000_ready_for_answer_capture: boundary.source_p32000_ready_for_answer_capture,
    answer_capture_contract_count: boundary.answer_capture_contract_count,
    spec_state_machine_count: boundary.spec_state_machine_count,
    answer_redaction_boundary_count: boundary.answer_redaction_boundary_count,
    state_transition_validator_count: boundary.state_transition_validator_count,
    answer_receipt_present_count: boundary.answer_receipt_present_count,
    seed_synthesis_candidate_count: boundary.seed_synthesis_candidate_count,
    ready_for_seed_readiness_gate: validation.valid && boundary.ready_for_seed_readiness_gate,
    answer_capture_live_answer_capture_allowed_now: false,
    answer_capture_raw_answer_persist_allowed_now: false,
    answer_capture_raw_answer_exposure_allowed_now: false,
    answer_capture_seed_synthesis_allowed_now: false,
    answer_capture_runtime_execution_allowed_now: false,
    answer_capture_write_action_allowed_now: false,
    answer_capture_protected_action_allowed_now: false,
    answer_capture_final_approval_allowed_now: false,
    answer_capture_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Answer Capture Spec State Machine",
    "",
    `Status: ${result.summary.answer_capture_spec_state_machine_status}`,
    `Program: ${result.program_range}`,
    `P32000 ready for answer capture: ${result.summary.source_p32000_ready_for_answer_capture}`,
    `Answer contract rows: ${result.summary.answer_capture_contract_count}`,
    `Spec state rows: ${result.summary.spec_state_machine_count}`,
    `Transition validator rows: ${result.summary.state_transition_validator_count}`,
    `Answer receipts present: ${result.summary.answer_receipt_present_count}`,
    `Ready for seed readiness gate: ${result.summary.ready_for_seed_readiness_gate}`,
    `Live answer capture allowed: ${result.summary.answer_capture_live_answer_capture_allowed_now}`,
    `Seed synthesis allowed: ${result.summary.answer_capture_seed_synthesis_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.answer_capture_contract_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.expected_question_ids.length)}</td><td>${escapeHtml(item.answer_receipt_present_now)}</td><td>${escapeHtml(item.raw_answer_exposed_now)}</td><td>${escapeHtml(item.seed_synthesis_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Answer Capture Spec State Machine</title>
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
    <h1>Hermes Answer Capture Spec State Machine</h1>
    <p class="notice">This artifact defines answer capture and spec state metadata only. It does not capture live answers, expose raw answers, synthesize seeds, execute runtime actions, write files, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Questions</th><th>Answer Receipt</th><th>Raw Exposed</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP32000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildQuestionPlannerConflictDetector({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.question_planner_conflict_detector", built);
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
  const defaults = DEFAULT_ANSWER_CAPTURE_SPEC_STATE_MACHINE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_question_planner_conflict_detector_path: path.resolve(repoRoot, options.sourceQuestionPlannerConflictDetectorPath ?? defaults.sourceQuestionPlannerConflictDetectorPath),
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
      args.sourceQuestionPlannerConflictDetectorPath = argv[++index];
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
  console.log(`Usage: node scripts/answer-capture-spec-state-machine.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P32001-P32400 Answer Capture Contract and Spec State Machine.
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
