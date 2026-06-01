import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS,
  buildTradingPromotionReceiptChainSignoffCloseoutFixtures,
} from "./trading-promotion-receipt-chain-signoff-closeout-fixtures.mjs";

export const DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_OUT_DIR = "artifacts/trading-broker-adapter-separation-fixtures/latest";
export const DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS,
  promotionReceiptChainSignoffCloseoutFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS.schemaPath,
  executionEnginePath: "examples/trading/execution-engine.json",
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  limitedLivePath: "examples/trading/limited-live-governance.json",
  fullAutoPath: "examples/trading/full-auto-governance.json",
  researchBacktestPaperPath: "examples/trading/research-backtest-paper-sample.json",
  schemaPath: "schemas/trading/trading-broker-adapter-separation-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-broker-adapter-separation-fixtures.v1";
const CAPABILITY_ID = "trading.broker_adapter_separation_fixtures";
const PHASE_SLOT = "P421";
const PREVIOUS_PHASE_SLOT = "P420";
const NEXT_PHASE_SLOT = "P422";
const READY_STATUS = "ready_for_trading_broker_adapter_separation";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_signoff_closeout";
const REQUIRED_ROW_KEYS = [
  "sandbox_contract_simulation_only",
  "simulated_broker_contract_simulation_only",
  "live_adapter_contract_disabled",
  "simulated_and_live_contracts_separate",
  "default_control_plane_imports_no_live_adapter",
  "credential_secret_boundary_reference_only",
];

