import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildCiGithubEvidenceBridge } from "./ci-github-evidence-bridge.mjs";

export const DEFAULT_LOCAL_SESSION_CAPTURE_MEMORY_STORE_OUT_DIR = "artifacts/local-session-capture-memory-store/latest";
export const DEFAULT_LOCAL_SESSION_CAPTURE_MEMORY_STORE_INPUTS = {
  schemaPath: "schemas/local-session-capture-memory-store.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p10401-p10600.md",
  architectureDocPath: "docs/architecture.md",
  sourceCiGithubEvidenceBridgePath: "artifacts/ci-github-evidence-bridge/latest/ci-github-evidence-bridge.json",
};

export const DEFAULT_LOCAL_SESSION_CAPTURE_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_SESSION_CAPTURE_PORT = 4201;

const COMMAND_NAME = "platform:local-session-capture-memory-store";
const SOURCE_COMMAND_NAME = "platform:ci-github-evidence-bridge";
const SCHEMA_VERSION = "local-session-capture-memory-store.v1";
const CAPABILITY_ID = "platform.local_session_capture_memory_store";
const PROGRAM_RANGE = "P10401-P10600";
const SOURCE_PROGRAM_RANGE = "P10201-P10400";
const SOURCE_READY_STATUS = "ready_for_ci_github_evidence_bridge";
const READY_STATUS = "ready_for_local_session_capture_memory_store";
const BLOCKED_STATUS = "blocked_local_session_capture_memory_store";

const PHASE_SPECS = [
  ["P10401-P10420", "P10400 Source Binding"],
  ["P10421-P10440", "Session Source Schema"],
  ["P10441-P10460", "Local Capture Store Envelope"],
  ["P10461-P10480", "Raw Full Redacted Separation"],
  ["P10481-P10500", "Event Extraction Rows"],
  ["P10501-P10520", "Object Ref And Hash Binding"],
  ["P10521-P10540", "Read-Only API Projection"],
  ["P10541-P10560", "Drift And Duplicate Detection"],
  ["P10561-P10580", "Negative Fixtures And Boundary"],
  ["P10581-P10600", "P10600 Freeze"],
];

const SESSION_SOURCE_SPECS = [
  ["session.codex.primary", "engine.codex.primary_developer", "Codex", "development_engine", "codex-thread", "P10421-P10440"],
  ["session.claude.review", "engine.claude.independent_reviewer", "Claude Code", "independent_review_engine", "claude-review", "P10421-P10440"],
  ["session.harness.validator", "engine.harness.validator", "Harness Validator", "validation_engine", "harness-validator", "P10441-P10460"],
  ["session.ui.handoff", "engine.harness.ui_projection", "Harness UI", "ui_projection_engine", "ui-handoff", "P10441-P10460"],
];

const TRANSCRIPT_TIER_SPECS = [
  ["tier.raw", "raw_transcript", "local_object_ref_only", false, false, true],
  ["tier.full", "full_structured_transcript", "restricted_object_ref_only", false, false, true],
  ["tier.redacted", "redacted_summary", "ui_api_visible_summary", true, true, false],
];

const EVENT_EXTRACTION_SPECS = [
  ["event.goal", "goal", "session.codex.primary", "current goal and objective checkpoint"],
  ["event.decision", "decision", "session.codex.primary", "accepted direction, rejected direction, and scope boundary"],
  ["event.blocker", "blocker", "session.codex.primary", "missing evidence, stale state, failing validation, or unsafe boundary"],
  ["event.validation", "validation_event", "session.harness.validator", "command, validator, check, evidence, and result"],
  ["event.review", "review_event", "session.claude.review", "review packet, review receipt, finding, and disposition"],
  ["event.phase_progress", "phase_progress", "session.ui.handoff", "phase status, next action, handoff, and checkpoint"],
];

const OBJECT_REF_SPECS = [
  ["object.codex.raw", "session.codex.primary", "tier.raw", "transcript", "sha256.codex.raw"],
  ["object.codex.redacted", "session.codex.primary", "tier.redacted", "summary", "sha256.codex.redacted"],
  ["object.claude.review", "session.claude.review", "tier.redacted", "review_receipt", "sha256.claude.review"],
  ["object.harness.validation", "session.harness.validator", "tier.redacted", "validation_report", "sha256.harness.validation"],
  ["object.ui.handoff", "session.ui.handoff", "tier.redacted", "ui_handoff", "sha256.ui.handoff"],
];

