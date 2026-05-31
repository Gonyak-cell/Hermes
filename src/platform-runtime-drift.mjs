import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS,
  buildPlatformRuntimeBaseline,
} from "./platform-runtime-baseline.mjs";

export const DEFAULT_PLATFORM_RUNTIME_DRIFT_OUT_DIR = "artifacts/platform-runtime-drift/latest";
export const DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS = {
  ...DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS,
  baselineSchemaPath: DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-runtime-drift.schema.json",
};

const SCHEMA_VERSION = "platform-runtime-drift.v1";
const CAPABILITY_ID = "platform.runtime_drift_check";
const PHASE_SLOT = "P342";
const PREVIOUS_PHASE_SLOT = "P341";
const NEXT_PHASE_SLOT = "P343";
const BASELINE_PHASE_SLOT = "P341";
const BASELINE_COMMAND = "platform:runtime-baseline -- --check";

export async function runPlatformRuntimeDriftCheck(options = {}) {
  const result = await buildPlatformRuntimeDriftCheck(options);
  if (options.write !== false) await writePlatformRuntimeDriftCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform runtime drift check failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformRuntimeDriftCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const baseline = await buildPlatformRuntimeBaseline({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    nvmrcPath: inputs.nvmrc_path,
    nodeVersionPath: inputs.node_version_path,
    npmrcPath: inputs.npmrc_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingPhaseLedgerPath: inputs.trading_phase_ledger_path,
    schemaPath: inputs.baseline_schema_path,
  });
  const sourceFingerprints = await buildSourceFingerprints(inputs);
  const baselineReference = buildBaselineReference(baseline);
  const runtimeDriftRows = buildDriftRows("runtime", baseline.runtime_rows);
  const dependencyDriftRows = buildDriftRows("dependency", baseline.dependency_rows);
  const provenanceDriftRows = buildDriftRows("provenance", baseline.provenance_rows);
  const driftBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    baseline,
    runtimeDriftRows,
    dependencyDriftRows,
    provenanceDriftRows,
    driftBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    baseline,
    runtimeDriftRows,
    dependencyDriftRows,
    provenanceDriftRows,
    driftBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_runtime_drift_check_id: `platform-runtime-drift.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    baseline_reference: baselineReference,
    source_fingerprints: sourceFingerprints,
    runtime_drift_rows: runtimeDriftRows,
    dependency_drift_rows: dependencyDriftRows,
    provenance_drift_rows: provenanceDriftRows,
    runtime_drift_boundary: driftBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_runtime_drift") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    baseline,
    runtimeDriftRows,
    dependencyDriftRows,
    provenanceDriftRows,
    driftBoundary,
    validation: result.validation,
  });
  result.summary.platform_runtime_drift_check_id = result.platform_runtime_drift_check_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformRuntimeDriftCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-runtime-drift.json"), serializable);
  await writeJson(path.join(outDir, "runtime-drift-rows.json"), collectionEnvelope("platform-runtime-drift-runtime-rows.v1", "runtime_drift_rows", result.runtime_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "dependency-drift-rows.json"), collectionEnvelope("platform-runtime-drift-dependency-rows.v1", "dependency_drift_rows", result.dependency_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "provenance-drift-rows.json"), collectionEnvelope("platform-runtime-drift-provenance-rows.v1", "provenance_drift_rows", result.provenance_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-fingerprints.json"), collectionEnvelope("platform-runtime-drift-source-fingerprints.v1", "source_fingerprints", result.source_fingerprints, result.generated_at));
  await writeJson(path.join(outDir, "runtime-drift-boundary.json"), result.runtime_drift_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-runtime-drift-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformRuntimeDriftCheckCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformRuntimeDriftCheck(args);
    console.log(`Platform runtime drift ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_runtime_drift_status}`);
    console.log(`Runtime drift rows: ${result.summary.stable_runtime_drift_row_count}/${result.summary.runtime_drift_row_count}`);
    console.log(`Dependency drift rows: ${result.summary.stable_dependency_drift_row_count}/${result.summary.dependency_drift_row_count}`);
    console.log(`Provenance drift rows: ${result.summary.stable_provenance_drift_row_count}/${result.summary.provenance_drift_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildBaselineReference(baseline) {
  return {
    schema_version: "platform-runtime-drift-baseline-reference.v1",
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    baseline_command: BASELINE_COMMAND,
    baseline_status: baseline.summary.platform_runtime_baseline_status,
    baseline_policy_scope: baseline.baseline_policy.policy_scope,
    baseline_policy_hash: hashValue(baseline.baseline_policy),
    pinned_node_version: baseline.baseline_policy.pinned_node_version,
    supported_node_engine: baseline.baseline_policy.supported_node_engine,
    pinned_package_manager: baseline.baseline_policy.pinned_package_manager,
    supported_npm_engine: baseline.baseline_policy.supported_npm_engine,
    package_lock_required: baseline.baseline_policy.package_lock_required,
    p340_verified_bundle_sha256: baseline.baseline_policy.p340_verified_bundle_sha256,
  };
}

function buildDriftRows(kind, rows) {
  return rows.map((row, index) => {
    const driftStatus = row.row_status === "passed" ? "stable" : "drifted";
    const rowWithOrdinal = {
      schema_version: "platform-runtime-drift-row.v1",
      drift_row_id: `platform-runtime-drift.${row.row_id}`,
      phase_slot: PHASE_SLOT,
      baseline_phase_slot: BASELINE_PHASE_SLOT,
      row_kind: kind,
      source_row_id: row.row_id,
      row_key: row.row_key,
      description: row.description,
      expected_value: row.expected_value,
      actual_value: row.actual_value,
      source_row_status: row.row_status,
      source_row_hash: row.row_hash,
      drift_status: driftStatus,
      severity: driftStatus === "stable" ? "none" : driftSeverity(kind),
      human_review_required: driftStatus !== "stable",
      ordinal: index + 1,
    };
    return { ...rowWithOrdinal, drift_row_hash: hashValue(rowWithOrdinal) };
  });
}

function driftSeverity(kind) {
  if (kind === "runtime" || kind === "dependency") return "high";
  return "medium";
}

async function buildSourceFingerprints(inputs) {
  const sources = [
    ["package_json", inputs.package_path],
    ["package_lock", inputs.package_lock_path],
    ["nvmrc", inputs.nvmrc_path],
    ["node_version", inputs.node_version_path],
    ["npmrc", inputs.npmrc_path],
    ["platform_ops_ledger", inputs.platform_ops_ledger_path],
    ["trading_phase_ledger", inputs.trading_phase_ledger_path],
    ["baseline_schema", inputs.baseline_schema_path],
    ["drift_schema", inputs.schema_path],
  ];
  const rows = await Promise.all(sources.map(async ([sourceKey, sourcePath], index) => {
    const source = await readTextSource(sourcePath);
    const row = {
      schema_version: "platform-runtime-drift-source-fingerprint.v1",
      source_fingerprint_id: `platform-runtime-drift.source.${sourceKey}`,
      source_key: sourceKey,
      source_path: sourcePath,
      source_status: source.available ? "available" : "missing",
      content_hash: source.content_hash,
      read_only: true,
      content_read_for_hash_only: true,
      ordinal: index + 1,
    };
    return { ...row, source_fingerprint_hash: hashValue(row) };
  }));
  return rows;
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-runtime-drift-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    read_only: true,
    report_only: true,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    runtime_policy_mutation_performed: false,
    command_execution_performed: false,
    git_tag_created: false,
    release_published: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    protected_recovery_execution_allowed: false,
    human_review_required_for_drift: true,
  };
}

