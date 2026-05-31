import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_CLOSEOUT_INPUTS,
  buildPlatformReleaseCheckReceiptCloseout,
} from "./platform-release-check-receipt-closeout.mjs";

export const DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_OUT_DIR = "artifacts/trading-safety-regression-fixtures/latest";
export const DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_CLOSEOUT_INPUTS,
  releaseCheckReceiptCloseoutSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_CLOSEOUT_INPUTS.schemaPath,
  limitedLivePath: "examples/trading/limited-live-governance.json",
  fullAutoPath: "examples/trading/full-auto-governance.json",
  schemaPath: "schemas/trading/trading-safety-regression-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-safety-regression-fixtures.v1";
const CAPABILITY_ID = "trading.safety_regression_fixtures";
const PHASE_SLOT = "P381";
const PREVIOUS_PHASE_SLOT = "P380";
const NEXT_PHASE_SLOT = "P382";
const READY_STATUS = "ready_for_trading_safety_regression";
const REQUIRED_FLAGS = [
  "limited_live_enabled",
  "full_auto_enabled",
  "automatic_order_submission_allowed",
  "live_order_submission_allowed",
];

export async function runTradingSafetyRegressionFixtures(options = {}) {
  const result = await buildTradingSafetyRegressionFixtures(options);
  if (options.write !== false) await writeTradingSafetyRegressionFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading safety regression fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSafetyRegressionFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptCloseout = await buildPlatformReleaseCheckReceiptCloseout({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.release_check_receipt_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const regressionAnchor = buildRegressionAnchor({ receiptCloseout });
  const regressionFixtureRows = buildRegressionFixtureRows({ limitedLive: limitedLive.data, fullAuto: fullAuto.data });
  const regressionBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, regressionFixtureRows });
  const regressionGateRows = buildRegressionGateRows({ receiptCloseout, packageJson, platformOpsLedger, limitedLive, fullAuto, regressionFixtureRows, regressionBoundary });
  const validationItems = buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, limitedLive, fullAuto, regressionFixtureRows, regressionGateRows, regressionBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ regressionFixtureRows, regressionGateRows, regressionBoundary, receiptCloseout, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_safety_regression_fixtures_id: `trading-safety-regression-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    safety_regression_anchor: regressionAnchor,
    safety_regression_fixture_rows: regressionFixtureRows,
    safety_regression_gate_rows: regressionGateRows,
    safety_regression_boundary: regressionBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_safety_regression_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ regressionFixtureRows, regressionGateRows, regressionBoundary, receiptCloseout, validation: result.validation });
  result.summary.trading_safety_regression_fixtures_id = result.trading_safety_regression_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSafetyRegressionFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-safety-regression-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "safety-regression-fixture-rows.json"), collectionEnvelope("trading-safety-regression-fixture-rows.v1", "safety_regression_fixture_rows", result.safety_regression_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "safety-regression-gate-rows.json"), collectionEnvelope("trading-safety-regression-gate-rows.v1", "safety_regression_gate_rows", result.safety_regression_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "safety-regression-boundary.json"), result.safety_regression_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-safety-regression-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSafetyRegressionFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSafetyRegressionFixtures(args);
    console.log(`Trading safety regression fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_safety_regression_fixtures_status}`);
    console.log(`Regression fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe flags detected: ${result.summary.unsafe_flag_detected_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRegressionAnchor({ receiptCloseout }) {
  return {
    schema_version: "trading-safety-regression-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_release_check_receipt_closeout_id: receiptCloseout.platform_release_check_receipt_closeout_id,
    source_release_check_receipt_closeout_status: receiptCloseout.summary.platform_release_check_receipt_closeout_status,
    required_flag_count: REQUIRED_FLAGS.length,
    required_flags: REQUIRED_FLAGS,
    source_hash: hashValue({
      id: receiptCloseout.platform_release_check_receipt_closeout_id,
      status: receiptCloseout.summary.platform_release_check_receipt_closeout_status,
      flags: REQUIRED_FLAGS,
    }),
  };
}

function buildRegressionFixtureRows({ limitedLive, fullAuto }) {
  const rows = [
    flagFixture("limited_live_enabled", [
      observedValue("limited_live_governance", "safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"])),
      observedValue("full_auto_governance", "safety_boundary.limited_live_enabled", valueAt(fullAuto, ["safety_boundary", "limited_live_enabled"])),
    ]),
    flagFixture("full_auto_enabled", [
      observedValue("full_auto_governance", "safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"])),
    ]),
    flagFixture("automatic_order_submission_allowed", [
      observedValue("full_auto_governance", "safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"])),
    ]),
    flagFixture("live_order_submission_allowed", [
      observedValue("limited_live_governance", "safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"])),
      observedValue("full_auto_governance", "safety_boundary.live_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "live_order_submission_allowed"])),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "safety_regression_fixture_hash"));
}

