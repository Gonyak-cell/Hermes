import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryGSeriesAdvancementReadiness } from "./factory-g-series-advancement-readiness.mjs";

export const DEFAULT_FACTORY_G_SERIES_RUNTIME_GUARDS_OUT_DIR = "artifacts/factory-g-series-runtime-guards/latest";
export const DEFAULT_FACTORY_G_SERIES_RUNTIME_GUARDS_INPUTS = {
  packagePath: "package.json",
};

const COMMAND_NAME = "factory:g-series-runtime-guards";
const SCHEMA_VERSION = "factory-g-series-runtime-guards.v1";
const CAPABILITY_ID = "factory.g_series_runtime_guards";
const PROGRAM_RANGE = "G-SERIES.1-7";
const SOURCE_PROGRAM_RANGE = "factory.g_series_advancement_readiness";
const READY_STATUS = "ready_runtime_guards_block_protected_actions";
const BLOCKED_STATUS = "blocked_factory_g_series_runtime_guards";

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

const ATTEMPT_DEFINITIONS = [
  {
    attempt_kind: "g1b_repo_write_patch_apply",
    required_gate_id: "G1b",
    required_stage_id: "Stage5",
    protected_surface: "repo_write",
    attempted_operation: "apply_patch_to_worktree",
    safe_next_action: "capture_g1a_first_use_audit_then_prepare_g1b_gate_opening_packet",
  },
  {
    attempt_kind: "g2_command_execution",
    required_gate_id: "G2",
    required_stage_id: "Stage6",
    protected_surface: "command_execution",
    attempted_operation: "spawn_allowlist_command",
    safe_next_action: "collect_three_g1b_no_incident_usage_rows_then_prepare_g2_packet",
  },
  {
    attempt_kind: "g3_deployment_staging",
    required_gate_id: "G3",
    required_stage_id: "Stage7",
    protected_surface: "deployment",
    attempted_operation: "deploy_to_staging",
    safe_next_action: "complete_g2_release_candidate_evidence_loop_then_prepare_g3_packet",
  },
  {
    attempt_kind: "stage6_limited_execution_runtime",
    required_gate_id: "G2",
    required_stage_id: "Stage6",
    protected_surface: "limited_execution_runtime",
    attempted_operation: "run_stage6_e2e_intake_runtime",
    safe_next_action: "continue_stage6_contract_code_without_runtime_execution",
  },
  {
    attempt_kind: "stage7_pilot_release_candidate",
    required_gate_id: "G3",
    required_stage_id: "Stage7",
    protected_surface: "pilot_release_candidate",
    attempted_operation: "issue_pilot_release_candidate",
    safe_next_action: "continue_stage7_release_candidate_contract_code_without_deployment",
  },
];

