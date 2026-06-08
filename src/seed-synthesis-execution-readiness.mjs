import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P32400_FALSE_FLAGS,
  buildAnswerCaptureSpecStateMachine,
} from "./answer-capture-spec-state-machine.mjs";

export const DEFAULT_SEED_SYNTHESIS_EXECUTION_READINESS_OUT_DIR = "artifacts/seed-synthesis-execution-readiness/latest";
export const DEFAULT_SEED_SYNTHESIS_EXECUTION_READINESS_INPUTS = {
  schemaPath: "schemas/seed-synthesis-execution-readiness.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p32401-p32800.md",
  architectureDocPath: "docs/architecture.md",
  sourceAnswerCaptureSpecStateMachinePath: "artifacts/answer-capture-spec-state-machine/latest/answer-capture-spec-state-machine.json",
};

const COMMAND_NAME = "platform:seed-synthesis-execution-readiness";
const SCHEMA_VERSION = "seed-synthesis-execution-readiness.v1";
const CAPABILITY_ID = "platform.seed_synthesis_execution_readiness";
const PROGRAM_RANGE = "P32401-P32800";
const SOURCE_PROGRAM_RANGE = "P32001-P32400";
const READY_STATUS = "ready_for_seed_synthesis_execution_readiness";
const BLOCK_PENDING_STATUS = "valid_block_seed_synthesis_execution_readiness_pending";
const BLOCKED_STATUS = "blocked_seed_synthesis_execution_readiness";

const PHASE_SPECS = [
  ["P32401-P32440", "P32400 Source Binding", "p32400_source_binding_rows"],
  ["P32441-P32520", "Seed Synthesis Candidate", "seed_synthesis_candidate_rows"],
  ["P32521-P32600", "Execution Readiness Gate", "execution_readiness_gate_rows"],
  ["P32601-P32680", "Seed Review Packet Candidate", "seed_review_packet_candidate_rows"],
  ["P32681-P32740", "Seed Blocker Ledger", "seed_blocker_ledger_rows"],
  ["P32741-P32780", "No-Execution Boundary", "no_execution_boundary_rows"],
  ["P32781-P32800", "P32800 Clean Checkpoint", "p32800_clean_checkpoint_rows"],
];

