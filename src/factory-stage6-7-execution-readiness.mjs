import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryFeFreezeHandoff } from "./factory-fe-freeze-handoff.mjs";
import { buildFactoryGSeriesAdvancementReadiness } from "./factory-g-series-advancement-readiness.mjs";
import { buildFactoryGSeriesRuntimeGuards } from "./factory-g-series-runtime-guards.mjs";

export const DEFAULT_FACTORY_STAGE6_7_EXECUTION_READINESS_OUT_DIR = "artifacts/factory-stage6-7-execution-readiness/latest";
export const DEFAULT_FACTORY_STAGE6_7_EXECUTION_READINESS_INPUTS = {
  packagePath: "package.json",
  masterPromotionPlanDocPath: "docs/factory-promotion/02-master-promotion-plan.md",
};

const COMMAND_NAME = "factory:stage6-7-execution-readiness";
const SCHEMA_VERSION = "factory-stage6-7-execution-readiness.v1";
const CAPABILITY_ID = "factory.stage6_7_execution_readiness";
const PROGRAM_RANGE = "STAGE6-7";
const SOURCE_PROGRAM_RANGE = "FCORE-FE+G-SERIES";
const READY_STATUS = "ready_stage6_stage7_contract_development";
const BLOCKED_STATUS = "blocked_factory_stage6_7_execution_readiness";

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

const STAGE6_CONTRACT_BLUEPRINTS = [
  ["stage6.intake_runtime_contract", "E2E intake runtime envelope", "g2_command_execution", "bind intake request to work-packet candidate and receipt log"],
  ["stage6.work_packet_execution_contract", "Work-packet execution envelope", "g2_command_execution", "execute one FE.2 work packet only after command receipts are available"],
  ["stage6.validation_loop_runtime_contract", "Validation-loop runtime envelope", "g2_command_execution", "bind FE.3 validation loop steps to test evidence and review packet"],
  ["stage6.receipt_and_log_binding_contract", "Runtime receipt and log binding", "g2_command_execution", "hash command logs, validation evidence, and first-use audits"],
];

const STAGE7_CONTRACT_BLUEPRINTS = [
  ["stage7.hermes_harness_pilot_rc", "Hermes harness pilot release candidate", "g3_deployment_staging", "first pilot product stays hermes_harness and staging-only"],
  ["stage7.staging_deploy_contract", "Staging deployment packet", "g3_deployment_staging", "deploy only a source-bound release candidate to staging"],
  ["stage7.rollback_rehearsal_contract", "Rollback rehearsal packet", "g3_deployment_staging", "prove staged rollback before wider pilot use"],
  ["stage7.scale_closeout_contract", "Scale closeout ledger", "g3_deployment_staging", "collect pilot evidence without production or enterprise trust"],
];

