import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P33200_FALSE_FLAGS,
  buildDefaultsAssumptionsNoFakeClarity,
} from "./defaults-assumptions-no-fake-clarity.mjs";

export const DEFAULT_UI_PROJECTION_REPLAY_LEDGER_OUT_DIR = "artifacts/ui-projection-replay-ledger/latest";
export const DEFAULT_UI_PROJECTION_REPLAY_LEDGER_INPUTS = {
  schemaPath: "schemas/ui-projection-replay-ledger.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p33201-p33600.md",
  architectureDocPath: "docs/architecture.md",
  sourceDefaultsAssumptionsNoFakeClarityPath: "artifacts/defaults-assumptions-no-fake-clarity/latest/defaults-assumptions-no-fake-clarity.json",
};

const COMMAND_NAME = "platform:ui-projection-replay-ledger";
const SCHEMA_VERSION = "ui-projection-replay-ledger.v1";
const CAPABILITY_ID = "platform.ui_projection_replay_ledger";
const PROGRAM_RANGE = "P33201-P33600";
const SOURCE_PROGRAM_RANGE = "P32801-P33200";
const READY_STATUS = "ready_for_ui_projection_replay_ledger";
const BLOCK_PENDING_STATUS = "valid_block_ui_projection_replay_ledger_pending";
const BLOCKED_STATUS = "blocked_ui_projection_replay_ledger";

const PHASE_SPECS = [
  ["P33201-P33260", "P33200 Source Binding", "p33200_source_binding_rows"],
  ["P33261-P33340", "UI Projection Slot Map", "ui_projection_slot_map_rows"],
  ["P33341-P33420", "Replay Ledger Candidate", "replay_ledger_candidate_rows"],
  ["P33421-P33480", "Operator Handoff Surface", "operator_handoff_surface_rows"],
  ["P33481-P33540", "Replay Evidence Guard", "replay_evidence_guard_rows"],
  ["P33541-P33580", "No-Action UI Boundary", "no_action_ui_boundary_rows"],
  ["P33581-P33600", "P33600 Clean Checkpoint", "p33600_clean_checkpoint_rows"],
];

