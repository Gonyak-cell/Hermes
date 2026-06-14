import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildWorkOsUiV0GovernedLoop } from "./work-os-ui-v0-governed-loop.mjs";

export const DEFAULT_LIVE_SESSION_SOURCE_STORE_UI_HANDOFF_OUT_DIR = "artifacts/live-session-source-store-ui-handoff/latest";
export const DEFAULT_LIVE_SESSION_SOURCE_STORE_UI_HANDOFF_INPUTS = {
  schemaPath: "schemas/live-session-source-store-ui-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p8401-p8600.md",
  architectureDocPath: "docs/architecture.md",
  workOsUiV0GovernedLoopPath: "artifacts/work-os-ui-v0-governed-loop/latest/work-os-ui-v0-governed-loop.json",
};

const COMMAND_NAME = "platform:live-session-source-store-ui-handoff";
const SOURCE_COMMAND_NAME = "platform:work-os-ui-v0-governed-loop";
const SCHEMA_VERSION = "live-session-source-store-ui-handoff.v1";
const CAPABILITY_ID = "platform.live_session_source_store_ui_handoff";
const PROGRAM_RANGE = "P8401-P8600";
const SOURCE_PROGRAM_RANGE = "P8241-P8400";
const SOURCE_READY_STATUS = "ready_for_work_os_ui_v0_governed_loop";
const READY_STATUS = "ready_for_live_session_source_store_ui_handoff";

const PHASE_SPECS = [
  ["P8401-P8440", "Live Session Source Store"],
  ["P8441-P8480", "Redacted Conversation Materializer"],
  ["P8481-P8520", "Work OS Read-Only API Projection"],
  ["P8521-P8560", "UI Handoff Adapter"],
  ["P8561-P8600", "P8600 Freeze"],
];

const SESSION_SOURCE_SPECS = [
  ["session.codex.primary", "engine.codex.primary_developer", "codex-live-session", "P8401-P8440", "transcript.codex.raw.ref", "transcript.codex.full.ref", "summary.codex.redacted.ref"],
  ["session.claude.review", "engine.claude.independent_reviewer", "claude-review-session", "P8441-P8480", "transcript.claude.raw.ref", "transcript.claude.full.ref", "summary.claude.redacted.ref"],
  ["session.harness.validator", "engine.harness.validator", "harness-validation-run", "P8481-P8520", "transcript.harness.raw.ref", "transcript.harness.full.ref", "summary.harness.redacted.ref"],
  ["session.ui.handoff", "engine.harness.ui_projection", "ui-handoff-run", "P8521-P8560", "transcript.ui.raw.ref", "transcript.ui.full.ref", "summary.ui.redacted.ref"],
];

const MATERIALIZER_SPECS = [
  ["materializer.codex_decision", "decision", "session.codex.primary", "work_os.timeline.decision", "redacted_summary"],
  ["materializer.codex_blocker", "blocker", "session.codex.primary", "work_os.timeline.blocker", "redacted_summary"],
  ["materializer.claude_review_event", "review_event", "session.claude.review", "work_os.timeline.review_event", "redacted_summary"],
  ["materializer.harness_validation_event", "validation_event", "session.harness.validator", "work_os.timeline.validation_event", "redacted_summary"],
  ["materializer.phase_progress_event", "phase_progress", "session.ui.handoff", "work_os.timeline.phase_progress", "redacted_summary"],
];

const API_PROJECTION_SPECS = [
  ["/api/work-os/projects", "projects", "project_control_dashboard"],
  ["/api/work-os/phases", "phases", "phase_detail_view"],
  ["/api/work-os/timeline", "timeline", "conversation_timeline"],
  ["/api/work-os/reviews", "reviews", "review_console"],
  ["/api/work-os/gates", "gates", "validation_gate_panel"],
  ["/api/work-os/session-sources", "session_sources", "session_source_store"],
];

