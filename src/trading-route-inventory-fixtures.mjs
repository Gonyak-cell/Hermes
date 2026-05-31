import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS,
  buildTradingSafetyRegressionFixtures,
} from "./trading-safety-regression-fixtures.mjs";

export const DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_OUT_DIR = "artifacts/trading-route-inventory-fixtures/latest";
export const DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS = [
  "examples/trading/research-backtest-paper-sample.json",
  "examples/trading/market-data-feature-store.json",
  "examples/trading/signal-engine.json",
  "examples/trading/model-improvement-layer.json",
  "examples/trading/backtest-validation.json",
  "examples/trading/risk-engine.json",
  "examples/trading/paper-shadow-live.json",
  "examples/trading/execution-engine.json",
  "examples/trading/limited-live-governance.json",
  "examples/trading/full-auto-governance.json",
];
export const DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS,
  safetyRegressionFixturesSchemaPath: DEFAULT_TRADING_SAFETY_REGRESSION_FIXTURES_INPUTS.schemaPath,
  routeSourcePaths: DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS,
  schemaPath: "schemas/trading/trading-route-inventory-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-route-inventory-fixtures.v1";
const CAPABILITY_ID = "trading.route_inventory_fixtures";
const PHASE_SLOT = "P382";
const PREVIOUS_PHASE_SLOT = "P381";
const NEXT_PHASE_SLOT = "P383";
const READY_STATUS = "ready_for_trading_route_inventory_regression";
const ROUTE_FIXTURE_CATEGORIES = [
  {
    category_key: "mutating_trading_routes",
    description: "Active Trading API routes must stay read-only GET routes and route stubs must keep mutating_routes_enabled false.",
  },
  {
    category_key: "broker_credential_routes",
    description: "Broker, vendor, credential, secret, token, or API-key lookup routes must not be active Trading routes.",
  },
  {
    category_key: "live_broker_write_routes",
    description: "Live broker, exchange, live-feed, live-order, cancel-live, and broker failover write routes must not be active Trading routes.",
  },
  {
    category_key: "generic_order_submission_routes",
    description: "Generic order submission routes must not be active Trading routes.",
  },
];