export const UI_PROJECTION_REPLAY_LEDGER_FALSE_FLAGS = [
  "ui_projection_action_button_enabled_now",
  "ui_projection_command_dispatch_allowed_now",
  "ui_projection_state_mutation_allowed_now",
  "ui_projection_user_answer_capture_allowed_now",
  "ui_projection_raw_answer_exposure_allowed_now",
  "ui_projection_replay_receipt_auto_accept_allowed_now",
  "ui_projection_replay_execution_allowed_now",
  "ui_projection_replay_verification_pass_allowed_now",
  "ui_projection_seed_recheck_allowed_now",
  "ui_projection_seed_unblock_allowed_now",
  "ui_projection_final_seed_allowed_now",
  "ui_projection_runtime_execution_allowed_now",
  "ui_projection_write_action_allowed_now",
  "ui_projection_protected_action_allowed_now",
  "ui_projection_connector_write_allowed_now",
  "ui_projection_deployment_allowed_now",
  "ui_projection_review_completion_allowed_now",
  "ui_projection_final_approval_allowed_now",
  "ui_projection_production_pass_allowed_now",
  "ui_projection_enterprise_trust_claim_allowed_now",
  "ui_projection_secret_read_allowed_now",
  "ui_projection_human_gate_bypass_allowed_now",
  "ui_projection_independent_review_bypass_allowed_now",
  "ui_projection_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...UI_PROJECTION_REPLAY_LEDGER_FALSE_FLAGS, ...P33200_FALSE_FLAGS])];

export async function runUiProjectionReplayLedger(options = {}) {
  const result = await buildUiProjectionReplayLedger(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`UI Projection Replay Ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeUiProjectionReplayLedger(result, result.output_dir);
  return result;
}

export async function buildUiProjectionReplayLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_UI_PROJECTION_REPLAY_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "defaultsAssumptionsNoFakeClarity")
    ? normalizeInlineJsonSource("inline.defaults_assumptions_no_fake_clarity", options.defaultsAssumptionsNoFakeClarity)
    : await readJsonOrBuildP33200(inputs.source_defaults_assumptions_no_fake_clarity_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const slotRows = buildUiProjectionSlotMapRows({ source, generatedAt });
  const replayRows = buildReplayLedgerCandidateRows({ source, slotRows, generatedAt });
  const handoffRows = buildOperatorHandoffSurfaceRows({ source, slotRows, replayRows, generatedAt });
  const evidenceRows = buildReplayEvidenceGuardRows({ source, replayRows, handoffRows, generatedAt });
  const boundaryRows = buildNoActionUiBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, slotRows, replayRows, handoffRows, evidenceRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, slotRows, replayRows, handoffRows, evidenceRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, slotRows, replayRows, handoffRows, evidenceRows, boundaryRows, checkpointRows, boundary });
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
      defaults_assumptions_no_fake_clarity_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_defaults_assumptions_no_fake_clarity_summary: source.data?.summary ?? null,
    ui_projection_replay_ledger_contract: buildContract(generatedAt),
    ui_projection_replay_ledger_phase_rows: phaseRows,
    p33200_source_binding_rows: sourceRows,
    ui_projection_slot_map_rows: slotRows,
    replay_ledger_candidate_rows: replayRows,
    operator_handoff_surface_rows: handoffRows,
    replay_evidence_guard_rows: evidenceRows,
    no_action_ui_boundary_rows: boundaryRows,
    p33600_clean_checkpoint_rows: checkpointRows,
    ui_projection_replay_ledger_boundary: boundary,
    ui_projection_replay_ledger_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "ui_projection_replay_ledger")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.ui_projection_replay_ledger_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.ui_projection_replay_ledger_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeUiProjectionReplayLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "ui-projection-replay-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p33200-source-binding-rows.json"), collectionEnvelope("p33200-source-binding-rows.v1", "p33200_source_binding_rows", result.p33200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-projection-slot-map-rows.json"), collectionEnvelope("ui-projection-slot-map-rows.v1", "ui_projection_slot_map_rows", result.ui_projection_slot_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-ledger-candidate-rows.json"), collectionEnvelope("replay-ledger-candidate-rows.v1", "replay_ledger_candidate_rows", result.replay_ledger_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handoff-surface-rows.json"), collectionEnvelope("operator-handoff-surface-rows.v1", "operator_handoff_surface_rows", result.operator_handoff_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-evidence-guard-rows.json"), collectionEnvelope("replay-evidence-guard-rows.v1", "replay_evidence_guard_rows", result.replay_evidence_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-action-ui-boundary-rows.json"), collectionEnvelope("no-action-ui-boundary-rows.v1", "no_action_ui_boundary_rows", result.no_action_ui_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p33600-clean-checkpoint-rows.json"), collectionEnvelope("p33600-clean-checkpoint-rows.v1", "p33600_clean_checkpoint_rows", result.p33600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-projection-replay-ledger-boundary.json"), result.ui_projection_replay_ledger_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runUiProjectionReplayLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runUiProjectionReplayLedger(args);
  console.log(`UI Projection Replay Ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.ui_projection_replay_ledger_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P33200 ready for UI projection: ${result.summary.source_p33200_ready_for_ui_projection_replay_ledger}`);
  console.log(`UI projection slots: ${result.summary.ui_projection_slot_count}`);
  console.log(`Replay ledger candidates: ${result.summary.replay_ledger_candidate_count}`);
  console.log(`Operator handoff rows: ${result.summary.operator_handoff_surface_count}`);
  console.log(`Replay evidence blockers: ${result.summary.replay_evidence_blocker_count}`);
  console.log(`Ready for clarification replay capture handoff: ${result.summary.ready_for_clarification_replay_capture_handoff}`);
  console.log(`Action buttons enabled: ${result.summary.ui_projection_action_button_enabled_now}`);
  console.log(`Replay execution allowed: ${result.summary.ui_projection_replay_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.defaults_assumptions_no_fake_clarity_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_ui_projection_replay_ledger === true,
    status: summary.defaults_assumptions_no_fake_clarity_status ?? "missing",
    p33200ContractReady: boundary.p33200_contract_ready === true,
    defaultsVisible: boundary.defaults_assumptions_ledger_visible_now === true,
    riskVisible: boundary.assumption_risk_classifier_visible_now === true,
    guardVisible: boundary.no_fake_clarity_guard_visible_now === true,
    replayPreconditionsVisible: boundary.clarification_replay_precondition_visible_now === true,
    handoffVisible: boundary.blocked_seed_handoff_visible_now === true,
    noFakeClarityBoundaryClosed: boundary.no_fake_clarity_boundary_closed_now === true,
    boundaryClosed: P33200_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p33201-p33600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P33200 defaults assumptions no-fake-clarity source is available", sourceState.available],
    ["program_range", "P33200 source program range is P32801-P33200", sourceState.programRangeOk],
    ["validation_valid", "P33200 source validation is valid", sourceState.validationValid],
    ["ui_projection_handoff_open", "P33200 opened UI projection replay ledger handoff", sourceState.sourceReady],
    ["p33200_contract_ready", "P33200 source contract is ready", sourceState.p33200ContractReady],
    ["defaults_ledger_visible", "P33200 defaults assumptions ledger is visible", sourceState.defaultsVisible],
    ["risk_classifier_visible", "P33200 assumption risk classifier is visible", sourceState.riskVisible],
    ["no_fake_clarity_guard_visible", "P33200 no-fake-clarity guard is visible", sourceState.guardVisible],
    ["replay_preconditions_visible", "P33200 clarification replay preconditions are visible", sourceState.replayPreconditionsVisible],
    ["blocked_seed_handoff_visible", "P33200 blocked seed handoff is visible", sourceState.handoffVisible],
    ["no_fake_clarity_boundary_closed", "P33200 no-fake-clarity boundary is closed", sourceState.noFakeClarityBoundaryClosed],
    ["commit_ref_present", "Current commit ref is present for UI projection replay ledger", Boolean(commitRef)],
    ["source_blocker_visible", "P33200 source blocker is visible when UI projection is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p33200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildUiProjectionSlotMapRows({ source, generatedAt }) {
  const handoffRows = source.data?.blocked_seed_handoff_rows ?? [];
  return handoffRows.map((handoff) => row({
    row_id: `ui_projection_slot_map.${handoff.request_id}`,
    category: "ui_projection_slot_map",
    label: `UI projection slot for ${handoff.request_id}`,
    observed: Boolean(handoff.request_id),
    evidence_ref: handoff.row_id,
    request_id: handoff.request_id,
    slot_ref: `ui_slot.${handoff.request_id}.clarification_replay`,
    surface_ref: "operator_surface.clarification_replay_queue",
    display_state: "blocked_needs_clarification_replay",
    blocked_seed_handoff_ref: handoff.handoff_ref,
    blocked_reason_refs: handoff.blocked_reason_refs ?? [],
    show_blocker_badge_now: true,
    show_replay_required_badge_now: true,
    action_button_enabled_now: false,
    command_dispatch_allowed_now: false,
    raw_answer_exposure_allowed_now: false,
    slot_metadata_only: true,
    generated_at: generatedAt,
  }));
}

function buildReplayLedgerCandidateRows({ source, slotRows, generatedAt }) {
  const replayPreconditionRows = source.data?.clarification_replay_precondition_rows ?? [];
  return slotRows.map((slot) => {
    const replay = replayPreconditionRows.find((item) => item.request_id === slot.request_id);
    return row({
      row_id: `replay_ledger_candidate.${slot.request_id}`,
      category: "replay_ledger_candidate",
      label: `Replay ledger candidate for ${slot.request_id}`,
      observed: Boolean(replay),
      evidence_ref: replay?.row_id ?? slot.row_id,
      request_id: slot.request_id,
      ledger_ref: `replay_ledger.${slot.request_id}.candidate`,
      slot_ref: slot.slot_ref,
      required_replay_refs: replay?.required_replay_refs ?? [],
      source_blocker_refs: replay?.source_blocker_refs ?? [],
      answer_receipt_required_before_unblock: true,
      replay_receipt_present_now: false,
      replay_receipt_auto_accept_allowed_now: false,
      replay_verification_pass_allowed_now: false,
      seed_recheck_allowed_now: false,
      execution_allowed_now: false,
      ledger_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorHandoffSurfaceRows({ source, slotRows, replayRows, generatedAt }) {
  const guardRows = source.data?.no_fake_clarity_guard_rows ?? [];
  return slotRows.map((slot) => {
    const replay = replayRows.find((item) => item.request_id === slot.request_id);
    const guard = guardRows.find((item) => item.request_id === slot.request_id);
    return row({
      row_id: `operator_handoff_surface.${slot.request_id}`,
      category: "operator_handoff_surface",
      label: `Operator handoff surface for ${slot.request_id}`,
      observed: Boolean(replay && guard),
      evidence_ref: replay?.row_id ?? slot.row_id,
      request_id: slot.request_id,
      surface_ref: slot.surface_ref,
      slot_ref: slot.slot_ref,
      replay_ledger_ref: replay?.ledger_ref ?? null,
      handoff_message_ref: `operator_handoff.${slot.request_id}.blocked_replay_required`,
      visible_to_operator_now: true,
      next_operator_action: "prepare_clarification_replay_packet",
      action_button_enabled_now: false,
      command_dispatch_allowed_now: false,
      state_mutation_allowed_now: false,
      user_answer_capture_allowed_now: false,
      raw_answer_exposure_allowed_now: false,
      handoff_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildReplayEvidenceGuardRows({ source, replayRows, handoffRows, generatedAt }) {
  const defaultsRows = source.data?.defaults_assumptions_ledger_rows ?? [];
  return replayRows.map((replay) => {
    const handoff = handoffRows.find((item) => item.request_id === replay.request_id);
    const defaults = defaultsRows.find((item) => item.request_id === replay.request_id);
    return row({
      row_id: `replay_evidence_guard.${replay.request_id}`,
      category: "replay_evidence_guard",
      label: `Replay evidence guard for ${replay.request_id}`,
      observed: Boolean(handoff && defaults),
      evidence_ref: handoff?.row_id ?? replay.row_id,
      request_id: replay.request_id,
      replay_ledger_ref: replay.ledger_ref,
      required_evidence_refs: [
        "redacted_answer_receipt",
        "question_replay_trace",
        "seed_candidate_recheck_receipt",
      ],
      replay_receipt_present_now: false,
      redacted_answer_receipt_present_now: false,
      raw_answer_exposure_allowed_now: false,
      missing_evidence_blocker_visible_now: true,
      replay_verification_pass_allowed_now: false,
      seed_unblock_allowed_now: false,
      execution_allowed_now: false,
      evidence_guard_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoActionUiBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_action_ui_boundary.${flag}`,
    category: "no_action_ui_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "ui_projection_replay_ledger_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.slotRows)
    && allPass(context.replayRows)
    && allPass(context.handoffRows)
    && allPass(context.evidenceRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P33200 source is ready for UI projection replay ledger", context.sourceState.sourceReady],
    ["ui_projection_slots_visible", "UI projection slot rows are visible", allPass(context.slotRows)],
    ["replay_ledger_candidates_visible", "Replay ledger candidate rows are visible", allPass(context.replayRows)],
    ["operator_handoff_visible", "Operator handoff surface rows are visible", allPass(context.handoffRows)],
    ["replay_evidence_guard_visible", "Replay evidence guard rows are visible", allPass(context.evidenceRows)],
    ["no_action_ui_boundary_closed", "No-action UI boundary remains closed", allPass(context.boundaryRows)],
    ["replay_blocker_visible", "Replay blocker remains visible until redacted answer evidence exists", true],
    ["raw_answer_exposure_closed", "Raw answer exposure stays closed in the UI projection", true],
    ["clarification_replay_capture_handoff", "Clarification replay capture handoff opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p33600_checkpoint.${id}`,
    category: "p33600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p33600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p33600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.slotRows)
    && allPass(context.replayRows)
    && allPass(context.handoffRows)
    && allPass(context.evidenceRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p33600_checkpoint.replay_blocker_visible")
    && visibleOrPassed(context.checkpointRows, "p33600_checkpoint.raw_answer_exposure_closed");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p33600ContractReady;
  return {
    p33600_contract_ready: p33600ContractReady,
    ready_for_clarification_replay_capture_handoff: ready,
    source_p33200_ready_for_ui_projection_replay_ledger: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    ui_projection_slot_map_visible_now: allPass(context.slotRows),
    replay_ledger_candidate_visible_now: allPass(context.replayRows),
    operator_handoff_surface_visible_now: allPass(context.handoffRows),
    replay_evidence_guard_visible_now: allPass(context.evidenceRows),
    no_action_ui_boundary_closed_now: allPass(context.boundaryRows),
    ui_projection_slot_count: context.slotRows.length,
    replay_ledger_candidate_count: context.replayRows.length,
    operator_handoff_surface_count: context.handoffRows.length,
    replay_evidence_guard_count: context.evidenceRows.length,
    replay_evidence_blocker_count: context.evidenceRows.filter((item) => item.missing_evidence_blocker_visible_now === true).length,
    action_button_enabled_count: context.slotRows.filter((item) => item.action_button_enabled_now === true).length
      + context.handoffRows.filter((item) => item.action_button_enabled_now === true).length,
    replay_execution_allowed_count: context.replayRows.filter((item) => item.execution_allowed_now === true).length
      + context.evidenceRows.filter((item) => item.execution_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P33201-P33600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P33201-P33600 UI Projection and Replay Ledger"), "Architecture doc missing P33201-P33600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P33200 source state is not visible"),
    validationItem("ui.slots.visible", "ui_projection", allPass(context.slotRows), "UI projection slot map rows are incomplete"),
    validationItem("replay.ledger.visible", "replay_ledger", allPass(context.replayRows), "Replay ledger candidate rows are incomplete"),
    validationItem("operator.handoff.visible", "operator_handoff", allPass(context.handoffRows), "Operator handoff surface rows are incomplete"),
    validationItem("evidence.guard.visible", "replay_evidence", allPass(context.evidenceRows), "Replay evidence guard rows are incomplete"),
    validationItem("no.ui.action", "authority", noUiActionsEnabled(context), "UI projection opened an action or mutation path"),
    validationItem("no.raw.answer", "authority", noRawAnswerExposure(context), "UI projection opened raw answer exposure"),
    validationItem("no.replay.execution", "authority", noReplayExecution(context), "Replay ledger opened execution"),
    validationItem("evidence.blocker.visible", "authority", context.evidenceRows.every((item) => item.missing_evidence_blocker_visible_now === true), "Replay evidence blocker is not visible"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p33600_checkpoint.replay_blocker_visible"), "P33600 checkpoint replay blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "ui_projection_replay_ledger.contract.v1",
    generated_at: generatedAt,
    source_p33200_required_or_rebuilt: true,
    ui_projection_slot_map_required: true,
    replay_ledger_candidate_required: true,
    operator_handoff_surface_required: true,
    replay_evidence_guard_required: true,
    no_action_ui_boundary_required: true,
    p33600_is_not_answer_capture_replay_execution_seed_unblock_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_clarification_replay_capture_handoff
    ? READY_STATUS
    : validation.valid && boundary.p33600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    ui_projection_replay_ledger_status: status,
    source_p33200_ready_for_ui_projection_replay_ledger: boundary.source_p33200_ready_for_ui_projection_replay_ledger,
    ui_projection_slot_count: boundary.ui_projection_slot_count,
    replay_ledger_candidate_count: boundary.replay_ledger_candidate_count,
    operator_handoff_surface_count: boundary.operator_handoff_surface_count,
    replay_evidence_guard_count: boundary.replay_evidence_guard_count,
    replay_evidence_blocker_count: boundary.replay_evidence_blocker_count,
    action_button_enabled_count: boundary.action_button_enabled_count,
    replay_execution_allowed_count: boundary.replay_execution_allowed_count,
    ready_for_clarification_replay_capture_handoff: validation.valid && boundary.ready_for_clarification_replay_capture_handoff,
    ui_projection_action_button_enabled_now: false,
    ui_projection_command_dispatch_allowed_now: false,
    ui_projection_state_mutation_allowed_now: false,
    ui_projection_user_answer_capture_allowed_now: false,
    ui_projection_raw_answer_exposure_allowed_now: false,
    ui_projection_replay_receipt_auto_accept_allowed_now: false,
    ui_projection_replay_execution_allowed_now: false,
    ui_projection_replay_verification_pass_allowed_now: false,
    ui_projection_seed_unblock_allowed_now: false,
    ui_projection_final_seed_allowed_now: false,
    ui_projection_runtime_execution_allowed_now: false,
    ui_projection_write_action_allowed_now: false,
    ui_projection_protected_action_allowed_now: false,
    ui_projection_final_approval_allowed_now: false,
    ui_projection_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# UI Projection Replay Ledger",
    "",
    `Status: ${result.summary.ui_projection_replay_ledger_status}`,
    `Program: ${result.program_range}`,
    `P33200 ready for UI projection: ${result.summary.source_p33200_ready_for_ui_projection_replay_ledger}`,
    `UI projection slots: ${result.summary.ui_projection_slot_count}`,
    `Replay ledger candidates: ${result.summary.replay_ledger_candidate_count}`,
    `Operator handoff rows: ${result.summary.operator_handoff_surface_count}`,
    `Replay evidence blockers: ${result.summary.replay_evidence_blocker_count}`,
    `Ready for clarification replay capture handoff: ${result.summary.ready_for_clarification_replay_capture_handoff}`,
    `Action buttons enabled: ${result.summary.ui_projection_action_button_enabled_now}`,
    `Replay execution allowed: ${result.summary.ui_projection_replay_execution_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.ui_projection_slot_map_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.display_state)}</td><td>${escapeHtml(item.show_replay_required_badge_now)}</td><td>${escapeHtml(item.action_button_enabled_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes UI Projection Replay Ledger</title>
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
    <h1>Hermes UI Projection Replay Ledger</h1>
    <p class="notice">This artifact projects blocked clarification replay work into operator-visible slots only. It does not capture answers, expose raw answers, dispatch commands, execute replay, unblock seeds, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Display State</th><th>Replay Required</th><th>Action Button</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP33200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildDefaultsAssumptionsNoFakeClarity({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.defaults_assumptions_no_fake_clarity", built);
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
  const defaults = DEFAULT_UI_PROJECTION_REPLAY_LEDGER_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_defaults_assumptions_no_fake_clarity_path: path.resolve(repoRoot, options.sourceDefaultsAssumptionsNoFakeClarityPath ?? defaults.sourceDefaultsAssumptionsNoFakeClarityPath),
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
      args.sourceDefaultsAssumptionsNoFakeClarityPath = argv[++index];
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
  console.log(`Usage: node scripts/ui-projection-replay-ledger.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P33201-P33600 UI Projection and Replay Ledger contract.
`);
}

function noUiActionsEnabled(context) {
  return context.slotRows.every((item) => item.action_button_enabled_now === false && item.command_dispatch_allowed_now === false)
    && context.handoffRows.every((item) => item.action_button_enabled_now === false && item.command_dispatch_allowed_now === false && item.state_mutation_allowed_now === false && item.user_answer_capture_allowed_now === false);
}

function noRawAnswerExposure(context) {
  return context.slotRows.every((item) => item.raw_answer_exposure_allowed_now === false)
    && context.handoffRows.every((item) => item.raw_answer_exposure_allowed_now === false)
    && context.evidenceRows.every((item) => item.raw_answer_exposure_allowed_now === false);
}

function noReplayExecution(context) {
  return context.replayRows.every((item) => item.replay_receipt_auto_accept_allowed_now === false && item.replay_verification_pass_allowed_now === false && item.seed_recheck_allowed_now === false && item.execution_allowed_now === false)
    && context.evidenceRows.every((item) => item.replay_verification_pass_allowed_now === false && item.seed_unblock_allowed_now === false && item.execution_allowed_now === false);
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