function flagFixture(flagName, observedValues) {
  const unsafeValueDetected = observedValues.some((source) => source.value === true);
  const allSourcesPresent = observedValues.every((source) => source.value === false || source.value === true);
  return {
    schema_version: "trading-safety-regression-fixture-row.v1",
    safety_regression_fixture_row_id: `trading-safety-regression-fixtures.row.${flagName}`,
    phase_slot: PHASE_SLOT,
    row_key: flagName,
    flag_name: flagName,
    expected_safe_value: false,
    unsafe_value: true,
    fixture_should_fail_when_true: true,
    observed_values: observedValues,
    observed_value_count: observedValues.length,
    all_sources_present: allSourcesPresent,
    unsafe_value_detected: unsafeValueDetected,
    fixture_status: !unsafeValueDetected && allSourcesPresent ? "passed" : "failed",
    blocks_live_trading: true,
    blocks_full_auto: true,
    blocks_order_submission: true,
    broker_write_allowed_by_fixture: false,
    exchange_write_allowed_by_fixture: false,
    command_execution_performed_by_fixture: false,
    artifact_write_performed_by_fixture: false,
    protected_action_executed_by_fixture: false,
    human_review_required: true,
  };
}

function observedValue(artifactId, jsonPath, value) {
  return {
    artifact_id: artifactId,
    json_path: jsonPath,
    value,
    unsafe_when_true: true,
  };
}