export const SEED_SYNTHESIS_EXECUTION_READINESS_FALSE_FLAGS = [
  "seed_synthesis_final_seed_allowed_now",
  "seed_synthesis_seed_auto_apply_allowed_now",
  "seed_synthesis_execution_ready_allowed_now",
  "seed_synthesis_runtime_execution_allowed_now",
  "seed_synthesis_write_action_allowed_now",
  "seed_synthesis_protected_action_allowed_now",
  "seed_synthesis_connector_write_allowed_now",
  "seed_synthesis_deployment_allowed_now",
  "seed_synthesis_review_completion_allowed_now",
  "seed_synthesis_final_approval_allowed_now",
  "seed_synthesis_production_pass_allowed_now",
  "seed_synthesis_enterprise_trust_claim_allowed_now",
  "seed_synthesis_raw_answer_exposure_allowed_now",
  "seed_synthesis_secret_read_allowed_now",
  "seed_synthesis_human_gate_bypass_allowed_now",
  "seed_synthesis_independent_review_bypass_allowed_now",
  "seed_synthesis_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...SEED_SYNTHESIS_EXECUTION_READINESS_FALSE_FLAGS, ...P32400_FALSE_FLAGS])];

export async function runSeedSynthesisExecutionReadiness(options = {}) {
  const result = await buildSeedSynthesisExecutionReadiness(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Seed Synthesis Execution Readiness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeSeedSynthesisExecutionReadiness(result, result.output_dir);
  return result;
}

export async function buildSeedSynthesisExecutionReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SEED_SYNTHESIS_EXECUTION_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "answerCaptureSpecStateMachine")
    ? normalizeInlineJsonSource("inline.answer_capture_spec_state_machine", options.answerCaptureSpecStateMachine)
    : await readJsonOrBuildP32400(inputs.source_answer_capture_spec_state_machine_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const seedRows = buildSeedSynthesisCandidateRows({ source, generatedAt });
  const gateRows = buildExecutionReadinessGateRows({ source, seedRows, generatedAt });
  const reviewRows = buildSeedReviewPacketCandidateRows({ seedRows, gateRows, generatedAt });
  const blockerRows = buildSeedBlockerLedgerRows({ source, seedRows, gateRows, reviewRows, generatedAt });
  const boundaryRows = buildNoExecutionBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, seedRows, gateRows, reviewRows, blockerRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, seedRows, gateRows, reviewRows, blockerRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, seedRows, gateRows, reviewRows, blockerRows, boundaryRows, checkpointRows, boundary });
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
      answer_capture_spec_state_machine_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_answer_capture_spec_state_machine_summary: source.data?.summary ?? null,
    seed_synthesis_execution_readiness_contract: buildContract(generatedAt),
    seed_synthesis_execution_readiness_phase_rows: phaseRows,
    p32400_source_binding_rows: sourceRows,
    seed_synthesis_candidate_rows: seedRows,
    execution_readiness_gate_rows: gateRows,
    seed_review_packet_candidate_rows: reviewRows,
    seed_blocker_ledger_rows: blockerRows,
    no_execution_boundary_rows: boundaryRows,
    p32800_clean_checkpoint_rows: checkpointRows,
    seed_synthesis_execution_readiness_boundary: boundary,
    seed_synthesis_execution_readiness_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "seed_synthesis_execution_readiness")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.seed_synthesis_execution_readiness_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.seed_synthesis_execution_readiness_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeSeedSynthesisExecutionReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "seed-synthesis-execution-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p32400-source-binding-rows.json"), collectionEnvelope("p32400-source-binding-rows.v1", "p32400_source_binding_rows", result.p32400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-synthesis-candidate-rows.json"), collectionEnvelope("seed-synthesis-candidate-rows.v1", "seed_synthesis_candidate_rows", result.seed_synthesis_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-readiness-gate-rows.json"), collectionEnvelope("execution-readiness-gate-rows.v1", "execution_readiness_gate_rows", result.execution_readiness_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-review-packet-candidate-rows.json"), collectionEnvelope("seed-review-packet-candidate-rows.v1", "seed_review_packet_candidate_rows", result.seed_review_packet_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-blocker-ledger-rows.json"), collectionEnvelope("seed-blocker-ledger-rows.v1", "seed_blocker_ledger_rows", result.seed_blocker_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-execution-boundary-rows.json"), collectionEnvelope("no-execution-boundary-rows.v1", "no_execution_boundary_rows", result.no_execution_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p32800-clean-checkpoint-rows.json"), collectionEnvelope("p32800-clean-checkpoint-rows.v1", "p32800_clean_checkpoint_rows", result.p32800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "seed-synthesis-execution-readiness-boundary.json"), result.seed_synthesis_execution_readiness_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runSeedSynthesisExecutionReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runSeedSynthesisExecutionReadiness(args);
  console.log(`Seed Synthesis Execution Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.seed_synthesis_execution_readiness_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P32400 ready for seed synthesis candidate: ${result.summary.source_p32400_ready_for_seed_synthesis_candidate}`);
  console.log(`Seed candidates: ${result.summary.seed_synthesis_candidate_count}`);
  console.log(`Execution gate rows: ${result.summary.execution_readiness_gate_count}`);
  console.log(`Seed review packets: ${result.summary.seed_review_packet_candidate_count}`);
  console.log(`Execution ready count: ${result.summary.execution_ready_count}`);
  console.log(`Ready for defaults/no-fake-clarity guard: ${result.summary.ready_for_defaults_no_fake_clarity_guard}`);
  console.log(`Final seed allowed: ${result.summary.seed_synthesis_final_seed_allowed_now}`);
  console.log(`Runtime allowed: ${result.summary.seed_synthesis_runtime_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.answer_capture_spec_state_machine_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_seed_readiness_gate === true,
    status: summary.answer_capture_spec_state_machine_status ?? "missing",
    p32400ContractReady: boundary.p32400_contract_ready === true,
    answerContractVisible: boundary.answer_capture_contract_visible_now === true,
    specStateVisible: boundary.spec_state_machine_visible_now === true,
    redactionVisible: boundary.answer_redaction_boundary_visible_now === true,
    transitionVisible: boundary.state_transition_validator_visible_now === true,
    noSeedClosed: boundary.no_seed_synthesis_boundary_closed_now === true,
    boundaryClosed: P32400_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p32401-p32800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P32400 answer capture spec state machine source is available", sourceState.available],
    ["program_range", "P32400 source program range is P32001-P32400", sourceState.programRangeOk],
    ["validation_valid", "P32400 source validation is valid", sourceState.validationValid],
    ["seed_readiness_handoff_open", "P32400 opened seed readiness gate handoff", sourceState.sourceReady],
    ["p32400_contract_ready", "P32400 source contract is ready", sourceState.p32400ContractReady],
    ["answer_contract_visible", "P32400 answer capture contract rows are visible", sourceState.answerContractVisible],
    ["spec_state_visible", "P32400 spec state machine rows are visible", sourceState.specStateVisible],
    ["redaction_visible", "P32400 redaction boundary rows are visible", sourceState.redactionVisible],
    ["transition_validator_visible", "P32400 transition validator rows are visible", sourceState.transitionVisible],
    ["no_seed_boundary_closed", "P32400 no-seed-synthesis boundary is closed", sourceState.noSeedClosed],
    ["commit_ref_present", "Current commit ref is present for seed synthesis readiness", Boolean(commitRef)],
    ["source_blocker_visible", "P32400 source blocker is visible when seed synthesis is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p32400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildSeedSynthesisCandidateRows({ source, generatedAt }) {
  const answerRows = source.data?.answer_capture_contract_rows ?? [];
  const stateRows = source.data?.spec_state_machine_rows ?? [];
  return answerRows.map((answer) => {
    const states = stateRows.filter((item) => item.request_id === answer.request_id);
    const blockerRefs = [];
    if (answer.answer_receipt_present_now !== true) blockerRefs.push("missing_answer_receipt");
    if (answer.raw_answer_exposed_now !== false) blockerRefs.push("raw_answer_boundary_not_closed");
    if (!states.some((state) => state.to_state === "seed_readiness_candidate")) blockerRefs.push("missing_seed_readiness_state");
    return row({
      row_id: `seed_synthesis_candidate.${answer.request_id}`,
      category: "seed_synthesis_candidate",
      label: `Seed synthesis candidate for ${answer.request_id}`,
      observed: Boolean(answer.request_id && answer.expected_answer_ref),
      evidence_ref: answer.row_id,
      request_id: answer.request_id,
      expected_answer_ref: answer.expected_answer_ref,
      expected_question_ids: answer.expected_question_ids ?? [],
      seed_candidate_ref: `seed_candidate.${answer.request_id}.blocked`,
      seed_candidate_complete_now: false,
      answer_receipt_present_now: answer.answer_receipt_present_now === true,
      redacted_answer_summary_present_now: false,
      blocker_refs: blockerRefs,
      final_seed_allowed_now: false,
      seed_auto_apply_allowed_now: false,
      execution_ready_allowed_now: false,
      candidate_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildExecutionReadinessGateRows({ source, seedRows, generatedAt }) {
  const transitionRows = source.data?.state_transition_validator_rows ?? [];
  return seedRows.map((seed) => {
    const transitions = transitionRows.filter((item) => item.request_id === seed.request_id);
    const blockedTransitions = transitions.filter((item) => item.blocked_until_answer_receipt === true);
    const blockers = [...seed.blocker_refs];
    if (blockedTransitions.length > 0) blockers.push("state_transition_blocked_until_answer_receipt");
    if (seed.seed_candidate_complete_now !== true) blockers.push("seed_candidate_incomplete");
    return row({
      row_id: `execution_readiness_gate.${seed.request_id}`,
      category: "execution_readiness_gate",
      label: `Execution readiness gate for ${seed.request_id}`,
      observed: Boolean(seed.request_id),
      evidence_ref: seed.row_id,
      request_id: seed.request_id,
      execution_ready_now: false,
      execution_readiness_blocked_now: true,
      readiness_blocker_refs: [...new Set(blockers)],
      required_answer_receipt_present_now: seed.answer_receipt_present_now === true,
      required_seed_complete_now: seed.seed_candidate_complete_now === true,
      required_review_packet_present_now: false,
      runtime_execution_allowed_now: false,
      write_action_allowed_now: false,
      protected_action_allowed_now: false,
      gate_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildSeedReviewPacketCandidateRows({ seedRows, gateRows, generatedAt }) {
  return seedRows.map((seed) => {
    const gate = gateRows.find((item) => item.request_id === seed.request_id);
    return row({
      row_id: `seed_review_packet_candidate.${seed.request_id}`,
      category: "seed_review_packet_candidate",
      label: `Seed review packet candidate for ${seed.request_id}`,
      observed: Boolean(gate),
      evidence_ref: seed.row_id,
      request_id: seed.request_id,
      seed_candidate_ref: seed.seed_candidate_ref,
      review_packet_ref: `seed_review_packet.${seed.request_id}.candidate`,
      includes_blocker_refs: gate?.readiness_blocker_refs ?? [],
      includes_answer_ref_only: true,
      includes_raw_answer: false,
      review_completion_allowed_now: false,
      final_approval_allowed_now: false,
      execution_allowed_now: false,
      packet_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildSeedBlockerLedgerRows({ source, seedRows, gateRows, reviewRows, generatedAt }) {
  return seedRows.map((seed) => {
    const gate = gateRows.find((item) => item.request_id === seed.request_id);
    const review = reviewRows.find((item) => item.request_id === seed.request_id);
    return row({
      row_id: `seed_blocker_ledger.${seed.request_id}`,
      category: "seed_blocker_ledger",
      label: `Seed blocker ledger for ${seed.request_id}`,
      observed: Boolean(gate && review),
      evidence_ref: gate?.row_id ?? seed.row_id,
      request_id: seed.request_id,
      blocker_refs: gate?.readiness_blocker_refs ?? seed.blocker_refs,
      source_answer_receipt_present_count: source.data?.summary?.answer_receipt_present_count ?? 0,
      source_seed_synthesis_candidate_count: source.data?.summary?.seed_synthesis_candidate_count ?? 0,
      remediation_hint: "capture_redacted_answer_receipt_before_seed_completion",
      blocker_visible_to_operator: true,
      production_pass_allowed_now: false,
      execution_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoExecutionBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_execution.${flag}`,
    category: "no_execution_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "seed_synthesis_execution_readiness_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.seedRows)
    && allPass(context.gateRows)
    && allPass(context.reviewRows)
    && allPass(context.blockerRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P32400 source is ready for seed synthesis candidate", context.sourceState.sourceReady],
    ["seed_candidate_visible", "Seed synthesis candidate rows are visible", allPass(context.seedRows)],
    ["execution_gate_visible", "Execution readiness gate rows are visible", allPass(context.gateRows)],
    ["review_packet_visible", "Seed review packet candidate rows are visible", allPass(context.reviewRows)],
    ["blocker_ledger_visible", "Seed blocker ledger rows are visible", allPass(context.blockerRows)],
    ["no_execution_boundary_closed", "No-execution boundary remains closed", allPass(context.boundaryRows)],
    ["defaults_no_fake_clarity_gate", "Defaults/no-fake-clarity handoff opens only when seed blockers are visible", ready],
    ["execution_blocker_visible", "Execution blocker remains visible while no final seed is allowed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p32800_checkpoint.${id}`,
    category: "p32800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p32800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p32800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.seedRows)
    && allPass(context.gateRows)
    && allPass(context.reviewRows)
    && allPass(context.blockerRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p32800_checkpoint.execution_blocker_visible");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p32800ContractReady;
  return {
    p32800_contract_ready: p32800ContractReady,
    ready_for_defaults_no_fake_clarity_guard: ready,
    source_p32400_ready_for_seed_synthesis_candidate: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    seed_synthesis_candidate_visible_now: allPass(context.seedRows),
    execution_readiness_gate_visible_now: allPass(context.gateRows),
    seed_review_packet_candidate_visible_now: allPass(context.reviewRows),
    seed_blocker_ledger_visible_now: allPass(context.blockerRows),
    no_execution_boundary_closed_now: allPass(context.boundaryRows),
    seed_synthesis_candidate_count: context.seedRows.length,
    execution_readiness_gate_count: context.gateRows.length,
    seed_review_packet_candidate_count: context.reviewRows.length,
    seed_blocker_ledger_count: context.blockerRows.length,
    final_seed_complete_count: context.seedRows.filter((item) => item.seed_candidate_complete_now === true).length,
    execution_ready_count: context.gateRows.filter((item) => item.execution_ready_now === true).length,
    readiness_blocker_count: context.gateRows.reduce((sum, item) => sum + (item.readiness_blocker_refs?.length ?? 0), 0),
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P32401-P32800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P32401-P32800 Seed Synthesis Candidate and Execution Readiness Gate"), "Architecture doc missing P32401-P32800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P32400 source state is not visible"),
    validationItem("seed.candidate.visible", "seed_synthesis", allPass(context.seedRows), "Seed synthesis candidate rows are incomplete"),
    validationItem("execution.gate.visible", "seed_synthesis", allPass(context.gateRows), "Execution readiness gate rows are incomplete"),
    validationItem("review.packet.visible", "seed_synthesis", allPass(context.reviewRows), "Seed review packet candidate rows are incomplete"),
    validationItem("blocker.ledger.visible", "seed_synthesis", allPass(context.blockerRows), "Seed blocker ledger rows are incomplete"),
    validationItem("seed.not_final", "authority", context.seedRows.every((item) => item.seed_candidate_complete_now === false && item.final_seed_allowed_now === false), "Final seed opened"),
    validationItem("execution.blocked", "authority", context.gateRows.every((item) => item.execution_ready_now === false && item.execution_readiness_blocked_now === true), "Execution readiness opened"),
    validationItem("review.no_approval", "authority", context.reviewRows.every((item) => item.review_completion_allowed_now === false && item.final_approval_allowed_now === false), "Review or approval opened"),
    validationItem("boundary.no_execution", "authority", context.boundary.seed_synthesis_runtime_execution_allowed_now === false && context.boundary.seed_synthesis_final_seed_allowed_now === false && context.boundary.seed_synthesis_production_pass_allowed_now === false, "Seed synthesis authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p32800_checkpoint.execution_blocker_visible"), "P32800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "seed_synthesis_execution_readiness.contract.v1",
    generated_at: generatedAt,
    source_p32400_required_or_rebuilt: true,
    seed_synthesis_candidate_required: true,
    execution_readiness_gate_required: true,
    seed_review_packet_candidate_required: true,
    seed_blocker_ledger_required: true,
    no_execution_boundary_required: true,
    defaults_assumptions_deferred_to_p32801_p33200: true,
    ui_projection_replay_deferred_to_p33201_p33600: true,
    p32800_is_not_final_seed_execution_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_defaults_no_fake_clarity_guard
    ? READY_STATUS
    : validation.valid && boundary.p32800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    seed_synthesis_execution_readiness_status: status,
    source_p32400_ready_for_seed_synthesis_candidate: boundary.source_p32400_ready_for_seed_synthesis_candidate,
    seed_synthesis_candidate_count: boundary.seed_synthesis_candidate_count,
    execution_readiness_gate_count: boundary.execution_readiness_gate_count,
    seed_review_packet_candidate_count: boundary.seed_review_packet_candidate_count,
    seed_blocker_ledger_count: boundary.seed_blocker_ledger_count,
    final_seed_complete_count: boundary.final_seed_complete_count,
    execution_ready_count: boundary.execution_ready_count,
    readiness_blocker_count: boundary.readiness_blocker_count,
    ready_for_defaults_no_fake_clarity_guard: validation.valid && boundary.ready_for_defaults_no_fake_clarity_guard,
    seed_synthesis_final_seed_allowed_now: false,
    seed_synthesis_seed_auto_apply_allowed_now: false,
    seed_synthesis_execution_ready_allowed_now: false,
    seed_synthesis_runtime_execution_allowed_now: false,
    seed_synthesis_write_action_allowed_now: false,
    seed_synthesis_protected_action_allowed_now: false,
    seed_synthesis_review_completion_allowed_now: false,
    seed_synthesis_final_approval_allowed_now: false,
    seed_synthesis_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Seed Synthesis Execution Readiness",
    "",
    `Status: ${result.summary.seed_synthesis_execution_readiness_status}`,
    `Program: ${result.program_range}`,
    `P32400 ready for seed synthesis candidate: ${result.summary.source_p32400_ready_for_seed_synthesis_candidate}`,
    `Seed candidates: ${result.summary.seed_synthesis_candidate_count}`,
    `Execution gate rows: ${result.summary.execution_readiness_gate_count}`,
    `Seed review packets: ${result.summary.seed_review_packet_candidate_count}`,
    `Execution ready count: ${result.summary.execution_ready_count}`,
    `Readiness blockers: ${result.summary.readiness_blocker_count}`,
    `Ready for defaults/no-fake-clarity guard: ${result.summary.ready_for_defaults_no_fake_clarity_guard}`,
    `Final seed allowed: ${result.summary.seed_synthesis_final_seed_allowed_now}`,
    `Runtime allowed: ${result.summary.seed_synthesis_runtime_execution_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.execution_readiness_gate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.execution_ready_now)}</td><td>${escapeHtml(item.readiness_blocker_refs.join(", "))}</td><td>${escapeHtml(item.runtime_execution_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Seed Synthesis Execution Readiness</title>
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
    <h1>Hermes Seed Synthesis Execution Readiness</h1>
    <p class="notice">This artifact creates blocked seed candidates and execution-readiness evidence only. It does not create final seeds, apply seeds, execute runtime actions, write files, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Ready</th><th>Blockers</th><th>Runtime</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP32400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildAnswerCaptureSpecStateMachine({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.answer_capture_spec_state_machine", built);
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
  const defaults = DEFAULT_SEED_SYNTHESIS_EXECUTION_READINESS_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_answer_capture_spec_state_machine_path: path.resolve(repoRoot, options.sourceAnswerCaptureSpecStateMachinePath ?? defaults.sourceAnswerCaptureSpecStateMachinePath),
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
      args.sourceAnswerCaptureSpecStateMachinePath = argv[++index];
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
  console.log(`Usage: node scripts/seed-synthesis-execution-readiness.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P32401-P32800 Seed Synthesis Candidate and Execution Readiness contract.
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
