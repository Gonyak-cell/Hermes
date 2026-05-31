import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_BROKER_WRITE_DISABLED_FIXTURES_INPUTS,
  buildTradingBrokerWriteDisabledFixtures,
} from "./trading-broker-write-disabled-fixtures.mjs";

export const DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-exchange-write-disabled-fixtures/latest";
export const DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_BROKER_WRITE_DISABLED_FIXTURES_INPUTS,
  brokerWriteDisabledFixturesSchemaPath: DEFAULT_TRADING_BROKER_WRITE_DISABLED_FIXTURES_INPUTS.schemaPath,
  researchBacktestPaperPath: "examples/trading/research-backtest-paper-sample.json",
  schemaPath: "schemas/trading/trading-exchange-write-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-exchange-write-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.exchange_write_disabled_fixtures";
const PHASE_SLOT = "P387";
const PREVIOUS_PHASE_SLOT = "P386";
const NEXT_PHASE_SLOT = "P388";
const READY_STATUS = "ready_for_trading_exchange_write_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "execution_exchange_interface_write_disabled",
  "execution_exchange_order_submission_blocked",
  "paper_shadow_exchange_write_disabled",
  "limited_live_exchange_write_disabled",
  "limited_live_exchange_approval_gate_blocks_write",
  "full_auto_exchange_failover_write_disabled",
];

