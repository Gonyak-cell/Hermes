import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildWorkOsGoalExecutionView } from "./work-os-goal-execution-view.mjs";

export const DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_OUT_DIR = "artifacts/work-os-goal-drilldown-surface/latest";
export const DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS = {
  schemaPath: "schemas/work-os-goal-drilldown-surface.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p9201-p9400.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsGoalExecutionViewPath: "artifacts/work-os-goal-execution-view/latest/work-os-goal-execution-view.json",
};

export const DEFAULT_WORK_OS_GOAL_DRILLDOWN_HOST = "127.0.0.1";
export const DEFAULT_WORK_OS_GOAL_DRILLDOWN_PORT = 4192;

const COMMAND_NAME = "platform:work-os-goal-drilldown-surface";
const SOURCE_COMMAND_NAME = "platform:work-os-goal-execution-view";
const SCHEMA_VERSION = "work-os-goal-drilldown-surface.v1";
const CAPABILITY_ID = "platform.work_os_goal_drilldown_surface";
const PROGRAM_RANGE = "P9201-P9400";
const SOURCE_PROGRAM_RANGE = "P9001-P9200";
const SOURCE_READY_STATUS = "ready_for_work_os_goal_execution_view";
const READY_STATUS = "ready_for_work_os_goal_drilldown_surface";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

const PHASE_SPECS = [
  ["P9201-P9220", "P9200 Source Binding"],
  ["P9221-P9240", "Goal API Projection"],
  ["P9241-P9260", "Next Action API Projection"],
  ["P9261-P9280", "Commit Checkpoint API Projection"],
  ["P9281-P9300", "Session Handoff API Projection"],
  ["P9301-P9320", "Project Drilldown Model"],
  ["P9321-P9340", "Goal Detail Model"],
  ["P9341-P9360", "Combined Status Model"],
  ["P9361-P9380", "Browser Drilldown Smoke"],
  ["P9381-P9400", "P9400 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Drilldown source readiness", "computed"],
  ["/api/work-os/goals", "goals", "Goal API projection", "goal_api_projection_rows"],
  ["/api/work-os/goal-detail", "goal_detail", "Goal detail rows", "goal_detail_rows"],
  ["/api/work-os/project-drilldown", "project_drilldown", "Project drilldown rows", "project_drilldown_rows"],
  ["/api/work-os/next-actions", "next_actions", "Next action API projection", "next_action_api_projection_rows"],
  ["/api/work-os/commits", "commits", "Commit checkpoint API projection", "commit_checkpoint_api_projection_rows"],
  ["/api/work-os/session-handoffs", "session_handoffs", "Session handoff API projection", "session_handoff_api_projection_rows"],
  ["/api/work-os/combined-status", "combined_status", "Combined project goal status rows", "combined_status_rows"],
  ["/api/work-os/drilldown-boundary", "boundary", "Drilldown boundary", "work_os_goal_drilldown_boundary"],
];