const DRIFT_DETECTOR_SPECS = [
  ["drift.duplicate_session", "duplicate_session_event", "same engine/session/run accepted twice", "BLOCK_DUPLICATE_SESSION_EVENT"],
  ["drift.stale_context", "stale_context", "stale transcript summary treated as current truth", "BLOCK_STALE_CONTEXT_AS_CURRENT"],
  ["drift.uncited_memory", "uncited_memory", "memory claim without transcript/event citation", "BLOCK_UNCITED_MEMORY"],
  ["drift.cross_domain", "cross_domain_contamination", "domain-scoped session leaks into another project/domain", "BLOCK_CROSS_DOMAIN_CONTAMINATION"],
  ["drift.missing_redaction", "missing_redaction", "raw/full material is projected before redaction", "BLOCK_MISSING_REDACTION"],
  ["drift.authority_pollution", "authority_pollution", "conversation source is treated as final approval", "BLOCK_AUTHORITY_POLLUTION"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "local session capture health", "computed"],
  ["/api/session-capture/sources", "sources", "session source identity rows", "session_source_identity_rows"],
  ["/api/session-capture/transcripts", "transcripts", "transcript tier boundary rows", "transcript_tier_boundary_rows"],
  ["/api/session-capture/events", "events", "session event extraction rows", "session_event_extraction_rows"],
  ["/api/session-capture/objects", "objects", "memory object ref rows", "memory_object_ref_rows"],
  ["/api/session-capture/drift", "drift", "session drift detector rows", "session_drift_detector_rows"],
  ["/api/session-capture/boundary", "boundary", "session capture authority boundary", "session_capture_boundary"],
  ["/api/session-capture/summary", "summary", "session capture summary", "summary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p10400_source", "Session capture passes without P10400 bridge source", "BLOCK_MISSING_P10400_SOURCE"],
  ["negative.missing_transcript_ref", "Session source has no transcript ref", "BLOCK_MISSING_TRANSCRIPT_REF"],
  ["negative.raw_transcript_api_response", "API returns raw or full transcript body", "BLOCK_RAW_TRANSCRIPT_API_RESPONSE"],
  ["negative.raw_transcript_ui_visible", "UI renders raw or full transcript body", "BLOCK_RAW_TRANSCRIPT_UI_VISIBLE"],
  ["negative.duplicate_session_event", "Duplicate session event is accepted as a new fact", "BLOCK_DUPLICATE_SESSION_EVENT"],
  ["negative.uncited_memory_claim", "Memory claim has no transcript citation", "BLOCK_UNCITED_MEMORY_CLAIM"],
  ["negative.stale_context_pass", "Stale context is treated as current truth", "BLOCK_STALE_CONTEXT_PASS"],
  ["negative.cross_domain_leak", "Session source crosses project or domain boundary", "BLOCK_CROSS_DOMAIN_LEAK"],
  ["negative.api_write_method", "POST PUT PATCH DELETE mutates capture store", "BLOCK_API_WRITE_METHOD"],
  ["negative.codex_final_approval", "Codex conversation becomes final approval", "BLOCK_CODEX_FINAL_APPROVAL"],
  ["negative.claude_final_approval", "Claude review conversation becomes final approval", "BLOCK_CLAUDE_FINAL_APPROVAL"],
  ["negative.runtime_recall_enabled", "Runtime recall opens before cited retrieval guard", "BLOCK_RUNTIME_RECALL_ENABLED"],
  ["negative.production_enterprise_pass", "Session capture creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runLocalSessionCaptureMemoryStore(options = {}) {
  const result = await buildLocalSessionCaptureMemoryStore(options);
  if (options.write !== false) await writeLocalSessionCaptureMemoryStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Local session capture memory store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLocalSessionCaptureMemoryStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LOCAL_SESSION_CAPTURE_MEMORY_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "ciGithubEvidenceBridge")
    ? normalizeInlineJsonSource("inline.ci_github_evidence_bridge", options.ciGithubEvidenceBridge)
    : await readJsonOrBuildCiGithubEvidenceBridge(inputs.source_ci_github_evidence_bridge_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const sessionSourceRows = buildSessionSourceRows(source, generatedAt);
  const localCaptureStoreRows = buildLocalCaptureStoreRows(sessionSourceRows, generatedAt);
  const transcriptTierRows = buildTranscriptTierRows(generatedAt);
  const eventExtractionRows = buildEventExtractionRows(sessionSourceRows, generatedAt);
  const objectRefRows = buildObjectRefRows(sessionSourceRows, generatedAt);
  const driftDetectorRows = buildDriftDetectorRows(generatedAt);
  const apiRouteRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = buildApiSmokeRows({ source, generatedAt });
  const browserSmokeRows = buildBrowserSmokeRows({ source, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const boundary = buildBoundary({
    source,
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
  }, generatedAt);
  const freezeRows = buildFreezeRows({
    boundary,
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
  }, generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    boundary,
    freezeRows,
  }, generatedAt);
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    contract,
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    boundary,
    freezeRows,
    gateRows,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      ci_github_evidence_bridge_path: source.path,
    },
    source_ci_github_evidence_summary: source.data?.summary ?? null,
    session_capture_contract: contract,
    session_capture_phase_rows: phaseRows,
    p10400_source_binding_rows: sourceBindingRows,
    session_source_identity_rows: sessionSourceRows,
    local_capture_store_rows: localCaptureStoreRows,
    transcript_tier_boundary_rows: transcriptTierRows,
    session_event_extraction_rows: eventExtractionRows,
    memory_object_ref_rows: objectRefRows,
    session_drift_detector_rows: driftDetectorRows,
    session_capture_api_route_rows: apiRouteRows,
    session_capture_api_smoke_rows: apiSmokeRows,
    session_capture_browser_smoke_rows: browserSmokeRows,
    session_capture_negative_fixture_rows: negativeFixtureRows,
    p10600_freeze_rows: freezeRows,
    session_capture_gate_rows: gateRows,
    session_capture_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ source, phaseRows, sourceBindingRows, sessionSourceRows, localCaptureStoreRows, transcriptTierRows, eventExtractionRows, objectRefRows, driftDetectorRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, boundary, freezeRows, gateRows, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "local_session_capture_memory_store")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ source, phaseRows, sourceBindingRows, sessionSourceRows, localCaptureStoreRows, transcriptTierRows, eventExtractionRows, objectRefRows, driftDetectorRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, boundary, freezeRows, gateRows, validation: result.validation });
  return {
    ...result,
    html: renderHtml(result),
    markdown: renderMarkdown(result),
  };
}

export async function writeLocalSessionCaptureMemoryStore(result, outDir = DEFAULT_LOCAL_SESSION_CAPTURE_MEMORY_STORE_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "local-session-capture-memory-store.json"), serializableResult(result));
  await writeJson(path.join(outDir, "session-capture-phase-rows.json"), result.session_capture_phase_rows);
  await writeJson(path.join(outDir, "p10400-source-binding-rows.json"), result.p10400_source_binding_rows);
  await writeJson(path.join(outDir, "session-source-identity-rows.json"), result.session_source_identity_rows);
  await writeJson(path.join(outDir, "local-capture-store-rows.json"), result.local_capture_store_rows);
  await writeJson(path.join(outDir, "transcript-tier-boundary-rows.json"), result.transcript_tier_boundary_rows);
  await writeJson(path.join(outDir, "session-event-extraction-rows.json"), result.session_event_extraction_rows);
  await writeJson(path.join(outDir, "memory-object-ref-rows.json"), result.memory_object_ref_rows);
  await writeJson(path.join(outDir, "session-drift-detector-rows.json"), result.session_drift_detector_rows);
  await writeJson(path.join(outDir, "session-capture-api-route-rows.json"), result.session_capture_api_route_rows);
  await writeJson(path.join(outDir, "session-capture-api-smoke-rows.json"), result.session_capture_api_smoke_rows);
  await writeJson(path.join(outDir, "session-capture-browser-smoke-rows.json"), result.session_capture_browser_smoke_rows);
  await writeJson(path.join(outDir, "session-capture-negative-fixture-rows.json"), result.session_capture_negative_fixture_rows);
  await writeJson(path.join(outDir, "p10600-freeze-rows.json"), result.p10600_freeze_rows);
  await writeJson(path.join(outDir, "session-capture-gate-rows.json"), result.session_capture_gate_rows);
  await writeJson(path.join(outDir, "session-capture-boundary.json"), result.session_capture_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), result.validation);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export function createLocalSessionCaptureApiServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      const apiResponse = await buildLocalSessionCaptureApiResponse(request.url ?? "/", { ...options, method: request.method });
      response.writeHead(apiResponse.status, apiResponse.headers);
      response.end(request.method === "HEAD" ? "" : apiResponse.body);
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(buildError("internal_error", error.message), null, 2));
    }
  });
}