export async function runFactoryStage67ExecutionReadiness(options = {}) {
  const result = await buildFactoryStage67ExecutionReadiness(options);
  if (!options.check && options.write !== false) await writeFactoryStage67ExecutionReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Stage6/7 Execution Readiness failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_stage6_7_execution_readiness_status !== READY_STATUS) {
    const error = new Error("Factory Stage6/7 Execution Readiness is not ready for contract development.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryStage67ExecutionReadiness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_STAGE6_7_EXECUTION_READINESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const masterPlanDoc = await readTextSource(inputs.master_promotion_plan_doc_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const feFreezeHandoff = Object.prototype.hasOwnProperty.call(options, "feFreezeHandoff")
    ? options.feFreezeHandoff
    : await buildFactoryFeFreezeHandoff({ ...options, write: false, commitRef });
  const advancementReadiness = Object.prototype.hasOwnProperty.call(options, "advancementReadiness")
    ? options.advancementReadiness
    : await buildFactoryGSeriesAdvancementReadiness({ ...options, write: false, commitRef });
  const runtimeGuards = Object.prototype.hasOwnProperty.call(options, "runtimeGuards")
    ? options.runtimeGuards
    : await buildFactoryGSeriesRuntimeGuards({ ...options, write: false, commitRef, advancementReadiness });

  const sourceState = buildSourceState({ packageJson, masterPlanDoc, feFreezeHandoff, advancementReadiness, runtimeGuards, commitRef });
  const stage6Rows = buildStage6ContractRows({ sourceState, runtimeGuards, generatedAt });
  const stage7Rows = buildStage7ContractRows({ sourceState, runtimeGuards, generatedAt });
  const closeoutRows = buildStageCloseoutRows({ sourceState, stage6Rows, stage7Rows, generatedAt });
  const boundary = buildBoundary({ sourceState, stage6Rows, stage7Rows, closeoutRows, generatedAt });
  const validationItems = buildValidationItems({ sourceState, stage6Rows, stage7Rows, closeoutRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ stage6Rows, stage7Rows, closeoutRows, boundary, validation });
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
      master_promotion_plan_doc_path: masterPlanDoc.path,
      fe_freeze_handoff_status: sourceState.feFreezeStatus,
      g_series_advancement_status: sourceState.advancementStatus,
      g_series_runtime_guard_status: sourceState.runtimeGuardStatus,
    },
    source_summaries: {
      fe_counts: sourceState.feCounts,
      stage6_runtime_guard_blocked: sourceState.stage6GuardBlocked,
      stage7_runtime_guard_blocked: sourceState.stage7GuardBlocked,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
    },
    factory_stage6_execution_contract_rows: stage6Rows,
    factory_stage7_release_candidate_contract_rows: stage7Rows,
    factory_stage6_7_closeout_rows: closeoutRows,
    factory_stage6_7_execution_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryStage67ExecutionReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-stage6-7-execution-readiness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "stage6-execution-contract-rows.json"), collectionEnvelope("factory-stage6-execution-contract-rows.v1", "factory_stage6_execution_contract_rows", result.factory_stage6_execution_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "stage7-release-candidate-contract-rows.json"), collectionEnvelope("factory-stage7-release-candidate-contract-rows.v1", "factory_stage7_release_candidate_contract_rows", result.factory_stage7_release_candidate_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "stage6-7-closeout-rows.json"), collectionEnvelope("factory-stage6-7-closeout-rows.v1", "factory_stage6_7_closeout_rows", result.factory_stage6_7_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_stage6_7_execution_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-stage6-7-execution-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryStage67ExecutionReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryStage67ExecutionReadiness(args);
    console.log(`Factory Stage6/7 Execution Readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_stage6_7_execution_readiness_status}`);
    console.log(`Stage6 contracts: ${result.summary.stage6_contract_count}`);
    console.log(`Stage7 contracts: ${result.summary.stage7_contract_count}`);
    console.log(`Runtime authority open: ${result.summary.stage6_7_runtime_authority_open_now}`);
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
  const defaults = DEFAULT_FACTORY_STAGE6_7_EXECUTION_READINESS_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    master_promotion_plan_doc_path: path.resolve(repoRoot, options.masterPromotionPlanDocPath ?? defaults.masterPromotionPlanDocPath),
  };
}