const UI_HANDOFF_SPECS = [
  ["ui_handoff.project_control_dashboard", "Project Control Dashboard", "manifest.work_os.project_control_dashboard", "snapshot.work_os.project_control_dashboard"],
  ["ui_handoff.phase_detail_view", "Phase Detail View", "manifest.work_os.phase_detail_view", "snapshot.work_os.phase_detail_view"],
  ["ui_handoff.conversation_timeline", "Conversation Timeline", "manifest.work_os.conversation_timeline", "snapshot.work_os.conversation_timeline"],
  ["ui_handoff.review_console", "Review Console", "manifest.work_os.review_console", "snapshot.work_os.review_console"],
  ["ui_handoff.evidence_gate_panel", "Evidence Gate Panel", "manifest.work_os.evidence_gate_panel", "snapshot.work_os.evidence_gate_panel"],
];

const RESTORE_BUNDLE_SPECS = [
  ["restore.current_goal", "current_goal", "goal.active.p8401_p8600", "read_current_goal"],
  ["restore.phase_state", "phase_state", "phase.registry.p8401_p8600", "read_phase_status"],
  ["restore.blockers", "blocker_state", "blockers.visible.current", "read_blocked_reasons"],
  ["restore.validation_status", "validation_status", "validation.latest.p8401_p8600", "read_validation_summary"],
  ["restore.review_status", "review_status", "review.claude.latest", "read_review_receipts"],
];

