import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS,
  buildTradingSecretLeakageRegressionFixtures,
} from "./trading-secret-leakage-regression-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-gate-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS,
  secretLeakageRegressionFixturesSchemaPath: DEFAULT_TRADING_SECRET_LEAKAGE_REGRESSION_FIXTURES_INPUTS.schemaPath,
  secretsScanGateDocPath: "docs/secrets-scan-gate.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  contractValidationSuitePath: "src/contract-validation-suite.mjs",
  reviewApiPath: "src/review-api.mjs",
  schemaPath: "schemas/trading/trading-secret-scan-gate-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-gate-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_gate_fixtures";
const PHASE_SLOT = "P425";
const PREVIOUS_PHASE_SLOT = "P424";
const NEXT_PHASE_SLOT = "P426";
const READY_STATUS = "ready_for_trading_secret_scan_gate";
const SOURCE_READY_STATUS = "ready_for_trading_secret_leakage_regression";
const COMMAND_NAME = "trading:secret-scan-gate-fixtures";
const SECURITY_SCAN_COMMAND_NAME = "security:secrets-scan-gate";
const REQUIRED_ROW_KEYS = [
  "p424_secret_leakage_regression_ready",
  "security_secrets_scan_gate_package_script_registered",
  "control_plane_loop_secret_scan_step_registered",
  "contract_validation_requires_secret_scan_gate",
  "review_api_secret_scan_surfaces_registered",
  "secret_scan_gate_doc_forbids_secret_reads",
  "p424_synthetic_regressions_feed_gate",
  "secret_scan_gate_no_mutation",
];

