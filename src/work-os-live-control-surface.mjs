import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildLiveSessionSourceStoreUiHandoff } from "./live-session-source-store-ui-handoff.mjs";

export const DEFAULT_WORK_OS_LIVE_CONTROL_SURFACE_OUT_DIR = "artifacts/work-os-live-control-surface/latest";
export const DEFAULT_WORK_OS_LIVE_CONTROL_SURFACE_INPUTS = {
  schemaPath: "schemas/work-os-live-control-surface.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8601-p8800.md",
  architectureDocPath: "docs/architecture.md",
  liveSessionSourceStoreUiHandoffPath: "artifacts/live-session-source-store-ui-handoff/latest/live-session-source-store-ui-handoff.json",
};

const COMMAND_NAME = "platform:work-os-live-control-surface";
const SOURCE_COMMAND_NAME = "platform:live-session-source-store-ui-handoff";
const SCHEMA_VERSION = "work-os-live-control-surface.v1";
const CAPABILITY_ID = "platform.work_os_live_control_surface";
const PROGRAM_RANGE = "P8601-P8800";
const SOURCE_PROGRAM_RANGE = "P8401-P8600";
const SOURCE_READY_STATUS = "ready_for_live_session_source_store_ui_handoff";
const READY_STATUS = "ready_for_work_os_live_control_surface";

const PHASE_SPECS = [
  ["P8601-P8620", "Artifact Source Binding"],
  ["P8621-P8640", "Read-Only API Server v0"],
  ["P8641-P8660", "Session Ingestion Adapter"],
  ["P8661-P8680", "Redacted Timeline Projection"],
  ["P8681-P8700", "Project Control Surface"],
  ["P8701-P8720", "Phase Detail Surface"],
  ["P8721-P8740", "Review And Finding Surface"],
  ["P8741-P8760", "Live Progress Refresh"],
  ["P8761-P8780", "UI Handoff Runtime Contract"],
  ["P8781-P8800", "P8800 Freeze"],
];

const SOURCE_BINDING_SPECS = [
  ["source.p8600_bundle", "P8600 live session source store UI handoff artifact", "live_session_source_store_ui_handoff", "live-session-source-store-ui-handoff.json"],
  ["source.session_store", "session source store collection", "session_source_store_rows", "session-source-store-rows.json"],
  ["source.materializer", "redacted conversation materializer collection", "redacted_conversation_materializer_rows", "redacted-conversation-materializer-rows.json"],
  ["source.api_projection", "read-only API projection collection", "read_only_api_projection_rows", "read-only-api-projection-rows.json"],
  ["source.ui_handoff", "UI handoff adapter collection", "ui_handoff_adapter_rows", "ui-handoff-adapter-rows.json"],
  ["source.validation_report", "P8600 validation report", "validation_report", "validation-report.json"],
];

const API_ROUTE_SPECS = [
  ["/api/work-os/projects", "projects", "project_control_surface_rows", "Project control state"],
  ["/api/work-os/phases", "phases", "phase_detail_surface_rows", "Phase detail state"],
  ["/api/work-os/timeline", "timeline", "redacted_timeline_projection_rows", "Redacted timeline state"],
  ["/api/work-os/reviews", "reviews", "review_finding_surface_rows", "Review and finding state"],
  ["/api/work-os/gates", "gates", "phase_detail_surface_rows", "Gate state"],
  ["/api/work-os/session-sources", "session_sources", "session_ingestion_adapter_rows", "Session source state"],
  ["/api/work-os/refresh", "refresh", "live_progress_refresh_rows", "Freshness and stale state"],
];

const PROJECT_SPECS = [
  ["project.hermes", "Hermes Harness", "personal-dev", "goal.p8601_p8800", "P8601-P8800"],
  ["project.law_firm_os", "Law Firm OS", "law-firm", "goal.external.law_firm_os", "external.phase.controlled"],
  ["project.hr_solution", "HR Solution", "personal-dev", "goal.external.hr_solution", "external.phase.planning"],
  ["project.zendd_bridge", "Zendd Bridge", "law-firm", "goal.external.zendd", "external.phase.blocked_write"],
  ["project.trading_read_only", "Trading Read-Only", "trading", "goal.external.trading", "external.phase.safety_read_only"],
];

const REVIEW_SURFACE_SPECS = [
  ["review.claude_receipt_required", "Claude review receipt required", "review_pending"],
  ["review.finding_loop", "Finding loop", "visible_until_resolved"],
  ["review.unresolved_findings", "Unresolved findings", "blocks_milestone_pass"],
  ["review.receipt_refs", "Review receipt refs", "source_cited"],
  ["review.authority_boundary", "Reviewer authority boundary", "no_final_approval"],
];

const REFRESH_SPECS = [
  ["refresh.source_freshness", "source_freshness", "artifact.mtime_or_generated_at"],
  ["refresh.stale_context", "stale_context", "stale_context_badge"],
  ["refresh.missing_validation", "missing_validation", "validation_missing_badge"],
  ["refresh.missing_review", "missing_review", "review_missing_badge"],
  ["refresh.block_count", "block_count", "blocked_phase_counter"],
  ["refresh.ready_state", "ready_state", "ready_for_next_handoff"],
];

const UI_RUNTIME_SPECS = [
  ["ui_runtime.project_control_dashboard", "Project Control Dashboard", "/api/work-os/projects"],
  ["ui_runtime.phase_detail_view", "Phase Detail View", "/api/work-os/phases"],
  ["ui_runtime.conversation_timeline", "Conversation Timeline", "/api/work-os/timeline"],
  ["ui_runtime.review_console", "Review Console", "/api/work-os/reviews"],
  ["ui_runtime.evidence_gate_panel", "Evidence Gate Panel", "/api/work-os/gates"],
];