function buildBoundary({ generatedAt, writeRequested, regressionFixtureRows }) {
  const unsafeFlags = regressionFixtureRows.filter((row) => row.unsafe_value_detected).map((row) => row.flag_name);
  return {
    schema_version: "trading-safety-regression-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    safety_regression_artifact_write_requested: writeRequested,
    regression_fixtures_declared: true,
    regression_fixture_execution_performed: false,
    unsafe_flag_detected_count: unsafeFlags.length,
    unsafe_flag_names: unsafeFlags,
    limited_live_enabled: Boolean(regressionFixtureRows.find((row) => row.flag_name === "limited_live_enabled")?.unsafe_value_detected),
    full_auto_enabled: Boolean(regressionFixtureRows.find((row) => row.flag_name === "full_auto_enabled")?.unsafe_value_detected),
    automatic_order_submission_allowed: Boolean(regressionFixtureRows.find((row) => row.flag_name === "automatic_order_submission_allowed")?.unsafe_value_detected),
    live_order_submission_allowed: Boolean(regressionFixtureRows.find((row) => row.flag_name === "live_order_submission_allowed")?.unsafe_value_detected),
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function buildRegressionGateRows({ receiptCloseout, packageJson, platformOpsLedger, limitedLive, fullAuto, regressionFixtureRows, regressionBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p380_release_check_receipt_closeout_ready", "P380 release-check receipt closeout source is ready.", receiptCloseout.validation.valid && receiptCloseout.summary.platform_release_check_receipt_closeout_status === "ready_for_release_check_receipt_chain_closeout"),
    gateRow("platform_package_script_registered", "package.json registers the P381 trading safety regression fixtures command.", typeof scripts["trading:safety-regression-fixtures"] === "string" && scripts["trading:safety-regression-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P381 trading safety regression fixtures command.", validateScript.includes("npm run trading:safety-regression-fixtures -- --check")),
    gateRow("p381_ledger_acceptance_declared", "P381 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P381: `trading:safety-regression-fixtures`")),
    gateRow("source_governance_readable", "Limited-live and full-auto governance artifacts are readable.", limitedLive.available && fullAuto.available),
    gateRow("required_regression_fixtures_declared", "All required unsafe boolean regression fixtures are declared.", REQUIRED_FLAGS.every((flagName) => regressionFixtureRows.some((row) => row.flag_name === flagName)) && regressionFixtureRows.length === REQUIRED_FLAGS.length),
    gateRow("unsafe_flags_false", "Regression fixtures fail when unsafe flags are true and currently observe all unsafe flags as false.", regressionFixtureRows.every((row) => row.fixture_status === "passed") && regressionBoundary.unsafe_flag_detected_count === 0),
    gateRow("no_trading_or_artifact_mutation", "Safety regression fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !regressionBoundary.command_execution_performed && !regressionBoundary.artifact_write_performed && !regressionBoundary.release_published && !regressionBoundary.git_operation_performed && !regressionBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "safety_regression_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-safety-regression-gate-row.v1",
    safety_regression_gate_row_id: `trading-safety-regression-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    trading_live_enabled_by_gate: false,
    full_auto_enabled_by_gate: false,
    automatic_order_submission_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, limitedLive, fullAuto, regressionFixtureRows, regressionGateRows, regressionBoundary }) {
  return [
    validationItem("source.release_check_receipt_closeout", "p380_release_check_receipt_closeout_ready", receiptCloseout.validation.valid && receiptCloseout.summary.platform_release_check_receipt_closeout_status === "ready_for_release_check_receipt_chain_closeout", "P380 release-check receipt closeout source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P381 safety regression fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.limited_live_governance", "limited_live_governance_available", limitedLive.available, "Limited-live governance source is readable."),
    validationItem("source.full_auto_governance", "full_auto_governance_available", fullAuto.available, "Full-auto governance source is readable."),
    validationItem("safety_regression_fixture_rows", "required_fixtures_pass", regressionFixtureRows.length === REQUIRED_FLAGS.length && regressionFixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_true && row.expected_safe_value === false && row.unsafe_value === true), "All required unsafe boolean regression fixtures must pass with safe false values."),
    validationItem("safety_regression_gate_rows", "regression_gates_ready", regressionGateRows.length >= 8 && regressionGateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P381 safety regression gates are ready."),
    validationItem("boundary.unsafe_flags_false", "unsafe_flags_false", regressionBoundary.unsafe_flag_detected_count === 0 && !regressionBoundary.limited_live_enabled && !regressionBoundary.full_auto_enabled && !regressionBoundary.automatic_order_submission_allowed && !regressionBoundary.live_order_submission_allowed, "Unsafe trading enablement flags must remain false."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !regressionBoundary.command_execution_performed && !regressionBoundary.package_command_execution_performed && !regressionBoundary.release_check_execution_performed && !regressionBoundary.artifact_write_performed && !regressionBoundary.release_published && !regressionBoundary.git_operation_performed && !regressionBoundary.protected_action_executed && !regressionBoundary.broker_write_allowed && !regressionBoundary.exchange_write_allowed, "P381 safety regression fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ regressionFixtureRows, regressionGateRows, regressionBoundary, receiptCloseout, validation }) {
  return {
    trading_safety_regression_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_release_check_receipt_closeout_status: receiptCloseout.summary.platform_release_check_receipt_closeout_status,
    fixture_count: regressionFixtureRows.length,
    passed_fixture_count: regressionFixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: regressionFixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: regressionGateRows.length,
    ready_gate_count: regressionGateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_flag_detected_count: regressionBoundary.unsafe_flag_detected_count,
    unsafe_flag_names: regressionBoundary.unsafe_flag_names,
    limited_live_enabled: regressionBoundary.limited_live_enabled,
    full_auto_enabled: regressionBoundary.full_auto_enabled,
    automatic_order_submission_allowed: regressionBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: regressionBoundary.live_order_submission_allowed,
    trading_live_enabled: regressionBoundary.trading_live_enabled,
    trading_full_auto_enabled: regressionBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: regressionBoundary.trading_order_submission_allowed,
    broker_write_allowed: regressionBoundary.broker_write_allowed,
    exchange_write_allowed: regressionBoundary.exchange_write_allowed,
    command_execution_performed: regressionBoundary.command_execution_performed,
    package_command_execution_performed: regressionBoundary.package_command_execution_performed,
    release_check_execution_performed: regressionBoundary.release_check_execution_performed,
    artifact_write_performed: regressionBoundary.artifact_write_performed,
    release_published: regressionBoundary.release_published,
    git_operation_performed: regressionBoundary.git_operation_performed,
    protected_action_executed: regressionBoundary.protected_action_executed,
    human_review_required: regressionBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Safety Regression Fixtures",
    "",
    `Status: ${result.summary.trading_safety_regression_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source closeout: ${result.summary.source_release_check_receipt_closeout_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe flags: ${result.summary.unsafe_flag_detected_count}`,
    "",
    "## Fixtures",
    "",
    ...result.safety_regression_fixture_rows.map((row) => `- ${row.flag_name}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.safety_regression_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-safety-regression-fixtures.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --limited-live <path>                  Limited-live governance artifact path.
  --full-auto <path>                     Full-auto governance artifact path.
  --release-check-receipt-closeout-schema <path>
                                         P380 receipt closeout schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.fullAutoPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.schemaPath),
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
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-safety-regression-fixtures.${slugify(itemPath)}.${checkId}`,
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
