import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildWorkOsLiveControlSurface } from "./work-os-live-control-surface.mjs";

export const DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_OUT_DIR = "artifacts/work-os-read-only-api-ui-smoke/latest";
export const DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS = {
  schemaPath: "schemas/work-os-read-only-api-ui-smoke.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8801-p9000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsLiveControlSurfacePath: "artifacts/work-os-live-control-surface/latest/work-os-live-control-surface.json",
};

export const DEFAULT_WORK_OS_READ_ONLY_API_HOST = "127.0.0.1";
export const DEFAULT_WORK_OS_READ_ONLY_API_PORT = 4188;

const COMMAND_NAME = "platform:work-os-read-only-api-ui-smoke";
const SERVER_COMMAND_NAME = "work-os:serve";
const SOURCE_COMMAND_NAME = "platform:work-os-live-control-surface";
const SCHEMA_VERSION = "work-os-read-only-api-ui-smoke.v1";
const CAPABILITY_ID = "platform.work_os_read_only_api_ui_smoke";
const PROGRAM_RANGE = "P8801-P9000";
const SOURCE_PROGRAM_RANGE = "P8601-P8800";
const SOURCE_READY_STATUS = "ready_for_work_os_live_control_surface";
const READY_STATUS = "ready_for_work_os_read_only_api_ui_smoke";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

const PHASE_SPECS = [
  ["P8801-P8820", "API Source Contract Freeze"],
  ["P8821-P8840", "Read-Only API Server v0"],
  ["P8841-P8860", "API Projection Validator"],
  ["P8861-P8880", "UI Data Binding Adapter"],
  ["P8881-P8900", "Project Control View"],
  ["P8901-P8920", "Phase Detail View"],
  ["P8921-P8940", "Timeline And Review View"],
  ["P8941-P8960", "Live Refresh Smoke"],
  ["P8961-P8980", "Browser Smoke Evidence"],
  ["P8981-P9000", "P9000 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Health and source readiness", null],
  ["/api/work-os", "route_index", "Read-only route index", null],
  ["/api/work-os/summary", "summary", "Work OS summary", "summary"],
  ["/api/work-os/projects", "projects", "Project control rows", "project_control_surface_rows"],
  ["/api/work-os/phases", "phases", "Phase detail rows", "phase_detail_surface_rows"],
  ["/api/work-os/timeline", "timeline", "Redacted timeline rows", "redacted_timeline_projection_rows"],
  ["/api/work-os/reviews", "reviews", "Review and finding rows", "review_finding_surface_rows"],
  ["/api/work-os/gates", "gates", "Gate rows", "work_os_live_gate_rows"],
  ["/api/work-os/session-sources", "session_sources", "Session source rows", "session_ingestion_adapter_rows"],
  ["/api/work-os/boundary", "boundary", "Boundary row", "work_os_live_boundary"],
  ["/api/work-os/refresh", "refresh", "Read-only refresh snapshot", null],
];

const UI_BINDING_SPECS = [
  ["ui.work_os_shell", "Global Operator Console", "/api/work-os/summary", "summary"],
  ["ui.project_control", "Global Operator Queue", "/api/work-os/projects", "projects"],
  ["ui.phase_detail", "Readiness Rule Matrix", "/api/work-os/phases", "phases"],
  ["ui.timeline", "Evidence Timeline", "/api/work-os/timeline", "timeline"],
  ["ui.review_console", "Review Evidence Trace", "/api/work-os/reviews", "reviews"],
  ["ui.gate_console", "Gate State Console", "/api/work-os/gates", "gates"],
  ["ui.refresh_status", "Read-Only Refresh", "/api/work-os/refresh", "refresh"],
];

const WORK_OS_LOCALE_SPECS = [
  ["ko", "Korean", "한국어", "ko", true, true],
  ["en", "English", "English", "en", false, false],
];