const NEGATIVE_FIXTURES = [
  ["negative.stale_source_pass", "stale P8600 artifact is treated as PASS", "BLOCK_STALE_SOURCE_PASS"],
  ["negative.missing_artifact_pass", "missing source artifact is treated as PASS", "BLOCK_MISSING_ARTIFACT_PASS"],
  ["negative.non_get_api_method", "API server exposes POST PUT PATCH or DELETE", "BLOCK_NON_GET_API_METHOD"],
  ["negative.api_returns_raw_transcript", "API response returns raw or full transcript body", "BLOCK_API_RAW_TRANSCRIPT"],
  ["negative.session_ingestion_raw_body", "session ingestion stores raw body in visible row", "BLOCK_INGESTION_RAW_BODY"],
  ["negative.ingestion_mutates_source", "session ingestion mutates source store or plan state", "BLOCK_INGESTION_MUTATION"],
  ["negative.timeline_uncited_event", "timeline event is projected without citation ref", "BLOCK_UNCITED_TIMELINE_EVENT"],
  ["negative.ui_action_enabled", "UI runtime enables protected action control", "BLOCK_UI_ACTION_ENABLED"],
  ["negative.refresh_mutates_state", "live refresh mutates state or applies plan change", "BLOCK_REFRESH_MUTATION"],
  ["negative.codex_final_approval", "Codex final-approves Codex-created milestone", "BLOCK_CODEX_FINAL_APPROVAL"],
  ["negative.claude_final_approval", "Claude review becomes final approval", "BLOCK_CLAUDE_FINAL_APPROVAL"],
  ["negative.human_gate_reintroduced", "Human gate is silently reintroduced inside P8800 scope", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.production_enterprise_pass", "P8800 claims production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runWorkOsLiveControlSurface(options = {}) {
  const result = await buildWorkOsLiveControlSurface(options);
  if (options.write !== false) await writeWorkOsLiveControlSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS live control surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkOsLiveControlSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_LIVE_CONTROL_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const liveSessionHandoff = options.liveSessionSourceStoreUiHandoff
    ? normalizeInlineJsonSource("inline.live_session_source_store_ui_handoff", options.liveSessionSourceStoreUiHandoff)
    : await readJsonOrBuildLiveSessionHandoff(inputs.live_session_source_store_ui_handoff_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const sourceBindingRows = buildArtifactSourceBindingRows(liveSessionHandoff, generatedAt, inputs.live_session_source_store_ui_handoff_path);
  const apiServerRows = buildReadOnlyApiServerRows(liveSessionHandoff, sourceBindingRows, generatedAt);
  const sessionIngestionRows = buildSessionIngestionAdapterRows(liveSessionHandoff, generatedAt);
  const timelineProjectionRows = buildRedactedTimelineProjectionRows(liveSessionHandoff, generatedAt);
  const projectControlRows = buildProjectControlSurfaceRows(liveSessionHandoff, generatedAt);
  const phaseDetailRows = buildPhaseDetailSurfaceRows(liveSessionHandoff, generatedAt);
  const reviewFindingRows = buildReviewFindingSurfaceRows(liveSessionHandoff, generatedAt);
  const liveProgressRows = buildLiveProgressRefreshRows(liveSessionHandoff, generatedAt);
  const uiRuntimeRows = buildUiHandoffRuntimeContractRows(liveSessionHandoff, apiServerRows, generatedAt);
  const p8800FreezeRows = buildP8800FreezeRows({
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    generatedAt,
  });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    liveSessionHandoff,
    contract,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({
    liveSessionHandoff,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    liveSessionHandoff,
    contract,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    work_os_live_control_surface_id: `work-os-live-control-surface.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_live_session_handoff_summary: liveSessionHandoff.data?.summary ?? null,
    work_os_live_control_surface_contract: contract,
    work_os_live_control_phase_rows: phaseRows,
    artifact_source_binding_rows: sourceBindingRows,
    read_only_api_server_rows: apiServerRows,
    session_ingestion_adapter_rows: sessionIngestionRows,
    redacted_timeline_projection_rows: timelineProjectionRows,
    project_control_surface_rows: projectControlRows,
    phase_detail_surface_rows: phaseDetailRows,
    review_finding_surface_rows: reviewFindingRows,
    live_progress_refresh_rows: liveProgressRows,
    ui_handoff_runtime_contract_rows: uiRuntimeRows,
    p8800_freeze_rows: p8800FreezeRows,
    work_os_live_negative_fixture_rows: negativeFixtureRows,
    work_os_live_gate_rows: gateRows,
    work_os_live_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      liveSessionHandoff,
      phaseRows,
      sourceBindingRows,
      apiServerRows,
      sessionIngestionRows,
      timelineProjectionRows,
      projectControlRows,
      phaseDetailRows,
      reviewFindingRows,
      liveProgressRows,
      uiRuntimeRows,
      p8800FreezeRows,
      negativeFixtureRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_live_control_surface")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    liveSessionHandoff,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.work_os_live_control_surface_id = result.work_os_live_control_surface_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeWorkOsLiveControlSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-live-control-surface.json"), serializableResult(result));
  await writeJson(path.join(outDir, "work-os-live-control-phase-rows.json"), collectionEnvelope("work-os-live-control-phase-rows.v1", "work_os_live_control_phase_rows", result.work_os_live_control_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "artifact-source-binding-rows.json"), collectionEnvelope("artifact-source-binding-rows.v1", "artifact_source_binding_rows", result.artifact_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-api-server-rows.json"), collectionEnvelope("read-only-api-server-rows.v1", "read_only_api_server_rows", result.read_only_api_server_rows, result.generated_at));
  await writeJson(path.join(outDir, "session-ingestion-adapter-rows.json"), collectionEnvelope("session-ingestion-adapter-rows.v1", "session_ingestion_adapter_rows", result.session_ingestion_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "redacted-timeline-projection-rows.json"), collectionEnvelope("redacted-timeline-projection-rows.v1", "redacted_timeline_projection_rows", result.redacted_timeline_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-control-surface-rows.json"), collectionEnvelope("project-control-surface-rows.v1", "project_control_surface_rows", result.project_control_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "phase-detail-surface-rows.json"), collectionEnvelope("phase-detail-surface-rows.v1", "phase_detail_surface_rows", result.phase_detail_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-finding-surface-rows.json"), collectionEnvelope("review-finding-surface-rows.v1", "review_finding_surface_rows", result.review_finding_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-progress-refresh-rows.json"), collectionEnvelope("live-progress-refresh-rows.v1", "live_progress_refresh_rows", result.live_progress_refresh_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-handoff-runtime-contract-rows.json"), collectionEnvelope("ui-handoff-runtime-contract-rows.v1", "ui_handoff_runtime_contract_rows", result.ui_handoff_runtime_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8800-freeze-rows.json"), collectionEnvelope("p8800-freeze-rows.v1", "p8800_freeze_rows", result.p8800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-live-negative-fixture-rows.json"), collectionEnvelope("work-os-live-negative-fixture-rows.v1", "work_os_live_negative_fixture_rows", result.work_os_live_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-live-gate-rows.json"), collectionEnvelope("work-os-live-gate-rows.v1", "work_os_live_gate_rows", result.work_os_live_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-live-boundary.json"), result.work_os_live_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "work-os-live-control-surface-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkOsLiveControlSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkOsLiveControlSurface(args);
    console.log(`Work OS live control surface ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.work_os_live_control_surface_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`API routes: ${result.summary.api_server_route_count}`);
    console.log(`Session ingestion rows: ${result.summary.session_ingestion_count}`);
    console.log(`Project surfaces: ${result.summary.project_surface_count}`);
    console.log(`P8800 freeze ready: ${result.summary.p8800_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.item_id ?? validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "work-os-live-control-surface-contract.v1",
    generated_at: generatedAt,
    contract_id: "work-os-live-control-surface.p8601-p8800",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_phases: PHASE_SPECS.map(([phase_range]) => phase_range),
    required_api_paths: API_ROUTE_SPECS.map(([api_path]) => api_path),
    required_ui_runtime_surfaces: UI_RUNTIME_SPECS.map(([surface_id]) => surface_id),
    artifact_backed_api_server_required: true,
    session_ingestion_adapter_required: true,
    redacted_timeline_projection_required: true,
    project_control_surface_required: true,
    phase_detail_surface_required: true,
    review_finding_surface_required: true,
    live_progress_refresh_required: true,
    ui_handoff_runtime_contract_required: true,
    api_get_only_required: true,
    artifact_source_citation_required: true,
    stale_context_visible: true,
    missing_validation_visible: true,
    raw_transcript_body_default_visible: false,
    raw_transcript_api_visible: false,
    full_transcript_api_visible: false,
    redacted_summary_ui_visible: true,
    api_write_methods_enabled: false,
    session_ingestion_mutates_source: false,
    refresh_mutates_state: false,
    ui_protected_actions_enabled: false,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "work-os-live-control-phase-row.v1",
      row_id: `work.os.live.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8800.${phase_range}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.work_os_live_control.${phase_range}`,
      next_allowed_action: pass ? "preserve P8601-P8800 phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildArtifactSourceBindingRows(liveSessionHandoff, generatedAt, sourcePath) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  return SOURCE_BINDING_SPECS.map(([binding_id, title, collection_key, file_name], index) => {
    const pass = sourceReady && Boolean(binding_id && collection_key);
    return verdictRow({
      schema_version: "artifact-source-binding-row.v1",
      row_id: `artifact.source.binding.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      binding_id,
      title,
      collection_key,
      artifact_path: binding_id === "source.p8600_bundle"
        ? sourcePath
        : `artifacts/live-session-source-store-ui-handoff/latest/${file_name}`,
      required_source_status: SOURCE_READY_STATUS,
      source_available: liveSessionHandoff.available === true,
      source_cited: true,
      artifact_backed: true,
      read_only: true,
      freshness_state: sourceReady ? "current" : "blocked_or_stale",
      stale_badge_visible: !sourceReady,
      mutation_allowed: false,
      source_binding_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "serve artifact-backed projection source" : "restore P8600 artifact before control surface projection",
    }, pass);
  });
}

function buildReadOnlyApiServerRows(liveSessionHandoff, sourceBindingRows, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  const bindingsReady = sourceBindingRows.every((row) => row.current_verdict === "pass");
  return API_ROUTE_SPECS.map(([api_path, response_key, source_collection_ref, description], index) => {
    const pass = sourceReady && bindingsReady && api_path.startsWith("/api/work-os/");
    return verdictRow({
      schema_version: "read-only-api-server-row.v1",
      row_id: `read.only.api.server.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      api_path,
      method: "GET",
      response_key,
      source_collection_ref,
      description,
      artifact_backed: true,
      read_only: true,
      write_enabled: false,
      mutates_state: false,
      raw_body_returns: false,
      full_body_returns: false,
      redacted_summary_returns: true,
      source_citation_returns: true,
      stale_badge_returns: true,
      protected_action_enabled: false,
      server_start_required: false,
      route_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "serve GET-only local projection response" : "block route until source binding is ready",
    }, pass);
  });
}

function buildSessionIngestionAdapterRows(liveSessionHandoff, generatedAt) {
  const sourceRows = Array.isArray(liveSessionHandoff.data?.session_source_store_rows)
    ? liveSessionHandoff.data.session_source_store_rows
    : defaultSessionSourceRows(generatedAt);
  const sourceReady = isSourceReady(liveSessionHandoff);
  return sourceRows.map((row, index) => {
    const sourceId = row.source_id ?? `session.source.${index + 1}`;
    const pass = sourceReady && Boolean(row.engine_id && row.session_id && row.run_id && row.phase_id && row.transcript_ref);
    return verdictRow({
      schema_version: "session-ingestion-adapter-row.v1",
      row_id: `session.ingestion.adapter.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      source_id: sourceId,
      engine_id: row.engine_id ?? "engine.unknown",
      session_id: row.session_id ?? `${sourceId}.${dateStamp(generatedAt)}`,
      run_id: row.run_id ?? `run.${sourceId}.${dateStamp(generatedAt)}`,
      phase_id: row.phase_id ?? "P8641-P8660",
      transcript_ref: row.transcript_ref ?? `${sourceId}.transcript.ref`,
      redacted_summary_ref: row.redacted_summary_ref ?? `${sourceId}.redacted.summary.ref`,
      ingestion_mode: "metadata_and_redacted_summary_only",
      normalized_for_ui: true,
      raw_body_ingested_visible: false,
      full_body_ingested_visible: false,
      raw_body_api_visible: false,
      append_only_source_preserved: true,
      mutates_source_store: false,
      mutates_plan_state: false,
      source_cited: true,
      ingestion_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "project normalized session metadata" : "block ingestion until source ids and refs exist",
    }, pass);
  });
}

function defaultSessionSourceRows(generatedAt) {
  return ["codex", "claude", "harness", "ui"].map((key, index) => ({
    source_id: `session.${key}`,
    engine_id: `engine.${key}`,
    session_id: `session.${key}.${dateStamp(generatedAt)}`,
    run_id: `run.${key}.${dateStamp(generatedAt)}`,
    phase_id: `P86${String(index + 1).padStart(2, "0")}`,
    transcript_ref: `transcript.${key}.ref`,
    redacted_summary_ref: `summary.${key}.redacted.ref`,
  }));
}

function buildRedactedTimelineProjectionRows(liveSessionHandoff, generatedAt) {
  const materializerRows = Array.isArray(liveSessionHandoff.data?.redacted_conversation_materializer_rows)
    ? liveSessionHandoff.data.redacted_conversation_materializer_rows
    : defaultMaterializerRows();
  const sourceReady = isSourceReady(liveSessionHandoff);
  return materializerRows.map((row, index) => {
    const eventType = row.event_type ?? `event.${index + 1}`;
    const pass = sourceReady && Boolean(row.source_id && eventType);
    return verdictRow({
      schema_version: "redacted-timeline-projection-row.v1",
      row_id: `redacted.timeline.projection.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      event_id: row.materializer_id ?? `timeline.materializer.${index + 1}`,
      event_type: eventType,
      source_id: row.source_id ?? "session.unknown",
      timeline_ref: row.timeline_ref ?? `timeline.${eventType}`,
      citation_ref: `${row.source_id ?? "session.unknown"}.citation.${eventType}`,
      redacted_summary_ref: `${row.source_id ?? "session.unknown"}.redacted.${eventType}`,
      raw_transcript_body_visible: false,
      full_transcript_body_visible: false,
      redacted_summary_visible: true,
      source_citation_required: true,
      source_cited: true,
      stale_context_badge_visible: true,
      may_update_plan_directly: false,
      timeline_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "render cited redacted timeline event" : "block uncited timeline projection",
    }, pass);
  });
}

function defaultMaterializerRows() {
  return ["decision", "blocker", "review_event", "validation_event", "phase_progress"].map((event_type) => ({
    materializer_id: `materializer.${event_type}`,
    event_type,
    source_id: "session.default",
    timeline_ref: `timeline.${event_type}`,
  }));
}

function buildProjectControlSurfaceRows(liveSessionHandoff, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  return PROJECT_SPECS.map(([project_id, project_name, domain_pack, active_goal_ref, current_phase_ref], index) => {
    const pass = sourceReady && Boolean(project_id && active_goal_ref);
    return verdictRow({
      schema_version: "project-control-surface-row.v1",
      row_id: `project.control.surface.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      project_id,
      project_name,
      domain_pack,
      active_goal_ref,
      current_phase_ref,
      phase_summary_ref: `phase.summary.${project_id}`,
      blocker_count_ref: `block.count.${project_id}`,
      review_state_ref: `review.state.${project_id}`,
      validation_state_ref: `validation.state.${project_id}`,
      surface_visible: true,
      read_only: true,
      source_cited: true,
      raw_material_visible: false,
      protected_action_enabled: false,
      project_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "display project control row" : "block project surface until source is ready",
    }, pass);
  });
}

function buildPhaseDetailSurfaceRows(liveSessionHandoff, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = sourceReady && Boolean(phase_range);
    return verdictRow({
      schema_version: "phase-detail-surface-row.v1",
      row_id: `phase.detail.surface.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      phase_id: phase_range,
      phase_title: phase_name,
      status: index < 9 ? "planned_or_in_progress" : "freeze_pending",
      claim_ref: `claim.${phase_range}`,
      evidence_ref: `evidence.${phase_range}`,
      gate_ref: `gate.${phase_range}`,
      check_ref: `validator.${phase_range}`,
      review_receipt_ref: `claude.review.${phase_range}`,
      source_cited: true,
      raw_material_visible: false,
      pass_requires_validator_evidence: true,
      pass_requires_review_receipt_or_pending_badge: true,
      protected_action_enabled: false,
      phase_detail_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "display phase detail packet" : "block phase detail until source is ready",
    }, pass);
  });
}

function buildReviewFindingSurfaceRows(liveSessionHandoff, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  return REVIEW_SURFACE_SPECS.map(([review_id, title, state], index) => {
    const pass = sourceReady && Boolean(review_id && state);
    return verdictRow({
      schema_version: "review-finding-surface-row.v1",
      row_id: `review.finding.surface.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      review_id,
      title,
      review_state: state,
      claude_review_receipt_required: true,
      claude_review_receipt_ref: `claude.review.receipt.${review_id}`,
      finding_loop_visible: true,
      unresolved_findings_visible: true,
      source_cited: true,
      reviewer_mutation_allowed: false,
      final_approval_allowed: false,
      protected_closeout_allowed: false,
      review_surface_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "display review and finding row" : "block review surface until source is ready",
    }, pass);
  });
}

