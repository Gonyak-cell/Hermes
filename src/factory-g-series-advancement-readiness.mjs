import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryGateOpeningReadiness } from "./factory-gate-opening-readiness.mjs";

export const DEFAULT_FACTORY_G_SERIES_ADVANCEMENT_READINESS_OUT_DIR = "artifacts/factory-g-series-advancement-readiness/latest";
export const DEFAULT_FACTORY_G_SERIES_ADVANCEMENT_READINESS_INPUTS = {
  packagePath: "package.json",
  gateOpeningProgramDocPath: "docs/factory-promotion/05-gate-opening-program.md",
  masterPromotionPlanDocPath: "docs/factory-promotion/02-master-promotion-plan.md",
};

const COMMAND_NAME = "factory:g-series-advancement-readiness";
const SCHEMA_VERSION = "factory-g-series-advancement-readiness.v1";
const CAPABILITY_ID = "factory.g_series_advancement_readiness";
const PROGRAM_RANGE = "G-SERIES.1-7";
const SOURCE_PROGRAM_RANGE = "FCORE-FE+G1a";
const READY_STATUS = "ready_for_g_series_continued_code_development";
const BLOCKED_STATUS = "blocked_factory_g_series_advancement_readiness";

const CLOSED_AUTHORITY_FLAGS = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  command_execution_enabled: false,
  command_execution_allowed_now: false,
  work_packet_execution_allowed_now: false,
  work_item_execution_allowed_now: false,
  validation_loop_execution_allowed_now: false,
  worker_execution_allowed_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

const GATE_ADVANCEMENT_DEFINITIONS = [
  {
    gate_id: "G1b",
    gate_name: "repo_write_patch_apply",
    stage_id: "Stage5",
    authority_flag: "repo_write_allowed_now",
    required_previous_gate_id: "G1a",
    advancement_status_when_closed: "waiting_for_g1a_first_use_audit_before_repo_write",
    code_development_focus: "worktree-scoped apply contract, protected-path blocker, receipt-to-apply binding",
    runtime_scope_limit: "worktree-scoped patch apply only; one receipt permits one apply; protected paths stay blocked",
    required_evidence: [
      "g1a_first_use_audit_present",
      "g1b_owner_gate_opening_receipt_source_literal_commit",
      "fd_closed_apply_cycle_receipts",
    ],
  },
  {
    gate_id: "G2",
    gate_name: "command_execution",
    stage_id: "Stage6",
    authority_flag: "command_execution_enabled",
    required_previous_gate_id: "G1b",
    advancement_status_when_closed: "waiting_for_g1b_three_no_incident_usage_rows",
    code_development_focus: "allowlist command catalog, timeout/log envelope, sandbox receipt schema",
    runtime_scope_limit: "repo-local allowlist commands only with timeout and captured logs",
    required_evidence: [
      "g1b_no_incident_usage_rows_at_least_three",
      "command_allowlist_contract",
      "command_execution_receipt_schema",
    ],
  },
  {
    gate_id: "G3",
    gate_name: "deployment_staging",
    stage_id: "Stage7",
    authority_flag: "deployment_allowed_now",
    required_previous_gate_id: "G2",
    advancement_status_when_closed: "waiting_for_g2_release_candidate_evidence_loop",
    code_development_focus: "staging-only release candidate contract, rollback receipt, pilot boundary",
    runtime_scope_limit: "one pilot product in staging only; production stays closed",
    required_evidence: [
      "g2_command_execution_gate_open",
      "release_candidate_evidence_loop",
      "staging_rollback_receipt",
    ],
  },
];

const STAGE_ADVANCEMENT_DEFINITIONS = [
  {
    stage_id: "Stage6",
    stage_name: "limited_execution_and_e2e_intake",
    required_gate_id: "G2",
    advancement_status_when_closed: "waiting_for_g2_command_execution_gate",
    code_development_focus: "E2E intake, work-packet execution harness, validation-loop runtime contracts",
    runtime_scope_limit: "limited execution stays disabled until G2 source-literal gate opening",
    required_evidence: [
      "fe_freeze_handoff_ready",
      "g2_gate_open",
      "sandbox_command_receipts",
      "validation_loop_first_use_audits",
    ],
  },
  {
    stage_id: "Stage7",
    stage_name: "pilot_release_candidate",
    required_gate_id: "G3",
    advancement_status_when_closed: "waiting_for_stage6_and_g3_staging_gate",
    code_development_focus: "pilot release candidate manifest, staging deployment packet, scale closeout ledger",
    runtime_scope_limit: "release candidate and deployment stay disabled until Stage6 evidence and G3 opening",
    required_evidence: [
      "stage6_limited_execution_evidence",
      "g3_staging_gate_open",
      "pilot_release_candidate_receipts",
      "rollback_rehearsal_receipts",
    ],
  },
];

