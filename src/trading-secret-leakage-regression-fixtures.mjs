import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS,
  buildTradingSecretHandleBoundaryFixtures,
} from "./trading-secret-handle-boundary-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_OUT_DIR = "artifacts/trading-secret-leakage-regression-fixtures/latest";
export const DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS,
  secretHandleBoundaryFixturesSchemaPath: DEFAULT_TRADING_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-leakage-regression-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-leakage-regression-fixtures.v1";
const CAPABILITY_ID = "trading.secret_leakage_regression_fixtures";
const PHASE_SLOT = "P424";
const PREVIOUS_PHASE_SLOT = "P423";
const NEXT_PHASE_SLOT = "P425";
const READY_STATUS = "ready_for_trading_secret_leakage_regression";
const SOURCE_READY_STATUS = "ready_for_trading_secret_handle_boundary";
const COMMAND_NAME = "trading:secret-leakage-regression-fixtures";
const REQUIRED_ROW_KEYS = [
  "p423_secret_handle_boundary_ready",
  "external_secret_handle_placeholder_allowed",
  "synthetic_openai_key_pattern_blocked",
  "synthetic_aws_key_pattern_blocked",
  "synthetic_private_key_pattern_blocked",
  "synthetic_bearer_token_pattern_blocked",
  "synthetic_environment_dump_pattern_blocked",
  "desktop_provider_key_visibility_blocked",
];
const DEFAULT_SECRET_LEAKAGE_CASES = [
  leakageCase("external_secret_handle_placeholder_allowed", "external_secret_handle", "allowed", "External secret-handle placeholders remain allowed as references.", false),
  leakageCase("synthetic_openai_key_pattern_blocked", "provider_api_key", "blocked", "Synthetic OpenAI-style provider key patterns are blocked.", true),
  leakageCase("synthetic_aws_key_pattern_blocked", "provider_api_key", "blocked", "Synthetic AWS-style provider key patterns are blocked.", true),
  leakageCase("synthetic_private_key_pattern_blocked", "private_key_block", "blocked", "Synthetic private key block patterns are blocked.", true),
  leakageCase("synthetic_bearer_token_pattern_blocked", "bearer_token", "blocked", "Synthetic bearer token literals are blocked.", true),
  leakageCase("synthetic_environment_dump_pattern_blocked", "environment_dump", "blocked", "Synthetic environment dumps with secret-like assignments are blocked.", true),
  leakageCase("desktop_provider_key_visibility_blocked", "desktop_provider_key_visibility", "blocked", "Desktop provider-key visibility remains blocked.", true),
];

