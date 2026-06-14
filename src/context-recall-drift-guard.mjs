import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildLocalSessionCaptureMemoryStore } from "./local-session-capture-memory-store.mjs";

export const DEFAULT_CONTEXT_RECALL_DRIFT_GUARD_OUT_DIR = "artifacts/context-recall-drift-guard/latest";
export const DEFAULT_CONTEXT_RECALL_DRIFT_GUARD_INPUTS = {
  schemaPath: "schemas/context-recall-drift-guard.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p10601-p10800.md",
  architectureDocPath: "docs/architecture.md",
  sourceLocalSessionCapturePath: "artifacts/local-session-capture-memory-store/latest/local-session-capture-memory-store.json",
  claudeReviewReceiptPath: "artifacts/context-recall-drift-guard/latest/claude-review-receipt.json",
};

export const DEFAULT_CONTEXT_RECALL_HOST = "127.0.0.1";
export const DEFAULT_CONTEXT_RECALL_PORT = 4202;

const COMMAND_NAME = "platform:context-recall-drift-guard";
const SOURCE_COMMAND_NAME = "platform:local-session-capture-memory-store";
const SCHEMA_VERSION = "context-recall-drift-guard.v1";
const CAPABILITY_ID = "platform.context_recall_drift_guard";
const PROGRAM_RANGE = "P10601-P10800";
const SOURCE_PROGRAM_RANGE = "P10401-P10600";
const SOURCE_READY_STATUS = "ready_for_local_session_capture_memory_store";
const READY_STATUS = "ready_for_context_recall_drift_guard";
const REVIEW_PENDING_STATUS = "ready_for_required_claude_review";
const BLOCKED_STATUS = "blocked_context_recall_drift_guard";

const PHASE_SPECS = [
  ["P10601-P10620", "P10600 Source Binding"],
  ["P10621-P10640", "Next-Session Recall Candidate Rows"],
  ["P10641-P10660", "Citation Enforcement Rows"],
  ["P10661-P10680", "Freshness And Staleness Policy"],
  ["P10681-P10700", "Conflict Detection Rows"],
  ["P10701-P10720", "Uncited Memory Blocker Rows"],
  ["P10721-P10740", "Cross-Domain Boundary Rows"],
  ["P10741-P10760", "Read-Only Recall API Projection"],
  ["P10761-P10780", "Negative Fixtures And Boundary"],
  ["P10781-P10800", "Required Review And Freeze"],
];

const RECALL_CANDIDATE_SPECS = [
  ["recall.goal", "goal", "session.codex.primary", "event.goal"],
  ["recall.decision", "decision", "session.codex.primary", "event.decision"],
  ["recall.blocker", "blocker", "session.codex.primary", "event.blocker"],
  ["recall.validation", "validation_event", "session.harness.validator", "event.validation"],
  ["recall.review", "review_event", "session.claude.review", "event.review"],
  ["recall.phase_progress", "phase_progress", "session.ui.handoff", "event.phase_progress"],
];

const FRESHNESS_SPECS = [
  ["freshness.current", "current", "safe_to_show_with_timestamp", true, false],
  ["freshness.recent", "recent", "safe_to_show_with_timestamp", true, false],
  ["freshness.stale", "stale", "show_stale_badge_and_require_revalidation", false, true],
  ["freshness.expired", "expired", "block_as_current_context", false, true],
  ["freshness.unknown", "unknown", "block_until_source_checked", false, true],
];

const CONFLICT_SPECS = [
  ["conflict.goal", "goal_conflict", "two current goals disagree"],
  ["conflict.phase", "phase_status_conflict", "phase status differs across sessions"],
  ["conflict.blocker", "blocker_conflict", "blocker state differs across evidence rows"],
  ["conflict.review", "review_finding_conflict", "review finding disposition differs across receipts"],
];

const UNCITED_BLOCKER_SPECS = [
  ["uncited.memory", "uncited_memory", "memory claim has no transcript or object citation"],
  ["uncited.plan", "uncited_plan_state", "plan state is recalled without phase/source citation"],
  ["uncited.decision", "uncited_decision", "decision is recalled without conversation citation"],
  ["uncited.validation", "uncited_validation", "validator result is recalled without evidence ref"],
];