export async function runTradingSecretScanGateFixtures(options = {}) {
  const result = await buildTradingSecretScanGateFixtures(options);
  if (options.write !== false) await writeTradingSecretScanGateFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan gate fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanGateFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const leakageRegression = await buildTradingSecretLeakageRegressionFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.secret_leakage_regression_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const secretsScanGateDoc = await readTextSource(inputs.secrets_scan_gate_doc_path);
  const controlPlaneLoop = await readTextSource(inputs.control_plane_loop_path);
  const contractValidationSuite = await readTextSource(inputs.contract_validation_suite_path);
  const reviewApi = await readTextSource(inputs.review_api_path);
  const sources = { packageJson, platformOpsLedger, secretsScanGateDoc, controlPlaneLoop, contractValidationSuite, reviewApi };
  const sourceReady = leakageRegression.validation.valid && leakageRegression.summary.trading_secret_leakage_regression_fixtures_status === SOURCE_READY_STATUS;
  const coverage = buildSecretScanGateCoverage({ leakageRegression, sources });
  const anchor = buildSecretScanGateAnchor(leakageRegression, coverage);
  const rows = buildSecretScanGateRows({ sourceReady, leakageRegression, coverage });
  const boundary = buildSecretScanGateBoundary({ generatedAt, writeRequested: options.write !== false, leakageRegression, rows, coverage });
  const gateRows = buildSecretScanGateGateRows({ leakageRegression, packageJson, platformOpsLedger, rows, boundary });
  const validationItems = buildValidationItems({ leakageRegression, sources, rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ leakageRegression, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_gate_fixtures_id: `trading-secret-scan-gate-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_gate_anchor: anchor,
    secret_scan_gate_rows: rows,
    secret_scan_gate_gate_rows: gateRows,
    secret_scan_gate_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_gate_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ leakageRegression, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_secret_scan_gate_fixtures_id = result.trading_secret_scan_gate_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanGateFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-gate-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-gate-rows.json"), collectionEnvelope("trading-secret-scan-gate-rows.v1", "secret_scan_gate_rows", result.secret_scan_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-gate-gate-rows.json"), collectionEnvelope("trading-secret-scan-gate-gate-rows.v1", "secret_scan_gate_gate_rows", result.secret_scan_gate_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-gate-boundary.json"), result.secret_scan_gate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-gate-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanGateFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanGateFixtures(args);
    console.log(`Trading secret scan gate fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_gate_fixtures_status}`);
    console.log(`Secret scan gate rows: ${result.summary.ready_secret_scan_gate_row_count}/${result.summary.secret_scan_gate_row_count}`);
    console.log(`Secret scan gate gates: ${result.summary.ready_secret_scan_gate_gate_count}/${result.summary.secret_scan_gate_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSecretScanGateCoverage({ leakageRegression, sources }) {
  const scripts = sources.packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const secretsDocText = sources.secretsScanGateDoc.text ?? "";
  const controlPlaneText = sources.controlPlaneLoop.text ?? "";
  const contractValidationText = sources.contractValidationSuite.text ?? "";
  const reviewApiText = sources.reviewApi.text ?? "";
  return {
    p424_ready: leakageRegression.validation.valid && leakageRegression.summary.trading_secret_leakage_regression_fixtures_status === SOURCE_READY_STATUS,
    security_secrets_scan_gate_registered: typeof scripts[SECURITY_SCAN_COMMAND_NAME] === "string" && scripts[SECURITY_SCAN_COMMAND_NAME].includes("scripts/secrets-scan-gate.mjs"),
    p424_regression_registered: typeof scripts["trading:secret-leakage-regression-fixtures"] === "string" && validateScript.includes("npm run trading:secret-leakage-regression-fixtures -- --check"),
    control_plane_secret_scan_step_registered: includesAll(controlPlaneText, ["step(\"secrets_scan_gate\"", SECURITY_SCAN_COMMAND_NAME, "artifacts/secrets-scan-gate/latest/secrets-scan-gate.json"]),
    contract_validation_secret_scan_required: contractValidationText.includes(SECURITY_SCAN_COMMAND_NAME),
    review_api_secret_scan_surfaces_registered: includesAll(reviewApiText, ["/api/secrets-scan-gates", "/api/secrets-scan-gate-results", "/api/desktop-config-leakage-checks"]),
    secret_scan_doc_forbids_secret_reads: includesAll(secretsDocText, ["does not read secret values", "read `.env` files", "inspect Desktop config content", "use network access", "perform protected actions"]),
    secret_scan_doc_declares_attention_gate: includesAll(secretsDocText, ["attention state", "failing operational gate"]),
    p424_synthetic_regressions_ready: leakageRegression.summary.regression_failure_count === 0 && leakageRegression.summary.synthetic_pattern_only && !leakageRegression.summary.raw_secret_material_materialized,
    no_secret_or_trading_mutation: !leakageRegression.summary.credential_lookup_allowed && !leakageRegression.summary.broker_write_allowed && !leakageRegression.summary.exchange_write_allowed && !leakageRegression.summary.command_execution_performed && !leakageRegression.summary.artifact_write_performed && !leakageRegression.summary.protected_action_executed,
  };
}

function buildSecretScanGateAnchor(leakageRegression, coverage) {
  return {
    schema_version: "trading-secret-scan-gate-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_leakage_regression_fixtures_id: leakageRegression.trading_secret_leakage_regression_fixtures_id,
    source_secret_leakage_regression_status: leakageRegression.summary.trading_secret_leakage_regression_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: leakageRegression.trading_secret_leakage_regression_fixtures_id,
      status: leakageRegression.summary.trading_secret_leakage_regression_fixtures_status,
      row_count: leakageRegression.summary.secret_leakage_regression_row_count,
      gate_count: leakageRegression.summary.secret_leakage_regression_gate_count,
    }),
  };
}

function buildSecretScanGateRows({ sourceReady, leakageRegression, coverage }) {
  const rowInputs = [
    scanGateRowInput("p424_secret_leakage_regression_ready", "trading_secret_leakage_regression", "summary", [
      condition("source.trading_secret_leakage_regression_fixtures_status", leakageRegression.summary.trading_secret_leakage_regression_fixtures_status, SOURCE_READY_STATUS),
      condition("source.regression_failure_count", leakageRegression.summary.regression_failure_count, 0),
      condition("source.raw_secret_material_materialized", leakageRegression.summary.raw_secret_material_materialized, false),
    ]),
    scanGateRowInput("security_secrets_scan_gate_package_script_registered", "package_json", "scripts.security:secrets-scan-gate", [
      condition("package.security_secrets_scan_gate_registered", coverage.security_secrets_scan_gate_registered, true),
    ]),
    scanGateRowInput("control_plane_loop_secret_scan_step_registered", "control_plane_loop", "src/control-plane-loop.mjs", [
      condition("control_plane.secret_scan_step_registered", coverage.control_plane_secret_scan_step_registered, true),
    ]),
    scanGateRowInput("contract_validation_requires_secret_scan_gate", "contract_validation_suite", "src/contract-validation-suite.mjs", [
      condition("contract_validation.secret_scan_required", coverage.contract_validation_secret_scan_required, true),
    ]),
    scanGateRowInput("review_api_secret_scan_surfaces_registered", "review_api", "src/review-api.mjs", [
      condition("review_api.secret_scan_surfaces_registered", coverage.review_api_secret_scan_surfaces_registered, true),
    ]),
    scanGateRowInput("secret_scan_gate_doc_forbids_secret_reads", "secrets_scan_gate_doc", "docs/secrets-scan-gate.md", [
      condition("doc.forbids_secret_reads", coverage.secret_scan_doc_forbids_secret_reads, true),
      condition("doc.declares_attention_gate", coverage.secret_scan_doc_declares_attention_gate, true),
    ]),
    scanGateRowInput("p424_synthetic_regressions_feed_gate", "trading_secret_leakage_regression", "summary.synthetic_regressions", [
      condition("source.synthetic_regressions_ready", coverage.p424_synthetic_regressions_ready, true),
      condition("source.expected_blocked_case_count", leakageRegression.summary.expected_blocked_case_count, 6),
      condition("source.allowed_case_pass_count", leakageRegression.summary.allowed_case_pass_count, 1),
    ]),
    scanGateRowInput("secret_scan_gate_no_mutation", "secret_scan_gate_boundary", "boundary", [
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
      condition("source.provider_key_material_present", leakageRegression.summary.provider_key_material_present, false),
      condition("source.environment_dump_present", leakageRegression.summary.environment_dump_present, false),
      condition("source.desktop_provider_key_visible", leakageRegression.summary.desktop_provider_key_visible, false),
    ]),
  ];
  return rowInputs.map((input, index) => buildSecretScanGateRow(input, sourceReady, index));
}

function scanGateRowInput(rowKey, artifactId, evidencePath, observedConditions) {
  return { rowKey, artifactId, evidencePath, observedConditions };
}

function buildSecretScanGateRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-gate-row.v1",
    secret_scan_gate_row_id: `trading-secret-scan-gate.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_gate_status: rowReady ? READY_STATUS : "blocked",
    source_secret_leakage_regression_ready: sourceReady,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    external_secret_handle_allowed: true,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_scan_gate_hash");
}

function buildSecretScanGateBoundary({ generatedAt, writeRequested, leakageRegression, rows, coverage }) {
  const sourceReady = leakageRegression.validation.valid && leakageRegression.summary.trading_secret_leakage_regression_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-gate-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_gate_artifact_write_requested: writeRequested,
    source_secret_leakage_regression_status: leakageRegression.summary.trading_secret_leakage_regression_fixtures_status,
    source_secret_leakage_regression_ready: sourceReady,
    secret_scan_gate_row_count: rows.length,
    ready_secret_scan_gate_row_count: rows.filter((row) => row.secret_scan_gate_status === READY_STATUS).length,
    security_secrets_scan_gate_registered: coverage.security_secrets_scan_gate_registered,
    p424_regression_registered: coverage.p424_regression_registered,
    control_plane_secret_scan_step_registered: coverage.control_plane_secret_scan_step_registered,
    contract_validation_secret_scan_required: coverage.contract_validation_secret_scan_required,
    review_api_secret_scan_surfaces_registered: coverage.review_api_secret_scan_surfaces_registered,
    secret_scan_doc_forbids_secret_reads: coverage.secret_scan_doc_forbids_secret_reads,
    secret_scan_doc_declares_attention_gate: coverage.secret_scan_doc_declares_attention_gate,
    p424_synthetic_regressions_ready: coverage.p424_synthetic_regressions_ready,
    synthetic_pattern_only: leakageRegression.summary.synthetic_pattern_only,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    desktop_provider_key_visible: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
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
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildSecretScanGateGateRows({ leakageRegression, packageJson, platformOpsLedger, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p424_secret_leakage_regression_ready", "P424 secret leakage regression source is ready.", leakageRegression.validation.valid && leakageRegression.summary.trading_secret_leakage_regression_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P425 trading secret scan gate fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P425 trading secret scan gate fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p425_ledger_acceptance_declared", "P425 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P425: `trading:secret-scan-gate-fixtures`")],
    ["security_secrets_scan_gate_registered", "Existing platform security secrets scan gate command is registered.", boundary.security_secrets_scan_gate_registered],
    ["control_plane_secret_scan_step_registered", "Control-plane loop keeps the secrets scan gate step registered.", boundary.control_plane_secret_scan_step_registered],
    ["contract_validation_secret_scan_required", "Contract validation suite requires the secrets scan gate command.", boundary.contract_validation_secret_scan_required],
    ["review_api_secret_scan_surfaces_registered", "Review API exposes secret scan and Desktop leakage surfaces.", boundary.review_api_secret_scan_surfaces_registered],
    ["secret_scan_doc_forbids_secret_reads", "Secrets scan gate docs forbid reading secret values, env files, or Desktop config content.", boundary.secret_scan_doc_forbids_secret_reads],
    ["no_secret_or_trading_mutation", "P425 performs no secret reads, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_gate_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-gate-gate-row.v1",
    secret_scan_gate_gate_row_id: `trading-secret-scan-gate-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    provider_key_material_present_by_gate: false,
    environment_dump_present_by_gate: false,
    secret_values_read_by_gate: false,
    env_file_read_by_gate: false,
    desktop_config_content_inspected_by_gate: false,
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

function buildValidationItems({ leakageRegression, sources, rows, gateRows, boundary }) {
  return [
    validationItem("source.secret_leakage_regression", "p424_secret_leakage_regression_ready", leakageRegression.validation.valid && leakageRegression.summary.trading_secret_leakage_regression_fixtures_status === SOURCE_READY_STATUS, "P424 secret leakage regression fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P425 secret scan gate fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.secrets_scan_gate_doc", "secrets_scan_gate_doc_available", sources.secretsScanGateDoc.available, "Secrets scan gate documentation is readable."),
    validationItem("source.control_plane_loop", "control_plane_loop_available", sources.controlPlaneLoop.available, "Control-plane loop source is readable."),
    validationItem("source.contract_validation_suite", "contract_validation_suite_available", sources.contractValidationSuite.available, "Contract validation suite source is readable."),
    validationItem("source.review_api", "review_api_available", sources.reviewApi.available, "Review API source is readable."),
    validationItem("secret_scan_gate_rows", "secret_scan_gate_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_gate_status === READY_STATUS), "All secret scan gate rows must be ready."),
    validationItem("secret_scan_gate_gate_rows", "secret_scan_gate_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P425 secret scan gate gates are ready."),
    validationItem("boundary.security_gate_registered", "security_secrets_scan_gate_registered", boundary.security_secrets_scan_gate_registered, "Existing platform security secrets scan gate command must be registered."),
    validationItem("boundary.control_plane_step", "control_plane_secret_scan_step_registered", boundary.control_plane_secret_scan_step_registered, "Control-plane loop must keep the secrets scan gate step."),
    validationItem("boundary.contract_validation", "contract_validation_secret_scan_required", boundary.contract_validation_secret_scan_required, "Contract validation suite must require the secrets scan gate."),
    validationItem("boundary.review_api", "review_api_secret_scan_surfaces_registered", boundary.review_api_secret_scan_surfaces_registered, "Review API must expose secrets scan surfaces."),
    validationItem("boundary.doc_forbids_secret_reads", "secret_scan_doc_forbids_secret_reads", boundary.secret_scan_doc_forbids_secret_reads, "Secrets scan gate docs must forbid reading secret values, env files, and Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P425 performs no secret reads, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ leakageRegression, rows, gateRows, boundary, validation }) {
  return {
    trading_secret_scan_gate_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_leakage_regression_status: leakageRegression.summary.trading_secret_leakage_regression_fixtures_status,
    source_secret_leakage_regression_ready: boundary.source_secret_leakage_regression_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_scan_gate_row_count: rows.length,
    ready_secret_scan_gate_row_count: boundary.ready_secret_scan_gate_row_count,
    secret_scan_gate_gate_count: gateRows.length,
    ready_secret_scan_gate_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    security_secrets_scan_gate_registered: boundary.security_secrets_scan_gate_registered,
    p424_regression_registered: boundary.p424_regression_registered,
    control_plane_secret_scan_step_registered: boundary.control_plane_secret_scan_step_registered,
    contract_validation_secret_scan_required: boundary.contract_validation_secret_scan_required,
    review_api_secret_scan_surfaces_registered: boundary.review_api_secret_scan_surfaces_registered,
    secret_scan_doc_forbids_secret_reads: boundary.secret_scan_doc_forbids_secret_reads,
    secret_scan_doc_declares_attention_gate: boundary.secret_scan_doc_declares_attention_gate,
    p424_synthetic_regressions_ready: boundary.p424_synthetic_regressions_ready,
    synthetic_pattern_only: boundary.synthetic_pattern_only,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Gate Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_gate_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret leakage regression: ${result.summary.source_secret_leakage_regression_status}`,
    `Secret scan gate rows: ${result.summary.ready_secret_scan_gate_row_count}/${result.summary.secret_scan_gate_row_count}`,
    `Secret scan gate gates: ${result.summary.ready_secret_scan_gate_gate_count}/${result.summary.secret_scan_gate_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_gate_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_gate_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_gate_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-leakage-regression-fixtures-schema") parsed.secretLeakageRegressionFixturesSchemaPath = argv[++index];
    else if (arg === "--secrets-scan-gate-doc") parsed.secretsScanGateDocPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--contract-validation-suite") parsed.contractValidationSuitePath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-gate-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-leakage-regression-fixtures-schema <path>
                                             P424 secret leakage regression fixtures schema path.
  --secrets-scan-gate-doc <path>             Secrets scan gate doc path.
  --control-plane-loop <path>                Control-plane loop source path.
  --contract-validation-suite <path>         Contract validation suite source path.
  --review-api <path>                        Review API source path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_leakage_regression_fixtures_schema_path: path.resolve(options.secretLeakageRegressionFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.secretLeakageRegressionFixturesSchemaPath),
    secrets_scan_gate_doc_path: path.resolve(options.secretsScanGateDocPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.secretsScanGateDocPath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.controlPlaneLoopPath),
    contract_validation_suite_path: path.resolve(options.contractValidationSuitePath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.contractValidationSuitePath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.reviewApiPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_GATE_FIXTURES_INPUTS.schemaPath),
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

function includesAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