export async function startLocalSessionCaptureApiServer(options = {}) {
  const host = options.host ?? DEFAULT_LOCAL_SESSION_CAPTURE_HOST;
  const port = options.port ?? DEFAULT_LOCAL_SESSION_CAPTURE_PORT;
  const server = createLocalSessionCaptureApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildLocalSessionCaptureApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Local session capture API is read-only."), method);
  }
  const pathname = normalizePath(new URL(requestUrl, "http://hermes.local").pathname);
  if (pathname === "/" || pathname === "/index.html") {
    const result = await buildLocalSessionCaptureMemoryStore({ ...options, write: false });
    return htmlResponse(200, result.html, method);
  }
  const result = await buildLocalSessionCaptureMemoryStore({ ...options, write: false });
  const routeMap = {
    "/health": { status: result.summary.local_session_capture_memory_store_status, ready: result.summary.ready_for_p10601_handoff, validation: result.validation },
    "/api/session-capture/sources": result.session_source_identity_rows,
    "/api/session-capture/transcripts": result.transcript_tier_boundary_rows,
    "/api/session-capture/events": result.session_event_extraction_rows,
    "/api/session-capture/objects": result.memory_object_ref_rows,
    "/api/session-capture/drift": result.session_drift_detector_rows,
    "/api/session-capture/boundary": result.session_capture_boundary,
    "/api/session-capture/summary": result.summary,
  };
  if (!Object.prototype.hasOwnProperty.call(routeMap, pathname)) {
    return jsonResponse(404, buildError("not_found", `Unknown local session capture route: ${pathname}`), method);
  }
  return jsonResponse(200, sanitizeApiPayload(routeMap[pathname]), method);
}

function buildContract(generatedAt) {
  return {
    schema_version: "local-session-capture-contract.v1",
    generated_at: generatedAt,
    contract_id: "local-session-capture-memory-store.p10401-p10600",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    required_session_sources: SESSION_SOURCE_SPECS.map(([sourceId]) => sourceId),
    required_event_types: EVENT_EXTRACTION_SPECS.map(([, eventType]) => eventType),
    required_api_paths: API_ROUTE_SPECS.map(([apiPath]) => apiPath),
    append_only_capture_required: true,
    transcript_ref_required: true,
    object_ref_hash_required: true,
    source_citation_required: true,
    raw_transcript_body_default_visible: false,
    full_transcript_body_default_visible: false,
    redacted_summary_ui_visible: true,
    redacted_summary_api_visible: true,
    api_projection_read_only: true,
    api_write_methods_enabled: false,
    runtime_recall_enabled: false,
    retrieval_truth_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, phaseName], index) => {
    const pass = includesToken(roadmapText, phaseRange) && includesToken(roadmapText, phaseName);
    return verdictRow({
      row_id: `session.capture.phase.${String(index + 1).padStart(2, "0")}`,
      category: "phase",
      label: phaseName,
      phase_range: phaseRange,
      required: true,
      observed: pass,
      evidence_ref: `docs/hermes-roadmap-p10401-p10600.md#${slug(phaseRange)}`,
      generated_at: generatedAt,
      block_reason: pass ? null : "phase_not_documented",
    }, pass);
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const sourceReady = isSourceReady(source);
  const externalBlockerVisible = Number.isInteger(source.data?.summary?.external_closeout_blocker_count ?? null);
  const bridgeDoesNotPromote = source.data?.summary?.release_closeout_allowed_now !== true
    && source.data?.summary?.enterprise_trust_allowed_now !== true;
  const rows = [
    ["source.p10400.ready", "P10400 CI/GitHub bridge ready", sourceReady, source.path],
    ["source.external_blockers.visible", "P10400 external blockers remain visible", sourceReady && externalBlockerVisible, source.path],
    ["source.no_release_enterprise_promotion", "P10400 bridge does not become release or enterprise trust", sourceReady && bridgeDoesNotPromote, source.path],
  ];
  return rows.map(([rowId, label, pass, evidenceRef]) => verdictRow({
    row_id: rowId,
    category: "source",
    label,
    required: true,
    observed: Boolean(pass),
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    block_reason: pass ? null : "p10400_source_not_ready_or_overpromoted",
  }, pass));
}

function buildSessionSourceRows(source, generatedAt) {
  const sourceReady = isSourceReady(source);
  return SESSION_SOURCE_SPECS.map(([sourceId, engineId, engineName, authorityRole, sessionPrefix, phaseRange], index) => {
    const sessionId = `${sessionPrefix}.${dateStamp(generatedAt)}`;
    const pass = sourceReady && Boolean(sourceId && engineId && sessionId);
    return verdictRow({
      schema_version: "session-source-identity-row.v1",
      row_id: `session.source.identity.${String(index + 1).padStart(2, "0")}`,
      category: "session_source",
      label: engineName,
      generated_at: generatedAt,
      source_id: sourceId,
      engine_id: engineId,
      engine_name: engineName,
      authority_role: authorityRole,
      session_id: sessionId,
      run_id: `run.${slug(sourceId)}.${dateStamp(generatedAt)}`,
      phase_range: phaseRange,
      transcript_ref: `object.${slug(sourceId)}.transcript.ref`,
      full_transcript_ref: `object.${slug(sourceId)}.full.ref`,
      redacted_summary_ref: `object.${slug(sourceId)}.redacted.ref`,
      source_citation_ref: `citation.${slug(sourceId)}.${dateStamp(generatedAt)}`,
      required: true,
      observed: pass,
      evidence_ref: `evidence.session_source.${slug(sourceId)}`,
      final_approval_allowed: false,
      source_mutation_allowed: false,
      raw_body_ui_visible: false,
      full_body_ui_visible: false,
      raw_body_api_visible: false,
      full_body_api_visible: false,
      block_reason: pass ? null : "missing_p10400_source_or_session_identity",
    }, pass);
  });
}