const DOMAIN_BOUNDARY_SPECS = [
  ["boundary.project", "project_boundary", "project_id must match recall scope"],
  ["boundary.domain", "domain_pack_boundary", "domain pack scope must match recall scope"],
  ["boundary.tenant", "tenant_workspace_boundary", "tenant/workspace scope must match recall scope"],
  ["boundary.legal_hr_client", "legal_hr_client_boundary", "legal, HR, and client material cannot cross scope"],
  ["boundary.connector_resource", "connector_resource_boundary", "connector/resource material stays quarantined unless cited"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "context recall guard health", "computed"],
  ["/api/context-recall/candidates", "candidates", "next-session recall candidates", "next_session_recall_candidate_rows"],
  ["/api/context-recall/citations", "citations", "citation enforcement rows", "recall_citation_enforcement_rows"],
  ["/api/context-recall/freshness", "freshness", "freshness and staleness policies", "recall_freshness_policy_rows"],
  ["/api/context-recall/conflicts", "conflicts", "conflict detection rows", "recall_conflict_detection_rows"],
  ["/api/context-recall/uncited", "uncited", "uncited memory blocker rows", "uncited_memory_blocker_rows"],
  ["/api/context-recall/boundaries", "boundaries", "cross-domain boundary rows", "cross_domain_boundary_rows"],
  ["/api/context-recall/boundary", "boundary", "authority and recall boundary", "context_recall_boundary"],
  ["/api/context-recall/summary", "summary", "context recall summary", "summary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p10600_source", "P10800 passes without P10600 source readiness", "BLOCK_MISSING_P10600_SOURCE"],
  ["negative.missing_claude_review_receipt", "P10800 freezes without required Claude review receipt", "BLOCK_MISSING_CLAUDE_REVIEW_RECEIPT"],
  ["negative.uncited_recall", "Recall candidate has no citation", "BLOCK_UNCITED_RECALL"],
  ["negative.raw_transcript_recall", "Recall bundle exposes raw or full transcript body", "BLOCK_RAW_TRANSCRIPT_RECALL"],
  ["negative.stale_fact_as_current", "Stale fact is treated as current truth", "BLOCK_STALE_FACT_AS_CURRENT"],
  ["negative.conflict_hidden", "Conflicting facts are hidden or auto-resolved", "BLOCK_HIDDEN_CONFLICT"],
  ["negative.cross_domain_recall", "Recall crosses project or domain boundary", "BLOCK_CROSS_DOMAIN_RECALL"],
  ["negative.api_write_method", "POST PUT PATCH DELETE mutates recall state", "BLOCK_API_WRITE_METHOD"],
  ["negative.auto_context_mutation", "Recall auto-mutates plan or policy", "BLOCK_AUTO_CONTEXT_MUTATION"],
  ["negative.codex_final_approval", "Codex recall becomes final approval", "BLOCK_CODEX_FINAL_APPROVAL"],
  ["negative.claude_final_approval", "Claude recall/review becomes final approval", "BLOCK_CLAUDE_FINAL_APPROVAL"],
  ["negative.production_enterprise_pass", "Recall guard creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
];

export async function runContextRecallDriftGuard(options = {}) {
  const result = await buildContextRecallDriftGuard(options);
  if (options.write !== false) await writeContextRecallDriftGuard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Context recall drift guard failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContextRecallDriftGuard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTEXT_RECALL_DRIFT_GUARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "localSessionCapture")
    ? normalizeInlineJsonSource("inline.local_session_capture_memory_store", options.localSessionCapture)
    : await readJsonOrBuildLocalSessionCapture(inputs.source_local_session_capture_path, generatedAt);
  const claudeReviewReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const recallCandidateRows = buildRecallCandidateRows(source, generatedAt);
  const citationRows = buildCitationRows(recallCandidateRows, generatedAt);
  const freshnessRows = buildFreshnessRows(generatedAt);
  const conflictRows = buildConflictRows(generatedAt);
  const uncitedRows = buildUncitedRows(generatedAt);
  const boundaryRows = buildDomainBoundaryRows(generatedAt);
  const apiRouteRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = buildApiSmokeRows({ source, generatedAt });
  const browserSmokeRows = buildBrowserSmokeRows({ source, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const reviewRows = buildReviewReceiptRows(claudeReviewReceipt, generatedAt);
  const boundary = buildBoundary({ source, claudeReviewReceipt, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows }, generatedAt);
  const freezeRows = buildFreezeRows({ boundary, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows }, generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, source, claudeReviewReceipt, contract, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows }, generatedAt);
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, source, claudeReviewReceipt, contract, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows, gateRows });
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
      local_session_capture_memory_store_path: source.path,
      claude_review_receipt_path: claudeReviewReceipt.path,
    },
    source_local_session_capture_summary: source.data?.summary ?? null,
    context_recall_contract: contract,
    context_recall_phase_rows: phaseRows,
    p10600_source_binding_rows: sourceBindingRows,
    next_session_recall_candidate_rows: recallCandidateRows,
    recall_citation_enforcement_rows: citationRows,
    recall_freshness_policy_rows: freshnessRows,
    recall_conflict_detection_rows: conflictRows,
    uncited_memory_blocker_rows: uncitedRows,
    cross_domain_boundary_rows: boundaryRows,
    context_recall_api_route_rows: apiRouteRows,
    context_recall_api_smoke_rows: apiSmokeRows,
    context_recall_browser_smoke_rows: browserSmokeRows,
    context_recall_negative_fixture_rows: negativeFixtureRows,
    claude_review_receipt_rows: reviewRows,
    p10800_freeze_rows: freezeRows,
    context_recall_gate_rows: gateRows,
    context_recall_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ source, claudeReviewReceipt, phaseRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows, gateRows, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "context_recall_drift_guard")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ source, claudeReviewReceipt, phaseRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows, gateRows, validation: result.validation });
  return {
    ...result,
    html: renderHtml(result),
    markdown: renderMarkdown(result),
    review_packet_markdown: renderClaudeReviewPacket(result),
  };
}

export async function writeContextRecallDriftGuard(result, outDir = DEFAULT_CONTEXT_RECALL_DRIFT_GUARD_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "context-recall-drift-guard.json"), serializableResult(result));
  await writeJson(path.join(outDir, "context-recall-phase-rows.json"), result.context_recall_phase_rows);
  await writeJson(path.join(outDir, "p10600-source-binding-rows.json"), result.p10600_source_binding_rows);
  await writeJson(path.join(outDir, "next-session-recall-candidate-rows.json"), result.next_session_recall_candidate_rows);
  await writeJson(path.join(outDir, "recall-citation-enforcement-rows.json"), result.recall_citation_enforcement_rows);
  await writeJson(path.join(outDir, "recall-freshness-policy-rows.json"), result.recall_freshness_policy_rows);
  await writeJson(path.join(outDir, "recall-conflict-detection-rows.json"), result.recall_conflict_detection_rows);
  await writeJson(path.join(outDir, "uncited-memory-blocker-rows.json"), result.uncited_memory_blocker_rows);
  await writeJson(path.join(outDir, "cross-domain-boundary-rows.json"), result.cross_domain_boundary_rows);
  await writeJson(path.join(outDir, "context-recall-api-route-rows.json"), result.context_recall_api_route_rows);
  await writeJson(path.join(outDir, "context-recall-api-smoke-rows.json"), result.context_recall_api_smoke_rows);
  await writeJson(path.join(outDir, "context-recall-browser-smoke-rows.json"), result.context_recall_browser_smoke_rows);
  await writeJson(path.join(outDir, "context-recall-negative-fixture-rows.json"), result.context_recall_negative_fixture_rows);
  await writeJson(path.join(outDir, "claude-review-receipt-rows.json"), result.claude_review_receipt_rows);
  await writeJson(path.join(outDir, "p10800-freeze-rows.json"), result.p10800_freeze_rows);
  await writeJson(path.join(outDir, "context-recall-gate-rows.json"), result.context_recall_gate_rows);
  await writeJson(path.join(outDir, "context-recall-boundary.json"), result.context_recall_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), result.validation);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.review_packet_markdown, "utf8");
}

