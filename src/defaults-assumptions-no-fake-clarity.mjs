import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P32800_FALSE_FLAGS,
  buildSeedSynthesisExecutionReadiness,
} from "./seed-synthesis-execution-readiness.mjs";

export const DEFAULT_DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_OUT_DIR = "artifacts/defaults-assumptions-no-fake-clarity/latest";
export const DEFAULT_DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_INPUTS = {
  schemaPath: "schemas/defaults-assumptions-no-fake-clarity.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p32801-p33200.md",
  architectureDocPath: "docs/architecture.md",
  sourceSeedSynthesisExecutionReadinessPath: "artifacts/seed-synthesis-execution-readiness/latest/seed-synthesis-execution-readiness.json",
};

const COMMAND_NAME = "platform:defaults-assumptions-no-fake-clarity";
const SCHEMA_VERSION = "defaults-assumptions-no-fake-clarity.v1";
const CAPABILITY_ID = "platform.defaults_assumptions_no_fake_clarity";
const PROGRAM_RANGE = "P32801-P33200";
const SOURCE_PROGRAM_RANGE = "P32401-P32800";
const READY_STATUS = "ready_for_defaults_assumptions_no_fake_clarity";
const BLOCK_PENDING_STATUS = "valid_block_defaults_assumptions_no_fake_clarity_pending";
const BLOCKED_STATUS = "blocked_defaults_assumptions_no_fake_clarity";

const PHASE_SPECS = [
  ["P32801-P32840", "P32800 Source Binding", "p32800_source_binding_rows"],
  ["P32841-P32920", "Defaults Assumptions Ledger", "defaults_assumptions_ledger_rows"],
  ["P32921-P33000", "Assumption Risk Classifier", "assumption_risk_classifier_rows"],
  ["P33001-P33080", "No-Fake-Clarity Guard", "no_fake_clarity_guard_rows"],
  ["P33081-P33140", "Clarification Replay Preconditions", "clarification_replay_precondition_rows"],
  ["P33141-P33180", "Blocked Seed Handoff", "blocked_seed_handoff_rows"],
  ["P33181-P33200", "P33200 Clean Checkpoint", "p33200_clean_checkpoint_rows"],
];