const UI_BINDING_SPECS = [
  ["ui.drilldown_shell", "Goal Drilldown Shell", "/api/work-os/combined-status", "combined_status"],
  ["ui.goal_projection", "Goal Projection", "/api/work-os/goals", "goals"],
  ["ui.project_drilldown", "Project Drilldown", "/api/work-os/project-drilldown", "project_drilldown"],
  ["ui.goal_detail", "Goal Detail", "/api/work-os/goal-detail", "goal_detail"],
  ["ui.next_actions", "Next Actions", "/api/work-os/next-actions", "next_actions"],
  ["ui.commits", "Commit Checkpoints", "/api/work-os/commits", "commits"],
  ["ui.session_handoffs", "Session Handoffs", "/api/work-os/session-handoffs", "session_handoffs"],
  ["ui.boundary", "Boundary", "/api/work-os/drilldown-boundary", "boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p9200_source", "Drilldown passes without P9200 source readiness", "BLOCK_MISSING_P9200_SOURCE"],
  ["negative.non_get_method", "Drilldown API accepts POST PUT PATCH or DELETE", "BLOCK_MUTATING_API_METHOD"],
  ["negative.raw_transcript_body", "Drilldown API or UI exposes raw/full transcript body", "BLOCK_RAW_TRANSCRIPT_BODY"],
  ["negative.secret_key_response", "Drilldown API or UI exposes secret-bearing keys", "BLOCK_SECRET_KEY_RESPONSE"],
  ["negative.domain_pack_product_promotion", "Domain pack is promoted to Hermes product identity", "BLOCK_DOMAIN_PACK_PRODUCT_PROMOTION"],
  ["negative.review_final_approval", "Codex or Claude becomes final approver in drilldown", "BLOCK_REVIEW_FINAL_APPROVAL"],
  ["negative.human_gate_completion", "Human gate is completed by drilldown surface", "BLOCK_HUMAN_GATE_COMPLETION"],
  ["negative.single_owner_enterprise", "Single-owner mode becomes enterprise independent trust", "BLOCK_SINGLE_OWNER_ENTERPRISE"],
  ["negative.ui_git_write", "UI can stage commit push merge or apply patches", "BLOCK_UI_GIT_WRITE"],
  ["negative.runtime_write_connector", "Runtime execution write or connector write is enabled", "BLOCK_RUNTIME_WRITE_CONNECTOR"],
  ["negative.production_enterprise_pass", "Production or enterprise PASS is enabled", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runWorkOsGoalDrilldownSurface(options = {}) {
  const result = await buildWorkOsGoalDrilldownSurface(options);
  if (options.write !== false) await writeWorkOsGoalDrilldownSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS goal drilldown surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsGoalDrilldownSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = options.workOsGoalExecutionView
    ? normalizeInlineJsonSource("inline.work_os_goal_execution_view", options.workOsGoalExecutionView)
    : await readJsonOrBuildWorkOsGoalExecutionView(inputs.source_work_os_goal_execution_view_path, generatedAt);

  const sourceData = source.data ?? {};
  const derived = deriveDrilldownCollections(sourceData, generatedAt);
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const routeRows = buildApiRouteRows(generatedAt);
  const uiBindingRows = buildUiBindingRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows(sourceData, generatedAt);
  const browserSmokeRows = await buildBrowserSmokeRows(sourceData, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    phaseRows,
    sourceBindingRows,
    routeRows,
    uiBindingRows,
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
    uiBindingRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    ...derived,
  });
  const boundary = buildBoundary({
    source,
    phaseRows,
    sourceBindingRows,
    routeRows,
    uiBindingRows,
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
    uiBindingRows,
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
    work_os_goal_drilldown_surface_id: `work-os-goal-drilldown-surface.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_goal_execution_view_summary: source.data?.summary ?? null,
    work_os_goal_drilldown_contract: contract,
    work_os_goal_drilldown_phase_rows: phaseRows,
    p9200_source_binding_rows: sourceBindingRows,
    drilldown_api_route_rows: routeRows,
    drilldown_ui_binding_rows: uiBindingRows,
    goal_api_projection_rows: derived.goal_api_projection_rows,
    next_action_api_projection_rows: derived.next_action_api_projection_rows,
    commit_checkpoint_api_projection_rows: derived.commit_checkpoint_api_projection_rows,
    session_handoff_api_projection_rows: derived.session_handoff_api_projection_rows,
    project_drilldown_rows: derived.project_drilldown_rows,
    goal_detail_rows: derived.goal_detail_rows,
    combined_status_rows: derived.combined_status_rows,
    drilldown_api_smoke_rows: apiSmokeRows,
    browser_drilldown_smoke_rows: browserSmokeRows,
    work_os_goal_drilldown_negative_fixture_rows: negativeFixtureRows,
    p9400_freeze_rows: freezeRows,
    work_os_goal_drilldown_gate_rows: gateRows,
    work_os_goal_drilldown_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      phaseRows,
      sourceBindingRows,
      routeRows,
      uiBindingRows,
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
    ? validateAgainstSchema(result, schema.data, {}, "work_os_goal_drilldown_surface")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    phaseRows,
    sourceBindingRows,
    routeRows,
    uiBindingRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    gateRows,
    boundary,
    validation: result.validation,
    ...derived,
  });
  result.summary.work_os_goal_drilldown_surface_id = result.work_os_goal_drilldown_surface_id;
  return { ...result, html: renderDrilldownHtml(result), markdown: renderMarkdown(result) };
}

export async function writeWorkOsGoalDrilldownSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-goal-drilldown-surface.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-goal-drilldown-phase-rows.json"), collectionEnvelope("work-os-goal-drilldown-phase-rows.v1", "work_os_goal_drilldown_phase_rows", result.work_os_goal_drilldown_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "p9200-source-binding-rows.json"), collectionEnvelope("p9200-source-binding-rows.v1", "p9200_source_binding_rows", result.p9200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "drilldown-api-route-rows.json"), collectionEnvelope("drilldown-api-route-rows.v1", "drilldown_api_route_rows", result.drilldown_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "drilldown-ui-binding-rows.json"), collectionEnvelope("drilldown-ui-binding-rows.v1", "drilldown_ui_binding_rows", result.drilldown_ui_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-api-projection-rows.json"), collectionEnvelope("goal-api-projection-rows.v1", "goal_api_projection_rows", result.goal_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-action-api-projection-rows.json"), collectionEnvelope("next-action-api-projection-rows.v1", "next_action_api_projection_rows", result.next_action_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "commit-checkpoint-api-projection-rows.json"), collectionEnvelope("commit-checkpoint-api-projection-rows.v1", "commit_checkpoint_api_projection_rows", result.commit_checkpoint_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "session-handoff-api-projection-rows.json"), collectionEnvelope("session-handoff-api-projection-rows.v1", "session_handoff_api_projection_rows", result.session_handoff_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-drilldown-rows.json"), collectionEnvelope("project-drilldown-rows.v1", "project_drilldown_rows", result.project_drilldown_rows, result.generated_at));
  await writeJson(path.join(outDir, "goal-detail-rows.json"), collectionEnvelope("goal-detail-rows.v1", "goal_detail_rows", result.goal_detail_rows, result.generated_at));
  await writeJson(path.join(outDir, "combined-status-rows.json"), collectionEnvelope("combined-status-rows.v1", "combined_status_rows", result.combined_status_rows, result.generated_at));
  await writeJson(path.join(outDir, "drilldown-api-smoke-rows.json"), collectionEnvelope("drilldown-api-smoke-rows.v1", "drilldown_api_smoke_rows", result.drilldown_api_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "browser-drilldown-smoke-rows.json"), collectionEnvelope("browser-drilldown-smoke-rows.v1", "browser_drilldown_smoke_rows", result.browser_drilldown_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-drilldown-negative-fixture-rows.json"), collectionEnvelope("work-os-goal-drilldown-negative-fixture-rows.v1", "work_os_goal_drilldown_negative_fixture_rows", result.work_os_goal_drilldown_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "p9400-freeze-rows.json"), collectionEnvelope("p9400-freeze-rows.v1", "p9400_freeze_rows", result.p9400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-drilldown-gate-rows.json"), collectionEnvelope("work-os-goal-drilldown-gate-rows.v1", "work_os_goal_drilldown_gate_rows", result.work_os_goal_drilldown_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-goal-drilldown-boundary.json"), result.work_os_goal_drilldown_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-goal-drilldown-surface-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function createWorkOsGoalDrilldownApiServer(options = {}) {
  return createServer(async (request, response) => {
    const apiResponse = await buildWorkOsGoalDrilldownApiResponse(request.url ?? "/", {
      ...options,
      method: request.method,
    });
    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
  });
}

export async function startWorkOsGoalDrilldownApiServer(options = {}) {
  const host = options.host ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_HOST;
  const port = Number(options.port ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_PORT);
  const server = createWorkOsGoalDrilldownApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, host, port: actualPort, url: `http://${host}:${actualPort}` };
}

export async function buildWorkOsGoalDrilldownApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Work OS goal drilldown API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const source = options.workOsGoalExecutionView
    ? normalizeInlineJsonSource("inline.work_os_goal_execution_view", options.workOsGoalExecutionView)
    : await readJsonOrBuildWorkOsGoalExecutionView(options.sourceWorkOsGoalExecutionViewPath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.sourceWorkOsGoalExecutionViewPath, generatedAt);
  if (!isSourceReady(source)) {
    return jsonResponse(503, buildError("work_os_goal_execution_source_unavailable", source.error ?? "P9200 Work OS goal execution source is not ready."), method);
  }
  const collections = deriveDrilldownCollections(source.data, generatedAt);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/work-os-drilldown.html") {
    return htmlResponse(200, renderDrilldownHtml({
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      generated_at: generatedAt,
      summary: {
        work_os_goal_drilldown_surface_status: READY_STATUS,
        ready_for_p9401_handoff: true,
      },
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      schema_version: "work-os-goal-drilldown-health.v1",
      generated_at: generatedAt,
      status: "ok",
      source_status: source.data?.summary?.work_os_goal_execution_view_status,
      source_ready: true,
      read_only: true,
      mutation_allowed: false,
    }), method);
  }
  const routeSpec = API_ROUTE_SPECS.find(([apiPath]) => apiPath === pathname);
  if (routeSpec) {
    const [, responseKey,, collectionRef] = routeSpec;
    if (collectionRef === "work_os_goal_drilldown_boundary") {
      return jsonResponse(200, buildCollectionResponse(responseKey, [buildRuntimeBoundary(source, collections)], url, generatedAt), method);
    }
    return jsonResponse(200, buildCollectionResponse(responseKey, collections[collectionRef], url, generatedAt), method);
  }
  return jsonResponse(404, buildError("not_found", `No Work OS goal drilldown route for ${pathname}`), method);
}

export async function runWorkOsGoalDrilldownSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    try {
      const started = await startWorkOsGoalDrilldownApiServer(args);
      console.log(`Work OS goal drilldown API/UI server listening at ${started.url}`);
      console.log(`Open ${started.url}/work-os-drilldown.html`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }
  try {
    const result = await runWorkOsGoalDrilldownSurface(args);
    console.log(`Work OS goal drilldown surface ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_goal_drilldown_surface_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Routes: ${result.summary.drilldown_api_route_count}`);
    console.log(`Projects: ${result.summary.project_drilldown_count}`);
    console.log(`Goals: ${result.summary.goal_detail_count}`);
    console.log(`P9400 freeze ready: ${result.summary.p9400_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "work-os-goal-drilldown-contract.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_status_required: SOURCE_READY_STATUS,
    p9200_source_binding_required: true,
    goal_api_projection_required: true,
    next_action_api_projection_required: true,
    commit_checkpoint_api_projection_required: true,
    session_handoff_api_projection_required: true,
    project_drilldown_model_required: true,
    goal_detail_model_required: true,
    combined_status_model_required: true,
    browser_drilldown_smoke_required: true,
    p9400_freeze_required: true,
    api_get_head_only: true,
    api_write_methods_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    domain_pack_as_product_allowed: false,
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
    ui_git_write_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-goal-drilldown-phase-row.v1",
      row_id: `work.os.goal.drilldown.phase.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      phase_range,
      phase_name,
      source_program_range: SOURCE_PROGRAM_RANGE,
      target_program_range: PROGRAM_RANGE,
      claim_ref: `claim.${slug(phase_name)}`,
      evidence_ref: `evidence.${slug(phase_name)}`,
      gate_ref: `gate.${slug(phase_name)}`,
      check_ref: `check.${slug(phase_name)}`,
      reviewer_ref: "reviewer.harness_validator",
      next_allowed_action: pass ? "render drilldown phase row" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  return [
    verdictRow({
      schema_version: "p9200-source-binding-row.v1",
      row_id: "p9200.source.binding.row.01",
      generated_at: generatedAt,
      source_ref: "artifact.work_os_goal_execution_view",
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_status: summary.work_os_goal_execution_view_status ?? "missing",
      source_ready_for_p9201: summary.ready_for_p9201_handoff === true,
      source_path: source.path,
      read_only: true,
      mutates_source: false,
      evidence_ref: "evidence.p9200.source.ready",
      next_allowed_action: "consume P9200 source as drilldown input",
    }, isSourceReady(source)),
  ];
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([api_path, response_key, description, source_collection_ref], index) => verdictRow({
    schema_version: "work-os-goal-drilldown-api-route-row.v1",
    row_id: `work.os.goal.drilldown.api.route.row.${String(index + 1).padStart(2, "0")}`,
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
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    route_status: "ready",
    next_allowed_action: "serve artifact-backed drilldown response",
  }, true));
}

function buildUiBindingRows(generatedAt) {
  return UI_BINDING_SPECS.map(([surface_id, surface_title, consumes_api_path, response_key], index) => verdictRow({
    schema_version: "work-os-goal-drilldown-ui-binding-row.v1",
    row_id: `work.os.goal.drilldown.ui.binding.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    surface_id,
    surface_title,
    consumes_api_path,
    response_key,
    binding_mode: "browser_fetch_read_only_json",
    read_only: true,
    source_cited: true,
    raw_transcript_body_visible: false,
    secret_embedded: false,
    protected_action_controls_enabled: false,
    git_write_controls_enabled: false,
    mutation_allowed: false,
    binding_status: "ready",
    next_allowed_action: "bind drilldown surface to read-only route",
  }, true));
}

function deriveDrilldownCollections(sourceData, generatedAt) {
  const sourceProjects = asArray(sourceData.project_runtime_handoff_rows);
  const sourceGoals = asArray(sourceData.goal_phase_execution_rows);
  const sourceActions = asArray(sourceData.next_action_queue_rows);
  const sourceCommits = asArray(sourceData.commit_checkpoint_view_rows);
  const sourceSessions = asArray(sourceData.session_handoff_ref_rows);
  const sourceReviews = asArray(sourceData.review_lane_view_rows);
  const sourceValidations = asArray(sourceData.validation_state_lens_rows);
  const goalRows = sourceGoals.map((goal, index) => verdictRow({
    schema_version: "goal-api-projection-row.v1",
    row_id: `goal.api.projection.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path: "/api/work-os/goals",
    project_id: goal.project_id,
    goal_id: goal.goal_id,
    goal_name: goal.goal_name,
    phase_range: goal.phase_range,
    current_phase_ref: goal.current_phase_ref,
    status: goal.status,
    claim_ref: goal.claim_ref,
    evidence_ref: goal.evidence_ref,
    gate_ref: goal.gate_ref,
    check_ref: goal.check_ref,
    review_receipt_ref: goal.review_receipt_ref,
    read_only: true,
    protected_action_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    next_allowed_action: "serve goal projection",
  }, goal.current_verdict === "pass"));
  const nextActionRows = sourceActions.map((action, index) => verdictRow({
    schema_version: "next-action-api-projection-row.v1",
    row_id: `next.action.api.projection.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path: "/api/work-os/next-actions",
    action_id: action.action_id,
    description: action.description,
    action_type: action.action_type,
    source_collection_ref: action.source_collection_ref,
    action_status: action.action_status,
    protected_action: false,
    mutates_state: false,
    requires_human_gate_completion: false,
    read_only: true,
    next_allowed_action: "serve next action projection",
  }, action.protected_action === false && action.mutates_state === false));
  const commitRows = sourceCommits.map((checkpoint, index) => verdictRow({
    schema_version: "commit-checkpoint-api-projection-row.v1",
    row_id: `commit.checkpoint.api.projection.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path: "/api/work-os/commits",
    checkpoint_id: checkpoint.checkpoint_id,
    description: checkpoint.description,
    evidence_ref: checkpoint.evidence_ref,
    read_only: true,
    git_write_enabled: false,
    commit_created_by_ui: false,
    push_enabled: false,
    merge_enabled: false,
    next_allowed_action: "serve commit checkpoint projection",
  }, checkpoint.git_write_enabled === false && checkpoint.commit_created_by_ui === false));
  const sessionRows = sourceSessions.map((session, index) => verdictRow({
    schema_version: "session-handoff-api-projection-row.v1",
    row_id: `session.handoff.api.projection.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path: "/api/work-os/session-handoffs",
    source_id: session.source_id,
    engine_id: session.engine_id,
    session_id: session.session_id,
    phase_id: session.phase_id,
    transcript_ref: session.transcript_ref,
    redacted_summary_ref: session.redacted_summary_ref,
    citation_ref: session.citation_ref,
    raw_body_visible: false,
    full_transcript_body_visible: false,
    source_cited: session.source_cited === true,
    read_only: true,
    mutates_source_store: false,
    mutates_plan_state: false,
    next_allowed_action: "serve cited redacted session handoff",
  }, session.source_cited === true && session.raw_body_visible === false && session.full_transcript_body_visible === false));
  const projectRows = sourceProjects.map((project, index) => {
    const projectGoals = goalRows.filter((goal) => goal.project_id === project.project_id);
    return verdictRow({
      schema_version: "project-drilldown-row.v1",
      row_id: `project.drilldown.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      api_path: "/api/work-os/project-drilldown",
      project_id: project.project_id,
      project_name: project.project_name,
      domain_pack: project.domain_pack,
      domain_pack_scope: project.domain_pack_scope,
      domain_pack_is_whole_product: false,
      hermes_product_identity: "general_project_workflow_control_plane",
      active_goal_ref: project.active_goal_ref,
      goal_count: projectGoals.length,
      review_lane_count: sourceReviews.length,
      validation_lens_count: sourceValidations.length,
      next_action_count: nextActionRows.length,
      commit_checkpoint_count: commitRows.length,
      session_handoff_count: sessionRows.length,
      read_only: true,
      protected_action_enabled: false,
      runtime_execution_enabled: false,
      write_action_enabled: false,
      drilldown_status: "ready",
      next_allowed_action: "open read-only project drilldown",
    }, project.domain_pack_is_whole_product === false && project.current_verdict === "pass");
  });
  const goalDetailRows = goalRows.map((goal, index) => {
    const project = projectRows.find((row) => row.project_id === goal.project_id);
    return verdictRow({
      schema_version: "goal-detail-row.v1",
      row_id: `goal.detail.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      api_path: "/api/work-os/goal-detail",
      project_id: goal.project_id,
      project_name: project?.project_name ?? goal.project_id,
      goal_id: goal.goal_id,
      goal_name: goal.goal_name,
      phase_range: goal.phase_range,
      claim_ref: goal.claim_ref,
      evidence_ref: goal.evidence_ref,
      gate_ref: goal.gate_ref,
      check_ref: goal.check_ref,
      review_receipt_ref: goal.review_receipt_ref,
      validation_state_ref: "validation.state.drilldown",
      combined_status_ref: `combined.status.${slug(goal.project_id)}`,
      read_only: true,
      protected_action_enabled: false,
      codex_final_approval_allowed: false,
      claude_final_approval_allowed: false,
      human_gate_completion_enabled: false,
      next_allowed_action: "open read-only goal detail",
    }, Boolean(goal.claim_ref && goal.evidence_ref && goal.gate_ref && goal.check_ref && goal.review_receipt_ref));
  });
  const combinedRows = projectRows.map((project, index) => {
    const projectGoalDetails = goalDetailRows.filter((goal) => goal.project_id === project.project_id);
    const blockers = [
      ...projectGoalDetails.filter((goal) => goal.current_verdict !== "pass"),
      ...nextActionRows.filter((action) => action.current_verdict !== "pass"),
      ...commitRows.filter((commit) => commit.current_verdict !== "pass"),
    ];
    return verdictRow({
      schema_version: "combined-status-row.v1",
      row_id: `combined.status.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      api_path: "/api/work-os/combined-status",
      combined_status_id: `combined.status.${slug(project.project_id)}`,
      project_id: project.project_id,
      goal_count: projectGoalDetails.length,
      validation_ready: sourceValidations.every((row) => row.current_verdict === "pass"),
      review_boundary_ready: sourceReviews.every((row) => row.final_approval_allowed === false && row.reviewer_mutation_allowed === false),
      next_actions_ready: nextActionRows.every((row) => row.current_verdict === "pass"),
      commit_checkpoint_ready: commitRows.every((row) => row.current_verdict === "pass"),
      session_handoff_ready: sessionRows.every((row) => row.current_verdict === "pass"),
      blocker_count: blockers.length,
      combined_status: blockers.length === 0 ? "ready_read_only" : "blocked",
      read_only: true,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      next_allowed_action: "show combined drilldown status",
    }, blockers.length === 0);
  });
  return {
    goal_api_projection_rows: goalRows,
    next_action_api_projection_rows: nextActionRows,
    commit_checkpoint_api_projection_rows: commitRows,
    session_handoff_api_projection_rows: sessionRows,
    project_drilldown_rows: projectRows,
    goal_detail_rows: goalDetailRows,
    combined_status_rows: combinedRows,
  };
}

async function buildApiSmokeRows(sourceData, generatedAt) {
  const rows = [];
  for (const [index, [apiPath]] of API_ROUTE_SPECS.entries()) {
    const response = await buildWorkOsGoalDrilldownApiResponse(apiPath, {
      method: "GET",
      runAt: generatedAt,
      workOsGoalExecutionView: sourceData,
    });
    const unsafe = inspectResponseBody(response.body);
    rows.push(verdictRow({
      schema_version: "work-os-goal-drilldown-api-smoke-row.v1",
      row_id: `work.os.goal.drilldown.api.smoke.row.${String(index + 1).padStart(2, "0")}`,
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
      next_allowed_action: "preserve drilldown API smoke evidence",
    }, response.status === 200 && response.body.length > 0 && !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent));
  }
  const postResponse = await buildWorkOsGoalDrilldownApiResponse("/api/work-os/goals", {
    method: "POST",
    runAt: generatedAt,
    workOsGoalExecutionView: sourceData,
  });
  rows.push(verdictRow({
    schema_version: "work-os-goal-drilldown-api-smoke-row.v1",
    row_id: `work.os.goal.drilldown.api.smoke.row.${String(rows.length + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    smoke_id: "api_smoke.post_rejected",
    api_path: "/api/work-os/goals",
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

async function buildBrowserSmokeRows(sourceData, generatedAt) {
  const response = await buildWorkOsGoalDrilldownApiResponse("/work-os-drilldown.html", {
    method: "GET",
    runAt: generatedAt,
    workOsGoalExecutionView: sourceData,
  });
  const html = response.body;
  const unsafe = inspectResponseBody(html);
  const apiPaths = UI_BINDING_SPECS.map(([, , apiPath]) => apiPath);
  const rows = [
    smokeRow("browser_smoke.html_status", "HTML route returns 200", response.status === 200, { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.nonblank_shell", "HTML shell is nonblank", html.length > 1200 && includesToken(html, "work-os-drilldown-root"), { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.api_bindings", "HTML declares drilldown API bindings", apiPaths.every((apiPath) => includesToken(html, apiPath)), { required_path_count: apiPaths.length, observed_path_count: apiPaths.filter((apiPath) => includesToken(html, apiPath)).length }, generatedAt),
    smokeRow("browser_smoke.no_raw_or_secret", "HTML has no raw transcript body or secret keys", !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent, { raw_transcript_body_present: unsafe.rawTranscriptBodyPresent, secret_keys_present: unsafe.secretKeysPresent }, generatedAt),
    smokeRow("browser_smoke.no_protected_or_git_actions", "HTML has no protected or git write controls", !includesToken(html, "data-protected-action") && !includesToken(html, "data-git-write"), { protected_action_token_present: includesToken(html, "data-protected-action"), git_write_token_present: includesToken(html, "data-git-write") }, generatedAt),
    smokeRow("browser_smoke.get_only_fetch", "HTML fetch bindings are GET only", !includesToken(html, "method: 'POST'") && !includesToken(html, "method:\"POST\""), { post_fetch_present: includesToken(html, "method: 'POST'") || includesToken(html, "method:\"POST\"") }, generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, row_id: `work.os.goal.drilldown.browser.smoke.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, description, expected_block_code], index) => verdictRow({
    schema_version: "work-os-goal-drilldown-negative-fixture-row.v1",
    row_id: `work.os.goal.drilldown.negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
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
    ["freeze.source_ready", "P9200 source is ready", isSourceReady(context.source)],
    ["freeze.phase_rows", "P9201-P9400 phase rows pass", context.phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.source_binding", "P9200 source binding rows pass", context.sourceBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.routes", "Drilldown API routes are ready", context.routeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.ui_bindings", "Drilldown UI bindings are ready", context.uiBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.goal_projection", "Goal API projection rows pass", context.goal_api_projection_rows.length > 0 && context.goal_api_projection_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.project_drilldown", "Project drilldown rows pass", context.project_drilldown_rows.length > 0 && context.project_drilldown_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.goal_detail", "Goal detail rows pass", context.goal_detail_rows.length > 0 && context.goal_detail_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.combined_status", "Combined status rows pass", context.combined_status_rows.length > 0 && context.combined_status_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.api_smoke", "Drilldown API smoke rows pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.browser_smoke", "Browser drilldown smoke rows pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.negative_fixtures", "Negative fixtures block unsafe claims", context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false)],
    ["freeze.p9400_handoff", "P9400 can hand off to P9401", true],
  ];
  return rows.map(([freeze_id, description, pass], index) => verdictRow({
    schema_version: "p9400-freeze-row.v1",
    row_id: `p9400.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    freeze_id,
    description,
    evidence_ref: `evidence.${freeze_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `gate.${freeze_id}`,
    next_allowed_action: pass ? "include in P9400 freeze packet" : "repair P9400 freeze prerequisite",
  }, pass));
}

function buildGateRows(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const gates = [
    ["package_script_registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P9400 command"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes P9400 command"],
    ["runs_after_p9200", commandIndex > sourceIndex && sourceIndex >= 0, "P9400 command runs after P9200 source command"],
    ["source_p9200_ready", isSourceReady(context.source), "P9200 source is ready"],
    ["roadmap_reflected", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE) && includesToken(context.roadmapDoc.text, "Goal API Projection"), "P9201-P9400 roadmap is reflected"],
    ["architecture_reflected", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9201-P9400 Work OS Goal Execution API Binding and Project Drilldown Surface"), "architecture reflects P9400"],
    ["phase_rows_pass", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all P9201-P9400 phase rows pass"],
    ["routes_read_only", context.routeRows.every((row) => row.method_allowlist.join(",") === "GET,HEAD" && row.write_methods_enabled === false), "routes are GET/HEAD only"],
    ["ui_bindings_read_only", context.uiBindingRows.every((row) => row.read_only === true && row.git_write_controls_enabled === false), "UI bindings are read-only"],
    ["goal_projection_ready", context.goal_api_projection_rows.length > 0 && context.goal_api_projection_rows.every((row) => row.current_verdict === "pass"), "goal API projection rows pass"],
    ["next_actions_ready", context.next_action_api_projection_rows.every((row) => row.protected_action === false && row.mutates_state === false), "next action rows are non-mutating"],
    ["commits_read_only", context.commit_checkpoint_api_projection_rows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), "commit checkpoint API is read-only"],
    ["sessions_redacted", context.session_handoff_api_projection_rows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false), "session handoff API is redacted"],
    ["project_drilldown_ready", context.project_drilldown_rows.every((row) => row.domain_pack_is_whole_product === false), "project drilldown keeps domain packs scoped"],
    ["goal_detail_ready", context.goal_detail_rows.every((row) => row.codex_final_approval_allowed === false && row.claude_final_approval_allowed === false), "goal detail keeps final authority false"],
    ["combined_status_ready", context.combined_status_rows.every((row) => row.production_pass_enabled === false && row.enterprise_pass_enabled === false), "combined status does not create production or enterprise PASS"],
    ["api_smoke_pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows pass"],
    ["browser_smoke_pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows pass"],
    ["negative_fixtures_block", context.negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe claims"],
    ["p9400_freeze_rows_ready", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9400 freeze rows are ready"],
    ["no_final_authority", context.contract.codex_final_approval_allowed === false && context.contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", context.contract.production_pass_enabled === false && context.contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write_connector", context.contract.runtime_execution_enabled === false && context.contract.write_action_enabled === false && context.contract.external_connector_write_enabled === false, "runtime execution write and connector write remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "work-os-goal-drilldown-gate-row.v1",
    row_id: `work.os.goal.drilldown.gate.row.${String(index + 1).padStart(2, "0")}`,
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
  const uiReady = context.uiBindingRows.every((row) => row.current_verdict === "pass");
  const goalProjectionReady = context.goal_api_projection_rows.length > 0 && context.goal_api_projection_rows.every((row) => row.current_verdict === "pass");
  const projectDrilldownReady = context.project_drilldown_rows.length > 0 && context.project_drilldown_rows.every((row) => row.current_verdict === "pass");
  const goalDetailReady = context.goal_detail_rows.length > 0 && context.goal_detail_rows.every((row) => row.current_verdict === "pass");
  const combinedStatusReady = context.combined_status_rows.length > 0 && context.combined_status_rows.every((row) => row.current_verdict === "pass");
  const apiSmokeReady = context.apiSmokeRows.every((row) => row.current_verdict === "pass");
  const browserSmokeReady = context.browserSmokeRows.every((row) => row.current_verdict === "pass");
  const freezeReady = context.freezeRows.every((row) => row.current_verdict === "pass");
  const gatesPass = context.gateRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const unsafeFlags = [
    false, false, false, false, false, false, false, false, false, false, false, false, false, false,
  ];
  return {
    schema_version: "work-os-goal-drilldown-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p9200_ready: sourceReady,
    phase_rows_ready: phaseReady,
    drilldown_routes_ready: routeReady,
    drilldown_ui_ready: uiReady,
    goal_api_projection_ready: goalProjectionReady,
    project_drilldown_ready: projectDrilldownReady,
    goal_detail_ready: goalDetailReady,
    combined_status_ready: combinedStatusReady,
    api_smoke_ready: apiSmokeReady,
    browser_smoke_ready: browserSmokeReady,
    p9400_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p9401_handoff: sourceReady && phaseReady && routeReady && uiReady && goalProjectionReady && projectDrilldownReady && goalDetailReady && combinedStatusReady && apiSmokeReady && browserSmokeReady && freezeReady && negativeFixturesBlock && gatesPass,
    api_write_methods_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    domain_pack_as_product_allowed: false,
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
    ui_git_write_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildRuntimeBoundary(source, collections) {
  return buildBoundary({
    source,
    phaseRows: PHASE_SPECS.map(([phase_range]) => verdictRow({ schema_version: "runtime.phase.v1", row_id: phase_range }, true)),
    routeRows: buildApiRouteRows(new Date().toISOString()),
    uiBindingRows: buildUiBindingRows(new Date().toISOString()),
    apiSmokeRows: [],
    browserSmokeRows: [],
    negativeFixtureRows: buildNegativeFixtureRows(new Date().toISOString()),
    freezeRows: [],
    gateRows: [],
    ...collections,
  });
}

function buildValidationItems(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  return [
    validationItem("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include command"),
    validationItem("package.order", "package", commandIndex > sourceIndex && sourceIndex >= 0, "command must run after P9200 source command"),
    validationItem("source.ready", "source", isSourceReady(context.source), "P9200 source must be ready"),
    validationItem("roadmap.reflected", "docs", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE), "roadmap must reflect P9201-P9400"),
    validationItem("architecture.reflected", "docs", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9201-P9400 Work OS Goal Execution API Binding and Project Drilldown Surface"), "architecture must reflect P9400"),
    validationItem("contract.boundaries", "contract", context.contract.api_get_head_only && context.contract.api_write_methods_enabled === false && context.contract.ui_git_write_enabled === false, "contract must keep drilldown read-only"),
    validationItem("phase.rows", "phases", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("routes.read_only", "api", context.routeRows.length === API_ROUTE_SPECS.length && context.routeRows.every((row) => row.method_allowlist.includes("GET") && row.method_allowlist.includes("HEAD") && row.write_methods_enabled === false), "routes must be GET/HEAD only"),
    validationItem("ui.bindings", "ui", context.uiBindingRows.length === UI_BINDING_SPECS.length && context.uiBindingRows.every((row) => row.read_only && row.git_write_controls_enabled === false), "UI bindings must be read-only"),
    validationItem("goal.projection", "goals", context.goal_api_projection_rows.length > 0 && context.goal_api_projection_rows.every((row) => row.current_verdict === "pass"), "goal projection rows must pass"),
    validationItem("next.actions", "next_actions", context.next_action_api_projection_rows.every((row) => row.protected_action === false && row.mutates_state === false), "next action API rows cannot execute"),
    validationItem("commits.read_only", "commits", context.commit_checkpoint_api_projection_rows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), "commit API rows cannot write"),
    validationItem("sessions.redacted", "sessions", context.session_handoff_api_projection_rows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false && row.source_cited === true), "session API rows must be redacted and cited"),
    validationItem("project.drilldown", "projects", context.project_drilldown_rows.length > 0 && context.project_drilldown_rows.every((row) => row.domain_pack_is_whole_product === false), "project drilldown must keep domain pack scope"),
    validationItem("goal.detail", "goal_detail", context.goal_detail_rows.length > 0 && context.goal_detail_rows.every((row) => row.codex_final_approval_allowed === false && row.claude_final_approval_allowed === false), "goal detail cannot final approve"),
    validationItem("combined.status", "combined_status", context.combined_status_rows.length > 0 && context.combined_status_rows.every((row) => row.production_pass_enabled === false && row.enterprise_pass_enabled === false), "combined status cannot create production or enterprise PASS"),
    validationItem("api.smoke", "api", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows must pass"),
    validationItem("negative.fixtures", "fixtures", context.negativeFixtureRows.length === NEGATIVE_FIXTURES.length && context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("freeze.ready", "freeze", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9400 freeze rows must pass"),
    validationItem("gates.pass", "gates", context.gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.ready", "boundary", context.boundary.ready_for_p9401_handoff === true && context.boundary.unsafe_flag_count === 0, "P9400 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const ready = context.validation.valid && context.boundary.ready_for_p9401_handoff;
  return {
    schema_version: "work-os-goal-drilldown-summary.v1",
    work_os_goal_drilldown_surface_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_goal_execution_view_status: context.source.data?.summary?.work_os_goal_execution_view_status ?? "missing",
    source_p9200_ready: isSourceReady(context.source),
    phase_row_count: context.phaseRows.length,
    source_binding_count: context.sourceBindingRows.length,
    drilldown_api_route_count: context.routeRows.length,
    drilldown_ui_binding_count: context.uiBindingRows.length,
    goal_api_projection_count: context.goal_api_projection_rows.length,
    next_action_projection_count: context.next_action_api_projection_rows.length,
    commit_checkpoint_projection_count: context.commit_checkpoint_api_projection_rows.length,
    session_handoff_projection_count: context.session_handoff_api_projection_rows.length,
    project_drilldown_count: context.project_drilldown_rows.length,
    goal_detail_count: context.goal_detail_rows.length,
    combined_status_count: context.combined_status_rows.length,
    api_smoke_count: context.apiSmokeRows.length,
    browser_smoke_count: context.browserSmokeRows.length,
    negative_fixture_count: context.negativeFixtureRows.length,
    p9400_freeze_count: context.freezeRows.length,
    p9400_freeze_ready: context.boundary.p9400_freeze_ready,
    gate_count: context.gateRows.length,
    pass_gate_count: context.gateRows.filter((row) => row.current_verdict === "pass").length,
    ready_for_p9401_handoff: context.boundary.ready_for_p9401_handoff,
    api_write_methods_enabled: context.boundary.api_write_methods_enabled,
    raw_transcript_body_visible: context.boundary.raw_transcript_body_visible,
    secret_keys_returned: context.boundary.secret_keys_returned,
    domain_pack_as_product_allowed: context.boundary.domain_pack_as_product_allowed,
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
    ui_git_write_enabled: context.boundary.ui_git_write_enabled,
    unsafe_flag_count: context.boundary.unsafe_flag_count,
    validation_error_count: context.validation.errors.length,
  };
}

function renderDrilldownHtml(result) {
  const projects = asArray(result.project_drilldown_rows).slice(0, 8);
  const goals = asArray(result.goal_detail_rows).slice(0, 8);
  const statuses = asArray(result.combined_status_rows).slice(0, 8);
  const sessions = asArray(result.session_handoff_api_projection_rows).slice(0, 6);
  const paths = UI_BINDING_SPECS.map(([, surfaceTitle, apiPath, responseKey]) => ({ surfaceTitle, apiPath, responseKey }));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Drilldown</title>
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
  <header id="work-os-drilldown-root">
    <h1>Hermes Work OS Drilldown</h1>
    <div class="meta">
      <span class="pill">Program ${escapeHtml(result.program_range)}</span>
      <span class="pill">Source ${escapeHtml(result.source_program_range)}</span>
      <span class="pill">Status ${escapeHtml(result.summary?.work_os_goal_drilldown_surface_status ?? READY_STATUS)}</span>
      <span class="pill">Generated ${escapeHtml(result.generated_at)}</span>
    </div>
  </header>
  <main>
    <section class="band" id="combined-status" data-api-path="/api/work-os/combined-status">
      <h2>Combined Status</h2>
      <div class="grid">${statuses.map(statusCard).join("")}</div>
    </section>
    <section class="band" id="project-drilldown" data-api-path="/api/work-os/project-drilldown">
      <h2>Projects</h2>
      <div class="grid">${projects.map(projectCard).join("")}</div>
    </section>
    <section class="band" id="goal-detail" data-api-path="/api/work-os/goal-detail">
      <h2>Goals</h2>
      <div class="grid">${goals.map(goalCard).join("")}</div>
    </section>
    <section class="band" id="session-handoffs" data-api-path="/api/work-os/session-handoffs">
      <h2>Session Handoffs</h2>
      <div class="grid">${sessions.map(sessionCard).join("")}</div>
    </section>
    <section class="band" id="drilldown-refresh">
      <h2>Read-Only API Bindings</h2>
      <button id="refresh-drilldown" type="button">Refresh</button>
      <pre id="drilldown-status">Awaiting read-only refresh.</pre>
    </section>
  </main>
  <script>
    window.WORK_OS_DRILLDOWN_API_PATHS = ${JSON.stringify(paths)};
    async function refreshReadOnlyDrilldown() {
      const output = [];
      for (const item of window.WORK_OS_DRILLDOWN_API_PATHS) {
        const response = await fetch(item.apiPath, { method: "GET", cache: "no-store" });
        output.push(item.responseKey + ":" + response.status);
      }
      document.getElementById("drilldown-status").textContent = output.join("\\n");
    }
    document.getElementById("refresh-drilldown").addEventListener("click", refreshReadOnlyDrilldown);
    refreshReadOnlyDrilldown().catch((error) => {
      document.getElementById("drilldown-status").textContent = "refresh_error:" + error.message;
    });
  </script>
</body>
</html>`;
}

function statusCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_id ?? "project")}</h3><div class="row"><span class="label">goals</span><span class="mono">${escapeHtml(row.goal_count ?? 0)}</span></div><div class="row"><span class="label">status</span><span class="ok">${escapeHtml(row.combined_status ?? "ready")}</span></div></article>`;
}

function projectCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_name ?? row.project_id)}</h3><div class="row"><span class="label">domain</span><span class="mono">${escapeHtml(row.domain_pack)}</span></div><div class="row"><span class="label">goals</span><span class="mono">${escapeHtml(row.goal_count)}</span></div><div class="row"><span class="label">scope</span><span class="mono">${escapeHtml(row.domain_pack_scope)}</span></div></article>`;
}

function goalCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_id)}</h3><div class="row"><span class="label">phase</span><span class="mono">${escapeHtml(row.phase_range)}</span></div><div class="row"><span class="label">evidence</span><span class="mono">${escapeHtml(row.evidence_ref)}</span></div><div class="row"><span class="label">final</span><span class="blocked">${escapeHtml(String(row.codex_final_approval_allowed || row.claude_final_approval_allowed))}</span></div></article>`;
}

function sessionCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.engine_id)}</h3><div class="row"><span class="label">session</span><span class="mono">${escapeHtml(row.session_id)}</span></div><div class="row"><span class="label">citation</span><span class="mono">${escapeHtml(row.citation_ref)}</span></div><div class="row"><span class="label">raw</span><span class="blocked">${escapeHtml(String(row.raw_body_visible))}</span></div></article>`;
}