function buildSourceState({ packageJson, masterPlanDoc, feFreezeHandoff, advancementReadiness, runtimeGuards, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  const fe2Summary = feFreezeHandoff?.source_summaries?.fe2_summary ?? {};
  const fe3Summary = feFreezeHandoff?.source_summaries?.fe3_summary ?? {};
  const guardRows = runtimeGuards?.factory_g_series_runtime_guard_rows ?? [];
  return {
    commitRefPresent: Boolean(commitRef),
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-stage6-7-execution-readiness.mjs"),
    masterPlanDocReady: masterPlanDoc.available
      && masterPlanDoc.text.includes("Stage 6")
      && masterPlanDoc.text.includes("Stage 7")
      && masterPlanDoc.text.includes("project.hermes_harness"),
    feFreezeValid: feFreezeHandoff?.validation?.valid === true,
    feFreezeStatus: feFreezeHandoff?.summary?.factory_fe_freeze_handoff_status ?? null,
    advancementValid: advancementReadiness?.validation?.valid === true,
    advancementStatus: advancementReadiness?.summary?.factory_g_series_advancement_readiness_status ?? null,
    runtimeGuardsValid: runtimeGuards?.validation?.valid === true,
    runtimeGuardStatus: runtimeGuards?.summary?.factory_g_series_runtime_guards_status ?? null,
    stage6GuardBlocked: guardRows.some((row) => row.attempt_kind === "stage6_limited_execution_runtime" && row.guard_status === "blocked_as_expected"),
    stage7GuardBlocked: guardRows.some((row) => row.attempt_kind === "stage7_pilot_release_candidate" && row.guard_status === "blocked_as_expected"),
    feCounts: {
      work_packet_candidate_count: Number(fe2Summary.work_packet_candidate_count ?? 0),
      work_item_candidate_count: Number(fe2Summary.work_item_candidate_count ?? 0),
      validation_loop_candidate_count: Number(fe3Summary.validation_loop_candidate_count ?? 0),
      validation_loop_step_candidate_count: Number(fe3Summary.validation_loop_step_candidate_count ?? 0),
      validation_loop_gate_count: Number(fe3Summary.validation_loop_gate_count ?? 0),
    },
  };
}

function buildStage6ContractRows({ sourceState, runtimeGuards, generatedAt }) {
  const guard = runtimeGuards.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "stage6_limited_execution_runtime");
  return STAGE6_CONTRACT_BLUEPRINTS.map(([contractId, contractName, guardAttemptKind, contractScope], index) => {
    const row = {
      schema_version: "factory-stage6-execution-contract-row.v1",
      contract_id: contractId,
      stage_id: "Stage6",
      contract_name: contractName,
      guard_attempt_kind: guardAttemptKind,
      required_gate_id: "G2",
      contract_scope: contractScope,
      contract_status: "contract_development_ready_runtime_blocked",
      code_development_allowed_now: true,
      runtime_execution_allowed_now: false,
      command_spawn_allowed_now: false,
      source_counts: sourceState.feCounts,
      runtime_guard_status: guard?.guard_status ?? "missing_guard",
      missing_evidence_ids: guard?.blocked_reason_ids ?? ["stage6_guard_missing"],
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, stage6_contract_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildStage7ContractRows({ sourceState, runtimeGuards, generatedAt }) {
  const guard = runtimeGuards.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "stage7_pilot_release_candidate");
  return STAGE7_CONTRACT_BLUEPRINTS.map(([contractId, contractName, guardAttemptKind, contractScope], index) => {
    const row = {
      schema_version: "factory-stage7-release-candidate-contract-row.v1",
      contract_id: contractId,
      stage_id: "Stage7",
      contract_name: contractName,
      guard_attempt_kind: guardAttemptKind,
      required_gate_id: "G3",
      pilot_product_id: "project.hermes_harness",
      contract_scope: contractScope,
      contract_status: "contract_development_ready_release_blocked",
      code_development_allowed_now: true,
      release_candidate_allowed_now: false,
      staging_deployment_allowed_now: false,
      runtime_guard_status: guard?.guard_status ?? "missing_guard",
      missing_evidence_ids: guard?.blocked_reason_ids ?? ["stage7_guard_missing"],
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, stage7_contract_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildStageCloseoutRows({ sourceState, stage6Rows, stage7Rows, generatedAt }) {
  const rows = [
    ["stage6.runtime_evidence_closeout", "Stage6 runtime evidence closeout remains blocked until G2 opens", sourceState.stage6GuardBlocked],
    ["stage7.release_candidate_closeout", "Stage7 release candidate closeout remains blocked until Stage6 evidence and G3 open", sourceState.stage7GuardBlocked],
    ["stage7.production_enterprise_trust", "Production and enterprise trust remain outside Stage7 pilot release candidate scope", true],
  ];
  return rows.map(([closeoutId, description, guardBlocked], index) => {
    const row = {
      schema_version: "factory-stage6-7-closeout-row.v1",
      closeout_id: closeoutId,
      description,
      closeout_status: guardBlocked ? "blocked_as_expected" : "missing_runtime_guard",
      stage6_contract_count: stage6Rows.length,
      stage7_contract_count: stage7Rows.length,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
      independent_review_required_before_protected_closeout: true,
      generated_at: generatedAt,
      ordinal: index + 1,
      ...CLOSED_AUTHORITY_FLAGS,
    };
    return { ...row, closeout_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildBoundary({ sourceState, stage6Rows, stage7Rows, closeoutRows, generatedAt }) {
  return {
    schema_version: "factory-stage6-7-execution-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    stage6_7_contract_development_allowed_now: true,
    stage6_7_runtime_authority_open_now: false,
    stage6_contract_count: stage6Rows.length,
    stage7_contract_count: stage7Rows.length,
    closeout_row_count: closeoutRows.length,
    closeout_blocked_count: closeoutRows.filter((row) => row.closeout_status === "blocked_as_expected").length,
    fe_work_packet_candidate_count: sourceState.feCounts.work_packet_candidate_count,
    fe_work_item_candidate_count: sourceState.feCounts.work_item_candidate_count,
    fe_validation_loop_candidate_count: sourceState.feCounts.validation_loop_candidate_count,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    independent_review_required_before_protected_closeout: true,
    factory_promotion_goal_complete_allowed_now: false,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    staging_deployment_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, stage6Rows, stage7Rows, closeoutRows, boundary }) {
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:stage6-7-execution-readiness"),
    validationItem("docs.master_plan_ready", "docs", sourceState.masterPlanDocReady, "Master promotion plan does not expose Stage6/Stage7 and hermes_harness pilot order"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("source.fe_freeze_valid", "source", sourceState.feFreezeValid, "FE freeze handoff source is invalid"),
    validationItem("source.advancement_valid", "source", sourceState.advancementValid, "G-series advancement source is invalid"),
    validationItem("source.runtime_guards_valid", "source", sourceState.runtimeGuardsValid, "G-series runtime guards source is invalid"),
    validationItem("source.fe_counts", "source", sourceState.feCounts.work_packet_candidate_count === 15 && sourceState.feCounts.work_item_candidate_count === 60 && sourceState.feCounts.validation_loop_candidate_count === 15, "FE count vector is not available for Stage6/7 contracts"),
    validationItem("stage6.rows_present", "stage6", stage6Rows.length === 4 && stage6Rows.every((row) => row.code_development_allowed_now === true && row.runtime_execution_allowed_now === false), "Stage6 execution contract rows are incomplete or opened runtime"),
    validationItem("stage7.rows_present", "stage7", stage7Rows.length === 4 && stage7Rows.every((row) => row.code_development_allowed_now === true && row.release_candidate_allowed_now === false), "Stage7 release candidate rows are incomplete or opened release authority"),
    validationItem("closeout.rows_blocked", "closeout", closeoutRows.length === 3 && closeoutRows.every((row) => row.closeout_status === "blocked_as_expected"), "Stage6/7 closeout rows are not blocked as expected"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Stage6/7 authority boundary opened"),
    validationItem("boundary.human_skip_not_closeout", "authority", boundary.human_owner_approval_skipped_for_development_now === true && boundary.human_owner_approval_counted_as_closeout === false, "Skipped human approval was counted as protected closeout"),
  ];
}

function buildSummary({ stage6Rows, stage7Rows, closeoutRows, boundary, validation }) {
  const ready = validation.valid
    && boundary.stage6_7_contract_development_allowed_now === true
    && boundaryFlagsClosed(boundary);
  return {
    factory_stage6_7_execution_readiness_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    stage6_contract_count: stage6Rows.length,
    stage7_contract_count: stage7Rows.length,
    closeout_row_count: closeoutRows.length,
    closeout_blocked_count: closeoutRows.filter((row) => row.closeout_status === "blocked_as_expected").length,
    stage6_7_contract_development_allowed_now: true,
    stage6_7_runtime_authority_open_now: false,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    independent_review_required_before_protected_closeout: true,
    factory_promotion_goal_complete_allowed_now: false,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    staging_deployment_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-stage6-7-execution-validation-item.v1",
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
    "stage6_7_runtime_authority_open_now",
    "stage6_limited_execution_allowed_now",
    "stage7_release_candidate_allowed_now",
    "staging_deployment_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory Stage6/7 Execution Readiness",
    "",
    `Status: ${result.summary.factory_stage6_7_execution_readiness_status}`,
    `Program: ${result.program_range}`,
    `Stage6 contracts: ${result.summary.stage6_contract_count}`,
    `Stage7 contracts: ${result.summary.stage7_contract_count}`,
    `Closeout blocked: ${result.summary.closeout_blocked_count}/${result.summary.closeout_row_count}`,
    `Contract development allowed: ${result.summary.stage6_7_contract_development_allowed_now}`,
    `Runtime authority open: ${result.summary.stage6_7_runtime_authority_open_now}`,
    `Stage6 limited execution allowed: ${result.summary.stage6_limited_execution_allowed_now}`,
    `Stage7 release candidate allowed: ${result.summary.stage7_release_candidate_allowed_now}`,
    `Human approval skipped for development: ${result.summary.human_owner_approval_skipped_for_development_now}`,
    `Human approval counted as closeout: ${result.summary.human_owner_approval_counted_as_closeout}`,
    `Factory goal complete allowed: ${result.summary.factory_promotion_goal_complete_allowed_now}`,
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
  console.log(`Usage: node scripts/factory-stage6-7-execution-readiness.mjs [--check] [--require-pass] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds Stage6 execution and Stage7 pilot release-candidate contract readiness while keeping runtime authority closed.`);
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