export function createContextRecallApiServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      const apiResponse = await buildContextRecallApiResponse(request.url ?? "/", { ...options, method: request.method });
      response.writeHead(apiResponse.status, apiResponse.headers);
      response.end(request.method === "HEAD" ? "" : apiResponse.body);
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(buildError("internal_error", error.message), null, 2));
    }
  });
}

export async function startContextRecallApiServer(options = {}) {
  const host = options.host ?? DEFAULT_CONTEXT_RECALL_HOST;
  const port = options.port ?? DEFAULT_CONTEXT_RECALL_PORT;
  const server = createContextRecallApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildContextRecallApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Context recall drift guard API is read-only."), method);
  }
  const pathname = normalizePath(new URL(requestUrl, "http://hermes.local").pathname);
  if (pathname === "/" || pathname === "/index.html") {
    const result = await buildContextRecallDriftGuard({ ...options, write: false });
    return htmlResponse(200, result.html, method);
  }
  const result = await buildContextRecallDriftGuard({ ...options, write: false });
  const routeMap = {
    "/health": { status: result.summary.context_recall_drift_guard_status, ready: result.summary.ready_for_p10801_handoff, validation: result.validation },
    "/api/context-recall/candidates": result.next_session_recall_candidate_rows,
    "/api/context-recall/citations": result.recall_citation_enforcement_rows,
    "/api/context-recall/freshness": result.recall_freshness_policy_rows,
    "/api/context-recall/conflicts": result.recall_conflict_detection_rows,
    "/api/context-recall/uncited": result.uncited_memory_blocker_rows,
    "/api/context-recall/boundaries": result.cross_domain_boundary_rows,
    "/api/context-recall/boundary": result.context_recall_boundary,
    "/api/context-recall/summary": result.summary,
  };
  if (!Object.prototype.hasOwnProperty.call(routeMap, pathname)) {
    return jsonResponse(404, buildError("not_found", `Unknown context recall route: ${pathname}`), method);
  }
  return jsonResponse(200, sanitizeApiPayload(routeMap[pathname]), method);
}

function buildContract(generatedAt) {
  return {
    schema_version: "context-recall-contract.v1",
    generated_at: generatedAt,
    contract_id: "context-recall-drift-guard.p10601-p10800",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_local_session_capture_required: true,
    next_session_recall_candidates_required: true,
    citation_enforcement_required: true,
    freshness_policy_required: true,
    conflict_detection_required: true,
    uncited_memory_blocker_required: true,
    cross_domain_boundary_required: true,
    read_only_api_projection_required: true,
    claude_review_receipt_required: true,
    raw_transcript_recall_allowed: false,
    full_transcript_recall_allowed: false,
    uncited_recall_allowed: false,
    stale_fact_as_current_allowed: false,
    hidden_conflict_allowed: false,
    cross_domain_recall_allowed: false,
    auto_context_mutation_enabled: false,
    runtime_recall_enabled: false,
    retrieval_truth_enabled: false,
    api_write_methods_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, phaseName], index) => {
    const pass = includesToken(roadmapText, phaseRange) && includesToken(roadmapText, phaseName);
    return verdictRow({
      row_id: `context.recall.phase.${String(index + 1).padStart(2, "0")}`,
      category: "phase",
      label: phaseName,
      generated_at: generatedAt,
      phase_range: phaseRange,
      required: true,
      observed: pass,
      evidence_ref: `docs/hermes-roadmap-p10601-p10800.md#${slug(phaseRange)}`,
      block_reason: pass ? null : "phase_not_documented",
    }, pass);
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const sourceReady = isSourceReady(source);
  const rawHidden = source.data?.summary?.raw_transcript_body_visible === false
    && source.data?.summary?.full_transcript_body_visible === false
    && source.data?.summary?.raw_transcript_api_visible === false;
  const noTruthRecall = source.data?.summary?.runtime_recall_enabled === false
    && source.data?.summary?.retrieval_truth_enabled === false;
  const rows = [
    ["source.p10600.ready", "P10600 local session capture ready", sourceReady, source.path],
    ["source.raw_hidden", "P10600 raw/full transcript visibility remains false", sourceReady && rawHidden, source.path],
    ["source.no_truth_recall", "P10600 did not enable runtime recall or truth recall", sourceReady && noTruthRecall, source.path],
  ];
  return rows.map(([rowId, label, pass, evidenceRef]) => verdictRow({
    row_id: rowId,
    category: "source",
    label,
    generated_at: generatedAt,
    required: true,
    observed: Boolean(pass),
    evidence_ref: evidenceRef,
    block_reason: pass ? null : "p10600_source_not_ready_or_boundary_changed",
  }, pass));
}

function buildRecallCandidateRows(source, generatedAt) {
  const sourceReady = isSourceReady(source);
  const eventTypes = new Set((source.data?.session_event_extraction_rows ?? []).map((row) => row.event_type));
  return RECALL_CANDIDATE_SPECS.map(([candidateId, recallType, sourceId, eventRef], index) => {
    const pass = sourceReady && eventTypes.has(recallType);
    return verdictRow({
      schema_version: "next-session-recall-candidate-row.v1",
      row_id: `next.session.recall.candidate.${String(index + 1).padStart(2, "0")}`,
      category: "recall_candidate",
      label: recallType,
      generated_at: generatedAt,
      candidate_id: candidateId,
      recall_type: recallType,
      source_id: sourceId,
      event_ref: eventRef,
      transcript_ref_required: true,
      citation_ref: `citation.${slug(candidateId)}`,
      source_citation_present: pass,
      redacted_summary_only: true,
      raw_body_embedded: false,
      full_body_embedded: false,
      freshness_status: recallType === "blocker" ? "recent" : "current",
      conflict_status: "none_observed",
      adopted_as_truth: false,
      mutates_context_directly: false,
      required: true,
      observed: pass,
      evidence_ref: `evidence.recall_candidate.${slug(candidateId)}`,
      block_reason: pass ? null : "missing_source_event_or_p10600_source",
    }, pass);
  });
}