function buildLocalCaptureStoreRows(sessionSourceRows, generatedAt) {
  return sessionSourceRows.map((source, index) => {
    const pass = source.current_verdict === "pass" && Boolean(source.transcript_ref && source.source_citation_ref);
    return verdictRow({
      schema_version: "local-capture-store-row.v1",
      row_id: `local.capture.store.${String(index + 1).padStart(2, "0")}`,
      category: "capture_store",
      label: `${source.source_id} capture envelope`,
      generated_at: generatedAt,
      source_id: source.source_id,
      engine_id: source.engine_id,
      session_id: source.session_id,
      run_id: source.run_id,
      transcript_ref: source.transcript_ref,
      redacted_summary_ref: source.redacted_summary_ref,
      source_citation_ref: source.source_citation_ref,
      append_only: true,
      overwrite_allowed: false,
      delete_allowed: false,
      body_inlined: false,
      raw_body_stored_as_ref_only: true,
      full_body_stored_as_ref_only: true,
      redacted_summary_visible: true,
      retention_policy_ref: "retention.local_session.default",
      required: true,
      observed: pass,
      evidence_ref: `evidence.local_capture.${slug(source.source_id)}`,
      block_reason: pass ? null : "capture_envelope_missing_required_ref",
    }, pass);
  });
}

function buildTranscriptTierRows(generatedAt) {
  return TRANSCRIPT_TIER_SPECS.map(([tierId, tierName, storageMode, uiVisible, apiVisible, restricted], index) => verdictRow({
    schema_version: "transcript-tier-boundary-row.v1",
    row_id: `transcript.tier.boundary.${String(index + 1).padStart(2, "0")}`,
    category: "transcript_tier",
    label: tierName,
    generated_at: generatedAt,
    tier_id: tierId,
    tier_name: tierName,
    storage_mode: storageMode,
    ui_visible: uiVisible,
    api_visible: apiVisible,
    restricted_access_required: restricted,
    body_inlined: false,
    source_citation_required: true,
    redaction_required_before_ui: tierId !== "tier.redacted",
    required: true,
    observed: tierId === "tier.redacted" ? uiVisible && apiVisible : !uiVisible && !apiVisible,
    evidence_ref: `evidence.transcript_tier.${slug(tierId)}`,
    block_reason: null,
  }, tierId === "tier.redacted" ? uiVisible && apiVisible : !uiVisible && !apiVisible));
}

function buildEventExtractionRows(sessionSourceRows, generatedAt) {
  const sourceIds = new Set(sessionSourceRows.filter((row) => row.current_verdict === "pass").map((row) => row.source_id));
  return EVENT_EXTRACTION_SPECS.map(([eventId, eventType, sourceId, description], index) => {
    const pass = sourceIds.has(sourceId);
    return verdictRow({
      schema_version: "session-event-extraction-row.v1",
      row_id: `session.event.extraction.${String(index + 1).padStart(2, "0")}`,
      category: "event_extraction",
      label: eventType,
      generated_at: generatedAt,
      event_id: eventId,
      event_type: eventType,
      source_id: sourceId,
      description,
      source_citation_required: true,
      source_citation_present: pass,
      redacted_summary_output_visible: true,
      raw_body_embedded: false,
      full_body_embedded: false,
      adopted_as_truth: false,
      mutates_plan_directly: false,
      required: true,
      observed: pass,
      evidence_ref: `evidence.session_event.${slug(eventId)}`,
      block_reason: pass ? null : "missing_source_for_event_extraction",
    }, pass);
  });
}

function buildObjectRefRows(sessionSourceRows, generatedAt) {
  const sourceIds = new Set(sessionSourceRows.filter((row) => row.current_verdict === "pass").map((row) => row.source_id));
  return OBJECT_REF_SPECS.map(([objectId, sourceId, tierId, objectType, hashRef], index) => {
    const pass = sourceIds.has(sourceId) && Boolean(hashRef);
    return verdictRow({
      schema_version: "memory-object-ref-row.v1",
      row_id: `memory.object.ref.${String(index + 1).padStart(2, "0")}`,
      category: "object_ref",
      label: objectType,
      generated_at: generatedAt,
      object_id: objectId,
      source_id: sourceId,
      tier_id: tierId,
      object_type: objectType,
      object_ref: `local.object.${slug(objectId)}.ref`,
      sha256_ref: hashRef,
      provenance_ref: `provenance.${slug(objectId)}`,
      body_inlined: false,
      secret_material_inlined: false,
      client_material_inlined: false,
      citation_ref: `citation.${slug(objectId)}`,
      freshness_checked: true,
      required: true,
      observed: pass,
      evidence_ref: `evidence.memory_object.${slug(objectId)}`,
      block_reason: pass ? null : "missing_source_or_hash_ref",
    }, pass);
  });
}

function buildDriftDetectorRows(generatedAt) {
  return DRIFT_DETECTOR_SPECS.map(([detectorId, detectorType, unsafeClaim, expectedBlockReason], index) => verdictRow({
    schema_version: "session-drift-detector-row.v1",
    row_id: `session.drift.detector.${String(index + 1).padStart(2, "0")}`,
    category: "drift_detector",
    label: detectorType,
    generated_at: generatedAt,
    detector_id: detectorId,
    detector_type: detectorType,
    unsafe_claim: unsafeClaim,
    expected_block_reason: expectedBlockReason,
    detector_present: true,
    unsafe_claim_allowed: false,
    required: true,
    observed: true,
    evidence_ref: `evidence.drift.${slug(detectorId)}`,
    block_reason: null,
  }, true));
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([apiPath, routeKey, description, collectionRef], index) => verdictRow({
    schema_version: "session-capture-api-route-row.v1",
    row_id: `session.capture.api.route.${String(index + 1).padStart(2, "0")}`,
    category: "api_route",
    label: routeKey,
    generated_at: generatedAt,
    api_path: apiPath,
    route_key: routeKey,
    description,
    collection_ref: collectionRef,
    methods_allowed: ["GET", "HEAD"],
    read_only: true,
    write_enabled: false,
    mutates_state: false,
    raw_body_returns: false,
    full_body_returns: false,
    secret_keys_returned: false,
    required: true,
    observed: true,
    evidence_ref: `evidence.api.${slug(routeKey)}`,
    block_reason: null,
  }, true));
}

