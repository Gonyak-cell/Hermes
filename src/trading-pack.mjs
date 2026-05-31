import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateAgainstSchema,
  validateCapabilityManifest,
} from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_VALIDATE_OUT_DIR = "artifacts/trading-validate/latest";
export const DEFAULT_TRADING_SAFETY_CHECK_OUT_DIR = "artifacts/trading-safety-check/latest";
export const DEFAULT_TRADING_GOLDEN_FIXTURES_OUT_DIR = "artifacts/trading-golden-fixtures/latest";
export const DEFAULT_TRADING_DASHBOARD_STUB_OUT_DIR = "artifacts/trading-dashboard-stub/latest";
export const DEFAULT_TRADING_INPUTS = {
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
  samplePath: "examples/trading/research-backtest-paper-sample.json",
  goldenFixturesPath: "examples/trading/golden-fixtures.json",
  schemaDir: "schemas/trading",
  policyMatrixPath: "examples/core/policy-matrix.json",
};

const TRADING_SCHEMA_FILES = [
  ["trading-asset", "trading-asset.schema.json"],
  ["trading-portfolio", "trading-portfolio.schema.json"],
  ["trading-market-data", "trading-market-data.schema.json"],
  ["trading-feature", "trading-feature.schema.json"],
  ["trading-strategy", "trading-strategy.schema.json"],
  ["trading-model", "trading-model.schema.json"],
  ["trading-signal", "trading-signal.schema.json"],
  ["trading-risk", "trading-risk.schema.json"],
  ["trading-backtest", "trading-backtest.schema.json"],
  ["trading-paper-trade", "trading-paper-trade.schema.json"],
  ["trading-order-intent", "trading-order-intent.schema.json"],
  ["trading-execution", "trading-execution.schema.json"],
  ["trading-fill-reconciliation", "trading-fill-reconciliation.schema.json"],
  ["trading-incident", "trading-incident.schema.json"],
  ["trading-promotion", "trading-promotion.schema.json"],
];

const ACTIVE_STAGES = ["research", "backtest", "paper"];
const BLOCKED_LIVE_STAGES = ["shadow_live", "limited_live", "full_auto"];
const FORBIDDEN_RUNTIME_IDS = ["hermes", "claude_code", "codex", "mcp_tool", "browser"];