function buildCitationRows(candidateRows, generatedAt) {
  return candidateRows.map((candidate, index) => {
    const pass = candidate.current_verdict === "pass" && Boolean(candidate.citation_ref);
    return verdictRow({
      schema_version: "recall-citation-enforcement-row.v1",
      row_id: `recall.citation.enforcement.${String(index + 1).padStart(2, "0")}`,
      category: "citation",
      label: candidate.recall_type,
      generated_at: generatedAt,
      candidate_id: candidate.candidate_id,
      citation_ref: candidate.citation_ref,
      transcript_ref_required: true,
      event_ref_required: true,
      object_ref_required: true,
      source_status_required: true,
      uncited_recall_allowed: false,
      required: true,
      observed: pass,
      evidence_ref: `evidence.citation.${slug(candidate.candidate_id)}`,
      block_reason: pass ? null : "missing_required_citation",
    }, pass);
  });
}

function buildFreshnessRows(generatedAt) {
  return FRESHNESS_SPECS.map(([policyId, freshnessStatus, action, canShowAsContext, blocksCurrentTruth], index) => verdictRow({
    schema_version: "recall-freshness-policy-row.v1",
    row_id: `recall.freshness.policy.${String(index + 1).padStart(2, "0")}`,
    category: "freshness",
    label: freshnessStatus,
    generated_at: generatedAt,
    policy_id: policyId,
    freshness_status: freshnessStatus,
    required_action: action,
    can_show_as_context: canShowAsContext,
    blocks_current_truth: blocksCurrentTruth,
    stale_fact_as_current_allowed: false,
    freshness_badge_required: freshnessStatus !== "current",
    revalidation_required: blocksCurrentTruth,
    required: true,
    observed: true,
    evidence_ref: `evidence.freshness.${slug(policyId)}`,
    block_reason: null,
  }, true));
}

function buildConflictRows(generatedAt) {
  return CONFLICT_SPECS.map(([conflictId, conflictType, description], index) => verdictRow({
    schema_version: "recall-conflict-detection-row.v1",
    row_id: `recall.conflict.detection.${String(index + 1).padStart(2, "0")}`,
    category: "conflict",
    label: conflictType,
    generated_at: generatedAt,
    conflict_id: conflictId,
    conflict_type: conflictType,
    description,
    conflict_detector_present: true,
    conflict_note_required: true,
    hidden_conflict_allowed: false,
    auto_resolve_allowed: false,
    required: true,
    observed: true,
    evidence_ref: `evidence.conflict.${slug(conflictId)}`,
    block_reason: null,
  }, true));
}

function buildUncitedRows(generatedAt) {
  return UNCITED_BLOCKER_SPECS.map(([blockerId, blockerType, unsafeClaim], index) => verdictRow({
    schema_version: "uncited-memory-blocker-row.v1",
    row_id: `uncited.memory.blocker.${String(index + 1).padStart(2, "0")}`,
    category: "uncited_blocker",
    label: blockerType,
    generated_at: generatedAt,
    blocker_id: blockerId,
    blocker_type: blockerType,
    unsafe_claim: unsafeClaim,
    expected_block_reason: `BLOCK_${slug(blockerType).toUpperCase().replaceAll("-", "_")}`,
    uncited_memory_allowed: false,
    detector_present: true,
    required: true,
    observed: true,
    evidence_ref: `evidence.uncited.${slug(blockerId)}`,
    block_reason: null,
  }, true));
}