export const DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_FALSE_FLAGS = [
  "defaults_assumptions_default_auto_apply_allowed_now",
  "defaults_assumptions_missing_answer_default_allowed_now",
  "defaults_assumptions_assumption_as_fact_allowed_now",
  "defaults_assumptions_fake_clarity_allowed_now",
  "defaults_assumptions_seed_unblock_allowed_now",
  "defaults_assumptions_final_seed_allowed_now",
  "defaults_assumptions_runtime_execution_allowed_now",
  "defaults_assumptions_write_action_allowed_now",
  "defaults_assumptions_protected_action_allowed_now",
  "defaults_assumptions_connector_write_allowed_now",
  "defaults_assumptions_deployment_allowed_now",
  "defaults_assumptions_review_completion_allowed_now",
  "defaults_assumptions_final_approval_allowed_now",
  "defaults_assumptions_production_pass_allowed_now",
  "defaults_assumptions_enterprise_trust_claim_allowed_now",
  "defaults_assumptions_raw_answer_exposure_allowed_now",
  "defaults_assumptions_secret_read_allowed_now",
  "defaults_assumptions_human_gate_bypass_allowed_now",
  "defaults_assumptions_independent_review_bypass_allowed_now",
  "defaults_assumptions_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_FALSE_FLAGS, ...P32800_FALSE_FLAGS])];

export async function runDefaultsAssumptionsNoFakeClarity(options = {}) {
  const result = await buildDefaultsAssumptionsNoFakeClarity(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Defaults Assumptions No-Fake-Clarity failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeDefaultsAssumptionsNoFakeClarity(result, result.output_dir);
  return result;
}

export async function buildDefaultsAssumptionsNoFakeClarity(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "seedSynthesisExecutionReadiness")
    ? normalizeInlineJsonSource("inline.seed_synthesis_execution_readiness", options.seedSynthesisExecutionReadiness)
    : await readJsonOrBuildP32800(inputs.source_seed_synthesis_execution_readiness_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const defaultsRows = buildDefaultsAssumptionsLedgerRows({ source, generatedAt });
  const riskRows = buildAssumptionRiskClassifierRows({ defaultsRows, source, generatedAt });
  const guardRows = buildNoFakeClarityGuardRows({ defaultsRows, riskRows, generatedAt });
  const replayRows = buildClarificationReplayPreconditionRows({ source, guardRows, generatedAt });
  const handoffRows = buildBlockedSeedHandoffRows({ source, defaultsRows, guardRows, replayRows, generatedAt });
  const boundaryRows = buildNoFakeClarityBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, defaultsRows, riskRows, guardRows, replayRows, handoffRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, defaultsRows, riskRows, guardRows, replayRows, handoffRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, defaultsRows, riskRows, guardRows, replayRows, handoffRows, boundaryRows, checkpointRows, boundary });
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
      seed_synthesis_execution_readiness_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_seed_synthesis_execution_readiness_summary: source.data?.summary ?? null,
    defaults_assumptions_no_fake_clarity_contract: buildContract(generatedAt),
    defaults_assumptions_no_fake_clarity_phase_rows: phaseRows,
    p32800_source_binding_rows: sourceRows,
    defaults_assumptions_ledger_rows: defaultsRows,
    assumption_risk_classifier_rows: riskRows,
    no_fake_clarity_guard_rows: guardRows,
    clarification_replay_precondition_rows: replayRows,
    blocked_seed_handoff_rows: handoffRows,
    no_fake_clarity_boundary_rows: boundaryRows,
    p33200_clean_checkpoint_rows: checkpointRows,
    defaults_assumptions_no_fake_clarity_boundary: boundary,
    defaults_assumptions_no_fake_clarity_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "defaults_assumptions_no_fake_clarity")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.defaults_assumptions_no_fake_clarity_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.defaults_assumptions_no_fake_clarity_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeDefaultsAssumptionsNoFakeClarity(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "defaults-assumptions-no-fake-clarity.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p32800-source-binding-rows.json"), collectionEnvelope("p32800-source-binding-rows.v1", "p32800_source_binding_rows", result.p32800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "defaults-assumptions-ledger-rows.json"), collectionEnvelope("defaults-assumptions-ledger-rows.v1", "defaults_assumptions_ledger_rows", result.defaults_assumptions_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "assumption-risk-classifier-rows.json"), collectionEnvelope("assumption-risk-classifier-rows.v1", "assumption_risk_classifier_rows", result.assumption_risk_classifier_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-fake-clarity-guard-rows.json"), collectionEnvelope("no-fake-clarity-guard-rows.v1", "no_fake_clarity_guard_rows", result.no_fake_clarity_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "clarification-replay-precondition-rows.json"), collectionEnvelope("clarification-replay-precondition-rows.v1", "clarification_replay_precondition_rows", result.clarification_replay_precondition_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-seed-handoff-rows.json"), collectionEnvelope("blocked-seed-handoff-rows.v1", "blocked_seed_handoff_rows", result.blocked_seed_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-fake-clarity-boundary-rows.json"), collectionEnvelope("no-fake-clarity-boundary-rows.v1", "no_fake_clarity_boundary_rows", result.no_fake_clarity_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p33200-clean-checkpoint-rows.json"), collectionEnvelope("p33200-clean-checkpoint-rows.v1", "p33200_clean_checkpoint_rows", result.p33200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "defaults-assumptions-no-fake-clarity-boundary.json"), result.defaults_assumptions_no_fake_clarity_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runDefaultsAssumptionsNoFakeClarityCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runDefaultsAssumptionsNoFakeClarity(args);
  console.log(`Defaults Assumptions No-Fake-Clarity ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.defaults_assumptions_no_fake_clarity_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P32800 ready for defaults guard: ${result.summary.source_p32800_ready_for_defaults_guard}`);
  console.log(`Defaults assumptions: ${result.summary.defaults_assumptions_ledger_count}`);
  console.log(`High risk assumptions: ${result.summary.high_risk_assumption_count}`);
  console.log(`Fake clarity blocked: ${result.summary.fake_clarity_blocked_count}`);
  console.log(`Blocked seed handoffs: ${result.summary.blocked_seed_handoff_count}`);
  console.log(`Ready for UI projection replay ledger: ${result.summary.ready_for_ui_projection_replay_ledger}`);
  console.log(`Default auto apply allowed: ${result.summary.defaults_assumptions_default_auto_apply_allowed_now}`);
  console.log(`Fake clarity allowed: ${result.summary.defaults_assumptions_fake_clarity_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.seed_synthesis_execution_readiness_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_defaults_no_fake_clarity_guard === true,
    status: summary.seed_synthesis_execution_readiness_status ?? "missing",
    p32800ContractReady: boundary.p32800_contract_ready === true,
    seedVisible: boundary.seed_synthesis_candidate_visible_now === true,
    gateVisible: boundary.execution_readiness_gate_visible_now === true,
    reviewVisible: boundary.seed_review_packet_candidate_visible_now === true,
    blockerVisible: boundary.seed_blocker_ledger_visible_now === true,
    noExecutionClosed: boundary.no_execution_boundary_closed_now === true,
    boundaryClosed: P32800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p32801-p33200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P32800 seed synthesis execution readiness source is available", sourceState.available],
    ["program_range", "P32800 source program range is P32401-P32800", sourceState.programRangeOk],
    ["validation_valid", "P32800 source validation is valid", sourceState.validationValid],
    ["defaults_guard_handoff_open", "P32800 opened defaults/no-fake-clarity handoff", sourceState.sourceReady],
    ["p32800_contract_ready", "P32800 source contract is ready", sourceState.p32800ContractReady],
    ["seed_candidate_visible", "P32800 seed candidate rows are visible", sourceState.seedVisible],
    ["execution_gate_visible", "P32800 execution readiness rows are visible", sourceState.gateVisible],
    ["review_packet_visible", "P32800 seed review packet rows are visible", sourceState.reviewVisible],
    ["blocker_ledger_visible", "P32800 seed blocker rows are visible", sourceState.blockerVisible],
    ["no_execution_boundary_closed", "P32800 no-execution boundary is closed", sourceState.noExecutionClosed],
    ["commit_ref_present", "Current commit ref is present for defaults/no-fake-clarity", Boolean(commitRef)],
    ["source_blocker_visible", "P32800 source blocker is visible when defaults guard is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p32800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildDefaultsAssumptionsLedgerRows({ source, generatedAt }) {
  const seedRows = source.data?.seed_synthesis_candidate_rows ?? [];
  const blockerRows = source.data?.seed_blocker_ledger_rows ?? [];
  return seedRows.map((seed) => {
    const blocker = blockerRows.find((item) => item.request_id === seed.request_id);
    const blockerRefs = blocker?.blocker_refs ?? seed.blocker_refs ?? [];
    return row({
      row_id: `defaults_assumptions_ledger.${seed.request_id}`,
      category: "defaults_assumptions_ledger",
      label: `Defaults assumptions ledger for ${seed.request_id}`,
      observed: Boolean(seed.request_id),
      evidence_ref: seed.row_id,
      request_id: seed.request_id,
      seed_candidate_ref: seed.seed_candidate_ref,
      default_policy: "no_default_may_replace_missing_answer_receipt",
      default_candidate_ref: `default_assumption.${seed.request_id}.blocked`,
      default_applied_now: false,
      missing_answer_default_allowed_now: false,
      assumption_as_fact_allowed_now: false,
      fake_clarity_risk_present: blockerRefs.includes("missing_answer_receipt"),
      source_blocker_refs: blockerRefs,
      replay_required_before_unblock: true,
      ledger_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildAssumptionRiskClassifierRows({ defaultsRows, source, generatedAt }) {
  const gateRows = source.data?.execution_readiness_gate_rows ?? [];
  return defaultsRows.map((defaults) => {
    const gate = gateRows.find((item) => item.request_id === defaults.request_id);
    const blockerCount = defaults.source_blocker_refs.length + (gate?.readiness_blocker_refs?.length ?? 0);
    const riskTier = defaults.fake_clarity_risk_present || blockerCount > 0 ? "high" : "medium";
    return row({
      row_id: `assumption_risk_classifier.${defaults.request_id}`,
      category: "assumption_risk_classifier",
      label: `Assumption risk classifier for ${defaults.request_id}`,
      observed: Boolean(defaults.request_id),
      evidence_ref: defaults.row_id,
      request_id: defaults.request_id,
      risk_tier: riskTier,
      blocker_count: blockerCount,
      assumption_can_complete_spec_now: false,
      requires_clarification_replay: true,
      requires_operator_visibility: true,
      default_auto_apply_allowed_now: false,
      classifier_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoFakeClarityGuardRows({ defaultsRows, riskRows, generatedAt }) {
  return defaultsRows.map((defaults) => {
    const risk = riskRows.find((item) => item.request_id === defaults.request_id);
    return row({
      row_id: `no_fake_clarity_guard.${defaults.request_id}`,
      category: "no_fake_clarity_guard",
      label: `No-fake-clarity guard for ${defaults.request_id}`,
      observed: Boolean(risk),
      evidence_ref: risk?.row_id ?? defaults.row_id,
      request_id: defaults.request_id,
      fake_clarity_blocked_now: true,
      default_applied_now: false,
      missing_answer_default_allowed_now: false,
      assumption_as_fact_allowed_now: false,
      spec_marked_clear_now: false,
      seed_unblock_allowed_now: false,
      guard_reason_refs: [
        "missing_answer_cannot_be_defaulted",
        "blocked_seed_requires_replay",
        "assumption_must_remain_labeled",
      ],
      guard_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildClarificationReplayPreconditionRows({ source, guardRows, generatedAt }) {
  const blockerRows = source.data?.seed_blocker_ledger_rows ?? [];
  return guardRows.map((guard) => {
    const blocker = blockerRows.find((item) => item.request_id === guard.request_id);
    return row({
      row_id: `clarification_replay_precondition.${guard.request_id}`,
      category: "clarification_replay_precondition",
      label: `Clarification replay preconditions for ${guard.request_id}`,
      observed: Boolean(blocker),
      evidence_ref: guard.row_id,
      request_id: guard.request_id,
      required_replay_refs: [
        "question_plan_replay",
        "redacted_answer_receipt_capture",
        "seed_candidate_recheck",
      ],
      source_blocker_refs: blocker?.blocker_refs ?? [],
      answer_receipt_required_before_unblock: true,
      replay_receipt_present_now: false,
      seed_recheck_allowed_now: false,
      execution_allowed_now: false,
      replay_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildBlockedSeedHandoffRows({ source, defaultsRows, guardRows, replayRows, generatedAt }) {
  const reviewRows = source.data?.seed_review_packet_candidate_rows ?? [];
  return defaultsRows.map((defaults) => {
    const guard = guardRows.find((item) => item.request_id === defaults.request_id);
    const replay = replayRows.find((item) => item.request_id === defaults.request_id);
    const review = reviewRows.find((item) => item.request_id === defaults.request_id);
    return row({
      row_id: `blocked_seed_handoff.${defaults.request_id}`,
      category: "blocked_seed_handoff",
      label: `Blocked seed handoff for ${defaults.request_id}`,
      observed: Boolean(guard && replay),
      evidence_ref: replay?.row_id ?? guard?.row_id ?? defaults.row_id,
      request_id: defaults.request_id,
      blocked_seed_ref: defaults.seed_candidate_ref,
      handoff_ref: `blocked_seed_handoff.${defaults.request_id}.ui_replay_candidate`,
      review_packet_ref: review?.review_packet_ref ?? null,
      fake_clarity_blocked_now: guard?.fake_clarity_blocked_now === true,
      replay_precondition_refs: replay?.required_replay_refs ?? [],
      blocked_reason_refs: [
        ...new Set([
          ...defaults.source_blocker_refs,
          ...(guard?.guard_reason_refs ?? []),
        ]),
      ],
      ui_projection_ready_later: true,
      final_seed_allowed_now: false,
      execution_allowed_now: false,
      handoff_metadata_only: true,
      generated_at: generatedAt,
    });
  });
}

function buildNoFakeClarityBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_fake_clarity_boundary.${flag}`,
    category: "no_fake_clarity_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "defaults_assumptions_no_fake_clarity_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.defaultsRows)
    && allPass(context.riskRows)
    && allPass(context.guardRows)
    && allPass(context.replayRows)
    && allPass(context.handoffRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P32800 source is ready for defaults/no-fake-clarity guard", context.sourceState.sourceReady],
    ["defaults_ledger_visible", "Defaults assumptions ledger rows are visible", allPass(context.defaultsRows)],
    ["risk_classifier_visible", "Assumption risk classifier rows are visible", allPass(context.riskRows)],
    ["no_fake_clarity_guard_visible", "No-fake-clarity guard rows are visible", allPass(context.guardRows)],
    ["replay_preconditions_visible", "Clarification replay precondition rows are visible", allPass(context.replayRows)],
    ["blocked_seed_handoff_visible", "Blocked seed handoff rows are visible", allPass(context.handoffRows)],
    ["no_fake_clarity_boundary_closed", "No-fake-clarity boundary remains closed", allPass(context.boundaryRows)],
    ["ui_projection_replay_gate", "UI projection replay ledger handoff opens only when fake clarity is blocked", ready],
    ["fake_clarity_blocker_visible", "Fake clarity blocker remains visible while defaults cannot replace answers", true],
  ].map(([id, label, observed]) => row({
    row_id: `p33200_checkpoint.${id}`,
    category: "p33200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p33200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p33200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.defaultsRows)
    && allPass(context.riskRows)
    && allPass(context.guardRows)
    && allPass(context.replayRows)
    && allPass(context.handoffRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p33200_checkpoint.fake_clarity_blocker_visible");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p33200ContractReady;
  return {
    p33200_contract_ready: p33200ContractReady,
    ready_for_ui_projection_replay_ledger: ready,
    source_p32800_ready_for_defaults_guard: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    defaults_assumptions_ledger_visible_now: allPass(context.defaultsRows),
    assumption_risk_classifier_visible_now: allPass(context.riskRows),
    no_fake_clarity_guard_visible_now: allPass(context.guardRows),
    clarification_replay_precondition_visible_now: allPass(context.replayRows),
    blocked_seed_handoff_visible_now: allPass(context.handoffRows),
    no_fake_clarity_boundary_closed_now: allPass(context.boundaryRows),
    defaults_assumptions_ledger_count: context.defaultsRows.length,
    assumption_risk_classifier_count: context.riskRows.length,
    high_risk_assumption_count: context.riskRows.filter((item) => item.risk_tier === "high").length,
    fake_clarity_blocked_count: context.guardRows.filter((item) => item.fake_clarity_blocked_now === true).length,
    clarification_replay_precondition_count: context.replayRows.length,
    blocked_seed_handoff_count: context.handoffRows.length,
    default_applied_count: context.defaultsRows.filter((item) => item.default_applied_now === true).length,
    seed_unblocked_count: context.guardRows.filter((item) => item.seed_unblock_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P32801-P33200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P32801-P33200 Defaults Assumptions and No-Fake-Clarity Guard"), "Architecture doc missing P32801-P33200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P32800 source state is not visible"),
    validationItem("defaults.ledger.visible", "defaults_assumptions", allPass(context.defaultsRows), "Defaults assumptions ledger rows are incomplete"),
    validationItem("risk.classifier.visible", "defaults_assumptions", allPass(context.riskRows), "Assumption risk classifier rows are incomplete"),
    validationItem("guard.visible", "defaults_assumptions", allPass(context.guardRows), "No-fake-clarity guard rows are incomplete"),
    validationItem("replay.preconditions.visible", "defaults_assumptions", allPass(context.replayRows), "Clarification replay precondition rows are incomplete"),
    validationItem("blocked.seed.handoff.visible", "defaults_assumptions", allPass(context.handoffRows), "Blocked seed handoff rows are incomplete"),
    validationItem("no.default.apply", "authority", context.defaultsRows.every((item) => item.default_applied_now === false && item.missing_answer_default_allowed_now === false), "Defaults can replace missing answers"),
    validationItem("no.fake.clarity", "authority", context.guardRows.every((item) => item.fake_clarity_blocked_now === true && item.spec_marked_clear_now === false), "Fake clarity guard opened"),
    validationItem("no.seed.unblock", "authority", context.handoffRows.every((item) => item.final_seed_allowed_now === false && item.execution_allowed_now === false), "Blocked seed handoff opened execution"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p33200_checkpoint.fake_clarity_blocker_visible"), "P33200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "defaults_assumptions_no_fake_clarity.contract.v1",
    generated_at: generatedAt,
    source_p32800_required_or_rebuilt: true,
    defaults_assumptions_ledger_required: true,
    assumption_risk_classifier_required: true,
    no_fake_clarity_guard_required: true,
    clarification_replay_preconditions_required: true,
    blocked_seed_handoff_required: true,
    ui_projection_replay_deferred_to_p33201_p33600: true,
    p33200_is_not_default_apply_final_seed_execution_runtime_write_approval_deploy_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_ui_projection_replay_ledger
    ? READY_STATUS
    : validation.valid && boundary.p33200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    defaults_assumptions_no_fake_clarity_status: status,
    source_p32800_ready_for_defaults_guard: boundary.source_p32800_ready_for_defaults_guard,
    defaults_assumptions_ledger_count: boundary.defaults_assumptions_ledger_count,
    assumption_risk_classifier_count: boundary.assumption_risk_classifier_count,
    high_risk_assumption_count: boundary.high_risk_assumption_count,
    fake_clarity_blocked_count: boundary.fake_clarity_blocked_count,
    clarification_replay_precondition_count: boundary.clarification_replay_precondition_count,
    blocked_seed_handoff_count: boundary.blocked_seed_handoff_count,
    default_applied_count: boundary.default_applied_count,
    seed_unblocked_count: boundary.seed_unblocked_count,
    ready_for_ui_projection_replay_ledger: validation.valid && boundary.ready_for_ui_projection_replay_ledger,
    defaults_assumptions_default_auto_apply_allowed_now: false,
    defaults_assumptions_missing_answer_default_allowed_now: false,
    defaults_assumptions_assumption_as_fact_allowed_now: false,
    defaults_assumptions_fake_clarity_allowed_now: false,
    defaults_assumptions_seed_unblock_allowed_now: false,
    defaults_assumptions_final_seed_allowed_now: false,
    defaults_assumptions_runtime_execution_allowed_now: false,
    defaults_assumptions_write_action_allowed_now: false,
    defaults_assumptions_protected_action_allowed_now: false,
    defaults_assumptions_final_approval_allowed_now: false,
    defaults_assumptions_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Defaults Assumptions No-Fake-Clarity",
    "",
    `Status: ${result.summary.defaults_assumptions_no_fake_clarity_status}`,
    `Program: ${result.program_range}`,
    `P32800 ready for defaults guard: ${result.summary.source_p32800_ready_for_defaults_guard}`,
    `Defaults assumptions: ${result.summary.defaults_assumptions_ledger_count}`,
    `High risk assumptions: ${result.summary.high_risk_assumption_count}`,
    `Fake clarity blocked: ${result.summary.fake_clarity_blocked_count}`,
    `Blocked seed handoffs: ${result.summary.blocked_seed_handoff_count}`,
    `Default applied count: ${result.summary.default_applied_count}`,
    `Ready for UI projection replay ledger: ${result.summary.ready_for_ui_projection_replay_ledger}`,
    `Default auto apply allowed: ${result.summary.defaults_assumptions_default_auto_apply_allowed_now}`,
    `Fake clarity allowed: ${result.summary.defaults_assumptions_fake_clarity_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.blocked_seed_handoff_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.fake_clarity_blocked_now)}</td><td>${escapeHtml(item.blocked_reason_refs.join(", "))}</td><td>${escapeHtml(item.execution_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Defaults Assumptions No-Fake-Clarity</title>
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
    <h1>Hermes Defaults Assumptions No-Fake-Clarity</h1>
    <p class="notice">This artifact makes assumptions and blocked seeds visible only. It does not apply defaults, replace missing answers, mark specs clear, synthesize final seeds, execute runtime actions, approve, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Fake Clarity Blocked</th><th>Reasons</th><th>Execution</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP32800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildSeedSynthesisExecutionReadiness({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.seed_synthesis_execution_readiness", built);
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
  const defaults = DEFAULT_DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_seed_synthesis_execution_readiness_path: path.resolve(repoRoot, options.sourceSeedSynthesisExecutionReadinessPath ?? defaults.sourceSeedSynthesisExecutionReadinessPath),
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
      args.sourceSeedSynthesisExecutionReadinessPath = argv[++index];
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
  console.log(`Usage: node scripts/defaults-assumptions-no-fake-clarity.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P32801-P33200 Defaults Assumptions and No-Fake-Clarity Guard contract.
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