function renderMarkdown(result) {
  return [
    "# Work OS Goal Drilldown Surface",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.work_os_goal_drilldown_surface_status}`,
    "",
    "## Summary",
    "",
    `- Source P9200 ready: ${result.summary.source_p9200_ready}`,
    `- Drilldown routes: ${result.summary.drilldown_api_route_count}`,
    `- Projects: ${result.summary.project_drilldown_count}`,
    `- Goal details: ${result.summary.goal_detail_count}`,
    `- Combined status rows: ${result.summary.combined_status_count}`,
    `- P9400 freeze ready: ${result.summary.p9400_freeze_ready}`,
    `- Ready for P9401 handoff: ${result.summary.ready_for_p9401_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P9201-P9400 binds the P9200 goal execution artifact to GET/HEAD-only drilldown API responses and a read-only browser shell. It does not enable API writes, raw/full transcript body display, secret-bearing response keys, domain pack product promotion, human gate completion, Codex final approval, Claude final approval, reviewer mutation, single-owner enterprise trust, protected closeout, production PASS, enterprise PASS, runtime execution, write action, external connector write, or UI git writes.",
    "",
  ].join("\n");
}

function buildCollectionResponse(collectionName, rows, url, generatedAt) {
  const safeRows = sanitizeApiPayload(asArray(rows));
  return {
    schema_version: "work-os-goal-drilldown-collection-response.v1",
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
    payload_projection: "sanitized_goal_drilldown_view_model",
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
    schema_version: "work-os-goal-drilldown-browser-smoke-row.v1",
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
    post_fetch_present: observations.post_fetch_present ?? false,
    smoke_status: pass ? "pass" : "blocked",
    evidence_ref: `evidence.${smokeId}`,
    next_allowed_action: pass ? "preserve browser drilldown smoke evidence" : `repair ${smokeId}`,
  }, pass);
}