function buildValidationItems({ baseline, runtimeDriftRows, dependencyDriftRows, provenanceDriftRows, driftBoundary }) {
  return [
    validationItem("baseline.status", "p341_baseline_stable", baseline.validation.valid, "The current local state still satisfies the P341 runtime baseline."),
    validationItem("drift.runtime_rows", "runtime_drift_stable", runtimeDriftRows.every((row) => row.drift_status === "stable"), "All runtime rows match the P341 baseline expectations."),
    validationItem("drift.dependency_rows", "dependency_drift_stable", dependencyDriftRows.every((row) => row.drift_status === "stable"), "All dependency rows match the P341 baseline expectations."),
    validationItem("drift.provenance_rows", "provenance_drift_stable", provenanceDriftRows.every((row) => row.drift_status === "stable"), "All provenance rows match the P341 baseline expectations."),
    validationItem("boundary.read_only", "read_only_report", driftBoundary.read_only && driftBoundary.report_only && !driftBoundary.package_mutation_performed && !driftBoundary.lockfile_mutation_performed && !driftBoundary.release_published, "Drift check is read-only and report-only."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !driftBoundary.trading_live_enabled && !driftBoundary.trading_full_auto_enabled && !driftBoundary.trading_order_submission_allowed && !driftBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !driftBoundary.desktop_source_of_truth && !driftBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ baseline, runtimeDriftRows, dependencyDriftRows, provenanceDriftRows, driftBoundary, validation }) {
  const allRows = [...runtimeDriftRows, ...dependencyDriftRows, ...provenanceDriftRows];
  const driftedRows = allRows.filter((row) => row.drift_status !== "stable");
  return {
    platform_runtime_drift_status: validation.valid ? "stable" : "drift_detected",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    baseline_status: baseline.summary.platform_runtime_baseline_status,
    baseline_command: BASELINE_COMMAND,
    runtime_drift_row_count: runtimeDriftRows.length,
    stable_runtime_drift_row_count: runtimeDriftRows.filter((row) => row.drift_status === "stable").length,
    dependency_drift_row_count: dependencyDriftRows.length,
    stable_dependency_drift_row_count: dependencyDriftRows.filter((row) => row.drift_status === "stable").length,
    provenance_drift_row_count: provenanceDriftRows.length,
    stable_provenance_drift_row_count: provenanceDriftRows.filter((row) => row.drift_status === "stable").length,
    total_drift_row_count: allRows.length,
    stable_drift_row_count: allRows.filter((row) => row.drift_status === "stable").length,
    drifted_row_count: driftedRows.length,
    drifted_row_ids: driftedRows.map((row) => row.source_row_id),
    read_only: driftBoundary.read_only,
    report_only: driftBoundary.report_only,
    dependency_install_performed: driftBoundary.dependency_install_performed,
    package_mutation_performed: driftBoundary.package_mutation_performed,
    lockfile_mutation_performed: driftBoundary.lockfile_mutation_performed,
    release_published: driftBoundary.release_published,
    desktop_source_of_truth: driftBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: driftBoundary.desktop_mutation_allowed,
    trading_live_enabled: driftBoundary.trading_live_enabled,
    trading_full_auto_enabled: driftBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: driftBoundary.trading_order_submission_allowed,
    broker_write_allowed: driftBoundary.broker_write_allowed,
    validation_error_count: validation.errors.length,
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

function renderMarkdown(result) {
  const lines = [
    "# Platform Runtime Drift Check",
    "",
    `Status: ${result.summary.platform_runtime_drift_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Baseline phase: ${result.summary.baseline_phase_slot}`,
    `Baseline command: ${result.summary.baseline_command}`,
    `Runtime drift rows: ${result.summary.stable_runtime_drift_row_count}/${result.summary.runtime_drift_row_count}`,
    `Dependency drift rows: ${result.summary.stable_dependency_drift_row_count}/${result.summary.dependency_drift_row_count}`,
    `Provenance drift rows: ${result.summary.stable_provenance_drift_row_count}/${result.summary.provenance_drift_row_count}`,
    `Drifted rows: ${result.summary.drifted_row_count}`,
    "",
    "## Runtime Drift Rows",
    "",
    ...result.runtime_drift_rows.map((row) => `- ${row.row_key}: ${row.drift_status}`),
    "",
    "## Dependency Drift Rows",
    "",
    ...result.dependency_drift_rows.map((row) => `- ${row.row_key}: ${row.drift_status}`),
    "",
    "## Provenance Drift Rows",
    "",
    ...result.provenance_drift_rows.map((row) => `- ${row.row_key}: ${row.drift_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RUNTIME_DRIFT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--package-lock") parsed.packageLockPath = argv[++index];
    else if (arg === "--nvmrc") parsed.nvmrcPath = argv[++index];
    else if (arg === "--node-version") parsed.nodeVersionPath = argv[++index];
    else if (arg === "--npmrc") parsed.npmrcPath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-phase-ledger") parsed.tradingPhaseLedgerPath = argv[++index];
    else if (arg === "--baseline-schema") parsed.baselineSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-runtime-drift.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_PLATFORM_RUNTIME_DRIFT_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --nvmrc <path>                  .nvmrc path.
  --node-version <path>           .node-version path.
  --npmrc <path>                  .npmrc path.
  --platform-ops-ledger <path>    P341-P500 ledger path.
  --trading-phase-ledger <path>   Trading P001-P340 ledger path.
  --baseline-schema <path>        P341 runtime baseline schema path.
  --schema <path>                 Output schema path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.baselineSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.schemaPath),
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
      text: null,
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
    validation_item_id: `platform-runtime-drift.${slugify(itemPath)}.${checkId}`,
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