export async function runTradingExchangeWriteDisabledFixtures(options = {}) {
  const result = await buildTradingExchangeWriteDisabledFixtures(options);
  if (options.write !== false) await writeTradingExchangeWriteDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading exchange write disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingExchangeWriteDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const brokerWriteDisabledFixtures = await buildTradingBrokerWriteDisabledFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    routeInventoryFixturesSchemaPath: inputs.route_inventory_fixtures_schema_path,
    approvalAbsenceFixturesSchemaPath: inputs.approval_absence_fixtures_schema_path,
    credentialLookupDisabledFixturesSchemaPath: inputs.credential_lookup_disabled_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.broker_write_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const credentialAnchor = buildCredentialAnchor({ brokerWriteDisabledFixtures });
  const credentialEvidenceRows = buildCredentialEvidenceRows({
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const credentialFixtureRows = buildCredentialFixtureRows(credentialEvidenceRows);
  const credentialBoundary = buildCredentialBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
  });
  const credentialGateRows = buildCredentialGateRows({
    brokerWriteDisabledFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto],
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    boundary: credentialBoundary,
  });
  const validationItems = buildValidationItems({
    brokerWriteDisabledFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto],
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    brokerWriteDisabledFixtures,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_exchange_write_disabled_fixtures_id: `trading-exchange-write-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    exchange_write_disabled_anchor: credentialAnchor,
    exchange_write_disabled_evidence_rows: credentialEvidenceRows,
    exchange_write_disabled_fixture_rows: credentialFixtureRows,
    exchange_write_disabled_gate_rows: credentialGateRows,
    exchange_write_disabled_boundary: credentialBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_exchange_write_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    brokerWriteDisabledFixtures,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
    validation: result.validation,
  });
  result.summary.trading_exchange_write_disabled_fixtures_id = result.trading_exchange_write_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingExchangeWriteDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-exchange-write-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "exchange-write-disabled-evidence-rows.json"), collectionEnvelope("trading-exchange-write-disabled-evidence-rows.v1", "exchange_write_disabled_evidence_rows", result.exchange_write_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "exchange-write-disabled-fixture-rows.json"), collectionEnvelope("trading-exchange-write-disabled-fixture-rows.v1", "exchange_write_disabled_fixture_rows", result.exchange_write_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "exchange-write-disabled-gate-rows.json"), collectionEnvelope("trading-exchange-write-disabled-gate-rows.v1", "exchange_write_disabled_gate_rows", result.exchange_write_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "exchange-write-disabled-boundary.json"), result.exchange_write_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-exchange-write-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingExchangeWriteDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingExchangeWriteDisabledFixtures(args);
    console.log(`Trading exchange write disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_exchange_write_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe exchange write signals: ${result.summary.unsafe_exchange_write_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCredentialAnchor({ brokerWriteDisabledFixtures }) {
  return {
    schema_version: "trading-exchange-write-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_broker_write_disabled_fixtures_id: brokerWriteDisabledFixtures.trading_broker_write_disabled_fixtures_id,
    source_broker_write_disabled_status: brokerWriteDisabledFixtures.summary.trading_broker_write_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: brokerWriteDisabledFixtures.trading_broker_write_disabled_fixtures_id,
      status: brokerWriteDisabledFixtures.summary.trading_broker_write_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildCredentialEvidenceRows({ executionEngine, paperShadow, limitedLive, fullAuto }) {
  const rows = [
    credentialEvidenceRow("execution_exchange_interface_write_disabled", "execution_engine", "crypto_exchange_adapter_interface", [
      observedCondition("safety_boundary.exchange_write_allowed", valueAt(executionEngine, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("crypto_exchange_adapter_interface.write_methods_enabled", valueAt(executionEngine, ["crypto_exchange_adapter_interface", "write_methods_enabled"]), false),
      observedCondition("adapters.live_adapter.live_write_allowed", valueAt(executionEngine, ["adapters", "live_adapter", "live_write_allowed"]), false),
      observedCondition("adapters.simulated_broker.live_write_allowed", valueAt(executionEngine, ["adapters", "simulated_broker", "live_write_allowed"]), false),
    ]),
    credentialEvidenceRow("execution_exchange_order_submission_blocked", "execution_engine", "order_submission_boundary", [
      observedCondition("safety_boundary.real_order_submitted", valueAt(executionEngine, ["safety_boundary", "real_order_submitted"]), false),
      observedCondition("safety_boundary.live_execution_allowed", valueAt(executionEngine, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("execution_state_machine.live_submit_state_enabled", valueAt(executionEngine, ["execution_state_machine", "live_submit_state_enabled"]), false),
      observedCondition("order_controls.order_throttle.blocks_order_submission", valueAt(executionEngine, ["order_controls", "order_throttle", "blocks_order_submission"]), true),
      observedCondition("dashboard_api_stub.mutating_routes_enabled", valueAt(executionEngine, ["dashboard_api_stub", "mutating_routes_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.orders_submit", hasDisabledRoute(valueAt(executionEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders/submit"), true),
    ]),
    credentialEvidenceRow("paper_shadow_exchange_write_disabled", "paper_shadow_live", "no_order_shadow_mode", [
      observedCondition("safety_boundary.broker_adapter_enabled", valueAt(paperShadow, ["safety_boundary", "broker_adapter_enabled"]), false),
      observedCondition("safety_boundary.real_order_submitted", valueAt(paperShadow, ["safety_boundary", "real_order_submitted"]), false),
      observedCondition("no_order_shadow_mode.exchange_write_allowed", valueAt(paperShadow, ["no_order_shadow_mode", "exchange_write_allowed"]), false),
      observedCondition("no_order_shadow_mode.real_order_count", valueAt(paperShadow, ["no_order_shadow_mode", "real_order_count"]), 0),
      observedCondition("read_only_live_data_adapter.order_routes_enabled", valueAt(paperShadow, ["read_only_live_data_adapter", "order_routes_enabled"]), false),
    ]),
    credentialEvidenceRow("limited_live_exchange_write_disabled", "limited_live_governance", "safety_boundary", [
      observedCondition("limited_live.safety_boundary.exchange_write_allowed", valueAt(limitedLive, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
      observedCondition("limited_live.safety_boundary.real_order_submitted", valueAt(limitedLive, ["safety_boundary", "real_order_submitted"]), false),
      observedCondition("limited_live.order_caps.order_submission_allowed", valueAt(limitedLive, ["order_caps", "order_submission_allowed"]), false),
      observedCondition("limited_live.auto_cancel_stale_orders.live_cancel_allowed", valueAt(limitedLive, ["auto_cancel_stale_orders", "live_cancel_allowed"]), false),
    ]),
    credentialEvidenceRow("limited_live_exchange_approval_gate_blocks_write", "limited_live_governance", "approval_gate", [
      observedCondition("limited_live.approval_gate.approval_receipt_present", valueAt(limitedLive, ["approval_gate", "approval_receipt_present"]), false),
      observedCondition("limited_live.approval_gate.decision", valueAt(limitedLive, ["approval_gate", "decision"]), "blocked"),
      observedCondition("limited_live.first_trade_confirmation.blocks_first_trade", valueAt(limitedLive, ["first_trade_confirmation", "blocks_first_trade"]), true),
      observedCondition("limited_live.first_trade_confirmation.first_trade_submitted", valueAt(limitedLive, ["first_trade_confirmation", "first_trade_submitted"]), false),
    ]),
    credentialEvidenceRow("full_auto_exchange_failover_write_disabled", "full_auto_governance", "broker_exchange_failover", [
      observedCondition("full_auto.safety_boundary.exchange_write_allowed", valueAt(fullAuto, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
      observedCondition("full_auto.safety_boundary.real_order_submitted", valueAt(fullAuto, ["safety_boundary", "real_order_submitted"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.exchange_write_allowed", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "exchange_write_allowed"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.live_adapter_required", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "live_adapter_required"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.failover_target", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "failover_target"]), "paper"),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "exchange_write_disabled_evidence_hash"));
}

function credentialEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-exchange-write-disabled-evidence-row.v1",
    exchange_write_disabled_evidence_row_id: `trading-exchange-write-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_exchange_write_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "exchange_write_disabled" : "unsafe_or_incomplete",
    human_review_required: true,
  };
}

function observedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
}

function buildCredentialFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-exchange-write-disabled-fixture-row.v1",
      exchange_write_disabled_fixture_row_id: `trading-exchange-write-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_exchange_write_allowed: false,
      unsafe_exchange_write_signal_detected: evidenceRow?.unsafe_exchange_write_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_exchange_write_allowed: true,
      fixture_should_fail_when_live_order_submission_allowed: true,
      fixture_should_fail_when_real_order_submitted: true,
      fixture_status: evidenceRow?.evidence_status === "exchange_write_disabled" ? "passed" : "failed",
      exchange_write_allowed_by_fixture: false,
      live_order_submission_allowed_by_fixture: false,
      real_order_submitted_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "exchange_write_disabled_fixture_hash");
  });
}

function buildCredentialBoundary({ generatedAt, writeRequested, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_exchange_write_signal_detected);
  return {
    schema_version: "trading-exchange-write-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    exchange_write_disabled_artifact_write_requested: writeRequested,
    exchange_write_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    exchange_write_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_exchange_write_signal_count: unsafeRows.length,
    unsafe_exchange_write_signal_refs: unsafeRows.map((row) => row.row_key),
    exchange_write_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "exchange_write_disabled"),
    credential_lookup_enabled: observedUnsafeCondition(evidenceRows, "credential_broker_contract.credential_lookup_allowed"),
    live_submit_state_enabled: observedUnsafeCondition(evidenceRows, "execution_state_machine.live_submit_state_enabled"),
    live_execution_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.live_execution_allowed"),
    live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    automatic_order_submission_allowed: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    trading_live_enabled: false,
    trading_order_submission_allowed: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.order_submission_allowed") || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    real_order_submitted: observedUnsafeCondition(evidenceRows, "safety_boundary.real_order_submitted") || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.real_order_submitted") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.real_order_submitted") || observedUnsafeCondition(evidenceRows, "no_order_shadow_mode.real_order_count"),
    live_adapter_enabled: false,
    broker_write_allowed: false,
    exchange_write_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "crypto_exchange_adapter_interface.write_methods_enabled") || observedUnsafeCondition(evidenceRows, "adapters.live_adapter.live_write_allowed") || observedUnsafeCondition(evidenceRows, "adapters.simulated_broker.live_write_allowed") || observedUnsafeCondition(evidenceRows, "no_order_shadow_mode.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.exchange_write_allowed"),
    live_cancel_allowed: observedUnsafeCondition(evidenceRows, "limited_live.auto_cancel_stale_orders.live_cancel_allowed"),
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function observedUnsafeCondition(evidenceRows, conditionPath) {
  return evidenceRows
    .flatMap((row) => row.observed_conditions)
    .some((condition) => condition.condition_path === conditionPath && condition.observed_value !== condition.expected_safe_value);
}

function buildCredentialGateRows({ brokerWriteDisabledFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p386_broker_write_disabled_fixtures_ready", "P386 broker write disabled fixtures source is ready.", brokerWriteDisabledFixtures.validation.valid && brokerWriteDisabledFixtures.summary.trading_broker_write_disabled_fixtures_status === "ready_for_trading_broker_write_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P387 trading exchange write disabled fixtures command.", typeof scripts["trading:exchange-write-disabled-fixtures"] === "string" && scripts["trading:exchange-write-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P387 trading exchange write disabled fixtures command.", validateScript.includes("npm run trading:exchange-write-disabled-fixtures -- --check")),
    gateRow("p387_ledger_acceptance_declared", "P387 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P387: `trading:exchange-write-disabled-fixtures`")),
    gateRow("exchange_write_sources_readable", "Trading exchange write disabled sources are readable.", sources.every((source) => source.available)),
    gateRow("required_exchange_write_fixtures_declared", "All required exchange write disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("exchange_write_disabled", "Exchange adapter writes, live order submission, live cancel, real order submission, and exchange failover writes remain disabled.", boundary.exchange_write_disabled_covered && boundary.unsafe_exchange_write_signal_count === 0),
    gateRow("order_submission_blocked", "Exchange write disabled fixtures keep live submit state, order caps, automatic submission, and real order side effects blocked.", !boundary.live_submit_state_enabled && !boundary.trading_order_submission_allowed && !boundary.automatic_order_submission_allowed && !boundary.real_order_submitted),
    gateRow("no_trading_or_artifact_mutation", "Exchange write disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "exchange_write_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-exchange-write-disabled-gate-row.v1",
    exchange_write_disabled_gate_row_id: `trading-exchange-write-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    exchange_write_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    real_order_submitted_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ brokerWriteDisabledFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.broker_write_disabled_fixtures", "p386_broker_write_disabled_fixtures_ready", brokerWriteDisabledFixtures.validation.valid && brokerWriteDisabledFixtures.summary.trading_broker_write_disabled_fixtures_status === "ready_for_trading_broker_write_disabled_regression", "P386 broker write disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P387 exchange write disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.exchange_write_sources", "exchange_write_sources_readable", sources.every((source) => source.available), "Trading exchange write disabled sources are readable."),
    validationItem("exchange_write_disabled_evidence_rows", "exchange_write_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "exchange_write_disabled"), "Exchange write evidence rows must show disabled exchange write state."),
    validationItem("exchange_write_disabled_fixture_rows", "required_exchange_write_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_exchange_write_allowed && row.fixture_should_fail_when_live_order_submission_allowed), "All exchange write disabled fixtures must pass."),
    validationItem("exchange_write_disabled_gate_rows", "exchange_write_disabled_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P387 exchange write disabled gates are ready."),
    validationItem("boundary.exchange_write_disabled", "exchange_write_disabled", boundary.exchange_write_disabled_covered && boundary.unsafe_exchange_write_signal_count === 0 && !boundary.exchange_write_allowed && !boundary.live_order_submission_allowed && !boundary.trading_order_submission_allowed && !boundary.real_order_submitted && !boundary.live_cancel_allowed, "Exchange writes, live submission, real orders, and live cancel must remain disabled."),
    validationItem("boundary.order_submission_blocked", "order_submission_blocked", !boundary.live_submit_state_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_execution_allowed && !boundary.live_adapter_enabled, "Live submit state, automatic submission, live execution, and live adapter activation remain blocked."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P387 exchange write disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ brokerWriteDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_exchange_write_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_broker_write_disabled_status: brokerWriteDisabledFixtures.summary.trading_broker_write_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_exchange_write_signal_count: boundary.unsafe_exchange_write_signal_count,
    exchange_write_disabled_covered: boundary.exchange_write_disabled_covered,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    live_submit_state_enabled: boundary.live_submit_state_enabled,
    live_execution_allowed: boundary.live_execution_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    real_order_submitted: boundary.real_order_submitted,
    live_adapter_enabled: boundary.live_adapter_enabled,
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
    "# Trading Exchange Write Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_exchange_write_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source broker write disabled: ${result.summary.source_broker_write_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe exchange write signals: ${result.summary.unsafe_exchange_write_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.exchange_write_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.exchange_write_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
    else if (arg === "--credential-lookup-disabled-fixtures-schema") parsed.credentialLookupDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--broker-write-disabled-fixtures-schema") parsed.brokerWriteDisabledFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-exchange-write-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_OUT_DIR}
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
  --credential-lookup-disabled-fixtures-schema <path>
                                           P385 credential lookup disabled fixtures schema path.
  --broker-write-disabled-fixtures-schema <path>
                                           P386 broker write disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_EXCHANGE_WRITE_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function arrayIncludes(value, item) {
  return Array.isArray(value) && value.includes(item);
}

function hasDisabledRoute(routes, routePath) {
  return Array.isArray(routes) && routes.some((route) => route?.path === routePath);
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-exchange-write-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
