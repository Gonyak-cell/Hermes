import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildAgentBridgeLimitedRuntimePlan } from "./agent-bridge-limited-runtime-plan.mjs";
import { buildDesktopReadModel } from "./desktop-read-model.mjs";
import { buildExecutionSchemaRegistry } from "./execution-schema-registry.mjs";
import { buildFactoryGSeriesRuntimeGuards } from "./factory-g-series-runtime-guards.mjs";
import { buildFactoryStageReadModel } from "./factory-stage-read-model.mjs";
import { buildPersonalDevDryRunSandboxLane } from "./personal-dev-dry-run-sandbox-lane.mjs";
import { buildPersonalDevExecutionCandidateLane } from "./personal-dev-execution-candidate-lane.mjs";

export const DEFAULT_EXECUTION_READINESS_MODEL_OUT_DIR = "artifacts/execution-readiness-model/latest";
export const DEFAULT_EXECUTION_READINESS_MODEL_INPUTS = {
  schemaPath: "schemas/execution-readiness-model.schema.json",
};

const SCHEMA_VERSION = "execution-readiness-model.v1";
const READY_STATUS = "ready_for_execution_readiness_api";
const BLOCKED_STATUS = "blocked_execution_readiness_api";
const UNKNOWN_HASH = "0".repeat(64);

const SOURCE_SPECS = [
  {
    source_id: "execution_schema_registry",
    label: "Execution schema registry",
    ready_status_path: "summary.execution_schema_registry_status",
    ready_status: "ready_for_execution_schema_registry",
    required: true,
  },
  {
    source_id: "desktop_read_model",
    label: "Desktop read model",
    ready_status_path: "summary.desktop_read_model_status",
    ready_status: "ready_for_desktop_shell",
    required: true,
  },
  {
    source_id: "agent_bridge_limited_runtime_plan",
    label: "Agent Bridge limited runtime plan",
    ready_status_path: "summary.agent_bridge_limited_runtime_plan_status",
    ready_status: "ready_for_agent_bridge_limited_runtime_plan",
    required: true,
  },
  {
    source_id: "factory_stage_read_model",
    label: "Factory stage read model",
    ready_status_path: "summary.factory_stage_read_model_status",
    ready_status: "ready_factory_stage_read_model",
    required: true,
  },
  {
    source_id: "factory_g_series_runtime_guards",
    label: "Factory G-series runtime guards",
    ready_status_path: "summary.factory_g_series_runtime_guards_status",
    ready_status: "ready_runtime_guards_block_protected_actions",
    required: true,
  },
  {
    source_id: "personal_dev_execution_candidate_lane",
    label: "Personal-dev execution candidate lane",
    ready_status_path: "summary.personal_dev_execution_candidate_lane_status",
    ready_status: "ready_for_personal_dev_execution_candidate_lane",
    required: true,
  },
  {
    source_id: "personal_dev_dry_run_sandbox_lane",
    label: "Personal-dev dry-run sandbox lane",
    ready_status_path: "summary.personal_dev_dry_run_sandbox_lane_status",
    ready_status: "ready_for_personal_dev_dry_run_sandbox_lane",
    required: true,
  },
];

