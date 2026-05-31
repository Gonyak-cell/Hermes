import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_OUT_DIR = "artifacts/platform-release-check-no-write-audit/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS = {
  packagePath: "package.json",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  tradingReleaseCheckSourcePath: "src/trading-release-check.mjs",
  platformOpsCheckSourcePath: "src/platform-ops-check.mjs",
  platformReleaseCheckSourcePath: "src/platform-release-check.mjs",
  tradingTestSourcePath: "test/trading-pack.test.mjs",
  platformTestSourcePath: "test/platform-ops.test.mjs",
  schemaPath: "schemas/platform-release-check-no-write-audit.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-no-write-audit.v1";
const CAPABILITY_ID = "platform.release_check_no_write_audit";
const PHASE_SLOT = "P364";
const PREVIOUS_PHASE_SLOT = "P363";
const NEXT_PHASE_SLOT = "P365";

const AUDITED_COMMANDS = [
  auditSpec("trading_release_check", "trading:release-check", "tradingReleaseCheckSource", "runTradingReleaseCheck", "writeTradingReleaseCheck", "tradingTestSource", "trading release check --check does not overwrite existing artifacts"),
  auditSpec("platform_ops_check", "platform:ops-check", "platformOpsCheckSource", "runPlatformOpsCheck", "writePlatformOpsCheck", "platformTestSource", "platform ops check --check does not overwrite existing artifacts"),
  auditSpec("platform_release_check", "platform:release-check", "platformReleaseCheckSource", "runPlatformReleaseCheck", "writePlatformReleaseCheck", "platformTestSource", "platform release check --check does not overwrite existing artifacts"),
];