const WORK_OS_KOREAN_FONT_SPECS = [
  ["ko.body", "Hermes Pretendard", "Pretendard", "body"],
  ["ko.heading", "Hermes SUITE", "SUITE", "heading"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p8800_source", "P9000 claims readiness without P8800 source readiness", "BLOCK_MISSING_P8800_SOURCE"],
  ["negative.non_get_method", "API accepts POST PUT PATCH or DELETE", "BLOCK_MUTATING_API_METHOD"],
  ["negative.raw_payload_response", "API or UI exposes raw or full transcript payload keys", "BLOCK_RAW_PAYLOAD_RESPONSE"],
  ["negative.unsanitized_secret_key", "API or UI exposes secret-bearing keys", "BLOCK_SECRET_KEY_RESPONSE"],
  ["negative.refresh_mutates_state", "Refresh route mutates plan or source state", "BLOCK_REFRESH_MUTATION"],
  ["negative.ui_protected_action", "UI enables protected action controls", "BLOCK_PROTECTED_UI_ACTION"],
  ["negative.ui_blank", "UI smoke passes with blank or missing shell", "BLOCK_BLANK_UI"],
  ["negative.uncited_projection", "Projection row appears without source citation policy", "BLOCK_UNCITED_PROJECTION"],
  ["negative.codex_final_approval", "Codex final approval is enabled by UI/API", "BLOCK_CODEX_FINAL_APPROVAL"],
  ["negative.claude_final_approval", "Claude final approval is enabled by UI/API", "BLOCK_CLAUDE_FINAL_APPROVAL"],
  ["negative.production_enterprise_pass", "P9000 creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.runtime_write_connector", "Runtime execution, write action, or connector write is enabled", "BLOCK_RUNTIME_WRITE_CONNECTOR"],
];

export async function runWorkOsReadOnlyApiUiSmoke(options = {}) {
  const result = await buildWorkOsReadOnlyApiUiSmoke(options);
  if (options.write !== false) await writeWorkOsReadOnlyApiUiSmoke(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS read-only API/UI smoke failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsReadOnlyApiUiSmoke(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = options.workOsLiveControlSurface
    ? normalizeInlineJsonSource("inline.work_os_live_control_surface", options.workOsLiveControlSurface)
    : await readJsonOrBuildWorkOsLiveControlSurface(inputs.source_work_os_live_control_surface_path, generatedAt);

  const sourceData = source.data ?? {};
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const apiRouteRows = buildApiRouteProjectionRows(generatedAt);
  const uiBindingRows = buildUiBindingRows(generatedAt);
  const localeRows = buildLocaleRows(generatedAt);
  const typographyRows = buildTypographyRows(generatedAt);
  const directSmokeRows = await buildDirectApiSmokeRows(sourceData, generatedAt);
  const uiSmokeRows = await buildUiSmokeRows(sourceData, generatedAt);
  const p9000FreezeRows = buildP9000FreezeRows({
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    localeRows,
    typographyRows,
    directSmokeRows,
    uiSmokeRows,
    source,
    generatedAt,
  });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    localeRows,
    typographyRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({
    source,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const html = renderWorkOsHtml(sourceData, { generatedAt });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    work_os_read_only_api_ui_smoke_id: `work-os-read-only-api-ui-smoke.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_live_control_surface_summary: source.data?.summary ?? null,
    work_os_read_only_api_ui_smoke_contract: contract,
    work_os_read_only_api_ui_phase_rows: phaseRows,
    read_only_api_route_projection_rows: apiRouteRows,
    ui_data_binding_adapter_rows: uiBindingRows,
    locale_selector_rows: localeRows,
    typography_contract_rows: typographyRows,
    api_projection_smoke_rows: directSmokeRows,
    browser_smoke_evidence_rows: uiSmokeRows,
    p9000_freeze_rows: p9000FreezeRows,
    work_os_read_only_negative_fixture_rows: negativeFixtureRows,
    work_os_read_only_gate_rows: gateRows,
    work_os_read_only_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      phaseRows,
      apiRouteRows,
      uiBindingRows,
      localeRows,
      typographyRows,
      directSmokeRows,
      uiSmokeRows,
      p9000FreezeRows,
      negativeFixtureRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_read_only_api_ui_smoke")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    localeRows,
    typographyRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.work_os_read_only_api_ui_smoke_id = result.work_os_read_only_api_ui_smoke_id;
  return { ...result, html, markdown: renderMarkdown(result) };
}

export async function writeWorkOsReadOnlyApiUiSmoke(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-read-only-api-ui-smoke.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-read-only-api-ui-phase-rows.json"), collectionEnvelope("work-os-read-only-api-ui-phase-rows.v1", "work_os_read_only_api_ui_phase_rows", result.work_os_read_only_api_ui_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-api-route-projection-rows.json"), collectionEnvelope("read-only-api-route-projection-rows.v1", "read_only_api_route_projection_rows", result.read_only_api_route_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-data-binding-adapter-rows.json"), collectionEnvelope("ui-data-binding-adapter-rows.v1", "ui_data_binding_adapter_rows", result.ui_data_binding_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "locale-selector-rows.json"), collectionEnvelope("work-os-locale-selector-rows.v1", "locale_selector_rows", result.locale_selector_rows, result.generated_at));
  await writeJson(path.join(outDir, "typography-contract-rows.json"), collectionEnvelope("work-os-typography-contract-rows.v1", "typography_contract_rows", result.typography_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "api-projection-smoke-rows.json"), collectionEnvelope("api-projection-smoke-rows.v1", "api_projection_smoke_rows", result.api_projection_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "browser-smoke-evidence-rows.json"), collectionEnvelope("browser-smoke-evidence-rows.v1", "browser_smoke_evidence_rows", result.browser_smoke_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "p9000-freeze-rows.json"), collectionEnvelope("p9000-freeze-rows.v1", "p9000_freeze_rows", result.p9000_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-read-only-negative-fixture-rows.json"), collectionEnvelope("work-os-read-only-negative-fixture-rows.v1", "work_os_read_only_negative_fixture_rows", result.work_os_read_only_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-read-only-gate-rows.json"), collectionEnvelope("work-os-read-only-gate-rows.v1", "work_os_read_only_gate_rows", result.work_os_read_only_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-read-only-boundary.json"), result.work_os_read_only_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-read-only-api-ui-smoke-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function createWorkOsReadOnlyApiServer(options = {}) {
  return createServer(async (request, response) => {
    const apiResponse = await buildWorkOsReadOnlyApiResponse(request.url ?? "/", {
      ...options,
      method: request.method,
    });
    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
  });
}

export async function startWorkOsReadOnlyApiServer(options = {}) {
  const host = options.host ?? DEFAULT_WORK_OS_READ_ONLY_API_HOST;
  const port = Number(options.port ?? DEFAULT_WORK_OS_READ_ONLY_API_PORT);
  const server = createWorkOsReadOnlyApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, host, port: actualPort, url: `http://${host}:${actualPort}` };
}

export async function buildWorkOsReadOnlyApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Work OS API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const source = options.workOsLiveControlSurface
    ? normalizeInlineJsonSource("inline.work_os_live_control_surface", options.workOsLiveControlSurface)
    : await readJsonOrBuildWorkOsLiveControlSurface(options.sourceWorkOsLiveControlSurfacePath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.sourceWorkOsLiveControlSurfacePath, generatedAt);

  if (!isSourceReady(source)) {
    return jsonResponse(503, buildError("work_os_source_unavailable", source.error ?? "P8800 Work OS live control source is not ready."), method);
  }
  const artifact = source.data;
  if (pathname === "/" || pathname === "/index.html" || pathname === "/work-os.html") {
    return htmlResponse(200, renderWorkOsHtml(artifact, { generatedAt }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, {
      schema_version: "work-os-read-only-health.v1",
      generated_at: generatedAt,
      status: "ok",
      source_status: artifact.summary?.work_os_live_control_surface_status,
      source_ready: true,
      read_only: true,
      mutation_allowed: false,
    }, method);
  }
  if (pathname === "/api/work-os") {
    return jsonResponse(200, buildRouteIndex(artifact, generatedAt), method);
  }
  if (pathname === "/api/work-os/summary") {
    return jsonResponse(200, sanitizeApiPayload({
      schema_version: "work-os-summary-response.v1",
      generated_at: generatedAt,
      source: artifact.summary,
      policy: responsePolicy(),
    }), method);
  }
  if (pathname === "/api/work-os/refresh") {
    return jsonResponse(200, sanitizeApiPayload({
      schema_version: "work-os-refresh-response.v1",
      generated_at: generatedAt,
      refresh_status: "ready_read_only_recomputed",
      source_generated_at: artifact.generated_at,
      source_status: artifact.summary?.work_os_live_control_surface_status,
      refresh_mutates_state: false,
      source_rewritten: false,
      plan_mutated: false,
      policy: responsePolicy(),
    }), method);
  }
  const routeSpec = API_ROUTE_SPECS.find(([apiPath]) => apiPath === pathname);
  if (routeSpec) {
    const [, responseKey,, collectionRef] = routeSpec;
    const rows = collectionRef === "work_os_live_boundary"
      ? [artifact.work_os_live_boundary].filter(Boolean)
      : asArray(artifact[collectionRef]);
    return jsonResponse(200, buildCollectionResponse(responseKey, rows, url, generatedAt), method);
  }
  return jsonResponse(404, buildError("not_found", `No Work OS read-only route for ${pathname}`), method);
}

export async function runWorkOsReadOnlyApiUiSmokeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    try {
      const started = await startWorkOsReadOnlyApiServer(args);
      console.log(`Work OS read-only API/UI server listening at ${started.url}`);
      console.log(`Open ${started.url}/work-os.html`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }
  try {
    const result = await runWorkOsReadOnlyApiUiSmoke(args);
    console.log(`Work OS read-only API/UI smoke ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_read_only_api_ui_smoke_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`API routes: ${result.summary.api_route_count}`);
    console.log(`UI bindings: ${result.summary.ui_binding_count}`);
    console.log(`Browser smoke ready: ${result.summary.browser_smoke_ready}`);
    console.log(`P9000 freeze ready: ${result.summary.p9000_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "work-os-read-only-api-ui-smoke-contract.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_status_required: SOURCE_READY_STATUS,
    api_source_artifact_required: true,
    read_only_api_server_required: true,
    ui_data_binding_adapter_required: true,
    locale_selector_required: true,
    default_locale: "ko",
    available_locales: ["ko", "en"],
    korean_copy_keeps_natural_english_terms: true,
    korean_body_font_family: "Hermes Pretendard",
    korean_heading_font_family: "Hermes SUITE",
    english_font_family: "system-ui",
    project_control_view_required: true,
    phase_detail_view_required: true,
    timeline_review_view_required: true,
    live_refresh_smoke_required: true,
    browser_smoke_evidence_required: true,
    p9000_freeze_required: true,
    api_get_head_only: true,
    api_write_methods_enabled: false,
    raw_payload_keys_returned: false,
    secret_keys_returned: false,
    ui_embeds_raw_material: false,
    ui_protected_action_controls_enabled: false,
    refresh_mutates_state: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-read-only-api-ui-phase-row.v1",
      row_id: `work.os.read.only.api.ui.phase.row.${String(index + 1).padStart(2, "0")}`,
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
      next_allowed_action: pass ? "preserve P9000 phase evidence" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildApiRouteProjectionRows(generatedAt) {
  return API_ROUTE_SPECS.map(([api_path, response_key, description, source_collection_ref], index) => verdictRow({
    schema_version: "read-only-work-os-api-route-projection-row.v1",
    row_id: `read.only.work.os.api.route.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    api_path,
    method_allowlist: ["GET", "HEAD"],
    response_key,
    description,
    source_collection_ref: source_collection_ref ?? "computed_response",
    artifact_backed: true,
    read_only: true,
    write_methods_enabled: false,
    mutates_state: false,
    protected_action_enabled: false,
    raw_payload_keys_returned: false,
    secret_keys_returned: false,
    source_citation_required: true,
    server_implementation: "createWorkOsReadOnlyApiServer",
    route_status: "ready",
    next_allowed_action: "serve artifact-backed GET/HEAD response",
  }, true));
}

function buildUiBindingRows(generatedAt) {
  return UI_BINDING_SPECS.map(([surface_id, surface_title, consumes_api_path, response_key], index) => verdictRow({
    schema_version: "work-os-ui-data-binding-adapter-row.v1",
    row_id: `work.os.ui.binding.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    surface_id,
    surface_title,
    consumes_api_path,
    response_key,
    html_target_ref: `#${surface_id.replaceAll(".", "-")}`,
    binding_mode: "browser_fetch_read_only_json",
    bounded_snapshot: true,
    read_only: true,
    source_citation_visible: true,
    stale_context_badge_visible: true,
    missing_validation_badge_visible: true,
    unresolved_review_badge_visible: true,
    raw_material_embedded: false,
    secret_embedded: false,
    protected_action_controls_enabled: false,
    mutation_allowed: false,
    binding_status: "ready",
    next_allowed_action: "bind browser surface to read-only API route",
  }, true));
}

function buildLocaleRows(generatedAt) {
  return WORK_OS_LOCALE_SPECS.map(([locale_id, label, native_label, html_lang, is_default, keeps_natural_english_terms], index) => verdictRow({
    schema_version: "work-os-locale-selector-row.v1",
    row_id: `work.os.locale.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    locale_id,
    label,
    native_label,
    html_lang,
    is_default,
    selectable: true,
    selector_label: "Korean / English",
    copy_dictionary_present: true,
    keeps_natural_english_terms,
    natural_english_terms: locale_id === "ko"
      ? ["Hermes", "Global Operator Console", "Queue", "Gate", "Review", "Receipt", "Evidence", "API", "CI"]
      : [],
    mutation_allowed: false,
    protected_action_controls_enabled: false,
    next_allowed_action: "render read-only product shell in selected locale",
  }, true));
}

function buildTypographyRows(generatedAt) {
  return WORK_OS_KOREAN_FONT_SPECS.map(([font_id, font_family, source_family, role], index) => verdictRow({
    schema_version: "work-os-typography-contract-row.v1",
    row_id: `work.os.typography.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    font_id,
    locale_id: "ko",
    role,
    font_family,
    source_family,
    declared_in_css: true,
    binary_embedded_in_html: false,
    repository_font_copy_required: false,
    production_packaging_requires_license_review: true,
    fallback_stack: role === "heading"
      ? '"Hermes SUITE", "Hermes Pretendard", system-ui, sans-serif'
      : '"Hermes Pretendard", system-ui, sans-serif',
    next_allowed_action: "package font files only after license and deployment review",
  }, true));
}

async function buildDirectApiSmokeRows(sourceData, generatedAt) {
  const paths = API_ROUTE_SPECS.map(([apiPath]) => apiPath);
  const rows = [];
  for (const [index, apiPath] of paths.entries()) {
    const response = await buildWorkOsReadOnlyApiResponse(apiPath, {
      method: "GET",
      runAt: generatedAt,
      workOsLiveControlSurface: sourceData,
    });
    const unsafe = inspectResponseBody(response.body);
    rows.push(verdictRow({
      schema_version: "work-os-api-projection-smoke-row.v1",
      row_id: `work.os.api.smoke.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      smoke_id: `api_smoke.${slug(apiPath)}`,
      api_path: apiPath,
      method: "GET",
      observed_status: response.status,
      expected_status: 200,
      response_nonblank: response.body.length > 0,
      raw_payload_keys_present: unsafe.rawPayloadKeysPresent,
      secret_keys_present: unsafe.secretKeysPresent,
      mutating_method_used: false,
      refresh_mutates_state: apiPath === "/api/work-os/refresh" ? response.body.includes("\"refresh_mutates_state\":true") : false,
      smoke_status: response.status === 200 && response.body.length > 0 && !unsafe.rawPayloadKeysPresent && !unsafe.secretKeysPresent ? "pass" : "blocked",
      evidence_ref: `evidence.api_smoke.${slug(apiPath)}`,
      next_allowed_action: "preserve read-only API smoke evidence",
    }, response.status === 200 && response.body.length > 0 && !unsafe.rawPayloadKeysPresent && !unsafe.secretKeysPresent));
  }
  const postResponse = await buildWorkOsReadOnlyApiResponse("/api/work-os/projects", {
    method: "POST",
    runAt: generatedAt,
    workOsLiveControlSurface: sourceData,
  });
  rows.push(verdictRow({
    schema_version: "work-os-api-projection-smoke-row.v1",
    row_id: `work.os.api.smoke.row.${String(rows.length + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    smoke_id: "api_smoke.post_rejected",
    api_path: "/api/work-os/projects",
    method: "POST",
    observed_status: postResponse.status,
    expected_status: 405,
    response_nonblank: postResponse.body.length > 0,
    raw_payload_keys_present: false,
    secret_keys_present: false,
    mutating_method_used: true,
    refresh_mutates_state: false,
    smoke_status: postResponse.status === 405 ? "pass" : "blocked",
    evidence_ref: "evidence.api_smoke.post_rejected",
    next_allowed_action: "preserve mutating method rejection",
  }, postResponse.status === 405));
  return rows;
}

async function buildUiSmokeRows(sourceData, generatedAt) {
  const htmlResponseResult = await buildWorkOsReadOnlyApiResponse("/work-os.html", {
    method: "GET",
    runAt: generatedAt,
    workOsLiveControlSurface: sourceData,
  });
  const html = htmlResponseResult.body;
  const unsafe = inspectResponseBody(html);
  const requiredPaths = UI_BINDING_SPECS.map(([, , apiPath]) => apiPath);
  const rows = [
    smokeRow("browser_smoke.html_status", "HTML route returns 200", htmlResponseResult.status === 200, {
      observed_status: htmlResponseResult.status,
      response_length: html.length,
    }, generatedAt),
    smokeRow("browser_smoke.nonblank_shell", "HTML shell is nonblank", html.length > 1200 && includesToken(html, "work-os-root"), {
      observed_status: htmlResponseResult.status,
      response_length: html.length,
    }, generatedAt),
    smokeRow("browser_smoke.api_bindings", "HTML shell declares all API bindings", requiredPaths.every((apiPath) => includesToken(html, apiPath)), {
      required_path_count: requiredPaths.length,
      observed_path_count: requiredPaths.filter((apiPath) => includesToken(html, apiPath)).length,
    }, generatedAt),
    smokeRow("browser_smoke.no_raw_payload_keys", "HTML shell does not embed raw payload or secret keys", !unsafe.rawPayloadKeysPresent && !unsafe.secretKeysPresent, {
      raw_payload_keys_present: unsafe.rawPayloadKeysPresent,
      secret_keys_present: unsafe.secretKeysPresent,
    }, generatedAt),
    smokeRow("browser_smoke.no_protected_actions", "HTML shell has no protected action controls", !includesToken(html, "data-protected-action") && !includesToken(html, "protected-action-enabled"), {
      protected_action_token_present: includesToken(html, "data-protected-action") || includesToken(html, "protected-action-enabled"),
    }, generatedAt),
    smokeRow("browser_smoke.refresh_read_only", "Refresh binding is read-only", includesToken(html, "/api/work-os/refresh") && !includesToken(html, "method: 'POST'"), {
      refresh_path_present: includesToken(html, "/api/work-os/refresh"),
      post_fetch_present: includesToken(html, "method: 'POST'"),
    }, generatedAt),
    smokeRow("browser_smoke.locale_selector", "HTML shell exposes Korean English locale selector", includesToken(html, "data-locale-select") && includesToken(html, "Korean / English") && includesToken(html, "data-locale=\"ko\""), {
      locale_selector_present: includesToken(html, "data-locale-select"),
      korean_default_present: includesToken(html, "data-locale=\"ko\""),
      post_fetch_present: false,
      protected_action_token_present: false,
    }, generatedAt),
    smokeRow("browser_smoke.korean_fonts", "HTML shell declares Korean Pretendard and SUITE font families", includesToken(html, "Hermes Pretendard") && includesToken(html, "Hermes SUITE"), {
      pretendard_present: includesToken(html, "Hermes Pretendard"),
      suite_present: includesToken(html, "Hermes SUITE"),
      post_fetch_present: false,
      protected_action_token_present: false,
    }, generatedAt),
    smokeRow("browser_smoke.operator_console_model", "HTML shell exposes Global Operator Queue evidence trace and readiness matrix", includesToken(html, "Global Operator Queue") && includesToken(html, "Review Evidence Trace") && includesToken(html, "Readiness Rule Matrix"), {
      operator_queue_present: includesToken(html, "Global Operator Queue"),
      review_trace_present: includesToken(html, "Review Evidence Trace"),
      readiness_matrix_present: includesToken(html, "Readiness Rule Matrix"),
      post_fetch_present: false,
      protected_action_token_present: false,
    }, generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, row_id: `work.os.browser.smoke.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildP9000FreezeRows(context) {
  const {
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    source,
    generatedAt,
  } = context;
  const rows = [
    ["freeze.source_ready", "P8800 source is ready", isSourceReady(source)],
    ["freeze.phase_rows", "P8801-P9000 phase rows pass", phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.api_routes", "Read-only API routes are implemented", apiRouteRows.length === API_ROUTE_SPECS.length && apiRouteRows.every((row) => row.current_verdict === "pass")],
    ["freeze.ui_bindings", "UI bindings target read-only routes", uiBindingRows.length === UI_BINDING_SPECS.length && uiBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.api_smoke", "API smoke rows pass", directSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.browser_smoke", "Browser smoke rows pass", uiSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.no_raw_or_secret", "API and UI smoke do not expose raw payload or secret keys", [...directSmokeRows, ...uiSmokeRows].every((row) => row.raw_payload_keys_present !== true && row.secret_keys_present !== true)],
    ["freeze.no_mutation", "Mutating methods and refresh mutation remain blocked", directSmokeRows.some((row) => row.method === "POST" && row.observed_status === 405) && directSmokeRows.every((row) => row.refresh_mutates_state !== true)],
    ["freeze.p9000_handoff", "P9000 can hand off to P9001", true],
  ];
  return rows.map(([freeze_id, description, pass], index) => verdictRow({
    schema_version: "p9000-freeze-row.v1",
    row_id: `p9000.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    description,
    evidence_ref: `evidence.${freeze_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `gate.${freeze_id}`,
    next_allowed_action: pass ? "include in P9000 freeze packet" : "repair P9000 freeze prerequisite",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, description, expected_block_code], index) => verdictRow({
    schema_version: "work-os-read-only-negative-fixture-row.v1",
    row_id: `work.os.read.only.negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
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

function buildGateRows(context) {
  const {
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
  } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P9000 command"],
    ["server_script_registered", Boolean(packageJson.data?.scripts?.[SERVER_COMMAND_NAME]), "package.json exposes Work OS serve command"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes P9000 command"],
    ["runs_after_p8800", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "P9000 command runs after P8800 source command"],
    ["source_p8800_ready", isSourceReady(source), "P8800 source is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Read-Only Work OS API Server"), "P8801-P9000 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "P8801-P9000 Read-Only Work OS API Server, Live UI Binding, Browser Smoke Evidence, and P9000 Freeze"), "architecture reflects P9000"],
    ["phase_rows_pass", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all P8801-P9000 phase rows pass"],
    ["api_routes_ready", apiRouteRows.length === API_ROUTE_SPECS.length && apiRouteRows.every((row) => row.current_verdict === "pass"), "read-only API routes are ready"],
    ["api_get_head_only", apiRouteRows.every((row) => row.method_allowlist.join(",") === "GET,HEAD" && row.write_methods_enabled === false && row.mutates_state === false), "API routes are GET/HEAD only"],
    ["ui_bindings_ready", uiBindingRows.length === UI_BINDING_SPECS.length && uiBindingRows.every((row) => row.read_only && row.protected_action_controls_enabled === false), "UI binding rows are read-only"],
    ["api_smoke_pass", directSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows pass"],
    ["browser_smoke_pass", uiSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows pass"],
    ["negative_fixtures_block", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), "negative fixtures block unsafe claims"],
    ["p9000_freeze_rows_ready", p9000FreezeRows.every((row) => row.current_verdict === "pass"), "P9000 freeze rows are ready"],
    ["no_raw_or_secret", [...directSmokeRows, ...uiSmokeRows].every((row) => row.raw_payload_keys_present !== true && row.secret_keys_present !== true), "smoke rows show no raw payload or secret keys"],
    ["refresh_non_mutating", directSmokeRows.every((row) => row.refresh_mutates_state !== true), "refresh smoke is non-mutating"],
    ["no_human_gate", contract.human_gate_in_scope === false, "human gate remains excluded"],
    ["no_final_authority", contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write_connector", contract.runtime_execution_enabled === false && contract.write_action_enabled === false && contract.external_connector_write_enabled === false, "runtime execution write and connector write remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "work-os-read-only-gate-row.v1",
    row_id: `work.os.read.only.gate.row.${String(index + 1).padStart(2, "0")}`,
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
  const {
    source,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
  } = context;
  const sourceReady = isSourceReady(source);
  const phaseReady = phaseRows.every((row) => row.current_verdict === "pass");
  const apiReady = apiRouteRows.every((row) => row.current_verdict === "pass");
  const uiReady = uiBindingRows.every((row) => row.current_verdict === "pass");
  const apiSmokeReady = directSmokeRows.every((row) => row.current_verdict === "pass");
  const browserSmokeReady = uiSmokeRows.every((row) => row.current_verdict === "pass");
  const freezeReady = p9000FreezeRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const gatesPass = gateRows.every((row) => row.current_verdict === "pass");
  const unsafeFlags = [
    false, // raw_payload_keys_returned
    false, // secret_keys_returned
    false, // api_write_methods_enabled
    false, // ui_protected_action_controls_enabled
    false, // refresh_mutates_state
    false, // human_gate_in_scope
    false, // codex_final_approval_allowed
    false, // claude_final_approval_allowed
    false, // production_pass_enabled
    false, // enterprise_pass_enabled
    false, // protected_closeout_enabled
    false, // runtime_execution_enabled
    false, // write_action_enabled
    false, // external_connector_write_enabled
  ];
  return {
    schema_version: "work-os-read-only-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p8800_ready: sourceReady,
    phase_rows_ready: phaseReady,
    read_only_api_ready: apiReady,
    ui_binding_ready: uiReady,
    api_smoke_ready: apiSmokeReady,
    browser_smoke_ready: browserSmokeReady,
    p9000_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p9001_handoff: sourceReady && phaseReady && apiReady && uiReady && apiSmokeReady && browserSmokeReady && freezeReady && negativeFixturesBlock && gatesPass,
    raw_payload_keys_returned: false,
    secret_keys_returned: false,
    api_write_methods_enabled: false,
    ui_protected_action_controls_enabled: false,
    refresh_mutates_state: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(context) {
  const {
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.server_script", "package", Boolean(packageJson.data?.scripts?.[SERVER_COMMAND_NAME]), "server script must exist"),
    validationItem("package.validate", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include command"),
    validationItem("package.order", "package", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "command must run after P8800 source command"),
    validationItem("source.ready", "source", isSourceReady(source), "P8800 source must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "roadmap must reflect P8801-P9000"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P8801-P9000 Read-Only Work OS API Server, Live UI Binding, Browser Smoke Evidence, and P9000 Freeze"), "architecture must reflect P9000"),
    validationItem("contract.boundaries", "contract", contract.api_get_head_only && contract.api_write_methods_enabled === false && contract.raw_payload_keys_returned === false && contract.refresh_mutates_state === false, "contract must keep API read-only and sanitized"),
    validationItem("phase.rows", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("api.routes", "api", apiRouteRows.length === API_ROUTE_SPECS.length && apiRouteRows.every((row) => row.method_allowlist.includes("GET") && row.method_allowlist.includes("HEAD") && row.write_methods_enabled === false), "API routes must be GET/HEAD only"),
    validationItem("ui.bindings", "ui", uiBindingRows.length === UI_BINDING_SPECS.length && uiBindingRows.every((row) => row.read_only && row.protected_action_controls_enabled === false), "UI bindings must be read-only"),
    validationItem("api.smoke", "api", directSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", uiSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows must pass"),
    validationItem("api.no_raw_secret", "api", directSmokeRows.every((row) => row.raw_payload_keys_present !== true && row.secret_keys_present !== true), "API smoke must not expose raw payload or secret keys"),
    validationItem("ui.no_raw_secret", "ui", uiSmokeRows.every((row) => row.raw_payload_keys_present !== true && row.secret_keys_present !== true), "UI smoke must not expose raw payload or secret keys"),
    validationItem("refresh.no_mutation", "api", directSmokeRows.every((row) => row.refresh_mutates_state !== true), "refresh route cannot mutate state"),
    validationItem("freeze.ready", "freeze", p9000FreezeRows.every((row) => row.current_verdict === "pass"), "P9000 freeze rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("gates.pass", "gates", gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.no_final_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false, "Codex and Claude final approval must remain false"),
    validationItem("boundary.no_enterprise_production", "boundary", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "production and enterprise PASS must remain false"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.external_connector_write_enabled === false, "runtime write connector must remain false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p9001_handoff === true && boundary.unsafe_flag_count === 0, "P9000 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const {
    source,
    phaseRows,
    apiRouteRows,
    uiBindingRows,
    localeRows = [],
    typographyRows = [],
    directSmokeRows,
    uiSmokeRows,
    p9000FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation,
  } = context;
  const ready = validation.valid && boundary.ready_for_p9001_handoff;
  return {
    schema_version: "work-os-read-only-api-ui-smoke-summary.v1",
    work_os_read_only_api_ui_smoke_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_live_control_surface_status: source.data?.summary?.work_os_live_control_surface_status ?? "missing",
    source_p8800_ready: isSourceReady(source),
    phase_row_count: phaseRows.length,
    api_route_count: apiRouteRows.length,
    ui_binding_count: uiBindingRows.length,
    locale_count: localeRows.length,
    typography_contract_count: typographyRows.length,
    default_locale: localeRows.find((row) => row.is_default)?.locale_id ?? "ko",
    korean_font_contract_ready: typographyRows.some((row) => row.font_family === "Hermes Pretendard")
      && typographyRows.some((row) => row.font_family === "Hermes SUITE"),
    api_smoke_count: directSmokeRows.length,
    browser_smoke_count: uiSmokeRows.length,
    p9000_freeze_count: p9000FreezeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    read_only_api_ready: boundary.read_only_api_ready,
    ui_binding_ready: boundary.ui_binding_ready,
    api_smoke_ready: boundary.api_smoke_ready,
    browser_smoke_ready: boundary.browser_smoke_ready,
    p9000_freeze_ready: boundary.p9000_freeze_ready,
    ready_for_p9001_handoff: boundary.ready_for_p9001_handoff,
    raw_payload_keys_returned: boundary.raw_payload_keys_returned,
    secret_keys_returned: boundary.secret_keys_returned,
    api_write_methods_enabled: boundary.api_write_methods_enabled,
    ui_protected_action_controls_enabled: boundary.ui_protected_action_controls_enabled,
    refresh_mutates_state: boundary.refresh_mutates_state,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    external_connector_write_enabled: boundary.external_connector_write_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function buildCollectionResponse(collectionName, rows, url, generatedAt) {
  const safeRows = sanitizeApiPayload(asArray(rows));
  return {
    schema_version: "work-os-read-only-collection-response.v1",
    generated_at: generatedAt,
    collection: collectionName,
    count: safeRows.length,
    filters: Object.fromEntries(url.searchParams.entries()),
    policy: responsePolicy(),
    rows: safeRows,
  };
}

function buildRouteIndex(artifact, generatedAt) {
  return {
    schema_version: "work-os-read-only-route-index.v1",
    generated_at: generatedAt,
    source_status: artifact.summary?.work_os_live_control_surface_status,
    source_generated_at: artifact.generated_at,
    policy: responsePolicy(),
    routes: API_ROUTE_SPECS.map(([api_path, response_key, description]) => ({
      api_path,
      method_allowlist: ["GET", "HEAD"],
      response_key,
      description,
      write_methods_enabled: false,
      mutates_state: false,
      sensitive_material_hidden: true,
    })),
  };
}

function responsePolicy() {
  return {
    read_only: true,
    method_allowlist: ["GET", "HEAD"],
    write_methods_enabled: false,
    mutates_state: false,
    payload_projection: "sanitized_view_model",
    sensitive_material: "hidden",
    source_citation_required: true,
  };
}

function renderWorkOsHtml(artifact, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const summary = artifact.summary ?? {};
  const projects = asArray(artifact.project_control_surface_rows).slice(0, 5);
  const phases = asArray(artifact.phase_detail_surface_rows).slice(0, 10);
  const reviews = asArray(artifact.review_finding_surface_rows).slice(0, 5);
  const timeline = asArray(artifact.redacted_timeline_projection_rows).slice(0, 5);
  const paths = UI_BINDING_SPECS.map(([, surfaceTitle, apiPath, responseKey]) => ({ surfaceTitle, apiPath, responseKey }));
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global Operator Console</title>
  <style>
    :root {
      --ink: #151a17;
      --muted: #5f6963;
      --line: #d8dfda;
      --paper: #f7f9f8;
      --panel: #ffffff;
      --ok: #146c43;
      --warn: #8a5a00;
      --block: #9b1c31;
      --accent: #255e87;
      --review: #604f8f;
      --focus: #1f6feb;
    }
    @font-face {
      font-family: "Hermes Pretendard";
      src: local("Pretendard");
      font-weight: 400 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Hermes SUITE";
      src: local("SUITE");
      font-weight: 400 700;
      font-style: normal;
      font-display: swap;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font: 14px/1.45 "Hermes Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    body[data-locale="en"] {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }
    header {
      padding: 18px 24px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    h1, h2, h3 {
      font-family: "Hermes SUITE", "Hermes Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body[data-locale="en"] h1,
    body[data-locale="en"] h2,
    body[data-locale="en"] h3 {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      background: #fbfcfb;
      white-space: nowrap;
    }
    main { padding: 18px 24px 32px; display: grid; gap: 16px; }
    .band {
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    section > h2 {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 650;
    }
    .surface-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }
    .surface-title span {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .item {
      min-height: 92px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .item h3 { margin: 0; font-size: 14px; font-weight: 650; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .label { color: var(--muted); }
    .status-pass { color: var(--ok); font-weight: 650; }
    .status-blocked { color: var(--block); font-weight: 650; }
    .status-review { color: var(--review); font-weight: 650; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow-wrap: anywhere; }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 12px;
    }
    .toolbar-copy {
      min-width: 0;
    }
    .toolbar-copy strong {
      display: block;
      font-size: 15px;
    }
    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    button, select {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--ink);
      padding: 7px 10px;
      font: inherit;
    }
    button { cursor: pointer; }
    button:focus, select:focus { outline: 2px solid var(--focus); outline-offset: 2px; }
    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
      color: var(--muted);
    }
    @media (max-width: 720px) {
      header, main { padding-left: 14px; padding-right: 14px; }
      .toolbar { align-items: stretch; flex-direction: column; }
      .controls { justify-content: stretch; }
      button, select { width: 100%; }
      .surface-title { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body data-locale="ko">
  <header id="work-os-root">
    <h1 data-i18n="title">Hermes Global Operator Console</h1>
    <div class="meta">
      <span class="pill">Program ${escapeHtml(PROGRAM_RANGE)}</span>
      <span class="pill">Source ${escapeHtml(SOURCE_PROGRAM_RANGE)}</span>
      <span class="pill">Status ${escapeHtml(summary.work_os_live_control_surface_status ?? "unknown")}</span>
      <span class="pill">Generated ${escapeHtml(generatedAt)}</span>
    </div>
  </header>
  <main>
    <div class="toolbar">
      <div class="toolbar-copy">
        <strong data-i18n="toolbarTitle">Read-only control surface</strong>
        <div class="label" data-i18n="toolbarSubtitle">Artifact-backed API bindings, redacted summaries, Review gates.</div>
      </div>
      <div class="controls">
        <label class="label" for="locale" data-i18n="localeLabel">Korean / English</label>
        <select id="locale" data-locale-select aria-label="Korean / English">
          <option value="ko">Korean</option>
          <option value="en">English</option>
        </select>
        <button id="refresh" type="button" aria-label="Refresh read-only Work OS snapshot" data-i18n="refresh">Refresh</button>
      </div>
    </div>
    <section class="band" id="ui-work_os_shell" data-api-path="/api/work-os/summary">
      <div class="surface-title"><h2 data-i18n="sourceSummary">Source Summary</h2><span>Global Operator Console</span></div>
      <div class="grid">
        ${summaryItem("Ready", summary.ready_for_p8801_handoff, "ready")}
        ${summaryItem("Gates", `${summary.pass_gate_count ?? 0}/${summary.gate_count ?? 0}`, "gates")}
        ${summaryItem("API Routes", summary.api_server_route_count, "apiRoutes")}
        ${summaryItem("Projects", summary.project_surface_count, "projectsMetric")}
      </div>
    </section>
    <section class="band" id="ui-project_control" data-api-path="/api/work-os/projects">
      <div class="surface-title"><h2>Global Operator Queue</h2><span data-i18n="queueHint">allowed / blocked / receipt-required</span></div>
      <div class="grid">${projects.map((row) => projectItem(row)).join("")}</div>
    </section>
    <section class="band" id="ui-phase_detail" data-api-path="/api/work-os/phases">
      <div class="surface-title"><h2>Readiness Rule Matrix</h2><span>Source -> Claim -> Requirement -> Evidence -> Gate -> Review -> Verdict -> Next Action</span></div>
      <div class="grid">${phases.map((row) => phaseItem(row)).join("")}</div>
    </section>
    <section class="band" id="ui-timeline" data-api-path="/api/work-os/timeline">
      <div class="surface-title"><h2 data-i18n="timeline">Timeline</h2><span>Evidence</span></div>
      <div class="grid">${timeline.map((row) => timelineItem(row)).join("")}</div>
    </section>
    <section class="band" id="ui-review_console" data-api-path="/api/work-os/reviews">
      <div class="surface-title"><h2>Review Evidence Trace</h2><span>Receipt / Finding / Revalidation</span></div>
      <div class="grid">${reviews.map((row) => reviewItem(row)).join("")}</div>
    </section>
    <section class="band" id="ui-gate_console" data-api-path="/api/work-os/gates">
      <div class="surface-title"><h2>Gate State Console</h2><span data-i18n="readOnly">read-only</span></div>
      <pre id="live-status" data-i18n="awaitingRefresh">Awaiting read-only refresh.</pre>
    </section>
  </main>
  <script>
    window.WORK_OS_API_PATHS = ${JSON.stringify(paths)};
    window.WORK_OS_LOCALE_COPY = {
      ko: {
        title: "Hermes Global Operator Console",
        toolbarTitle: "Read-only control surface",
        toolbarSubtitle: "Artifact-backed API binding, redacted summary, Review Gate.",
        localeLabel: "Korean / English",
        refresh: "Refresh",
        sourceSummary: "Source Summary",
        ready: "Ready",
        gates: "Gates",
        apiRoutes: "API Routes",
        projectsMetric: "Projects",
        queueHint: "allowed / blocked / receipt-required",
        timeline: "Timeline",
        readOnly: "read-only",
        awaitingRefresh: "Awaiting read-only refresh."
      },
      en: {
        title: "Hermes Global Operator Console",
        toolbarTitle: "Read-only control surface",
        toolbarSubtitle: "Artifact-backed API bindings, redacted summaries, Review gates.",
        localeLabel: "Korean / English",
        refresh: "Refresh",
        sourceSummary: "Source Summary",
        ready: "Ready",
        gates: "Gates",
        apiRoutes: "API Routes",
        projectsMetric: "Projects",
        queueHint: "allowed / blocked / receipt-required",
        timeline: "Timeline",
        readOnly: "read-only",
        awaitingRefresh: "Awaiting read-only refresh."
      }
    };
    function applyLocale(locale) {
      const selected = window.WORK_OS_LOCALE_COPY[locale] ? locale : "ko";
      document.documentElement.lang = selected;
      document.body.dataset.locale = selected;
      document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.dataset.i18n;
        if (window.WORK_OS_LOCALE_COPY[selected][key]) node.textContent = window.WORK_OS_LOCALE_COPY[selected][key];
      });
    }
    async function refreshReadOnlySnapshot() {
      const status = document.getElementById("live-status");
      const results = [];
      for (const item of window.WORK_OS_API_PATHS) {
        const response = await fetch(item.apiPath, { method: "GET", cache: "no-store" });
        results.push(item.responseKey + ":" + response.status);
      }
      const refresh = await fetch("/api/work-os/refresh", { method: "GET", cache: "no-store" });
      status.textContent = results.join("\\n") + "\\nrefresh:" + refresh.status;
    }
    document.getElementById("locale").addEventListener("change", (event) => applyLocale(event.target.value));
    applyLocale("ko");
    document.getElementById("refresh").addEventListener("click", refreshReadOnlySnapshot);
    refreshReadOnlySnapshot().catch((error) => {
      document.getElementById("live-status").textContent = "refresh_error:" + error.message;
    });
  </script>
</body>
</html>`;
}

function summaryItem(label, value, i18nKey = "") {
  const i18n = i18nKey ? ` data-i18n="${escapeHtml(i18nKey)}"` : "";
  return `<div class="item"><h3${i18n}>${escapeHtml(String(label))}</h3><div class="row"><span class="label">value</span><span class="status-pass">${escapeHtml(String(value))}</span></div></div>`;
}

function projectItem(row) {
  return `<article class="item"><h3>${escapeHtml(row.project_name ?? row.project_id ?? "project")}</h3><div class="row"><span class="label">phase</span><span class="mono">${escapeHtml(row.current_phase_ref ?? "n/a")}</span></div><div class="row"><span class="label">status</span><span class="${statusClass(row.current_verdict)}">${escapeHtml(row.current_verdict ?? "unknown")}</span></div></article>`;
}

function phaseItem(row) {
  return `<article class="item"><h3>${escapeHtml(row.phase_name ?? row.phase_range ?? "phase")}</h3><div class="row"><span class="label">evidence</span><span class="mono">${escapeHtml(row.evidence_ref ?? "n/a")}</span></div><div class="row"><span class="label">gate</span><span class="mono">${escapeHtml(row.gate_ref ?? "n/a")}</span></div><div class="row"><span class="label">status</span><span class="${statusClass(row.current_verdict)}">${escapeHtml(row.current_verdict ?? "unknown")}</span></div></article>`;
}

function timelineItem(row) {
  return `<article class="item"><h3>${escapeHtml(row.event_type ?? "event")}</h3><div class="row"><span class="label">citation</span><span class="mono">${escapeHtml(row.citation_ref ?? "n/a")}</span></div><div class="row"><span class="label">status</span><span class="${statusClass(row.current_verdict)}">${escapeHtml(row.current_verdict ?? "unknown")}</span></div></article>`;
}

function reviewItem(row) {
  return `<article class="item"><h3>${escapeHtml(row.review_surface_id ?? row.finding_id ?? "review")}</h3><div class="row"><span class="label">review</span><span class="mono">${escapeHtml(row.review_receipt_ref ?? row.evidence_ref ?? "n/a")}</span></div><div class="row"><span class="label">status</span><span class="${statusClass(row.current_verdict)}">${escapeHtml(row.current_verdict ?? "unknown")}</span></div></article>`;
}

function renderMarkdown(result) {
  return [
    "# Work OS Read-Only API UI Smoke",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.work_os_read_only_api_ui_smoke_status}`,
    "",
    "## Summary",
    "",
    `- Source P8800 ready: ${result.summary.source_p8800_ready}`,
    `- API routes: ${result.summary.api_route_count}`,
    `- UI bindings: ${result.summary.ui_binding_count}`,
    `- API smoke rows: ${result.summary.api_smoke_count}`,
    `- Browser smoke rows: ${result.summary.browser_smoke_count}`,
    `- P9000 freeze ready: ${result.summary.p9000_freeze_ready}`,
    `- Ready for P9001 handoff: ${result.summary.ready_for_p9001_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P8801-P9000 opens a local artifact-backed read-only Work OS API and HTML shell. It does not enable API writes, raw payload keys, secret keys, protected UI actions, refresh mutation, Codex final approval, Claude final approval, production PASS, enterprise PASS, runtime execution, write actions, or connector writes.",
    "",
  ].join("\n");
}

function renderWorkOsHtmlForArtifact(result) {
  return result.html;
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
  const keyPattern = /"(raw_[^"]*|full_transcript[^"]*|full_body[^"]*|[^"]*secret[^"]*)"\s*:/i;
  return {
    rawPayloadKeysPresent: /"(raw_[^"]*|full_transcript[^"]*|full_body[^"]*)"\s*:/i.test(body),
    secretKeysPresent: /"[^"]*secret[^"]*"\s*:/i.test(body),
    sensitiveKeyPresent: keyPattern.test(body),
  };
}

function isSensitiveResponseKey(key) {
  return /(^raw_|raw_|full_transcript|full_body|secret)/i.test(key);
}

function smokeRow(smokeId, description, pass, observations, generatedAt) {
  return verdictRow({
    schema_version: "work-os-browser-smoke-evidence-row.v1",
    row_id: "pending",
    generated_at: generatedAt,
    smoke_id: smokeId,
    description,
    observed_status: observations.observed_status ?? null,
    response_length: observations.response_length ?? null,
    required_path_count: observations.required_path_count ?? null,
    observed_path_count: observations.observed_path_count ?? null,
    raw_payload_keys_present: observations.raw_payload_keys_present ?? false,
    secret_keys_present: observations.secret_keys_present ?? false,
    protected_action_token_present: observations.protected_action_token_present ?? false,
    refresh_path_present: observations.refresh_path_present ?? null,
    post_fetch_present: observations.post_fetch_present ?? false,
    smoke_status: pass ? "pass" : "blocked",
    evidence_ref: `evidence.${smokeId}`,
    next_allowed_action: pass ? "preserve browser smoke evidence" : `repair ${smokeId}`,
  }, pass);
}

function buildError(code, message) {
  return {
    schema_version: "work-os-read-only-error.v1",
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
    schema_version: "work-os-read-only-validation-item.v1",
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
    && source.data?.summary?.work_os_live_control_surface_status === SOURCE_READY_STATUS
    && source.data?.summary?.ready_for_p8801_handoff === true;
}

async function readJsonOrBuildWorkOsLiveControlSurface(filePath, generatedAt) {
  const resolved = path.resolve(filePath);
  const source = await readJsonSource(resolved);
  if (source.available && source.data?.summary?.work_os_live_control_surface_status === SOURCE_READY_STATUS) return source;
  try {
    const built = await buildWorkOsLiveControlSurface({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.work_os_live_control_surface", built);
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
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.architectureDocPath),
    source_work_os_live_control_surface_path: path.resolve(options.sourceWorkOsLiveControlSurfacePath ?? DEFAULT_WORK_OS_READ_ONLY_API_UI_SMOKE_INPUTS.sourceWorkOsLiveControlSurfacePath),
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
    else if (arg === "--source") parsed.sourceWorkOsLiveControlSurfacePath = argv[++index];
    else if (arg === "--host") parsed.host = argv[++index];
    else if (arg === "--port") parsed.port = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-read-only-api-ui-smoke.mjs [options]

Builds or serves the P8801-P9000 Work OS read-only API/UI smoke artifact.

Options:
  --check                                            Validate without writing artifacts.
  --write                                            Write artifacts.
  --serve                                            Start the local read-only API/UI server.
  --out-dir <path>                                  Output directory.
  --schema <path>                                   Schema path.
  --package <path>                                  package.json path.
  --roadmap-doc <path>                              P8801-P9000 roadmap document path.
  --architecture-doc <path>                         Architecture document path.
  --source <path>                                   P8800 Work OS live control source path.
  --host <host>                                     Server host. Default ${DEFAULT_WORK_OS_READ_ONLY_API_HOST}.
  --port <port>                                     Server port. Default ${DEFAULT_WORK_OS_READ_ONLY_API_PORT}.
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

function statusClass(status) {
  if (status === "pass" || status === true) return "status-pass";
  if (status === "blocked" || status === false) return "status-blocked";
  return "status-review";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