const READINESS_LEVEL_SPECS = [
  {
    level: "L0",
    title: "Read-only observability",
    source_ids: ["execution_schema_registry", "desktop_read_model", "agent_bridge_limited_runtime_plan", "factory_stage_read_model", "factory_g_series_runtime_guards"],
    opens_authority: false,
    blocker_when_sources_ready: null,
    next_allowed_action: "serve_read_only_execution_readiness_projection",
  },
  {
    level: "L1",
    title: "Candidate generation",
    source_ids: ["execution_schema_registry", "personal_dev_execution_candidate_lane"],
    opens_authority: false,
    blocker_when_sources_ready: null,
    next_allowed_action: "serve_personal_dev_execution_candidate_projection",
  },
  {
    level: "L2",
    title: "Isolated dry-run execution",
    source_ids: ["execution_schema_registry", "agent_bridge_limited_runtime_plan", "personal_dev_execution_candidate_lane", "personal_dev_dry_run_sandbox_lane"],
    opens_authority: false,
    blocker_when_sources_ready: null,
    next_allowed_action: "serve_personal_dev_dry_run_sandbox_projection",
  },
  {
    level: "L3",
    title: "Scoped worktree mutation",
    source_ids: ["execution_schema_registry", "factory_g_series_runtime_guards"],
    opens_authority: false,
    blocker_when_sources_ready: "worktree_mutation_authority_closed",
    next_allowed_action: "keep_mutation_closed_until_l2_receipts_and_review_exist",
  },
  {
    level: "L4",
    title: "Test-verified patch package",
    source_ids: ["execution_schema_registry"],
    opens_authority: false,
    blocker_when_sources_ready: "test_verified_patch_package_not_implemented",
    next_allowed_action: "define_diff_test_rollback_artifact_bindings",
  },
  {
    level: "L5",
    title: "PR and staging handoff",
    source_ids: ["execution_schema_registry"],
    opens_authority: false,
    blocker_when_sources_ready: "pr_staging_handoff_not_implemented",
    next_allowed_action: "do_not_open_git_push_or_staging_deploy",
  },
  {
    level: "L6",
    title: "Controlled deployment",
    source_ids: ["execution_schema_registry"],
    opens_authority: false,
    blocker_when_sources_ready: "deployment_authority_closed",
    next_allowed_action: "require_separate_l6_design_and_human_authorization",
  },
  {
    level: "L7",
    title: "Regulated enterprise execution",
    source_ids: ["execution_schema_registry"],
    opens_authority: false,
    blocker_when_sources_ready: "enterprise_trust_authority_closed",
    next_allowed_action: "require_independent_review_enterprise_receipts_and_domain_authority",
  },
];

export async function runExecutionReadinessModel(options = {}) {
  const result = await buildExecutionReadinessModel(options);
  if (options.write !== false) await writeExecutionReadinessModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Execution readiness model validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExecutionReadinessModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXECUTION_READINESS_MODEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const sourceRows = await buildSourceRows(options, generatedAt);
  const readinessRows = buildReadinessRows(sourceRows, generatedAt);
  const routeRows = buildRouteRows(readinessRows, generatedAt);
  const boundary = buildBoundary(sourceRows, readinessRows, routeRows, generatedAt);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    output_dir: outputDir,
    inputs,
    execution_readiness_source_rows: sourceRows,
    execution_readiness_rows: readinessRows,
    execution_readiness_route_rows: routeRows,
    execution_readiness_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  const validation = validateExecutionReadinessModelResult(result, schema.available ? schema.data : null);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateExecutionReadinessModelResult(result, schema = null) {
  const items = [
    validationItem("sources.present", result.execution_readiness_source_rows.length === SOURCE_SPECS.length, "All execution readiness source rows must be present.", "execution_readiness_source_rows"),
    validationItem("missing_sources.blocked", result.execution_readiness_source_rows.every((row) => row.source_available || row.blocker_reason), "Missing sources must create blocker rows.", "execution_readiness_source_rows"),
    validationItem("readiness.rows", result.execution_readiness_rows.length === READINESS_LEVEL_SPECS.length, "All execution maturity levels must be projected.", "execution_readiness_rows"),
    validationItem("l0.ready_or_blocked", result.execution_readiness_rows.some((row) => row.level === "L0" && ["ready", "blocked"].includes(row.readiness_status)), "L0 must be visibly ready or blocked.", "execution_readiness_rows.L0"),
    validationItem("routes.read_only", result.execution_readiness_route_rows.every((row) => row.method_policy === "GET_HEAD_ONLY" && row.route_invokes_runtime === false && row.route_writes_ledger === false), "Execution routes must be read-only and non-mutating.", "execution_readiness_route_rows"),
    validationItem("boundary.closed", boundaryClosed(result.execution_readiness_boundary), "Execution readiness API must not open execution, write, connector, deployment, production, protected, desktop shell, secret, or final-pass authority.", "execution_readiness_boundary"),
  ];
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "execution_readiness_model")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  const validationItems = [...items, ...schemaItems];
  return { validation_items: validationItems, validation: summarizeValidation(validationItems) };
}