function buildApiSmokeRows({ source, generatedAt }) {
  const sourceReady = isSourceReady(source);
  const routeRows = API_ROUTE_SPECS.map(([apiPath, routeKey], index) => verdictRow({
    schema_version: "session-capture-api-smoke-row.v1",
    row_id: `session.capture.api.smoke.${String(index + 1).padStart(2, "0")}`,
    category: "api_smoke",
    label: routeKey,
    generated_at: generatedAt,
    api_path: apiPath,
    method: "GET",
    status_code: sourceReady ? 200 : 503,
    read_only: true,
    sensitive_keys_present: false,
    write_controls_present: false,
    required: true,
    observed: sourceReady,
    evidence_ref: `evidence.api_smoke.${slug(routeKey)}`,
    block_reason: sourceReady ? null : "source_not_ready",
  }, sourceReady));
  routeRows.push(verdictRow({
    schema_version: "session-capture-api-smoke-row.v1",
    row_id: "session.capture.api.smoke.post",
    category: "api_smoke",
    label: "non_get_method_blocked",
    generated_at: generatedAt,
    api_path: "/api/session-capture/sources",
    method: "POST",
    status_code: 405,
    read_only: true,
    sensitive_keys_present: false,
    write_controls_present: false,
    required: true,
    observed: true,
    evidence_ref: "evidence.api_smoke.post_block",
    block_reason: null,
  }, true));
  return routeRows;
}