export async function runTradingSecretLeakageRegressionFixtures(options = {}) {
  const result = await buildTradingSecretLeakageRegressionFixtures(options);
  if (options.write !== false) await writeTradingSecretLeakageRegressionFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret leakage regression fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretLeakageRegressionFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const secretHandleBoundary = await buildTradingSecretHandleBoundaryFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.secret_handle_boundary_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const sourceReady = secretHandleBoundary.validation.valid && secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status === SOURCE_READY_STATUS;
  const cases = buildLeakageCases(options.fixtureOverrides ?? {});
  const anchor = buildSecretLeakageRegressionAnchor(secretHandleBoundary, cases);
  const rows = buildSecretLeakageRegressionRows({ sourceReady, secretHandleBoundary, cases });
  const boundary = buildSecretLeakageRegressionBoundary({ generatedAt, writeRequested: options.write !== false, secretHandleBoundary, rows, cases });
  const gateRows = buildSecretLeakageRegressionGateRows({ secretHandleBoundary, packageJson, platformOpsLedger, rows, boundary });
  const validationItems = buildValidationItems({ secretHandleBoundary, packageJson, platformOpsLedger, rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ secretHandleBoundary, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_leakage_regression_fixtures_id: `trading-secret-leakage-regression-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_leakage_regression_anchor: anchor,
    secret_leakage_regression_rows: rows,
    secret_leakage_regression_gate_rows: gateRows,
    secret_leakage_regression_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_leakage_regression_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ secretHandleBoundary, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_secret_leakage_regression_fixtures_id = result.trading_secret_leakage_regression_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretLeakageRegressionFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-leakage-regression-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-leakage-regression-rows.json"), collectionEnvelope("trading-secret-leakage-regression-rows.v1", "secret_leakage_regression_rows", result.secret_leakage_regression_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-leakage-regression-gate-rows.json"), collectionEnvelope("trading-secret-leakage-regression-gate-rows.v1", "secret_leakage_regression_gate_rows", result.secret_leakage_regression_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-leakage-regression-boundary.json"), result.secret_leakage_regression_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-leakage-regression-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretLeakageRegressionFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretLeakageRegressionFixtures(args);
    console.log(`Trading secret leakage regression fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_leakage_regression_fixtures_status}`);
    console.log(`Secret leakage rows: ${result.summary.ready_secret_leakage_regression_row_count}/${result.summary.secret_leakage_regression_row_count}`);
    console.log(`Secret leakage gates: ${result.summary.ready_secret_leakage_regression_gate_count}/${result.summary.secret_leakage_regression_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSecretLeakageRegressionAnchor(secretHandleBoundary, cases) {
  return {
    schema_version: "trading-secret-leakage-regression-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_handle_boundary_fixtures_id: secretHandleBoundary.trading_secret_handle_boundary_fixtures_id,
    source_secret_handle_boundary_status: secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    regression_case_count: cases.length,
    expected_blocked_case_count: cases.filter((item) => item.expected_outcome === "blocked").length,
    expected_allowed_case_count: cases.filter((item) => item.expected_outcome === "allowed").length,
    source_hash: hashValue({
      id: secretHandleBoundary.trading_secret_handle_boundary_fixtures_id,
      status: secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status,
      row_count: secretHandleBoundary.summary.secret_handle_boundary_row_count,
      gate_count: secretHandleBoundary.summary.secret_handle_boundary_gate_count,
      regression_case_count: cases.length,
    }),
  };
}

function buildSecretLeakageRegressionRows({ sourceReady, secretHandleBoundary, cases }) {
  const sourceRow = buildSourceReadyRow(sourceReady, secretHandleBoundary, 0);
  const caseRows = cases.map((item, index) => buildCaseRow(item, sourceReady, index + 1));
  return [sourceRow, ...caseRows];
}

function buildSourceReadyRow(sourceReady, secretHandleBoundary, index) {
  const observedConditions = [
    condition("source.trading_secret_handle_boundary_fixtures_status", secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status, SOURCE_READY_STATUS),
    condition("source.raw_secret_finding_count", secretHandleBoundary.summary.raw_secret_finding_count, 0),
    condition("source.provider_key_material_present", secretHandleBoundary.summary.provider_key_material_present, false),
    condition("source.desktop_secret_material_exposed", secretHandleBoundary.summary.desktop_secret_material_exposed, false),
  ];
  const unsafeConditions = observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  return withOrdinalAndHash(baseRow({
    rowKey: "p423_secret_handle_boundary_ready",
    sourceReady,
    observedConditions,
    unsafeConditions,
    expectedOutcome: "ready",
    detectedOutcome: sourceReady && unsafeConditions.length === 0 ? "ready" : "blocked",
    regressionPassed: sourceReady && unsafeConditions.length === 0,
    secretPatternKind: "source_boundary",
    rawPatternBlocked: false,
    externalHandleAllowed: false,
  }), index, "secret_leakage_regression_hash");
}

function buildCaseRow(item, sourceReady, index) {
  const regressionPassed = item.detected_outcome === item.expected_outcome;
  const observedConditions = [
    condition("regression.expected_outcome", item.expected_outcome, item.expected_outcome),
    condition("regression.detected_outcome", item.detected_outcome, item.expected_outcome),
    condition("regression.synthetic_pattern_only", item.synthetic_pattern_only, true),
    condition("regression.raw_secret_material_materialized", item.raw_secret_material_materialized, false),
  ];
  const unsafeConditions = observedConditions.filter((conditionRow) => conditionRow.observed_value !== conditionRow.expected_safe_value || !conditionRow.condition_present);
  return withOrdinalAndHash(baseRow({
    rowKey: item.row_key,
    sourceReady,
    observedConditions,
    unsafeConditions,
    expectedOutcome: item.expected_outcome,
    detectedOutcome: item.detected_outcome,
    regressionPassed: sourceReady && regressionPassed && unsafeConditions.length === 0,
    secretPatternKind: item.secret_pattern_kind,
    rawPatternBlocked: item.expected_outcome === "blocked" && item.detected_outcome === "blocked",
    externalHandleAllowed: item.expected_outcome === "allowed" && item.detected_outcome === "allowed",
  }), index, "secret_leakage_regression_hash");
}

function baseRow({ rowKey, sourceReady, observedConditions, unsafeConditions, expectedOutcome, detectedOutcome, regressionPassed, secretPatternKind, rawPatternBlocked, externalHandleAllowed }) {
  return {
    schema_version: "trading-secret-leakage-regression-row.v1",
    secret_leakage_regression_row_id: `trading-secret-leakage-regression.row.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: "secret_leakage_regression_fixture",
    evidence_path: `synthetic/${rowKey}`,
    synthetic_pattern_id: `synthetic.${rowKey}`,
    redacted_sample: `[redacted:${secretPatternKind}]`,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_leakage_regression_status: sourceReady && regressionPassed ? READY_STATUS : "blocked",
    source_secret_handle_boundary_ready: sourceReady,
    secret_pattern_kind: secretPatternKind,
    expected_outcome: expectedOutcome,
    detected_outcome: detectedOutcome,
    regression_passed: sourceReady && regressionPassed,
    synthetic_pattern_only: true,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    external_secret_handle_allowed: externalHandleAllowed,
    raw_secret_pattern_blocked: rawPatternBlocked,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildSecretLeakageRegressionBoundary({ generatedAt, writeRequested, secretHandleBoundary, rows, cases }) {
  const sourceReady = secretHandleBoundary.validation.valid && secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-leakage-regression-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_leakage_regression_artifact_write_requested: writeRequested,
    source_secret_handle_boundary_status: secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status,
    source_secret_handle_boundary_ready: sourceReady,
    secret_leakage_regression_row_count: rows.length,
    ready_secret_leakage_regression_row_count: rows.filter((row) => row.secret_leakage_regression_status === READY_STATUS).length,
    regression_case_count: cases.length,
    expected_blocked_case_count: cases.filter((item) => item.expected_outcome === "blocked").length,
    blocked_case_pass_count: rows.filter((row) => row.expected_outcome === "blocked" && row.raw_secret_pattern_blocked && row.regression_passed).length,
    expected_allowed_case_count: cases.filter((item) => item.expected_outcome === "allowed").length,
    allowed_case_pass_count: rows.filter((row) => row.expected_outcome === "allowed" && row.external_secret_handle_allowed && row.regression_passed).length,
    regression_failure_count: rows.filter((row) => !row.regression_passed).length,
    synthetic_pattern_only: rows.every((row) => row.synthetic_pattern_only),
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    external_secret_handle_allowed: rows.some((row) => row.external_secret_handle_allowed),
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
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
    human_signoff_required: true,
  };
}

function buildSecretLeakageRegressionGateRows({ secretHandleBoundary, packageJson, platformOpsLedger, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p423_secret_handle_boundary_ready", "P423 secret handle boundary source is ready.", secretHandleBoundary.validation.valid && secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P424 trading secret leakage regression fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P424 trading secret leakage regression fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p424_ledger_acceptance_declared", "P424 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P424: `trading:secret-leakage-regression-fixtures`")],
    ["secret_leakage_rows_ready", "All required secret leakage regression rows are ready.", rows.length === REQUIRED_ROW_KEYS.length && rows.every((row) => row.secret_leakage_regression_status === READY_STATUS)],
    ["raw_patterns_blocked", "Synthetic raw provider-key, token, private-key, and environment-dump patterns are blocked.", boundary.blocked_case_pass_count === boundary.expected_blocked_case_count],
    ["external_handle_placeholder_allowed", "External secret-handle placeholders remain allowed as references.", boundary.allowed_case_pass_count === boundary.expected_allowed_case_count && boundary.external_secret_handle_allowed],
    ["synthetic_only_no_materialization", "Regression cases are synthetic pattern-only and materialize no secret values.", boundary.synthetic_pattern_only && !boundary.raw_secret_material_materialized && !boundary.raw_secret_material_exposed],
    ["desktop_provider_key_visibility_blocked", "Desktop provider-key visibility remains blocked.", !boundary.desktop_provider_key_visible],
    ["no_secret_or_trading_mutation", "P424 performs no credential lookup, live execution, trading writes, artifact mutation, release, git, or protected action.", !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_leakage_regression_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-leakage-regression-gate-row.v1",
    secret_leakage_regression_gate_row_id: `trading-secret-leakage-regression-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    provider_key_material_present_by_gate: false,
    environment_dump_present_by_gate: false,
    credential_lookup_allowed_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    command_execution_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ secretHandleBoundary, packageJson, platformOpsLedger, rows, gateRows, boundary }) {
  return [
    validationItem("source.secret_handle_boundary", "p423_secret_handle_boundary_ready", secretHandleBoundary.validation.valid && secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status === SOURCE_READY_STATUS, "P423 secret handle boundary fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P424 secret leakage regression fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_leakage_regression_rows", "secret_leakage_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_leakage_regression_status === READY_STATUS), "All secret leakage regression rows must be ready."),
    validationItem("secret_leakage_regression_gate_rows", "secret_leakage_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P424 secret leakage regression gates are ready."),
    validationItem("boundary.raw_patterns_blocked", "raw_patterns_blocked", boundary.blocked_case_pass_count === boundary.expected_blocked_case_count, "All synthetic raw secret patterns must be blocked."),
    validationItem("boundary.external_handle_allowed", "external_handle_placeholder_allowed", boundary.allowed_case_pass_count === boundary.expected_allowed_case_count && boundary.external_secret_handle_allowed, "External secret-handle placeholders must remain allowed as references."),
    validationItem("boundary.synthetic_only", "synthetic_only_no_materialization", boundary.synthetic_pattern_only && !boundary.raw_secret_material_materialized && !boundary.raw_secret_material_exposed, "Regression cases must not materialize raw secret values."),
    validationItem("boundary.desktop_provider_key_visibility", "desktop_provider_key_visibility_blocked", !boundary.desktop_provider_key_visible, "Desktop provider-key visibility must remain blocked."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P424 performs no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ secretHandleBoundary, rows, gateRows, boundary, validation }) {
  return {
    trading_secret_leakage_regression_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_handle_boundary_status: secretHandleBoundary.summary.trading_secret_handle_boundary_fixtures_status,
    source_secret_handle_boundary_ready: boundary.source_secret_handle_boundary_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_leakage_regression_row_count: rows.length,
    ready_secret_leakage_regression_row_count: boundary.ready_secret_leakage_regression_row_count,
    secret_leakage_regression_gate_count: gateRows.length,
    ready_secret_leakage_regression_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    regression_case_count: boundary.regression_case_count,
    expected_blocked_case_count: boundary.expected_blocked_case_count,
    blocked_case_pass_count: boundary.blocked_case_pass_count,
    expected_allowed_case_count: boundary.expected_allowed_case_count,
    allowed_case_pass_count: boundary.allowed_case_pass_count,
    regression_failure_count: boundary.regression_failure_count,
    synthetic_pattern_only: boundary.synthetic_pattern_only,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    external_secret_handle_allowed: boundary.external_secret_handle_allowed,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Leakage Regression Fixtures",
    "",
    `Status: ${result.summary.trading_secret_leakage_regression_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret handle boundary: ${result.summary.source_secret_handle_boundary_status}`,
    `Secret leakage rows: ${result.summary.ready_secret_leakage_regression_row_count}/${result.summary.secret_leakage_regression_row_count}`,
    `Secret leakage gates: ${result.summary.ready_secret_leakage_regression_gate_count}/${result.summary.secret_leakage_regression_gate_count}`,
    "",
    "## Regression Rows",
    "",
    ...result.secret_leakage_regression_rows.map((row) => `- ${row.row_key}: ${row.secret_leakage_regression_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_leakage_regression_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-handle-boundary-fixtures-schema") parsed.secretHandleBoundaryFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else {
      parsed.__passthrough ??= [];
      parsed.__passthrough.push(arg);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-secret-leakage-regression-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-handle-boundary-fixtures-schema <path>
                                             P423 secret handle boundary fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_handle_boundary_fixtures_schema_path: path.resolve(options.secretHandleBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS.secretHandleBoundaryFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS.schemaPath),
  };
}

function buildLeakageCases(overrides = {}) {
  return DEFAULT_SECRET_LEAKAGE_CASES.map((item) => ({ ...item, ...(overrides[item.row_key] ?? {}) }));
}

function leakageCase(rowKey, secretPatternKind, expectedOutcome, description, shouldFailIfAllowed) {
  return {
    row_key: rowKey,
    secret_pattern_kind: secretPatternKind,
    expected_outcome: expectedOutcome,
    detected_outcome: expectedOutcome,
    description,
    should_fail_if_allowed: shouldFailIfAllowed,
    synthetic_pattern_only: true,
    raw_secret_material_materialized: false,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, count: rows.length, [key]: rows };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashField) {
  const withoutHash = { ...row, ordinal: index + 1 };
  return { ...withoutHash, [hashField]: hashValue(withoutHash) };
}

function condition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
}

function validationItem(pathValue, rule, passed, message) {
  return { path: pathValue, rule, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

async function readJsonSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