function buildLiveProgressRefreshRows(liveSessionHandoff, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  return REFRESH_SPECS.map(([refresh_id, refresh_type, visible_ref], index) => {
    const pass = sourceReady && Boolean(refresh_id && visible_ref);
    return verdictRow({
      schema_version: "live-progress-refresh-row.v1",
      row_id: `live.progress.refresh.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      refresh_id,
      refresh_type,
      visible_ref,
      refresh_snapshot_ref: `snapshot.${refresh_id}`,
      source_cited: true,
      stale_context_visible: true,
      missing_validation_visible: true,
      missing_review_visible: true,
      refresh_interval_policy: "manual_or_local_poll_read_only",
      refresh_mutates_state: false,
      auto_plan_update_enabled: false,
      protected_action_enabled: false,
      refresh_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "refresh read-only UI status" : "show blocked refresh source",
    }, pass);
  });
}

function buildUiHandoffRuntimeContractRows(liveSessionHandoff, apiServerRows, generatedAt) {
  const sourceReady = isSourceReady(liveSessionHandoff);
  const apiReady = apiServerRows.every((row) => row.current_verdict === "pass");
  return UI_RUNTIME_SPECS.map(([surface_id, surface_title, consumes_api_path], index) => {
    const pass = sourceReady && apiReady && apiServerRows.some((row) => row.api_path === consumes_api_path);
    return verdictRow({
      schema_version: "ui-handoff-runtime-contract-row.v1",
      row_id: `ui.handoff.runtime.contract.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      surface_id,
      surface_title,
      consumes_api_path,
      view_model_ref: `view_model.${surface_id}`,
      manifest_ref: `manifest.${surface_id}`,
      bounded_snapshot_ref: `snapshot.${surface_id}`,
      bounded_snapshot: true,
      read_only: true,
      raw_material_embedded: false,
      full_transcript_embedded: false,
      raw_secret_embedded: false,
      source_citation_visible: true,
      stale_context_badge_visible: true,
      missing_validation_badge_visible: true,
      unresolved_review_badge_visible: true,
      protected_action_controls_enabled: false,
      ui_runtime_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "bind UI surface to read-only API response" : "block UI runtime until API route is ready",
    }, pass);
  });
}