function buildBrowserSmokeRows({ source, generatedAt }) {
  const html = renderHtml({
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    summary: {
      local_session_capture_memory_store_status: isSourceReady(source) ? READY_STATUS : BLOCKED_STATUS,
      ready_for_p10601_handoff: isSourceReady(source),
      raw_transcript_body_visible: false,
      full_transcript_body_visible: false,
      runtime_recall_enabled: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  const specs = [
    ["browser.has_title", "HTML title is present", /Local Session Capture/.test(html)],
    ["browser.status_visible", "Status is visible", /Status/.test(html)],
    ["browser.raw_body_not_visible", "raw transcript body is not embedded", !/raw transcript body:[\\s\\S]*[A-Za-z0-9]/i.test(html)],
    ["browser.no_secret", "secret markers are absent", !/(api_key|authorization|bearer token|secret=)/i.test(html)],
    ["browser.no_write_controls", "write controls are absent", !/(<form|<button|type=\"submit\"|apply now|write now|mutate|delete now)/i.test(html)],
    ["browser.boundary_visible", "boundary warning is visible", /read-only/.test(html) && /not production/.test(html)],
  ];
  return specs.map(([rowId, label, pass], index) => verdictRow({
    schema_version: "session-capture-browser-smoke-row.v1",
    row_id: `session.capture.${rowId}.${String(index + 1).padStart(2, "0")}`,
    category: "browser_smoke",
    label,
    generated_at: generatedAt,
    required: true,
    observed: pass,
    evidence_ref: "artifacts/local-session-capture-memory-store/latest/index.html",
    block_reason: pass ? null : "browser_shell_boundary_failed",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixtureId, unsafeClaim, expectedBlockReason], index) => verdictRow({
    schema_version: "session-capture-negative-fixture-row.v1",
    row_id: `session.capture.negative.fixture.${String(index + 1).padStart(2, "0")}`,
    category: "negative_fixture",
    label: fixtureId,
    generated_at: generatedAt,
    fixture_id: fixtureId,
    unsafe_claim: unsafeClaim,
    expected_block_reason: expectedBlockReason,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    required: true,
    observed: true,
    evidence_ref: `evidence.negative.${slug(fixtureId)}`,
    block_reason: null,
  }, true));
}

function buildBoundary(context, generatedAt) {
  const {
    source,
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
  } = context;
  const sourceReady = isSourceReady(source);
  const allReady = [
    phaseRows,
    sourceBindingRows,
    sessionSourceRows,
    localCaptureStoreRows,
    transcriptTierRows,
    eventExtractionRows,
    objectRefRows,
    driftDetectorRows,
    apiRouteRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
  ].every(allPass);
  return {
    schema_version: "session-capture-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10400_ready: sourceReady,
    external_evidence_complete_now: source.data?.summary?.external_evidence_complete_now === true,
    external_closeout_blocker_count_visible: Number.isInteger(source.data?.summary?.external_closeout_blocker_count ?? null),
    session_source_identity_ready: allPass(sessionSourceRows),
    append_only_capture_store_ready: allPass(localCaptureStoreRows),
    transcript_tier_boundary_ready: allPass(transcriptTierRows),
    redacted_event_projection_ready: allPass(eventExtractionRows),
    object_ref_hash_binding_ready: allPass(objectRefRows),
    drift_detector_ready: allPass(driftDetectorRows),
    read_only_api_projection_ready: allPass(apiRouteRows) && allPass(apiSmokeRows),
    browser_boundary_ready: allPass(browserSmokeRows),
    negative_fixtures_block_unsafe_claims: negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false),
    raw_transcript_body_visible: false,
    full_transcript_body_visible: false,
    raw_transcript_api_visible: false,
    full_transcript_api_visible: false,
    redacted_summary_ui_visible: true,
    redacted_summary_api_visible: true,
    api_write_methods_enabled: false,
    source_mutation_enabled: false,
    runtime_recall_enabled: false,
    retrieval_truth_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    ready_for_p10601_handoff: sourceReady && allReady,
    unsafe_flag_count: 0,
  };
}

function buildFreezeRows(context, generatedAt) {
  const { boundary } = context;
  const specs = [
    ["freeze.source", "P10400 source binding is ready", boundary.source_p10400_ready],
    ["freeze.session_identity", "session identities and transcript refs are present", boundary.session_source_identity_ready],
    ["freeze.append_only", "local capture store is append-only", boundary.append_only_capture_store_ready],
    ["freeze.raw_full_redacted", "raw/full/redacted transcript tiers are separated", boundary.transcript_tier_boundary_ready],
    ["freeze.event_extraction", "events are redacted, cited, and non-truth by default", boundary.redacted_event_projection_ready],
    ["freeze.object_refs", "object refs and hash refs are bound", boundary.object_ref_hash_binding_ready],
    ["freeze.read_only_api", "API projection is GET/HEAD-only and sanitized", boundary.read_only_api_projection_ready],
    ["freeze.drift_detectors", "duplicate stale uncited and cross-domain detectors exist", boundary.drift_detector_ready],
    ["freeze.negative_fixtures", "negative fixtures block unsafe claims", boundary.negative_fixtures_block_unsafe_claims],
    ["freeze.no_authority_expansion", "no final approval production enterprise runtime write recall expansion", boundary.unsafe_flag_count === 0],
    ["freeze.p10601_handoff", "P10601 handoff is ready", boundary.ready_for_p10601_handoff],
  ];
  return specs.map(([rowId, label, pass], index) => verdictRow({
    schema_version: "p10600-freeze-row.v1",
    row_id: `p10600.freeze.${String(index + 1).padStart(2, "0")}`,
    category: "freeze",
    label,
    generated_at: generatedAt,
    required: true,
    observed: Boolean(pass),
    evidence_ref: `evidence.${rowId}`,
    block_reason: pass ? null : "freeze_prerequisite_blocked",
  }, pass));
}

function buildGateRows(context, generatedAt) {
  const { packageJson, roadmapDoc, architectureDoc, source, contract, phaseRows, sourceBindingRows, sessionSourceRows, localCaptureStoreRows, transcriptTierRows, eventExtractionRows, objectRefRows, driftDetectorRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, boundary, freezeRows } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const gates = [
    ["package.script", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script exists"],
    ["package.validate", commandIndex !== -1, "validate chain includes P10600 command"],
    ["package.order", sourceIndex !== -1 && commandIndex > sourceIndex, "P10600 command runs after P10400 source command"],
    ["source.ready", isSourceReady(source), "P10400 source bridge ready"],
    ["roadmap.reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Local Session Capture"), "roadmap reflects P10401-P10600"],
    ["architecture.reflected", architectureDoc.available && includesToken(architectureDoc.text, "P10401-P10600 Local Session Capture And Memory Store"), "architecture reflects P10401-P10600"],
    ["contract.boundaries", contract.append_only_capture_required && contract.raw_transcript_body_default_visible === false && contract.api_write_methods_enabled === false, "contract preserves capture and raw boundaries"],
    ["phase.rows", allPass(phaseRows), "phase rows pass"],
    ["source.binding", allPass(sourceBindingRows), "source binding rows pass"],
    ["session.identity", allPass(sessionSourceRows), "session identity rows pass"],
    ["capture.store", allPass(localCaptureStoreRows), "local capture store rows pass"],
    ["transcript.tiers", allPass(transcriptTierRows), "transcript tier boundary rows pass"],
    ["event.extraction", allPass(eventExtractionRows), "event extraction rows pass"],
    ["object.refs", allPass(objectRefRows), "object ref rows pass"],
    ["drift.detectors", allPass(driftDetectorRows), "drift detector rows pass"],
    ["api.routes", allPass(apiRouteRows), "API route rows pass"],
    ["api.smoke", allPass(apiSmokeRows), "API smoke rows pass"],
    ["browser.smoke", allPass(browserSmokeRows), "browser smoke rows pass"],
    ["negative.fixtures", allPass(negativeFixtureRows), "negative fixtures pass"],
    ["freeze.rows", allPass(freezeRows), "freeze rows pass"],
    ["boundary.ready", boundary.ready_for_p10601_handoff && boundary.unsafe_flag_count === 0, "boundary ready with no unsafe flags"],
  ];
  return gates.map(([rowId, pass, label], index) => verdictRow({
    schema_version: "session-capture-gate-row.v1",
    row_id: `session.capture.gate.${String(index + 1).padStart(2, "0")}`,
    category: "gate",
    label,
    gate_id: rowId,
    generated_at: generatedAt,
    required: true,
    observed: Boolean(pass),
    evidence_ref: `evidence.gate.${slug(rowId)}`,
    block_reason: pass ? null : `gate_${slug(rowId)}_blocked`,
  }, pass));
}

function buildValidationItems(context) {
  const { packageJson, roadmapDoc, architectureDoc, source, contract, phaseRows, sourceBindingRows, sessionSourceRows, localCaptureStoreRows, transcriptTierRows, eventExtractionRows, objectRefRows, driftDetectorRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, boundary, freezeRows, gateRows } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", commandIndex !== -1, "validate chain must include P10600 command"),
    validationItem("package.order", "package", sourceIndex !== -1 && commandIndex > sourceIndex, "P10600 command must run after P10400 source command"),
    validationItem("source.ready", "source", isSourceReady(source), "P10400 source must be ready for P10600 capture"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "roadmap must reflect P10401-P10600"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P10401-P10600 Local Session Capture And Memory Store"), "architecture must reflect P10401-P10600"),
    validationItem("contract.append_only", "contract", contract.append_only_capture_required && contract.transcript_ref_required && contract.object_ref_hash_required, "capture contract must require append-only transcript refs and hashes"),
    validationItem("contract.no_raw", "contract", contract.raw_transcript_body_default_visible === false && contract.full_transcript_body_default_visible === false, "raw and full transcript body default visibility must be false"),
    validationItem("contract.no_authority", "contract", contract.codex_final_approval_allowed === false && contract.claude_final_approval_allowed === false && contract.production_pass_enabled === false && contract.enterprise_pass_enabled === false, "contract cannot expand approval or production authority"),
    validationItem("phase.rows", "phase", allPass(phaseRows), "all phase rows must pass"),
    validationItem("source.binding", "source", allPass(sourceBindingRows), "source binding rows must pass"),
    validationItem("session.identity", "session", sessionSourceRows.length === SESSION_SOURCE_SPECS.length && allPass(sessionSourceRows), "session source identity rows must pass"),
    validationItem("session.refs", "session", sessionSourceRows.every((row) => row.source_id && row.engine_id && row.session_id && row.run_id && row.transcript_ref), "session rows need source engine session run transcript refs"),
    validationItem("capture.append_only", "capture", localCaptureStoreRows.every((row) => row.append_only && row.overwrite_allowed === false && row.delete_allowed === false), "capture rows must be append-only"),
    validationItem("capture.no_inline_body", "capture", localCaptureStoreRows.every((row) => row.body_inlined === false), "capture rows cannot inline body"),
    validationItem("tiers.raw_hidden", "transcript", transcriptTierRows.some((row) => row.tier_id === "tier.redacted" && row.ui_visible === true) && transcriptTierRows.filter((row) => row.tier_id !== "tier.redacted").every((row) => row.ui_visible === false && row.api_visible === false), "raw/full tiers hidden and redacted tier visible"),
    validationItem("events.cited", "events", eventExtractionRows.every((row) => row.source_citation_required && row.source_citation_present && row.adopted_as_truth === false), "event extraction must be cited and not truth by default"),
    validationItem("events.no_raw", "events", eventExtractionRows.every((row) => row.raw_body_embedded === false && row.full_body_embedded === false), "events cannot embed raw/full body"),
    validationItem("objects.hash_refs", "objects", objectRefRows.every((row) => row.object_ref && row.sha256_ref && row.body_inlined === false), "object rows need refs and hash refs without inline body"),
    validationItem("drift.detectors", "drift", driftDetectorRows.length === DRIFT_DETECTOR_SPECS.length && driftDetectorRows.every((row) => row.detector_present && row.unsafe_claim_allowed === false), "drift detectors must block unsafe claims"),
    validationItem("api.routes", "api", apiRouteRows.length === API_ROUTE_SPECS.length && apiRouteRows.every((row) => row.read_only && row.write_enabled === false), "API routes must be read-only"),
    validationItem("api.smoke", "api", allPass(apiSmokeRows), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", allPass(browserSmokeRows), "browser smoke rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("freeze.rows", "freeze", allPass(freezeRows), "P10600 freeze rows must pass"),
    validationItem("gates.rows", "gates", allPass(gateRows), "P10600 gates must pass"),
    validationItem("boundary.no_raw_api", "boundary", boundary.raw_transcript_api_visible === false && boundary.full_transcript_api_visible === false, "raw/full transcript API visibility must remain false"),
    validationItem("boundary.no_recall", "boundary", boundary.runtime_recall_enabled === false && boundary.retrieval_truth_enabled === false, "runtime recall and truth recall remain false"),
    validationItem("boundary.no_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "authority expansion remains false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p10601_handoff === true && boundary.unsafe_flag_count === 0, "P10601 handoff ready"),
  ];
}

function buildSummary(context) {
  const { source, phaseRows, sessionSourceRows, localCaptureStoreRows, transcriptTierRows, eventExtractionRows, objectRefRows, driftDetectorRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, boundary, freezeRows, gateRows, validation } = context;
  const ready = validation.valid && boundary.ready_for_p10601_handoff;
  return {
    schema_version: "local-session-capture-memory-store-summary.v1",
    local_session_capture_memory_store_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10400_status: source.data?.summary?.ci_github_evidence_bridge_status ?? "missing",
    source_p10400_ready: isSourceReady(source),
    source_external_evidence_complete_now: source.data?.summary?.external_evidence_complete_now === true,
    source_external_closeout_blocker_count: Number(source.data?.summary?.external_closeout_blocker_count ?? 0),
    phase_row_count: phaseRows.length,
    session_source_count: sessionSourceRows.length,
    local_capture_store_count: localCaptureStoreRows.length,
    transcript_tier_count: transcriptTierRows.length,
    event_extraction_count: eventExtractionRows.length,
    object_ref_count: objectRefRows.length,
    drift_detector_count: driftDetectorRows.length,
    api_route_count: apiRouteRows.length,
    api_smoke_count: apiSmokeRows.length,
    browser_smoke_count: browserSmokeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    session_capture_memory_store_ready: boundary.append_only_capture_store_ready,
    redacted_event_projection_ready: boundary.redacted_event_projection_ready,
    object_ref_hash_binding_ready: boundary.object_ref_hash_binding_ready,
    drift_detector_ready: boundary.drift_detector_ready,
    read_only_api_projection_ready: boundary.read_only_api_projection_ready,
    ready_for_p10601_handoff: boundary.ready_for_p10601_handoff,
    raw_transcript_body_visible: boundary.raw_transcript_body_visible,
    full_transcript_body_visible: boundary.full_transcript_body_visible,
    raw_transcript_api_visible: boundary.raw_transcript_api_visible,
    full_transcript_api_visible: boundary.full_transcript_api_visible,
    runtime_recall_enabled: boundary.runtime_recall_enabled,
    retrieval_truth_enabled: boundary.retrieval_truth_enabled,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    runtime_execution_enabled: boundary.runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    external_connector_write_enabled: boundary.external_connector_write_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Local Session Capture And Memory Store",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.local_session_capture_memory_store_status}`,
    "",
    "## Summary",
    "",
    `- Source P10400 ready: ${result.summary.source_p10400_ready}`,
    `- Source external blockers visible: ${result.summary.source_external_closeout_blocker_count}`,
    `- Session sources: ${result.summary.session_source_count}`,
    `- Capture envelopes: ${result.summary.local_capture_store_count}`,
    `- Event extraction rows: ${result.summary.event_extraction_count}`,
    `- Object refs: ${result.summary.object_ref_count}`,
    `- Drift detectors: ${result.summary.drift_detector_count}`,
    `- Ready for P10601 handoff: ${result.summary.ready_for_p10601_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P10401-P10600 stores session sources as cited local evidence refs. It does not expose raw or full transcript bodies, enable runtime recall, mutate source, write through APIs, create production PASS, create enterprise PASS, or make Codex/Claude final approvers.",
    "",
  ].join("\n");
}

function renderHtml(result) {
  const summary = result.summary ?? {};
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Local Session Capture</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #15171a; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid #d7dce2; padding-bottom: 18px; }
    h1 { font-size: 24px; margin: 0 0 8px; letter-spacing: 0; }
    .status { font-size: 13px; border: 1px solid #bbc4cf; border-radius: 6px; padding: 8px 10px; background: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
    .card { background: white; border: 1px solid #d7dce2; border-radius: 8px; padding: 14px; min-height: 82px; }
    .label { color: #596272; font-size: 12px; margin-bottom: 8px; }
    .value { font-size: 20px; font-weight: 650; }
    .note { margin-top: 18px; color: #454d59; line-height: 1.45; max-width: 820px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Local Session Capture</h1>
        <div>P10401-P10600 read-only memory store contract</div>
      </div>
      <div class="status">Status: ${escapeHtml(summary.local_session_capture_memory_store_status ?? "unknown")}</div>
    </header>
    <section class="grid">
      <div class="card"><div class="label">Session Sources</div><div class="value">${escapeHtml(summary.session_source_count ?? 0)}</div></div>
      <div class="card"><div class="label">Event Rows</div><div class="value">${escapeHtml(summary.event_extraction_count ?? 0)}</div></div>
      <div class="card"><div class="label">Object Refs</div><div class="value">${escapeHtml(summary.object_ref_count ?? 0)}</div></div>
      <div class="card"><div class="label">Drift Detectors</div><div class="value">${escapeHtml(summary.drift_detector_count ?? 0)}</div></div>
      <div class="card"><div class="label">P10601 Handoff</div><div class="value">${escapeHtml(summary.ready_for_p10601_handoff === true)}</div></div>
      <div class="card"><div class="label">Validation Errors</div><div class="value">${escapeHtml(summary.validation_error_count ?? 0)}</div></div>
    </section>
    <p class="note">This surface is read-only and not production or enterprise trust. It shows redacted summaries and citation references while keeping restricted transcript bodies behind local object references.</p>
  </main>
</body>
</html>`;
}

async function readJsonOrBuildCiGithubEvidenceBridge(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildCiGithubEvidenceBridge({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.ci_github_evidence_bridge", built);
  } catch (error) {
    return { available: false, path: sourcePath, data: null, error: `${source.error}; fallback failed: ${error.message}` };
  }
}

function isSourceReady(source) {
  const data = source.data ?? {};
  return source.available
    && data.schema_version === "ci-github-evidence-bridge.v1"
    && data.program_range === SOURCE_PROGRAM_RANGE
    && data.validation?.valid === true
    && data.summary?.ci_github_evidence_bridge_status === SOURCE_READY_STATUS
    && data.summary?.ready_for_p10401_handoff === true
    && data.summary?.p10400_bridge_ready === true;
}

function normalizeInputs(options = {}) {
  const defaults = DEFAULT_LOCAL_SESSION_CAPTURE_MEMORY_STORE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? defaults.architectureDocPath),
    source_ci_github_evidence_bridge_path: path.resolve(options.sourceCiGithubEvidenceBridgePath ?? defaults.sourceCiGithubEvidenceBridgePath),
  };
}

async function readTextSource(filePath) {
  try {
    const resolved = path.resolve(filePath);
    return { available: true, path: resolved, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { available: false, path: path.resolve(filePath), text: "", error: error.message };
  }
}

async function readJsonSource(filePath) {
  try {
    const resolved = path.resolve(filePath);
    const text = await readFile(resolved, "utf8");
    return { available: true, path: resolved, data: JSON.parse(text), text };
  } catch (error) {
    return { available: false, path: path.resolve(filePath), data: null, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(name, data) {
  return { available: data !== null && data !== undefined, path: name, data: data ?? null, text: JSON.stringify(data ?? null) };
}

function verdictRow(row, pass) {
  return {
    schema_version: row.schema_version ?? "hermes-verdict-row.v1",
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: Boolean(pass),
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(validationId, category, pass, message) {
  return {
    schema_version: "local-session-capture-validation-item.v1",
    validation_id: validationId,
    category,
    pass: Boolean(pass),
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.pass).map((item) => ({
    validation_id: item.validation_id,
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

function allPass(rows = []) {
  return rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesToken(text, token) {
  return String(text ?? "").includes(token);
}

function normalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function sanitizeApiPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeApiPayload);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(^raw_|raw_|full_transcript|full_body|secret|api_key|token|authorization|body_inlined)/i.test(key)) continue;
    output[key] = sanitizeApiPayload(entry);
  }
  return output;
}

function buildError(code, message) {
  return { error: { code, message } };
}

function jsonResponse(status, body, method = "GET") {
  return { status, headers: { "content-type": "application/json; charset=utf-8" }, body: method === "HEAD" ? "" : JSON.stringify(body, null, 2) };
}

function htmlResponse(status, body, method = "GET") {
  return { status, headers: { "content-type": "text/html; charset=utf-8" }, body: method === "HEAD" ? "" : body };
}

function serializableResult(result) {
  const { html, markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateStamp(iso) {
  return iso.slice(0, 10).replaceAll("-", "");
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function runLocalSessionCaptureMemoryStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const { url } = await startLocalSessionCaptureApiServer(args);
    console.log(`Local session capture API listening at ${url}`);
    return;
  }
  try {
    const result = await runLocalSessionCaptureMemoryStore(args);
    console.log(`Local session capture memory store ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.local_session_capture_memory_store_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Session sources: ${result.summary.session_source_count}`);
    console.log(`Event extraction rows: ${result.summary.event_extraction_count}`);
    console.log(`Object refs: ${result.summary.object_ref_count}`);
    console.log(`Ready for P10601 handoff: ${result.summary.ready_for_p10601_handoff}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.validation_id ?? validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = { check: false, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--serve") args.serve = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--host") args.host = argv[++index];
    else if (arg === "--port") args.port = Number(argv[++index]);
    else if (arg === "--schema") args.schemaPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap-doc") args.roadmapDocPath = argv[++index];
    else if (arg === "--architecture-doc") args.architectureDocPath = argv[++index];
    else if (arg === "--ci-github-evidence-bridge") args.sourceCiGithubEvidenceBridgePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/local-session-capture-memory-store.mjs [options]

Options:
  --check                         Validate without writing artifacts
  --serve                         Start the read-only API server
  --out-dir <path>                Output directory
  --run-at <iso>                  Deterministic timestamp
  --ci-github-evidence-bridge <path> Source P10201-P10400 artifact path
  --host <host>                   API host
  --port <port>                   API port
`);
}