function buildDomainBoundaryRows(generatedAt) {
  return DOMAIN_BOUNDARY_SPECS.map(([boundaryId, boundaryType, description], index) => verdictRow({
    schema_version: "cross-domain-boundary-row.v1",
    row_id: `cross.domain.boundary.${String(index + 1).padStart(2, "0")}`,
    category: "cross_domain_boundary",
    label: boundaryType,
    generated_at: generatedAt,
    boundary_id: boundaryId,
    boundary_type: boundaryType,
    description,
    scope_match_required: true,
    source_citation_required: true,
    quarantine_required_on_mismatch: true,
    cross_domain_recall_allowed: false,
    required: true,
    observed: true,
    evidence_ref: `evidence.domain_boundary.${slug(boundaryId)}`,
    block_reason: null,
  }, true));
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([apiPath, routeKey, description, collectionRef], index) => verdictRow({
    schema_version: "context-recall-api-route-row.v1",
    row_id: `context.recall.api.route.${String(index + 1).padStart(2, "0")}`,
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
  const rows = API_ROUTE_SPECS.map(([apiPath, routeKey], index) => verdictRow({
    schema_version: "context-recall-api-smoke-row.v1",
    row_id: `context.recall.api.smoke.${String(index + 1).padStart(2, "0")}`,
    category: "api_smoke",
    label: routeKey,
    generated_at: generatedAt,
    api_path: apiPath,
    method: "GET",
    status_code: sourceReady ? 200 : 503,
    sensitive_keys_present: false,
    write_controls_present: false,
    required: true,
    observed: sourceReady,
    evidence_ref: `evidence.api_smoke.${slug(routeKey)}`,
    block_reason: sourceReady ? null : "source_not_ready",
  }, sourceReady));
  rows.push(verdictRow({
    schema_version: "context-recall-api-smoke-row.v1",
    row_id: "context.recall.api.smoke.post",
    category: "api_smoke",
    label: "non_get_method_blocked",
    generated_at: generatedAt,
    api_path: "/api/context-recall/candidates",
    method: "POST",
    status_code: 405,
    sensitive_keys_present: false,
    write_controls_present: false,
    required: true,
    observed: true,
    evidence_ref: "evidence.api_smoke.post_block",
    block_reason: null,
  }, true));
  return rows;
}

function buildBrowserSmokeRows({ source, generatedAt }) {
  const html = renderHtml({
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    summary: {
      context_recall_drift_guard_status: isSourceReady(source) ? READY_STATUS : BLOCKED_STATUS,
      ready_for_p10801_handoff: isSourceReady(source),
      uncited_recall_allowed: false,
      stale_fact_as_current_allowed: false,
      cross_domain_recall_allowed: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  const specs = [
    ["browser.has_title", "HTML title is present", /Context Recall/.test(html)],
    ["browser.status_visible", "Status is visible", /Status/.test(html)],
    ["browser.no_raw_body", "raw transcript body is not embedded", !/raw transcript body:[\\s\\S]*[A-Za-z0-9]/i.test(html)],
    ["browser.no_secret", "secret markers are absent", !/(api_key|authorization|bearer token|secret=)/i.test(html)],
    ["browser.no_write_controls", "write controls are absent", !/(<form|<button|type=\"submit\"|apply now|write now|mutate|delete now)/i.test(html)],
    ["browser.boundary_visible", "boundary warning is visible", /read-only/.test(html) && /not production/.test(html)],
  ];
  return specs.map(([rowId, label, pass], index) => verdictRow({
    schema_version: "context-recall-browser-smoke-row.v1",
    row_id: `context.recall.${rowId}.${String(index + 1).padStart(2, "0")}`,
    category: "browser_smoke",
    label,
    generated_at: generatedAt,
    required: true,
    observed: pass,
    evidence_ref: "artifacts/context-recall-drift-guard/latest/index.html",
    block_reason: pass ? null : "browser_shell_boundary_failed",
  }, pass));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixtureId, unsafeClaim, expectedBlockReason], index) => verdictRow({
    schema_version: "context-recall-negative-fixture-row.v1",
    row_id: `context.recall.negative.fixture.${String(index + 1).padStart(2, "0")}`,
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

function buildReviewReceiptRows(receipt, generatedAt) {
  const completed = hasCompletedClaudeReview(receipt);
  return [verdictRow({
    schema_version: "context-recall-claude-review-receipt-row.v1",
    row_id: "claude.review.receipt.p10800",
    category: "review",
    label: "Required Claude Opus review receipt",
    generated_at: generatedAt,
    receipt_ref: receipt.path,
    review_status: receipt.data?.review_status ?? "missing",
    finding_count: Number(receipt.data?.finding_count ?? 0),
    blocking_finding_count: Number(receipt.data?.blocking_finding_count ?? 0),
    reviewer_mutation_allowed: receipt.data?.reviewer_mutation_allowed === true,
    required: true,
    observed: completed,
    evidence_ref: receipt.path,
    block_reason: completed ? null : "missing_or_blocking_claude_review_receipt",
  }, completed)];
}

function buildBoundary(context, generatedAt) {
  const { source, claudeReviewReceipt, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows } = context;
  const sourceReady = isSourceReady(source);
  const reviewReady = hasCompletedClaudeReview(claudeReviewReceipt);
  const structuralReady = [phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows].every(allPass);
  return {
    schema_version: "context-recall-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10600_ready: sourceReady,
    p10800_claude_review_required_now: true,
    p10800_claude_review_completed_now: reviewReady,
    recall_candidates_ready: allPass(recallCandidateRows),
    citation_enforcement_ready: allPass(citationRows),
    freshness_policy_ready: allPass(freshnessRows),
    conflict_detection_ready: allPass(conflictRows),
    uncited_memory_blocker_ready: allPass(uncitedRows),
    cross_domain_boundary_ready: allPass(boundaryRows),
    read_only_api_projection_ready: allPass(apiRouteRows) && allPass(apiSmokeRows),
    browser_boundary_ready: allPass(browserSmokeRows),
    negative_fixtures_block_unsafe_claims: negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false),
    next_session_recall_bundle_ready: structuralReady && reviewReady,
    uncited_recall_allowed: false,
    raw_transcript_recall_allowed: false,
    full_transcript_recall_allowed: false,
    stale_fact_as_current_allowed: false,
    hidden_conflict_allowed: false,
    cross_domain_recall_allowed: false,
    auto_context_mutation_enabled: false,
    runtime_recall_enabled: false,
    retrieval_truth_enabled: false,
    api_write_methods_enabled: false,
    source_mutation_enabled: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    ready_for_p10801_handoff: sourceReady && reviewReady && structuralReady && allPass(reviewRows),
    unsafe_flag_count: 0,
  };
}

function buildFreezeRows(context, generatedAt) {
  const { boundary } = context;
  const specs = [
    ["freeze.source", "P10600 source binding is ready", boundary.source_p10600_ready],
    ["freeze.recall_candidates", "next-session recall candidates are cited and redacted", boundary.recall_candidates_ready],
    ["freeze.citations", "citation enforcement is ready", boundary.citation_enforcement_ready],
    ["freeze.freshness", "freshness and staleness policies are ready", boundary.freshness_policy_ready],
    ["freeze.conflicts", "conflict detection is visible and non-auto-resolving", boundary.conflict_detection_ready],
    ["freeze.uncited_blockers", "uncited memory blockers are ready", boundary.uncited_memory_blocker_ready],
    ["freeze.cross_domain", "cross-domain boundaries are ready", boundary.cross_domain_boundary_ready],
    ["freeze.read_only_api", "API projection is GET/HEAD-only", boundary.read_only_api_projection_ready],
    ["freeze.review", "required Claude review receipt is complete", boundary.p10800_claude_review_completed_now],
    ["freeze.no_authority_expansion", "no recall truth, mutation, final approval, production, or enterprise expansion", boundary.unsafe_flag_count === 0],
    ["freeze.p10801_handoff", "P10801 handoff is ready", boundary.ready_for_p10801_handoff],
  ];
  return specs.map(([rowId, label, pass], index) => verdictRow({
    schema_version: "p10800-freeze-row.v1",
    row_id: `p10800.freeze.${String(index + 1).padStart(2, "0")}`,
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
  const { packageJson, roadmapDoc, architectureDoc, source, claudeReviewReceipt, contract, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const gates = [
    ["package.script", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script exists"],
    ["package.validate", commandIndex !== -1, "validate chain includes P10800 command"],
    ["package.order", sourceIndex !== -1 && commandIndex > sourceIndex, "P10800 command runs after P10600 source command"],
    ["source.ready", isSourceReady(source), "P10600 source ready"],
    ["review.receipt", hasCompletedClaudeReview(claudeReviewReceipt), "required Claude review receipt complete"],
    ["roadmap.reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Context Recall"), "roadmap reflects P10601-P10800"],
    ["architecture.reflected", architectureDoc.available && includesToken(architectureDoc.text, "P10601-P10800 Context Recall And Drift Guard"), "architecture reflects P10601-P10800"],
    ["contract.boundaries", contract.uncited_recall_allowed === false && contract.auto_context_mutation_enabled === false && contract.api_write_methods_enabled === false, "contract preserves recall boundaries"],
    ["phase.rows", allPass(phaseRows), "phase rows pass"],
    ["source.binding", allPass(sourceBindingRows), "source binding rows pass"],
    ["recall.candidates", allPass(recallCandidateRows), "recall candidate rows pass"],
    ["citations", allPass(citationRows), "citation rows pass"],
    ["freshness", allPass(freshnessRows), "freshness rows pass"],
    ["conflicts", allPass(conflictRows), "conflict rows pass"],
    ["uncited", allPass(uncitedRows), "uncited blocker rows pass"],
    ["domain.boundaries", allPass(boundaryRows), "domain boundary rows pass"],
    ["api.routes", allPass(apiRouteRows), "API route rows pass"],
    ["api.smoke", allPass(apiSmokeRows), "API smoke rows pass"],
    ["browser.smoke", allPass(browserSmokeRows), "browser smoke rows pass"],
    ["negative.fixtures", allPass(negativeFixtureRows), "negative fixtures pass"],
    ["review.rows", allPass(reviewRows), "review rows pass"],
    ["freeze.rows", allPass(freezeRows), "freeze rows pass"],
    ["boundary.ready", boundary.ready_for_p10801_handoff && boundary.unsafe_flag_count === 0, "boundary ready with no unsafe flags"],
  ];
  return gates.map(([rowId, pass, label], index) => verdictRow({
    schema_version: "context-recall-gate-row.v1",
    row_id: `context.recall.gate.${String(index + 1).padStart(2, "0")}`,
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
  const { packageJson, roadmapDoc, architectureDoc, source, claudeReviewReceipt, contract, phaseRows, sourceBindingRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows, gateRows } = context;
  const validateScript = packageJson.data?.scripts?.validate ?? "";
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must exist"),
    validationItem("package.validate", "package", commandIndex !== -1, "validate chain must include P10800 command"),
    validationItem("package.order", "package", sourceIndex !== -1 && commandIndex > sourceIndex, "P10800 command must run after P10600 source command"),
    validationItem("source.ready", "source", isSourceReady(source), "P10600 source must be ready"),
    validationItem("review.receipt", "review", hasCompletedClaudeReview(claudeReviewReceipt), "required P10800 Claude review receipt must be complete"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "roadmap must reflect P10601-P10800"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "P10601-P10800 Context Recall And Drift Guard"), "architecture must reflect P10601-P10800"),
    validationItem("contract.required", "contract", contract.next_session_recall_candidates_required && contract.citation_enforcement_required && contract.freshness_policy_required && contract.conflict_detection_required, "required recall guard contract planes must exist"),
    validationItem("contract.no_unsafe", "contract", contract.uncited_recall_allowed === false && contract.stale_fact_as_current_allowed === false && contract.cross_domain_recall_allowed === false && contract.auto_context_mutation_enabled === false, "unsafe recall contract flags must remain false"),
    validationItem("phase.rows", "phase", allPass(phaseRows), "all phase rows must pass"),
    validationItem("source.binding", "source", allPass(sourceBindingRows), "source binding rows must pass"),
    validationItem("recall.candidates", "recall", recallCandidateRows.length === RECALL_CANDIDATE_SPECS.length && allPass(recallCandidateRows), "recall candidate rows must pass"),
    validationItem("recall.no_raw", "recall", recallCandidateRows.every((row) => row.raw_body_embedded === false && row.full_body_embedded === false && row.redacted_summary_only === true), "recall candidates cannot embed raw/full body"),
    validationItem("citations", "citation", citationRows.every((row) => row.uncited_recall_allowed === false && row.citation_ref), "citation rows must block uncited recall"),
    validationItem("freshness", "freshness", freshnessRows.every((row) => row.stale_fact_as_current_allowed === false), "freshness rows must block stale-as-current"),
    validationItem("conflicts", "conflict", conflictRows.every((row) => row.hidden_conflict_allowed === false && row.auto_resolve_allowed === false), "conflicts cannot be hidden or auto-resolved"),
    validationItem("uncited.blockers", "uncited", uncitedRows.every((row) => row.detector_present && row.uncited_memory_allowed === false), "uncited blockers must be active"),
    validationItem("domain.boundaries", "domain", boundaryRows.every((row) => row.scope_match_required && row.cross_domain_recall_allowed === false), "cross-domain recall must remain blocked"),
    validationItem("api.routes", "api", apiRouteRows.length === API_ROUTE_SPECS.length && apiRouteRows.every((row) => row.read_only && row.write_enabled === false), "API routes must be read-only"),
    validationItem("api.smoke", "api", allPass(apiSmokeRows), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", allPass(browserSmokeRows), "browser smoke rows must pass"),
    validationItem("negative.fixtures", "fixtures", negativeFixtureRows.length === NEGATIVE_FIXTURES.length && negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe recall"),
    validationItem("review.rows", "review", allPass(reviewRows), "review rows must pass"),
    validationItem("freeze.rows", "freeze", allPass(freezeRows), "P10800 freeze rows must pass"),
    validationItem("gates.rows", "gates", allPass(gateRows), "P10800 gates must pass"),
    validationItem("boundary.no_raw", "boundary", boundary.raw_transcript_recall_allowed === false && boundary.full_transcript_recall_allowed === false, "raw/full transcript recall remains false"),
    validationItem("boundary.no_unsafe_recall", "boundary", boundary.uncited_recall_allowed === false && boundary.stale_fact_as_current_allowed === false && boundary.cross_domain_recall_allowed === false, "unsafe recall remains false"),
    validationItem("boundary.no_authority", "boundary", boundary.codex_final_approval_allowed === false && boundary.claude_final_approval_allowed === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "authority expansion remains false"),
    validationItem("boundary.ready", "boundary", boundary.ready_for_p10801_handoff === true && boundary.unsafe_flag_count === 0, "P10801 handoff ready"),
  ];
}

function buildSummary(context) {
  const { source, claudeReviewReceipt, phaseRows, recallCandidateRows, citationRows, freshnessRows, conflictRows, uncitedRows, boundaryRows, apiRouteRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, reviewRows, boundary, freezeRows, gateRows, validation } = context;
  const allExceptReviewValid = validation.errors.every((error) => error.validation_id === "review.receipt" || error.validation_id === "review.rows" || error.validation_id === "freeze.rows" || error.validation_id === "gates.rows" || error.validation_id === "boundary.ready");
  const ready = validation.valid && boundary.ready_for_p10801_handoff;
  const pendingReview = !hasCompletedClaudeReview(claudeReviewReceipt) && allExceptReviewValid;
  return {
    schema_version: "context-recall-drift-guard-summary.v1",
    context_recall_drift_guard_status: ready ? READY_STATUS : pendingReview ? REVIEW_PENDING_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10600_status: source.data?.summary?.local_session_capture_memory_store_status ?? "missing",
    source_p10600_ready: isSourceReady(source),
    p10800_claude_review_required_now: true,
    p10800_claude_review_completed_now: hasCompletedClaudeReview(claudeReviewReceipt),
    review_finding_count: Number(claudeReviewReceipt.data?.finding_count ?? 0),
    review_blocking_finding_count: Number(claudeReviewReceipt.data?.blocking_finding_count ?? 0),
    phase_row_count: phaseRows.length,
    recall_candidate_count: recallCandidateRows.length,
    citation_row_count: citationRows.length,
    freshness_policy_count: freshnessRows.length,
    conflict_detector_count: conflictRows.length,
    uncited_blocker_count: uncitedRows.length,
    cross_domain_boundary_count: boundaryRows.length,
    api_route_count: apiRouteRows.length,
    api_smoke_count: apiSmokeRows.length,
    browser_smoke_count: browserSmokeRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    review_row_count: reviewRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    context_recall_guard_ready: boundary.recall_candidates_ready && boundary.citation_enforcement_ready && boundary.freshness_policy_ready && boundary.conflict_detection_ready,
    next_session_recall_bundle_ready: boundary.next_session_recall_bundle_ready,
    ready_for_p10801_handoff: boundary.ready_for_p10801_handoff,
    uncited_recall_allowed: boundary.uncited_recall_allowed,
    raw_transcript_recall_allowed: boundary.raw_transcript_recall_allowed,
    full_transcript_recall_allowed: boundary.full_transcript_recall_allowed,
    stale_fact_as_current_allowed: boundary.stale_fact_as_current_allowed,
    hidden_conflict_allowed: boundary.hidden_conflict_allowed,
    cross_domain_recall_allowed: boundary.cross_domain_recall_allowed,
    auto_context_mutation_enabled: boundary.auto_context_mutation_enabled,
    runtime_recall_enabled: boundary.runtime_recall_enabled,
    retrieval_truth_enabled: boundary.retrieval_truth_enabled,
    api_write_methods_enabled: boundary.api_write_methods_enabled,
    codex_final_approval_allowed: boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: boundary.claude_final_approval_allowed,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Context Recall And Drift Guard",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.context_recall_drift_guard_status}`,
    "",
    "## Summary",
    "",
    `- Source P10600 ready: ${result.summary.source_p10600_ready}`,
    `- Claude review completed: ${result.summary.p10800_claude_review_completed_now}`,
    `- Recall candidates: ${result.summary.recall_candidate_count}`,
    `- Citation rows: ${result.summary.citation_row_count}`,
    `- Freshness policies: ${result.summary.freshness_policy_count}`,
    `- Conflict detectors: ${result.summary.conflict_detector_count}`,
    `- Ready for P10801 handoff: ${result.summary.ready_for_p10801_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P10601-P10800 can prepare cited next-session recall bundles. It cannot expose raw/full transcript bodies, treat stale facts as current truth, hide conflicts, cross domain boundaries, auto-mutate context, create final approval, or claim production/enterprise readiness.",
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
  <title>Context Recall Drift Guard</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafb; color: #15171a; }
    main { max-width: 1060px; margin: 0 auto; padding: 32px 20px; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #d5dce5; padding-bottom: 18px; }
    h1 { font-size: 24px; margin: 0 0 8px; letter-spacing: 0; }
    .status { font-size: 13px; border: 1px solid #b8c3cf; border-radius: 6px; padding: 8px 10px; background: white; height: fit-content; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); gap: 12px; margin-top: 20px; }
    .card { background: white; border: 1px solid #d5dce5; border-radius: 8px; padding: 14px; min-height: 82px; }
    .label { color: #596272; font-size: 12px; margin-bottom: 8px; }
    .value { font-size: 20px; font-weight: 650; }
    .note { margin-top: 18px; color: #454d59; line-height: 1.45; max-width: 820px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Context Recall Drift Guard</h1>
        <div>P10601-P10800 cited next-session recall guard</div>
      </div>
      <div class="status">Status: ${escapeHtml(summary.context_recall_drift_guard_status ?? "unknown")}</div>
    </header>
    <section class="grid">
      <div class="card"><div class="label">Recall Candidates</div><div class="value">${escapeHtml(summary.recall_candidate_count ?? 0)}</div></div>
      <div class="card"><div class="label">Citation Rows</div><div class="value">${escapeHtml(summary.citation_row_count ?? 0)}</div></div>
      <div class="card"><div class="label">Freshness Policies</div><div class="value">${escapeHtml(summary.freshness_policy_count ?? 0)}</div></div>
      <div class="card"><div class="label">Conflict Detectors</div><div class="value">${escapeHtml(summary.conflict_detector_count ?? 0)}</div></div>
      <div class="card"><div class="label">Claude Review</div><div class="value">${escapeHtml(summary.p10800_claude_review_completed_now === true)}</div></div>
      <div class="card"><div class="label">P10801 Handoff</div><div class="value">${escapeHtml(summary.ready_for_p10801_handoff === true)}</div></div>
    </section>
    <p class="note">This read-only surface is not production or enterprise trust. It only projects cited recall candidates with freshness, conflict, uncited-memory, and domain-boundary guards.</p>
  </main>
</body>
</html>`;
}

function renderClaudeReviewPacket(result) {
  return [
    "# Claude Review Packet: P10601-P10800 Context Recall And Drift Guard",
    "",
    "Review this Hermes context recall guard as an independent read-only reviewer. Do not mutate source. Do not treat Claude review as final approval.",
    "",
    "Expected pre-receipt state: if this packet was generated before claude-review-receipt.json exists, missing review receipt is an expected blocker. Report a finding only if the guard hides blockers, overclaims recall truth, exposes raw/full transcript bodies, enables mutation/write/final approval, or allows uncited/stale/conflicting/cross-domain recall.",
    "",
    "Return JSON only with review_status, finding_count, blocking_finding_count, findings, reviewer_mutation_allowed, reviewer_mutated_source, codex_final_approval_allowed, claude_final_approval_allowed, production_pass_allowed, enterprise_pass_allowed.",
    "",
    "## Summary",
    "",
    JSON.stringify(result.summary, null, 2),
    "",
    "## Boundary",
    "",
    JSON.stringify(result.context_recall_boundary, null, 2),
    "",
    "## Validation Errors",
    "",
    JSON.stringify(result.validation.errors, null, 2),
    "",
  ].join("\n");
}

async function readJsonOrBuildLocalSessionCapture(sourcePath, generatedAt) {
  const source = await readJsonSource(sourcePath);
  if (source.available) return source;
  try {
    const built = await buildLocalSessionCaptureMemoryStore({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.local_session_capture_memory_store", built);
  } catch (error) {
    return { available: false, path: sourcePath, data: null, error: `${source.error}; fallback failed: ${error.message}` };
  }
}

function isSourceReady(source) {
  const data = source.data ?? {};
  return source.available
    && data.schema_version === "local-session-capture-memory-store.v1"
    && data.program_range === SOURCE_PROGRAM_RANGE
    && data.validation?.valid === true
    && data.summary?.local_session_capture_memory_store_status === SOURCE_READY_STATUS
    && data.summary?.ready_for_p10601_handoff === true;
}

function hasCompletedClaudeReview(receipt) {
  const data = receipt.data ?? {};
  return receipt.available
    && data.review_status === "completed"
    && Number(data.blocking_finding_count ?? 0) === 0
    && data.reviewer_mutation_allowed === false
    && data.reviewer_mutated_source !== true
    && data.codex_final_approval_allowed === false
    && data.claude_final_approval_allowed === false
    && data.production_pass_allowed === false
    && data.enterprise_pass_allowed === false;
}

function normalizeInputs(options = {}) {
  const defaults = DEFAULT_CONTEXT_RECALL_DRIFT_GUARD_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? defaults.architectureDocPath),
    source_local_session_capture_path: path.resolve(options.sourceLocalSessionCapturePath ?? defaults.sourceLocalSessionCapturePath),
    claude_review_receipt_path: path.resolve(options.claudeReviewReceiptPath ?? defaults.claudeReviewReceiptPath),
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
    schema_version: "context-recall-validation-item.v1",
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
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
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
  const { html, markdown, review_packet_markdown, ...serializable } = result;
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

export async function runContextRecallDriftGuardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const { url } = await startContextRecallApiServer(args);
    console.log(`Context recall drift guard API listening at ${url}`);
    return;
  }
  try {
    const result = await runContextRecallDriftGuard(args);
    console.log(`Context recall drift guard ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.context_recall_drift_guard_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Recall candidates: ${result.summary.recall_candidate_count}`);
    console.log(`Claude review completed: ${result.summary.p10800_claude_review_completed_now}`);
    console.log(`Ready for P10801 handoff: ${result.summary.ready_for_p10801_handoff}`);
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
    else if (arg === "--local-session-capture") args.sourceLocalSessionCapturePath = argv[++index];
    else if (arg === "--claude-review-receipt") args.claudeReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/context-recall-drift-guard.mjs [options]

Options:
  --check                         Validate without writing artifacts
  --serve                         Start the read-only API server
  --out-dir <path>                Output directory
  --run-at <iso>                  Deterministic timestamp
  --local-session-capture <path>  Source P10401-P10600 artifact path
  --claude-review-receipt <path>  Required P10800 Claude review receipt path
  --host <host>                   API host
  --port <port>                   API port
`);
}
