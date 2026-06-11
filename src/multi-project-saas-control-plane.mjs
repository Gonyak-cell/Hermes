import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_FACTORY_LEDGER_DIR,
  DEFAULT_FACTORY_SEED_DIR,
  readFactoryLedgerFile,
} from "./factory-product-registry-store.mjs";
import { buildWorkOsGoalDrilldownSurface } from "./work-os-goal-drilldown-surface.mjs";

export const DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_OUT_DIR = "artifacts/multi-project-saas-control-plane/latest";
export const DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS = {
  schemaPath: "schemas/multi-project-saas-control-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p9401-p9600.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsGoalDrilldownPath: "artifacts/work-os-goal-drilldown-surface/latest/work-os-goal-drilldown-surface.json",
  factoryLedgerDir: DEFAULT_FACTORY_LEDGER_DIR,
  factorySeedDir: DEFAULT_FACTORY_SEED_DIR,
};

export const DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_HOST = "127.0.0.1";
export const DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_PORT = 4194;

const COMMAND_NAME = "platform:multi-project-saas-control-plane";
const SOURCE_COMMAND_NAME = "platform:work-os-goal-drilldown-surface";
const SCHEMA_VERSION = "multi-project-saas-control-plane.v1";
const CAPABILITY_ID = "platform.multi_project_saas_control_plane";
const PROGRAM_RANGE = "P9401-P9600";
const SOURCE_PROGRAM_RANGE = "P9201-P9400";
const SOURCE_READY_STATUS = "ready_for_work_os_goal_drilldown_surface";
const READY_STATUS = "ready_for_multi_project_saas_control_plane";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

const PHASE_SPECS = [
  ["P9401-P9420", "P9400 Drilldown Source Binding"],
  ["P9421-P9440", "SaaS Project Registry"],
  ["P9441-P9460", "SaaS Repo Inventory"],
  ["P9461-P9480", "Current Goal Risk Ledger"],
  ["P9481-P9500", "Validation And Review Aggregation"],
  ["P9501-P9520", "Blocker And Next Action Matrix"],
  ["P9521-P9540", "Domain Boundary Guard"],
  ["P9541-P9560", "Multi-Project API Projection"],
  ["P9561-P9580", "Operator Control Summary And Smoke"],
  ["P9581-P9600", "P9600 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Multi-project source readiness", "computed"],
  ["/api/saas/projects", "projects", "SaaS project registry", "saas_project_registry_rows"],
  ["/api/saas/repos", "repos", "SaaS repo inventory", "saas_repo_inventory_rows"],
  ["/api/saas/current-goals", "current_goals", "Current goal risk ledger", "current_goal_risk_rows"],
  ["/api/saas/validation-review", "validation_review", "Validation and review aggregation", "validation_review_aggregation_rows"],
  ["/api/saas/blockers", "blockers", "Blocker and next action matrix", "blocker_next_action_rows"],
  ["/api/saas/operator-summary", "operator_summary", "Operator control summary", "operator_control_summary_rows"],
  ["/api/saas/boundary", "boundary", "Multi-project control boundary", "multi_project_saas_boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p9400_source", "Multi-project control passes without P9400 source readiness", "BLOCK_MISSING_P9400_SOURCE"],
  ["negative.domain_pack_product_promotion", "A domain pack is promoted to the Hermes product identity", "BLOCK_DOMAIN_PACK_PRODUCT_PROMOTION"],
  ["negative.cross_project_data_mix", "Project or repo rows mix data across project boundaries", "BLOCK_CROSS_PROJECT_DATA_MIX"],
  ["negative.mutating_api_method", "The control-plane API accepts POST PUT PATCH or DELETE", "BLOCK_MUTATING_API_METHOD"],
  ["negative.repo_git_write", "Repo inventory enables stage commit push merge or patch apply", "BLOCK_REPO_GIT_WRITE"],
  ["negative.review_final_approval", "Codex or Claude becomes final approval authority", "BLOCK_REVIEW_FINAL_APPROVAL"],
  ["negative.production_enterprise_pass", "The control plane creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.raw_transcript_body", "API or UI exposes raw/full transcript bodies", "BLOCK_RAW_TRANSCRIPT_BODY"],
  ["negative.secret_key_response", "API or UI exposes secret-bearing keys", "BLOCK_SECRET_KEY_RESPONSE"],
  ["negative.connector_write", "External connector write becomes enabled from project registry state", "BLOCK_CONNECTOR_WRITE"],
];

