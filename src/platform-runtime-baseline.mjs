import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_RUNTIME_BASELINE_OUT_DIR = "artifacts/platform-runtime-baseline/latest";
export const DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS = {
  packagePath: "package.json",
  packageLockPath: "package-lock.json",
  nvmrcPath: ".nvmrc",
  nodeVersionPath: ".node-version",
  npmrcPath: ".npmrc",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  tradingPhaseLedgerPath: "docs/trading-pack-phase-ledger.md",
  schemaPath: "schemas/platform-runtime-baseline.schema.json",
};

const SCHEMA_VERSION = "platform-runtime-baseline.v1";
const CAPABILITY_ID = "platform.runtime_baseline";
const PHASE_SLOT = "P341";
const PREVIOUS_PHASE_SLOT = "P340";
const NEXT_PHASE_SLOT = "P342";
const PINNED_NODE_VERSION = "26.0.0";
const PINNED_PACKAGE_MANAGER = "npm@11.12.1";
const EXPECTED_P340_BUNDLE_HASH = "1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d";

export async function runPlatformRuntimeBaseline(options = {}) {
  const result = await buildPlatformRuntimeBaseline(options);
  if (options.write !== false) await writePlatformRuntimeBaseline(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform runtime baseline validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformRuntimeBaseline(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    package_json: await readJsonSource(inputs.package_path),
    package_lock: await readJsonSource(inputs.package_lock_path),
    nvmrc: await readTextSource(inputs.nvmrc_path),
    node_version: await readTextSource(inputs.node_version_path),
    npmrc: await readTextSource(inputs.npmrc_path),
    platform_ops_ledger: await readTextSource(inputs.platform_ops_ledger_path),
    trading_phase_ledger: await readTextSource(inputs.trading_phase_ledger_path),
  };
  const baselinePolicy = buildBaselinePolicy();
  const runtimeRows = buildRuntimeRows(sources, baselinePolicy);
  const dependencyRows = buildDependencyRows(sources, baselinePolicy);
  const provenanceRows = buildProvenanceRows(sources, baselinePolicy);
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ sources, baselinePolicy, runtimeRows, dependencyRows, provenanceRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ runtimeRows, dependencyRows, provenanceRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_runtime_baseline_id: `platform-runtime-baseline.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    baseline_policy: baselinePolicy,
    runtime_rows: runtimeRows,
    dependency_rows: dependencyRows,
    provenance_rows: provenanceRows,
    runtime_baseline_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_runtime_baseline") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ runtimeRows, dependencyRows, provenanceRows, boundary, validation: result.validation });
  result.summary.platform_runtime_baseline_id = result.platform_runtime_baseline_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformRuntimeBaseline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-runtime-baseline.json"), serializable);
  await writeJson(path.join(outDir, "runtime-rows.json"), collectionEnvelope("platform-runtime-baseline-runtime-rows.v1", "runtime_rows", result.runtime_rows, result.generated_at));
  await writeJson(path.join(outDir, "dependency-rows.json"), collectionEnvelope("platform-runtime-baseline-dependency-rows.v1", "dependency_rows", result.dependency_rows, result.generated_at));
  await writeJson(path.join(outDir, "provenance-rows.json"), collectionEnvelope("platform-runtime-baseline-provenance-rows.v1", "provenance_rows", result.provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-baseline-boundary.json"), result.runtime_baseline_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-runtime-baseline-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformRuntimeBaselineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformRuntimeBaseline(args);
    console.log(`Platform runtime baseline ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_runtime_baseline_status}`);
    console.log(`Runtime rows: ${result.summary.passed_runtime_row_count}/${result.summary.runtime_row_count}`);
    console.log(`Dependency rows: ${result.summary.passed_dependency_row_count}/${result.summary.dependency_row_count}`);
    console.log(`Provenance rows: ${result.summary.passed_provenance_row_count}/${result.summary.provenance_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildBaselinePolicy() {
  return {
    schema_version: "platform-runtime-baseline-policy.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    policy_scope: "platform_operations_stability_reproducibility_baseline",
    pinned_node_version: PINNED_NODE_VERSION,
    supported_node_engine: ">=20 <27",
    pinned_package_manager: PINNED_PACKAGE_MANAGER,
    supported_npm_engine: ">=10 <12",
    package_lock_required: true,
    package_lockfile_name: "package-lock.json",
    npm_engine_strict_required: true,
    p340_verified_bundle_sha256: EXPECTED_P340_BUNDLE_HASH,
    release_bundle_hash_required: true,
    signed_tag_required_for_future_release: true,
    default_surface_policy: "read_only_operator_surface",
  };
}

function buildRuntimeRows(sources, policy) {
  const packageJson = sources.package_json.data ?? {};
  const nvmrc = normalizedText(sources.nvmrc.text);
  const nodeVersion = normalizedText(sources.node_version.text);
  const npmrc = parseNpmrc(sources.npmrc.text ?? "");
  const observedNodeVersion = process.versions.node;
  const rows = [
    runtimeRow("node_version_file", ".nvmrc pins the platform runtime version.", sources.nvmrc.available && nvmrc === policy.pinned_node_version, { expected_value: policy.pinned_node_version, actual_value: nvmrc }),
    runtimeRow("node_version_tool_file", ".node-version matches .nvmrc.", sources.node_version.available && nodeVersion === policy.pinned_node_version && nodeVersion === nvmrc, { expected_value: policy.pinned_node_version, actual_value: nodeVersion }),
    runtimeRow("node_engine_range", "package.json engines.node preserves the supported runtime window.", packageJson.engines?.node === policy.supported_node_engine, { expected_value: policy.supported_node_engine, actual_value: packageJson.engines?.node ?? null }),
    runtimeRow("node_runtime_compatible", "The current Node runtime is inside the supported runtime window.", isSupportedNodeVersion(observedNodeVersion), { expected_value: policy.supported_node_engine, actual_value: observedNodeVersion }),
    runtimeRow("npm_package_manager_pin", "package.json pins the package manager.", packageJson.packageManager === policy.pinned_package_manager, { expected_value: policy.pinned_package_manager, actual_value: packageJson.packageManager ?? null }),
    runtimeRow("npm_engine_range", "package.json engines.npm preserves the supported npm window.", packageJson.engines?.npm === policy.supported_npm_engine, { expected_value: policy.supported_npm_engine, actual_value: packageJson.engines?.npm ?? null }),
    runtimeRow("npm_engine_strict", ".npmrc enforces engine checks.", npmrc["engine-strict"] === "true", { expected_value: "true", actual_value: npmrc["engine-strict"] ?? null }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index));
}

function buildDependencyRows(sources, policy) {
  const packageJson = sources.package_json.data ?? {};
  const packageLock = sources.package_lock.data ?? {};
  const rootPackage = packageLock.packages?.[""] ?? {};
  const npmrc = parseNpmrc(sources.npmrc.text ?? "");
  const rows = [
    dependencyRow("package_lock_present", "A package-lock.json file is committed for deterministic npm installs.", sources.package_lock.available === true, { expected_value: policy.package_lockfile_name, actual_value: sources.package_lock.path ?? null }),
    dependencyRow("package_lock_version", "The lockfile uses a modern deterministic npm lockfile version.", Number(packageLock.lockfileVersion ?? 0) >= 3, { expected_value: ">=3", actual_value: packageLock.lockfileVersion ?? null }),
    dependencyRow("package_lock_name_matches", "The lockfile root package matches package.json.", rootPackage.name === packageJson.name, { expected_value: packageJson.name ?? null, actual_value: rootPackage.name ?? null }),
    dependencyRow("package_lock_version_matches", "The lockfile root version matches package.json.", rootPackage.version === packageJson.version, { expected_value: packageJson.version ?? null, actual_value: rootPackage.version ?? null }),
    dependencyRow("package_lock_policy", ".npmrc keeps package-lock generation enabled.", npmrc["package-lock"] === "true", { expected_value: "true", actual_value: npmrc["package-lock"] ?? null }),
    dependencyRow("dependency_free_core", "P341 baseline stays dependency-light and does not add runtime dependencies.", Object.keys(packageJson.dependencies ?? {}).length === 0, { expected_value: 0, actual_value: Object.keys(packageJson.dependencies ?? {}).length }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index));
}

function buildProvenanceRows(sources, policy) {
  const opsLedgerText = sources.platform_ops_ledger.text ?? "";
  const tradingLedgerText = sources.trading_phase_ledger.text ?? "";
  const rows = [
    provenanceRow("p341_p500_ledger_present", "The platform operations stability ledger defines P341-P500.", sources.platform_ops_ledger.available && opsLedgerText.includes("P341-P500") && opsLedgerText.includes("P481-P500"), { expected_value: "P341-P500", actual_value: sources.platform_ops_ledger.available ? "present" : "missing" }),
    provenanceRow("p341_acceptance_declared", "The ledger declares the P341 reproducibility baseline acceptance criteria.", opsLedgerText.includes("P341") && opsLedgerText.includes("platform:runtime-baseline") && opsLedgerText.includes("package-lock.json"), { expected_value: "P341 platform:runtime-baseline package-lock.json", actual_value: "ledger_text" }),
    provenanceRow("p340_bundle_hash_recorded", "The verified P340 transfer bundle hash is recorded for provenance.", opsLedgerText.toLowerCase().includes(policy.p340_verified_bundle_sha256), { expected_value: policy.p340_verified_bundle_sha256, actual_value: opsLedgerText.toLowerCase().includes(policy.p340_verified_bundle_sha256) ? policy.p340_verified_bundle_sha256 : null }),
    provenanceRow("trading_p340_boundary_preserved", "Trading P340 remains the completion baseline with live/full-auto disabled.", tradingLedgerText.includes("P331-P340") && tradingLedgerText.includes("P340") && tradingLedgerText.includes("live/full-auto enablement remains disallowed"), { expected_value: "P340 no live/full-auto", actual_value: sources.trading_phase_ledger.available ? "present" : "missing" }),
    provenanceRow("future_release_checks_planned", "The ledger plans trading and platform release-check commands.", opsLedgerText.includes("trading:release-check") && opsLedgerText.includes("platform:release-check"), { expected_value: "trading:release-check platform:release-check", actual_value: "ledger_text" }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-runtime-baseline-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    dependency_install_performed: false,
    package_mutation_performed: false,
    command_execution_performed: false,
    git_tag_created: false,
    release_published: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    human_review_required_for_promotion: true,
  };
}

function buildValidationItems({ sources, baselinePolicy, runtimeRows, dependencyRows, provenanceRows, boundary }) {
  return [
    validationItem("sources.package_json", "source_available", sources.package_json.available, "package.json is readable."),
    validationItem("sources.package_lock", "source_available", sources.package_lock.available, "package-lock.json is readable."),
    validationItem("sources.platform_ops_ledger", "source_available", sources.platform_ops_ledger.available, "Platform operations stability ledger is readable."),
    validationItem("policy.node_pin", "node_pin_declared", baselinePolicy.pinned_node_version === PINNED_NODE_VERSION, "Pinned Node version is declared."),
    validationItem("policy.package_manager", "npm_pin_declared", baselinePolicy.pinned_package_manager === PINNED_PACKAGE_MANAGER, "Pinned npm package manager is declared."),
    validationItem("runtime_rows", "runtime_rows_pass", runtimeRows.every((row) => row.row_status === "passed"), "All runtime reproducibility rows pass."),
    validationItem("dependency_rows", "dependency_rows_pass", dependencyRows.every((row) => row.row_status === "passed"), "All dependency reproducibility rows pass."),
    validationItem("provenance_rows", "provenance_rows_pass", provenanceRows.every((row) => row.row_status === "passed"), "All P340/P341 provenance rows pass."),
    validationItem("boundary.read_only", "read_only_boundary", boundary.read_only && boundary.report_only && !boundary.package_mutation_performed && !boundary.release_published, "Runtime baseline is report-only and does not mutate release state."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed, "Trading live/full-auto/order submission remains disabled."),
  ];
}

function buildSummary({ runtimeRows, dependencyRows, provenanceRows, boundary, validation }) {
  return {
    platform_runtime_baseline_status: validation.valid ? "complete" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    runtime_row_count: runtimeRows.length,
    passed_runtime_row_count: runtimeRows.filter((row) => row.row_status === "passed").length,
    dependency_row_count: dependencyRows.length,
    passed_dependency_row_count: dependencyRows.filter((row) => row.row_status === "passed").length,
    provenance_row_count: provenanceRows.length,
    passed_provenance_row_count: provenanceRows.filter((row) => row.row_status === "passed").length,
    pinned_node_version: PINNED_NODE_VERSION,
    observed_node_version: process.versions.node,
    pinned_package_manager: PINNED_PACKAGE_MANAGER,
    package_lock_required: true,
    package_lock_present: dependencyRows.find((row) => row.row_id === "dependency.package_lock_present")?.row_status === "passed",
    p340_verified_bundle_sha256: EXPECTED_P340_BUNDLE_HASH,
    p340_bundle_hash_recorded: provenanceRows.find((row) => row.row_id === "provenance.p340_bundle_hash_recorded")?.row_status === "passed",
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    package_mutation_performed: boundary.package_mutation_performed,
    command_execution_performed: boundary.command_execution_performed,
    release_published: boundary.release_published,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    validation_error_count: validation.errors.length,
  };
}

function runtimeRow(rowKey, description, passed, details = {}) {
  return baseRow("runtime", rowKey, description, passed, details);
}

function dependencyRow(rowKey, description, passed, details = {}) {
  return baseRow("dependency", rowKey, description, passed, details);
}

function provenanceRow(rowKey, description, passed, details = {}) {
  return baseRow("provenance", rowKey, description, passed, details);
}

function baseRow(kind, rowKey, description, passed, details) {
  return {
    schema_version: `platform-runtime-baseline-${kind}-row.v1`,
    row_id: `${kind}.${rowKey}`,
    row_kind: kind,
    row_key: rowKey,
    description,
    expected_value: details.expected_value ?? null,
    actual_value: details.actual_value ?? null,
    row_status: passed ? "passed" : "failed",
  };
}

function withOrdinalAndHash(row, index) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, row_hash: hashValue(rowWithOrdinal) };
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
    "# Platform Runtime Baseline",
    "",
    `Status: ${result.summary.platform_runtime_baseline_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Pinned Node: ${result.summary.pinned_node_version}`,
    `Observed Node: ${result.summary.observed_node_version}`,
    `Pinned package manager: ${result.summary.pinned_package_manager}`,
    `Package lock present: ${result.summary.package_lock_present}`,
    `P340 bundle hash recorded: ${result.summary.p340_bundle_hash_recorded}`,
    "",
    "## Runtime Rows",
    "",
    ...result.runtime_rows.map((row) => `- ${row.row_key}: ${row.row_status}`),
    "",
    "## Dependency Rows",
    "",
    ...result.dependency_rows.map((row) => `- ${row.row_key}: ${row.row_status}`),
    "",
    "## Provenance Rows",
    "",
    ...result.provenance_rows.map((row) => `- ${row.row_key}: ${row.row_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RUNTIME_BASELINE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-runtime-baseline.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_PLATFORM_RUNTIME_BASELINE_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --nvmrc <path>                  .nvmrc path.
  --node-version <path>           .node-version path.
  --npmrc <path>                  .npmrc path.
  --platform-ops-ledger <path>    P341-P500 ledger path.
  --trading-phase-ledger <path>   Trading P001-P340 ledger path.
  --schema <path>                 Output schema path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.tradingPhaseLedgerPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RUNTIME_BASELINE_INPUTS.schemaPath),
  };
}

function normalizedText(value = "") {
  return value.trim();
}

function parseNpmrc(value) {
  return Object.fromEntries(value.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim()];
    }));
}

function isSupportedNodeVersion(version) {
  const major = Number(String(version).split(".")[0]);
  return Number.isFinite(major) && major >= 20 && major < 27;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-runtime-baseline.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
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