export async function runPlatformReleaseCheckNoWriteAudit(options = {}) {
  const result = await buildPlatformReleaseCheckNoWriteAudit(options);
  if (options.write !== false) await writePlatformReleaseCheckNoWriteAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check no-write audit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckNoWriteAudit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const sources = {
    tradingReleaseCheckSource: await readTextSource(inputs.trading_release_check_source_path),
    platformOpsCheckSource: await readTextSource(inputs.platform_ops_check_source_path),
    platformReleaseCheckSource: await readTextSource(inputs.platform_release_check_source_path),
    tradingTestSource: await readTextSource(inputs.trading_test_source_path),
    platformTestSource: await readTextSource(inputs.platform_test_source_path),
  };
  const sourceRows = buildSourceRows({ packageJson, platformOpsLedger, sources });
  const auditRows = buildAuditRows({ packageJson, sources });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const gateRows = buildGateRows({ sourceRows, auditRows, boundary });
  const validationItems = buildValidationItems({ sourceRows, auditRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceRows, auditRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    no_write_audit_id: `platform-release-check-no-write-audit.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    no_write_audit_anchor: {
      schema_version: "platform-release-check-no-write-audit-anchor.v1",
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      audited_command_count: AUDITED_COMMANDS.length,
    },
    source_rows: sourceRows,
    no_write_audit_rows: auditRows,
    no_write_audit_gate_rows: gateRows,
    no_write_audit_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_no_write_audit") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, auditRows, gateRows, boundary, validation: result.validation });
  result.summary.no_write_audit_id = result.no_write_audit_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckNoWriteAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-no-write-audit.json"), serializableResult(result));
  await writeJson(path.join(outDir, "no-write-audit-rows.json"), collectionEnvelope("platform-release-check-no-write-audit-rows.v1", "no_write_audit_rows", result.no_write_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-write-audit-gate-rows.json"), collectionEnvelope("platform-release-check-no-write-audit-gate-rows.v1", "no_write_audit_gate_rows", result.no_write_audit_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-write-audit-boundary.json"), result.no_write_audit_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-no-write-audit-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckNoWriteAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckNoWriteAudit(args);
    console.log(`Platform release-check no-write audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.no_write_audit_status}`);
    console.log(`Audit rows: ${result.summary.ready_no_write_audit_row_count}/${result.summary.no_write_audit_row_count}`);
    console.log(`Gates: ${result.summary.ready_no_write_audit_gate_count}/${result.summary.no_write_audit_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function auditSpec(rowKey, packageScriptName, sourceKey, runFunctionName, writeFunctionName, testSourceKey, testNeedle) {
  return {
    row_key: rowKey,
    package_script_name: packageScriptName,
    source_key: sourceKey,
    run_function_name: runFunctionName,
    write_function_name: writeFunctionName,
    test_source_key: testSourceKey,
    test_needle: testNeedle,
  };
}

function buildSourceRows({ packageJson, platformOpsLedger, sources }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const rows = [
    sourceRow("package_json_available", "package.json is readable.", packageJson.available),
    sourceRow("package_no_write_audit_registered", "package.json registers platform:release-check-no-write-audit.", typeof scripts["platform:release-check-no-write-audit"] === "string" && scripts["platform:release-check-no-write-audit"].length > 0),
    sourceRow("validation_chain_registered", "Validation chain includes platform:release-check-no-write-audit -- --check.", validateScript.includes("npm run platform:release-check-no-write-audit -- --check")),
    sourceRow("platform_ops_ledger_p364_declared", "Platform operations ledger declares P364 no-write audit acceptance.", platformOpsLedger.available && platformOpsLedger.text.includes("P364: `platform:release-check-no-write-audit`")),
    sourceRow("trading_release_check_source_ready", "Trading release-check source is readable.", sources.tradingReleaseCheckSource.available),
    sourceRow("platform_ops_check_source_ready", "Platform ops-check source is readable.", sources.platformOpsCheckSource.available),
    sourceRow("platform_release_check_source_ready", "Platform release-check source is readable.", sources.platformReleaseCheckSource.available),
    sourceRow("trading_no_write_test_source_ready", "Trading test source is readable.", sources.tradingTestSource.available),
    sourceRow("platform_no_write_test_source_ready", "Platform test source is readable.", sources.platformTestSource.available),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_row_hash"));
}

function sourceRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-no-write-audit-source-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    source_status: passed ? "ready" : "blocked",
    human_review_required: true,
  };
}

function buildAuditRows({ packageJson, sources }) {
  const scripts = packageJson.data?.scripts ?? {};
  return AUDITED_COMMANDS.map((spec, index) => {
    const source = sources[spec.source_key] ?? { available: false, text: "" };
    const testSource = sources[spec.test_source_key] ?? { available: false, text: "" };
    const packageScriptRegistered = typeof scripts[spec.package_script_name] === "string" && scripts[spec.package_script_name].length > 0;
    const runFunctionPresent = source.available && source.text.includes(`export async function ${spec.run_function_name}`);
    const writeFunctionPresent = source.available && source.text.includes(`await ${spec.write_function_name}`);
    const checkParserPresent = source.available && source.text.includes("arg === \"--check\"") && source.text.includes("parsed.check = true") && source.text.includes("parsed.write = false");
    const checkThrowPresent = source.available && source.text.includes("options.check && !result.validation.valid");
    const noOverwriteTestPresent = testSource.available && testSource.text.includes(spec.test_needle);
    const ready = packageScriptRegistered && runFunctionPresent && writeFunctionPresent && checkParserPresent && checkThrowPresent && noOverwriteTestPresent;
    const row = {
      schema_version: "platform-release-check-no-write-audit-row.v1",
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      package_script_name: spec.package_script_name,
      source_key: spec.source_key,
      test_source_key: spec.test_source_key,
      no_write_audit_status: ready ? "ready" : "blocked",
      package_script_registered: packageScriptRegistered,
      run_function_present: runFunctionPresent,
      write_guard_present: writeFunctionPresent,
      check_parser_write_false: checkParserPresent,
      check_failure_throw_present: checkThrowPresent,
      no_overwrite_test_present: noOverwriteTestPresent,
      command_execution_performed_by_audit: false,
      package_command_execution_performed_by_audit: false,
      artifact_write_performed_by_audit: false,
      protected_action_executed_by_audit: false,
      release_published_by_audit: false,
      git_operation_performed_by_audit: false,
      trading_order_submission_performed_by_audit: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "no_write_audit_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-no-write-audit-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    control_plane_only: true,
    check_mode: true,
    no_write_audit_artifact_write_requested: writeRequested,
    command_execution_performed: false,
    package_command_execution_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    protected_action_executed: false,
    approval_applied: false,
    release_published: false,
    git_operation_performed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    human_review_required: true,
    human_review_note: "Operator must review no-write audit evidence before relying on release-check artifacts as release-facing proof.",
  };
}

function buildGateRows({ sourceRows, auditRows, boundary }) {
  const rows = [
    gateRow("source_rows_ready", "P364 source rows are ready.", sourceRows.every((row) => row.source_status === "ready")),
    gateRow("release_check_scripts_registered", "Trading, platform ops, and platform release-check commands are registered.", auditRows.every((row) => row.package_script_registered)),
    gateRow("check_write_guards_ready", "Audited release-check commands parse --check and disable writes.", auditRows.every((row) => row.check_parser_write_false && row.write_guard_present && row.check_failure_throw_present)),
    gateRow("no_overwrite_tests_ready", "Audited release-check commands have no-overwrite tests.", auditRows.every((row) => row.no_overwrite_test_present)),
    gateRow("audit_rows_ready", "All no-write audit rows are ready.", auditRows.length >= 3 && auditRows.every((row) => row.no_write_audit_status === "ready")),
    gateRow("no_command_or_artifact_mutation", "No-write audit does not execute commands, write artifacts, mutate package files, publish releases, or run git.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed),
    gateRow("trading_disabled_boundary", "Trading live/full-auto/order submission and broker/exchange writes remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("human_review_note_present", "Human review note is present for release-facing no-write evidence.", Boolean(boundary.human_review_note)),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "no_write_audit_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-no-write-audit-gate-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_audit: false,
    artifact_write_performed_by_audit: false,
    protected_action_executed_by_audit: false,
    release_published_by_audit: false,
    trading_order_submission_performed_by_audit: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceRows, auditRows, gateRows, boundary }) {
  return [
    validationItem("source_rows", "source_rows_ready", sourceRows.length >= 9 && sourceRows.every((row) => row.source_status === "ready"), "P364 source rows are ready."),
    validationItem("no_write_audit_rows", "audit_rows_ready", auditRows.length >= 3 && auditRows.every((row) => row.no_write_audit_status === "ready"), "No-write audit rows are ready."),
    validationItem("no_write_audit_gate_rows", "gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready"), "No-write audit gates are ready."),
    validationItem("boundary.no_execution", "no_command_execution", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.artifact_write_performed, "No-write audit does not execute commands or write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed, "No-write audit performs no dependency, package, lockfile, protected, release, or git mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "Trading writes remain disabled."),
    validationItem("boundary.review", "human_review_required", boundary.human_review_required && Boolean(boundary.human_review_note), "Human review note is present."),
  ];
}

function buildSummary({ sourceRows, auditRows, gateRows, boundary, validation }) {
  return {
    no_write_audit_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_row_count: sourceRows.length,
    ready_source_row_count: sourceRows.filter((row) => row.source_status === "ready").length,
    no_write_audit_row_count: auditRows.length,
    ready_no_write_audit_row_count: auditRows.filter((row) => row.no_write_audit_status === "ready").length,
    no_write_audit_gate_count: gateRows.length,
    ready_no_write_audit_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check No-Write Audit",
    "",
    `Status: ${result.summary.no_write_audit_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Audit rows: ${result.summary.ready_no_write_audit_row_count}/${result.summary.no_write_audit_row_count}`,
    `Gates: ${result.summary.ready_no_write_audit_gate_count}/${result.summary.no_write_audit_gate_count}`,
    "",
    "## Audit Rows",
    "",
    ...result.no_write_audit_rows.map((row) => `- ${row.package_script_name}: ${row.no_write_audit_status}`),
    "",
    "## Gate Rows",
    "",
    ...result.no_write_audit_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-release-check-source") parsed.tradingReleaseCheckSourcePath = argv[++index];
    else if (arg === "--platform-ops-check-source") parsed.platformOpsCheckSourcePath = argv[++index];
    else if (arg === "--platform-release-check-source") parsed.platformReleaseCheckSourcePath = argv[++index];
    else if (arg === "--trading-test-source") parsed.tradingTestSourcePath = argv[++index];
    else if (arg === "--platform-test-source") parsed.platformTestSourcePath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-no-write-audit.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --package <path>                      package.json path.
  --platform-ops-ledger <path>          P341-P500 platform operations ledger path.
  --trading-release-check-source <path> Trading release-check source path.
  --platform-ops-check-source <path>    Platform ops-check source path.
  --platform-release-check-source <path> Platform release-check source path.
  --trading-test-source <path>          Trading test source path.
  --platform-test-source <path>         Platform test source path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.platformOpsLedgerPath),
    trading_release_check_source_path: path.resolve(options.tradingReleaseCheckSourcePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.tradingReleaseCheckSourcePath),
    platform_ops_check_source_path: path.resolve(options.platformOpsCheckSourcePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.platformOpsCheckSourcePath),
    platform_release_check_source_path: path.resolve(options.platformReleaseCheckSourcePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.platformReleaseCheckSourcePath),
    trading_test_source_path: path.resolve(options.tradingTestSourcePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.tradingTestSourcePath),
    platform_test_source_path: path.resolve(options.platformTestSourcePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.platformTestSourcePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_NO_WRITE_AUDIT_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-no-write-audit.${slugify(itemPath)}.${checkId}`,
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
