import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS,
  buildTradingApprovalAbsenceFixtures,
} from "./trading-approval-absence-fixtures.mjs";

export const DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-live-adapter-disabled-fixtures/latest";
export const DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS,
  approvalAbsenceFixturesSchemaPath: DEFAULT_TRADING_APPROVAL_ABSENCE_FIXTURES_INPUTS.schemaPath,
  marketDataFeatureStorePath: "examples/trading/market-data-feature-store.json",
  schemaPath: "schemas/trading/trading-live-adapter-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-live-adapter-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.live_adapter_disabled_fixtures";
const PHASE_SLOT = "P384";
const PREVIOUS_PHASE_SLOT = "P383";
const NEXT_PHASE_SLOT = "P385";
const READY_STATUS = "ready_for_trading_live_adapter_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "execution_live_adapter_disabled",
  "execution_interfaces_write_disabled",
  "shadow_live_data_adapter_read_only",
  "limited_live_adapter_boundary_blocked",
  "full_auto_failover_live_adapter_not_required",
];

export async function runTradingLiveAdapterDisabledFixtures(options = {}) {
  const result = await buildTradingLiveAdapterDisabledFixtures(options);
  if (options.write !== false) await writeTradingLiveAdapterDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading live adapter disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingLiveAdapterDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const approvalAbsenceFixtures = await buildTradingApprovalAbsenceFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    routeInventoryFixturesSchemaPath: inputs.route_inventory_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.approval_absence_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const marketDataFeatureStore = await readJsonSource(inputs.market_data_feature_store_path);
  const liveAdapterAnchor = buildLiveAdapterAnchor({ approvalAbsenceFixtures });
  const liveAdapterEvidenceRows = buildLiveAdapterEvidenceRows({
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    marketDataFeatureStore: marketDataFeatureStore.data,
  });
  const liveAdapterFixtureRows = buildLiveAdapterFixtureRows(liveAdapterEvidenceRows);
  const liveAdapterBoundary = buildLiveAdapterBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    evidenceRows: liveAdapterEvidenceRows,
    fixtureRows: liveAdapterFixtureRows,
  });
  const liveAdapterGateRows = buildLiveAdapterGateRows({
    approvalAbsenceFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto, marketDataFeatureStore],
    evidenceRows: liveAdapterEvidenceRows,
    fixtureRows: liveAdapterFixtureRows,
    boundary: liveAdapterBoundary,
  });
  const validationItems = buildValidationItems({
    approvalAbsenceFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto, marketDataFeatureStore],
    evidenceRows: liveAdapterEvidenceRows,
    fixtureRows: liveAdapterFixtureRows,
    gateRows: liveAdapterGateRows,
    boundary: liveAdapterBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    approvalAbsenceFixtures,
    evidenceRows: liveAdapterEvidenceRows,
    fixtureRows: liveAdapterFixtureRows,
    gateRows: liveAdapterGateRows,
    boundary: liveAdapterBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_live_adapter_disabled_fixtures_id: `trading-live-adapter-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    live_adapter_disabled_anchor: liveAdapterAnchor,
    live_adapter_disabled_evidence_rows: liveAdapterEvidenceRows,
    live_adapter_disabled_fixture_rows: liveAdapterFixtureRows,
    live_adapter_disabled_gate_rows: liveAdapterGateRows,
    live_adapter_disabled_boundary: liveAdapterBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_live_adapter_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    approvalAbsenceFixtures,
    evidenceRows: liveAdapterEvidenceRows,
    fixtureRows: liveAdapterFixtureRows,
    gateRows: liveAdapterGateRows,
    boundary: liveAdapterBoundary,
    validation: result.validation,
  });
  result.summary.trading_live_adapter_disabled_fixtures_id = result.trading_live_adapter_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingLiveAdapterDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-live-adapter-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "live-adapter-disabled-evidence-rows.json"), collectionEnvelope("trading-live-adapter-disabled-evidence-rows.v1", "live_adapter_disabled_evidence_rows", result.live_adapter_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-adapter-disabled-fixture-rows.json"), collectionEnvelope("trading-live-adapter-disabled-fixture-rows.v1", "live_adapter_disabled_fixture_rows", result.live_adapter_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-adapter-disabled-gate-rows.json"), collectionEnvelope("trading-live-adapter-disabled-gate-rows.v1", "live_adapter_disabled_gate_rows", result.live_adapter_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-adapter-disabled-boundary.json"), result.live_adapter_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-live-adapter-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingLiveAdapterDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingLiveAdapterDisabledFixtures(args);
    console.log(`Trading live adapter disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_live_adapter_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe adapter signals: ${result.summary.unsafe_adapter_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildLiveAdapterAnchor({ approvalAbsenceFixtures }) {
  return {
    schema_version: "trading-live-adapter-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_approval_absence_fixtures_id: approvalAbsenceFixtures.trading_approval_absence_fixtures_id,
    source_approval_absence_status: approvalAbsenceFixtures.summary.trading_approval_absence_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: approvalAbsenceFixtures.trading_approval_absence_fixtures_id,
      status: approvalAbsenceFixtures.summary.trading_approval_absence_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildLiveAdapterEvidenceRows({ executionEngine, paperShadow, limitedLive, fullAuto, marketDataFeatureStore }) {
  const rows = [
    liveAdapterEvidenceRow("execution_live_adapter_disabled", "execution_engine", "adapters.live_adapter", [
      observedCondition("safety_boundary.live_adapter_enabled", valueAt(executionEngine, ["safety_boundary", "live_adapter_enabled"]), false),
      observedCondition("safety_boundary.live_execution_allowed", valueAt(executionEngine, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("adapters.live_adapter.enabled", valueAt(executionEngine, ["adapters", "live_adapter", "enabled"]), false),
      observedCondition("adapters.live_adapter.disabled_by_default", valueAt(executionEngine, ["adapters", "live_adapter", "disabled_by_default"]), true),
      observedCondition("adapters.live_adapter.external_network_allowed", valueAt(executionEngine, ["adapters", "live_adapter", "external_network_allowed"]), false),
      observedCondition("adapters.live_adapter.live_write_allowed", valueAt(executionEngine, ["adapters", "live_adapter", "live_write_allowed"]), false),
    ]),
    liveAdapterEvidenceRow("execution_interfaces_write_disabled", "execution_engine", "broker_exchange_adapter_interfaces", [
      observedCondition("broker_adapter_interface.write_methods_enabled", valueAt(executionEngine, ["broker_adapter_interface", "write_methods_enabled"]), false),
      observedCondition("crypto_exchange_adapter_interface.write_methods_enabled", valueAt(executionEngine, ["crypto_exchange_adapter_interface", "write_methods_enabled"]), false),
      observedCondition("credential_broker_contract.credential_lookup_allowed", valueAt(executionEngine, ["credential_broker_contract", "credential_lookup_allowed"]), false),
      observedCondition("adapters.sandbox.live_write_allowed", valueAt(executionEngine, ["adapters", "sandbox", "live_write_allowed"]), false),
      observedCondition("adapters.simulated_broker.live_write_allowed", valueAt(executionEngine, ["adapters", "simulated_broker", "live_write_allowed"]), false),
    ]),
    liveAdapterEvidenceRow("shadow_live_data_adapter_read_only", "paper_shadow_live", "read_only_live_data_adapter", [
      observedCondition("safety_boundary.live_execution_allowed", valueAt(paperShadow, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("safety_boundary.broker_adapter_enabled", valueAt(paperShadow, ["safety_boundary", "broker_adapter_enabled"]), false),
      observedCondition("safety_boundary.exchange_adapter_enabled", valueAt(paperShadow, ["safety_boundary", "exchange_adapter_enabled"]), false),
      observedCondition("read_only_live_data_adapter.read_only", valueAt(paperShadow, ["read_only_live_data_adapter", "read_only"]), true),
      observedCondition("read_only_live_data_adapter.credentials_required", valueAt(paperShadow, ["read_only_live_data_adapter", "credentials_required"]), false),
      observedCondition("read_only_live_data_adapter.external_network_required", valueAt(paperShadow, ["read_only_live_data_adapter", "external_network_required"]), false),
      observedCondition("read_only_live_data_adapter.order_routes_enabled", valueAt(paperShadow, ["read_only_live_data_adapter", "order_routes_enabled"]), false),
    ]),
    liveAdapterEvidenceRow("limited_live_adapter_boundary_blocked", "limited_live_governance", "halt_gates.exchange_broker_outage_halt", [
      observedCondition("safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"]), false),
      observedCondition("safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
      observedCondition("safety_boundary.broker_write_allowed", valueAt(limitedLive, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("safety_boundary.exchange_write_allowed", valueAt(limitedLive, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("halt_gates.exchange_broker_outage_halt.enabled", valueAt(limitedLive, ["halt_gates", "exchange_broker_outage_halt", "enabled"]), true),
      observedCondition("auto_cancel_stale_orders.live_cancel_allowed", valueAt(limitedLive, ["auto_cancel_stale_orders", "live_cancel_allowed"]), false),
    ]),
    liveAdapterEvidenceRow("full_auto_failover_live_adapter_not_required", "full_auto_governance", "failover_policies.broker_exchange_failover", [
      observedCondition("safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      observedCondition("safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
      observedCondition("failover_policies.broker_exchange_failover.broker_write_allowed", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "broker_write_allowed"]), false),
      observedCondition("failover_policies.broker_exchange_failover.exchange_write_allowed", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "exchange_write_allowed"]), false),
      observedCondition("failover_policies.broker_exchange_failover.live_adapter_required", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "live_adapter_required"]), false),
      observedCondition("vendor_abstraction.live_vendor_calls_allowed", valueAt(marketDataFeatureStore, ["vendor_abstraction", "live_vendor_calls_allowed"]), false),
      observedCondition("vendor_abstraction.credentials_required", valueAt(marketDataFeatureStore, ["vendor_abstraction", "credentials_required"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "live_adapter_disabled_evidence_hash"));
}

function liveAdapterEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-live-adapter-disabled-evidence-row.v1",
    live_adapter_disabled_evidence_row_id: `trading-live-adapter-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_adapter_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "live_adapter_disabled" : "unsafe_or_incomplete",
    human_review_required: true,
  };
}

function observedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean",
    unsafe_when_not_safe: true,
  };
}

function buildLiveAdapterFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-live-adapter-disabled-fixture-row.v1",
      live_adapter_disabled_fixture_row_id: `trading-live-adapter-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_live_adapter_enabled: false,
      unsafe_adapter_signal_detected: evidenceRow?.unsafe_adapter_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_live_adapter_enabled: true,
      fixture_should_fail_when_external_network_enabled: true,
      fixture_should_fail_when_live_write_allowed: true,
      fixture_status: evidenceRow?.evidence_status === "live_adapter_disabled" ? "passed" : "failed",
      live_adapter_enabled_by_fixture: false,
      external_network_allowed_by_fixture: false,
      live_write_allowed_by_fixture: false,
      broker_write_allowed_by_fixture: false,
      exchange_write_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "live_adapter_disabled_fixture_hash");
  });
}

function buildLiveAdapterBoundary({ generatedAt, writeRequested, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_adapter_signal_detected);
  return {
    schema_version: "trading-live-adapter-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    live_adapter_disabled_artifact_write_requested: writeRequested,
    live_adapter_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    live_adapter_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_adapter_signal_count: unsafeRows.length,
    unsafe_adapter_signal_refs: unsafeRows.map((row) => row.row_key),
    live_adapter_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "live_adapter_disabled"),
    live_adapter_enabled: observedUnsafeCondition(evidenceRows, "adapters.live_adapter.enabled") || observedUnsafeCondition(evidenceRows, "safety_boundary.live_adapter_enabled"),
    external_network_allowed: observedUnsafeCondition(evidenceRows, "adapters.live_adapter.external_network_allowed") || observedUnsafeCondition(evidenceRows, "read_only_live_data_adapter.external_network_required"),
    live_write_allowed: observedUnsafeCondition(evidenceRows, "adapters.live_adapter.live_write_allowed") || observedUnsafeCondition(evidenceRows, "broker_adapter_interface.write_methods_enabled") || observedUnsafeCondition(evidenceRows, "crypto_exchange_adapter_interface.write_methods_enabled"),
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    automatic_order_submission_allowed: false,
    live_order_submission_allowed: false,
    credential_lookup_enabled: observedUnsafeCondition(evidenceRows, "credential_broker_contract.credential_lookup_allowed"),
    broker_write_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.broker_write_allowed") || observedUnsafeCondition(evidenceRows, "failover_policies.broker_exchange_failover.broker_write_allowed"),
    exchange_write_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "failover_policies.broker_exchange_failover.exchange_write_allowed"),
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

function buildLiveAdapterGateRows({ approvalAbsenceFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p383_approval_absence_fixtures_ready", "P383 approval absence fixtures source is ready.", approvalAbsenceFixtures.validation.valid && approvalAbsenceFixtures.summary.trading_approval_absence_fixtures_status === "ready_for_trading_approval_absence_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P384 trading live adapter disabled fixtures command.", typeof scripts["trading:live-adapter-disabled-fixtures"] === "string" && scripts["trading:live-adapter-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P384 trading live adapter disabled fixtures command.", validateScript.includes("npm run trading:live-adapter-disabled-fixtures -- --check")),
    gateRow("p384_ledger_acceptance_declared", "P384 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P384: `trading:live-adapter-disabled-fixtures`")),
    gateRow("live_adapter_sources_readable", "Trading live adapter disabled sources are readable.", sources.every((source) => source.available)),
    gateRow("required_live_adapter_fixtures_declared", "All required live adapter disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("live_adapter_disabled", "Live adapter, external network access, and live writes remain disabled.", boundary.live_adapter_disabled_covered && boundary.unsafe_adapter_signal_count === 0),
    gateRow("broker_exchange_writes_disabled", "Broker writes, exchange writes, credential lookup, and order submission remain disabled while P384 checks live adapter state.", !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.credential_lookup_enabled && !boundary.trading_order_submission_allowed),
    gateRow("no_trading_or_artifact_mutation", "Live adapter disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "live_adapter_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-live-adapter-disabled-gate-row.v1",
    live_adapter_disabled_gate_row_id: `trading-live-adapter-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    live_adapter_enabled_by_gate: false,
    external_network_allowed_by_gate: false,
    live_write_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ approvalAbsenceFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.approval_absence_fixtures", "p383_approval_absence_fixtures_ready", approvalAbsenceFixtures.validation.valid && approvalAbsenceFixtures.summary.trading_approval_absence_fixtures_status === "ready_for_trading_approval_absence_regression", "P383 approval absence fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P384 live adapter disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.live_adapter_sources", "live_adapter_sources_readable", sources.every((source) => source.available), "Trading live adapter disabled sources are readable."),
    validationItem("live_adapter_disabled_evidence_rows", "live_adapter_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "live_adapter_disabled"), "Live adapter evidence rows must show disabled adapter state."),
    validationItem("live_adapter_disabled_fixture_rows", "required_live_adapter_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_live_adapter_enabled && row.fixture_should_fail_when_live_write_allowed), "All live adapter disabled fixtures must pass."),
    validationItem("live_adapter_disabled_gate_rows", "live_adapter_disabled_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P384 live adapter disabled gates are ready."),
    validationItem("boundary.live_adapter_disabled", "live_adapter_disabled", boundary.live_adapter_disabled_covered && boundary.unsafe_adapter_signal_count === 0 && !boundary.live_adapter_enabled && !boundary.external_network_allowed && !boundary.live_write_allowed, "Live adapter, external network, and live write signals must stay disabled."),
    validationItem("boundary.no_writes", "broker_exchange_writes_disabled", !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.credential_lookup_enabled && !boundary.trading_order_submission_allowed, "Broker writes, exchange writes, credential lookup, and order submission remain disabled."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P384 live adapter disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ approvalAbsenceFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_live_adapter_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_approval_absence_status: approvalAbsenceFixtures.summary.trading_approval_absence_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_adapter_signal_count: boundary.unsafe_adapter_signal_count,
    live_adapter_disabled_covered: boundary.live_adapter_disabled_covered,
    live_adapter_enabled: boundary.live_adapter_enabled,
    external_network_allowed: boundary.external_network_allowed,
    live_write_allowed: boundary.live_write_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
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
    "# Trading Live Adapter Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_live_adapter_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source approval absence: ${result.summary.source_approval_absence_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe adapter signals: ${result.summary.unsafe_adapter_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.live_adapter_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.live_adapter_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
    else if (arg === "--route-source") parsed.routeSourcePaths.push(argv[++index]);
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--safety-regression-fixtures-schema") parsed.safetyRegressionFixturesSchemaPath = argv[++index];
    else if (arg === "--route-inventory-fixtures-schema") parsed.routeInventoryFixturesSchemaPath = argv[++index];
    else if (arg === "--approval-absence-fixtures-schema") parsed.approvalAbsenceFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-live-adapter-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_OUT_DIR}
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
  --route-source <path>                    Trading route source JSON for P382 source. Repeat to override defaults.
  --release-check-receipt-closeout-schema <path>
                                           P380 receipt closeout schema path.
  --safety-regression-fixtures-schema <path>
                                           P381 safety regression fixtures schema path.
  --route-inventory-fixtures-schema <path> P382 route inventory fixtures schema path.
  --approval-absence-fixtures-schema <path>
                                           P383 approval absence fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.schemaPath),
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
    validation_item_id: `trading-live-adapter-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
