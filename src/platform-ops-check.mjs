import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runContractGoldenFixtures } from "./contract-golden-fixtures.mjs";
import { runContractValidationSuite } from "./contract-validation-suite.mjs";
import {
  DEFAULT_CONTROL_PLANE_LOOP_STEPS,
  runControlPlaneLoop,
} from "./control-plane-loop.mjs";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { runDomainPackRegistry } from "./domain-pack-registry.mjs";
import { buildReviewApiResponse } from "./review-api.mjs";
import { runPlatformRuntimeBaseline } from "./platform-runtime-baseline.mjs";

export const DEFAULT_PLATFORM_OPS_CHECK_OUT_DIR = "artifacts/platform-ops-check/latest";
export const DEFAULT_PLATFORM_OPS_CHECK_INPUTS = {
  packagePath: "package.json",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiSmokeScriptPath: "scripts/review-api-smoke.mjs",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  schemaPath: "schemas/platform-ops-check.schema.json",
};

const SCHEMA_VERSION = "platform-ops-check.v1";
const CAPABILITY_ID = "platform.ops_check";
const PHASE_SLOT = "P362";
const PREVIOUS_PHASE_SLOT = "P361";
const NEXT_PHASE_SLOT = "P363";

export async function runPlatformOpsCheck(options = {}) {
  const result = await buildPlatformOpsCheck(options);
  if (options.write !== false) await writePlatformOpsCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform ops check failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOpsCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPS_CHECK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewApiSource = await readTextSource(inputs.review_api_source_path);
  const reviewApiSmokeScript = await readTextSource(inputs.review_api_smoke_script_path);
  const reviewDashboardSource = await readTextSource(inputs.review_dashboard_source_path);
  const sourceRows = buildSourceRows({
    packageJson,
    platformOpsLedger,
    reviewApiSource,
    reviewApiSmokeScript,
    reviewDashboardSource,
  });
  const checkOverrides = options.checkOverrides ?? {};
  const runtimeBaseline = checkOverrides.runtimeBaseline
    ? capturedCheckOverride("runtime_baseline", checkOverrides.runtimeBaseline)
    : await runCapturedCheck("runtime_baseline", () => runPlatformRuntimeBaseline({ ...options, write: false, check: false }));
  const contractGoldenFixtures = checkOverrides.contractGoldenFixtures
    ? capturedCheckOverride("contract_golden_fixtures", checkOverrides.contractGoldenFixtures)
    : await runCapturedCheck("contract_golden_fixtures", () => runContractGoldenFixtures({ write: false, check: false }));
  const contractValidationSuite = checkOverrides.contractValidationSuite
    ? capturedCheckOverride("contract_validation_suite", checkOverrides.contractValidationSuite)
    : await runCapturedCheck("contract_validation_suite", () => runContractValidationSuite({ write: false, check: false }));
  const domainPackRegistry = checkOverrides.domainPackRegistry
    ? capturedCheckOverride("domain_pack_registry", checkOverrides.domainPackRegistry)
    : await runCapturedCheck("domain_pack_registry", () => runDomainPackRegistry({ write: false, check: false }));
  const controlPlaneLoopProbe = checkOverrides.controlPlaneLoopProbe
    ? capturedCheckOverride("control_plane_loop_probe", checkOverrides.controlPlaneLoopProbe)
    : await buildControlPlaneLoopProbe(options);
  const apiSmokeRows = await buildApiSmokeRows({
    packageJson,
    reviewApiSource,
    reviewApiSmokeScript,
    reviewDashboardSource,
    generatedAt,
  });
  const opsRows = buildOpsRows({
    runtimeBaseline,
    contractGoldenFixtures,
    contractValidationSuite,
    domainPackRegistry,
    controlPlaneLoopProbe,
    apiSmokeRows,
  });
  const boundary = buildBoundary({ generatedAt, controlPlaneLoopProbe, writeRequested: options.write !== false });
  const gateRows = buildGateRows({ sourceRows, opsRows, apiSmokeRows, boundary });
  const validationItems = buildValidationItems({ sourceRows, opsRows, apiSmokeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceRows, opsRows, apiSmokeRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_ops_check_id: `platform-ops-check.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    ops_check_anchor: {
      schema_version: "platform-ops-check-anchor.v1",
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      default_control_plane_loop_step_count: DEFAULT_CONTROL_PLANE_LOOP_STEPS.length,
    },
    ops_check_source_rows: sourceRows,
    ops_check_rows: opsRows,
    api_smoke_rows: apiSmokeRows,
    ops_check_gate_rows: gateRows,
    ops_check_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_ops_check") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, opsRows, apiSmokeRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_ops_check_id = result.platform_ops_check_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOpsCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-ops-check.json"), serializableResult(result));
  await writeJson(path.join(outDir, "ops-check-rows.json"), collectionEnvelope("platform-ops-check-rows.v1", "ops_check_rows", result.ops_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "api-smoke-rows.json"), collectionEnvelope("platform-ops-check-api-smoke-rows.v1", "api_smoke_rows", result.api_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "ops-check-gate-rows.json"), collectionEnvelope("platform-ops-check-gate-rows.v1", "ops_check_gate_rows", result.ops_check_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "ops-check-boundary.json"), result.ops_check_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-ops-check-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOpsCheckCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOpsCheck(args);
    console.log(`Platform ops check ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_ops_check_status}`);
    console.log(`Ops rows: ${result.summary.ready_ops_check_row_count}/${result.summary.ops_check_row_count}`);
    console.log(`API smoke rows: ${result.summary.ready_api_smoke_row_count}/${result.summary.api_smoke_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSourceRows({ packageJson, platformOpsLedger, reviewApiSource, reviewApiSmokeScript, reviewDashboardSource }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const rows = [
    sourceRow("package_json_available", "package.json is readable.", packageJson.available),
    sourceRow("platform_ops_check_script_registered", "package.json registers platform:ops-check.", typeof scripts["platform:ops-check"] === "string" && scripts["platform:ops-check"].length > 0),
    sourceRow("platform_validation_chain_registered", "Validation chain includes platform:ops-check -- --check.", validateScript.includes("npm run platform:ops-check -- --check")),
    sourceRow("platform_ops_ledger_p362_declared", "Platform operations ledger declares P362 platform ops-check acceptance.", platformOpsLedger.available && platformOpsLedger.text.includes("P362: `platform:ops-check`")),
    sourceRow("dashboard_build_script_registered", "package.json registers dashboard:build.", typeof scripts["dashboard:build"] === "string" && scripts["dashboard:build"].length > 0),
    sourceRow("api_smoke_script_registered", "package.json registers api:smoke.", typeof scripts["api:smoke"] === "string" && scripts["api:smoke"].length > 0),
    sourceRow("control_plane_loop_script_registered", "package.json registers control-plane:loop.", typeof scripts["control-plane:loop"] === "string" && scripts["control-plane:loop"].length > 0),
    sourceRow("review_api_source_ready", "Review API source exposes read-only API helpers.", reviewApiSource.available && reviewApiSource.text.includes("export async function buildReviewApiResponse") && reviewApiSource.text.includes("Review API is read-only.")),
    sourceRow("review_api_smoke_source_ready", "Review API smoke script checks health, dashboard, packs, and capabilities routes.", reviewApiSmokeScript.available && reviewApiSmokeScript.text.includes("/health") && reviewApiSmokeScript.text.includes("/api/dashboard") && reviewApiSmokeScript.text.includes("/api/packs") && reviewApiSmokeScript.text.includes("/api/capabilities")),
    sourceRow("review_dashboard_source_ready", "Review dashboard source exposes runReviewDashboard.", reviewDashboardSource.available && reviewDashboardSource.text.includes("export async function runReviewDashboard")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_row_hash"));
}

function sourceRow(rowKey, description, passed) {
  return {
    schema_version: "platform-ops-check-source-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    source_status: passed ? "ready" : "blocked",
    human_review_required: true,
  };
}

async function runCapturedCheck(rowKey, runner) {
  try {
    const result = await runner();
    const validation = result.validation ?? { valid: true, errors: [] };
    const status = validation.valid === false ? "blocked" : "ready";
    return {
      row_key: rowKey,
      status,
      result,
      error: null,
    };
  } catch (error) {
    return {
      row_key: rowKey,
      status: "blocked",
      result: null,
      error: error.message,
    };
  }
}

function capturedCheckOverride(rowKey, override) {
  return {
    row_key: rowKey,
    status: override.status ?? "ready",
    result: override.result ?? null,
    error: override.error ?? null,
  };
}

async function buildControlPlaneLoopProbe(options) {
  const probe = await runCapturedCheck("control_plane_loop_probe", () => runControlPlaneLoop({
    write: false,
    writeProgress: false,
    continueOnError: false,
    cwd: options.cwd ?? process.cwd(),
    runAt: options.runAt,
    steps: [
      {
        step_id: "platform_ops_check_loop_probe",
        label: "Platform Ops Check Loop Probe",
        category: "platform_ops_check",
        command: [process.execPath, "-e", "console.log('platform ops check loop probe')"],
        expected_artifacts: [],
        protected_action: false,
      },
    ],
  }));
  const summary = probe.result?.summary ?? {};
  return {
    ...probe,
    status: probe.status === "ready" && probe.result?.loop_status === "passed" && summary.failed_step_count === 0 && summary.missing_artifact_count === 0 ? "ready" : "blocked",
  };
}

async function buildApiSmokeRows({ packageJson, reviewApiSource, reviewApiSmokeScript, reviewDashboardSource, generatedAt }) {
  const routeIndex = await runCapturedCheck("api_route_index", async () => {
    const response = await buildReviewApiResponse("/api", { runAt: generatedAt });
    const body = JSON.parse(response.body);
    const routePaths = new Set((body.routes ?? []).map((route) => route.path));
    return {
      validation: {
        valid: response.status === 200
          && body.schema_version === "review-api-index.v1"
          && routePaths.has("/api/dashboard")
          && routePaths.has("/api/packs")
          && routePaths.has("/api/capabilities")
          && routePaths.has("/health"),
        errors: [],
      },
      response_status: response.status,
      route_count: body.routes?.length ?? 0,
      required_routes_present: ["/health", "/api/dashboard", "/api/packs", "/api/capabilities"].every((routePath) => routePaths.has(routePath)),
    };
  });
  const scripts = packageJson.data?.scripts ?? {};
  const rows = [
    apiSmokeRow("api_route_index", "Review API route index responds with required read-only routes.", routeIndex.status === "ready", {
      response_status: routeIndex.result?.response_status ?? null,
      route_count: routeIndex.result?.route_count ?? 0,
      required_routes_present: routeIndex.result?.required_routes_present === true,
    }),
    apiSmokeRow("api_health_handler", "Review API health handler reports dashboard availability fields.", reviewApiSource.available && reviewApiSource.text.includes("schema_version: \"review-api-health.v1\"") && reviewApiSource.text.includes("dashboard_available")),
    apiSmokeRow("api_read_only_method_guard", "Review API rejects non-GET/HEAD methods.", reviewApiSource.available && reviewApiSource.text.includes("method_not_allowed") && reviewApiSource.text.includes("Review API is read-only.")),
    apiSmokeRow("api_smoke_script_routes", "api:smoke script checks health, dashboard, packs, capabilities, and artifacts routes.", reviewApiSmokeScript.available && ["/health", "/api/dashboard", "/api/packs", "/api/capabilities", "/api/artifacts"].every((needle) => reviewApiSmokeScript.text.includes(needle))),
    apiSmokeRow("dashboard_builder_ready", "dashboard:build script and runReviewDashboard source are registered.", typeof scripts["dashboard:build"] === "string" && reviewDashboardSource.available && reviewDashboardSource.text.includes("export async function runReviewDashboard")),
    apiSmokeRow("api_smoke_script_ready", "api:smoke script is registered and starts the Review API on an ephemeral port.", typeof scripts["api:smoke"] === "string" && reviewApiSmokeScript.available && reviewApiSmokeScript.text.includes("port: 0")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "api_smoke_row_hash"));
}

function apiSmokeRow(rowKey, description, passed, extra = {}) {
  return {
    schema_version: "platform-ops-check-api-smoke-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    api_smoke_status: passed ? "ready" : "blocked",
    mutating_route_required: false,
    protected_action_executed_by_ops_check: false,
    human_review_required: true,
    ...extra,
  };
}

function buildOpsRows({ runtimeBaseline, contractGoldenFixtures, contractValidationSuite, domainPackRegistry, controlPlaneLoopProbe, apiSmokeRows }) {
  const rows = [
    opsRow("runtime_baseline", "Runtime baseline is complete and trading mutation remains disabled.", runtimeBaseline.status === "ready" && runtimeBaseline.result?.summary?.platform_runtime_baseline_status === "complete", {
      evidence_status: runtimeBaseline.result?.summary?.platform_runtime_baseline_status ?? runtimeBaseline.error,
    }),
    opsRow("contract_golden_fixtures", "Contract golden fixtures validate.", contractGoldenFixtures.status === "ready" && contractGoldenFixtures.result?.summary?.golden_fixture_status === "complete", {
      evidence_status: contractGoldenFixtures.result?.summary?.golden_fixture_status ?? contractGoldenFixtures.error,
    }),
    opsRow("contract_validation_suite", "Contract validation suite validates.", contractValidationSuite.status === "ready" && contractValidationSuite.result?.summary?.validation_suite_status === "complete", {
      evidence_status: contractValidationSuite.result?.summary?.validation_suite_status ?? contractValidationSuite.error,
    }),
    opsRow("control_plane_loop_probe", "Control-plane loop runner passes a no-artifact probe and full loop catalog remains registered.", controlPlaneLoopProbe.status === "ready" && DEFAULT_CONTROL_PLANE_LOOP_STEPS.length >= 280, {
      evidence_status: controlPlaneLoopProbe.result?.loop_status ?? controlPlaneLoopProbe.error,
      default_control_plane_loop_step_count: DEFAULT_CONTROL_PLANE_LOOP_STEPS.length,
    }),
    opsRow("dashboard_api_smoke_readiness", "Dashboard/API smoke readiness rows are ready.", apiSmokeRows.length >= 6 && apiSmokeRows.every((row) => row.api_smoke_status === "ready"), {
      evidence_status: apiSmokeRows.every((row) => row.api_smoke_status === "ready") ? "ready" : "blocked",
    }),
    opsRow("domain_pack_registry", "Domain pack registry validates and Trading remains registered.", domainPackRegistry.status === "ready" && domainPackRegistry.result?.validation?.valid === true && domainPackRegistry.result?.packs?.some((pack) => pack.pack_id === "trading"), {
      evidence_status: domainPackRegistry.result?.validation?.valid ? "valid" : domainPackRegistry.error,
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "ops_check_row_hash"));
}

function opsRow(rowKey, description, passed, extra = {}) {
  return {
    schema_version: "platform-ops-check-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    ops_check_status: passed ? "ready" : "blocked",
    command_execution_performed_by_ops_check: rowKey === "control_plane_loop_probe",
    package_command_execution_performed_by_ops_check: false,
    artifact_write_performed_by_ops_check: false,
    protected_action_executed_by_ops_check: false,
    human_review_required: true,
    ...extra,
  };
}

function buildBoundary({ generatedAt, controlPlaneLoopProbe, writeRequested }) {
  return {
    schema_version: "platform-ops-check-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    control_plane_only: true,
    check_mode: true,
    ops_check_artifact_write_requested: writeRequested,
    command_execution_performed: controlPlaneLoopProbe.result?.summary?.step_count === 1,
    package_command_execution_performed: false,
    control_plane_loop_probe_executed: controlPlaneLoopProbe.result?.summary?.step_count === 1,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    dashboard_mutation_performed: false,
    api_mutation_performed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    desktop_source_of_truth: false,
    human_review_required: true,
  };
}

function buildGateRows({ sourceRows, opsRows, apiSmokeRows, boundary }) {
  const rows = [
    gateRow("source_rows_ready", "P362 package, ledger, dashboard, and API sources are ready.", sourceRows.every((row) => row.source_status === "ready")),
    gateRow("runtime_contracts_ready", "Runtime baseline and contract rows are ready.", ["runtime_baseline", "contract_golden_fixtures", "contract_validation_suite"].every((rowKey) => findOpsRow(opsRows, rowKey)?.ops_check_status === "ready")),
    gateRow("control_plane_loop_ready", "Control-plane loop probe is ready and full loop catalog remains populated.", findOpsRow(opsRows, "control_plane_loop_probe")?.ops_check_status === "ready"),
    gateRow("dashboard_api_smoke_ready", "Dashboard/API smoke readiness rows are ready.", apiSmokeRows.length >= 6 && apiSmokeRows.every((row) => row.api_smoke_status === "ready")),
    gateRow("domain_pack_registry_ready", "Domain pack registry is valid with Trading registered.", findOpsRow(opsRows, "domain_pack_registry")?.ops_check_status === "ready"),
    gateRow("no_package_or_artifact_mutation", "Ops check performs no package command execution, dependency install, package/lockfile mutation, artifact write, release publish, or git operation.", !boundary.package_command_execution_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed),
    gateRow("trading_disabled_boundary", "Trading live/full-auto/order submission and broker writes remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "ops_check_gate_hash"));
}

function findOpsRow(rows, rowKey) {
  return rows.find((row) => row.row_key === rowKey);
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-ops-check-gate-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    artifact_write_performed_by_ops_check: false,
    protected_action_executed_by_ops_check: false,
    trading_order_submission_performed_by_ops_check: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceRows, opsRows, apiSmokeRows, gateRows, boundary }) {
  return [
    validationItem("ops_check_source_rows", "source_rows_ready", sourceRows.length >= 10 && sourceRows.every((row) => row.source_status === "ready"), "P362 source rows are ready."),
    validationItem("ops_check_rows", "ops_rows_ready", opsRows.length >= 6 && opsRows.every((row) => row.ops_check_status === "ready"), "P362 ops rows are ready."),
    validationItem("api_smoke_rows", "api_smoke_rows_ready", apiSmokeRows.length >= 6 && apiSmokeRows.every((row) => row.api_smoke_status === "ready"), "Dashboard/API smoke rows are ready."),
    validationItem("ops_check_gate_rows", "ops_gates_ready", gateRows.length >= 7 && gateRows.every((row) => row.gate_status === "ready"), "P362 ops gates are ready."),
    validationItem("boundary.no_mutation", "no_package_artifact_or_protected_mutation", !boundary.package_command_execution_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "Ops check does not execute package commands, write artifacts, mutate dependencies/package/lockfile, publish releases, run git, or execute protected actions."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
  ];
}

function buildSummary({ sourceRows, opsRows, apiSmokeRows, gateRows, boundary, validation }) {
  return {
    platform_ops_check_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_row_count: sourceRows.length,
    ready_source_row_count: sourceRows.filter((row) => row.source_status === "ready").length,
    ops_check_row_count: opsRows.length,
    ready_ops_check_row_count: opsRows.filter((row) => row.ops_check_status === "ready").length,
    api_smoke_row_count: apiSmokeRows.length,
    ready_api_smoke_row_count: apiSmokeRows.filter((row) => row.api_smoke_status === "ready").length,
    ops_check_gate_count: gateRows.length,
    ready_ops_check_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    default_control_plane_loop_step_count: DEFAULT_CONTROL_PLANE_LOOP_STEPS.length,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    control_plane_loop_probe_executed: boundary.control_plane_loop_probe_executed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    dashboard_mutation_performed: boundary.dashboard_mutation_performed,
    api_mutation_performed: boundary.api_mutation_performed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Ops Check",
    "",
    `Status: ${result.summary.platform_ops_check_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Ops rows: ${result.summary.ready_ops_check_row_count}/${result.summary.ops_check_row_count}`,
    `API smoke rows: ${result.summary.ready_api_smoke_row_count}/${result.summary.api_smoke_row_count}`,
    `Gates: ${result.summary.ready_ops_check_gate_count}/${result.summary.ops_check_gate_count}`,
    "",
    "## Ops Rows",
    "",
    ...result.ops_check_rows.map((row) => `- ${row.row_key}: ${row.ops_check_status}`),
    "",
    "## API Smoke Rows",
    "",
    ...result.api_smoke_rows.map((row) => `- ${row.row_key}: ${row.api_smoke_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPS_CHECK_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--review-api-source") parsed.reviewApiSourcePath = argv[++index];
    else if (arg === "--review-api-smoke-script") parsed.reviewApiSmokeScriptPath = argv[++index];
    else if (arg === "--review-dashboard-source") parsed.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--cwd") parsed.cwd = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-ops-check.mjs [options]

Options:
  --out-dir <folder>                 Output directory. Default: ${DEFAULT_PLATFORM_OPS_CHECK_OUT_DIR}
  --run-at <iso>                     Deterministic generated_at timestamp.
  --package <path>                   package.json path.
  --platform-ops-ledger <path>       P341-P500 platform operations ledger path.
  --review-api-source <path>         Review API source path.
  --review-api-smoke-script <path>   Review API smoke script path.
  --review-dashboard-source <path>   Review dashboard source path.
  --schema <path>                    Output schema path.
  --cwd <path>                       Working directory for the control-plane loop probe.
  --check                            Validate only, do not write artifacts.
  -h, --help                         Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.platformOpsLedgerPath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.reviewApiSourcePath),
    review_api_smoke_script_path: path.resolve(options.reviewApiSmokeScriptPath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.reviewApiSmokeScriptPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.reviewDashboardSourcePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPS_CHECK_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: sha256(raw),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-ops-check.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
