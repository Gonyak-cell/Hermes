import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildTradingApprovalAbsenceFixtures } from "./trading-approval-absence-fixtures.mjs";
import { buildTradingBrokerWriteDisabledFixtures } from "./trading-broker-write-disabled-fixtures.mjs";
import { buildTradingCredentialLookupDisabledFixtures } from "./trading-credential-lookup-disabled-fixtures.mjs";
import {
  DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS,
  buildTradingExchangeWriteDisabledFixtures,
} from "./trading-exchange-write-disabled-fixtures.mjs";
import { buildTradingLiveAdapterDisabledFixtures } from "./trading-live-adapter-disabled-fixtures.mjs";
import { buildTradingRouteInventoryFixtures } from "./trading-route-inventory-fixtures.mjs";
import { buildTradingSafetyRegressionFixtures } from "./trading-safety-regression-fixtures.mjs";

export const DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_OUT_DIR = "artifacts/trading-safety-boundary-fixtures/latest";
export const DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS,
  exchangeWriteDisabledFixturesSchemaPath: DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-safety-boundary-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-safety-boundary-fixtures.v1";
const CAPABILITY_ID = "trading.safety_boundary_fixtures";
const PHASE_SLOT = "P388";
const PREVIOUS_PHASE_SLOT = "P387";
const NEXT_PHASE_SLOT = "P389";
const READY_STATUS = "ready_for_trading_safety_boundary_regression";
const REQUIRED_LAYERS = [
  {
    row_key: "safety_regression",
    source_phase_slot: "P381",
    command_name: "trading:safety-regression-fixtures",
    status_key: "trading_safety_regression_fixtures_status",
    expected_status: "ready_for_trading_safety_regression",
    coverage_key: null,
    unsafe_count_keys: ["unsafe_flag_detected_count"],
  },
  {
    row_key: "route_inventory",
    source_phase_slot: "P382",
    command_name: "trading:route-inventory-fixtures",
    status_key: "trading_route_inventory_fixtures_status",
    expected_status: "ready_for_trading_route_inventory_regression",
    coverage_key: "disabled_routes_covered",
    unsafe_count_keys: ["active_unsafe_route_count"],
  },
  {
    row_key: "approval_absence",
    source_phase_slot: "P383",
    command_name: "trading:approval-absence-fixtures",
    status_key: "trading_approval_absence_fixtures_status",
    expected_status: "ready_for_trading_approval_absence_regression",
    coverage_key: "approval_absence_covered",
    unsafe_count_keys: ["approval_receipt_present_count", "unsafe_enablement_detected_count"],
  },
  {
    row_key: "live_adapter_disabled",
    source_phase_slot: "P384",
    command_name: "trading:live-adapter-disabled-fixtures",
    status_key: "trading_live_adapter_disabled_fixtures_status",
    expected_status: "ready_for_trading_live_adapter_disabled_regression",
    coverage_key: "live_adapter_disabled_covered",
    unsafe_count_keys: ["unsafe_adapter_signal_count"],
  },
  {
    row_key: "credential_lookup_disabled",
    source_phase_slot: "P385",
    command_name: "trading:credential-lookup-disabled-fixtures",
    status_key: "trading_credential_lookup_disabled_fixtures_status",
    expected_status: "ready_for_trading_credential_lookup_disabled_regression",
    coverage_key: "credential_lookup_disabled_covered",
    unsafe_count_keys: ["unsafe_credential_signal_count"],
  },
  {
    row_key: "broker_write_disabled",
    source_phase_slot: "P386",
    command_name: "trading:broker-write-disabled-fixtures",
    status_key: "trading_broker_write_disabled_fixtures_status",
    expected_status: "ready_for_trading_broker_write_disabled_regression",
    coverage_key: "broker_write_disabled_covered",
    unsafe_count_keys: ["unsafe_broker_write_signal_count"],
  },
  {
    row_key: "exchange_write_disabled",
    source_phase_slot: "P387",
    command_name: "trading:exchange-write-disabled-fixtures",
    status_key: "trading_exchange_write_disabled_fixtures_status",
    expected_status: "ready_for_trading_exchange_write_disabled_regression",
    coverage_key: "exchange_write_disabled_covered",
    unsafe_count_keys: ["unsafe_exchange_write_signal_count"],
  },
];
const REQUIRED_BOUNDARY_FIXTURE_KEYS = [
  "limited_live_disabled",
  "full_auto_disabled",
  "automatic_order_submission_disabled",
  "live_order_submission_disabled",
  "disabled_routes_enforced",
  "approval_absence_enforced",
  "live_adapter_disabled",
  "credential_lookup_disabled",
  "broker_write_disabled",
  "exchange_write_disabled",
  "no_trading_or_artifact_mutation",
];