export async function runFactoryGSeriesRuntimeGuards(options = {}) {
  const result = await buildFactoryGSeriesRuntimeGuards(options);
  if (!options.check && options.write !== false) await writeFactoryGSeriesRuntimeGuards(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory G-series Runtime Guards failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_g_series_runtime_guards_status !== READY_STATUS) {
    const error = new Error("Factory G-series Runtime Guards are not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryGSeriesRuntimeGuards(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_G_SERIES_RUNTIME_GUARDS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const advancementReadiness = Object.prototype.hasOwnProperty.call(options, "advancementReadiness")
    ? options.advancementReadiness
    : await buildFactoryGSeriesAdvancementReadiness({ ...options, write: false, commitRef });
  const attemptKind = options.attemptKind ? String(options.attemptKind) : null;

  const sourceState = buildSourceState({ packageJson, advancementReadiness, commitRef });
  const guardRows = buildRuntimeGuardRows({ advancementReadiness, generatedAt, attemptKind });
  const boundary = buildBoundary({ sourceState, guardRows, generatedAt, attemptKind });
  const validationItems = buildValidationItems({ sourceState, guardRows, boundary, attemptKind });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ guardRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    attempt_kind_filter: attemptKind,
    source_refs: {
      current_commit_ref: commitRef || null,
      advancement_readiness_status: advancementReadiness?.summary?.factory_g_series_advancement_readiness_status ?? null,
    },
    source_summaries: {
      advancement_readiness_valid: sourceState.advancementReadinessValid,
      code_development_allowed_now: sourceState.codeDevelopmentAllowedNow,
      runtime_authority_open_now: sourceState.runtimeAuthorityOpenNow,
      human_owner_approval_skipped_for_development_now: true,
      human_owner_approval_counted_as_closeout: false,
    },
    factory_g_series_runtime_guard_rows: guardRows,
    factory_g_series_runtime_guard_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryGSeriesRuntimeGuards(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-g-series-runtime-guards.json"), serializableResult(result));
  await writeJson(path.join(outDir, "runtime-guard-rows.json"), collectionEnvelope("factory-g-series-runtime-guard-rows.v1", "factory_g_series_runtime_guard_rows", result.factory_g_series_runtime_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_g_series_runtime_guard_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-g-series-runtime-guard-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryGSeriesRuntimeGuardsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryGSeriesRuntimeGuards(args);
    console.log(`Factory G-series Runtime Guards ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_g_series_runtime_guards_status}`);
    console.log(`Guard rows: ${result.summary.runtime_guard_count}`);
    console.log(`Blocked: ${result.summary.runtime_guard_blocked_count}/${result.summary.runtime_guard_count}`);
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
  const defaults = DEFAULT_FACTORY_G_SERIES_RUNTIME_GUARDS_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
  };
}

function buildSourceState({ packageJson, advancementReadiness, commitRef }) {
  const scripts = packageJson.data?.scripts ?? {};
  return {
    commitRefPresent: Boolean(commitRef),
    packageScriptRegistered: typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].includes("factory-g-series-runtime-guards.mjs"),
    advancementReadinessValid: advancementReadiness?.validation?.valid === true,
    advancementReadinessStatus: advancementReadiness?.summary?.factory_g_series_advancement_readiness_status ?? null,
    codeDevelopmentAllowedNow: advancementReadiness?.summary?.g_series_code_development_allowed_now === true,
    runtimeAuthorityOpenNow: advancementReadiness?.summary?.g_series_runtime_authority_open_now === true,
  };
}

function buildRuntimeGuardRows({ advancementReadiness, generatedAt, attemptKind }) {
  const gateRows = advancementReadiness?.factory_g_series_gate_advancement_rows ?? [];
  const stageRows = advancementReadiness?.factory_g_series_stage_advancement_rows ?? [];
  return ATTEMPT_DEFINITIONS
    .filter((definition) => attemptKind === null || definition.attempt_kind === attemptKind)
    .map((definition, index) => {
      const gateRow = gateRows.find((row) => row.gate_id === definition.required_gate_id);
      const stageRow = stageRows.find((row) => row.stage_id === definition.required_stage_id);
      const requiredGateOpen = gateRow?.gate_open_now === true;
      const runtimeAllowed = false;
      const missingEvidenceIds = [
        ...(gateRow?.missing_evidence_ids ?? []),
        ...(stageRow?.missing_evidence_ids ?? []),
      ].filter(Boolean);
      const row = {
        schema_version: "factory-g-series-runtime-guard-row.v1",
        guard_id: `g-series-runtime-guard.${definition.attempt_kind}`,
        attempt_kind: definition.attempt_kind,
        attempted_operation: definition.attempted_operation,
        protected_surface: definition.protected_surface,
        required_gate_id: definition.required_gate_id,
        required_stage_id: definition.required_stage_id,
        required_gate_open_now: requiredGateOpen,
        guard_status: runtimeAllowed ? "allowed_unexpectedly" : "blocked_as_expected",
        guard_verdict: runtimeAllowed ? "fail_opened_unexpectedly" : "pass_blocked",
        mutation_allowed_now: false,
        runtime_authority_allowed_now: false,
        command_spawn_allowed_now: false,
        source_file_write_allowed_now: false,
        deployment_allowed_now: false,
        stage_runtime_open_now: false,
        blocked_reason_ids: buildBlockedReasonIds(definition, missingEvidenceIds, requiredGateOpen),
        safe_next_action: definition.safe_next_action,
        simulated_only: true,
        no_process_spawned: true,
        no_files_written_by_guard: true,
        human_owner_approval_skipped_for_development_now: true,
        human_owner_approval_counted_as_closeout: false,
        independent_review_required_before_protected_closeout: true,
        generated_at: generatedAt,
        ordinal: index + 1,
        ...CLOSED_AUTHORITY_FLAGS,
      };
      return { ...row, runtime_guard_row_sha256: sha256(canonicalize(row)) };
    });
}

function buildBlockedReasonIds(definition, missingEvidenceIds, requiredGateOpen) {
  const reasons = [];
  if (!requiredGateOpen) reasons.push(`${definition.required_gate_id.toLowerCase()}_gate_not_open`);
  reasons.push(...missingEvidenceIds);
  reasons.push(`${definition.protected_surface}_runtime_authority_closed`);
  return [...new Set(reasons)];
}

function buildBoundary({ sourceState, guardRows, generatedAt, attemptKind }) {
  return {
    schema_version: "factory-g-series-runtime-guard-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    simulated_only: true,
    attempt_kind_filter: attemptKind,
    source_literal_authority_model: true,
    data_driven_gate_opening_allowed_now: false,
    g_series_code_development_allowed_now: sourceState.codeDevelopmentAllowedNow,
    g_series_runtime_authority_open_now: false,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    independent_review_required_before_protected_closeout: true,
    factory_promotion_goal_complete_allowed_now: false,
    runtime_guard_count: guardRows.length,
    runtime_guard_blocked_count: guardRows.filter((row) => row.guard_status === "blocked_as_expected").length,
    mutation_allowed_now: false,
    command_spawn_allowed_now: false,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function buildValidationItems({ sourceState, guardRows, boundary, attemptKind }) {
  const expectedCount = attemptKind === null ? ATTEMPT_DEFINITIONS.length : 1;
  return [
    validationItem("package.script_registered", "package", sourceState.packageScriptRegistered, "package.json does not register factory:g-series-runtime-guards"),
    validationItem("source.commit_ref_present", "source", sourceState.commitRefPresent, "Current commit ref is missing"),
    validationItem("source.advancement_readiness_valid", "source", sourceState.advancementReadinessValid, "Factory G-series advancement readiness source is invalid"),
    validationItem("source.code_development_allowed", "source", sourceState.codeDevelopmentAllowedNow, "G-series code development readiness is not open"),
    validationItem("guards.rows_present", "guards", guardRows.length === expectedCount, "Runtime guard rows are incomplete or attempt-kind filter is unknown"),
    validationItem("guards.blocked", "guards", guardRows.length === expectedCount && guardRows.every((row) => row.guard_status === "blocked_as_expected" && row.guard_verdict === "pass_blocked"), "Runtime guards did not all block"),
    validationItem("guards.no_process_or_write", "guards", guardRows.every((row) => row.no_process_spawned === true && row.no_files_written_by_guard === true), "A runtime guard performed process or file side effects"),
    validationItem("boundary.authority_closed", "authority", boundaryFlagsClosed(boundary), "Protected authority boundary opened"),
    validationItem("boundary.human_skip_not_closeout", "authority", boundary.human_owner_approval_skipped_for_development_now === true && boundary.human_owner_approval_counted_as_closeout === false, "Skipped human approval was counted as protected closeout"),
  ];
}

function buildSummary({ guardRows, boundary, validation }) {
  const ready = validation.valid
    && guardRows.every((row) => row.guard_status === "blocked_as_expected")
    && boundaryFlagsClosed(boundary);
  return {
    factory_g_series_runtime_guards_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    runtime_guard_count: guardRows.length,
    runtime_guard_blocked_count: guardRows.filter((row) => row.guard_status === "blocked_as_expected").length,
    g_series_code_development_allowed_now: boundary.g_series_code_development_allowed_now,
    g_series_runtime_authority_open_now: false,
    human_owner_approval_skipped_for_development_now: true,
    human_owner_approval_counted_as_closeout: false,
    independent_review_required_before_protected_closeout: true,
    data_driven_gate_opening_allowed_now: false,
    source_literal_authority_model: true,
    factory_promotion_goal_complete_allowed_now: false,
    mutation_allowed_now: false,
    command_spawn_allowed_now: false,
    stage6_limited_execution_allowed_now: false,
    stage7_release_candidate_allowed_now: false,
    validation_errors: validation.errors.length,
    ...CLOSED_AUTHORITY_FLAGS,
  };
}

function validationItem(itemId, category, passed, message) {
  return {
    schema_version: "factory-g-series-runtime-guard-validation-item.v1",
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
    "mutation_allowed_now",
    "command_spawn_allowed_now",
    "stage6_limited_execution_allowed_now",
    "stage7_release_candidate_allowed_now",
  ].every((flag) => boundary[flag] === false);
}

function renderMarkdown(result) {
  return [
    "# Factory G-series Runtime Guards",
    "",
    `Status: ${result.summary.factory_g_series_runtime_guards_status}`,
    `Program: ${result.program_range}`,
    `Guard rows: ${result.summary.runtime_guard_count}`,
    `Blocked: ${result.summary.runtime_guard_blocked_count}/${result.summary.runtime_guard_count}`,
    `Code development allowed: ${result.summary.g_series_code_development_allowed_now}`,
    `Runtime authority open: ${result.summary.g_series_runtime_authority_open_now}`,
    `Human approval skipped for development: ${result.summary.human_owner_approval_skipped_for_development_now}`,
    `Human approval counted as closeout: ${result.summary.human_owner_approval_counted_as_closeout}`,
    `Mutation allowed: ${result.summary.mutation_allowed_now}`,
    `Command spawn allowed: ${result.summary.command_spawn_allowed_now}`,
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
    else if (arg === "--attempt-kind") args.attemptKind = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-g-series-runtime-guards.mjs [--check] [--require-pass] [--attempt-kind <kind>] [--out-dir <dir>] [--run-at <iso>] [--commit-ref <sha>]\n\nBuilds deterministic guards for G1b/G2/G3 and Stage6/Stage7 protected runtime attempts without executing them.`);
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