export async function runTradingValidate(options = {}) {
  const result = await buildTradingValidate(options);
  if (options.write !== false) await writeTradingValidate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingValidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_VALIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const sample = await readJson(inputs.sample_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const coreSchemas = await loadCoreSchemas();
  const tradingSchemas = await loadTradingSchemas(inputs.schema_dir);
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const capabilityValidation = validateCapabilityManifest(capabilityManifest, coreSchemas, policyMatrix);
  const schemaValidationResults = validateTradingSchemas(sample, tradingSchemas);
  const safetyItems = buildTradingSafetyItems({
    packManifest,
    capabilityManifest,
    sample,
    phaseLedgerText,
  });
  const fixtureResults = buildTradingFixtureResults({
    goldenFixtures,
    sample,
    packManifest,
    safetyItems,
  });
  const sourceItems = buildSourceValidationItems({
    packManifest,
    capabilityManifest,
    domainPackRegistry,
    phaseLedgerText,
    schemaValidationResults,
    capabilityValidation,
    fixtureResults,
  });
  const validationItems = [
    ...sourceItems,
    ...schemaValidationResults.flatMap((result) => result.validation_items),
    ...safetyItems,
    ...fixtureResults.flatMap((result) => result.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeTradingValidation({
    validation,
    schemaValidationResults,
    safetyItems,
    fixtureResults,
    packManifest,
    sample,
  });
  const result = {
    schema_version: "trading-validation.v1",
    generated_at: generatedAt,
    trading_validation_id: `trading-validation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      pack_manifest: sourceContract("pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      phase_ledger: {
        source_id: "phase_ledger",
        path: inputs.phase_ledger_path,
        status: phaseLedgerText.includes("P001-P340") && phaseLedgerText.includes("blocked") ? "loaded" : "attention",
      },
      sample: sourceContract("sample", inputs.sample_path, sample.schema_version, sample.sample_id?.startsWith("trading.")),
      golden_fixtures: sourceContract("golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        pack_count: domainPackRegistry.summary.pack_count,
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    schema_validation_results: schemaValidationResults,
    safety_items: safetyItems,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderTradingValidationMarkdown(result),
  };
}

export async function writeTradingValidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "trading-validation.json"), serializable);
  await writeJson(path.join(outDir, "schema-validation-results.json"), {
    schema_version: "trading-schema-validation-results.v1",
    generated_at: result.generated_at,
    schema_validation_results: result.schema_validation_results,
  });
  await writeJson(path.join(outDir, "safety-items.json"), {
    schema_version: "trading-safety-items.v1",
    generated_at: result.generated_at,
    safety_items: result.safety_items,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSafetyCheck(options = {}) {
  const result = await buildTradingSafetyCheck(options);
  if (options.write !== false) await writeTradingSafetyCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading safety check failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSafetyCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SAFETY_CHECK_OUT_DIR);
  const validation = await buildTradingValidate({ ...options, runAt: generatedAt, write: false });
  const safetyItems = validation.safety_items;
  const safetyValidation = summarizeValidation(safetyItems);
  const result = {
    schema_version: "trading-safety-check.v1",
    generated_at: generatedAt,
    trading_safety_check_id: `trading-safety-check.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: validation.inputs,
    safety_items: safetyItems,
    validation: safetyValidation,
    summary: {
      safety_check_status: safetyValidation.valid ? "complete" : "blocked",
      safety_item_count: safetyItems.length,
      failed_safety_item_count: safetyItems.filter((item) => item.status === "failed").length,
      active_stage_count: ACTIVE_STAGES.length,
      blocked_live_stage_count: BLOCKED_LIVE_STAGES.length,
      live_trading_enabled: false,
      real_execution_enabled: false,
    },
  };
  return {
    ...result,
    markdown: renderTradingSafetyMarkdown(result),
  };
}

export async function writeTradingSafetyCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-safety-check.json"), serializableResult(result));
  await writeJson(path.join(outDir, "safety-items.json"), {
    schema_version: "trading-safety-items.v1",
    generated_at: result.generated_at,
    safety_items: result.safety_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingGoldenFixtures(options = {}) {
  const result = await buildTradingGoldenFixtures(options);
  if (options.write !== false) await writeTradingGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading golden fixture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_GOLDEN_FIXTURES_OUT_DIR);
  const validation = await buildTradingValidate({ ...options, runAt: generatedAt, write: false });
  const fixtureRecords = validation.fixture_results.map((fixture) => ({
    schema_version: "trading-golden-fixture-record.v1",
    fixture_id: fixture.fixture_id,
    input_ref: fixture.input_ref,
    expected_status: fixture.expected_status,
    fixture_status: fixture.fixture_status,
    regression_hash: fixture.regression_hash,
    validation_status: fixture.validation.valid ? "passed" : "failed",
    validation_error_count: fixture.validation.errors.length,
  }));
  const validationItems = validation.fixture_results.flatMap((fixture) => fixture.validation_items);
  const fixtureValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: "trading-golden-fixtures-report.v1",
    generated_at: generatedAt,
    trading_golden_fixture_report_id: `trading-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: validation.inputs,
    fixture_records: fixtureRecords,
    validation_items: validationItems,
    validation: fixtureValidation,
    summary: {
      golden_fixture_status: fixtureValidation.valid ? "complete" : "blocked",
      fixture_count: fixtureRecords.length,
      passed_fixture_count: fixtureRecords.filter((record) => record.validation_status === "passed").length,
      failed_fixture_count: fixtureRecords.filter((record) => record.validation_status === "failed").length,
      locked_regression_hash_count: fixtureRecords.filter((record) => record.regression_hash?.startsWith("sha256:")).length,
      validation_error_count: fixtureValidation.errors.length,
    },
  };
  return {
    ...result,
    markdown: renderTradingGoldenFixturesMarkdown(result),
  };
}

export async function writeTradingGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-golden-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "fixture-records.json"), {
    schema_version: "trading-golden-fixture-records.v1",
    generated_at: result.generated_at,
    fixture_records: result.fixture_records,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingDashboardStub(options = {}) {
  const result = await buildTradingDashboardStub(options);
  if (options.write !== false) await writeTradingDashboardStub(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading dashboard/API stub validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingDashboardStub(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_DASHBOARD_STUB_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sample = await readJson(inputs.sample_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const routes = sample.dashboard_api_stub?.routes ?? [];
  const dashboardApiStub = {
    schema_version: "trading-dashboard-api-stub.v1",
    generated_at: generatedAt,
    pack_id: packManifest.pack_id,
    read_only: sample.dashboard_api_stub?.read_only === true,
    mutating_routes_enabled: sample.dashboard_api_stub?.mutating_routes_enabled === true,
    routes: routes.map((route, index) => ({
      route_id: `trading.api.route.${index + 1}`,
      method: route.method,
      path: route.path,
      route_status: "stubbed",
      mutation_allowed: false,
    })),
    disabled_routes: [
      {
        route_id: "trading.api.route.execute_order",
        method: "POST",
        path: "/api/trading/orders/execute",
        route_status: "blocked",
        reason: "Real order execution is outside the initial research/backtest/paper boundary."
      },
      {
        route_id: "trading.api.route.credentials",
        method: "POST",
        path: "/api/trading/credentials",
        route_status: "blocked",
        reason: "Secrets must not be stored in this repository or model context."
      }
    ],
  };
  const validationItems = buildDashboardValidationItems(dashboardApiStub);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "trading-dashboard-stub-report.v1",
    generated_at: generatedAt,
    trading_dashboard_stub_id: `trading-dashboard-stub.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    dashboard_api_stub: dashboardApiStub,
    validation_items: validationItems,
    validation,
    summary: {
      dashboard_stub_status: validation.valid ? "complete" : "blocked",
      route_count: dashboardApiStub.routes.length,
      disabled_route_count: dashboardApiStub.disabled_routes.length,
      mutating_route_count: dashboardApiStub.routes.filter((route) => route.mutation_allowed).length,
      read_only: dashboardApiStub.read_only,
      validation_error_count: validation.errors.length,
    },
  };
  return {
    ...result,
    markdown: renderTradingDashboardMarkdown(result),
  };
}

export async function writeTradingDashboardStub(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-dashboard-stub.json"), serializableResult(result));
  await writeJson(path.join(outDir, "trading-dashboard-api-stub.json"), result.dashboard_api_stub);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingValidateCli(argv = process.argv.slice(2)) {
  await runTradingCli("validate", argv, runTradingValidate, DEFAULT_TRADING_VALIDATE_OUT_DIR);
}

export async function runTradingSafetyCheckCli(argv = process.argv.slice(2)) {
  await runTradingCli("safety-check", argv, runTradingSafetyCheck, DEFAULT_TRADING_SAFETY_CHECK_OUT_DIR);
}

export async function runTradingGoldenFixturesCli(argv = process.argv.slice(2)) {
  await runTradingCli("golden-fixtures", argv, runTradingGoldenFixtures, DEFAULT_TRADING_GOLDEN_FIXTURES_OUT_DIR);
}

export async function runTradingDashboardStubCli(argv = process.argv.slice(2)) {
  await runTradingCli("dashboard", argv, runTradingDashboardStub, DEFAULT_TRADING_DASHBOARD_STUB_OUT_DIR);
}

async function runTradingCli(label, argv, runner, defaultOutDir) {
  const args = parseArgs(argv, defaultOutDir);
  if (args.help) {
    printHelp(label, defaultOutDir);
    return;
  }
  try {
    const result = await runner(args);
    console.log(`Trading ${label} ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${statusOf(result)}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeInputs(options = {}) {
  return {
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_INPUTS.capabilityManifestPath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_INPUTS.phaseLedgerPath),
    sample_path: path.resolve(options.samplePath ?? DEFAULT_TRADING_INPUTS.samplePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_INPUTS.goldenFixturesPath),
    schema_dir: path.resolve(options.schemaDir ?? DEFAULT_TRADING_INPUTS.schemaDir),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_TRADING_INPUTS.policyMatrixPath),
  };
}

async function loadTradingSchemas(schemaDir) {
  const schemas = {};
  for (const [, fileName] of TRADING_SCHEMA_FILES) {
    schemas[fileName] = await readJson(path.join(schemaDir, fileName));
  }
  return schemas;
}

function validateTradingSchemas(sample, schemas) {
  return TRADING_SCHEMA_FILES.map(([contractKey, schemaFile]) => {
    const artifact = sample.contract_examples?.[contractKey] ?? null;
    const schema = schemas[schemaFile];
    const errors = artifact
      ? validateAgainstSchema(artifact, schema, schemas, contractKey)
      : [{ path: `sample.contract_examples.${contractKey}`, message: "Missing contract example." }];
    const validationItems = [
      validationItem(
        `schemas.${contractKey}`,
        "trading_schema_example_valid",
        errors.length === 0,
        errors.length === 0
          ? `${contractKey} example validates.`
          : `${contractKey} example has ${errors.length} schema error(s).`,
      ),
      ...errors.map((error) => validationItem(error.path, "trading_schema_error", false, error.message)),
    ];
    return {
      schema_version: "trading-schema-validation-result.v1",
      contract_key: contractKey,
      schema_file: schemaFile,
      artifact_schema_version: artifact?.schema_version ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: validationItems,
    };
  });
}

function buildTradingSafetyItems({ packManifest, capabilityManifest, sample, phaseLedgerText }) {
  const contractExamples = sample.contract_examples ?? {};
  const safety = sample.safety_policy ?? {};
  const stagePolicy = sample.stage_policy ?? {};
  const metadata = packManifest.metadata ?? {};
  const runtimes = capabilityManifest.allowed_runtimes ?? [];
  const forbiddenRuntimesPresent = FORBIDDEN_RUNTIME_IDS.filter((runtimeId) => runtimes.includes(runtimeId));
  const routes = sample.dashboard_api_stub?.routes ?? [];
  return [
    validationItem("trading.identity.pack_id", "trading_pack_registered", packManifest.pack_id === "trading", "Trading pack manifest uses pack_id trading."),
    validationItem("trading.identity.capability_domain", "trading_capability_registered", capabilityManifest.domain_pack === "trading", "Trading capability manifest uses domain_pack trading."),
    validationItem("trading.policy.no_financial_advice", "financial_advice_notice_present", String(sample.financial_advice_notice ?? "").includes("Not investment advice"), "Sample declares a non-advice boundary."),
    validationItem("trading.stages.active", "only_research_backtest_paper_active", ACTIVE_STAGES.every((stage) => stagePolicy[stage] === "active"), "Research, backtest, and paper are the only active stages."),
    validationItem("trading.stages.blocked_live", "live_stages_blocked", BLOCKED_LIVE_STAGES.every((stage) => stagePolicy[stage] === "blocked"), "shadow_live, limited_live, and full_auto are blocked."),
    validationItem("trading.pack.live_flag", "pack_live_disabled", metadata.live_trading_enabled === false, "Pack metadata disables live trading."),
    validationItem("trading.pack.adapters", "real_broker_adapters_disabled", metadata.real_broker_adapters_enabled === false, "Pack metadata disables real broker/exchange adapters."),
    validationItem("trading.pack.secrets", "plaintext_api_keys_forbidden", metadata.plaintext_api_key_storage_allowed === false, "Pack metadata forbids plaintext API key storage."),
    validationItem("trading.safety.live_trading", "sample_live_disabled", safety.live_trading_enabled === false, "Sample safety policy disables live trading."),
    validationItem("trading.safety.credentials", "sample_plaintext_secrets_forbidden", safety.credential_storage_policy === "forbidden_plaintext" && safety.api_keys_in_model_context_allowed === false, "Sample forbids plaintext credentials and model-context API keys."),
    validationItem("trading.safety.market_orders", "market_orders_disabled", safety.market_orders_enabled === false, "Market orders are disabled by default."),
    validationItem("trading.safety.leverage", "leverage_disabled", safety.leverage_enabled === false && safety.derivatives_enabled === false, "Leverage and derivatives are disabled by default."),
    validationItem("trading.safety.short", "short_selling_disabled", safety.short_selling_enabled === false, "Short selling is disabled by default."),
    validationItem("trading.safety.promotion", "promotion_requires_human_approval", safety.human_approval_required_for_promotion === true, "Promotion requires human approval."),
    validationItem("trading.safety.rollback", "rollback_to_paper", safety.rollback_default_stage === "paper", "Rollback defaults to paper mode."),
    validationItem("trading.safety.kill_switch", "kill_switch_manual_resume", safety.kill_switch_manual_resume_only === true, "Kill switch requires manual resume."),
    validationItem("trading.safety.audit", "audit_replay_required", safety.audit_replay_required === true, "Audit replay is required."),
    validationItem("trading.runtime.forbidden", "agent_and_browser_runtimes_excluded", forbiddenRuntimesPresent.length === 0, forbiddenRuntimesPresent.length === 0 ? "Only harness, local_script, and manual runtimes are allowed." : `Forbidden runtimes present: ${forbiddenRuntimesPresent.join(", ")}.`),
    validationItem("trading.capability.external_model", "external_model_forbidden", capabilityManifest.data_policy?.external_model_policy === "forbidden", "External model transfer is forbidden for the initial capability."),
    validationItem("trading.asset.capabilities", "asset_live_capabilities_disabled", contractExamples["trading-asset"]?.capability_flags?.live_trading_allowed === false && contractExamples["trading-asset"]?.capability_flags?.short_allowed === false && contractExamples["trading-asset"]?.capability_flags?.derivatives_allowed === false && contractExamples["trading-asset"]?.capability_flags?.leverage_allowed === false, "Asset example disables live, short, derivative, and leverage capabilities."),
    validationItem("trading.order_intent.live", "order_intent_live_blocked", contractExamples["trading-order-intent"]?.live_execution_allowed === false && contractExamples["trading-order-intent"]?.execution_mode === "blocked_live", "Order intent blocks live execution."),
    validationItem("trading.order_intent.market", "order_intent_market_order_blocked", contractExamples["trading-order-intent"]?.market_order_allowed === false, "Order intent blocks market orders."),
    validationItem("trading.execution.live", "execution_live_adapter_disabled", contractExamples["trading-execution"]?.live_adapter_enabled === false && contractExamples["trading-execution"]?.adapter_id === "live_disabled", "Execution example disables live adapter."),
    validationItem("trading.execution.secrets", "execution_secret_never_logged", contractExamples["trading-execution"]?.secret_logged === false, "Execution example records no secret logging."),
    validationItem("trading.risk.live", "risk_blocks_live_trade", contractExamples["trading-risk"]?.live_trade_allowed === false && ["block", "halt"].includes(contractExamples["trading-risk"]?.result), "Risk result blocks live trading."),
    validationItem("trading.promotion.live", "promotion_to_live_blocked", contractExamples["trading-promotion"]?.to_stage === "shadow_live" && contractExamples["trading-promotion"]?.decision === "blocked" && contractExamples["trading-promotion"]?.live_promotion_allowed === false, "Promotion to shadow_live is blocked."),
    validationItem("trading.dashboard.read_only", "dashboard_stub_read_only", sample.dashboard_api_stub?.read_only === true && sample.dashboard_api_stub?.mutating_routes_enabled === false, "Dashboard/API stub is read-only."),
    validationItem("trading.dashboard.routes", "dashboard_routes_get_only", routes.length > 0 && routes.every((route) => route.method === "GET"), "Dashboard/API stub only declares GET routes."),
    validationItem("trading.phase_ledger.coverage", "phase_ledger_covers_p001_p340", phaseLedgerText.includes("P001-P340") && phaseLedgerText.includes("P016-P035") && phaseLedgerText.includes("P331-P340"), "Phase ledger covers the full P001-P340 roadmap and core-contract phase range."),
  ];
}

function buildTradingFixtureResults({ goldenFixtures, sample, packManifest, safetyItems }) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const blockedStagesOk = (fixture.expected_blocked_stages ?? []).every((stage) => sample.stage_policy?.[stage] === "blocked");
    const activeStagesOk = (fixture.expected_active_stages ?? []).every((stage) => sample.stage_policy?.[stage] === "active");
    const gatesOk = (fixture.expected_gate_results ?? []).every((gateId) => (packManifest.gates ?? []).includes(gateId));
    const safetyOk = safetyItems.every((item) => item.status === "passed");
    const statusOk = fixture.expected_status === "complete"
      ? safetyOk
      : fixture.expected_status === "blocked_live"
        ? blockedStagesOk && sample.safety_policy?.live_trading_enabled === false
        : false;
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      input_ref: fixture.input_ref,
      sample_id: sample.sample_id,
      stage_policy: sample.stage_policy,
      safety_policy: sample.safety_policy,
      contract_examples: sample.contract_examples,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.active_stages`, "fixture_active_stages_match", activeStagesOk, `${fixture.fixture_id} active stages match expected values.`),
      validationItem(`fixtures.${fixture.fixture_id}.blocked_stages`, "fixture_blocked_stages_match", blockedStagesOk, `${fixture.fixture_id} blocked stages match expected values.`),
      validationItem(`fixtures.${fixture.fixture_id}.gates`, "fixture_gate_refs_registered", gatesOk, `${fixture.fixture_id} expected gates are registered in the pack manifest.`),
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", statusOk, `${fixture.fixture_id} expected status ${fixture.expected_status} is satisfied.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-fixture-result.v1",
      fixture_id: fixture.fixture_id,
      input_ref: fixture.input_ref,
      expected_status: fixture.expected_status,
      fixture_status: validation.valid ? fixture.expected_status : "failed",
      regression_hash: regressionHash,
      validation_items: validationItems,
      validation,
    };
  });
}

function buildSourceValidationItems({
  packManifest,
  capabilityManifest,
  domainPackRegistry,
  phaseLedgerText,
  schemaValidationResults,
  capabilityValidation,
  fixtureResults,
}) {
  const tradingPack = domainPackRegistry.packs.find((pack) => pack.pack_id === "trading");
  const tradingCapability = domainPackRegistry.capabilities.find((capability) => capability.capability_id === "trading.research_backtest_paper");
  return [
    validationItem("source.pack_manifest", "pack_manifest_valid", packManifest.schema_version === "domain-pack-manifest.v1" && packManifest.pack_id === "trading", "Trading pack manifest is loadable."),
    validationItem("source.capability_manifest", "capability_manifest_schema_valid", capabilityValidation.valid, capabilityValidation.valid ? "Trading capability manifest validates." : `Trading capability manifest has ${capabilityValidation.errors.length} error(s).`),
    ...capabilityValidation.errors.map((error) => validationItem(error.path, "capability_manifest_error", false, error.message)),
    validationItem("source.domain_pack_registry", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true, "Domain pack registry validates with trading included."),
    validationItem("source.domain_pack_registry.trading_pack", "trading_pack_in_registry", Boolean(tradingPack), "Trading pack is present in the domain pack registry."),
    validationItem("source.domain_pack_registry.trading_capability", "trading_capability_in_registry", Boolean(tradingCapability), "Trading capability is present in the domain pack registry."),
    validationItem("source.phase_ledger", "phase_ledger_loaded", phaseLedgerText.includes("Trading Pack Phase Ledger"), "Trading phase ledger is loadable."),
    validationItem("source.schemas", "all_trading_schemas_valid", schemaValidationResults.every((result) => result.validation.valid), "All Trading contract examples validate against their schemas."),
    validationItem("source.fixtures", "all_trading_fixtures_valid", fixtureResults.every((result) => result.validation.valid), "All Trading golden fixture expectations validate."),
  ];
}

function buildDashboardValidationItems(dashboardApiStub) {
  const routes = dashboardApiStub.routes ?? [];
  const disabledRoutes = dashboardApiStub.disabled_routes ?? [];
  return [
    validationItem("trading_dashboard.read_only", "dashboard_read_only", dashboardApiStub.read_only === true, "Trading dashboard/API stub is read-only."),
    validationItem("trading_dashboard.mutating_routes", "mutating_routes_disabled", dashboardApiStub.mutating_routes_enabled === false, "Mutating trading routes are disabled."),
    validationItem("trading_dashboard.routes.get_only", "routes_get_only", routes.length > 0 && routes.every((route) => route.method === "GET" && route.mutation_allowed === false), "All enabled routes are GET-only and non-mutating."),
    validationItem("trading_dashboard.routes.execute_blocked", "execute_route_blocked", disabledRoutes.some((route) => route.path === "/api/trading/orders/execute" && route.route_status === "blocked"), "Real order execution route is explicitly blocked."),
    validationItem("trading_dashboard.routes.credentials_blocked", "credentials_route_blocked", disabledRoutes.some((route) => route.path === "/api/trading/credentials" && route.route_status === "blocked"), "Credential route is explicitly blocked."),
  ];
}

function summarizeTradingValidation({ validation, schemaValidationResults, safetyItems, fixtureResults, packManifest, sample }) {
  return {
    trading_validation_status: validation.valid ? "complete" : "blocked",
    pack_id: packManifest.pack_id,
    contract_schema_count: TRADING_SCHEMA_FILES.length,
    schema_valid_count: schemaValidationResults.filter((result) => result.validation.valid).length,
    schema_invalid_count: schemaValidationResults.filter((result) => !result.validation.valid).length,
    safety_item_count: safetyItems.length,
    failed_safety_item_count: safetyItems.filter((item) => item.status === "failed").length,
    fixture_count: fixtureResults.length,
    fixture_valid_count: fixtureResults.filter((result) => result.validation.valid).length,
    validation_error_count: validation.errors.length,
    active_stages: Object.entries(sample.stage_policy ?? {}).filter(([, status]) => status === "active").map(([stage]) => stage),
    blocked_stages: Object.entries(sample.stage_policy ?? {}).filter(([, status]) => status === "blocked").map(([stage]) => stage),
    live_trading_enabled: sample.safety_policy?.live_trading_enabled === true,
    real_broker_adapters_enabled: sample.safety_policy?.real_broker_adapters_enabled === true,
  };
}

function renderTradingValidationMarkdown(result) {
  const lines = [];
  lines.push("# Trading Validation");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.trading_validation_status}`);
  lines.push("");
  lines.push(`- Contracts: ${result.summary.schema_valid_count}/${result.summary.contract_schema_count}`);
  lines.push(`- Safety items failed: ${result.summary.failed_safety_item_count}`);
  lines.push(`- Fixtures: ${result.summary.fixture_valid_count}/${result.summary.fixture_count}`);
  lines.push(`- Active stages: ${result.summary.active_stages.join(", ")}`);
  lines.push(`- Blocked stages: ${result.summary.blocked_stages.join(", ")}`);
  lines.push(`- Live trading enabled: ${result.summary.live_trading_enabled}`);
  lines.push(`- Real broker adapters enabled: ${result.summary.real_broker_adapters_enabled}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderTradingSafetyMarkdown(result) {
  const lines = [];
  lines.push("# Trading Safety Check");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.safety_check_status}`);
  lines.push("");
  lines.push(`- Safety items: ${result.summary.safety_item_count}`);
  lines.push(`- Failed safety items: ${result.summary.failed_safety_item_count}`);
  lines.push(`- Blocked live stages: ${result.summary.blocked_live_stage_count}`);
  lines.push(`- Live trading enabled: ${result.summary.live_trading_enabled}`);
  lines.push(`- Real execution enabled: ${result.summary.real_execution_enabled}`);
  return `${lines.join("\n")}\n`;
}

function renderTradingGoldenFixturesMarkdown(result) {
  const lines = [];
  lines.push("# Trading Golden Fixtures");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.golden_fixture_status}`);
  lines.push("");
  lines.push(`- Fixtures: ${result.summary.fixture_count}`);
  lines.push(`- Passed: ${result.summary.passed_fixture_count}`);
  lines.push(`- Regression hashes: ${result.summary.locked_regression_hash_count}`);
  for (const record of result.fixture_records) {
    lines.push(`- ${record.fixture_id}: ${record.validation_status} ${record.regression_hash}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderTradingDashboardMarkdown(result) {
  const lines = [];
  lines.push("# Trading Dashboard/API Stub");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.dashboard_stub_status}`);
  lines.push("");
  lines.push(`- Routes: ${result.summary.route_count}`);
  lines.push(`- Disabled routes: ${result.summary.disabled_route_count}`);
  lines.push(`- Mutating routes: ${result.summary.mutating_route_count}`);
  lines.push(`- Read only: ${result.summary.read_only}`);
  return `${lines.join("\n")}\n`;
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
    validation_item_id: `trading.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv, defaultOutDir) {
  const parsed = {
    outDir: defaultOutDir,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability-manifest") parsed.capabilityManifestPath = argv[++index];
    else if (arg === "--phase-ledger") parsed.phaseLedgerPath = argv[++index];
    else if (arg === "--sample") parsed.samplePath = argv[++index];
    else if (arg === "--golden-fixtures") parsed.goldenFixturesPath = argv[++index];
    else if (arg === "--schema-dir") parsed.schemaDir = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp(label, defaultOutDir) {
  console.log(`Usage: node scripts/trading-${label}.mjs [options]

Options:
  --out-dir <folder>             Output directory. Default: ${defaultOutDir}
  --run-at <iso>                 Deterministic generated_at timestamp.
  --pack-manifest <path>         Trading pack manifest path.
  --capability-manifest <path>   Trading capability manifest path.
  --phase-ledger <path>          Trading phase ledger path.
  --sample <path>                Trading sample path.
  --golden-fixtures <path>       Trading golden fixtures path.
  --schema-dir <folder>          Trading schema directory.
  --policy-matrix <path>         Core policy matrix path.
  --check                        Validate only, do not write artifacts.
  -h, --help                     Show this help.
`);
}

function statusOf(result) {
  return result.summary.trading_validation_status
    ?? result.summary.safety_check_status
    ?? result.summary.golden_fixture_status
    ?? result.summary.dashboard_stub_status
    ?? "unknown";
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