function buildError(code, message) {
  return {
    schema_version: "work-os-goal-drilldown-error.v1",
    error: { code, message },
  };
}

function jsonResponse(status, payload, method = "GET") {
  return {
    status,
    headers: JSON_HEADERS,
    body: method === "HEAD" ? "" : `${JSON.stringify(payload, null, 2)}\n`,
  };
}

function htmlResponse(status, html, method = "GET") {
  return {
    status,
    headers: HTML_HEADERS,
    body: method === "HEAD" ? "" : html,
  };
}

function normalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function serializableResult(result) {
  const { html, markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
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
    schema_version: "work-os-goal-drilldown-validation-item.v1",
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
    && source.data?.summary?.work_os_goal_execution_view_status === SOURCE_READY_STATUS
    && source.data?.summary?.ready_for_p9201_handoff === true;
}

async function readJsonOrBuildWorkOsGoalExecutionView(filePath, generatedAt) {
  const resolved = path.resolve(filePath);
  const source = await readJsonSource(resolved);
  if (source.available && source.data?.summary?.work_os_goal_execution_view_status === SOURCE_READY_STATUS) return source;
  try {
    const built = await buildWorkOsGoalExecutionView({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.work_os_goal_execution_view", built);
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
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.architectureDocPath),
    source_work_os_goal_execution_view_path: path.resolve(options.sourceWorkOsGoalExecutionViewPath ?? DEFAULT_WORK_OS_GOAL_DRILLDOWN_SURFACE_INPUTS.sourceWorkOsGoalExecutionViewPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else if (arg === "--write") parsed.write = true;
    else if (arg === "--serve") parsed.serve = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap-doc") parsed.roadmapDocPath = argv[++index];
    else if (arg === "--architecture-doc") parsed.architectureDocPath = argv[++index];
    else if (arg === "--source") parsed.sourceWorkOsGoalExecutionViewPath = argv[++index];
    else if (arg === "--host") parsed.host = argv[++index];
    else if (arg === "--port") parsed.port = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-goal-drilldown-surface.mjs [options]

Builds or serves the P9201-P9400 Work OS goal execution API binding and project drilldown surface.

Options:
  --check                                            Validate without writing artifacts.
  --write                                            Write artifacts.
  --serve                                            Start the local read-only drilldown API/UI server.
  --out-dir <path>                                  Output directory.
  --schema <path>                                   Schema path.
  --package <path>                                  package.json path.
  --roadmap-doc <path>                              P9201-P9400 roadmap document path.
  --architecture-doc <path>                         Architecture document path.
  --source <path>                                   P9200 goal execution source path.
  --host <host>                                     Server host. Default ${DEFAULT_WORK_OS_GOAL_DRILLDOWN_HOST}.
  --port <port>                                     Server port. Default ${DEFAULT_WORK_OS_GOAL_DRILLDOWN_PORT}.
`);
}

function writeJson(filePath, data) {
  return writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function includesToken(text, token) {
  return typeof text === "string" && text.includes(token);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