export async function runFactoryGSeriesAdvancementReadiness(options = {}) {
  const result = await buildFactoryGSeriesAdvancementReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryGSeriesAdvancementReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G-series Advancement Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g_series_advancement_readiness_status !== READY_STATUS) {
    const error = new Error("Factory G-series Advancement Readiness is not ready for continued code development.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryGSeriesAdvancementReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G_SERIES_ADVANCEMENT_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const gateProgramDoc = await readTextSource(inputs.gate_opening_program_doc_path);
  const masterPlanDoc = await readTextSource(inputs.master_promotion_plan_doc_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const gateOpeningReadiness = Object.prototype.hasOwnProperty.call(options, "gateOpeningReadiness")
    ? options.gateOpeningReadiness
    : await buildFactoryGateOpeningReadiness({ ...options, write: false, commitRef });

  const sourceState = buildSourceState({ packageJson, gateProgramDoc, masterPlanDoc, gateOpeningReadiness, commitRef });
  const gateRows = buildGateAdvancementRows({ gateOpeningReadiness, generatedAt });
  const stageRows = buildStageAdvancementRows({ gateRows, sourceState, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const boundary = buildBoundary({ sourceState, gateRows, stageRows, negativeFixtureRows, generatedAt });
  const validationItems = buildValidationItems({ sourceState, gateRows, stageRows, negativeFixtureRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ gateRows, stageRows, negativeFixtureRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      gate_opening_program_doc_path: gateProgramDoc.path,
      master_promotion_plan_doc_path: masterPlanDoc.path,
      gate_opening_readiness_ref: gateOpeningReadiness?.summary?.factory_gate_opening_readiness_status ?? null,
    },
    source_summaries: {
      gate_opening_readiness_valid: sourceState.gateOpeningReadinessValid,
      gate_open_count: sourceState.gateOpenCount,
      g1a_gate_status: sourceState.g1aGateStatus,
      g1a_source_evidence_complete_now: sourceState.g1aSourceEvidenceComplete,
      g1b_gate_status: sourceState.g1bGateStatus,
      g2_gate_status: sourceState.g2GateStatus,
      g3_gate_status: sourceState.g3GateStatus,
      fe_freeze_handoff_ready: sourceState.feReady,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
    },
    factory_g_series_gate_advancement_rows: gateRows,
    factory_g_series_stage_advancement_rows: stageRows,
    factory_g_series_advancement_negative_fixture_rows: negativeFixtureRows,
    factory_g_series_advancement_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryGSeriesAdvancementReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g-series-advancement-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "g-series-gate-advancement-rows.json"), collectionEnvelope("factory-g-series-gate-advancement-rows.v1", "factory_g_series_gate_advancement_rows", result.factory_g_series_gate_advancement_rows, result.generated_at));
  await writeJson(path.join(outDir, "stage-advancement-rows.json"), collectionEnvelope("factory-g-series-stage-advancement-rows.v1", "factory_g_series_stage_advancement_rows", result.factory_g_series_stage_advancement_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-g-series-advancement-negative-fixture-rows.v1", "factory_g_series_advancement_negative_fixture_rows", result.factory_g_series_advancement_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g_series_advancement_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g-series-advancement-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryGSeriesAdvancementReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryGSeriesAdvancementReadiness(args);
    console.log(`Factory G-series Advancement Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g_series_advancement_readiness_status}`);
    console.log(`Gate advancement rows: ${result.summary.gate_advancement_count}`);
    console.log(`Stage advancement rows: ${result.summary.stage_advancement_count}`);
    console.log(`Code development allowed: ${result.summary.g_series_code_development_allowed_now}`);
    console.log(`Runtime authority open: ${result.summary.g_series_runtime_authority_open_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_G_SERIES_ADVANCEMENT_READINESS_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    gate_opening_program_doc_path: path.resolve(repoRoot, options.gateOpeningProgramDocPath ?? defaults.gateOpeningProgramDocPath),
    master_promotion_plan_doc_path: path.resolve(repoRoot, options.masterPromotionPlanDocPath ?? defaults.masterPromotionPlanDocPath),
  };
}

function buildSourceState({ packageJson, gateProgramDoc, masterPlanDoc, gateOpeningReadiness, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  const gateRows = gateOpeningReadiness?.factory_gate_opening_readiness_rows ?? [];
  return {
    commitRefPresent: Boolean(commitRef),
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g-series-advancement-readiness.mjs"),
    gateProgramDocReady: gateProgramDoc.available
      && gateProgramDoc.text.includes("G1b")
      && gateProgramDoc.text.includes("G2")
      && gateProgramDoc.text.includes("G3")
      && gateProgramDoc.text.includes("repo_write_allowed_now")
      && gateProgramDoc.text.includes("command_execution_enabled")
      && gateProgramDoc.text.includes("deployment_allowed_now"),
    masterPlanDocReady: masterPlanDoc.available
      && masterPlanDoc.text.includes("Stage 6")
      && masterPlanDoc.text.includes("Stage 7")
      && masterPlanDoc.text.includes("production_pass_enabled"),
    gateOpeningReadinessValid: gateOpeningReadiness?.validation?.valid === true,
    gateOpeningReadinessStatus: gateOpeningReadiness?.summary?.factory_gate_opening_readiness_status ?? null,
    gateOpenCount: Number(gateOpeningReadiness?.summary?.gate_open_count ?? 0),
    g1aGateStatus: gateRows.find((row) => row.gate_id === "G1a")?.gate_status ?? null,
    g1aSourceEvidenceComplete: gateRows.find((row) => row.gate_id === "G1a")?.gate_evidence_complete_now === true,
    g1bGateStatus: gateRows.find((row) => row.gate_id === "G1b")?.gate_status ?? null,
    g2GateStatus: gateRows.find((row) => row.gate_id === "G2")?.gate_status ?? null,
    g3GateStatus: gateRows.find((row) => row.gate_id === "G3")?.gate_status ?? null,
    g1aGateOpen: gateRows.find((row) => row.gate_id === "G1a")?.gate_open_now === true,
    g1bGateOpen: gateRows.find((row) => row.gate_id === "G1b")?.gate_open_now === true,
    g2GateOpen: gateRows.find((row) => row.gate_id === "G2")?.gate_open_now === true,
    g3GateOpen: gateRows.find((row) => row.gate_id === "G3")?.gate_open_now === true,
    feReady: gateOpeningReadiness?.source_summaries?.fe_ready === true,
  };
}

function buildGateAdvancementRows({ gateOpeningReadiness, generatedAt }) {
  const sourceRows = gateOpeningReadiness?.factory_gate_opening_readiness_rows ?? [];
  return GATE_ADVANCEMENT_DEFINITIONS.map((definition, index) => {
    const sourceGate = sourceRows.find((row) => row.gate_id === definition.gate_id) ?? {};
    const gateOpen = sourceGate.gate_open_now === true;
    const row = {
      schema_version: "factory-g-series-gate-advancement-row.v1",
      advancement_id: `g-series.gate.${definition.gate_id}`,
      row_kind: "gate_advancement",
      gate_id: definition.gate_id,
      gate_name: definition.gate_name,
      stage_id: definition.stage_id,
      authority_flag: definition.authority_flag,
      required_previous_gate_id: definition.required_previous_gate_id,
      source_gate_status: sourceGate.gate_status ?? "missing_source_gate_row",
      prerequisite_status: sourceGate.prerequisite_status ?? "missing",
      previous_gate_status: sourceGate.previous_gate_status ?? "missing",
      gate_open_now: gateOpen,
      source_gate_evidence_complete_now: sourceGate.gate_evidence_complete_now === true,
      advancement_status: buildGateAdvancementStatus({ definition, sourceGate, gateOpen }),
      code_development_allowed_now: true,
      runtime_authority_allowed_now: false,
      source_literal_gate_open_commit_present: sourceGate.source_literal_gate_open_commit_present === true,
      owner_gate_opening_receipt_present: sourceGate.owner_gate_opening_receipt_present === true,
      first_use_audit_present: sourceGate.first_use_audit_present === true,
      missing_evidence_ids: sourceGate.gate_evidence_complete_now === true ? [] : sourceGate.blocked_reason_ids ?? ["missing_source_gate_row"],
      required_evidence: definition.required_evidence,
      code_development_focus: definition.code_development_focus,
      runtime_scope_limit: definition.runtime_scope_limit,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
      independent_review_required_before_protected_closeout: true,
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
      g1b_repo_write_gate_open_now: definition.gate_id === "G1b" ? gateOpen : false,
      g2_command_execution_gate_open_now: definition.gate_id === "G2" ? gateOpen : false,
      g3_deployment_gate_open_now: definition.gate_id === "G3" ? gateOpen : false,
    };
    return { ...row, gate_advancement_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildStageAdvancementRows({ gateRows, sourceState, generatedAt }) {
  return STAGE_ADVANCEMENT_DEFINITIONS.map((definition, index) => {
    const requiredGate = gateRows.find((row) => row.gate_id === definition.required_gate_id);
    const requiredGateOpen = requiredGate?.gate_open_now === true;
    const requiredGateEvidenceComplete = requiredGate?.source_gate_evidence_complete_now === true;
    const stageRuntimeOpen = false;
    const row = {
      schema_version: "factory-g-series-stage-advancement-row.v1",
      advancement_id: `g-series.stage.${definition.stage_id}`,
      row_kind: "stage_advancement",
      stage_id: definition.stage_id,
      stage_name: definition.stage_name,
      required_gate_id: definition.required_gate_id,
      required_gate_status: requiredGate?.source_gate_status ?? sourceState[`${definition.required_gate_id.toLowerCase()}GateStatus`] ?? "missing",
      required_gate_open_now: requiredGateOpen,
      required_gate_source_evidence_complete_now: requiredGateEvidenceComplete,
      advancement_status: requiredGateEvidenceComplete ? "source_evidence_complete_runtime_authority_closed" : definition.advancement_status_when_closed,
      code_development_allowed_now: true,
      runtime_authority_allowed_now: false,
      stage_runtime_open_now: false,
      fe_freeze_handoff_ready: sourceState.feReady,
      required_evidence: definition.required_evidence,
      missing_evidence_ids: buildStageMissingEvidenceIds(definition, requiredGate, sourceState),
      code_development_focus: definition.code_development_focus,
      runtime_scope_limit: definition.runtime_scope_limit,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
      independent_review_required_before_protected_closeout: true,
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
      stage6_limited_execution_allowed_now: false,
      stage7_release_candidate_allowed_now: false,
    };
    return { ...row, stage_advancement_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildGateAdvancementStatus({ definition, sourceGate, gateOpen }) {
  if (gateOpen) return "ready_for_scoped_runtime_usage";
  if (sourceGate.gate_evidence_complete_now === true) return "source_evidence_complete_runtime_authority_closed";
  if (
    definition.gate_id === "G1b"
    && sourceGate.previous_gate_status === "not_required_or_open"
    && sourceGate.owner_gate_opening_receipt_present !== true
  ) {
    return "waiting_for_g1b_owner_receipt_and_source_literal_commit";
  }
  return definition.advancement_status_when_closed;
}

function buildStageMissingEvidenceIds(definition, requiredGate, sourceState) {
  const missing = [];
  if (sourceState.feReady !== true) missing.push("fe_freeze_handoff_not_ready");
  if (requiredGate?.source_gate_evidence_complete_now !== true) missing.push(`${definition.required_gate_id.toLowerCase()}_source_evidence_not_complete`);
  if (definition.stage_id === "Stage7") {
    if (requiredGate?.source_gate_evidence_complete_now !== true) {
      missing.push("stage6_limited_execution_evidence_missing");
      missing.push("pilot_release_candidate_receipts_missing");
      missing.push("rollback_rehearsal_receipts_missing");
    }
  }
  if (definition.stage_id === "Stage6") {
    if (requiredGate?.source_gate_evidence_complete_now !== true) {
      missing.push("sandbox_command_receipts_missing");
      missing.push("validation_loop_first_use_audits_missing");
    }
  }
  return [...new Set(missing)];
}

function buildNegativeFixtureRows(generatedAt) {
  const fixtures = [
    ["g1b_repo_write_without_gate", "repo_write_patch_apply", "G1b", "Repo write/apply attempt without G1b gate remains blocked."],
    ["g2_command_execution_without_gate", "command_execution", "G2", "Command execution attempt without G2 gate remains blocked."],
    ["g3_deployment_without_gate", "deployment_staging", "G3", "Deployment attempt without G3 gate remains blocked."],
    ["stage6_sandbox_runtime_without_g2", "limited_execution_runtime", "G2", "Stage6 sandbox runtime stays blocked while G2 is closed."],
    ["stage7_release_candidate_without_g3", "pilot_release_candidate", "G3", "Stage7 release candidate stays blocked while Stage6 evidence and G3 are missing."],
    ["protected_closeout_without_human_or_independent_review", "protected_closeout", "human_owner_and_independent_review", "Protected closeout cannot be completed by skipped human approval or AI lane."],
  ];
  return fixtures.map(([fixtureKey, attemptedActionKind, requiredGateId, description], index) => {
    const row = {
      schema_version: "factory-g-series-advancement-negative-fixture-row.v1",
      fixture_id: `g-series-negative.${fixtureKey}`,
      fixture_key: fixtureKey,
      attempted_action_kind: attemptedActionKind,
      required_gate_id: requiredGateId,
      fixture_status: "blocked_as_expected",
      description,
      observed_mutation_now: false,
      observed_runtime_authority_open_now: false,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildBoundary({ sourceState, gateRows, stageRows, negativeFixtureRows, generatedAt }) {
  const gateOpenCount = gateRows.filter((row) => row.gate_open_now).length;
  return {
    schema_version: "factory-g-series-advancement-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    source_literal_authority_model: true,
    data_driven_gate_opening_allowed_now: false,
    g_series_code_development_allowed_now: true,
    g_series_runtime_authority_open_now: false,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    human_owner_protected_closeout_required: true,
    independent_review_required_before_protected_closeout: true,
    factory_promotion_goal_complete_allowed_now: false,
    gate_opening_readiness_valid: sourceState.gateOpeningReadinessValid,
    source_gate_open_count: sourceState.gateOpenCount,
    gate_advancement_count: gateRows.length,
    gate_advancement_open_count: gateOpenCount,
    gate_advancement_evidence_complete_count: gateRows.filter((row) => row.source_gate_evidence_complete_now).length,
    stage_advancement_count: stageRows.length,
    stage_runtime_open_count: 0,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    g1a_source_evidence_complete_now: sourceState.g1aSourceEvidenceComplete,
    g1a_project_creation_gate_open_now: sourceState.g1aGateOpen,
    g1b_repo_write_gate_open_now: sourceState.g1bGateOpen,
    g1b_source_evidence_complete_now: gateRows.find((row) => row.gate_id === "G1b")?.source_gate_evidence_complete_now === true,
    g2_command_execution_gate_open_now: sourceState.g2GateOpen,
    g2_source_evidence_complete_now: gateRows.find((row) => row.gate_id === "G2")?.source_gate_evidence_complete_now === true,
    g3_deployment_gate_open_now: sourceState.g3GateOpen,
    g3_source_evidence_complete_now: gateRows.find((row) => row.gate_id === "G3")?.source_gate_evidence_complete_now === true,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, gateRows, stageRows, negativeFixtureRows, boundary }) {
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:g-series-advancement-readiness"),
    validationItem("docs.gate_program_ready", "docs", sourceState.gateProgramDocReady, "Gate opening program doc is missing G1b/G2/G3 authority wording"),
    validationItem("docs.master_plan_ready", "docs", sourceState.masterPlanDocReady, "Master promotion plan is missing Stage6/Stage7 trust boundary wording"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("source.gate_opening_readiness_valid", "source", sourceState.gateOpeningReadinessValid, "Factory gate opening readiness source is invalid"),
    validationItem("gates.rows_present", "gates", gateRows.length === 3, "G1b/G2/G3 advancement rows are incomplete"),
    validationItem("gates.code_development_open_runtime_closed", "authority", gateRows.every((row) => row.code_development_allowed_now === true && row.runtime_authority_allowed_now === false), "Gate rows do not separate code development from runtime authority"),
    validationItem("stages.rows_present", "stages", stageRows.length === 2, "Stage6/Stage7 advancement rows are incomplete"),
    validationItem("stages.code_development_open_runtime_closed", "authority", stageRows.every((row) => row.code_development_allowed_now === true && row.runtime_authority_allowed_now === false && row.stage_runtime_open_now === false), "Stage rows do not keep runtime authority closed"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length >= 6 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "G-series negative fixtures did not all block"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Protected authority boundary opened"),
    validationItem("boundary.human_skip_not_closeout", "authority", boundary.human_owner_approval_skipped_for_development_now === true && boundary.human_owner_approval_counted_as_closeout === false, "Skipped human approval was counted as protected closeout"),
  ];
}

function buildSummary({ gateRows, stageRows, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid
    && boundary.g_series_code_development_allowed_now === true
    && boundary.g_series_runtime_authority_open_now === false
    && boundaryFlagsClosed(boundary);
  return {
    factory_g_series_advancement_readiness_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    gate_advancement_count: gateRows.length,
    gate_advancement_open_count: gateRows.filter((row) => row.gate_open_now).length,
    gate_advancement_evidence_complete_count: gateRows.filter((row) => row.source_gate_evidence_complete_now).length,
    gate_advancement_waiting_count: gateRows.filter((row) => row.gate_open_now === false).length,
    g1a_source_evidence_complete_now: boundary.g1a_source_evidence_complete_now,
    g1b_source_evidence_complete_now: boundary.g1b_source_evidence_complete_now,
    g2_source_evidence_complete_now: boundary.g2_source_evidence_complete_now,
    g3_source_evidence_complete_now: boundary.g3_source_evidence_complete_now,
    stage_advancement_count: stageRows.length,
    stage_runtime_open_count: 0,
    stage_advancement_waiting_count: stageRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    g_series_code_development_allowed_now: true,
    g_series_runtime_authority_open_now: false,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    human_owner_protected_closeout_required: true,
    independent_review_required_before_protected_closeout: true,
    data_driven_gate_opening_allowed_now: false,
    source_literal_authority_model: true,
    factory_promotion_goal_complete_allowed_now: false,
    g1a_project_creation_gate_open_now: boundary.g1a_project_creation_gate_open_now,
    g1b_repo_write_gate_open_now: boundary.g1b_repo_write_gate_open_now,
    g2_command_execution_gate_open_now: boundary.g2_command_execution_gate_open_now,
    g3_deployment_gate_open_now: boundary.g3_deployment_gate_open_now,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g-series-advancement-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function boundaryFlagsClosed(boundary) {
  return [
    ...Object.keys(CLOSED_AUTHORITY_FLAGS),
    "factory_promotion_goal_complete_allowed_now",
    "g_series_runtime_authority_open_now",
    "g1a_project_creation_gate_open_now",
    "g1b_repo_write_gate_open_now",
    "g2_command_execution_gate_open_now",
    "g3_deployment_gate_open_now",
    "stage6_limited_execution_allowed_now",
    "stage7_release_candidate_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory G-series Advancement Readiness",
    "",
    `Status: ${result.summary.factory_g_series_advancement_readiness_status}`,
    `Program: ${result.program_range}`,
    `Gate advancement rows: ${result.summary.gate_advancement_count}`,
    `Gate runtime open now: ${result.summary.gate_advancement_open_count}`,
    `Stage advancement rows: ${result.summary.stage_advancement_count}`,
    `Stage runtime open now: ${result.summary.stage_runtime_open_count}`,
    `Code development allowed: ${result.summary.g_series_code_development_allowed_now}`,
    `Runtime authority open: ${result.summary.g_series_runtime_authority_open_now}`,
    `Human approval skipped for development: ${result.summary.human_owner_approval_skipped_for_development_now}`,
    `Human approval counted as closeout: ${result.summary.human_owner_approval_counted_as_closeout}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Factory goal complete allowed: ${result.summary.factory_promotion_goal_complete_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") { args.check = true; args.write = false; }
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g-series-advancement-readiness.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds G1b/G2/G3 plus Stage6/Stage7 advancement readiness while keeping runtime authority closed.`);
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(text),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    return {
      path: filePath,
      available: true,
      text: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      error: error.message,
    };
  }
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