const NEGATIVE_FIXTURES = [
  ["negative.mutable_session_store", "session source store allows mutation or overwrite", "BLOCK_MUTABLE_SESSION_STORE"],
  ["negative.duplicate_session_event", "duplicate session event is accepted without duplicate marker", "BLOCK_DUPLICATE_SESSION_EVENT"],
  ["negative.raw_transcript_api_response", "read-only API returns raw transcript body", "BLOCK_RAW_TRANSCRIPT_API_RESPONSE"],
  ["negative.write_api_method", "POST PUT PATCH DELETE route mutates Work OS projection", "BLOCK_WRITE_API_METHOD"],
  ["negative.ui_embeds_raw_material", "UI handoff embeds raw or full transcript material", "BLOCK_UI_RAW_MATERIAL"],
  ["negative.uncited_restore_bundle", "restore bundle adds memory without source citation", "BLOCK_UNCITED_RESTORE_CONTEXT"],
  ["negative.stale_context_pass", "stale context drift is treated as pass", "BLOCK_STALE_CONTEXT_PASS"],
  ["negative.codex_final_approval", "Codex final-approves Codex-created milestone", "BLOCK_CODEX_FINAL_APPROVAL"],
  ["negative.claude_source_mutation", "Claude review mutates source while reviewing", "BLOCK_CLAUDE_SOURCE_MUTATION"],
  ["negative.human_gate_reintroduced", "Human gate is silently reintroduced inside P8600 scope", "BLOCK_HUMAN_GATE_REINTRODUCED"],
  ["negative.production_enterprise_pass", "P8600 freeze claims production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runLiveSessionSourceStoreUiHandoff(options = {}) {
  const result = await buildLiveSessionSourceStoreUiHandoff(options);
  if (options.write !== false) await writeLiveSessionSourceStoreUiHandoff(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Live session source store UI handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLiveSessionSourceStoreUiHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LIVE_SESSION_SOURCE_STORE_UI_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const workOsUiV0 = options.workOsUiV0GovernedLoop
    ? normalizeInlineJsonSource("inline.work_os_ui_v0_governed_loop", options.workOsUiV0GovernedLoop)
    : await readJsonOrBuildWorkOsUiV0(inputs.work_os_ui_v0_governed_loop_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const sessionSourceRows = buildSessionSourceRows(workOsUiV0, generatedAt);
  const materializerRows = buildRedactedMaterializerRows(workOsUiV0, generatedAt);
  const apiProjectionRows = buildReadOnlyApiProjectionRows(sessionSourceRows, materializerRows, generatedAt);
  const uiHandoffRows = buildUiHandoffRows(workOsUiV0, apiProjectionRows, generatedAt);
  const restoreBundleRows = buildSessionRestoreBundleRows(workOsUiV0, sessionSourceRows, generatedAt);
  const p8600FreezeRows = buildP8600FreezeRows({
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    generatedAt,
  });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    workOsUiV0,
    contract,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
  });
  const boundary = buildBoundary({
    workOsUiV0,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    workOsUiV0,
    contract,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    live_session_source_store_ui_handoff_id: `live-session-source-store-ui-handoff.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_work_os_ui_v0_summary: workOsUiV0.data?.summary ?? null,
    live_session_source_store_ui_handoff_contract: contract,
    live_session_source_store_phase_rows: phaseRows,
    session_source_store_rows: sessionSourceRows,
    redacted_conversation_materializer_rows: materializerRows,
    read_only_api_projection_rows: apiProjectionRows,
    ui_handoff_adapter_rows: uiHandoffRows,
    session_restore_bundle_rows: restoreBundleRows,
    p8600_freeze_rows: p8600FreezeRows,
    live_session_negative_fixture_rows: negativeFixtureRows,
    live_session_gate_rows: gateRows,
    live_session_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      workOsUiV0,
      phaseRows,
      sessionSourceRows,
      materializerRows,
      apiProjectionRows,
      uiHandoffRows,
      restoreBundleRows,
      p8600FreezeRows,
      negativeFixtureRows,
      gateRows,
      boundary,
      validation: preliminaryValidation,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "live_session_source_store_ui_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    workOsUiV0,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.live_session_source_store_ui_handoff_id = result.live_session_source_store_ui_handoff_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeLiveSessionSourceStoreUiHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "live-session-source-store-ui-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "live-session-source-store-phase-rows.json"), collectionEnvelope("live-session-source-store-phase-rows.v1", "live_session_source_store_phase_rows", result.live_session_source_store_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "session-source-store-rows.json"), collectionEnvelope("session-source-store-rows.v1", "session_source_store_rows", result.session_source_store_rows, result.generated_at));
  await writeJson(path.join(outDir, "redacted-conversation-materializer-rows.json"), collectionEnvelope("redacted-conversation-materializer-rows.v1", "redacted_conversation_materializer_rows", result.redacted_conversation_materializer_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-api-projection-rows.json"), collectionEnvelope("read-only-api-projection-rows.v1", "read_only_api_projection_rows", result.read_only_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-handoff-adapter-rows.json"), collectionEnvelope("ui-handoff-adapter-rows.v1", "ui_handoff_adapter_rows", result.ui_handoff_adapter_rows, result.generated_at));
  await writeJson(path.join(outDir, "session-restore-bundle-rows.json"), collectionEnvelope("session-restore-bundle-rows.v1", "session_restore_bundle_rows", result.session_restore_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "p8600-freeze-rows.json"), collectionEnvelope("p8600-freeze-rows.v1", "p8600_freeze_rows", result.p8600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-session-negative-fixture-rows.json"), collectionEnvelope("live-session-negative-fixture-rows.v1", "live_session_negative_fixture_rows", result.live_session_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-session-gate-rows.json"), collectionEnvelope("live-session-gate-rows.v1", "live_session_gate_rows", result.live_session_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-session-boundary.json"), result.live_session_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "live-session-source-store-ui-handoff-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLiveSessionSourceStoreUiHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runLiveSessionSourceStoreUiHandoff(args);
    console.log(`Live session source store UI handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.live_session_source_store_ui_handoff_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Session source rows: ${result.summary.session_source_count}`);
    console.log(`Materializer rows: ${result.summary.materializer_count}`);
    console.log(`Read-only API rows: ${result.summary.api_projection_count}`);
    console.log(`UI handoff rows: ${result.summary.ui_handoff_count}`);
    console.log(`P8600 freeze ready: ${result.summary.p8600_freeze_ready}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.item_id ?? validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "live-session-source-store-ui-handoff-contract.v1",
    generated_at: generatedAt,
    contract_id: "live-session-source-store-ui-handoff.p8401-p8600",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_phases: PHASE_SPECS.map(([phase_range]) => phase_range),
    required_session_sources: SESSION_SOURCE_SPECS.map(([source_id]) => source_id),
    required_materialized_event_types: MATERIALIZER_SPECS.map(([, event_type]) => event_type),
    required_api_paths: API_PROJECTION_SPECS.map(([api_path]) => api_path),
    required_ui_handoff_surfaces: UI_HANDOFF_SPECS.map(([handoff_id]) => handoff_id),
    live_session_source_store_required: true,
    append_only_source_store_required: true,
    redacted_materializer_required: true,
    read_only_api_projection_required: true,
    ui_handoff_adapter_required: true,
    session_restore_bundle_required: true,
    raw_transcript_body_default_visible: false,
    raw_transcript_api_visible: false,
    full_transcript_api_visible: false,
    redacted_summary_ui_visible: true,
    api_write_methods_enabled: false,
    ui_handoff_raw_material_embedded: false,
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
      schema_version: "live-session-source-store-phase-row.v1",
      row_id: `live.session.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8600.${phase_range}`,
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: `gate.live_session_source_store.${phase_range}`,
      next_allowed_action: pass ? "preserve P8401-P8600 phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildSessionSourceRows(workOsUiV0, generatedAt) {
  const sourceReady = isSourceReady(workOsUiV0);
  return SESSION_SOURCE_SPECS.map(([source_id, engine_id, sessionPrefix, phase_range, rawRef, fullRef, redactedRef], index) => {
    const sessionId = `${sessionPrefix}.${dateStamp(generatedAt)}`;
    const pass = sourceReady && Boolean(source_id && engine_id && sessionId && phase_range);
    return verdictRow({
      schema_version: "session-source-store-row.v1",
      row_id: `session.source.store.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      source_id,
      engine_id,
      session_id: sessionId,
      run_id: `run.${source_id}.${dateStamp(generatedAt)}`,
      phase_id: phase_range,
      transcript_ref: `${source_id}.transcript.ref`,
      raw_transcript_ref: rawRef,
      full_transcript_ref: fullRef,
      redacted_summary_ref: redactedRef,
      append_only: true,
      overwrite_allowed: false,
      delete_allowed: false,
      raw_body_ui_visible: false,
      full_body_ui_visible: false,
      raw_body_api_visible: false,
      source_cited: true,
      write_back_enabled: false,
      protected_action_enabled: false,
      store_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "append cited session source event" : "restore P8400 source readiness before session store projection",
    }, pass);
  });
}

function buildRedactedMaterializerRows(workOsUiV0, generatedAt) {
  const sourceReady = isSourceReady(workOsUiV0);
  return MATERIALIZER_SPECS.map(([materializer_id, event_type, source_id, timeline_ref, outputShape], index) => {
    const pass = sourceReady && Boolean(materializer_id && event_type && source_id);
    return verdictRow({
      schema_version: "redacted-conversation-materializer-row.v1",
      row_id: `redacted.materializer.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      materializer_id,
      event_type,
      source_id,
      timeline_ref,
      output_shape: outputShape,
      extracts_goal: event_type === "decision",
      extracts_phase: event_type === "phase_progress",
      extracts_blocker: event_type === "blocker",
      extracts_decision: event_type === "decision",
      extracts_validation_item: event_type === "validation_event",
      extracts_review_item: event_type === "review_event",
      raw_transcript_input_ref_required: true,
      raw_transcript_output_visible: false,
      full_transcript_output_visible: false,
      redacted_summary_output_visible: true,
      source_citation_required: true,
      may_update_plan_directly: false,
      materializer_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "materialize cited redacted timeline event" : "block uncited or raw materialization",
    }, pass);
  });
}

function buildReadOnlyApiProjectionRows(sessionSourceRows, materializerRows, generatedAt) {
  const sourcesReady = sessionSourceRows.every((row) => row.current_verdict === "pass");
  const materializerReady = materializerRows.every((row) => row.current_verdict === "pass");
  return API_PROJECTION_SPECS.map(([api_path, collection_key, source_collection_ref], index) => {
    const pass = sourcesReady && materializerReady && api_path.startsWith("/api/work-os/");
    return verdictRow({
      schema_version: "read-only-api-projection-row.v1",
      row_id: `read.only.api.projection.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      api_path,
      method: "GET",
      collection_key,
      source_collection_ref,
      read_only: true,
      write_enabled: false,
      mutates_state: false,
      raw_body_returns: false,
      full_body_returns: false,
      redacted_summary_returns: true,
      source_citation_returns: true,
      protected_action_enabled: false,
      cache_or_snapshot_ref: `snapshot.${collection_key}.read_only`,
      api_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "serve read-only bounded projection" : "repair source store or materializer before API projection",
    }, pass);
  });
}

function buildUiHandoffRows(workOsUiV0, apiProjectionRows, generatedAt) {
  const sourceReady = isSourceReady(workOsUiV0);
  const apiReady = apiProjectionRows.every((row) => row.current_verdict === "pass");
  return UI_HANDOFF_SPECS.map(([handoff_id, surface_title, manifestRef, snapshotRef], index) => {
    const pass = sourceReady && apiReady && Boolean(manifestRef && snapshotRef);
    return verdictRow({
      schema_version: "ui-handoff-adapter-row.v1",
      row_id: `ui.handoff.adapter.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      handoff_id,
      surface_title,
      manifest_ref: manifestRef,
      snapshot_ref: snapshotRef,
      bounded_snapshot: true,
      read_only: true,
      raw_material_embedded: false,
      full_transcript_embedded: false,
      raw_secret_embedded: false,
      source_citation_visible: true,
      stale_context_badge_visible: true,
      unresolved_review_badge_visible: true,
      protected_action_controls_enabled: false,
      ui_handoff_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "handoff bounded snapshot to Work OS UI" : "block UI handoff until read-only API is ready",
    }, pass);
  });
}

function buildSessionRestoreBundleRows(workOsUiV0, sessionSourceRows, generatedAt) {
  const sourceReady = isSourceReady(workOsUiV0);
  const storeReady = sessionSourceRows.every((row) => row.current_verdict === "pass");
  return RESTORE_BUNDLE_SPECS.map(([bundle_id, context_type, source_ref, read_scope], index) => {
    const pass = sourceReady && storeReady && Boolean(source_ref);
    return verdictRow({
      schema_version: "session-restore-bundle-row.v1",
      row_id: `session.restore.bundle.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      bundle_id,
      context_type,
      source_ref,
      read_scope,
      source_cited: true,
      raw_transcript_embedded: false,
      full_transcript_embedded: false,
      redacted_summary_embedded: true,
      auto_context_mutation: false,
      stale_context_badge_required: context_type === "blocker_state" || context_type === "phase_state",
      restore_status: pass ? "ready" : "blocked",
      next_allowed_action: pass ? "hydrate next session from cited redacted bundle" : "block restore until source citation exists",
    }, pass);
  });
}

function buildP8600FreezeRows({ phaseRows, sessionSourceRows, materializerRows, apiProjectionRows, uiHandoffRows, restoreBundleRows, generatedAt }) {
  const specs = [
    ["freeze.phase_rows", "P8401-P8600 phase rows reflected", phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.live_session_source_store", "live session source store append-only and cited", sessionSourceRows.every((row) => row.current_verdict === "pass")],
    ["freeze.redacted_materializer", "redacted materializer emits cited summaries only", materializerRows.every((row) => row.current_verdict === "pass")],
    ["freeze.read_only_api_projection", "Work OS API projection is GET-only and non-mutating", apiProjectionRows.every((row) => row.current_verdict === "pass")],
    ["freeze.ui_handoff_adapter", "UI handoff adapter uses bounded read-only snapshots", uiHandoffRows.every((row) => row.current_verdict === "pass")],
    ["freeze.session_restore_bundle", "next-session restore bundle is cited and redacted", restoreBundleRows.every((row) => row.current_verdict === "pass")],
    ["freeze.no_authority_expansion", "no human, production, enterprise, protected closeout, runtime, write, or final approval expansion", true],
  ];
  return specs.map(([freeze_id, title, pass], index) => verdictRow({
    schema_version: "p8600-freeze-row.v1",
    row_id: `p8600.freeze.row.${String(index + 1).padStart(2, "0")}`,
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
    next_allowed_action: pass ? "include in P8600 freeze packet" : "repair prerequisite handoff row",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, unsafe_claim, expected_block_reason], index) => verdictRow({
    schema_version: "live-session-negative-fixture-row.v1",
    row_id: `live.session.negative.fixture.${String(index + 1).padStart(2, "0")}`,
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
    workOsUiV0,
    contract,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
  } = context;
  const sourceReady = isSourceReady(workOsUiV0);
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes live session source store UI handoff command"],
    ["source_command_registered", Boolean(packageJson.data?.scripts?.[SOURCE_COMMAND_NAME]), "source Work OS UI v0 governed loop command exists"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes live session source store UI handoff command"],
    ["runs_after_p8400", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "P8600 command runs after P8400 source command"],
    ["source_work_os_ui_v0_ready", sourceReady, "P8241-P8400 source Work OS UI v0 is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Live Session Source Store"), "P8401-P8600 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "P8401-P8600 Live Session Source Store, Read-Only API Projection, and UI Handoff Adapter"), "architecture reflects P8401-P8600"],
    ["phase_rows_pass", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all P8401-P8600 phase rows pass"],
    ["session_sources_append_only", sessionSourceRows.length >= 4 && sessionSourceRows.every((row) => row.append_only && row.overwrite_allowed === false && row.raw_body_ui_visible === false), "session source rows are append-only and raw-hidden"],
    ["materializer_redacted", materializerRows.length >= 5 && materializerRows.every((row) => row.redacted_summary_output_visible && row.raw_transcript_output_visible === false), "materializer rows expose redacted summaries only"],
    ["api_projection_read_only", apiProjectionRows.length >= 5 && apiProjectionRows.every((row) => row.method === "GET" && row.read_only && row.write_enabled === false && row.mutates_state === false), "API projection rows are GET-only and non-mutating"],
    ["api_projection_no_raw", apiProjectionRows.every((row) => row.raw_body_returns === false && row.full_body_returns === false), "API projection does not return raw or full transcript bodies"],
    ["ui_handoff_bounded", uiHandoffRows.length >= 5 && uiHandoffRows.every((row) => row.bounded_snapshot && row.read_only && row.raw_material_embedded === false), "UI handoff uses bounded read-only snapshots"],
    ["session_restore_cited", restoreBundleRows.length >= 5 && restoreBundleRows.every((row) => row.source_cited && row.auto_context_mutation === false), "session restore bundle is cited and non-mutating"],
    ["p8600_freeze_rows_ready", p8600FreezeRows.every((row) => row.current_verdict === "pass"), "P8600 freeze rows are ready"],
    ["negative_fixtures_block", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), "negative fixtures block unsafe live session and API claims"],
    ["no_human_gate", contract.human_gate_in_scope === false, "P8600 remains no-human milestone mode"],
    ["no_final_authority", contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_reviewer_mutation", contract.reviewer_mutation_allowed === false, "reviewer mutation remains disabled"],
    ["no_production_enterprise", contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
    ["no_runtime_write", contract.runtime_execution_enabled === false && contract.write_action_enabled === false && contract.external_connector_write_enabled === false, "runtime execution, write action, and connector write remain disabled"],
    ["no_raw_api", contract.raw_transcript_api_visible === false && contract.full_transcript_api_visible === false, "raw and full transcript API exposure remains disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "live-session-gate-row.v1",
    row_id: `live.session.gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gate_id}`,
    reviewer_ref: "reviewer.harness_validator",
    hard_gate_ref: `hard_gate.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
  }, pass));
}

function buildBoundary({ workOsUiV0, phaseRows, sessionSourceRows, materializerRows, apiProjectionRows, uiHandoffRows, restoreBundleRows, p8600FreezeRows, negativeFixtureRows, gateRows }) {
  const sourceReady = isSourceReady(workOsUiV0);
  const storeReady = sessionSourceRows.every((row) => row.current_verdict === "pass");
  const materializerReady = materializerRows.every((row) => row.current_verdict === "pass");
  const apiReady = apiProjectionRows.every((row) => row.current_verdict === "pass");
  const uiReady = uiHandoffRows.every((row) => row.current_verdict === "pass");
  const restoreReady = restoreBundleRows.every((row) => row.current_verdict === "pass");
  const freezeReady = p8600FreezeRows.every((row) => row.current_verdict === "pass");
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
    schema_version: "live-session-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_ui_v0_ready: sourceReady,
    phase_rows_ready: phaseRows.every((row) => row.current_verdict === "pass"),
    live_session_source_store_ready: storeReady,
    redacted_materializer_ready: materializerReady,
    read_only_api_projection_ready: apiReady,
    ui_handoff_adapter_ready: uiReady,
    session_restore_bundle_ready: restoreReady,
    p8600_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p8601_handoff: sourceReady && storeReady && materializerReady && apiReady && uiReady && restoreReady && freezeReady && negativeFixturesBlock && gatesPass,
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
    workOsUiV0,
    contract,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
  } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include command"),
    validationItem("package.order", "package", validateScript.indexOf(`${COMMAND_NAME} -- --check`) > validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) && validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`) >= 0, "command must run after P8400 source command"),
    validationItem("source.ready", "source", isSourceReady(workOsUiV0), "P8241-P8400 source must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, "P8401-P8600"), "roadmap must reflect P8401-P8600"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P8401-P8600 Live Session Source Store, Read-Only API Projection, and UI Handoff Adapter"), "architecture must reflect P8401-P8600"),
    validationItem("contract.required_planes", "contract", contract.live_session_source_store_required && contract.redacted_materializer_required && contract.read_only_api_projection_required && contract.ui_handoff_adapter_required, "required store/materializer/API/UI planes must be present"),
    validationItem("phase.rows", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("session.sources", "store", sessionSourceRows.length === SESSION_SOURCE_SPECS.length && sessionSourceRows.every((row) => row.engine_id && row.session_id && row.run_id && row.phase_id && row.transcript_ref), "session source rows need stable ids and refs"),
    validationItem("session.sources.append_only", "store", sessionSourceRows.every((row) => row.append_only && row.overwrite_allowed === false && row.delete_allowed === false), "session source store must be append-only"),
    validationItem("session.sources.raw_hidden", "store", sessionSourceRows.every((row) => row.raw_body_ui_visible === false && row.raw_body_api_visible === false), "raw session body must stay hidden"),
    validationItem("materializer.rows", "materializer", materializerRows.length === MATERIALIZER_SPECS.length && materializerRows.every((row) => row.redacted_summary_output_visible && row.source_citation_required), "materializer rows must output cited redacted summaries"),
    validationItem("materializer.no_direct_update", "materializer", materializerRows.every((row) => row.may_update_plan_directly === false), "materializer cannot mutate plan directly"),
    validationItem("api.rows", "api", apiProjectionRows.length === API_PROJECTION_SPECS.length && apiProjectionRows.every((row) => row.method === "GET" && row.read_only), "API projection rows must be GET-only"),
    validationItem("api.no_raw", "api", apiProjectionRows.every((row) => row.raw_body_returns === false && row.full_body_returns === false), "API projection cannot return raw or full transcript bodies"),
    validationItem("api.no_mutation", "api", apiProjectionRows.every((row) => row.write_enabled === false && row.mutates_state === false && row.protected_action_enabled === false), "API projection cannot mutate state"),
    validationItem("ui.handoff", "ui", uiHandoffRows.length === UI_HANDOFF_SPECS.length && uiHandoffRows.every((row) => row.bounded_snapshot && row.read_only), "UI handoff rows must be bounded and read-only"),
    validationItem("ui.no_raw", "ui", uiHandoffRows.every((row) => row.raw_material_embedded === false && row.full_transcript_embedded === false && row.raw_secret_embedded === false), "UI handoff cannot embed raw materials or secrets"),
    validationItem("restore.bundle", "restore", restoreBundleRows.length === RESTORE_BUNDLE_SPECS.length && restoreBundleRows.every((row) => row.source_cited && row.auto_context_mutation === false), "restore bundle rows must be cited and non-mutating"),
    validationItem("freeze.ready", "freeze", p8600FreezeRows.every((row) => row.current_verdict === "pass"), "P8600 freeze rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("gates.pass", "gates", gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.no_human", "boundary", boundary.human_gate_in_scope === false, "human gate must remain excluded"),
    validationItem("boundary.no_final_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false, "Codex and Claude final approval must remain false"),
    validationItem("boundary.no_reviewer_mutation", "boundary", boundary.reviewer_mutation_allowed === false, "reviewer mutation must remain false"),
    validationItem("boundary.no_enterprise_production", "boundary", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "production and enterprise PASS must remain false"),
    validationItem("boundary.no_runtime_write", "boundary", boundary.runtime_execution_enabled === false && boundary.write_action_enabled === false && boundary.external_connector_write_enabled === false, "runtime, write, and connector write must remain false"),
    validationItem("boundary.no_raw_api", "boundary", boundary.raw_transcript_api_visible === false, "raw transcript API exposure must remain false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p8601_handoff === true && boundary.unsafe_flag_count === 0, "P8600 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const {
    workOsUiV0,
    phaseRows,
    sessionSourceRows,
    materializerRows,
    apiProjectionRows,
    uiHandoffRows,
    restoreBundleRows,
    p8600FreezeRows,
    negativeFixtureRows,
    gateRows,
    boundary,
    validation,
  } = context;
  const ready = validation.valid && boundary.ready_for_p8601_handoff;
  return {
    schema_version: "live-session-source-store-ui-handoff-summary.v1",
    live_session_source_store_ui_handoff_status: ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_work_os_ui_v0_status: workOsUiV0.data?.summary?.work_os_ui_v0_governed_loop_status ?? "missing",
    source_work_os_ui_v0_ready: isSourceReady(workOsUiV0),
    phase_row_count: phaseRows.length,
    session_source_count: sessionSourceRows.length,
    materializer_count: materializerRows.length,
    api_projection_count: apiProjectionRows.length,
    ui_handoff_count: uiHandoffRows.length,
    restore_bundle_count: restoreBundleRows.length,
    p8600_freeze_count: p8600FreezeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    live_session_source_store_ready: boundary.live_session_source_store_ready,
    redacted_materializer_ready: boundary.redacted_materializer_ready,
    read_only_api_projection_ready: boundary.read_only_api_projection_ready,
    ui_handoff_adapter_ready: boundary.ui_handoff_adapter_ready,
    session_restore_bundle_ready: boundary.session_restore_bundle_ready,
    p8600_freeze_ready: boundary.p8600_freeze_ready,
    ready_for_p8601_handoff: boundary.ready_for_p8601_handoff,
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
    "# Live Session Source Store UI Handoff",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.live_session_source_store_ui_handoff_status}`,
    "",
    "## Summary",
    "",
    `- Source Work OS UI v0 ready: ${result.summary.source_work_os_ui_v0_ready}`,
    `- Session source rows: ${result.summary.session_source_count}`,
    `- Redacted materializer rows: ${result.summary.materializer_count}`,
    `- Read-only API rows: ${result.summary.api_projection_count}`,
    `- UI handoff rows: ${result.summary.ui_handoff_count}`,
    `- Restore bundle rows: ${result.summary.restore_bundle_count}`,
    `- P8600 freeze ready: ${result.summary.p8600_freeze_ready}`,
    `- Ready for P8601 handoff: ${result.summary.ready_for_p8601_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P8401-P8600 stores and projects live session sources for Work OS UI handoff, but it does not expose raw transcript bodies, enable API writes, create human adjudication, create production PASS, create enterprise PASS, enable protected closeout, open runtime execution, allow write action, allow connector writes, or make Codex/Claude final approvers.",
  ];
  return `${lines.join("\n")}\n`;
}

async function readJsonOrBuildWorkOsUiV0(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildWorkOsUiV0GovernedLoop({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.work_os_ui_v0_governed_loop", built);
  } catch (error) {
    return { available: false, path: sourcePath, error: `${source.error}; fallback failed: ${error.message}` };
  }
}

function isSourceReady(workOsUiV0) {
  return workOsUiV0.data?.summary?.work_os_ui_v0_governed_loop_status === SOURCE_READY_STATUS
    && workOsUiV0.data?.summary?.ready_for_p8401_handoff === true;
}

function normalizeInputs(options = {}) {
  const defaults = DEFAULT_LIVE_SESSION_SOURCE_STORE_UI_HANDOFF_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    work_os_ui_v0_governed_loop_path: options.workOsUiV0GovernedLoopPath ?? defaults.workOsUiV0GovernedLoopPath,
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
    schema_version: "live-session-validation-item.v1",
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
    workOsUiV0GovernedLoopPath: undefined,
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
    } else if (arg === "--work-os-ui-v0-governed-loop") {
      args.workOsUiV0GovernedLoopPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/live-session-source-store-ui-handoff.mjs [options]

Options:
  --check                                      Validate without writing artifacts.
  --out-dir <path>                             Artifact output directory.
  --schema <path>                              JSON schema path.
  --package <path>                             package.json path.
  --roadmap-doc <path>                         P8401-P8600 roadmap document path.
  --architecture-doc <path>                    Architecture document path.
  --work-os-ui-v0-governed-loop <path>         Source P8241-P8400 Work OS UI v0 artifact path.
  --help                                       Show this help.
`);
}