export async function runTradingSafetyBoundaryFixtures(options = {}) {
  const result = await buildTradingSafetyBoundaryFixtures(options);
  if (options.write !== false) await writeTradingSafetyBoundaryFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading safety boundary fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSafetyBoundaryFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceResults = await buildSourceResults({ generatedAt, inputs });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const safetyBoundaryAnchor = buildSafetyBoundaryAnchor({ sourceResults });
  const safetyBoundaryLayerRows = buildSafetyBoundaryLayerRows(sourceResults);
  const safetyBoundary = buildSafetyBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    layerRows: safetyBoundaryLayerRows,
    sourceResults,
  });
  const safetyBoundaryFixtureRows = buildSafetyBoundaryFixtureRows(safetyBoundary);
  const safetyBoundaryGateRows = buildSafetyBoundaryGateRows({
    sourceResults,
    packageJson,
    platformOpsLedger,
    layerRows: safetyBoundaryLayerRows,
    fixtureRows: safetyBoundaryFixtureRows,
    boundary: safetyBoundary,
  });
  const validationItems = buildValidationItems({
    sourceResults,
    packageJson,
    platformOpsLedger,
    layerRows: safetyBoundaryLayerRows,
    fixtureRows: safetyBoundaryFixtureRows,
    gateRows: safetyBoundaryGateRows,
    boundary: safetyBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceResults,
    layerRows: safetyBoundaryLayerRows,
    fixtureRows: safetyBoundaryFixtureRows,
    gateRows: safetyBoundaryGateRows,
    boundary: safetyBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_safety_boundary_fixtures_id: `trading-safety-boundary-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    safety_boundary_anchor: safetyBoundaryAnchor,
    safety_boundary_layer_rows: safetyBoundaryLayerRows,
    safety_boundary_fixture_rows: safetyBoundaryFixtureRows,
    safety_boundary_gate_rows: safetyBoundaryGateRows,
    safety_boundary: safetyBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_safety_boundary_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    sourceResults,
    layerRows: safetyBoundaryLayerRows,
    fixtureRows: safetyBoundaryFixtureRows,
    gateRows: safetyBoundaryGateRows,
    boundary: safetyBoundary,
    validation: result.validation,
  });
  result.summary.trading_safety_boundary_fixtures_id = result.trading_safety_boundary_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSafetyBoundaryFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-safety-boundary-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "safety-boundary-layer-rows.json"), collectionEnvelope("trading-safety-boundary-layer-rows.v1", "safety_boundary_layer_rows", result.safety_boundary_layer_rows, result.generated_at));
  await writeJson(path.join(outDir, "safety-boundary-fixture-rows.json"), collectionEnvelope("trading-safety-boundary-fixture-rows.v1", "safety_boundary_fixture_rows", result.safety_boundary_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "safety-boundary-gate-rows.json"), collectionEnvelope("trading-safety-boundary-gate-rows.v1", "safety_boundary_gate_rows", result.safety_boundary_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "safety-boundary.json"), result.safety_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-safety-boundary-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSafetyBoundaryFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSafetyBoundaryFixtures(args);
    console.log(`Trading safety boundary fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_safety_boundary_fixtures_status}`);
    console.log(`Layers: ${result.summary.ready_layer_count}/${result.summary.layer_count}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe signals: ${result.summary.unsafe_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildSourceResults({ generatedAt, inputs }) {
  const baseOptions = {
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    routeInventoryFixturesSchemaPath: inputs.route_inventory_fixtures_schema_path,
    approvalAbsenceFixturesSchemaPath: inputs.approval_absence_fixtures_schema_path,
    liveAdapterDisabledFixturesSchemaPath: inputs.live_adapter_disabled_fixtures_schema_path,
    credentialLookupDisabledFixturesSchemaPath: inputs.credential_lookup_disabled_fixtures_schema_path,
    brokerWriteDisabledFixturesSchemaPath: inputs.broker_write_disabled_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    write: false,
  };
  return {
    safety_regression: await buildTradingSafetyRegressionFixtures({
      ...baseOptions,
      schemaPath: inputs.safety_regression_fixtures_schema_path,
    }),
    route_inventory: await buildTradingRouteInventoryFixtures({
      ...baseOptions,
      schemaPath: inputs.route_inventory_fixtures_schema_path,
    }),
    approval_absence: await buildTradingApprovalAbsenceFixtures({
      ...baseOptions,
      schemaPath: inputs.approval_absence_fixtures_schema_path,
    }),
    live_adapter_disabled: await buildTradingLiveAdapterDisabledFixtures({
      ...baseOptions,
      schemaPath: inputs.live_adapter_disabled_fixtures_schema_path,
    }),
    credential_lookup_disabled: await buildTradingCredentialLookupDisabledFixtures({
      ...baseOptions,
      schemaPath: inputs.credential_lookup_disabled_fixtures_schema_path,
    }),
    broker_write_disabled: await buildTradingBrokerWriteDisabledFixtures({
      ...baseOptions,
      schemaPath: inputs.broker_write_disabled_fixtures_schema_path,
    }),
    exchange_write_disabled: await buildTradingExchangeWriteDisabledFixtures({
      ...baseOptions,
      schemaPath: inputs.exchange_write_disabled_fixtures_schema_path,
    }),
  };
}

function buildSafetyBoundaryAnchor({ sourceResults }) {
  const exchangeWriteDisabled = sourceResults.exchange_write_disabled;
  return {
    schema_version: "trading-safety-boundary-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_exchange_write_disabled_fixtures_id: exchangeWriteDisabled.trading_exchange_write_disabled_fixtures_id,
    source_exchange_write_disabled_status: exchangeWriteDisabled.summary.trading_exchange_write_disabled_fixtures_status,
    required_layer_count: REQUIRED_LAYERS.length,
    required_layer_keys: REQUIRED_LAYERS.map((layer) => layer.row_key),
    required_boundary_fixture_count: REQUIRED_BOUNDARY_FIXTURE_KEYS.length,
    source_hash: hashValue({
      id: exchangeWriteDisabled.trading_exchange_write_disabled_fixtures_id,
      status: exchangeWriteDisabled.summary.trading_exchange_write_disabled_fixtures_status,
      layers: REQUIRED_LAYERS.map((layer) => layer.row_key),
      fixtures: REQUIRED_BOUNDARY_FIXTURE_KEYS,
    }),
  };
}

function buildSafetyBoundaryLayerRows(sourceResults) {
  return REQUIRED_LAYERS.map((layer, index) => {
    const result = sourceResults[layer.row_key];
    const summary = result.summary ?? {};
    const sourceStatus = summary[layer.status_key] ?? "missing";
    const sourceValidationValid = result.validation?.valid === true;
    const unsafeSignalCount = sumKeys(summary, layer.unsafe_count_keys);
    const coverageReady = layer.coverage_key ? summary[layer.coverage_key] === true : Number(summary.failed_fixture_count ?? 0) === 0;
    const fixturesReady = Number(summary.fixture_count ?? 0) > 0 && summary.passed_fixture_count === summary.fixture_count && Number(summary.failed_fixture_count ?? 0) === 0;
    const gatesReady = Number(summary.gate_count ?? 0) > 0 && summary.ready_gate_count === summary.gate_count;
    const layerReady = sourceValidationValid && sourceStatus === layer.expected_status && unsafeSignalCount === 0 && coverageReady && fixturesReady && gatesReady;
    const row = {
      schema_version: "trading-safety-boundary-layer-row.v1",
      safety_boundary_layer_row_id: `trading-safety-boundary.layer.${layer.row_key}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: layer.source_phase_slot,
      row_key: layer.row_key,
      command_name: layer.command_name,
      source_status: sourceStatus,
      expected_status: layer.expected_status,
      source_validation_valid: sourceValidationValid,
      source_fixture_count: Number(summary.fixture_count ?? 0),
      source_passed_fixture_count: Number(summary.passed_fixture_count ?? 0),
      source_failed_fixture_count: Number(summary.failed_fixture_count ?? 0),
      source_gate_count: Number(summary.gate_count ?? 0),
      source_ready_gate_count: Number(summary.ready_gate_count ?? 0),
      unsafe_signal_count: unsafeSignalCount,
      coverage_key: layer.coverage_key,
      coverage_ready: coverageReady,
      layer_status: layerReady ? "ready" : "blocked",
      layer_may_enable_live_trading: false,
      layer_may_enable_full_auto: false,
      layer_may_submit_orders: false,
      layer_may_write_broker: false,
      layer_may_write_exchange: false,
      layer_may_execute_protected_action: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "safety_boundary_layer_hash");
  });
}

function buildSafetyBoundary({ generatedAt, writeRequested, layerRows, sourceResults }) {
  const summaries = Object.values(sourceResults).map((result) => result.summary ?? {});
  const readyLayerCount = layerRows.filter((row) => row.layer_status === "ready").length;
  return {
    schema_version: "trading-safety-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    safety_boundary_artifact_write_requested: writeRequested,
    safety_boundary_fixture_execution_performed: false,
    required_layer_count: REQUIRED_LAYERS.length,
    layer_count: layerRows.length,
    ready_layer_count: readyLayerCount,
    blocked_layer_count: layerRows.length - readyLayerCount,
    required_boundary_fixture_count: REQUIRED_BOUNDARY_FIXTURE_KEYS.length,
    unsafe_signal_count: layerRows.reduce((sum, row) => sum + row.unsafe_signal_count, 0),
    safety_regression_covered: layerReady(layerRows, "safety_regression"),
    disabled_routes_covered: sourceResults.route_inventory.summary.disabled_routes_covered === true,
    approval_absence_covered: sourceResults.approval_absence.summary.approval_absence_covered === true,
    live_adapter_disabled_covered: sourceResults.live_adapter_disabled.summary.live_adapter_disabled_covered === true,
    credential_lookup_disabled_covered: sourceResults.credential_lookup_disabled.summary.credential_lookup_disabled_covered === true,
    broker_write_disabled_covered: sourceResults.broker_write_disabled.summary.broker_write_disabled_covered === true,
    exchange_write_disabled_covered: sourceResults.exchange_write_disabled.summary.exchange_write_disabled_covered === true,
    limited_live_enabled: anySummaryTrue(summaries, "limited_live_enabled"),
    full_auto_enabled: anySummaryTrue(summaries, "full_auto_enabled"),
    trading_live_enabled: anySummaryTrue(summaries, "trading_live_enabled"),
    trading_full_auto_enabled: anySummaryTrue(summaries, "trading_full_auto_enabled"),
    trading_order_submission_allowed: anySummaryTrue(summaries, "trading_order_submission_allowed"),
    automatic_order_submission_allowed: anySummaryTrue(summaries, "automatic_order_submission_allowed"),
    live_order_submission_allowed: anySummaryTrue(summaries, "live_order_submission_allowed"),
    real_order_submitted: anySummaryTrue(summaries, "real_order_submitted"),
    live_adapter_enabled: anySummaryTrue(summaries, "live_adapter_enabled"),
    external_network_allowed: anySummaryTrue(summaries, "external_network_allowed"),
    live_write_allowed: anySummaryTrue(summaries, "live_write_allowed"),
    credential_lookup_enabled: anySummaryTrue(summaries, "credential_lookup_enabled"),
    plaintext_secret_allowed: anySummaryTrue(summaries, "plaintext_secret_allowed"),
    model_context_secret_allowed: anySummaryTrue(summaries, "model_context_secret_allowed"),
    external_api_keys_required: anySummaryTrue(summaries, "external_api_keys_required"),
    credentials_required: anySummaryTrue(summaries, "credentials_required"),
    secret_logged: anySummaryTrue(summaries, "secret_logged"),
    approval_application_allowed: anySummaryTrue(summaries, "approval_application_allowed"),
    approval_applied: anySummaryTrue(summaries, "approval_applied"),
    broker_write_allowed: anySummaryTrue(summaries, "broker_write_allowed"),
    exchange_write_allowed: anySummaryTrue(summaries, "exchange_write_allowed"),
    live_cancel_allowed: anySummaryTrue(summaries, "live_cancel_allowed"),
    command_execution_performed: anySummaryTrue(summaries, "command_execution_performed"),
    package_command_execution_performed: anySummaryTrue(summaries, "package_command_execution_performed"),
    release_check_execution_performed: anySummaryTrue(summaries, "release_check_execution_performed"),
    artifact_write_performed: anySummaryTrue(summaries, "artifact_write_performed"),
    release_published: anySummaryTrue(summaries, "release_published"),
    git_operation_performed: anySummaryTrue(summaries, "git_operation_performed"),
    protected_action_executed: anySummaryTrue(summaries, "protected_action_executed"),
    human_review_required: true,
  };
}

function buildSafetyBoundaryFixtureRows(boundary) {
  const rows = [
    boundaryFixtureRow("limited_live_disabled", "Limited-live enablement remains false across the P381-P387 safety chain.", ["P381", "P383"], !boundary.limited_live_enabled && !boundary.trading_live_enabled, unsafeRefs(boundary, ["limited_live_enabled", "trading_live_enabled"])),
    boundaryFixtureRow("full_auto_disabled", "Full-auto enablement remains false across the P381-P387 safety chain.", ["P381", "P383"], !boundary.full_auto_enabled && !boundary.trading_full_auto_enabled, unsafeRefs(boundary, ["full_auto_enabled", "trading_full_auto_enabled"])),
    boundaryFixtureRow("automatic_order_submission_disabled", "Automatic order submission remains false.", ["P381", "P386", "P387"], !boundary.automatic_order_submission_allowed && !boundary.trading_order_submission_allowed, unsafeRefs(boundary, ["automatic_order_submission_allowed", "trading_order_submission_allowed"])),
    boundaryFixtureRow("live_order_submission_disabled", "Live order submission remains false.", ["P381", "P386", "P387"], !boundary.live_order_submission_allowed && !boundary.real_order_submitted && !boundary.live_cancel_allowed, unsafeRefs(boundary, ["live_order_submission_allowed", "real_order_submitted", "live_cancel_allowed"])),
    boundaryFixtureRow("disabled_routes_enforced", "Route inventory keeps mutating Trading routes disabled.", ["P382"], boundary.disabled_routes_covered === true, boundary.disabled_routes_covered ? [] : ["disabled_routes_covered"]),
    boundaryFixtureRow("approval_absence_enforced", "Missing approvals keep Trading enablement blocked.", ["P383"], boundary.approval_absence_covered === true && !boundary.approval_application_allowed && !boundary.approval_applied, unsafeRefs(boundary, ["approval_application_allowed", "approval_applied", "approval_absence_covered"])),
    boundaryFixtureRow("live_adapter_disabled", "Live adapters, external network, and live writes remain disabled.", ["P384"], boundary.live_adapter_disabled_covered === true && !boundary.live_adapter_enabled && !boundary.external_network_allowed && !boundary.live_write_allowed, unsafeRefs(boundary, ["live_adapter_enabled", "external_network_allowed", "live_write_allowed", "live_adapter_disabled_covered"])),
    boundaryFixtureRow("credential_lookup_disabled", "Credential lookup and secret exposure remain disabled.", ["P385"], boundary.credential_lookup_disabled_covered === true && !boundary.credential_lookup_enabled && !boundary.plaintext_secret_allowed && !boundary.model_context_secret_allowed && !boundary.external_api_keys_required && !boundary.credentials_required && !boundary.secret_logged, unsafeRefs(boundary, ["credential_lookup_enabled", "plaintext_secret_allowed", "model_context_secret_allowed", "external_api_keys_required", "credentials_required", "secret_logged", "credential_lookup_disabled_covered"])),
    boundaryFixtureRow("broker_write_disabled", "Broker writes and broker-side order side effects remain disabled.", ["P386"], boundary.broker_write_disabled_covered === true && !boundary.broker_write_allowed, unsafeRefs(boundary, ["broker_write_allowed", "broker_write_disabled_covered"])),
    boundaryFixtureRow("exchange_write_disabled", "Exchange writes and exchange-side order side effects remain disabled.", ["P387"], boundary.exchange_write_disabled_covered === true && !boundary.exchange_write_allowed, unsafeRefs(boundary, ["exchange_write_allowed", "exchange_write_disabled_covered"])),
    boundaryFixtureRow("no_trading_or_artifact_mutation", "The consolidated safety boundary does not execute commands, publish releases, run git, mutate artifacts, or execute protected actions.", ["P381", "P382", "P383", "P384", "P385", "P386", "P387"], !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, unsafeRefs(boundary, ["command_execution_performed", "package_command_execution_performed", "release_check_execution_performed", "artifact_write_performed", "release_published", "git_operation_performed", "protected_action_executed"])),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "safety_boundary_fixture_hash"));
}

function boundaryFixtureRow(rowKey, description, sourcePhaseSlots, passed, unsafeSignalRefs) {
  return {
    schema_version: "trading-safety-boundary-fixture-row.v1",
    safety_boundary_fixture_row_id: `trading-safety-boundary-fixtures.row.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    source_phase_slots: sourcePhaseSlots,
    fixture_should_fail_when_unsafe_signal_present: true,
    unsafe_signal_detected: unsafeSignalRefs.length > 0,
    unsafe_signal_refs: unsafeSignalRefs,
    fixture_status: passed ? "passed" : "failed",
    live_trading_enabled_by_fixture: false,
    full_auto_enabled_by_fixture: false,
    order_submission_allowed_by_fixture: false,
    broker_write_allowed_by_fixture: false,
    exchange_write_allowed_by_fixture: false,
    command_execution_performed_by_fixture: false,
    artifact_write_performed_by_fixture: false,
    protected_action_executed_by_fixture: false,
    human_review_required: true,
  };
}

function buildSafetyBoundaryGateRows({ sourceResults, packageJson, platformOpsLedger, layerRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p387_exchange_write_disabled_fixtures_ready", "P387 exchange write disabled fixtures source is ready.", sourceResults.exchange_write_disabled.validation.valid && sourceResults.exchange_write_disabled.summary.trading_exchange_write_disabled_fixtures_status === "ready_for_trading_exchange_write_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P388 trading safety boundary fixtures command.", typeof scripts["trading:safety-boundary-fixtures"] === "string" && scripts["trading:safety-boundary-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P388 trading safety boundary fixtures command.", validateScript.includes("npm run trading:safety-boundary-fixtures -- --check")),
    gateRow("p388_ledger_acceptance_declared", "P388 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P388: `trading:safety-boundary-fixtures`")),
    gateRow("required_safety_layers_ready", "All required P381-P387 safety fixture layers are ready.", layerRows.length === REQUIRED_LAYERS.length && layerRows.every((row) => row.layer_status === "ready")),
    gateRow("required_boundary_fixtures_pass", "All consolidated safety boundary fixtures pass.", fixtureRows.length === REQUIRED_BOUNDARY_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed")),
    gateRow("trading_enablement_disabled", "Limited-live, full-auto, automatic order submission, live order submission, and real orders remain disabled.", !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.trading_order_submission_allowed && !boundary.real_order_submitted),
    gateRow("trading_writes_disabled", "Live adapters, credential lookup, broker writes, exchange writes, and live cancel remain disabled.", !boundary.live_adapter_enabled && !boundary.credential_lookup_enabled && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.live_cancel_allowed),
    gateRow("no_trading_or_artifact_mutation", "Safety boundary fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "safety_boundary_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-safety-boundary-gate-row.v1",
    safety_boundary_gate_row_id: `trading-safety-boundary-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    live_trading_enabled_by_gate: false,
    full_auto_enabled_by_gate: false,
    order_submission_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceResults, packageJson, platformOpsLedger, layerRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.exchange_write_disabled_fixtures", "p387_exchange_write_disabled_fixtures_ready", sourceResults.exchange_write_disabled.validation.valid && sourceResults.exchange_write_disabled.summary.trading_exchange_write_disabled_fixtures_status === "ready_for_trading_exchange_write_disabled_regression", "P387 exchange write disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P388 safety boundary fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("safety_boundary_layer_rows", "required_safety_layers_ready", layerRows.length === REQUIRED_LAYERS.length && layerRows.every((row) => row.layer_status === "ready"), "All P381-P387 safety fixture layers must be ready."),
    validationItem("safety_boundary_fixture_rows", "required_boundary_fixtures_pass", fixtureRows.length === REQUIRED_BOUNDARY_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_unsafe_signal_present), "All consolidated safety boundary fixtures must pass."),
    validationItem("safety_boundary_gate_rows", "safety_boundary_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P388 safety boundary gates are ready."),
    validationItem("boundary.safety_coverage", "safety_boundary_covered", boundary.safety_regression_covered && boundary.disabled_routes_covered && boundary.approval_absence_covered && boundary.live_adapter_disabled_covered && boundary.credential_lookup_disabled_covered && boundary.broker_write_disabled_covered && boundary.exchange_write_disabled_covered, "Safety regression, routes, approvals, live adapter, credential, broker write, and exchange write coverage must be present."),
    validationItem("boundary.trading_disabled", "trading_enablement_disabled", !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.trading_order_submission_allowed && !boundary.real_order_submitted, "Trading live/full-auto/order submission and real orders remain disabled."),
    validationItem("boundary.writes_disabled", "trading_writes_disabled", !boundary.live_adapter_enabled && !boundary.external_network_allowed && !boundary.live_write_allowed && !boundary.credential_lookup_enabled && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.live_cancel_allowed, "Live adapters, credential lookup, broker/exchange writes, and live cancel remain disabled."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P388 safety boundary fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ sourceResults, layerRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_safety_boundary_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_exchange_write_disabled_status: sourceResults.exchange_write_disabled.summary.trading_exchange_write_disabled_fixtures_status,
    required_layer_count: REQUIRED_LAYERS.length,
    layer_count: layerRows.length,
    ready_layer_count: layerRows.filter((row) => row.layer_status === "ready").length,
    blocked_layer_count: layerRows.filter((row) => row.layer_status !== "ready").length,
    required_boundary_fixture_count: REQUIRED_BOUNDARY_FIXTURE_KEYS.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_signal_count: boundary.unsafe_signal_count,
    safety_regression_covered: boundary.safety_regression_covered,
    disabled_routes_covered: boundary.disabled_routes_covered,
    approval_absence_covered: boundary.approval_absence_covered,
    live_adapter_disabled_covered: boundary.live_adapter_disabled_covered,
    credential_lookup_disabled_covered: boundary.credential_lookup_disabled_covered,
    broker_write_disabled_covered: boundary.broker_write_disabled_covered,
    exchange_write_disabled_covered: boundary.exchange_write_disabled_covered,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    real_order_submitted: boundary.real_order_submitted,
    live_adapter_enabled: boundary.live_adapter_enabled,
    external_network_allowed: boundary.external_network_allowed,
    live_write_allowed: boundary.live_write_allowed,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    external_api_keys_required: boundary.external_api_keys_required,
    credentials_required: boundary.credentials_required,
    secret_logged: boundary.secret_logged,
    approval_application_allowed: boundary.approval_application_allowed,
    approval_applied: boundary.approval_applied,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    live_cancel_allowed: boundary.live_cancel_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Safety Boundary Fixtures",
    "",
    `Status: ${result.summary.trading_safety_boundary_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source exchange write disabled: ${result.summary.source_exchange_write_disabled_status}`,
    `Layers: ${result.summary.ready_layer_count}/${result.summary.layer_count}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe signals: ${result.summary.unsafe_signal_count}`,
    "",
    "## Layers",
    "",
    ...result.safety_boundary_layer_rows.map((row) => `- ${row.source_phase_slot} ${row.row_key}: ${row.layer_status}`),
    "",
    "## Fixtures",
    "",
    ...result.safety_boundary_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.safety_boundary_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_OUT_DIR, routeSourcePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--market-data-feature-store") parsed.marketDataFeatureStorePath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--route-source") parsed.routeSourcePaths.push(argv[++index]);
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--safety-regression-fixtures-schema") parsed.safetyRegressionFixturesSchemaPath = argv[++index];
    else if (arg === "--route-inventory-fixtures-schema") parsed.routeInventoryFixturesSchemaPath = argv[++index];
    else if (arg === "--approval-absence-fixtures-schema") parsed.approvalAbsenceFixturesSchemaPath = argv[++index];
    else if (arg === "--live-adapter-disabled-fixtures-schema") parsed.liveAdapterDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--credential-lookup-disabled-fixtures-schema") parsed.credentialLookupDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--broker-write-disabled-fixtures-schema") parsed.brokerWriteDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--exchange-write-disabled-fixtures-schema") parsed.exchangeWriteDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.routeSourcePaths.length === 0) delete parsed.routeSourcePaths;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-safety-boundary-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --model-improvement <path>               Model improvement artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --market-data-feature-store <path>       Market data/feature store artifact path.
  --research-backtest-paper <path>         Research/backtest/paper sample artifact path.
  --route-source <path>                    Trading route source JSON for P382 source. Repeat to override defaults.
  --release-check-receipt-closeout-schema <path>
                                           P380 receipt closeout schema path.
  --safety-regression-fixtures-schema <path>
                                           P381 safety regression fixtures schema path.
  --route-inventory-fixtures-schema <path> P382 route inventory fixtures schema path.
  --approval-absence-fixtures-schema <path>
                                           P383 approval absence fixtures schema path.
  --live-adapter-disabled-fixtures-schema <path>
                                           P384 live adapter disabled fixtures schema path.
  --credential-lookup-disabled-fixtures-schema <path>
                                           P385 credential lookup disabled fixtures schema path.
  --broker-write-disabled-fixtures-schema <path>
                                           P386 broker write disabled fixtures schema path.
  --exchange-write-disabled-fixtures-schema <path>
                                           P387 exchange write disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.schemaPath),
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

function layerReady(layerRows, rowKey) {
  return layerRows.some((row) => row.row_key === rowKey && row.layer_status === "ready");
}

function anySummaryTrue(summaries, key) {
  return summaries.some((summary) => summary[key] === true);
}

function sumKeys(summary, keys) {
  return keys.reduce((sum, key) => sum + Number(summary[key] ?? 0), 0);
}

function unsafeRefs(boundary, keys) {
  return keys.filter((key) => (key.endsWith("_covered") || key.endsWith("_disabled_covered") ? boundary[key] !== true : boundary[key] === true));
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-safety-boundary-fixtures.${slugify(itemPath)}.${checkId}`,
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
