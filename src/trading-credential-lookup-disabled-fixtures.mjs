import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS,
  buildTradingLiveAdapterDisabledFixtures,
} from "./trading-live-adapter-disabled-fixtures.mjs";

export const DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-credential-lookup-disabled-fixtures/latest";
export const DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS,
  liveAdapterDisabledFixturesSchemaPath: DEFAULT_TRADING_LIVE_ADAPTER_DISABLED_FIXTURES_INPUTS.schemaPath,
  researchBacktestPaperPath: "examples/trading/research-backtest-paper-sample.json",
  schemaPath: "schemas/trading/trading-credential-lookup-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-credential-lookup-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.credential_lookup_disabled_fixtures";
const PHASE_SLOT = "P385";
const PREVIOUS_PHASE_SLOT = "P384";
const NEXT_PHASE_SLOT = "P386";
const READY_STATUS = "ready_for_trading_credential_lookup_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "credential_broker_lookup_disabled",
  "secret_plaintext_model_context_blocked",
  "market_vendor_credentials_disabled",
  "paper_shadow_credentials_disabled",
  "limited_full_auto_credentials_disabled",
  "research_pack_plaintext_policy_forbidden",
];

export async function runTradingCredentialLookupDisabledFixtures(options = {}) {
  const result = await buildTradingCredentialLookupDisabledFixtures(options);
  if (options.write !== false) await writeTradingCredentialLookupDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading credential lookup disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingCredentialLookupDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const liveAdapterDisabledFixtures = await buildTradingLiveAdapterDisabledFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    routeInventoryFixturesSchemaPath: inputs.route_inventory_fixtures_schema_path,
    approvalAbsenceFixturesSchemaPath: inputs.approval_absence_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.live_adapter_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const marketDataFeatureStore = await readJsonSource(inputs.market_data_feature_store_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const credentialAnchor = buildCredentialAnchor({ liveAdapterDisabledFixtures });
  const credentialEvidenceRows = buildCredentialEvidenceRows({
    executionEngine: executionEngine.data,
    marketDataFeatureStore: marketDataFeatureStore.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    researchBacktestPaper: researchBacktestPaper.data,
  });
  const credentialFixtureRows = buildCredentialFixtureRows(credentialEvidenceRows);
  const credentialBoundary = buildCredentialBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
  });
  const credentialGateRows = buildCredentialGateRows({
    liveAdapterDisabledFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, researchBacktestPaper],
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    boundary: credentialBoundary,
  });
  const validationItems = buildValidationItems({
    liveAdapterDisabledFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, researchBacktestPaper],
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    liveAdapterDisabledFixtures,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_credential_lookup_disabled_fixtures_id: `trading-credential-lookup-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    credential_lookup_disabled_anchor: credentialAnchor,
    credential_lookup_disabled_evidence_rows: credentialEvidenceRows,
    credential_lookup_disabled_fixture_rows: credentialFixtureRows,
    credential_lookup_disabled_gate_rows: credentialGateRows,
    credential_lookup_disabled_boundary: credentialBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_credential_lookup_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    liveAdapterDisabledFixtures,
    evidenceRows: credentialEvidenceRows,
    fixtureRows: credentialFixtureRows,
    gateRows: credentialGateRows,
    boundary: credentialBoundary,
    validation: result.validation,
  });
  result.summary.trading_credential_lookup_disabled_fixtures_id = result.trading_credential_lookup_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingCredentialLookupDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-credential-lookup-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "credential-lookup-disabled-evidence-rows.json"), collectionEnvelope("trading-credential-lookup-disabled-evidence-rows.v1", "credential_lookup_disabled_evidence_rows", result.credential_lookup_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "credential-lookup-disabled-fixture-rows.json"), collectionEnvelope("trading-credential-lookup-disabled-fixture-rows.v1", "credential_lookup_disabled_fixture_rows", result.credential_lookup_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "credential-lookup-disabled-gate-rows.json"), collectionEnvelope("trading-credential-lookup-disabled-gate-rows.v1", "credential_lookup_disabled_gate_rows", result.credential_lookup_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "credential-lookup-disabled-boundary.json"), result.credential_lookup_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-credential-lookup-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingCredentialLookupDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingCredentialLookupDisabledFixtures(args);
    console.log(`Trading credential lookup disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_credential_lookup_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe credential signals: ${result.summary.unsafe_credential_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCredentialAnchor({ liveAdapterDisabledFixtures }) {
  return {
    schema_version: "trading-credential-lookup-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_live_adapter_disabled_fixtures_id: liveAdapterDisabledFixtures.trading_live_adapter_disabled_fixtures_id,
    source_live_adapter_disabled_status: liveAdapterDisabledFixtures.summary.trading_live_adapter_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: liveAdapterDisabledFixtures.trading_live_adapter_disabled_fixtures_id,
      status: liveAdapterDisabledFixtures.summary.trading_live_adapter_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildCredentialEvidenceRows({ executionEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, researchBacktestPaper }) {
  const rows = [
    credentialEvidenceRow("credential_broker_lookup_disabled", "execution_engine", "credential_broker_contract", [
      observedCondition("credential_broker_contract.plaintext_secret_allowed", valueAt(executionEngine, ["credential_broker_contract", "plaintext_secret_allowed"]), false),
      observedCondition("credential_broker_contract.model_context_secret_allowed", valueAt(executionEngine, ["credential_broker_contract", "model_context_secret_allowed"]), false),
      observedCondition("credential_broker_contract.credential_lookup_allowed", valueAt(executionEngine, ["credential_broker_contract", "credential_lookup_allowed"]), false),
      observedCondition("credential_broker_contract.credential_reference_format", valueAt(executionEngine, ["credential_broker_contract", "credential_reference_format"]), "credential_ref.disabled"),
    ]),
    credentialEvidenceRow("secret_plaintext_model_context_blocked", "execution_engine", "secret_handling", [
      observedCondition("safety_boundary.secret_logged", valueAt(executionEngine, ["safety_boundary", "secret_logged"]), false),
      observedCondition("secret_handling.secret_never_logged", valueAt(executionEngine, ["secret_handling", "secret_never_logged"]), true),
      observedCondition("secret_handling.redaction_required", valueAt(executionEngine, ["secret_handling", "redaction_required"]), true),
      observedCondition("secret_handling.forbidden_log_fields.api_key", arrayIncludes(valueAt(executionEngine, ["secret_handling", "forbidden_log_fields"]), "api_key"), true),
      observedCondition("secret_handling.forbidden_log_fields.secret", arrayIncludes(valueAt(executionEngine, ["secret_handling", "forbidden_log_fields"]), "secret"), true),
      observedCondition("secret_handling.forbidden_log_fields.token", arrayIncludes(valueAt(executionEngine, ["secret_handling", "forbidden_log_fields"]), "token"), true),
      observedCondition("secret_handling.forbidden_log_fields.credential_value", arrayIncludes(valueAt(executionEngine, ["secret_handling", "forbidden_log_fields"]), "credential_value"), true),
    ]),
    credentialEvidenceRow("market_vendor_credentials_disabled", "market_data_feature_store", "vendor_abstraction", [
      observedCondition("safety_boundary.external_api_keys_required", valueAt(marketDataFeatureStore, ["safety_boundary", "external_api_keys_required"]), false),
      observedCondition("vendor_abstraction.live_vendor_calls_allowed", valueAt(marketDataFeatureStore, ["vendor_abstraction", "live_vendor_calls_allowed"]), false),
      observedCondition("vendor_abstraction.credentials_required", valueAt(marketDataFeatureStore, ["vendor_abstraction", "credentials_required"]), false),
      observedCondition("import_adapters.credentials_required", (valueAt(marketDataFeatureStore, ["import_adapters"]) ?? []).some((adapter) => adapter.credential_required === true), false),
    ]),
    credentialEvidenceRow("paper_shadow_credentials_disabled", "paper_shadow_live", "read_only_live_data_adapter", [
      observedCondition("safety_boundary.credential_required", valueAt(paperShadow, ["safety_boundary", "credential_required"]), false),
      observedCondition("read_only_live_data_adapter.credentials_required", valueAt(paperShadow, ["read_only_live_data_adapter", "credentials_required"]), false),
      observedCondition("read_only_live_data_adapter.external_network_required", valueAt(paperShadow, ["read_only_live_data_adapter", "external_network_required"]), false),
      observedCondition("read_only_live_data_adapter.order_routes_enabled", valueAt(paperShadow, ["read_only_live_data_adapter", "order_routes_enabled"]), false),
    ]),
    credentialEvidenceRow("limited_full_auto_credentials_disabled", "limited_full_auto_governance", "safety_boundary_and_failover", [
      observedCondition("limited_live.safety_boundary.credential_required", valueAt(limitedLive, ["safety_boundary", "credential_required"]), false),
      observedCondition("limited_live.safety_boundary.broker_write_allowed", valueAt(limitedLive, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("limited_live.safety_boundary.exchange_write_allowed", valueAt(limitedLive, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.external_service_allowed", valueAt(fullAuto, ["safety_boundary", "external_service_allowed"]), false),
      observedCondition("full_auto.failover_policies.data_vendor_failover.external_network_allowed", valueAt(fullAuto, ["failover_policies", "data_vendor_failover", "external_network_allowed"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.live_adapter_required", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "live_adapter_required"]), false),
    ]),
    credentialEvidenceRow("research_pack_plaintext_policy_forbidden", "research_backtest_paper", "safety_policy", [
      observedCondition("safety_policy.credential_storage_policy", valueAt(researchBacktestPaper, ["safety_policy", "credential_storage_policy"]), "forbidden_plaintext"),
      observedCondition("safety_policy.api_keys_in_model_context_allowed", valueAt(researchBacktestPaper, ["safety_policy", "api_keys_in_model_context_allowed"]), false),
      observedCondition("safety_policy.real_broker_adapters_enabled", valueAt(researchBacktestPaper, ["safety_policy", "real_broker_adapters_enabled"]), false),
      observedCondition("contract_examples.trading-execution.secret_logged", valueAt(researchBacktestPaper, ["contract_examples", "trading-execution", "secret_logged"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "credential_lookup_disabled_evidence_hash"));
}

function credentialEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-credential-lookup-disabled-evidence-row.v1",
    credential_lookup_disabled_evidence_row_id: `trading-credential-lookup-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_credential_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "credential_lookup_disabled" : "unsafe_or_incomplete",
    human_review_required: true,
  };
}

function observedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string",
    unsafe_when_not_safe: true,
  };
}

function buildCredentialFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-credential-lookup-disabled-fixture-row.v1",
      credential_lookup_disabled_fixture_row_id: `trading-credential-lookup-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_credential_lookup_enabled: false,
      unsafe_credential_signal_detected: evidenceRow?.unsafe_credential_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_lookup_enabled: true,
      fixture_should_fail_when_plaintext_allowed: true,
      fixture_should_fail_when_model_context_allowed: true,
      fixture_status: evidenceRow?.evidence_status === "credential_lookup_disabled" ? "passed" : "failed",
      credential_lookup_enabled_by_fixture: false,
      plaintext_secret_allowed_by_fixture: false,
      model_context_secret_allowed_by_fixture: false,
      external_api_key_required_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "credential_lookup_disabled_fixture_hash");
  });
}

function buildCredentialBoundary({ generatedAt, writeRequested, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_credential_signal_detected);
  return {
    schema_version: "trading-credential-lookup-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    credential_lookup_disabled_artifact_write_requested: writeRequested,
    credential_lookup_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    credential_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_credential_signal_count: unsafeRows.length,
    unsafe_credential_signal_refs: unsafeRows.map((row) => row.row_key),
    credential_lookup_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "credential_lookup_disabled"),
    credential_lookup_enabled: observedUnsafeCondition(evidenceRows, "credential_broker_contract.credential_lookup_allowed"),
    plaintext_secret_allowed: observedUnsafeCondition(evidenceRows, "credential_broker_contract.plaintext_secret_allowed"),
    model_context_secret_allowed: observedUnsafeCondition(evidenceRows, "credential_broker_contract.model_context_secret_allowed") || observedUnsafeCondition(evidenceRows, "safety_policy.api_keys_in_model_context_allowed"),
    external_api_keys_required: observedUnsafeCondition(evidenceRows, "safety_boundary.external_api_keys_required"),
    credentials_required: observedUnsafeCondition(evidenceRows, "vendor_abstraction.credentials_required") || observedUnsafeCondition(evidenceRows, "read_only_live_data_adapter.credentials_required") || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.credential_required"),
    secret_logged: observedUnsafeCondition(evidenceRows, "safety_boundary.secret_logged") || observedUnsafeCondition(evidenceRows, "contract_examples.trading-execution.secret_logged"),
    trading_live_enabled: false,
    trading_order_submission_allowed: false,
    live_adapter_enabled: false,
    broker_write_allowed: observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.broker_write_allowed"),
    exchange_write_allowed: observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.exchange_write_allowed"),
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

function buildCredentialGateRows({ liveAdapterDisabledFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p384_live_adapter_disabled_fixtures_ready", "P384 live adapter disabled fixtures source is ready.", liveAdapterDisabledFixtures.validation.valid && liveAdapterDisabledFixtures.summary.trading_live_adapter_disabled_fixtures_status === "ready_for_trading_live_adapter_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P385 trading credential lookup disabled fixtures command.", typeof scripts["trading:credential-lookup-disabled-fixtures"] === "string" && scripts["trading:credential-lookup-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P385 trading credential lookup disabled fixtures command.", validateScript.includes("npm run trading:credential-lookup-disabled-fixtures -- --check")),
    gateRow("p385_ledger_acceptance_declared", "P385 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P385: `trading:credential-lookup-disabled-fixtures`")),
    gateRow("credential_sources_readable", "Trading credential lookup disabled sources are readable.", sources.every((source) => source.available)),
    gateRow("required_credential_fixtures_declared", "All required credential lookup disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("credential_lookup_disabled", "Credential lookup, plaintext secrets, model-context secrets, external API keys, and credential requirements remain disabled.", boundary.credential_lookup_disabled_covered && boundary.unsafe_credential_signal_count === 0),
    gateRow("secret_exposure_blocked", "Secret logging, broker writes, exchange writes, live adapter activation, and order submission remain blocked.", !boundary.secret_logged && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.live_adapter_enabled && !boundary.trading_order_submission_allowed),
    gateRow("no_trading_or_artifact_mutation", "Credential lookup disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "credential_lookup_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-credential-lookup-disabled-gate-row.v1",
    credential_lookup_disabled_gate_row_id: `trading-credential-lookup-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    credential_lookup_enabled_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    model_context_secret_allowed_by_gate: false,
    external_api_key_required_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ liveAdapterDisabledFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.live_adapter_disabled_fixtures", "p384_live_adapter_disabled_fixtures_ready", liveAdapterDisabledFixtures.validation.valid && liveAdapterDisabledFixtures.summary.trading_live_adapter_disabled_fixtures_status === "ready_for_trading_live_adapter_disabled_regression", "P384 live adapter disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P385 credential lookup disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.credential_sources", "credential_sources_readable", sources.every((source) => source.available), "Trading credential lookup disabled sources are readable."),
    validationItem("credential_lookup_disabled_evidence_rows", "credential_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "credential_lookup_disabled"), "Credential lookup evidence rows must show disabled credential state."),
    validationItem("credential_lookup_disabled_fixture_rows", "required_credential_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_lookup_enabled && row.fixture_should_fail_when_plaintext_allowed), "All credential lookup disabled fixtures must pass."),
    validationItem("credential_lookup_disabled_gate_rows", "credential_lookup_disabled_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P385 credential lookup disabled gates are ready."),
    validationItem("boundary.credential_lookup_disabled", "credential_lookup_disabled", boundary.credential_lookup_disabled_covered && boundary.unsafe_credential_signal_count === 0 && !boundary.credential_lookup_enabled && !boundary.plaintext_secret_allowed && !boundary.model_context_secret_allowed && !boundary.external_api_keys_required && !boundary.credentials_required, "Credential lookup, plaintext, model-context, API key, and credential requirements must remain disabled."),
    validationItem("boundary.secret_exposure_blocked", "secret_exposure_blocked", !boundary.secret_logged && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.live_adapter_enabled && !boundary.trading_order_submission_allowed, "Secret exposure, broker writes, exchange writes, live adapter activation, and order submission remain blocked."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P385 credential lookup disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ liveAdapterDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_credential_lookup_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_live_adapter_disabled_status: liveAdapterDisabledFixtures.summary.trading_live_adapter_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_credential_signal_count: boundary.unsafe_credential_signal_count,
    credential_lookup_disabled_covered: boundary.credential_lookup_disabled_covered,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    external_api_keys_required: boundary.external_api_keys_required,
    credentials_required: boundary.credentials_required,
    secret_logged: boundary.secret_logged,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    live_adapter_enabled: boundary.live_adapter_enabled,
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
    "# Trading Credential Lookup Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_credential_lookup_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source live adapter disabled: ${result.summary.source_live_adapter_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe credential signals: ${result.summary.unsafe_credential_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.credential_lookup_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.credential_lookup_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-credential-lookup-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_CREDENTIAL_LOOKUP_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-credential-lookup-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