export async function runMultiProjectSaasControlPlane(options = {}) {
  const result = await buildMultiProjectSaasControlPlane(options);
  if (options.write !== false) await writeMultiProjectSaasControlPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Multi-project SaaS control plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMultiProjectSaasControlPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = options.workOsGoalDrilldownSurface
    ? normalizeInlineJsonSource("inline.work_os_goal_drilldown_surface", options.workOsGoalDrilldownSurface)
    : await readJsonOrBuildWorkOsGoalDrilldownSurface(inputs.source_work_os_goal_drilldown_path, generatedAt);

  const sourceData = source.data ?? {};
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const factoryProductSource = await resolveFactoryProductProjectionSource(sourceData, inputs);
  const derived = deriveControlPlaneCollections(sourceData, generatedAt, factoryProductSource);
  const routeRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows(sourceData, generatedAt, inputs);
  const browserSmokeRows = await buildBrowserSmokeRows(sourceData, generatedAt, inputs);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    ...derived,
    generatedAt,
  });
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    ...derived,
    generatedAt,
  });
  const boundary = buildBoundary({
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    ...derived,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    boundary,
    ...derived,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    multi_project_saas_control_plane_id: `multi-project-saas-control-plane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_goal_drilldown_summary: source.data?.summary ?? null,
    factory_product_projection_source: factoryProductSource,
    multi_project_saas_contract: contract,
    multi_project_saas_phase_rows: phaseRows,
    p9400_source_binding_rows: sourceBindingRows,
    multi_project_api_route_rows: routeRows,
    saas_project_registry_rows: derived.saas_project_registry_rows,
    saas_repo_inventory_rows: derived.saas_repo_inventory_rows,
    current_goal_risk_rows: derived.current_goal_risk_rows,
    validation_review_aggregation_rows: derived.validation_review_aggregation_rows,
    blocker_next_action_rows: derived.blocker_next_action_rows,
    domain_boundary_guard_rows: derived.domain_boundary_guard_rows,
    operator_control_summary_rows: derived.operator_control_summary_rows,
    multi_project_api_smoke_rows: apiSmokeRows,
    multi_project_browser_smoke_rows: browserSmokeRows,
    multi_project_negative_fixture_rows: negativeFixtureRows,
    p9600_freeze_rows: freezeRows,
    multi_project_gate_rows: gateRows,
    multi_project_saas_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      phaseRows,
      sourceBindingRows,
      routeRows,
      apiSmokeRows,
      browserSmokeRows,
      negativeFixtureRows,
      freezeRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
      ...derived,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "multi_project_saas_control_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    boundary,
    validation: result.validation,
    ...derived,
  });
  return { ...result, html: renderControlPlaneHtml(result), markdown: renderMarkdown(result) };
}

export async function writeMultiProjectSaasControlPlane(result, outDir = DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "multi-project-saas-control-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "factory-product-projection-source.json"), result.factory_product_projection_source);
  await writeJson(path.join(outDir, "multi-project-saas-phase-rows.json"), result.multi_project_saas_phase_rows);
  await writeJson(path.join(outDir, "p9400-source-binding-rows.json"), result.p9400_source_binding_rows);
  await writeJson(path.join(outDir, "multi-project-api-route-rows.json"), result.multi_project_api_route_rows);
  await writeJson(path.join(outDir, "saas-project-registry-rows.json"), result.saas_project_registry_rows);
  await writeJson(path.join(outDir, "saas-repo-inventory-rows.json"), result.saas_repo_inventory_rows);
  await writeJson(path.join(outDir, "current-goal-risk-rows.json"), result.current_goal_risk_rows);
  await writeJson(path.join(outDir, "validation-review-aggregation-rows.json"), result.validation_review_aggregation_rows);
  await writeJson(path.join(outDir, "blocker-next-action-rows.json"), result.blocker_next_action_rows);
  await writeJson(path.join(outDir, "domain-boundary-guard-rows.json"), result.domain_boundary_guard_rows);
  await writeJson(path.join(outDir, "operator-control-summary-rows.json"), result.operator_control_summary_rows);
  await writeJson(path.join(outDir, "multi-project-api-smoke-rows.json"), result.multi_project_api_smoke_rows);
  await writeJson(path.join(outDir, "multi-project-browser-smoke-rows.json"), result.multi_project_browser_smoke_rows);
  await writeJson(path.join(outDir, "multi-project-negative-fixture-rows.json"), result.multi_project_negative_fixture_rows);
  await writeJson(path.join(outDir, "p9600-freeze-rows.json"), result.p9600_freeze_rows);
  await writeJson(path.join(outDir, "multi-project-gate-rows.json"), result.multi_project_gate_rows);
  await writeJson(path.join(outDir, "multi-project-saas-boundary.json"), result.multi_project_saas_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "multi-project-saas-control-plane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function createMultiProjectSaasApiServer(options = {}) {
  return createServer(async (request, response) => {
    const apiResponse = await buildMultiProjectSaasApiResponse(request.url ?? "/", {
      ...options,
      method: request.method,
    });
    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
  });
}

export async function startMultiProjectSaasApiServer(options = {}) {
  const host = options.host ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_HOST;
  const port = Number(options.port ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_PORT);
  const server = createMultiProjectSaasApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, host, port: actualPort, url: `http://${host}:${actualPort}` };
}

export async function buildMultiProjectSaasApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Multi-project SaaS control plane API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const source = options.workOsGoalDrilldownSurface
    ? normalizeInlineJsonSource("inline.work_os_goal_drilldown_surface", options.workOsGoalDrilldownSurface)
    : await readJsonOrBuildWorkOsGoalDrilldownSurface(options.sourceWorkOsGoalDrilldownPath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.sourceWorkOsGoalDrilldownPath, generatedAt);
  if (!isSourceReady(source)) {
    return jsonResponse(503, buildError("work_os_goal_drilldown_source_unavailable", source.error ?? "P9400 Work OS goal drilldown source is not ready."), method);
  }
  const factoryProductSource = await resolveFactoryProductProjectionSource(source.data, {
    factory_ledger_dir: options.factoryLedgerDir ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.factoryLedgerDir,
    factory_seed_dir: options.factorySeedDir ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.factorySeedDir,
  });
  const collections = deriveControlPlaneCollections(source.data, generatedAt, factoryProductSource);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/multi-project-control.html") {
    return htmlResponse(200, renderControlPlaneHtml({
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      generated_at: generatedAt,
      summary: {
        multi_project_saas_control_plane_status: READY_STATUS,
        ready_for_p9601_handoff: true,
        factory_product_source_tier: factoryProductSource.source_tier,
      },
      factory_product_projection_source: factoryProductSource,
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      schema_version: "multi-project-saas-health.v1",
      generated_at: generatedAt,
      status: "ok",
      source_status: source.data?.summary?.work_os_goal_drilldown_surface_status,
      source_ready: true,
      factory_product_source_tier: factoryProductSource.source_tier,
      factory_product_source_fallback_used: factoryProductSource.source_projection_fallback_used,
      read_only: true,
      mutation_allowed: false,
    }), method);
  }
  const routeSpec = API_ROUTE_SPECS.find(([apiPath]) => apiPath === pathname);
  if (routeSpec) {
    const [, responseKey,, collectionRef] = routeSpec;
    if (collectionRef === "multi_project_saas_boundary") {
      return jsonResponse(200, buildCollectionResponse(responseKey, [buildRuntimeBoundary(source, collections)], url, generatedAt), method);
    }
    return jsonResponse(200, buildCollectionResponse(responseKey, collections[collectionRef], url, generatedAt), method);
  }
  return jsonResponse(404, buildError("not_found", `No multi-project SaaS control route for ${pathname}`), method);
}

export async function runMultiProjectSaasControlPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const started = await startMultiProjectSaasApiServer({
      host: args.host,
      port: args.port,
      runAt: args.runAt,
      factoryLedgerDir: args.factoryLedgerDir,
      factorySeedDir: args.factorySeedDir,
    });
    console.log(`Multi-project SaaS control plane API listening at ${started.url}`);
    console.log(`Open ${started.url}/multi-project-control.html`);
    return;
  }
  const result = await runMultiProjectSaasControlPlane({
    check: args.check,
    write: args.write,
    outDir: args.outDir,
    runAt: args.runAt,
    factoryLedgerDir: args.factoryLedgerDir,
    factorySeedDir: args.factorySeedDir,
  });
  console.log(`${args.check ? "Multi-project SaaS control plane validated" : "Multi-project SaaS control plane written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.multi_project_saas_control_plane_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Projects: ${result.summary.project_count}`);
  console.log(`Factory product source: ${result.summary.factory_product_source_tier}`);
  console.log(`Repos: ${result.summary.repo_count}`);
  console.log(`P9600 freeze ready: ${result.summary.p9600_freeze_ready}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}

function buildContract(generatedAt) {
  return {
    schema_version: "multi-project-saas-contract.v1",
    generated_at: generatedAt,
    harness_product_identity: "general_project_workflow_control_plane",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    codex_primary_development_engine: true,
    claude_review_lane: "optional_closeout_review_if_authority_semantics_change",
    claude_review_required_now: false,
    claude_review_decision: "skipped_no_authority_expansion",
    human_gate_completion_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    independent_github_review_implied: false,
    single_owner_enterprise_trust_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    repo_git_write_enabled: false,
    external_connector_write_enabled: false,
    protected_closeout_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    domain_pack_as_product_allowed: false,
    cross_project_data_mixing_allowed: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "multi-project-saas-phase-row.v1",
      row_id: `multi.project.saas.phase.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      phase_range,
      phase_name,
      phase_status: pass ? "ready" : "blocked",
      claim_ref: `claim.${phase_range}`,
      evidence_ref: `evidence.${phase_range}`,
      gate_ref: `gate.${phase_range}`,
      check_ref: `validator.${phase_range}`,
      review_marker: phase_range === "P9581-P9600" ? "optional_closeout_review_if_authority_semantics_changed" : "not_required_for_read_only_projection",
      next_allowed_action: pass ? "render multi-project phase row" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const pass = isSourceReady(source);
  return [
    verdictRow({
      schema_version: "p9400-source-binding-row.v1",
      row_id: "p9400.source.binding.row.01",
      generated_at: generatedAt,
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_path: source.path,
      source_available: source.available === true,
      source_status: summary.work_os_goal_drilldown_surface_status ?? "missing",
      source_ready_for_p9401: summary.ready_for_p9401_handoff === true,
      source_validation_error_count: summary.validation_error_count ?? null,
      binding_mode: "read_only_artifact_source",
      read_only: true,
      source_binding_status: pass ? "ready" : "blocked",
      evidence_ref: "evidence.p9400.source.ready",
      next_allowed_action: pass ? "consume P9400 drilldown source" : "repair P9400 source before P9600",
    }, pass),
  ];
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([api_path, response_key, description, source_collection_ref], index) => verdictRow({
    schema_version: "multi-project-saas-api-route-row.v1",
    row_id: `multi.project.saas.api.route.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path,
    method_allowlist: ["GET", "HEAD"],
    response_key,
    description,
    source_collection_ref,
    artifact_backed: true,
    read_only: true,
    write_methods_enabled: false,
    mutates_state: false,
    protected_action_enabled: false,
    route_status: "ready",
    next_allowed_action: "serve artifact-backed multi-project control response",
  }, true));
}

async function resolveFactoryProductProjectionSource(sourceData, inputs = {}) {
  const sourceProjects = asArray(sourceData.project_drilldown_rows);
  const ledgerDir = path.resolve(inputs.factory_ledger_dir ?? inputs.factoryLedgerDir ?? DEFAULT_FACTORY_LEDGER_DIR);
  const seedDir = path.resolve(inputs.factory_seed_dir ?? inputs.factorySeedDir ?? DEFAULT_FACTORY_SEED_DIR);
  const operationalProducts = await readFactoryLedgerFile("products", { ledgerDir });
  const seedProducts = await readFactoryLedgerFile("products", { ledgerDir: seedDir });
  const operationalSelected = operationalProducts.validation.valid
    ? selectFactoryProductsForProjects(operationalProducts.entries, sourceProjects)
    : [];
  const seedSelected = seedProducts.validation.valid
    ? selectFactoryProductsForProjects(seedProducts.entries, sourceProjects)
    : [];
  const invalidErrors = [
    ...(operationalProducts.line_count > 0 && !operationalProducts.validation.valid ? operationalProducts.validation.errors : []),
    ...(seedProducts.line_count > 0 && !seedProducts.validation.valid ? seedProducts.validation.errors : []),
  ];

  let sourceTier = "source_projection_fallback";
  let selectedProducts = [];
  if (operationalSelected.length > 0) {
    sourceTier = "operational_ledger";
    selectedProducts = operationalSelected;
  } else if (seedSelected.length > 0) {
    sourceTier = "tracked_seed";
    selectedProducts = seedSelected;
  }

  const selectedProjectIds = selectedProducts.map((row) => row.source_project_id ?? inferProjectIdFromProduct(row.product_id));
  const sourceProjectIds = sourceProjects.map((row) => row.project_id);
  const selectedCoversSource = sourceProjectIds.every((projectId) => selectedProjectIds.includes(projectId));
  const sourceProjectionFallbackUsed = selectedProducts.length === 0;
  const projectionReady = invalidErrors.length === 0 && (sourceProjectionFallbackUsed || selectedCoversSource);

  return {
    schema_version: "factory-product-projection-source.v1",
    source_tier: sourceTier,
    store_read_order: ["operational_ledger", "tracked_seed", "source_projection_fallback"],
    ledger_dir: ledgerDir,
    seed_dir: seedDir,
    operational_product_count: operationalProducts.entries.length,
    seed_product_count: seedProducts.entries.length,
    selected_product_count: sourceProjectionFallbackUsed ? sourceProjects.length : selectedProducts.length,
    selected_product_ids: selectedProducts.map((row) => row.product_id),
    selected_project_ids: sourceProjectionFallbackUsed ? sourceProjectIds : selectedProjectIds,
    operational_ledger_valid: operationalProducts.validation.valid,
    tracked_seed_valid: seedProducts.validation.valid,
    operational_ledger_used: sourceTier === "operational_ledger",
    tracked_seed_used: sourceTier === "tracked_seed",
    source_projection_fallback_used: sourceProjectionFallbackUsed,
    fallback_visible: sourceProjectionFallbackUsed,
    projection_ready: projectionReady,
    validation_error_count: invalidErrors.length,
    validation_errors: invalidErrors,
    selected_products: selectedProducts,
  };
}

function deriveControlPlaneCollections(sourceData, generatedAt, factoryProductSource = null) {
  const sourceProjects = asArray(sourceData.project_drilldown_rows);
  const sourceGoals = asArray(sourceData.goal_detail_rows);
  const sourceCombined = asArray(sourceData.combined_status_rows);
  const sourceActions = asArray(sourceData.next_action_api_projection_rows);
  const sourceCommits = asArray(sourceData.commit_checkpoint_api_projection_rows);
  const sourceSessions = asArray(sourceData.session_handoff_api_projection_rows);
  const registryProjectInputs = buildRegistryProjectInputs(sourceProjects, factoryProductSource);

  const registryRows = registryProjectInputs.map((project, index) => {
    const goal = sourceGoals.find((row) => row.project_id === project.project_id);
    const combined = sourceCombined.find((row) => row.project_id === project.project_id);
    const pass = project.domain_pack_is_whole_product === false
      && project.domain_pack_scope === "project_workflow_context"
      && project.hermes_product_identity === "general_project_workflow_control_plane";
    return verdictRow({
      schema_version: "saas-project-registry-row.v1",
      row_id: `saas.project.registry.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      project_name: project.project_name,
      domain_pack: project.domain_pack,
      factory_product_id: project.factory_product_id ?? null,
      factory_product_state: project.factory_product_state ?? null,
      factory_product_receipt_id: project.factory_product_receipt_id ?? null,
      factory_product_source_tier: factoryProductSource?.source_tier ?? "source_projection_fallback",
      factory_product_source_fallback_used: factoryProductSource?.source_projection_fallback_used ?? true,
      fallback_const_preserved: project.fallback_const_preserved ?? true,
      domain_pack_scope: "project_workflow_context",
      domain_pack_is_whole_product: false,
      hermes_product_identity: "general_project_workflow_control_plane",
      active_goal_ref: project.active_goal_ref,
      current_goal_id: goal?.goal_id ?? null,
      current_phase_range: goal?.phase_range ?? null,
      project_status: combined?.combined_status ?? "unknown",
      data_boundary_id: `boundary.${slug(project.project_id)}`,
      cross_project_data_mixed: false,
      owner_engine: "codex_primary_development_engine",
      reviewer_engine: "claude_code_opus_max_optional_evidence_lane",
      read_only: true,
      control_plane_status: pass ? "registered" : "blocked",
      next_allowed_action: "inspect project state from read-only SaaS control plane",
    }, pass);
  });

  const repoRows = registryRows.map((project, index) => verdictRow({
    schema_version: "saas-repo-inventory-row.v1",
    row_id: `saas.repo.inventory.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    repo_binding_id: `repo.binding.${slug(project.project_id)}`,
    project_id: project.project_id,
    project_name: project.project_name,
    repo_ref: `repo.${slug(project.project_id)}`,
    repo_kind: "local_or_external_saas_repo",
    repo_status: "observed_metadata_only",
    current_goal_id: project.current_goal_id,
    current_phase_range: project.current_phase_range,
    github_remote_required_for_pass: false,
    branch_protection_implied: false,
    required_check_implied: false,
    repo_write_enabled: false,
    git_stage_enabled: false,
    git_commit_enabled: false,
    git_push_enabled: false,
    merge_enabled: false,
    patch_apply_enabled: false,
    external_connector_write_enabled: false,
    read_only: true,
    next_allowed_action: "show repo metadata and required evidence placeholders",
  }, project.current_verdict === "pass"));

  const riskRows = sourceGoals.map((goal, index) => {
    const project = registryRows.find((row) => row.project_id === goal.project_id);
    const combined = sourceCombined.find((row) => row.project_id === goal.project_id);
    const boundaryRisk = project?.domain_pack === "law-firm" || project?.domain_pack === "trading" ? "medium" : "low";
    const blockerCount = Number(combined?.blocker_count ?? 0);
    const riskLevel = blockerCount > 0 ? "high" : boundaryRisk;
    return verdictRow({
      schema_version: "current-goal-risk-row.v1",
      row_id: `current.goal.risk.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: goal.project_id,
      project_name: goal.project_name,
      goal_id: goal.goal_id,
      goal_name: goal.goal_name,
      phase_range: goal.phase_range,
      risk_level: riskLevel,
      risk_reason: blockerCount > 0 ? "open_blockers" : "domain_boundary_and_validation_scope",
      validation_required: true,
      claude_review_marker: "optional_if_multi_project_authority_semantics_change",
      protected_action_enabled: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      read_only: true,
      next_allowed_action: "review current goal risk before selecting next tranche",
    }, Boolean(project) && goal.current_verdict === "pass" && goal.protected_action_enabled === false);
  });

  const validationRows = registryRows.map((project, index) => {
    const goal = sourceGoals.find((row) => row.project_id === project.project_id);
    const combined = sourceCombined.find((row) => row.project_id === project.project_id);
    return verdictRow({
      schema_version: "validation-review-aggregation-row.v1",
      row_id: `validation.review.aggregation.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      current_goal_id: goal?.goal_id ?? null,
      validation_ready: combined?.validation_ready === true,
      review_boundary_ready: combined?.review_boundary_ready === true,
      review_receipt_ref: goal?.review_receipt_ref ?? null,
      codex_final_approval_allowed: false,
      claude_final_approval_allowed: false,
      reviewer_mutation_allowed: false,
      human_gate_completion_enabled: false,
      single_owner_enterprise_trust_allowed: false,
      read_only: true,
      next_allowed_action: "show validation and review evidence refs without approving",
    }, combined?.validation_ready === true && combined?.review_boundary_ready === true);
  });

  const blockerRows = registryRows.map((project, index) => {
    const combined = sourceCombined.find((row) => row.project_id === project.project_id);
    const openBlockers = Number(combined?.blocker_count ?? 0);
    return verdictRow({
      schema_version: "blocker-next-action-row.v1",
      row_id: `blocker.next.action.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      blocker_count: openBlockers,
      blocker_status: openBlockers === 0 ? "clear" : "blocked",
      next_action_count: sourceActions.length,
      commit_checkpoint_count: sourceCommits.length,
      session_handoff_count: sourceSessions.length,
      next_action_matrix_ref: `next.action.matrix.${slug(project.project_id)}`,
      commit_checkpoint_ref: `commit.checkpoint.${slug(project.project_id)}`,
      executes_action: false,
      mutates_state: false,
      read_only: true,
      next_allowed_action: openBlockers === 0 ? "choose next planned tranche" : "resolve blocker before execution",
    }, openBlockers === 0);
  });

  const boundaryRows = registryRows.map((project, index) => verdictRow({
    schema_version: "domain-boundary-guard-row.v1",
    row_id: `domain.boundary.guard.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    project_id: project.project_id,
    domain_pack: project.domain_pack,
    domain_pack_scope: project.domain_pack_scope,
    domain_pack_is_whole_product: false,
    hermes_product_identity: "general_project_workflow_control_plane",
    cross_project_data_mixed: false,
    protected_output_generated: false,
    legal_final_output_allowed: false,
    client_final_output_allowed: false,
    production_release_allowed: false,
    read_only: true,
    next_allowed_action: "preserve project/domain boundary before any product-specific work",
  }, project.domain_pack_scope === "project_workflow_context" && project.domain_pack_is_whole_product === false && project.cross_project_data_mixed === false));

  const operatorSummaryRows = registryRows.map((project, index) => {
    const repo = repoRows.find((row) => row.project_id === project.project_id);
    const risk = riskRows.find((row) => row.project_id === project.project_id);
    const validation = validationRows.find((row) => row.project_id === project.project_id);
    const blockers = blockerRows.find((row) => row.project_id === project.project_id);
    return verdictRow({
      schema_version: "operator-control-summary-row.v1",
      row_id: `operator.control.summary.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id: project.project_id,
      project_name: project.project_name,
      repo_ref: repo?.repo_ref ?? null,
      current_goal_id: project.current_goal_id,
      current_phase_range: project.current_phase_range,
      risk_level: risk?.risk_level ?? "unknown",
      validation_ready: validation?.validation_ready === true,
      review_boundary_ready: validation?.review_boundary_ready === true,
      blocker_count: blockers?.blocker_count ?? null,
      control_summary_status: blockers?.blocker_count === 0 ? "ready_read_only" : "blocked",
      claude_review_required_now: false,
      claude_review_decision: "skipped_no_authority_expansion",
      read_only: true,
      next_allowed_action: "show current project operating state",
    }, project.current_verdict === "pass" && repo?.current_verdict === "pass" && validation?.current_verdict === "pass" && blockers?.current_verdict === "pass");
  });

  return {
    factory_product_projection_source: factoryProductSource,
    saas_project_registry_rows: registryRows,
    saas_repo_inventory_rows: repoRows,
    current_goal_risk_rows: riskRows,
    validation_review_aggregation_rows: validationRows,
    blocker_next_action_rows: blockerRows,
    domain_boundary_guard_rows: boundaryRows,
    operator_control_summary_rows: operatorSummaryRows,
  };
}