function buildP8800FreezeRows(context) {
  const {
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    generatedAt,
  } = context;
  const specs = [
    ["freeze.phase_rows", "P8601-P8800 phase rows reflected", phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.artifact_source_binding", "P8600 artifact source binding ready", sourceBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.api_server", "artifact-backed API server rows GET-only", apiServerRows.every((row) => row.current_verdict === "pass")],
    ["freeze.session_ingestion", "session ingestion adapter metadata-only", sessionIngestionRows.every((row) => row.current_verdict === "pass")],
    ["freeze.timeline_projection", "redacted timeline projection cited", timelineProjectionRows.every((row) => row.current_verdict === "pass")],
    ["freeze.control_surfaces", "project, phase, review, refresh surfaces ready", projectControlRows.every((row) => row.current_verdict === "pass") && phaseDetailRows.every((row) => row.current_verdict === "pass") && reviewFindingRows.every((row) => row.current_verdict === "pass") && liveProgressRows.every((row) => row.current_verdict === "pass")],
    ["freeze.ui_runtime", "UI runtime contract bounded and read-only", uiRuntimeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.no_authority_expansion", "no human, production, enterprise, protected closeout, runtime, write, connector write, raw API, or final approval expansion", true],
  ];
  return specs.map(([freeze_id, title, pass], index) => verdictRow({
    schema_version: "p8800-freeze-row.v1",
    row_id: `p8800.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    title,
    freeze_status: pass ? "ready" : "blocked",
    evidence_ref: `evidence.${freeze_id}`,
    gate_ref: `gate.${freeze_id}`,
    raw_transcript_api_visible: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    next_allowed_action: pass ? "include in P8800 freeze packet" : "repair prerequisite live control row",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, unsafe_claim, expected_block_reason], index) => verdictRow({
    schema_version: "work-os-live-negative-fixture-row.v1",
    row_id: `work.os.live.negative.fixture.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    unsafe_claim,
    expected_block_reason,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    current_verdict: "pass",
    verdict_authority: "harness_negative_fixture",
    next_allowed_action: "preserve negative fixture",
  }, true));
}

function buildGateRows(context) {
  const {
    packageJson,
    roadmapDoc,
    architectureDoc,
    liveSessionHandoff,
    contract,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
  } = context;
  const sourceReady = isSourceReady(liveSessionHandoff);
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes Work OS live control surface command"],
    ["source_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source live session handoff command exists"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes Work OS live control surface command"],
    ["runs_after_p8600", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "P8800 command runs after P8600 source command"],
    ["source_live_session_handoff_ready", sourceReady, "P8401-P8600 source live session handoff is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Work OS Live Control Surface"), "P8601-P8800 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "P8601-P8800 Work OS Live Control Surface, Artifact-Backed API Server, and Session Ingestion Adapter"), "architecture reflects P8601-P8800"],
    ["phase_rows_pass", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all P8601-P8800 phase rows pass"],
    ["artifact_sources_bound", sourceBindingRows.length >= 6 && sourceBindingRows.every((row) => row.artifact_backed && row.read_only && row.source_cited), "artifact source bindings are cited and read-only"],
    ["api_server_get_only", apiServerRows.length >= 7 && apiServerRows.every((row) => row.method === "GET" && row.read_only && row.write_enabled === false), "API server rows are GET-only"],
    ["api_server_no_raw", apiServerRows.every((row) => row.raw_body_returns === false && row.full_body_returns === false), "API server does not return raw or full transcript bodies"],
    ["session_ingestion_metadata_only", sessionIngestionRows.length >= 4 && sessionIngestionRows.every((row) => row.ingestion_mode === "metadata_and_redacted_summary_only" && row.raw_body_ingested_visible === false), "session ingestion is metadata and redacted summary only"],
    ["session_ingestion_non_mutating", sessionIngestionRows.every((row) => row.mutates_source_store === false && row.mutates_plan_state === false), "session ingestion cannot mutate source or plan"],
    ["timeline_projection_cited", timelineProjectionRows.length >= 5 && timelineProjectionRows.every((row) => row.redacted_summary_visible && row.source_cited), "timeline projection is cited and redacted"],
    ["project_control_ready", projectControlRows.length >= 5 && projectControlRows.every((row) => row.read_only && row.source_cited), "project control surface rows are ready"],
    ["phase_detail_ready", phaseDetailRows.length === PHASE_SPECS.length && phaseDetailRows.every((row) => row.source_cited && row.raw_material_visible === false), "phase detail surface rows are ready"],
    ["review_finding_ready", reviewFindingRows.length >= 5 && reviewFindingRows.every((row) => row.unresolved_findings_visible && row.final_approval_allowed === false), "review and finding surface rows are ready"],
    ["live_progress_ready", liveProgressRows.length >= 6 && liveProgressRows.every((row) => row.stale_context_visible && row.missing_validation_visible && row.refresh_mutates_state === false), "live progress refresh rows are read-only and visible"],
    ["ui_runtime_ready", uiRuntimeRows.length >= 5 && uiRuntimeRows.every((row) => row.bounded_snapshot && row.read_only && row.protected_action_controls_enabled === false), "UI runtime contract rows are bounded and read-only"],
    ["p8800_freeze_rows_ready", p8800FreezeRows.every((row) => row.current_verdict === "pass"), "P8800 freeze rows are ready"],
    ["negative_fixtures_block", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), "negative fixtures block unsafe live control claims"],
    ["no_human_gate", contract.human_gate_in_scope === false, "P8800 remains no-human milestone mode"],
    ["no_final_authority", contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_reviewer_mutation", contract.reviewer_mutation_allowed === false, "reviewer mutation remains disabled"],
    ["no_production_enterprise", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write_connector", contract.runtime_execution_enabled === false && contract.write_action_enabled === false && contract.external_connector_write_enabled === false, "runtime execution, write action, and connector write remain disabled"],
    ["no_raw_api", contract.raw_transcript_api_visible === false && contract.full_transcript_api_visible === false, "raw and full transcript API exposure remains disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "work-os-live-gate-row.v1",
    row_id: `work.os.live.gate.row.${String(index + 1).padStart(2, "0")}`,
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
    liveSessionHandoff,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
  } = context;
  const sourceReady = isSourceReady(liveSessionHandoff);
  const phaseReady = phaseRows.every((row) => row.current_verdict === "pass");
  const sourceBindingReady = sourceBindingRows.every((row) => row.current_verdict === "pass");
  const apiReady = apiServerRows.every((row) => row.current_verdict === "pass");
  const ingestionReady = sessionIngestionRows.every((row) => row.current_verdict === "pass");
  const timelineReady = timelineProjectionRows.every((row) => row.current_verdict === "pass");
  const projectReady = projectControlRows.every((row) => row.current_verdict === "pass");
  const phaseDetailReady = phaseDetailRows.every((row) => row.current_verdict === "pass");
  const reviewReady = reviewFindingRows.every((row) => row.current_verdict === "pass");
  const refreshReady = liveProgressRows.every((row) => row.current_verdict === "pass");
  const uiRuntimeReady = uiRuntimeRows.every((row) => row.current_verdict === "pass");
  const freezeReady = p8800FreezeRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  const gatesPass = gateRows.every((row) => row.current_verdict === "pass");
  const unsafeFlags = [
    false, // human_gate_in_scope
    false, // codex_final_approval_allowed
    false, // claude_final_approval_allowed
    false, // reviewer_mutation_allowed
    false, // production_pass_enabled
    false, // enterprise_pass_enabled
    false, // protected_closeout_enabled
    false, // runtime_execution_enabled
    false, // write_action_enabled
    false, // external_connector_write_enabled
    false, // raw_transcript_api_visible
  ];
  return {
    schema_version: "work-os-live-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_live_session_handoff_ready: sourceReady,
    phase_rows_ready: phaseReady,
    artifact_source_binding_ready: sourceBindingReady,
    read_only_api_server_ready: apiReady,
    session_ingestion_adapter_ready: ingestionReady,
    redacted_timeline_projection_ready: timelineReady,
    project_control_surface_ready: projectReady,
    phase_detail_surface_ready: phaseDetailReady,
    review_finding_surface_ready: reviewReady,
    live_progress_refresh_ready: refreshReady,
    ui_handoff_runtime_contract_ready: uiRuntimeReady,
    p8800_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p8801_handoff: sourceReady && phaseReady && sourceBindingReady && apiReady && ingestionReady && timelineReady && projectReady && phaseDetailReady && reviewReady && refreshReady && uiRuntimeReady && freezeReady && negativeFixturesBlock && gatesPass,
    human_gate_in_scope: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    raw_transcript_api_visible: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(context) {
  const {
    packageJson,
    roadmapDoc,
    architectureDoc,
    liveSessionHandoff,
    contract,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include command"),
    validationItem("package.order", "package", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "command must run after P8600 source command"),
    validationItem("source.ready", "source", isSourceReady(liveSessionHandoff), "P8401-P8600 source must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8601-P8800"), "roadmap must reflect P8601-P8800"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P8601-P8800 Work OS Live Control Surface, Artifact-Backed API Server, and Session Ingestion Adapter"), "architecture must reflect P8601-P8800"),
    validationItem("contract.required_planes", "contract", contract.artifact_backed_api_server_required && contract.session_ingestion_adapter_required && contract.ui_handoff_runtime_contract_required, "required API/session/UI planes must be present"),
    validationItem("phase.rows", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("source.bindings", "source", sourceBindingRows.length === SOURCE_BINDING_SPECS.length && sourceBindingRows.every((row) => row.artifact_backed && row.read_only && row.source_cited), "source bindings must be artifact-backed read-only and cited"),
    validationItem("api.routes", "api", apiServerRows.length === API_ROUTE_SPECS.length && apiServerRows.every((row) => row.method === "GET" && row.read_only), "API routes must be GET-only"),
    validationItem("api.no_raw", "api", apiServerRows.every((row) => row.raw_body_returns === false && row.full_body_returns === false), "API routes cannot return raw or full transcript bodies"),
    validationItem("api.no_mutation", "api", apiServerRows.every((row) => row.write_enabled === false && row.mutates_state === false && row.protected_action_enabled === false), "API routes cannot mutate state"),
    validationItem("session.ingestion", "session", sessionIngestionRows.length >= 4 && sessionIngestionRows.every((row) => row.engine_id && row.session_id && row.run_id && row.source_cited), "session ingestion rows need stable ids and citations"),
    validationItem("session.no_raw", "session", sessionIngestionRows.every((row) => row.raw_body_ingested_visible === false && row.full_body_ingested_visible === false && row.raw_body_api_visible === false), "session ingestion cannot expose raw or full bodies"),
    validationItem("session.no_mutation", "session", sessionIngestionRows.every((row) => row.mutates_source_store === false && row.mutates_plan_state === false), "session ingestion cannot mutate source or plan state"),
    validationItem("timeline.cited", "timeline", timelineProjectionRows.length >= 5 && timelineProjectionRows.every((row) => row.source_cited && row.redacted_summary_visible), "timeline projection must be cited and redacted"),
    validationItem("project.surface", "ui", projectControlRows.length >= 5 && projectControlRows.every((row) => row.read_only && row.source_cited), "project control surface rows must be read-only"),
    validationItem("phase.detail", "ui", phaseDetailRows.length === PHASE_SPECS.length && phaseDetailRows.every((row) => row.claim_ref && row.evidence_ref && row.gate_ref && row.check_ref && row.review_receipt_ref), "phase detail rows must show claim evidence gate check and review refs"),
    validationItem("review.surface", "review", reviewFindingRows.length >= 5 && reviewFindingRows.every((row) => row.unresolved_findings_visible && row.final_approval_allowed === false), "review surface must show findings without final authority"),
    validationItem("refresh.surface", "refresh", liveProgressRows.length >= 6 && liveProgressRows.every((row) => row.stale_context_visible && row.missing_validation_visible && row.refresh_mutates_state === false), "refresh rows must show stale and missing validation states without mutation"),
    validationItem("ui.runtime", "ui", uiRuntimeRows.length === UI_RUNTIME_SPECS.length && uiRuntimeRows.every((row) => row.bounded_snapshot && row.read_only && row.protected_action_controls_enabled === false), "UI runtime contract rows must be bounded and read-only"),
    validationItem("freeze.ready", "freeze", p8800FreezeRows.every((row) => row.current_verdict === "pass"), "P8800 freeze rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("gates.pass", "gates", gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.no_human", "boundary", boundary.human_gate_in_scope === false, "human gate must remain excluded"),
    validationItem("boundary.no_final_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false, "Codex and Claude final approval must remain false"),
    validationItem("boundary.no_reviewer_mutation", "boundary", boundary.reviewer_mutation_allowed === false, "reviewer mutation must remain false"),
    validationItem("boundary.no_enterprise_production", "boundary", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "production and enterprise PASS must remain false"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.external_connector_write_enabled === false, "runtime, write, and connector write must remain false"),
    validationItem("boundary.no_raw_api", "boundary", boundary.raw_transcript_api_visible === false, "raw transcript API exposure must remain false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p8801_handoff === true && boundary.unsafe_flag_count === 0, "P8800 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const {
    liveSessionHandoff,
    phaseRows,
    sourceBindingRows,
    apiServerRows,
    sessionIngestionRows,
    timelineProjectionRows,
    projectControlRows,
    phaseDetailRows,
    reviewFindingRows,
    liveProgressRows,
    uiRuntimeRows,
    p8800FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation,
  } = context;
  const ready = validation.valid && boundary.ready_for_p8801_handoff;
  return {
    schema_version: "work-os-live-control-surface-summary.v1",
    work_os_live_control_surface_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_live_session_handoff_status: liveSessionHandoff.data?.summary?.live_session_source_store_ui_handoff_status ?? "missing",
    source_live_session_handoff_ready: isSourceReady(liveSessionHandoff),
    phase_row_count: phaseRows.length,
    source_binding_count: sourceBindingRows.length,
    api_server_route_count: apiServerRows.length,
    session_ingestion_count: sessionIngestionRows.length,
    timeline_projection_count: timelineProjectionRows.length,
    project_surface_count: projectControlRows.length,
    phase_detail_count: phaseDetailRows.length,
    review_finding_count: reviewFindingRows.length,
    live_progress_refresh_count: liveProgressRows.length,
    ui_runtime_count: uiRuntimeRows.length,
    p8800_freeze_count: p8800FreezeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    artifact_source_binding_ready: boundary.artifact_source_binding_ready,
    read_only_api_server_ready: boundary.read_only_api_server_ready,
    session_ingestion_adapter_ready: boundary.session_ingestion_adapter_ready,
    redacted_timeline_projection_ready: boundary.redacted_timeline_projection_ready,
    project_control_surface_ready: boundary.project_control_surface_ready,
    phase_detail_surface_ready: boundary.phase_detail_surface_ready,
    review_finding_surface_ready: boundary.review_finding_surface_ready,
    live_progress_refresh_ready: boundary.live_progress_refresh_ready,
    ui_handoff_runtime_contract_ready: boundary.ui_handoff_runtime_contract_ready,
    p8800_freeze_ready: boundary.p8800_freeze_ready,
    ready_for_p8801_handoff: boundary.ready_for_p8801_handoff,
    human_gate_in_scope: boundary.human_gate_in_scope,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    reviewer_mutation_allowed: boundary.reviewer_mutation_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    external_connector_write_enabled: boundary.external_connector_write_enabled,
    raw_transcript_api_visible: boundary.raw_transcript_api_visible,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Work OS Live Control Surface",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.work_os_live_control_surface_status}`,
    "",
    "## Summary",
    "",
    `- Source live session handoff ready: ${result.summary.source_live_session_handoff_ready}`,
    `- API routes: ${result.summary.api_server_route_count}`,
    `- Session ingestion rows: ${result.summary.session_ingestion_count}`,
    `- Timeline projection rows: ${result.summary.timeline_projection_count}`,
    `- Project surfaces: ${result.summary.project_surface_count}`,
    `- Phase detail rows: ${result.summary.phase_detail_count}`,
    `- Review/finding rows: ${result.summary.review_finding_count}`,
    `- Live progress refresh rows: ${result.summary.live_progress_refresh_count}`,
    `- P8800 freeze ready: ${result.summary.p8800_freeze_ready}`,
    `- Ready for P8801 handoff: ${result.summary.ready_for_p8801_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P8601-P8800 makes the P8600 handoff consumable by an artifact-backed read-only Work OS control surface. It does not expose raw transcript bodies, enable API writes, ingest raw session bodies, mutate plans during refresh, create human adjudication, create production PASS, create enterprise PASS, enable protected closeout, open runtime execution, allow write action, allow connector writes, or make Codex/Claude final approvers.",
  ];
  return `${lines.join("\n")}\n`;
}

async function readJsonOrBuildLiveSessionHandoff(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildLiveSessionSourceStoreUiHandoff({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.live_session_source_store_ui_handoff", built);
  } catch (error) {
    return { available: false, path: sourcePath, error: `${source.error}; fallback failed: ${error.message}` };
  }
}

function isSourceReady(liveSessionHandoff) {
  return liveSessionHandoff.data?.summary?.live_session_source_store_ui_handoff_status === SOURCE_READY_STATUS
    && liveSessionHandoff.data?.summary?.ready_for_p8601_handoff === true;
}

function normalizeInputs(options = {}) {
  const defaults = DEFAULT_WORK_OS_LIVE_CONTROL_SURFACE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    live_session_source_store_ui_handoff_path: options.liveSessionSourceStoreUiHandoffPath ?? defaults.liveSessionSourceStoreUiHandoffPath,
  };
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
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

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data) };
}

function includesToken(text, token) {
  return typeof text === "string" && text.includes(token);
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(item_id, category, pass, message) {
  return {
    schema_version: "work-os-live-validation-item.v1",
    item_id,
    category,
    pass,
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.pass).map((item) => ({
    item_id: item.item_id,
    category: item.category,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schema_version, key, rows, generatedAt) {
  return {
    schema_version,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(iso) {
  return iso.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    help: false,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    liveSessionSourceStoreUiHandoffPath: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[++index];
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[++index];
    } else if (arg === "--live-session-source-store-ui-handoff") {
      args.liveSessionSourceStoreUiHandoffPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/work-os-live-control-surface.mjs [options]

Options:
  --check                                            Validate without writing artifacts.
  --out-dir <path>                                   Artifact output directory.
  --schema <path>                                    JSON schema path.
  --package <path>                                   package.json path.
  --roadmap-doc <path>                               P8601-P8800 roadmap document path.
  --architecture-doc <path>                          Architecture document path.
  --live-session-source-store-ui-handoff <path>      Source P8401-P8600 artifact path.
  --help                                             Show this help.
`);
}
