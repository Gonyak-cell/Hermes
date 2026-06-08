import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P34000_FALSE_FLAGS,
  buildClarificationReplayCaptureContract,
} from "./clarification-replay-capture-contract.mjs";

export const DEFAULT_SEED_RECHECK_VALIDATION_CONTRACT_OUT_DIR = "artifacts/seed-recheck-validation-contract/latest";
export const DEFAULT_SEED_RECHECK_VALIDATION_CONTRACT_INPUTS = {
  schemaPath: "schemas/seed-recheck-validation-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p34001-p34400.md",
  architectureDocPath: "docs/architecture.md",
  sourceClarificationReplayCaptureContractPath: "artifacts/clarification-replay-capture-contract/latest/clarification-replay-capture-contract.json",
};

const COMMAND_NAME = "platform:seed-recheck-validation-contract";
const SCHEMA_VERSION = "seed-recheck-validation-contract.v1";
const CAPABILITY_ID = "platform.seed_recheck_validation_contract";
const PROGRAM_RANGE = "P34001-P34400";
const SOURCE_PROGRAM_RANGE = "P33601-P34000";
const READY_STATUS = "ready_for_seed_recheck_validation_contract";
const BLOCK_PENDING_STATUS = "valid_block_seed_recheck_validation_contract_pending";
const BLOCKED_STATUS = "blocked_seed_recheck_validation_contract";

const PHASE_SPECS = [
  ["P34001-P34040", "P34000 Source Binding", "p34000_source_binding_rows"],
  ["P34041-P34080", "Clarification Sufficiency Evidence", "clarification_sufficiency_evidence_rows"],
  ["P34081-P34120", "Missing Answer Blocker Rules", "missing_answer_blocker_rule_rows"],
  ["P34121-P34180", "Seed Recheck Validator Candidate", "seed_recheck_validator_candidate_rows"],
  ["P34181-P34240", "No-Fake-Execution Gate", "no_fake_execution_gate_rows"],
  ["P34241-P34300", "Operator Seed Recheck Projection", "operator_seed_recheck_projection_rows"],
  ["P34301-P34360", "Seed Recheck Contract Wiring", "seed_recheck_contract_wiring_rows"],
  ["P34361-P34400", "P34400 Clean Checkpoint", "p34400_clean_checkpoint_rows"],
];