export async function writeExecutionReadinessModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "execution-readiness-model.json"), serializable);
  await writeJson(path.join(outDir, "source-rows.json"), collectionEnvelope("execution-readiness-source-rows.v1", "execution_readiness_source_rows", result.execution_readiness_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "readiness-rows.json"), collectionEnvelope("execution-readiness-rows.v1", "execution_readiness_rows", result.execution_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-rows.json"), collectionEnvelope("execution-readiness-route-rows.v1", "execution_readiness_route_rows", result.execution_readiness_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-readiness-boundary.json"), result.execution_readiness_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "execution-readiness-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExecutionReadinessModelCli(argv = process.argv.slice(2)) {
  try {
    const args = parseExecutionReadinessModelArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runExecutionReadinessModel(args);
    console.log(`Execution readiness model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.execution_readiness_status}`);
    console.log(`Sources ready: ${result.summary.ready_source_count}/${result.summary.source_count}`);
    console.log(`Levels ready: ${result.summary.ready_level_count}/${result.summary.readiness_row_count}`);
    console.log(`Blocked levels: ${result.summary.blocked_level_count}`);
    console.log(`GET/HEAD only: ${result.summary.get_head_only}`);
    console.log(`Execution allowed now: ${result.summary.execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

export function parseExecutionReadinessModelArgs(argv = process.argv.slice(2)) {
  const parsed = { outDir: DEFAULT_EXECUTION_READINESS_MODEL_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--require-pass") {
      parsed.requirePass = true;
    } else if (arg === "--out-dir") {
      parsed.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      parsed.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--run-at") {
      parsed.runAt = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function buildSourceRows(options, generatedAt) {
  const sourceResults = await resolveSources(options);
  return SOURCE_SPECS.map((spec) => {
    const source = sourceResults[spec.source_id] ?? { available: false, error: "source_not_resolved" };
    const observedStatus = source.available ? valueAtPath(source.data, spec.ready_status_path) ?? "missing" : "missing";
    const ready = source.available === true && source.validation_valid !== false && observedStatus === spec.ready_status;
    const blockerReason = ready ? null : source.error ?? `expected_${spec.ready_status}_observed_${observedStatus}`;
    return {
      schema_version: "execution-readiness-source-row.v1",
      generated_at: generatedAt,
      source_id: spec.source_id,
      label: spec.label,
      required: spec.required,
      source_available: source.available === true,
      source_ready: ready,
      source_status: ready ? "ready" : "blocked",
      observed_status: observedStatus,
      expected_status: spec.ready_status,
      validation_valid: source.validation_valid === true,
      source_hash: source.available ? hashValue(source.data) : UNKNOWN_HASH,
      blocker_reason: blockerReason,
    };
  });
}

async function resolveSources(options) {
  if (options.sourceOverrides) return options.sourceOverrides;
  return {
    execution_schema_registry: await captureSource(() => buildExecutionSchemaRegistry({ ...options, write: false })),
    desktop_read_model: await captureSource(() => buildDesktopReadModel({ ...options, write: false })),
    agent_bridge_limited_runtime_plan: await captureSource(() => buildAgentBridgeLimitedRuntimePlan({ ...options, write: false })),
    factory_stage_read_model: await captureSource(() => buildFactoryStageReadModel({ ...options, write: false })),
    factory_g_series_runtime_guards: await captureSource(() => buildFactoryGSeriesRuntimeGuards({ ...options, write: false })),
    personal_dev_execution_candidate_lane: await captureSource(() => buildPersonalDevExecutionCandidateLane({ ...options, write: false })),
    personal_dev_dry_run_sandbox_lane: await captureSource(() => buildPersonalDevDryRunSandboxLane({ ...options, write: false })),
  };
}

async function captureSource(builder) {
  try {
    const data = await builder();
    return {
      available: true,
      validation_valid: data.validation?.valid !== false,
      data: stripMarkdown(data),
    };
  } catch (error) {
    return {
      available: false,
      validation_valid: false,
      error: error.message,
      data: null,
    };
  }
}

function buildReadinessRows(sourceRows, generatedAt) {
  const sourceById = new Map(sourceRows.map((row) => [row.source_id, row]));
  return READINESS_LEVEL_SPECS.map((spec) => {
    const requiredSources = spec.source_ids.map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
    const missingOrBlockedSources = requiredSources.filter((row) => !row.source_ready);
    const sourceReady = missingOrBlockedSources.length === 0;
    const blockerReason = sourceReady ? spec.blocker_when_sources_ready : "required_source_not_ready";
    const ready = sourceReady && !spec.blocker_when_sources_ready && spec.opens_authority === false;
    return {
      schema_version: "execution-readiness-row.v1",
      generated_at: generatedAt,
      level: spec.level,
      title: spec.title,
      product_id: "product.hermes_harness",
      project_id: "project.personal_dev_fixture",
      domain_pack_id: "personal-dev",
      readiness_status: ready ? "ready" : "blocked",
      source_ready: sourceReady,
      required_source_ids: spec.source_ids,
      missing_or_blocked_source_ids: missingOrBlockedSources.map((row) => row.source_id),
      blocker_reason: ready ? null : blockerReason,
      next_allowed_action: ready ? spec.next_allowed_action : (sourceReady ? spec.next_allowed_action : "fix_required_source_bindings"),
      execution_allowed_now: false,
      command_execution_allowed_now: false,
      file_write_allowed_now: false,
      deployment_allowed_now: false,
      production_allowed_now: false,
      protected_output_allowed_now: false,
      desktop_shell_execution_allowed_now: false,
      route_invokes_runtime: false,
      route_writes_ledger: false,
    };
  });
}

function buildRouteRows(readinessRows, generatedAt) {
  return [
    {
      schema_version: "execution-readiness-route-row.v1",
      generated_at: generatedAt,
      route_id: "route.execution.readiness",
      path: "/api/execution/readiness",
      method_policy: "GET_HEAD_ONLY",
      collection: "execution_readiness_rows",
      ready: readinessRows.some((row) => row.level === "L0" && row.readiness_status === "ready"),
      missing_source_creates_blocker: true,
      route_invokes_runtime: false,
      route_writes_ledger: false,
      raw_secret_fields_serialized: false,
      raw_client_material_serialized: false,
      raw_command_output_serialized: false,
      source_binding_hash: hashValue(readinessRows.map((row) => [row.level, row.readiness_status, row.required_source_ids, row.missing_or_blocked_source_ids])),
    },
    {
      schema_version: "execution-readiness-route-row.v1",
      generated_at: generatedAt,
      route_id: "route.execution.personal_dev_candidates",
      path: "/api/execution/personal-dev-candidates",
      method_policy: "GET_HEAD_ONLY",
      collection: "personal_dev_execution_candidate_rows",
      ready: readinessRows.some((row) => row.level === "L1" && row.readiness_status === "ready"),
      missing_source_creates_blocker: true,
      route_invokes_runtime: false,
      route_writes_ledger: false,
      raw_secret_fields_serialized: false,
      raw_client_material_serialized: false,
      raw_command_output_serialized: false,
      source_binding_hash: hashValue(readinessRows.map((row) => [row.level, row.readiness_status, row.required_source_ids, row.missing_or_blocked_source_ids])),
    },
    {
      schema_version: "execution-readiness-route-row.v1",
      generated_at: generatedAt,
      route_id: "route.execution.personal_dev_dry_runs",
      path: "/api/execution/personal-dev-dry-runs",
      method_policy: "GET_HEAD_ONLY",
      collection: "personal_dev_dry_run_sandbox_rows",
      ready: readinessRows.some((row) => row.level === "L2" && row.readiness_status === "ready"),
      missing_source_creates_blocker: true,
      route_invokes_runtime: false,
      route_writes_ledger: false,
      raw_secret_fields_serialized: false,
      raw_client_material_serialized: false,
      raw_command_output_serialized: false,
      source_binding_hash: hashValue(readinessRows.map((row) => [row.level, row.readiness_status, row.required_source_ids, row.missing_or_blocked_source_ids])),
    },
  ];
}

function buildBoundary(sourceRows, readinessRows, routeRows, generatedAt) {
  const sourceBlockerCount = sourceRows.filter((row) => !row.source_ready).length;
  return {
    schema_version: "execution-readiness-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    get_head_only: true,
    missing_source_blocker_count: sourceBlockerCount,
    route_count: routeRows.length,
    route_handler_invokes_runtime: false,
    route_handler_writes_ledger: false,
    execution_allowed_now: false,
    command_execution_allowed_now: false,
    file_write_allowed_now: false,
    network_allowed_now: false,
    package_install_allowed_now: false,
    raw_secret_access_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    production_allowed_now: false,
    protected_output_allowed_now: false,
    desktop_shell_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    owner_approval_counts_as_independent_review: false,
    l0_ready: readinessRows.some((row) => row.level === "L0" && row.readiness_status === "ready"),
  };
}

function buildSummary(result) {
  const sourceCount = result.execution_readiness_source_rows.length;
  const readySourceCount = result.execution_readiness_source_rows.filter((row) => row.source_ready).length;
  const readinessRowCount = result.execution_readiness_rows.length;
  const readyLevelCount = result.execution_readiness_rows.filter((row) => row.readiness_status === "ready").length;
  const blockedLevelCount = result.execution_readiness_rows.filter((row) => row.readiness_status === "blocked").length;
  return {
    execution_readiness_status: result.validation.valid ? READY_STATUS : BLOCKED_STATUS,
    source_count: sourceCount,
    ready_source_count: readySourceCount,
    source_blocker_count: sourceCount - readySourceCount,
    readiness_row_count: readinessRowCount,
    ready_level_count: readyLevelCount,
    blocked_level_count: blockedLevelCount,
    route_count: result.execution_readiness_route_rows.length,
    get_head_only: result.execution_readiness_boundary.get_head_only,
    route_handler_invokes_runtime: result.execution_readiness_boundary.route_handler_invokes_runtime,
    route_handler_writes_ledger: result.execution_readiness_boundary.route_handler_writes_ledger,
    execution_allowed_now: result.execution_readiness_boundary.execution_allowed_now,
    command_execution_allowed_now: result.execution_readiness_boundary.command_execution_allowed_now,
    validation_error_count: result.validation.errors.length,
  };
}

function renderMarkdown(result) {
  const rows = result.execution_readiness_rows
    .map((row) => `| ${row.level} | ${row.title} | ${row.readiness_status} | ${row.blocker_reason ?? ""} | ${row.next_allowed_action} |`)
    .join("\n");
  return [
    "# Execution Readiness Model",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.summary.execution_readiness_status}`,
    "",
    "| Level | Title | Status | Blocker | Next Action |",
    "|---|---|---|---|---|",
    rows,
    "",
    "## Boundary",
    "",
    `GET/HEAD only: ${result.execution_readiness_boundary.get_head_only}`,
    `Execution allowed now: ${result.execution_readiness_boundary.execution_allowed_now}`,
    `Route invokes runtime: ${result.execution_readiness_boundary.route_handler_invokes_runtime}`,
    `Route writes ledger: ${result.execution_readiness_boundary.route_handler_writes_ledger}`,
    "",
  ].join("\n");
}

function boundaryClosed(boundary) {
  return boundary.read_only === true &&
    boundary.get_head_only === true &&
    boundary.route_handler_invokes_runtime === false &&
    boundary.route_handler_writes_ledger === false &&
    boundary.execution_allowed_now === false &&
    boundary.command_execution_allowed_now === false &&
    boundary.file_write_allowed_now === false &&
    boundary.connector_write_allowed_now === false &&
    boundary.deployment_allowed_now === false &&
    boundary.production_allowed_now === false &&
    boundary.protected_output_allowed_now === false &&
    boundary.desktop_shell_execution_allowed_now === false &&
    boundary.raw_secret_access_allowed_now === false &&
    boundary.agent_final_pass_allowed_now === false;
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_EXECUTION_READINESS_MODEL_INPUTS.schemaPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, error: error.message, data: null };
  }
}

function stripMarkdown(value) {
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  delete copy.markdown;
  return copy;
}

function valueAtPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.pass)
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function validationItem(id, pass, message, path = id) {
  return { id, path, pass: Boolean(pass), status: pass ? "pass" : "fail", message };
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: rows.length, rows };
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run execution:readiness -- [--check] [--out-dir <dir>] [--schema-path <file>] [--run-at <iso>]

Builds the read-only execution readiness projection for /api/execution/readiness.
This script never invokes runtimes or writes ledgers in --check mode.`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