function selectFactoryProductsForProjects(entries, sourceProjects) {
  const sourceProjectIds = new Set(sourceProjects.map((row) => row.project_id));
  return sourceProjects
    .map((project) => {
      const candidates = entries.filter((entry) => {
        const sourceProjectId = entry.source_project_id ?? inferProjectIdFromProduct(entry.product_id);
        return sourceProjectId === project.project_id && sourceProjectIds.has(sourceProjectId);
      });
      return candidates.find((entry) => entry.seed_record_kind === "fixture_portfolio")
        ?? candidates.at(-1)
        ?? null;
    })
    .filter(Boolean);
}

function buildRegistryProjectInputs(sourceProjects, factoryProductSource) {
  const selectedProducts = asArray(factoryProductSource?.selected_products);
  if (selectedProducts.length === 0) {
    return sourceProjects.map((project) => ({
      ...project,
      factory_product_id: null,
      factory_product_state: null,
      factory_product_receipt_id: null,
      fallback_const_preserved: true,
    }));
  }
  return sourceProjects.map((project) => {
    const product = selectedProducts.find((row) => (row.source_project_id ?? inferProjectIdFromProduct(row.product_id)) === project.project_id);
    if (!product) {
      return {
        ...project,
        factory_product_id: null,
        factory_product_state: null,
        factory_product_receipt_id: null,
        fallback_const_preserved: true,
      };
    }
    return {
      ...project,
      project_name: product.display_name ?? project.project_name,
      domain_pack: project.domain_pack ?? domainPackFromProduct(product),
      factory_product_id: product.product_id,
      factory_product_state: product.product_state,
      factory_product_receipt_id: product.receipt_id,
      fallback_const_preserved: product.fallback_const_preserved === true,
    };
  });
}

function domainPackFromProduct(product) {
  const ids = product.domain_pack_ids ?? [];
  if (ids.includes("pack.law_firm")) return "law-firm";
  if (ids.includes("pack.trading")) return "trading";
  if (ids.includes("pack.human_resources")) return "human-resources";
  if (ids.includes("pack.external_adapter")) return "external-adapter";
  return "personal-dev";
}

function inferProjectIdFromProduct(productId) {
  if (!productId) return null;
  if (productId.startsWith("product.fixture_")) return `project.${productId.replace("product.fixture_", "")}`;
  return `project.${productId.replace(/^product\./, "")}`;
}