export async function runTradingRouteInventoryFixtures(options = {}) {
  const result = await buildTradingRouteInventoryFixtures(options);
  if (options.write !== false) await writeTradingRouteInventoryFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading route inventory fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingRouteInventoryFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const safetyRegressionFixtures = await buildTradingSafetyRegressionFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    schemaPath: inputs.safety_regression_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const routeSources = await Promise.all(inputs.route_source_paths.map((sourcePath) => readJsonSource(sourcePath)));
  const routeInventory = buildRouteInventory({ routeSources });
  const routeInventoryAnchor = buildRouteInventoryAnchor({ safetyRegressionFixtures, routeSourceCount: routeSources.length });
  const routeInventoryFixtureRows = buildRouteInventoryFixtureRows(routeInventory);
  const routeInventoryBoundary = buildRouteInventoryBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    routeInventory,
    routeInventoryFixtureRows,
  });
  const routeInventoryGateRows = buildRouteInventoryGateRows({
    safetyRegressionFixtures,
    packageJson,
    platformOpsLedger,
    routeSources,
    routeInventory,
    routeInventoryFixtureRows,
    routeInventoryBoundary,
  });
  const validationItems = buildValidationItems({
    safetyRegressionFixtures,
    packageJson,
    platformOpsLedger,
    routeSources,
    routeInventory,
    routeInventoryFixtureRows,
    routeInventoryGateRows,
    routeInventoryBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    safetyRegressionFixtures,
    routeInventory,
    routeInventoryFixtureRows,
    routeInventoryGateRows,
    routeInventoryBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_route_inventory_fixtures_id: `trading-route-inventory-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    route_inventory_anchor: routeInventoryAnchor,
    route_inventory_source_rows: routeInventory.sourceRows,
    active_route_rows: routeInventory.activeRouteRows,
    disabled_route_rows: routeInventory.disabledRouteRows,
    route_inventory_fixture_rows: routeInventoryFixtureRows,
    route_inventory_gate_rows: routeInventoryGateRows,
    route_inventory_boundary: routeInventoryBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_route_inventory_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    safetyRegressionFixtures,
    routeInventory,
    routeInventoryFixtureRows,
    routeInventoryGateRows,
    routeInventoryBoundary,
    validation: result.validation,
  });
  result.summary.trading_route_inventory_fixtures_id = result.trading_route_inventory_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingRouteInventoryFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-route-inventory-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "route-inventory-source-rows.json"), collectionEnvelope("trading-route-inventory-source-rows.v1", "route_inventory_source_rows", result.route_inventory_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "active-route-rows.json"), collectionEnvelope("trading-active-route-rows.v1", "active_route_rows", result.active_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "disabled-route-rows.json"), collectionEnvelope("trading-disabled-route-rows.v1", "disabled_route_rows", result.disabled_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-inventory-fixture-rows.json"), collectionEnvelope("trading-route-inventory-fixture-rows.v1", "route_inventory_fixture_rows", result.route_inventory_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-inventory-gate-rows.json"), collectionEnvelope("trading-route-inventory-gate-rows.v1", "route_inventory_gate_rows", result.route_inventory_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-inventory-boundary.json"), result.route_inventory_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-route-inventory-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingRouteInventoryFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingRouteInventoryFixtures(args);
    console.log(`Trading route inventory fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_route_inventory_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Active unsafe routes: ${result.summary.active_unsafe_route_count}`);
    console.log(`Disabled coverage: ${result.summary.disabled_coverage_category_count}/${result.summary.required_category_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRouteInventoryAnchor({ safetyRegressionFixtures, routeSourceCount }) {
  return {
    schema_version: "trading-route-inventory-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_safety_regression_fixtures_id: safetyRegressionFixtures.trading_safety_regression_fixtures_id,
    source_safety_regression_status: safetyRegressionFixtures.summary.trading_safety_regression_fixtures_status,
    required_category_count: ROUTE_FIXTURE_CATEGORIES.length,
    required_categories: ROUTE_FIXTURE_CATEGORIES.map((category) => category.category_key),
    route_source_count: routeSourceCount,
    source_hash: hashValue({
      id: safetyRegressionFixtures.trading_safety_regression_fixtures_id,
      status: safetyRegressionFixtures.summary.trading_safety_regression_fixtures_status,
      categories: ROUTE_FIXTURE_CATEGORIES.map((category) => category.category_key),
      routeSourceCount,
    }),
  };
}

function buildRouteInventory({ routeSources }) {
  const sourceRows = [];
  const activeRouteRows = [];
  const disabledRouteRows = [];
  routeSources.forEach((source, sourceIndex) => {
    const dashboard = source.data?.dashboard_api_stub;
    const activeRoutes = Array.isArray(dashboard?.routes) ? dashboard.routes : [];
    const disabledRoutes = Array.isArray(dashboard?.disabled_routes) ? dashboard.disabled_routes : [];
    const sourceKey = sourceArtifactKey(source.path);
    const sourceRow = {
      schema_version: "trading-route-inventory-source-row.v1",
      route_inventory_source_row_id: `trading-route-inventory.source.${sourceKey}`,
      phase_slot: PHASE_SLOT,
      ordinal: sourceIndex + 1,
      source_artifact_id: sourceKey,
      source_path: source.path,
      source_available: source.available,
      dashboard_api_stub_present: Boolean(dashboard),
      read_only_declared: dashboard?.read_only === true,
      mutating_routes_enabled: dashboard?.mutating_routes_enabled === true,
      active_route_count: activeRoutes.length,
      disabled_route_count: disabledRoutes.length,
      route_source_status: source.available && Boolean(dashboard) && dashboard?.read_only === true && dashboard?.mutating_routes_enabled === false ? "ready" : "blocked",
      content_hash: source.content_hash,
      human_review_required: true,
    };
    sourceRows.push({ ...sourceRow, route_source_hash: hashValue(sourceRow) });
    activeRoutes.forEach((route, routeIndex) => {
      activeRouteRows.push(buildRouteRow({
        source,
        sourceKey,
        sourceIndex,
        route,
        routeIndex,
        routeKind: "active",
        sourceMutatingRoutesEnabled: dashboard?.mutating_routes_enabled === true,
      }));
    });
    disabledRoutes.forEach((route, routeIndex) => {
      disabledRouteRows.push(buildRouteRow({
        source,
        sourceKey,
        sourceIndex,
        route,
        routeIndex,
        routeKind: "disabled",
        sourceMutatingRoutesEnabled: dashboard?.mutating_routes_enabled === true,
      }));
    });
  });
  return { sourceRows, activeRouteRows, disabledRouteRows };
}

function buildRouteRow({ source, sourceKey, sourceIndex, route, routeIndex, routeKind, sourceMutatingRoutesEnabled }) {
  const method = String(route?.method ?? "").toUpperCase();
  const routePath = String(route?.path ?? "");
  const categoryMatches = classifyRouteCategories({ method, routePath, routeKind, sourceMutatingRoutesEnabled });
  const routeRow = {
    schema_version: `trading-${routeKind}-route-row.v1`,
    route_row_id: `trading-route-inventory.${routeKind}.${String(sourceIndex + 1).padStart(2, "0")}.${String(routeIndex + 1).padStart(3, "0")}`,
    phase_slot: PHASE_SLOT,
    route_kind: routeKind,
    source_artifact_id: sourceKey,
    source_path: source.path,
    method,
    path: routePath,
    reason: route?.reason ?? null,
    source_mutating_routes_enabled: sourceMutatingRoutesEnabled,
    unsafe_category_matches: categoryMatches,
    unsafe_category_count: categoryMatches.length,
    unsafe_when_active: routeKind === "active" && categoryMatches.length > 0,
    would_be_unsafe_if_enabled: categoryMatches.length > 0,
    read_only: method === "GET",
    mutation_allowed_by_route: false,
    broker_credential_lookup_allowed_by_route: false,
    live_broker_write_allowed_by_route: false,
    generic_order_submission_allowed_by_route: false,
    protected_action_executed_by_route: false,
    human_review_required: true,
  };
  return { ...routeRow, route_hash: hashValue(routeRow) };
}

function classifyRouteCategories({ method, routePath, routeKind, sourceMutatingRoutesEnabled }) {
  const categories = new Set();
  if (routePath.startsWith("/api/trading/") && (method !== "GET" || (routeKind === "active" && sourceMutatingRoutesEnabled))) {
    categories.add("mutating_trading_routes");
  }
  if (isBrokerCredentialRoute(routePath)) categories.add("broker_credential_routes");
  if (isLiveBrokerWriteRoute(routePath)) categories.add("live_broker_write_routes");
  if (isGenericOrderSubmissionRoute(routePath)) categories.add("generic_order_submission_routes");
  return [...categories].sort();
}

function isBrokerCredentialRoute(routePath) {
  return /(?:credential|credentials|secret|token|api-key|apikey|broker-auth)/i.test(routePath);
}

function isLiveBrokerWriteRoute(routePath) {
  return /(?:\/broker(?:\/|$)|\/exchange(?:\/|$)|live-feed|live-order|live-orders|cancel-live|failover\/broker)/i.test(routePath);
}

function isGenericOrderSubmissionRoute(routePath) {
  return /^\/api\/trading\/orders(?:\/|$)/.test(routePath)
    || /^\/api\/trading\/(?:shadow|limited-live|full-auto)\/orders(?:\/|$)/.test(routePath)
    || /\/orders\/(?:submit|cancel-live)(?:\/|$)/.test(routePath);
}

function buildRouteInventoryFixtureRows(routeInventory) {
  return ROUTE_FIXTURE_CATEGORIES.map((category, index) => {
    const activeMatches = routeInventory.activeRouteRows.filter((row) => row.unsafe_category_matches.includes(category.category_key));
    const disabledMatches = routeInventory.disabledRouteRows.filter((row) => row.unsafe_category_matches.includes(category.category_key));
    const row = {
      schema_version: "trading-route-inventory-fixture-row.v1",
      route_inventory_fixture_row_id: `trading-route-inventory-fixtures.row.${category.category_key}`,
      phase_slot: PHASE_SLOT,
      row_key: category.category_key,
      category_key: category.category_key,
      description: category.description,
      expected_active_unsafe_route_count: 0,
      active_unsafe_route_count: activeMatches.length,
      disabled_evidence_route_count: disabledMatches.length,
      active_route_refs: activeMatches.map(routeRef),
      disabled_route_refs: disabledMatches.map(routeRef),
      fixture_should_fail_when_active_present: true,
      disabled_route_coverage_required: true,
      disabled_route_coverage_present: disabledMatches.length > 0,
      fixture_status: activeMatches.length === 0 && disabledMatches.length > 0 ? "passed" : "failed",
      live_trading_enabled_by_fixture: false,
      broker_credential_lookup_allowed_by_fixture: false,
      live_broker_write_allowed_by_fixture: false,
      generic_order_submission_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "route_inventory_fixture_hash");
  });
}

function routeRef(routeRow) {
  return {
    route_row_id: routeRow.route_row_id,
    source_artifact_id: routeRow.source_artifact_id,
    method: routeRow.method,
    path: routeRow.path,
  };
}

function buildRouteInventoryBoundary({ generatedAt, writeRequested, routeInventory, routeInventoryFixtureRows }) {
  const activeUnsafeRoutes = routeInventory.activeRouteRows.filter((row) => row.unsafe_when_active);
  const disabledCoverageCategories = routeInventoryFixtureRows.filter((row) => row.disabled_route_coverage_present).map((row) => row.category_key);
  return {
    schema_version: "trading-route-inventory-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    route_inventory_artifact_write_requested: writeRequested,
    route_inventory_fixture_execution_performed: false,
    route_source_count: routeInventory.sourceRows.length,
    active_route_count: routeInventory.activeRouteRows.length,
    disabled_route_count: routeInventory.disabledRouteRows.length,
    required_category_count: ROUTE_FIXTURE_CATEGORIES.length,
    disabled_coverage_category_count: disabledCoverageCategories.length,
    disabled_coverage_categories: disabledCoverageCategories,
    active_unsafe_route_count: activeUnsafeRoutes.length,
    active_unsafe_route_refs: activeUnsafeRoutes.map(routeRef),
    mutating_trading_route_enabled: routeInventoryFixtureRows.find((row) => row.category_key === "mutating_trading_routes")?.active_unsafe_route_count > 0,
    broker_credential_route_enabled: routeInventoryFixtureRows.find((row) => row.category_key === "broker_credential_routes")?.active_unsafe_route_count > 0,
    live_broker_write_route_enabled: routeInventoryFixtureRows.find((row) => row.category_key === "live_broker_write_routes")?.active_unsafe_route_count > 0,
    generic_order_submission_route_enabled: routeInventoryFixtureRows.find((row) => row.category_key === "generic_order_submission_routes")?.active_unsafe_route_count > 0,
    disabled_routes_covered: disabledCoverageCategories.length === ROUTE_FIXTURE_CATEGORIES.length,
    approval_absence_covered: true,
    live_adapter_enabled: false,
    credential_lookup_enabled: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    automatic_order_submission_allowed: false,
    live_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
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

function buildRouteInventoryGateRows({ safetyRegressionFixtures, packageJson, platformOpsLedger, routeSources, routeInventory, routeInventoryFixtureRows, routeInventoryBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p381_safety_regression_fixtures_ready", "P381 safety regression fixtures source is ready.", safetyRegressionFixtures.validation.valid && safetyRegressionFixtures.summary.trading_safety_regression_fixtures_status === "ready_for_trading_safety_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P382 trading route inventory fixtures command.", typeof scripts["trading:route-inventory-fixtures"] === "string" && scripts["trading:route-inventory-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P382 trading route inventory fixtures command.", validateScript.includes("npm run trading:route-inventory-fixtures -- --check")),
    gateRow("p382_ledger_acceptance_declared", "P382 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P382: `trading:route-inventory-fixtures`")),
    gateRow("route_sources_readable", "All Trading dashboard/API route sources are readable and contain dashboard stubs.", routeSources.length === DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS.length && routeInventory.sourceRows.every((row) => row.source_available && row.dashboard_api_stub_present)),
    gateRow("active_routes_read_only", "Active route inventory contains only read-only GET routes and mutating route stubs are disabled.", routeInventory.sourceRows.every((row) => row.read_only_declared && !row.mutating_routes_enabled) && routeInventory.activeRouteRows.every((row) => row.method === "GET" && row.read_only)),
    gateRow("unsafe_active_routes_absent", "No active mutating Trading, broker credential, live broker write, or generic order submission route is present.", routeInventoryBoundary.active_unsafe_route_count === 0 && routeInventoryFixtureRows.every((row) => row.active_unsafe_route_count === 0)),
    gateRow("disabled_route_coverage_present", "Disabled route evidence covers each unsafe Trading route family.", routeInventoryBoundary.disabled_routes_covered && routeInventoryFixtureRows.every((row) => row.disabled_route_coverage_present)),
    gateRow("no_trading_or_artifact_mutation", "Route inventory fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !routeInventoryBoundary.command_execution_performed && !routeInventoryBoundary.artifact_write_performed && !routeInventoryBoundary.release_published && !routeInventoryBoundary.git_operation_performed && !routeInventoryBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "route_inventory_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-route-inventory-gate-row.v1",
    route_inventory_gate_row_id: `trading-route-inventory-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    active_unsafe_route_enabled_by_gate: false,
    mutating_trading_route_enabled_by_gate: false,
    broker_credential_route_enabled_by_gate: false,
    live_broker_write_route_enabled_by_gate: false,
    generic_order_submission_route_enabled_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ safetyRegressionFixtures, packageJson, platformOpsLedger, routeSources, routeInventory, routeInventoryFixtureRows, routeInventoryGateRows, routeInventoryBoundary }) {
  return [
    validationItem("source.safety_regression_fixtures", "p381_safety_regression_fixtures_ready", safetyRegressionFixtures.validation.valid && safetyRegressionFixtures.summary.trading_safety_regression_fixtures_status === "ready_for_trading_safety_regression", "P381 safety regression fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P382 route inventory fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.route_sources", "route_sources_readable", routeSources.length === DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURE_SOURCE_PATHS.length && routeInventory.sourceRows.every((row) => row.source_available && row.dashboard_api_stub_present), "All default Trading route sources are readable and expose dashboard API stubs."),
    validationItem("route_inventory_source_rows", "route_sources_ready", routeInventory.sourceRows.every((row) => row.route_source_status === "ready"), "Trading route source rows must remain read-only with mutating routes disabled."),
    validationItem("active_route_rows", "active_routes_read_only", routeInventory.activeRouteRows.length > 0 && routeInventory.activeRouteRows.every((row) => row.method === "GET" && row.read_only && !row.unsafe_when_active), "Active route inventory must contain only safe read-only routes."),
    validationItem("disabled_route_rows", "disabled_route_coverage_present", routeInventoryBoundary.disabled_routes_covered && routeInventory.disabledRouteRows.length > 0, "Disabled route inventory must cover every unsafe route family."),
    validationItem("route_inventory_fixture_rows", "required_route_inventory_fixtures_pass", routeInventoryFixtureRows.length === ROUTE_FIXTURE_CATEGORIES.length && routeInventoryFixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_active_present), "All route inventory fixtures must pass with zero unsafe active routes and disabled-route coverage."),
    validationItem("route_inventory_gate_rows", "route_inventory_gates_ready", routeInventoryGateRows.length >= 9 && routeInventoryGateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P382 route inventory gates are ready."),
    validationItem("boundary.unsafe_active_routes_absent", "unsafe_active_routes_absent", routeInventoryBoundary.active_unsafe_route_count === 0 && !routeInventoryBoundary.mutating_trading_route_enabled && !routeInventoryBoundary.broker_credential_route_enabled && !routeInventoryBoundary.live_broker_write_route_enabled && !routeInventoryBoundary.generic_order_submission_route_enabled, "Unsafe Trading route families must remain absent from active routes."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !routeInventoryBoundary.command_execution_performed && !routeInventoryBoundary.package_command_execution_performed && !routeInventoryBoundary.release_check_execution_performed && !routeInventoryBoundary.artifact_write_performed && !routeInventoryBoundary.release_published && !routeInventoryBoundary.git_operation_performed && !routeInventoryBoundary.protected_action_executed && !routeInventoryBoundary.broker_write_allowed && !routeInventoryBoundary.exchange_write_allowed, "P382 route inventory fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ safetyRegressionFixtures, routeInventory, routeInventoryFixtureRows, routeInventoryGateRows, routeInventoryBoundary, validation }) {
  return {
    trading_route_inventory_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_safety_regression_status: safetyRegressionFixtures.summary.trading_safety_regression_fixtures_status,
    route_source_count: routeInventory.sourceRows.length,
    ready_route_source_count: routeInventory.sourceRows.filter((row) => row.route_source_status === "ready").length,
    active_route_count: routeInventory.activeRouteRows.length,
    disabled_route_count: routeInventory.disabledRouteRows.length,
    required_category_count: ROUTE_FIXTURE_CATEGORIES.length,
    disabled_coverage_category_count: routeInventoryBoundary.disabled_coverage_category_count,
    fixture_count: routeInventoryFixtureRows.length,
    passed_fixture_count: routeInventoryFixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: routeInventoryFixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: routeInventoryGateRows.length,
    ready_gate_count: routeInventoryGateRows.filter((row) => row.gate_status === "ready").length,
    active_unsafe_route_count: routeInventoryBoundary.active_unsafe_route_count,
    mutating_trading_route_enabled: routeInventoryBoundary.mutating_trading_route_enabled,
    broker_credential_route_enabled: routeInventoryBoundary.broker_credential_route_enabled,
    live_broker_write_route_enabled: routeInventoryBoundary.live_broker_write_route_enabled,
    generic_order_submission_route_enabled: routeInventoryBoundary.generic_order_submission_route_enabled,
    disabled_routes_covered: routeInventoryBoundary.disabled_routes_covered,
    approval_absence_covered: routeInventoryBoundary.approval_absence_covered,
    live_adapter_enabled: routeInventoryBoundary.live_adapter_enabled,
    credential_lookup_enabled: routeInventoryBoundary.credential_lookup_enabled,
    trading_live_enabled: routeInventoryBoundary.trading_live_enabled,
    trading_full_auto_enabled: routeInventoryBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: routeInventoryBoundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: routeInventoryBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: routeInventoryBoundary.live_order_submission_allowed,
    broker_write_allowed: routeInventoryBoundary.broker_write_allowed,
    exchange_write_allowed: routeInventoryBoundary.exchange_write_allowed,
    command_execution_performed: routeInventoryBoundary.command_execution_performed,
    package_command_execution_performed: routeInventoryBoundary.package_command_execution_performed,
    release_check_execution_performed: routeInventoryBoundary.release_check_execution_performed,
    artifact_write_performed: routeInventoryBoundary.artifact_write_performed,
    release_published: routeInventoryBoundary.release_published,
    git_operation_performed: routeInventoryBoundary.git_operation_performed,
    protected_action_executed: routeInventoryBoundary.protected_action_executed,
    human_review_required: routeInventoryBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Route Inventory Fixtures",
    "",
    `Status: ${result.summary.trading_route_inventory_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source safety regression: ${result.summary.source_safety_regression_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Active unsafe routes: ${result.summary.active_unsafe_route_count}`,
    `Disabled coverage: ${result.summary.disabled_coverage_category_count}/${result.summary.required_category_count}`,
    "",
    "## Fixtures",
    "",
    ...result.route_inventory_fixture_rows.map((row) => `- ${row.category_key}: ${row.fixture_status} (active unsafe ${row.active_unsafe_route_count}, disabled evidence ${row.disabled_evidence_route_count})`),
    "",
    "## Gates",
    "",
    ...result.route_inventory_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_OUT_DIR, routeSourcePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--route-source") parsed.routeSourcePaths.push(argv[++index]);
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--safety-regression-fixtures-schema") parsed.safetyRegressionFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-route-inventory-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path for P381 source.
  --full-auto <path>                       Full-auto governance artifact path for P381 source.
  --route-source <path>                    Trading route source JSON. Repeat to override defaults.
  --release-check-receipt-closeout-schema <path>
                                           P380 receipt closeout schema path.
  --safety-regression-fixtures-schema <path>
                                           P381 safety regression fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.fullAutoPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_ROUTE_INVENTORY_FIXTURES_INPUTS.schemaPath),
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

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-route-inventory-fixtures.${slugify(itemPath)}.${checkId}`,
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

function sourceArtifactKey(sourcePath) {
  return path.basename(sourcePath, ".json").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