export async function runTradingBrokerAdapterSeparationFixtures(options = {}) {
  const result = await buildTradingBrokerAdapterSeparationFixtures(options);
  if (options.write !== false) await writeTradingBrokerAdapterSeparationFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading broker adapter separation fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingBrokerAdapterSeparationFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffCloseout = await buildTradingPromotionReceiptChainSignoffCloseoutFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.promotion_receipt_chain_signoff_closeout_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const sourceReady = signoffCloseout.validation.valid && signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status === SOURCE_READY_STATUS;
  const anchor = buildAdapterSeparationAnchor(signoffCloseout);
  const rows = buildAdapterSeparationRows({ sourceReady, executionEngine: executionEngine.data, paperShadow: paperShadow.data, limitedLive: limitedLive.data, fullAuto: fullAuto.data, researchBacktestPaper: researchBacktestPaper.data });
  const boundary = buildAdapterSeparationBoundary({ generatedAt, writeRequested: options.write !== false, signoffCloseout, rows });
  const gateRows = buildAdapterSeparationGateRows({ signoffCloseout, packageJson, platformOpsLedger, sources: [executionEngine, paperShadow, limitedLive, fullAuto, researchBacktestPaper], rows, boundary });
  const validationItems = buildValidationItems({ signoffCloseout, packageJson, platformOpsLedger, sources: [executionEngine, paperShadow, limitedLive, fullAuto, researchBacktestPaper], rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffCloseout, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_broker_adapter_separation_fixtures_id: `trading-broker-adapter-separation-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    broker_adapter_separation_anchor: anchor,
    broker_adapter_separation_rows: rows,
    broker_adapter_separation_gate_rows: gateRows,
    broker_adapter_separation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_broker_adapter_separation_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffCloseout, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_broker_adapter_separation_fixtures_id = result.trading_broker_adapter_separation_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingBrokerAdapterSeparationFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-broker-adapter-separation-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "broker-adapter-separation-rows.json"), collectionEnvelope("trading-broker-adapter-separation-rows.v1", "broker_adapter_separation_rows", result.broker_adapter_separation_rows, result.generated_at));
  await writeJson(path.join(outDir, "broker-adapter-separation-gate-rows.json"), collectionEnvelope("trading-broker-adapter-separation-gate-rows.v1", "broker_adapter_separation_gate_rows", result.broker_adapter_separation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "broker-adapter-separation-boundary.json"), result.broker_adapter_separation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-broker-adapter-separation-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingBrokerAdapterSeparationFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingBrokerAdapterSeparationFixtures(args);
    console.log(`Trading broker adapter separation fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_broker_adapter_separation_fixtures_status}`);
    console.log(`Adapter separation rows: ${result.summary.ready_adapter_separation_row_count}/${result.summary.adapter_separation_row_count}`);
    console.log(`Adapter separation gates: ${result.summary.ready_adapter_separation_gate_count}/${result.summary.adapter_separation_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAdapterSeparationAnchor(signoffCloseout) {
  return {
    schema_version: "trading-broker-adapter-separation-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_signoff_closeout_fixtures_id: signoffCloseout.trading_promotion_receipt_chain_signoff_closeout_fixtures_id,
    source_promotion_receipt_chain_signoff_closeout_status: signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    source_hash: hashValue({
      id: signoffCloseout.trading_promotion_receipt_chain_signoff_closeout_fixtures_id,
      status: signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status,
      row_count: signoffCloseout.summary.chain_signoff_closeout_row_count,
      gate_count: signoffCloseout.summary.chain_signoff_closeout_gate_count,
    }),
  };
}

function buildAdapterSeparationRows({ sourceReady, executionEngine, paperShadow, limitedLive, fullAuto, researchBacktestPaper }) {
  const simulated = valueAt(executionEngine, ["adapters", "simulated_broker"]);
  const sandbox = valueAt(executionEngine, ["adapters", "sandbox"]);
  const live = valueAt(executionEngine, ["adapters", "live_adapter"]);
  const brokerInterface = valueAt(executionEngine, ["broker_adapter_interface"]);
  const credentialContract = valueAt(executionEngine, ["credential_broker_contract"]);
  const secretHandling = valueAt(executionEngine, ["secret_handling"]);
  const safetyPolicy = valueAt(researchBacktestPaper, ["safety_policy"]);
  const rowInputs = [
    adapterRowInput("sandbox_contract_simulation_only", "execution_engine", "adapters.sandbox", [
      condition("adapters.sandbox.enabled", valueAt(sandbox, ["enabled"]), true),
      condition("adapters.sandbox.simulation_only", valueAt(sandbox, ["simulation_only"]), true),
      condition("adapters.sandbox.external_network_allowed", valueAt(sandbox, ["external_network_allowed"]), false),
      condition("adapters.sandbox.live_write_allowed", valueAt(sandbox, ["live_write_allowed"]), false),
    ], { simulated_contract_declared: true }),
    adapterRowInput("simulated_broker_contract_simulation_only", "execution_engine", "adapters.simulated_broker", [
      condition("adapters.simulated_broker.enabled", valueAt(simulated, ["enabled"]), true),
      condition("adapters.simulated_broker.simulation_only", valueAt(simulated, ["simulation_only"]), true),
      condition("adapters.simulated_broker.external_network_allowed", valueAt(simulated, ["external_network_allowed"]), false),
      condition("adapters.simulated_broker.live_write_allowed", valueAt(simulated, ["live_write_allowed"]), false),
      condition("broker_adapter_interface.supports_simulated_broker", arrayIncludes(valueAt(brokerInterface, ["supported_modes"]), "simulated_broker"), true),
    ], { simulated_contract_declared: true }),
    adapterRowInput("live_adapter_contract_disabled", "execution_engine", "adapters.live_adapter", [
      condition("adapters.live_adapter.enabled", valueAt(live, ["enabled"]), false),
      condition("adapters.live_adapter.disabled_by_default", valueAt(live, ["disabled_by_default"]), true),
      condition("adapters.live_adapter.external_network_allowed", valueAt(live, ["external_network_allowed"]), false),
      condition("adapters.live_adapter.live_write_allowed", valueAt(live, ["live_write_allowed"]), false),
      condition("broker_adapter_interface.supports_live_disabled", arrayIncludes(valueAt(brokerInterface, ["supported_modes"]), "live_disabled"), true),
    ], { live_contract_declared: true }),
    adapterRowInput("simulated_and_live_contracts_separate", "execution_engine", "broker_adapter_interface", [
      condition("simulated_broker.adapter_id_differs_from_live_adapter", valueAt(simulated, ["adapter_id"]) !== valueAt(live, ["adapter_id"]), true),
      condition("simulated_broker.simulation_only", valueAt(simulated, ["simulation_only"]), true),
      condition("live_adapter.simulation_only", valueAt(live, ["simulation_only"]), false),
      condition("safety_boundary.interface_only", valueAt(executionEngine, ["safety_boundary", "interface_only"]), true),
      condition("safety_boundary.live_adapter_enabled", valueAt(executionEngine, ["safety_boundary", "live_adapter_enabled"]), false),
    ], { simulated_contract_declared: true, live_contract_declared: true, adapter_contracts_separate: true }),
    adapterRowInput("default_control_plane_imports_no_live_adapter", "execution_engine", "execution_artifacts", [
      condition("safety_boundary.simulation_only", valueAt(executionEngine, ["safety_boundary", "simulation_only"]), true),
      condition("safety_boundary.live_execution_allowed", valueAt(executionEngine, ["safety_boundary", "live_execution_allowed"]), false),
      condition("execution_artifacts.live_disabled_state_blocked", artifactState(executionEngine, "live_disabled"), "blocked"),
      condition("paper_shadow.read_only_live_data_adapter.order_routes_enabled", valueAt(paperShadow, ["read_only_live_data_adapter", "order_routes_enabled"]), false),
      condition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
      condition("full_auto.failover.live_adapter_required", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "live_adapter_required"]), false),
    ], { default_control_plane_imports_live_adapter: false }),
    adapterRowInput("credential_secret_boundary_reference_only", "execution_engine", "credential_broker_contract", [
      condition("credential_broker_contract.plaintext_secret_allowed", valueAt(credentialContract, ["plaintext_secret_allowed"]), false),
      condition("credential_broker_contract.model_context_secret_allowed", valueAt(credentialContract, ["model_context_secret_allowed"]), false),
      condition("credential_broker_contract.credential_lookup_allowed", valueAt(credentialContract, ["credential_lookup_allowed"]), false),
      condition("credential_broker_contract.credential_reference_format", valueAt(credentialContract, ["credential_reference_format"]), "credential_ref.disabled"),
      condition("secret_handling.secret_never_logged", valueAt(secretHandling, ["secret_never_logged"]), true),
      condition("safety_policy.credential_storage_policy", valueAt(safetyPolicy, ["credential_storage_policy"]), "forbidden_plaintext"),
      condition("safety_policy.api_keys_in_model_context_allowed", valueAt(safetyPolicy, ["api_keys_in_model_context_allowed"]), false),
    ], { credential_reference_only: true }),
  ];
  return rowInputs.map((input, index) => buildAdapterRow(input, sourceReady, index));
}

function adapterRowInput(rowKey, artifactId, evidencePath, observedConditions, overrides = {}) {
  return { rowKey, artifactId, evidencePath, observedConditions, overrides };
}

function buildAdapterRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-broker-adapter-separation-row.v1",
    broker_adapter_separation_row_id: `trading-broker-adapter-separation.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    adapter_separation_status: rowReady ? READY_STATUS : "blocked",
    source_promotion_receipt_chain_signoff_closeout_ready: sourceReady,
    simulated_contract_declared: input.overrides.simulated_contract_declared === true,
    live_contract_declared: input.overrides.live_contract_declared === true,
    adapter_contracts_separate: input.overrides.adapter_contracts_separate === true || input.rowKey !== "simulated_and_live_contracts_separate",
    default_control_plane_imports_live_adapter: false,
    live_adapter_imported_by_default: false,
    live_adapter_enabled: false,
    live_adapter_file_import_performed: false,
    credential_reference_only: input.overrides.credential_reference_only === true || input.rowKey !== "credential_secret_boundary_reference_only",
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    secret_material_exposed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "broker_adapter_separation_hash");
}

function buildAdapterSeparationBoundary({ generatedAt, writeRequested, signoffCloseout, rows }) {
  const sourceReady = signoffCloseout.validation.valid && signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-broker-adapter-separation-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    broker_adapter_separation_artifact_write_requested: writeRequested,
    source_promotion_receipt_chain_signoff_closeout_status: signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status,
    source_promotion_receipt_chain_signoff_closeout_ready: sourceReady,
    adapter_separation_row_count: rows.length,
    ready_adapter_separation_row_count: rows.filter((row) => row.adapter_separation_status === READY_STATUS).length,
    simulated_contract_count: rows.filter((row) => row.simulated_contract_declared).length,
    live_contract_count: rows.filter((row) => row.live_contract_declared).length,
    adapter_contracts_separate: rows.some((row) => row.row_key === "simulated_and_live_contracts_separate" && row.adapter_contracts_separate && row.adapter_separation_status === READY_STATUS),
    default_control_plane_imports_live_adapter: false,
    live_adapter_imported_by_default: false,
    live_adapter_enabled: rows.some((row) => row.unsafe_condition_refs.includes("adapters.live_adapter.enabled")),
    live_adapter_file_import_performed: false,
    credential_reference_only: rows.some((row) => row.row_key === "credential_secret_boundary_reference_only" && row.adapter_separation_status === READY_STATUS),
    credential_lookup_allowed: rows.some((row) => row.unsafe_condition_refs.includes("credential_broker_contract.credential_lookup_allowed")),
    plaintext_secret_allowed: rows.some((row) => row.unsafe_condition_refs.includes("credential_broker_contract.plaintext_secret_allowed")),
    provider_key_material_present: false,
    environment_dump_present: false,
    secret_material_exposed: false,
    broker_write_allowed: rows.some((row) => row.unsafe_condition_refs.some((ref) => ref.endsWith("broker_write_allowed") || ref.endsWith("live_write_allowed"))),
    exchange_write_allowed: rows.some((row) => row.unsafe_condition_refs.some((ref) => ref.endsWith("exchange_write_allowed"))),
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

function buildAdapterSeparationGateRows({ signoffCloseout, packageJson, platformOpsLedger, sources, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p420_signoff_closeout_ready", "P420 promotion receipt chain signoff closeout source is ready.", signoffCloseout.validation.valid && signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P421 trading broker adapter separation fixtures command.", typeof scripts["trading:broker-adapter-separation-fixtures"] === "string" && scripts["trading:broker-adapter-separation-fixtures"].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P421 trading broker adapter separation fixtures command.", validateScript.includes("npm run trading:broker-adapter-separation-fixtures -- --check")],
    ["p421_ledger_acceptance_declared", "P421 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P421: `trading:broker-adapter-separation-fixtures`")],
    ["adapter_sources_readable", "Broker adapter separation source artifacts are readable.", sources.every((source) => source.available)],
    ["adapter_separation_rows_ready", "All required broker adapter separation rows are ready.", rows.length === REQUIRED_ROW_KEYS.length && rows.every((row) => row.adapter_separation_status === READY_STATUS)],
    ["simulated_and_live_contracts_separate", "Simulated/sandbox adapter contracts remain distinct from disabled live adapter contracts.", boundary.adapter_contracts_separate && boundary.simulated_contract_count >= 2 && boundary.live_contract_count >= 1],
    ["default_control_plane_no_live_import", "Default control-plane paths do not import or enable live adapter files.", !boundary.default_control_plane_imports_live_adapter && !boundary.live_adapter_imported_by_default && !boundary.live_adapter_enabled && !boundary.live_adapter_file_import_performed],
    ["no_secret_or_trading_mutation", "P421 exposes only reference-only credential boundaries and performs no trading, artifact, release, git, or protected mutation.", boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.provider_key_material_present && !boundary.environment_dump_present && !boundary.secret_material_exposed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "broker_adapter_separation_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-broker-adapter-separation-gate-row.v1",
    broker_adapter_separation_gate_row_id: `trading-broker-adapter-separation-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    live_adapter_imported_by_gate: false,
    live_adapter_enabled_by_gate: false,
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

function buildValidationItems({ signoffCloseout, packageJson, platformOpsLedger, sources, rows, gateRows, boundary }) {
  return [
    validationItem("source.promotion_receipt_chain_signoff_closeout", "p420_signoff_closeout_ready", signoffCloseout.validation.valid && signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status === SOURCE_READY_STATUS, "P420 promotion receipt chain signoff closeout fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P421 broker adapter separation fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.adapter_sources", "adapter_sources_readable", sources.every((source) => source.available), "Broker adapter separation source artifacts are readable."),
    validationItem("broker_adapter_separation_rows", "adapter_separation_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.adapter_separation_status === READY_STATUS), "All broker adapter separation rows must be ready."),
    validationItem("broker_adapter_separation_gate_rows", "adapter_separation_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P421 broker adapter separation gates are ready."),
    validationItem("boundary.adapter_contracts_separate", "simulated_and_live_contracts_separate", boundary.adapter_contracts_separate && boundary.simulated_contract_count >= 2 && boundary.live_contract_count >= 1, "Simulated/sandbox and live-disabled adapter contracts must remain separate."),
    validationItem("boundary.default_control_plane_no_live_import", "default_control_plane_no_live_import", !boundary.default_control_plane_imports_live_adapter && !boundary.live_adapter_imported_by_default && !boundary.live_adapter_enabled && !boundary.live_adapter_file_import_performed, "Default control-plane paths must not import or enable live adapter files."),
    validationItem("boundary.secret_boundary", "reference_only_credentials", boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.provider_key_material_present && !boundary.environment_dump_present && !boundary.secret_material_exposed, "Credential handling must remain reference-only with no plaintext, environment dump, provider key, or model-context secret exposure."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P421 performs no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ signoffCloseout, rows, gateRows, boundary, validation }) {
  return {
    trading_broker_adapter_separation_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_signoff_closeout_status: signoffCloseout.summary.trading_promotion_receipt_chain_signoff_closeout_fixtures_status,
    source_promotion_receipt_chain_signoff_closeout_ready: boundary.source_promotion_receipt_chain_signoff_closeout_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    adapter_separation_row_count: rows.length,
    ready_adapter_separation_row_count: boundary.ready_adapter_separation_row_count,
    adapter_separation_gate_count: gateRows.length,
    ready_adapter_separation_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    adapter_contracts_separate: boundary.adapter_contracts_separate,
    simulated_contract_count: boundary.simulated_contract_count,
    live_contract_count: boundary.live_contract_count,
    default_control_plane_imports_live_adapter: boundary.default_control_plane_imports_live_adapter,
    live_adapter_imported_by_default: boundary.live_adapter_imported_by_default,
    live_adapter_enabled: boundary.live_adapter_enabled,
    live_adapter_file_import_performed: boundary.live_adapter_file_import_performed,
    credential_reference_only: boundary.credential_reference_only,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    secret_material_exposed: boundary.secret_material_exposed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Broker Adapter Separation Fixtures",
    "",
    `Status: ${result.summary.trading_broker_adapter_separation_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff closeout: ${result.summary.source_promotion_receipt_chain_signoff_closeout_status}`,
    `Adapter separation rows: ${result.summary.ready_adapter_separation_row_count}/${result.summary.adapter_separation_row_count}`,
    `Adapter separation gates: ${result.summary.ready_adapter_separation_gate_count}/${result.summary.adapter_separation_gate_count}`,
    "",
    "## Adapter Separation",
    "",
    ...result.broker_adapter_separation_rows.map((row) => `- ${row.row_key}: ${row.adapter_separation_status}`),
    "",
    "## Gates",
    "",
    ...result.broker_adapter_separation_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--promotion-receipt-chain-signoff-closeout-fixtures-schema") parsed.promotionReceiptChainSignoffCloseoutFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-broker-adapter-separation-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --execution-engine <path>                  Execution engine artifact path.
  --paper-shadow <path>                      Paper/shadow governance artifact path.
  --limited-live <path>                      Limited-live governance artifact path.
  --full-auto <path>                         Full-auto governance artifact path.
  --research-backtest-paper <path>           Research/backtest/paper sample artifact path.
  --promotion-receipt-chain-signoff-closeout-fixtures-schema <path>
                                             P420 promotion receipt chain signoff closeout fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_chain_signoff_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptChainSignoffCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.promotionReceiptChainSignoffCloseoutFixturesSchemaPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.executionEnginePath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.paperShadowPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.fullAutoPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.researchBacktestPaperPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.schemaPath),
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

function artifactState(source, adapterId) {
  return (valueAt(source, ["execution_artifacts"]) ?? []).find((artifact) => artifact?.adapter_id === adapterId)?.state;
}

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function arrayIncludes(value, item) {
  return Array.isArray(value) && value.includes(item);
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