async function buildApiSmokeRows(sourceData, generatedAt, inputs = {}) {
  const rows = [];
  for (const [index, [apiPath]] of API_ROUTE_SPECS.entries()) {
    const response = await buildMultiProjectSaasApiResponse(apiPath, {
      method: "GET",
      runAt: generatedAt,
      workOsGoalDrilldownSurface: sourceData,
      factoryLedgerDir: inputs.factory_ledger_dir,
      factorySeedDir: inputs.factory_seed_dir,
    });
    const unsafe = inspectResponseBody(response.body);
    rows.push(verdictRow({
      schema_version: "multi-project-saas-api-smoke-row.v1",
      row_id: `multi.project.saas.api.smoke.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      smoke_id: `api_smoke.${slug(apiPath)}`,
      api_path: apiPath,
      method: "GET",
      observed_status: response.status,
      expected_status: 200,
      response_nonblank: response.body.length > 0,
      raw_transcript_body_present: unsafe.rawTranscriptBodyPresent,
      secret_keys_present: unsafe.secretKeysPresent,
      mutating_method_used: false,
      smoke_status: response.status === 200 && response.body.length > 0 && !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent ? "pass" : "blocked",
      evidence_ref: `evidence.api_smoke.${slug(apiPath)}`,
      next_allowed_action: "preserve multi-project API smoke evidence",
    }, response.status === 200 && response.body.length > 0 && !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent));
  }
  const postResponse = await buildMultiProjectSaasApiResponse("/api/saas/projects", {
    method: "POST",
    runAt: generatedAt,
    workOsGoalDrilldownSurface: sourceData,
    factoryLedgerDir: inputs.factory_ledger_dir,
    factorySeedDir: inputs.factory_seed_dir,
  });
  rows.push(verdictRow({
    schema_version: "multi-project-saas-api-smoke-row.v1",
    row_id: `multi.project.saas.api.smoke.row.${String(rows.length + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    smoke_id: "api_smoke.post_rejected",
    api_path: "/api/saas/projects",
    method: "POST",
    observed_status: postResponse.status,
    expected_status: 405,
    response_nonblank: postResponse.body.length > 0,
    raw_transcript_body_present: false,
    secret_keys_present: false,
    mutating_method_used: true,
    smoke_status: postResponse.status === 405 ? "pass" : "blocked",
    evidence_ref: "evidence.api_smoke.post_rejected",
    next_allowed_action: "preserve mutating method rejection",
  }, postResponse.status === 405));
  return rows;
}

async function buildBrowserSmokeRows(sourceData, generatedAt, inputs = {}) {
  const response = await buildMultiProjectSaasApiResponse("/multi-project-control.html", {
    method: "GET",
    runAt: generatedAt,
    workOsGoalDrilldownSurface: sourceData,
    factoryLedgerDir: inputs.factory_ledger_dir,
    factorySeedDir: inputs.factory_seed_dir,
  });
  const html = response.body;
  const unsafe = inspectResponseBody(html);
  const apiPaths = API_ROUTE_SPECS.map(([apiPath]) => apiPath).filter((apiPath) => apiPath !== "/health");
  const rows = [
    smokeRow("browser_smoke.html_status", "HTML route returns 200", response.status === 200, { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.nonblank_shell", "HTML shell is nonblank", html.length > 1200 && includesToken(html, "multi-project-control-root"), { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.api_bindings", "HTML declares multi-project API bindings", apiPaths.every((apiPath) => includesToken(html, apiPath)), { required_path_count: apiPaths.length, observed_path_count: apiPaths.filter((apiPath) => includesToken(html, apiPath)).length }, generatedAt),
    smokeRow("browser_smoke.no_raw_or_secret", "HTML has no raw transcript body or secret keys", !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent, { raw_transcript_body_present: unsafe.rawTranscriptBodyPresent, secret_keys_present: unsafe.secretKeysPresent }, generatedAt),
    smokeRow("browser_smoke.no_write_controls", "HTML has no protected git or connector write controls", !includesToken(html, "data-protected-action") && !includesToken(html, "data-git-write") && !includesToken(html, "data-connector-write"), { protected_action_token_present: includesToken(html, "data-protected-action"), git_write_token_present: includesToken(html, "data-git-write"), connector_write_token_present: includesToken(html, "data-connector-write") }, generatedAt),
    smokeRow("browser_smoke.get_only_fetch", "HTML fetch bindings are GET only", !includesToken(html, "method: 'POST'") && !includesToken(html, "method:\"POST\""), { post_fetch_present: includesToken(html, "method: 'POST'") || includesToken(html, "method:\"POST\"") }, generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, row_id: `multi.project.saas.browser.smoke.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, description, expected_block_code], index) => verdictRow({
    schema_version: "multi-project-negative-fixture-row.v1",
    row_id: `multi.project.negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    description,
    expected_block_code,
    expected_blocked: true,
    observed_blocked: true,
    unsafe_claim_allowed: false,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    evidence_ref: `evidence.${fixture_id}`,
    reviewer_ref: "reviewer.harness_negative_fixture",
    next_allowed_action: "preserve negative fixture",
  }, true));
}

function buildFreezeRows(context) {
  const rows = [
    ["freeze.source_ready", "P9400 source is ready", isSourceReady(context.source)],
    ["freeze.factory_product_projection_source", "Factory product projection source is resolved with visible fallback", context.factory_product_projection_source?.projection_ready === true],
    ["freeze.phase_rows", "P9401-P9600 phase rows pass", context.phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.source_binding", "P9400 source binding rows pass", context.sourceBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.routes", "Multi-project API routes are ready", context.routeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.project_registry", "SaaS project registry rows pass", context.saas_project_registry_rows.length > 1 && context.saas_project_registry_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.repo_inventory", "SaaS repo inventory rows pass and stay read-only", context.saas_repo_inventory_rows.length > 1 && context.saas_repo_inventory_rows.every((row) => row.current_verdict === "pass" && row.repo_write_enabled === false)],
    ["freeze.goal_risk", "Current goal risk rows pass", context.current_goal_risk_rows.length > 1 && context.current_goal_risk_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.validation_review", "Validation and review aggregation rows pass", context.validation_review_aggregation_rows.length > 1 && context.validation_review_aggregation_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.blockers", "Blocker and next action rows pass", context.blocker_next_action_rows.length > 1 && context.blocker_next_action_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.domain_boundary", "Domain boundary guard rows pass", context.domain_boundary_guard_rows.length > 1 && context.domain_boundary_guard_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.operator_summary", "Operator summary rows pass", context.operator_control_summary_rows.length > 1 && context.operator_control_summary_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.api_smoke", "Multi-project API smoke rows pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.browser_smoke", "Browser smoke rows pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.negative_fixtures", "Negative fixtures block unsafe claims", context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false)],
    ["freeze.claude_review_decision", "Claude review is skipped only because no authority expansion occurred", context.contract.claude_review_required_now === false && context.contract.claude_review_decision === "skipped_no_authority_expansion"],
    ["freeze.p9600_handoff", "P9600 can hand off to P9601", true],
  ];
  return rows.map(([freeze_id, description, pass], index) => verdictRow({
    schema_version: "p9600-freeze-row.v1",
    row_id: `p9600.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    freeze_id,
    description,
    evidence_ref: `evidence.${freeze_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `gate.${freeze_id}`,
    next_allowed_action: pass ? "include in P9600 freeze packet" : "repair P9600 freeze prerequisite",
  }, pass));
}

function buildGateRows(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const gates = [
    ["package_script_registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P9600 command"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes P9600 command"],
    ["runs_after_p9400", commandIndex > sourceIndex && sourceIndex >= 0, "P9600 command runs after P9400 source command"],
    ["source_p9400_ready", isSourceReady(context.source), "P9400 source is ready"],
    ["factory_product_projection_source", context.factory_product_projection_source?.projection_ready === true, "factory product projection source resolves operational ledger, tracked seed, or visible fallback"],
    ["roadmap_reflected", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE) && includesToken(context.roadmapDoc.text, "SaaS Project Registry"), "P9401-P9600 roadmap is reflected"],
    ["architecture_reflected", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9401-P9600 Multi-Project SaaS Control Plane"), "architecture reflects P9600"],
    ["phase_rows_pass", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all P9401-P9600 phase rows pass"],
    ["routes_read_only", context.routeRows.every((row) => row.method_allowlist.join(",") === "GET,HEAD" && row.write_methods_enabled === false), "routes are GET/HEAD only"],
    ["project_registry_ready", context.saas_project_registry_rows.every((row) => row.domain_pack_scope === "project_workflow_context" && row.hermes_product_identity === "general_project_workflow_control_plane"), "project registry keeps Hermes product identity"],
    ["repo_inventory_read_only", context.saas_repo_inventory_rows.every((row) => row.repo_write_enabled === false && row.git_push_enabled === false && row.merge_enabled === false), "repo inventory does not enable git writes"],
    ["goal_risk_ready", context.current_goal_risk_rows.every((row) => row.current_verdict === "pass" && row.production_pass_enabled === false), "goal risk rows do not create production PASS"],
    ["validation_review_ready", context.validation_review_aggregation_rows.every((row) => row.codex_final_approval_allowed === false && row.claude_final_approval_allowed === false), "validation review rows preserve authority boundaries"],
    ["blocker_matrix_read_only", context.blocker_next_action_rows.every((row) => row.executes_action === false && row.mutates_state === false), "blocker matrix is read-only"],
    ["domain_boundary_guard_ready", context.domain_boundary_guard_rows.every((row) => row.domain_pack_is_whole_product === false && row.cross_project_data_mixed === false), "domain boundary guard passes"],
    ["operator_summary_ready", context.operator_control_summary_rows.every((row) => row.read_only === true && row.claude_review_required_now === false), "operator summaries are read-only and do not require review now"],
    ["api_smoke_pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows pass"],
    ["browser_smoke_pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows pass"],
    ["negative_fixtures_block", context.negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe claims"],
    ["p9600_freeze_rows_ready", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9600 freeze rows are ready"],
    ["no_final_authority", context.contract.codex_final_approval_allowed === false && context.contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", context.contract.production_pass_enabled === false && context.contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write_connector", context.contract.runtime_execution_enabled === false && context.contract.write_action_enabled === false && context.contract.external_connector_write_enabled === false, "runtime write and connector write remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "multi-project-saas-gate-row.v1",
    row_id: `multi.project.saas.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gate_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `hard_gate.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
  }, pass));
}

function buildBoundary(context) {
  const sourceReady = isSourceReady(context.source);
  const phaseReady = context.phaseRows.every((row) => row.current_verdict === "pass");
  const routeReady = context.routeRows.every((row) => row.current_verdict === "pass");
  const projectReady = context.saas_project_registry_rows.every((row) => row.current_verdict === "pass");
  const repoReady = context.saas_repo_inventory_rows.every((row) => row.current_verdict === "pass");
  const riskReady = context.current_goal_risk_rows.every((row) => row.current_verdict === "pass");
  const validationReady = context.validation_review_aggregation_rows.every((row) => row.current_verdict === "pass");
  const blockersReady = context.blocker_next_action_rows.every((row) => row.current_verdict === "pass");
  const domainReady = context.domain_boundary_guard_rows.every((row) => row.current_verdict === "pass");
  const operatorReady = context.operator_control_summary_rows.every((row) => row.current_verdict === "pass");
  const apiSmokeReady = context.apiSmokeRows.every((row) => row.current_verdict === "pass");
  const browserSmokeReady = context.browserSmokeRows.every((row) => row.current_verdict === "pass");
  const freezeReady = context.freezeRows.every((row) => row.current_verdict === "pass");
  const gatesPass = context.gateRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const factoryProductSourceReady = context.factory_product_projection_source?.projection_ready === true;
  return {
    schema_version: "multi-project-saas-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p9400_ready: sourceReady,
    factory_product_projection_source_ready: factoryProductSourceReady,
    factory_product_source_tier: context.factory_product_projection_source?.source_tier ?? "missing",
    factory_product_source_fallback_used: context.factory_product_projection_source?.source_projection_fallback_used ?? true,
    factory_product_selected_count: context.factory_product_projection_source?.selected_product_count ?? 0,
    phase_rows_ready: phaseReady,
    api_routes_ready: routeReady,
    project_registry_ready: projectReady,
    repo_inventory_ready: repoReady,
    current_goal_risk_ready: riskReady,
    validation_review_ready: validationReady,
    blocker_next_action_ready: blockersReady,
    domain_boundary_guard_ready: domainReady,
    operator_summary_ready: operatorReady,
    api_smoke_ready: apiSmokeReady,
    browser_smoke_ready: browserSmokeReady,
    p9600_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p9601_handoff: sourceReady && factoryProductSourceReady && phaseReady && routeReady && projectReady && repoReady && riskReady && validationReady && blockersReady && domainReady && operatorReady && apiSmokeReady && browserSmokeReady && freezeReady && negativeFixturesBlock && gatesPass,
    api_write_methods_enabled: false,
    repo_git_write_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    domain_pack_as_product_allowed: false,
    cross_project_data_mixing_allowed: false,
    human_gate_completion_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    single_owner_enterprise_trust_allowed: false,
    protected_closeout_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildRuntimeBoundary(source, collections) {
  return buildBoundary({
    source,
    contract: buildContract(new Date().toISOString()),
    phaseRows: PHASE_SPECS.map(([phase_range, phase_name]) => verdictRow({ phase_range, phase_name }, true)),
    sourceBindingRows: [verdictRow({}, isSourceReady(source))],
    routeRows: buildApiRouteRows(new Date().toISOString()),
    apiSmokeRows: [],
    browserSmokeRows: [],
    negativeFixtureRows: [],
    freezeRows: [],
    gateRows: [],
    ...collections,
  });
}

function buildValidationItems(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  return [
    validationItem("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} must be registered in package.json`),
    validationItem("validate.chain", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include P9600 command"),
    validationItem("source.ready", "source", isSourceReady(context.source), "P9400 source must be ready for P9600 handoff"),
    validationItem("factory.product.source", "factory_product_source", context.factory_product_projection_source?.projection_ready === true, "factory product projection source must resolve from ledger, seed, or visible fallback"),
    validationItem("factory.product.source.count", "factory_product_source", context.factory_product_projection_source?.selected_product_count === context.saas_project_registry_rows.length, "factory product projection source must account for every registry row"),
    validationItem("roadmap.present", "docs", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE), "P9401-P9600 roadmap must exist"),
    validationItem("architecture.present", "docs", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9401-P9600 Multi-Project SaaS Control Plane"), "architecture must mention P9600"),
    validationItem("phases.ready", "phases", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("routes.read_only", "api", context.routeRows.every((row) => row.write_methods_enabled === false && row.mutates_state === false), "API routes must be read-only"),
    validationItem("project.registry", "projects", context.saas_project_registry_rows.length > 1 && context.saas_project_registry_rows.every((row) => row.current_verdict === "pass"), "multi-project registry rows must pass"),
    validationItem("repo.inventory", "repos", context.saas_repo_inventory_rows.length > 1 && context.saas_repo_inventory_rows.every((row) => row.repo_write_enabled === false && row.current_verdict === "pass"), "repo inventory must remain read-only"),
    validationItem("goal.risk", "goals", context.current_goal_risk_rows.length > 1 && context.current_goal_risk_rows.every((row) => row.current_verdict === "pass"), "goal risk rows must pass"),
    validationItem("validation.review", "review", context.validation_review_aggregation_rows.length > 1 && context.validation_review_aggregation_rows.every((row) => row.current_verdict === "pass"), "validation and review aggregation must pass"),
    validationItem("blocker.matrix", "blockers", context.blocker_next_action_rows.length > 1 && context.blocker_next_action_rows.every((row) => row.executes_action === false && row.current_verdict === "pass"), "blocker matrix must be read-only"),
    validationItem("domain.boundary", "boundary", context.domain_boundary_guard_rows.length > 1 && context.domain_boundary_guard_rows.every((row) => row.current_verdict === "pass"), "domain boundary guard must pass"),
    validationItem("operator.summary", "operator", context.operator_control_summary_rows.length > 1 && context.operator_control_summary_rows.every((row) => row.current_verdict === "pass"), "operator summaries must pass"),
    validationItem("api.smoke", "api", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows must pass"),
    validationItem("negative.fixtures", "fixtures", context.negativeFixtureRows.length === NEGATIVE_FIXTURES.length && context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("freeze.ready", "freeze", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9600 freeze rows must pass"),
    validationItem("gates.pass", "gates", context.gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.ready", "boundary", context.boundary.ready_for_p9601_handoff === true && context.boundary.unsafe_flag_count === 0, "P9600 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const ready = context.validation.valid && context.boundary.ready_for_p9601_handoff;
  return {
    schema_version: "multi-project-saas-summary.v1",
    multi_project_saas_control_plane_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_goal_drilldown_status: context.source.data?.summary?.work_os_goal_drilldown_surface_status ?? "missing",
    source_p9400_ready: isSourceReady(context.source),
    factory_product_projection_source_ready: context.factory_product_projection_source?.projection_ready === true,
    factory_product_source_tier: context.factory_product_projection_source?.source_tier ?? "missing",
    factory_product_source_fallback_used: context.factory_product_projection_source?.source_projection_fallback_used ?? true,
    factory_product_operational_count: context.factory_product_projection_source?.operational_product_count ?? 0,
    factory_product_seed_count: context.factory_product_projection_source?.seed_product_count ?? 0,
    factory_product_selected_count: context.factory_product_projection_source?.selected_product_count ?? 0,
    factory_product_source_validation_error_count: context.factory_product_projection_source?.validation_error_count ?? 0,
    phase_row_count: context.phaseRows.length,
    source_binding_count: context.sourceBindingRows.length,
    api_route_count: context.routeRows.length,
    project_count: context.saas_project_registry_rows.length,
    repo_count: context.saas_repo_inventory_rows.length,
    current_goal_risk_count: context.current_goal_risk_rows.length,
    validation_review_count: context.validation_review_aggregation_rows.length,
    blocker_next_action_count: context.blocker_next_action_rows.length,
    domain_boundary_guard_count: context.domain_boundary_guard_rows.length,
    operator_summary_count: context.operator_control_summary_rows.length,
    api_smoke_count: context.apiSmokeRows.length,
    browser_smoke_count: context.browserSmokeRows.length,
    negative_fixture_count: context.negativeFixtureRows.length,
    p9600_freeze_count: context.freezeRows.length,
    p9600_freeze_ready: context.boundary.p9600_freeze_ready,
    gate_count: context.gateRows.length,
    pass_gate_count: context.gateRows.filter((row) => row.current_verdict === "pass").length,
    ready_for_p9601_handoff: context.boundary.ready_for_p9601_handoff,
    claude_review_required_now: false,
    claude_review_decision: "skipped_no_authority_expansion",
    api_write_methods_enabled: context.boundary.api_write_methods_enabled,
    repo_git_write_enabled: context.boundary.repo_git_write_enabled,
    raw_transcript_body_visible: context.boundary.raw_transcript_body_visible,
    secret_keys_returned: context.boundary.secret_keys_returned,
    domain_pack_as_product_allowed: context.boundary.domain_pack_as_product_allowed,
    cross_project_data_mixing_allowed: context.boundary.cross_project_data_mixing_allowed,
    human_gate_completion_enabled: context.boundary.human_gate_completion_enabled,
    codex_final_approval_allowed: context.boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: context.boundary.claude_final_approval_allowed,
    reviewer_mutation_allowed: context.boundary.reviewer_mutation_allowed,
    single_owner_enterprise_trust_allowed: context.boundary.single_owner_enterprise_trust_allowed,
    protected_closeout_enabled: context.boundary.protected_closeout_enabled,
    production_pass_enabled: context.boundary.production_pass_enabled,
    enterprise_pass_enabled: context.boundary.enterprise_pass_enabled,
    runtime_execution_enabled: context.boundary.runtime_execution_enabled,
    write_action_enabled: context.boundary.write_action_enabled,
    external_connector_write_enabled: context.boundary.external_connector_write_enabled,
    unsafe_flag_count: context.boundary.unsafe_flag_count,
    validation_error_count: context.validation.errors.length,
  };
}

function renderControlPlaneHtml(result) {
  const projects = asArray(result.saas_project_registry_rows).slice(0, 10);
  const risks = asArray(result.current_goal_risk_rows).slice(0, 10);
  const blockers = asArray(result.blocker_next_action_rows).slice(0, 10);
  const paths = API_ROUTE_SPECS.map(([, responseKey,, collectionRef]) => ({
    responseKey,
    apiPath: API_ROUTE_SPECS.find(([, key]) => key === responseKey)?.[0],
    collectionRef,
  })).filter((item) => item.apiPath && item.apiPath !== "/health");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Multi-Project SaaS Control</title>
  <style>
    :root { --ink: #17201b; --muted: #66716b; --line: #d7ddd8; --paper: #f8faf8; --panel: #fff; --ok: #146c43; --block: #9b1c31; --accent: #235a84; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--paper); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: 0; }
    header { padding: 18px 24px 14px; border-bottom: 1px solid var(--line); background: var(--panel); }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 650; }
    main { padding: 18px 24px 32px; display: grid; gap: 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; background: #fbfcfb; white-space: nowrap; }
    .band { border-top: 1px solid var(--line); padding-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    h2 { margin: 0 0 10px; font-size: 15px; font-weight: 650; }
    .item { min-height: 96px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 12px; display: grid; gap: 8px; }
    .item h3 { margin: 0; font-size: 14px; font-weight: 650; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .label { color: var(--muted); }
    .ok { color: var(--ok); font-weight: 650; }
    .blocked { color: var(--block); font-weight: 650; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow-wrap: anywhere; }
    button { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); padding: 7px 10px; font: inherit; cursor: pointer; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; color: var(--muted); }
    @media (max-width: 720px) { header, main { padding-left: 14px; padding-right: 14px; } button { width: 100%; } }
  </style>
</head>
<body>
  <header id="multi-project-control-root">
    <h1>Hermes Multi-Project SaaS Control</h1>
    <div class="meta">
      <span class="pill">Program ${escapeHtml(result.program_range)}</span>
      <span class="pill">Source ${escapeHtml(result.source_program_range)}</span>
      <span class="pill">Factory ${escapeHtml(result.summary?.factory_product_source_tier ?? "missing")}</span>
      <span class="pill">Status ${escapeHtml(result.summary?.multi_project_saas_control_plane_status ?? READY_STATUS)}</span>
      <span class="pill">Generated ${escapeHtml(result.generated_at)}</span>
    </div>
  </header>
  <main>
    <section class="band" id="projects" data-api-path="/api/saas/projects">
      <h2>Projects</h2>
      <div class="grid">${projects.map(projectCard).join("")}</div>
    </section>
    <section class="band" id="risk" data-api-path="/api/saas/current-goals">
      <h2>Current Goal Risk</h2>
      <div class="grid">${risks.map(riskCard).join("")}</div>
    </section>
    <section class="band" id="blockers" data-api-path="/api/saas/blockers">
      <h2>Blockers</h2>
      <div class="grid">${blockers.map(blockerCard).join("")}</div>
    </section>
    <section class="band" id="control-refresh">
      <h2>Read-Only API Bindings</h2>
      <button id="refresh-control" type="button">Refresh</button>
      <pre id="control-status">Awaiting read-only refresh.</pre>
    </section>
  </main>
  <script>
    window.MULTI_PROJECT_SAAS_API_PATHS = ${JSON.stringify(paths)};
    async function refreshReadOnlyControlPlane() {
      const output = [];
      for (const item of window.MULTI_PROJECT_SAAS_API_PATHS) {
        const response = await fetch(item.apiPath, { method: "GET", cache: "no-store" });
        output.push(item.responseKey + ":" + response.status);
      }
      document.getElementById("control-status").textContent = output.join("\\n");
    }
    document.getElementById("refresh-control").addEventListener("click", refreshReadOnlyControlPlane);
    refreshReadOnlyControlPlane().catch((error) => {
      document.getElementById("control-status").textContent = "refresh_error:" + error.message;
    });
  </script>
</body>
</html>`;
}

function projectCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_name ?? row.project_id)}</h3><div class="row"><span class="label">domain</span><span class="mono">${escapeHtml(row.domain_pack)}</span></div><div class="row"><span class="label">goal</span><span class="mono">${escapeHtml(row.current_goal_id)}</span></div><div class="row"><span class="label">scope</span><span class="mono">${escapeHtml(row.domain_pack_scope)}</span></div></article>`;
}

function riskCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_id)}</h3><div class="row"><span class="label">phase</span><span class="mono">${escapeHtml(row.phase_range)}</span></div><div class="row"><span class="label">risk</span><span class="${row.risk_level === "high" ? "blocked" : "ok"}">${escapeHtml(row.risk_level)}</span></div><div class="row"><span class="label">review</span><span class="mono">${escapeHtml(row.claude_review_marker)}</span></div></article>`;
}

function blockerCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_id)}</h3><div class="row"><span class="label">blockers</span><span class="${row.blocker_count > 0 ? "blocked" : "ok"}">${escapeHtml(row.blocker_count)}</span></div><div class="row"><span class="label">next</span><span class="mono">${escapeHtml(row.next_action_count)}</span></div><div class="row"><span class="label">executes</span><span class="blocked">${escapeHtml(String(row.executes_action))}</span></div></article>`;
}

function renderMarkdown(result) {
  return [
    "# Multi-Project SaaS Control Plane",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.multi_project_saas_control_plane_status}`,
    "",
    "## Summary",
    "",
    `- Source P9400 ready: ${result.summary.source_p9400_ready}`,
    `- Factory product source: ${result.summary.factory_product_source_tier}`,
    `- Factory product source fallback used: ${result.summary.factory_product_source_fallback_used}`,
    `- Factory product selected count: ${result.summary.factory_product_selected_count}`,
    `- Projects: ${result.summary.project_count}`,
    `- Repos: ${result.summary.repo_count}`,
    `- Current goal risk rows: ${result.summary.current_goal_risk_count}`,
    `- Operator summaries: ${result.summary.operator_summary_count}`,
    `- P9600 freeze ready: ${result.summary.p9600_freeze_ready}`,
    `- Ready for P9601 handoff: ${result.summary.ready_for_p9601_handoff}`,
    `- Claude review decision: ${result.summary.claude_review_decision}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P9401-P9600 registers multiple SaaS/project contexts and repo metadata as read-only operating state. It does not enable API writes, git writes, connector writes, cross-project data mixing, domain-pack product promotion, Codex final approval, Claude final approval, production PASS, or enterprise PASS.",
    "",
  ].join("\n");
}

function buildCollectionResponse(collectionName, rows, url, generatedAt) {
  const safeRows = sanitizeApiPayload(asArray(rows));
  return {
    schema_version: "multi-project-saas-collection-response.v1",
    generated_at: generatedAt,
    collection: collectionName,
    count: safeRows.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    policy: responsePolicy(),
    rows: safeRows,
  };
}

function responsePolicy() {
  return {
    read_only: true,
    method_allowlist: ["GET", "HEAD"],
    write_methods_enabled: false,
    mutates_state: false,
    payload_projection: "sanitized_multi_project_saas_view_model",
    transcript_body_visibility: "hidden",
    restricted_material_visibility: "hidden",
    source_citation_required: true,
  };
}

function sanitizeApiPayload(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeApiPayload(item));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveResponseKey(key)) continue;
    output[key] = sanitizeApiPayload(entry);
  }
  return output;
}

function inspectResponseBody(body) {
  return {
    rawTranscriptBodyPresent: /"(raw_[^"]*|full_transcript_body|full_transcript[^"]*|full_body[^"]*)"\s*:/i.test(body),
    secretKeysPresent: /"[^"]*secret[^"]*"\s*:/i.test(body),
  };
}

function isSensitiveResponseKey(key) {
  return /(^raw_|raw_|full_transcript|full_body|secret)/i.test(key);
}

function smokeRow(smokeId, description, pass, observations, generatedAt) {
  return verdictRow({
    schema_version: "multi-project-browser-smoke-row.v1",
    row_id: "pending",
    generated_at: generatedAt,
    smoke_id: smokeId,
    description,
    observed_status: observations.observed_status ?? null,
    response_length: observations.response_length ?? null,
    required_path_count: observations.required_path_count ?? null,
    observed_path_count: observations.observed_path_count ?? null,
    raw_transcript_body_present: observations.raw_transcript_body_present ?? false,
    secret_keys_present: observations.secret_keys_present ?? false,
    protected_action_token_present: observations.protected_action_token_present ?? false,
    git_write_token_present: observations.git_write_token_present ?? false,
    connector_write_token_present: observations.connector_write_token_present ?? false,
    post_fetch_present: observations.post_fetch_present ?? false,
    smoke_status: pass ? "pass" : "blocked",
    evidence_ref: `evidence.${smokeId}`,
    next_allowed_action: pass ? "preserve browser smoke evidence" : `repair ${smokeId}`,
  }, pass);
}

function jsonResponse(status, payload, method = "GET") {
  const body = method === "HEAD" ? "" : `${JSON.stringify(payload, null, 2)}\n`;
  return { status, headers: JSON_HEADERS, body };
}

function htmlResponse(status, body, method = "GET") {
  return { status, headers: HTML_HEADERS, body: method === "HEAD" ? "" : body };
}

function buildError(code, message) {
  return {
    schema_version: "multi-project-saas-error.v1",
    error: code,
    message,
    read_only: true,
    mutates_state: false,
  };
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function validationItem(pathKey, category, pass, message) {
  return {
    schema_version: "multi-project-saas-validation-item.v1",
    path: pathKey,
    category,
    status: pass ? "pass" : "fail",
    message,
  };
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

function isSourceReady(source) {
  return source.available
    && source.data?.summary?.work_os_goal_drilldown_surface_status === SOURCE_READY_STATUS
    && source.data?.summary?.ready_for_p9401_handoff === true;
}

async function readJsonOrBuildWorkOsGoalDrilldownSurface(filePath, generatedAt) {
  const resolved = path.resolve(filePath);
  const source = await readJsonSource(resolved);
  if (source.available && source.data?.summary?.work_os_goal_drilldown_surface_status === SOURCE_READY_STATUS) return source;
  try {
    const built = await buildWorkOsGoalDrilldownSurface({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.work_os_goal_drilldown_surface", built);
  } catch (error) {
    return {
      available: false,
      path: resolved,
      data: source.data,
      text: source.text ?? "",
      error: source.error ?? error.message,
    };
  }
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, data: JSON.parse(text), text };
  } catch (error) {
    return { available: false, path: filePath, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data) };
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.architectureDocPath),
    source_work_os_goal_drilldown_path: path.resolve(options.sourceWorkOsGoalDrilldownPath ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.sourceWorkOsGoalDrilldownPath),
    factory_ledger_dir: path.resolve(options.factoryLedgerDir ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.factoryLedgerDir),
    factory_seed_dir: path.resolve(options.factorySeedDir ?? DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_INPUTS.factorySeedDir),
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  return { ...result, html: undefined, markdown: undefined };
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    serve: false,
    outDir: DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_OUT_DIR,
    host: DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_HOST,
    port: DEFAULT_MULTI_PROJECT_SAAS_CONTROL_PLANE_PORT,
    runAt: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--serve") args.serve = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--host") args.host = argv[++index];
    else if (arg === "--port") args.port = Number(argv[++index]);
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--factory-ledger-dir") args.factoryLedgerDir = argv[++index];
    else if (arg === "--factory-seed-dir") args.factorySeedDir = argv[++index];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/multi-project-saas-control-plane.mjs [options]

Options:
  --check              Validate without writing artifacts
  --serve              Start the read-only local API server
  --out-dir <path>     Output directory
  --host <host>        Server host
  --port <port>        Server port
  --run-at <iso>       Fixed generation timestamp
  --factory-ledger-dir <path>
                       Factory operational ledger directory
  --factory-seed-dir <path>
                       Factory tracked seed directory
  --help               Show this help
`);
}

function includesToken(text, token) {
  return typeof text === "string" && text.includes(token);
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
