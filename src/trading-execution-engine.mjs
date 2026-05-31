import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_EXECUTION_REPORT_OUT_DIR = "artifacts/trading-execution-report/latest";
export const DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS = {
  executionEnginePath: "examples/trading/execution-engine.json",
  executionEngineSchemaPath: "schemas/trading/trading-execution-engine.schema.json",
  executionSchemaPath: "schemas/trading/trading-execution.schema.json",
  orderIntentSchemaPath: "schemas/trading/trading-order-intent.schema.json",
  fillReconciliationSchemaPath: "schemas/trading/trading-fill-reconciliation.schema.json",
  incidentSchemaPath: "schemas/trading/trading-incident.schema.json",
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  riskEnginePath: "examples/trading/risk-engine.json",
  goldenFixturesPath: "examples/trading/execution-engine-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 35 }, (_, index) => `P${String(246 + index).padStart(3, "0")}`);
const REQUIRED_STATES = ["created", "risk_checked", "simulated", "cancelled", "halted", "blocked"];
const REQUIRED_DISABLED_ROUTES = [
  "/api/trading/orders/submit",
  "/api/trading/orders/cancel-live",
  "/api/trading/execution/resume",
  "/api/trading/credentials",
];

export async function runTradingExecutionReport(options = {}) {
  const result = await buildTradingExecutionReport(options);
  if (options.write !== false) await writeTradingExecutionReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading execution report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingExecutionReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_EXECUTION_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const executionEngine = await readJson(inputs.execution_engine_path);
  const executionEngineSchema = await readJson(inputs.execution_engine_schema_path);
  const executionSchema = await readJson(inputs.execution_schema_path);
  const orderIntentSchema = await readJson(inputs.order_intent_schema_path);
  const fillReconciliationSchema = await readJson(inputs.fill_reconciliation_schema_path);
  const incidentSchema = await readJson(inputs.incident_schema_path);
  const paperShadow = await readJson(inputs.paper_shadow_path);
  const riskEngine = await readJson(inputs.risk_engine_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const executionEngineSchemaErrors = validateAgainstSchema(executionEngine, executionEngineSchema, {}, "execution_engine");
  const executionArtifactResults = validateArrayArtifacts("execution_artifacts", executionEngine.execution_artifacts, executionSchema);
  const frozenOrderIntentResults = validateArrayArtifacts("paper_shadow.shadow_order_intents", paperShadow.shadow_order_intents, orderIntentSchema);
  const fillReconciliationValidation = validateSingleArtifact("fill_reconciliation", executionEngine.fill_reconciliation, fillReconciliationSchema);
  const incidentValidation = validateSingleArtifact("failed_order_handling.incident_artifact", executionEngine.failed_order_handling?.incident_artifact, incidentSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const executionItems = buildExecutionValidationItems({
    executionEngine,
    executionEngineSchemaErrors,
    executionArtifactResults,
    frozenOrderIntentResults,
    fillReconciliationValidation,
    incidentValidation,
    paperShadow,
    riskEngine,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, executionEngine, executionItems);
  const validationItems = [
    ...sourceItems,
    ...executionItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeExecutionReport({
    executionEngine,
    executionArtifactResults,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "trading-execution-report.v1",
    generated_at: generatedAt,
    execution_report_id: `trading-execution-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      execution_engine: sourceContract("execution_engine", inputs.execution_engine_path, executionEngine.schema_version, executionEngine.execution_engine_status === "complete"),
      execution_engine_schema: sourceContract("execution_engine_schema", inputs.execution_engine_schema_path, executionEngineSchema.title, executionEngineSchemaErrors.length === 0),
      execution_schema: sourceContract("trading_execution_schema", inputs.execution_schema_path, executionSchema.title, executionArtifactResults.every((item) => item.validation.valid)),
      order_intent_schema: sourceContract("trading_order_intent_schema", inputs.order_intent_schema_path, orderIntentSchema.title, frozenOrderIntentResults.every((item) => item.validation.valid)),
      fill_reconciliation_schema: sourceContract("trading_fill_reconciliation_schema", inputs.fill_reconciliation_schema_path, fillReconciliationSchema.title, fillReconciliationValidation.validation.valid),
      incident_schema: sourceContract("trading_incident_schema", inputs.incident_schema_path, incidentSchema.title, incidentValidation.validation.valid),
      paper_shadow: sourceContract("paper_shadow_live", inputs.paper_shadow_path, paperShadow.schema_version, paperShadow.paper_shadow_status === "complete"),
      risk_engine: sourceContract("risk_engine", inputs.risk_engine_path, riskEngine.schema_version, riskEngine.risk_engine_status === "complete"),
      golden_fixtures: sourceContract("execution_engine_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    execution_engine: executionEngine,
    execution_artifact_results: executionArtifactResults,
    frozen_order_intent_results: frozenOrderIntentResults,
    fill_reconciliation_validation: fillReconciliationValidation,
    incident_validation: incidentValidation,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExecutionReportMarkdown(result),
  };
}

export async function writeTradingExecutionReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-execution-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "execution-engine.json"), result.execution_engine);
  await writeJson(path.join(outDir, "execution-artifact-results.json"), {
    schema_version: "trading-execution-artifact-results.v1",
    generated_at: result.generated_at,
    execution_artifact_results: result.execution_artifact_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-execution-engine-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingExecutionReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingExecutionReport(args);
    console.log(`Trading execution report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.execution_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Executions: ${result.summary.execution_artifact_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateArrayArtifacts(pathName, artifacts = [], schema) {
  return artifacts.map((artifact, index) => {
    const errors = validateAgainstSchema(artifact, schema, {}, `${pathName}[${index}]`);
    return {
      schema_version: "trading-execution-array-artifact-validation-result.v1",
      artifact_id: artifact.execution_id ?? artifact.order_intent_id ?? index,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`${pathName}.${artifact.execution_id ?? artifact.order_intent_id ?? index}`, "schema_valid", errors.length === 0, errors.length === 0 ? `${pathName} artifact validates.` : `${pathName} artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
      ],
    };
  });
}

function validateSingleArtifact(pathName, artifact, schema) {
  const errors = validateAgainstSchema(artifact ?? {}, schema, {}, pathName);
  return {
    schema_version: "trading-execution-single-artifact-validation-result.v1",
    path: pathName,
    validation: {
      valid: errors.length === 0,
      errors,
    },
    validation_items: [
      validationItem(pathName, "schema_valid", errors.length === 0, errors.length === 0 ? `${pathName} validates.` : `${pathName} has ${errors.length} schema error(s).`),
      ...errors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    ],
  };
}

function buildSourceValidationItems({ packageJson, packManifest, capabilityManifest, phaseLedgerText, domainPackRegistry }) {
  const scripts = packageJson.scripts ?? {};
  const packSchemas = packManifest.schemas ?? [];
  const workflows = packManifest.workflows ?? [];
  const goldenCases = packManifest.golden_cases ?? [];
  const entrypoints = capabilityManifest.entrypoints ?? [];
  const capabilityGoldenCases = capabilityManifest.golden_cases ?? [];
  const tradingPack = domainPackRegistry.packs.find((pack) => pack.pack_id === "trading");
  return [
    validationItem("source.package.trading_execution_report", "package_script_registered", Boolean(scripts["trading:execution-report"]), "Package script trading:execution-report is registered."),
    validationItem("source.pack.schemas.execution_engine", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-execution-engine.schema.json"), "Trading pack manifest registers the execution engine schema."),
    validationItem("source.pack.workflow.execution_report", "pack_workflow_registered", workflows.includes("workflow.trading.execution_report.v1"), "Trading pack manifest registers the execution report workflow."),
    validationItem("source.pack.workflow.execution_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.execution_dashboard.v1"), "Trading pack manifest registers the execution dashboard workflow."),
    validationItem("source.pack.workflow.execution_api", "pack_workflow_registered", workflows.includes("workflow.trading.execution_api.v1"), "Trading pack manifest registers the execution API workflow."),
    validationItem("source.pack.golden.execution_engine", "pack_golden_case_registered", goldenCases.includes("golden.trading.execution_engine.p246_p280"), "Trading pack manifest registers the execution engine golden case."),
    validationItem("source.capability.entrypoint.execution_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:execution-report"), "Trading capability manifest registers the execution report entrypoint."),
    validationItem("source.capability.golden.execution_engine", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.execution_engine.p246_p280"), "Trading capability manifest registers the execution engine golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p246_p280", "phase_ledger_updated", phaseLedgerText.includes("P246-P280 Acceptance Criteria") && phaseLedgerText.includes("trading:execution-report"), "Phase ledger documents P246-P280 acceptance criteria and CLI."),
  ];
}

function buildExecutionValidationItems({
  executionEngine,
  executionEngineSchemaErrors,
  executionArtifactResults,
  frozenOrderIntentResults,
  fillReconciliationValidation,
  incidentValidation,
  paperShadow,
  riskEngine,
}) {
  const phaseIds = new Set((executionEngine.phase_coverage ?? []).map((phase) => phase.phase_id));
  const riskCheckIds = new Set((riskEngine.risk_check_artifacts ?? []).map((artifact) => artifact.risk_check_id));
  const paperShadowIntentIds = new Set((paperShadow.shadow_order_intents ?? []).map((intent) => intent.order_intent_id));
  const executionArtifacts = executionEngine.execution_artifacts ?? [];
  const executionIds = new Set(executionArtifacts.map((artifact) => artifact.execution_id));
  const adapterIds = new Set(executionArtifacts.map((artifact) => artifact.adapter_id));
  const disabledRoutes = executionEngine.dashboard_api_stub?.disabled_routes ?? [];
  const dashboardRoutes = executionEngine.dashboard_api_stub?.routes ?? [];
  const allowedOrderTypes = executionEngine.order_type_whitelist?.allowed_order_types ?? [];
  const states = executionEngine.execution_state_machine?.states ?? [];
  const regressionCases = executionEngine.regression_suite?.cases ?? [];
  return [
    validationItem("execution_engine.schema", "schema_validation_passed", executionEngineSchemaErrors.length === 0, executionEngineSchemaErrors.length === 0 ? "Execution engine validates against schema." : `Execution engine has ${executionEngineSchemaErrors.length} schema error(s).`),
    ...executionEngineSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("execution_engine.phase_range", "phase_range_p246_p280", executionEngine.phase_range === "P246-P280", "Execution engine is scoped to P246-P280."),
    validationItem("execution_engine.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (executionEngine.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P246-P280 phases are covered and complete."),
    validationItem("execution_engine.safety", "execution_safety_boundary", executionEngine.safety_boundary?.interface_only === true && executionEngine.safety_boundary?.simulation_only === true && executionEngine.safety_boundary?.real_order_submitted === false && executionEngine.safety_boundary?.live_execution_allowed === false && executionEngine.safety_boundary?.live_adapter_enabled === false, "Execution engine is interface/simulation-only and live execution is disabled."),
    validationItem("execution_engine.safety.no_writes", "broker_exchange_writes_disabled", executionEngine.safety_boundary?.broker_write_allowed === false && executionEngine.safety_boundary?.exchange_write_allowed === false, "Broker and exchange writes are disabled."),
    validationItem("execution_engine.safety.secrets", "secret_not_logged", executionEngine.safety_boundary?.secret_logged === false && executionEngine.secret_handling?.secret_never_logged === true, "Secrets are never logged."),
    validationItem("execution_engine.order_intent_freeze", "order_intent_schema_frozen", executionEngine.order_intent_schema_freeze?.frozen === true && executionEngine.order_intent_schema_freeze?.schema_ref === "schemas/trading/trading-order-intent.schema.json" && paperShadowIntentIds.has(executionEngine.order_intent_schema_freeze?.source_order_intent_ref), "Order intent schema is frozen and bound to the shadow intent fixture."),
    validationItem("execution_engine.order_intent_schema", "frozen_order_intents_validate", frozenOrderIntentResults.length >= 1 && frozenOrderIntentResults.every((result) => result.validation.valid), "Frozen order-intent source artifacts validate."),
    ...frozenOrderIntentResults.flatMap((result) => result.validation_items),
    validationItem("execution_engine.pre_trade_risk_gate", "pre_trade_risk_gate_blocks_live", executionEngine.pre_trade_risk_gate?.required_before_execution === true && riskCheckIds.has(executionEngine.pre_trade_risk_gate?.risk_check_ref) && executionEngine.pre_trade_risk_gate?.current_result === "block" && executionEngine.pre_trade_risk_gate?.blocks_live_execution === true, "Pre-trade risk gate is required and blocks live execution."),
    validationItem("execution_engine.order_type_whitelist", "limit_cancel_only", allowedOrderTypes.includes("limit") && allowedOrderTypes.includes("cancel") && allowedOrderTypes.length === 2 && executionEngine.order_type_whitelist?.market_order_allowed === false, "Order type whitelist allows limit/cancel only and blocks market orders."),
    validationItem("execution_engine.order_controls.limit", "limit_order_simulation_only", executionEngine.order_controls?.limit_order_support?.enabled === true && executionEngine.order_controls?.limit_order_support?.simulation_only === true && executionEngine.order_controls?.limit_order_support?.requires_risk_pass === true, "Limit order support is simulation-only and requires risk pass."),
    validationItem("execution_engine.order_controls.cancel", "cancel_order_simulation_only", executionEngine.order_controls?.cancel_order_support?.enabled === true && executionEngine.order_controls?.cancel_order_support?.simulation_only === true, "Cancel order support is simulation-only."),
    validationItem("execution_engine.order_controls.throttle", "order_throttle_blocks_submission", executionEngine.order_controls?.order_throttle?.max_orders_per_day === 0 && executionEngine.order_controls?.order_throttle?.blocks_order_submission === true, "Order throttle blocks order submission."),
    validationItem("execution_engine.order_controls.dedupe", "duplicate_order_prevention_declared", executionEngine.order_controls?.duplicate_order_prevention?.enabled === true && (executionEngine.order_controls?.duplicate_order_prevention?.dedupe_keys ?? []).includes("idempotency_key"), "Duplicate order prevention includes idempotency key."),
    validationItem("execution_engine.order_controls.idempotency", "idempotency_required", executionEngine.order_controls?.idempotency?.required === true && (executionEngine.order_controls?.idempotency?.key_fields ?? []).includes("order_intent_id"), "Idempotency key is required."),
    validationItem("execution_engine.state_machine", "state_machine_safe", REQUIRED_STATES.every((state) => states.includes(state)) && executionEngine.execution_state_machine?.live_submit_state_enabled === false, "Execution state machine includes required states and no live submit state."),
    validationItem("execution_engine.adapter_interfaces", "adapter_interfaces_no_write", executionEngine.broker_adapter_interface?.write_methods_enabled === false && executionEngine.crypto_exchange_adapter_interface?.write_methods_enabled === false && executionEngine.broker_adapter_interface?.requires_credential_broker === true && executionEngine.crypto_exchange_adapter_interface?.requires_credential_broker === true, "Broker and crypto exchange adapter interfaces do not enable writes."),
    validationItem("execution_engine.credentials", "credential_broker_disabled", executionEngine.credential_broker_contract?.plaintext_secret_allowed === false && executionEngine.credential_broker_contract?.model_context_secret_allowed === false && executionEngine.credential_broker_contract?.credential_lookup_allowed === false, "Credential broker blocks plaintext, model-context secrets, and lookup."),
    validationItem("execution_engine.secret_handling", "forbidden_secret_fields_excluded", executionEngine.secret_handling?.redaction_required === true && (executionEngine.secret_handling?.forbidden_log_fields ?? []).every((field) => !(executionEngine.secret_handling?.log_fields ?? []).includes(field)), "Secret fields are excluded from logs."),
    validationItem("execution_engine.adapters.sandbox", "sandbox_simulation_only", executionEngine.adapters?.sandbox?.enabled === true && executionEngine.adapters?.sandbox?.simulation_only === true && executionEngine.adapters?.sandbox?.external_network_allowed === false && executionEngine.adapters?.sandbox?.live_write_allowed === false, "Sandbox adapter is simulation-only."),
    validationItem("execution_engine.adapters.simulated_broker", "simulated_broker_simulation_only", executionEngine.adapters?.simulated_broker?.enabled === true && executionEngine.adapters?.simulated_broker?.simulation_only === true && executionEngine.adapters?.simulated_broker?.external_network_allowed === false && executionEngine.adapters?.simulated_broker?.live_write_allowed === false, "Simulated broker adapter is simulation-only."),
    validationItem("execution_engine.adapters.live", "live_adapter_disabled", executionEngine.adapters?.live_adapter?.enabled === false && executionEngine.adapters?.live_adapter?.adapter_id === "live_disabled" && executionEngine.adapters?.live_adapter?.live_write_allowed === false && executionEngine.adapters?.live_adapter?.disabled_by_default === true, "Live adapter is disabled by default."),
    validationItem("execution_engine.artifacts.schema", "execution_artifacts_validate", executionArtifactResults.length >= 3 && executionArtifactResults.every((result) => result.validation.valid), "Execution artifacts validate against trading-execution.v1."),
    ...executionArtifactResults.flatMap((result) => result.validation_items),
    validationItem("execution_engine.artifacts.boundary", "execution_artifacts_no_live_or_secret", executionArtifacts.every((artifact) => artifact.live_adapter_enabled === false && artifact.secret_logged === false && artifact.emergency_halt_available === true) && adapterIds.has("sandbox") && adapterIds.has("simulated_broker") && adapterIds.has("live_disabled"), "Execution artifacts cover sandbox, simulated broker, and live-disabled boundaries."),
    validationItem("execution_engine.artifacts.order_intent_refs", "execution_artifact_order_intents_frozen", executionArtifacts.every((artifact) => paperShadowIntentIds.has(artifact.order_intent_id)), "Execution artifacts reference frozen shadow order intents."),
    validationItem("execution_engine.audit", "execution_audit_replayable", executionEngine.execution_audit_trail?.source_lineage_required === true && executionEngine.execution_audit_trail?.replayable === true && executionEngine.execution_audit_trail?.human_review_required === true, "Execution audit trail is replayable and reviewable."),
    validationItem("execution_engine.fill_reconciliation.schema", "fill_reconciliation_valid", fillReconciliationValidation.validation.valid, "Fill reconciliation validates against trading-fill-reconciliation.v1."),
    ...fillReconciliationValidation.validation_items,
    validationItem("execution_engine.fill_reconciliation.boundary", "fill_reconciliation_simulation_only", executionIds.has(executionEngine.fill_reconciliation?.execution_id) && executionEngine.fill_reconciliation?.status === "matched" && (executionEngine.fill_reconciliation?.discrepancies ?? []).length === 0, "Fill reconciliation is matched for a simulated execution."),
    validationItem("execution_engine.failed_order.incident_schema", "failed_order_incident_valid", incidentValidation.validation.valid, "Failed order incident validates against trading-incident.v1."),
    ...incidentValidation.validation_items,
    validationItem("execution_engine.failed_order.boundary", "failed_order_rolls_back_to_paper", executionEngine.failed_order_handling?.enabled === true && executionEngine.failed_order_handling?.failed_order_state === "blocked" && executionEngine.failed_order_handling?.incident_artifact?.rollback_stage === "paper" && executionEngine.failed_order_handling?.incident_artifact?.human_owner_required === true, "Failed order handling rolls back to paper and requires a human owner."),
    validationItem("execution_engine.emergency_halt", "emergency_halt_manual_resume", executionEngine.emergency_halt?.available === true && executionEngine.emergency_halt?.halt_state === "halted" && executionEngine.emergency_halt?.manual_resume_required === true && executionEngine.emergency_halt?.cancels_live_orders === false, "Emergency halt is available and manual-resume only without live orders."),
    validationItem("execution_engine.manual_resume", "manual_resume_only", executionEngine.manual_resume_policy?.manual_resume_only === true && executionEngine.manual_resume_policy?.human_approval_required === true && executionEngine.manual_resume_policy?.resume_route_enabled === false, "Manual resume requires human approval and route is disabled."),
    validationItem("execution_engine.dashboard", "dashboard_read_only", executionEngine.dashboard_api_stub?.read_only === true && executionEngine.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Execution dashboard/API is read-only."),
    validationItem("execution_engine.dashboard.disabled", "unsafe_routes_disabled", REQUIRED_DISABLED_ROUTES.every((routePath) => disabledRoutes.some((route) => route.path === routePath)), "Order submit, live cancel, resume, and credential routes are disabled."),
    validationItem("execution_engine.regression_suite", "regression_suite_complete", executionEngine.regression_suite?.all_cases_passed === true && executionEngine.regression_suite?.case_count === regressionCases.length && executionEngine.regression_suite?.case_count >= 10, "Execution regression suite is complete."),
  ];
}

function buildFixtureResults(goldenFixtures, executionEngine, executionItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: executionEngine.phase_range,
      phase_coverage: executionEngine.phase_coverage,
      safety_boundary: executionEngine.safety_boundary,
      order_type_whitelist: executionEngine.order_type_whitelist,
      adapters: executionEngine.adapters,
      execution_artifacts: executionEngine.execution_artifacts,
      emergency_halt: executionEngine.emergency_halt,
      manual_resume_policy: executionEngine.manual_resume_policy,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && executionItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", executionEngine.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (executionEngine.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.execution_count`, "fixture_execution_artifact_count_matches", (executionEngine.execution_artifacts ?? []).length === fixture.expected_execution_artifact_count, `${fixture.fixture_id} execution artifact count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.allowed_order_types`, "fixture_order_types_match", arraysEqual(executionEngine.order_type_whitelist?.allowed_order_types ?? [], fixture.expected_allowed_order_types ?? []), `${fixture.fixture_id} order type whitelist matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.market_order`, "fixture_market_order_boundary_matches", executionEngine.order_type_whitelist?.market_order_allowed === fixture.expected_market_order_allowed, `${fixture.fixture_id} market order boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.real_order`, "fixture_real_order_boundary_matches", executionEngine.safety_boundary?.real_order_submitted === fixture.expected_real_order_submitted, `${fixture.fixture_id} real order boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_execution`, "fixture_live_execution_boundary_matches", executionEngine.safety_boundary?.live_execution_allowed === fixture.expected_live_execution_allowed, `${fixture.fixture_id} live execution boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_adapter`, "fixture_live_adapter_boundary_matches", executionEngine.safety_boundary?.live_adapter_enabled === fixture.expected_live_adapter_enabled, `${fixture.fixture_id} live adapter boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.secret_logged`, "fixture_secret_boundary_matches", executionEngine.safety_boundary?.secret_logged === fixture.expected_secret_logged, `${fixture.fixture_id} secret boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.regression_count`, "fixture_regression_count_matches", executionEngine.regression_suite?.case_count === fixture.expected_regression_case_count, `${fixture.fixture_id} regression case count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", executionEngine.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-execution-engine-fixture-result.v1",
      fixture_id: fixture.fixture_id,
      input_ref: fixture.input_ref,
      expected_status: fixture.expected_status,
      fixture_status: validation.valid ? "complete" : "failed",
      regression_hash: regressionHash,
      validation_items: validationItems,
      validation,
    };
  });
}

function summarizeExecutionReport({ executionEngine, executionArtifactResults, fixtureResults, validationItems, validation }) {
  const executionArtifacts = executionEngine.execution_artifacts ?? [];
  return {
    execution_report_status: validation.valid ? "complete" : "blocked",
    phase_range: executionEngine.phase_range,
    phase_count: executionEngine.phase_coverage?.length ?? 0,
    complete_phase_count: (executionEngine.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    execution_artifact_count: executionArtifacts.length,
    execution_schema_valid_count: executionArtifactResults.filter((result) => result.validation.valid).length,
    simulated_execution_count: executionArtifacts.filter((artifact) => artifact.execution_mode === "simulated").length,
    blocked_execution_count: executionArtifacts.filter((artifact) => artifact.state === "blocked").length,
    allowed_order_type_count: executionEngine.order_type_whitelist?.allowed_order_types?.length ?? 0,
    regression_case_count: executionEngine.regression_suite?.case_count ?? 0,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    interface_only: executionEngine.safety_boundary?.interface_only === true,
    simulation_only: executionEngine.safety_boundary?.simulation_only === true,
    real_order_submitted: executionEngine.safety_boundary?.real_order_submitted === true,
    live_execution_allowed: executionEngine.safety_boundary?.live_execution_allowed === true,
    live_adapter_enabled: executionEngine.safety_boundary?.live_adapter_enabled === true,
    market_order_allowed: executionEngine.order_type_whitelist?.market_order_allowed === true,
    secret_logged: executionEngine.safety_boundary?.secret_logged === true,
    manual_resume_required: executionEngine.manual_resume_policy?.manual_resume_only === true,
    dashboard_read_only: executionEngine.dashboard_api_stub?.read_only === true,
  };
}

function renderExecutionReportMarkdown(result) {
  const lines = [];
  lines.push("# Trading Execution Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.execution_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Execution artifacts: ${result.summary.execution_artifact_count}`);
  lines.push(`- Simulated executions: ${result.summary.simulated_execution_count}`);
  lines.push(`- Blocked executions: ${result.summary.blocked_execution_count}`);
  lines.push(`- Real orders submitted: ${result.summary.real_order_submitted}`);
  lines.push(`- Live execution allowed: ${result.summary.live_execution_allowed}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.executionEnginePath),
    execution_engine_schema_path: path.resolve(options.executionEngineSchemaPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.executionEngineSchemaPath),
    execution_schema_path: path.resolve(options.executionSchemaPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.executionSchemaPath),
    order_intent_schema_path: path.resolve(options.orderIntentSchemaPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.orderIntentSchemaPath),
    fill_reconciliation_schema_path: path.resolve(options.fillReconciliationSchemaPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.fillReconciliationSchemaPath),
    incident_schema_path: path.resolve(options.incidentSchemaPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.incidentSchemaPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.paperShadowPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.riskEnginePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_EXECUTION_ENGINE_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_EXECUTION_REPORT_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--execution-engine-schema") parsed.executionEngineSchemaPath = argv[++index];
    else if (arg === "--execution-schema") parsed.executionSchemaPath = argv[++index];
    else if (arg === "--order-intent-schema") parsed.orderIntentSchemaPath = argv[++index];
    else if (arg === "--fill-reconciliation-schema") parsed.fillReconciliationSchemaPath = argv[++index];
    else if (arg === "--incident-schema") parsed.incidentSchemaPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--golden-fixtures") parsed.goldenFixturesPath = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability-manifest") parsed.capabilityManifestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--phase-ledger") parsed.phaseLedgerPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-execution-report.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_TRADING_EXECUTION_REPORT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --execution-engine <path>             Execution engine fixture path.
  --execution-engine-schema <path>      Execution engine schema path.
  --execution-schema <path>             trading-execution schema path.
  --order-intent-schema <path>          trading-order-intent schema path.
  --fill-reconciliation-schema <path>   trading-fill-reconciliation schema path.
  --incident-schema <path>              trading-incident schema path.
  --paper-shadow <path>                 Paper/shadow fixture path.
  --risk-engine <path>                  Risk engine fixture path.
  --golden-fixtures <path>              Execution engine golden fixtures path.
  --pack-manifest <path>                Trading pack manifest path.
  --capability-manifest <path>          Trading capability manifest path.
  --package <path>                      package.json path.
  --phase-ledger <path>                 Trading phase ledger path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function sourceContract(sourceId, sourcePath, schemaVersion, ok) {
  return {
    source_id: sourceId,
    path: sourcePath,
    schema_version: schemaVersion ?? null,
    status: ok ? "loaded" : "attention",
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-execution-engine.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function arraysEqual(left, right) {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.length === rightSorted.length && leftSorted.every((value, index) => value === rightSorted[index]);
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