export const SEED_RECHECK_VALIDATION_CONTRACT_FALSE_FLAGS = [
  "seed_recheck_actual_answer_capture_allowed_now",
  "seed_recheck_raw_answer_persist_allowed_now",
  "seed_recheck_raw_answer_exposure_allowed_now",
  "seed_recheck_sufficiency_auto_pass_allowed_now",
  "seed_recheck_missing_answer_bypass_allowed_now",
  "seed_recheck_stale_context_bypass_allowed_now",
  "seed_recheck_conflict_bypass_allowed_now",
  "seed_recheck_execution_allowed_now",
  "seed_recheck_verification_pass_allowed_now",
  "seed_recheck_seed_unblock_allowed_now",
  "seed_recheck_final_seed_allowed_now",
  "seed_recheck_runtime_execution_allowed_now",
  "seed_recheck_write_action_allowed_now",
  "seed_recheck_protected_action_allowed_now",
  "seed_recheck_connector_write_allowed_now",
  "seed_recheck_deployment_allowed_now",
  "seed_recheck_review_completion_allowed_now",
  "seed_recheck_final_approval_allowed_now",
  "seed_recheck_production_pass_allowed_now",
  "seed_recheck_enterprise_trust_claim_allowed_now",
  "seed_recheck_secret_read_allowed_now",
  "seed_recheck_human_gate_bypass_allowed_now",
  "seed_recheck_independent_review_bypass_allowed_now",
  "seed_recheck_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...SEED_RECHECK_VALIDATION_CONTRACT_FALSE_FLAGS, ...P34000_FALSE_FLAGS])];

export async function runSeedRecheckValidationContract(options = {}) {
  const result = await buildSeedRecheckValidationContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Seed Recheck Validation Contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeSeedRecheckValidationContract(result, result.output_dir);
  return result;
}

export async function buildSeedRecheckValidationContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SEED_RECHECK_VALIDATION_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "clarificationReplayCaptureContract")
    ? normalizeInlineJsonSource("inline.clarification_replay_capture_contract", options.clarificationReplayCaptureContract)
    : await readJsonOrBuildP34000(inputs.source_clarification_replay_capture_contract_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const sufficiencyRows = buildClarificationSufficiencyEvidenceRows({ source, generatedAt });
  const blockerRows = buildMissingAnswerBlockerRuleRows({ sufficiencyRows, generatedAt });
  const validatorRows = buildSeedRecheckValidatorCandidateRows({ source, sufficiencyRows, blockerRows, generatedAt });
  const noFakeRows = buildNoFakeExecutionGateRows(generatedAt);
  const operatorRows = buildOperatorProjectionRows({ validatorRows, blockerRows, generatedAt });
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, sufficiencyRows, blockerRows, validatorRows, noFakeRows, operatorRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, sufficiencyRows, blockerRows, validatorRows, noFakeRows, operatorRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, sufficiencyRows, blockerRows, validatorRows, noFakeRows, operatorRows, wiringRows, checkpointRows, boundary });
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
      clarification_replay_capture_contract_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_clarification_replay_capture_summary: source.data?.summary ?? null,
    seed_recheck_validation_contract: buildContract(generatedAt),
    seed_recheck_validation_phase_rows: phaseRows,
    p34000_source_binding_rows: sourceRows,
    clarification_sufficiency_evidence_rows: sufficiencyRows,
    missing_answer_blocker_rule_rows: blockerRows,
    seed_recheck_validator_candidate_rows: validatorRows,
    no_fake_execution_gate_rows: noFakeRows,
    operator_seed_recheck_projection_rows: operatorRows,
    seed_recheck_contract_wiring_rows: wiringRows,
    p34400_clean_checkpoint_rows: checkpointRows,
    seed_recheck_validation_boundary: boundary,
    seed_recheck_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "seed_recheck_validation_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.seed_recheck_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.seed_recheck_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeSeedRecheckValidationContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "seed-recheck-validation-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p34000-source-binding-rows.json"), collectionEnvelope("p34000-source-binding-rows.v1", "p34000_source_binding_rows", result.p34000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "clarification-sufficiency-evidence-rows.json"), collectionEnvelope("clarification-sufficiency-evidence-rows.v1", "clarification_sufficiency_evidence_rows", result.clarification_sufficiency_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "missing-answer-blocker-rule-rows.json"), collectionEnvelope("missing-answer-blocker-rule-rows.v1", "missing_answer_blocker_rule_rows", result.missing_answer_blocker_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-recheck-validator-candidate-rows.json"), collectionEnvelope("seed-recheck-validator-candidate-rows.v1", "seed_recheck_validator_candidate_rows", result.seed_recheck_validator_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-fake-execution-gate-rows.json"), collectionEnvelope("no-fake-execution-gate-rows.v1", "no_fake_execution_gate_rows", result.no_fake_execution_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-seed-recheck-projection-rows.json"), collectionEnvelope("operator-seed-recheck-projection-rows.v1", "operator_seed_recheck_projection_rows", result.operator_seed_recheck_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-recheck-contract-wiring-rows.json"), collectionEnvelope("seed-recheck-contract-wiring-rows.v1", "seed_recheck_contract_wiring_rows", result.seed_recheck_contract_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p34400-clean-checkpoint-rows.json"), collectionEnvelope("p34400-clean-checkpoint-rows.v1", "p34400_clean_checkpoint_rows", result.p34400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-recheck-validation-boundary.json"), result.seed_recheck_validation_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runSeedRecheckValidationContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runSeedRecheckValidationContract(args);
  console.log(`Seed Recheck Validation Contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.seed_recheck_validation_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P34000 ready for seed recheck validation: ${result.summary.source_p34000_ready_for_seed_recheck_validation}`);
  console.log(`Clarification sufficiency rows: ${result.summary.clarification_sufficiency_evidence_count}`);
  console.log(`Missing answer blocker rows: ${result.summary.missing_answer_blocker_rule_count}`);
  console.log(`Seed recheck validator candidates: ${result.summary.seed_recheck_validator_candidate_count}`);
  console.log(`Ready for commercial spec readiness handoff: ${result.summary.ready_for_commercial_spec_readiness_handoff}`);
  console.log(`Sufficiency auto PASS allowed: ${result.summary.seed_recheck_sufficiency_auto_pass_allowed_now}`);
  console.log(`Seed recheck execution allowed: ${result.summary.seed_recheck_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.clarification_replay_capture_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_seed_recheck_validation_handoff === true,
    status: summary.clarification_replay_capture_status ?? "missing",
    p34000ContractReady: boundary.p34000_contract_ready === true,
    redactedReceiptVisible: boundary.redacted_answer_receipt_intake_visible_now === true,
    replayTraceVisible: boundary.question_replay_trace_binding_visible_now === true,
    replayCompletionVisible: boundary.replay_ledger_completion_candidate_visible_now === true,
    seedCandidateVisible: boundary.seed_recheck_candidate_visible_now === true,
    noExecutionNoRawClosed: boundary.no_execution_no_raw_boundary_closed_now === true,
    boundaryClosed: P34000_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p34001-p34400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P34000 clarification replay capture source is available", sourceState.available],
    ["program_range", "P34000 source program range is P33601-P34000", sourceState.programRangeOk],
    ["validation_valid", "P34000 source validation is valid", sourceState.validationValid],
    ["seed_recheck_validation_handoff_open", "P34000 opened seed recheck validation handoff", sourceState.sourceReady],
    ["p34000_contract_ready", "P34000 source contract is ready", sourceState.p34000ContractReady],
    ["redacted_receipt_visible", "P34000 redacted answer receipt intake rows are visible", sourceState.redactedReceiptVisible],
    ["question_replay_trace_visible", "P34000 question replay trace binding rows are visible", sourceState.replayTraceVisible],
    ["replay_completion_candidate_visible", "P34000 replay completion candidates are visible", sourceState.replayCompletionVisible],
    ["seed_recheck_candidate_visible", "P34000 seed recheck candidates are visible", sourceState.seedCandidateVisible],
    ["no_execution_no_raw_closed", "P34000 no-execution/no-raw boundary is closed", sourceState.noExecutionNoRawClosed],
    ["commit_ref_present", "Current commit ref is present for seed recheck validation", Boolean(commitRef)],
    ["source_blocker_visible", "P34000 source blocker is visible when seed recheck validation is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p34000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildClarificationSufficiencyEvidenceRows({ source, generatedAt }) {
  const seedRows = source.data?.seed_recheck_candidate_rows ?? [];
  return seedRows.map((seed) => row({
    row_id: `clarification_sufficiency.${seed.request_id}`,
    category: "clarification_sufficiency_evidence",
    label: `Clarification sufficiency evidence candidate for ${seed.request_id}`,
    observed: Boolean(seed.request_id && seed.seed_recheck_candidate_visible_now === true),
    evidence_ref: seed.row_id,
    request_id: seed.request_id,
    slot_ref: seed.slot_ref,
    seed_recheck_candidate_ref: seed.seed_recheck_candidate_ref,
    required_evidence_refs: seed.required_before_recheck_refs ?? [],
    redacted_answer_receipt_present_now: false,
    question_replay_trace_present_now: false,
    conflict_resolution_receipt_present_now: false,
    stale_context_recheck_present_now: false,
    clarification_sufficiency_candidate_visible_now: true,
    clarification_sufficiency_pass_allowed_now: false,
    seed_recheck_sufficiency_auto_pass_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildMissingAnswerBlockerRuleRows({ sufficiencyRows, generatedAt }) {
  const blockerSpecs = [
    ["missing_redacted_answer_receipt", "Redacted answer receipt is missing"],
    ["missing_question_replay_trace", "Question replay trace is missing"],
    ["unresolved_conflict_receipt", "Conflict resolution receipt is missing"],
    ["stale_context_recheck", "Stale context recheck receipt is missing"],
  ];
  return sufficiencyRows.flatMap((sufficiency) => blockerSpecs.map(([id, label]) => row({
    row_id: `missing_answer_blocker.${sufficiency.request_id}.${id}`,
    category: "missing_answer_blocker_rule",
    label: `${label} for ${sufficiency.request_id}`,
    observed: true,
    evidence_ref: sufficiency.row_id,
    request_id: sufficiency.request_id,
    blocker_type: id,
    blocker_visible_now: true,
    blocker_must_prevent_sufficiency_pass: true,
    missing_answer_bypass_allowed_now: false,
    stale_context_bypass_allowed_now: false,
    conflict_bypass_allowed_now: false,
    generated_at: generatedAt,
  })));
}

function buildSeedRecheckValidatorCandidateRows({ source, sufficiencyRows, blockerRows, generatedAt }) {
  const completionRows = source.data?.replay_ledger_completion_candidate_rows ?? [];
  return sufficiencyRows.map((sufficiency) => {
    const completion = completionRows.find((item) => item.request_id === sufficiency.request_id);
    const blockers = blockerRows.filter((item) => item.request_id === sufficiency.request_id);
    return row({
      row_id: `seed_recheck_validator_candidate.${sufficiency.request_id}`,
      category: "seed_recheck_validator_candidate",
      label: `Seed recheck validator candidate for ${sufficiency.request_id}`,
      observed: Boolean(completion && blockers.length >= 4),
      evidence_ref: sufficiency.row_id,
      request_id: sufficiency.request_id,
      validator_candidate_ref: `seed_recheck_validator.${sufficiency.request_id}.candidate`,
      completion_candidate_ref: completion?.completion_candidate_ref ?? null,
      required_blocker_refs: blockers.map((item) => item.row_id),
      validator_candidate_visible_now: true,
      validator_run_allowed_now: false,
      sufficiency_pass_allowed_now: false,
      seed_recheck_execution_allowed_now: false,
      seed_recheck_verification_pass_allowed_now: false,
      seed_unblock_allowed_now: false,
      final_seed_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoFakeExecutionGateRows(generatedAt) {
  const stateRows = [
    ["state.ready_is_not_executed", "Ready state must not imply execution", true],
    ["state.candidate_is_not_pass", "Candidate state must not imply PASS", true],
    ["state.visible_blocker_is_not_failure", "Visible blocker is a valid blocked state, not a hidden failure", true],
    ["state.recheck_validator_is_not_seed_unblock", "Validator candidate must not unblock seed", true],
    ["state.operator_projection_is_not_action_surface", "Operator projection must not enable action controls", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_fake_execution_gate.${id}`,
    category: "no_fake_execution_gate",
    label,
    observed,
    evidence_ref: "seed_recheck_validation_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_fake_execution_gate.${flag}`,
    category: "no_fake_execution_gate",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "seed_recheck_validation_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildOperatorProjectionRows({ validatorRows, blockerRows, generatedAt }) {
  return validatorRows.map((validator) => {
    const blockers = blockerRows.filter((item) => item.request_id === validator.request_id);
    return row({
      row_id: `operator_seed_recheck_projection.${validator.request_id}`,
      category: "operator_seed_recheck_projection",
      label: `Operator seed recheck projection for ${validator.request_id}`,
      observed: blockers.length >= 4,
      evidence_ref: validator.row_id,
      request_id: validator.request_id,
      operator_status: "blocked_missing_clarification_evidence",
      blocker_count: blockers.length,
      next_action: "collect_redacted_answer_receipt_and_replay_trace",
      action_button_enabled_now: false,
      approve_button_enabled_now: false,
      execute_button_enabled_now: false,
      production_pass_enabled_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P34400 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/seed-recheck-validation-contract.schema.json"],
    ["roadmap_doc", "Roadmap documents all P34001-P34400 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p34001-p34400.md"],
    ["architecture_doc", "Architecture doc references P34001-P34400", architectureDoc.text.includes("P34001-P34400 Seed Recheck Validation Contract"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `seed_recheck_contract_wiring.${id}`,
    category: "seed_recheck_contract_wiring",
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
    && allPass(context.sufficiencyRows)
    && allPass(context.blockerRows)
    && allPass(context.validatorRows)
    && allPass(context.noFakeRows)
    && allPass(context.operatorRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P34000 source is ready for seed recheck validation", context.sourceState.sourceReady],
    ["sufficiency_evidence_visible", "Clarification sufficiency evidence rows are visible", allPass(context.sufficiencyRows)],
    ["missing_answer_blockers_visible", "Missing answer blockers are visible", allPass(context.blockerRows)],
    ["validator_candidate_visible", "Seed recheck validator candidate rows are visible", allPass(context.validatorRows)],
    ["no_fake_execution_gate_closed", "No-fake-execution gate stays closed", allPass(context.noFakeRows)],
    ["operator_projection_visible", "Operator projection rows are visible", allPass(context.operatorRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["sufficiency_auto_pass_blocked", "Sufficiency auto PASS stays blocked", true],
    ["seed_execution_blocked", "Seed recheck execution stays blocked", true],
    ["commercial_spec_readiness_handoff", "Commercial spec readiness handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p34400_checkpoint.${id}`,
    category: "p34400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p34400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p34400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.sufficiencyRows)
    && allPass(context.blockerRows)
    && allPass(context.validatorRows)
    && allPass(context.noFakeRows)
    && allPass(context.operatorRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p34400_checkpoint.sufficiency_auto_pass_blocked")
    && visibleOrPassed(context.checkpointRows, "p34400_checkpoint.seed_execution_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p34400ContractReady;
  return {
    p34400_contract_ready: p34400ContractReady,
    ready_for_commercial_spec_readiness_handoff: ready,
    source_p34000_ready_for_seed_recheck_validation: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    clarification_sufficiency_evidence_visible_now: allPass(context.sufficiencyRows),
    missing_answer_blocker_rules_visible_now: allPass(context.blockerRows),
    seed_recheck_validator_candidate_visible_now: allPass(context.validatorRows),
    no_fake_execution_gate_closed_now: allPass(context.noFakeRows),
    operator_seed_recheck_projection_visible_now: allPass(context.operatorRows),
    seed_recheck_contract_wiring_complete_now: allPass(context.wiringRows),
    clarification_sufficiency_evidence_count: context.sufficiencyRows.length,
    missing_answer_blocker_rule_count: context.blockerRows.length,
    seed_recheck_validator_candidate_count: context.validatorRows.length,
    operator_projection_count: context.operatorRows.length,
    sufficiency_auto_pass_allowed_count: context.sufficiencyRows.filter((item) => item.seed_recheck_sufficiency_auto_pass_allowed_now === true).length,
    seed_recheck_execution_allowed_count: context.validatorRows.filter((item) => item.seed_recheck_execution_allowed_now === true).length,
    seed_recheck_pass_allowed_count: context.validatorRows.filter((item) => item.seed_recheck_verification_pass_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P34001-P34400 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P34000 source state is not visible"),
    validationItem("sufficiency.visible", "seed_recheck", allPass(context.sufficiencyRows), "Clarification sufficiency evidence rows are incomplete"),
    validationItem("blockers.visible", "seed_recheck", allPass(context.blockerRows), "Missing answer blocker rule rows are incomplete"),
    validationItem("validator.candidate.visible", "seed_recheck", allPass(context.validatorRows), "Seed recheck validator candidates are incomplete"),
    validationItem("operator.projection.visible", "operator", allPass(context.operatorRows), "Operator projection rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P34001-P34400 wiring is incomplete"),
    validationItem("no.sufficiency.auto.pass", "authority", context.sufficiencyRows.every((item) => item.seed_recheck_sufficiency_auto_pass_allowed_now === false && item.clarification_sufficiency_pass_allowed_now === false), "Clarification sufficiency auto PASS opened"),
    validationItem("no.blocker.bypass", "authority", context.blockerRows.every((item) => item.missing_answer_bypass_allowed_now === false && item.stale_context_bypass_allowed_now === false && item.conflict_bypass_allowed_now === false), "Missing answer or conflict bypass opened"),
    validationItem("no.seed.execution", "authority", context.validatorRows.every((item) => item.seed_recheck_execution_allowed_now === false && item.seed_unblock_allowed_now === false && item.final_seed_allowed_now === false), "Seed execution or unblock opened"),
    validationItem("no.operator.actions", "authority", context.operatorRows.every((item) => item.action_button_enabled_now === false && item.approve_button_enabled_now === false && item.execute_button_enabled_now === false), "Operator action surface opened"),
    validationItem("no.fake.execution", "authority", allPass(context.noFakeRows), "No-fake-execution gate is incomplete"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p34400_checkpoint.sufficiency_auto_pass_blocked"), "P34400 sufficiency auto PASS checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "seed_recheck_validation.contract.v1",
    generated_at: generatedAt,
    source_p34000_required_or_rebuilt: true,
    clarification_sufficiency_evidence_required: true,
    missing_answer_blocker_rules_required: true,
    seed_recheck_validator_candidate_required: true,
    no_fake_execution_gate_required: true,
    operator_projection_required: true,
    p34400_is_not_sufficiency_pass_seed_execution_seed_unblock_final_seed_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_commercial_spec_readiness_handoff
    ? READY_STATUS
    : validation.valid && boundary.p34400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    seed_recheck_validation_status: status,
    source_p34000_ready_for_seed_recheck_validation: boundary.source_p34000_ready_for_seed_recheck_validation,
    clarification_sufficiency_evidence_count: boundary.clarification_sufficiency_evidence_count,
    missing_answer_blocker_rule_count: boundary.missing_answer_blocker_rule_count,
    seed_recheck_validator_candidate_count: boundary.seed_recheck_validator_candidate_count,
    operator_projection_count: boundary.operator_projection_count,
    sufficiency_auto_pass_allowed_count: boundary.sufficiency_auto_pass_allowed_count,
    seed_recheck_execution_allowed_count: boundary.seed_recheck_execution_allowed_count,
    seed_recheck_pass_allowed_count: boundary.seed_recheck_pass_allowed_count,
    ready_for_commercial_spec_readiness_handoff: validation.valid && boundary.ready_for_commercial_spec_readiness_handoff,
    seed_recheck_sufficiency_auto_pass_allowed_now: false,
    seed_recheck_execution_allowed_now: false,
    seed_recheck_verification_pass_allowed_now: false,
    seed_recheck_seed_unblock_allowed_now: false,
    seed_recheck_final_seed_allowed_now: false,
    seed_recheck_runtime_execution_allowed_now: false,
    seed_recheck_write_action_allowed_now: false,
    seed_recheck_protected_action_allowed_now: false,
    seed_recheck_final_approval_allowed_now: false,
    seed_recheck_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Seed Recheck Validation Contract",
    "",
    `Status: ${result.summary.seed_recheck_validation_status}`,
    `Program: ${result.program_range}`,
    `P34000 ready for seed recheck validation: ${result.summary.source_p34000_ready_for_seed_recheck_validation}`,
    `Clarification sufficiency rows: ${result.summary.clarification_sufficiency_evidence_count}`,
    `Missing answer blocker rows: ${result.summary.missing_answer_blocker_rule_count}`,
    `Seed recheck validator candidates: ${result.summary.seed_recheck_validator_candidate_count}`,
    `Ready for commercial spec readiness handoff: ${result.summary.ready_for_commercial_spec_readiness_handoff}`,
    `Sufficiency auto PASS allowed: ${result.summary.seed_recheck_sufficiency_auto_pass_allowed_now}`,
    `Seed recheck execution allowed: ${result.summary.seed_recheck_execution_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.seed_recheck_validator_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.validator_candidate_ref)}</td><td>${escapeHtml(item.seed_recheck_execution_allowed_now)}</td><td>${escapeHtml(item.seed_unblock_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Seed Recheck Validation Contract</title>
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
    <h1>Hermes Seed Recheck Validation Contract</h1>
    <p class="notice">This artifact validates seed recheck readiness metadata only. It does not mark clarification sufficient, execute a seed recheck, unblock a seed, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Validator Candidate</th><th>Execution Allowed</th><th>Seed Unblock</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP34000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildClarificationReplayCaptureContract({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.clarification_replay_capture_contract", built);
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
  const defaults = DEFAULT_SEED_RECHECK_VALIDATION_CONTRACT_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_clarification_replay_capture_contract_path: path.resolve(repoRoot, options.sourceClarificationReplayCaptureContractPath ?? defaults.sourceClarificationReplayCaptureContractPath),
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
      args.sourceClarificationReplayCaptureContractPath = argv[++index];
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
  console.log(`Usage: node scripts/seed-recheck-validation-contract.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P34001-P34400 Seed Recheck Validation Contract.
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
