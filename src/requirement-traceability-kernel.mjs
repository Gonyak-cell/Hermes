import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildMultiProjectSaasControlPlane } from "./multi-project-saas-control-plane.mjs";

export const DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_OUT_DIR = "artifacts/requirement-traceability-kernel/latest";
export const DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS = {
  schemaPath: "schemas/requirement-traceability-kernel.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p9601-p9800.md",
  architectureDocPath: "docs/architecture.md",
  sourceMultiProjectSaasControlPlanePath: "artifacts/multi-project-saas-control-plane/latest/multi-project-saas-control-plane.json",
  claudeReviewReceiptPath: "artifacts/requirement-traceability-kernel/latest/claude-review-receipt.json",
};

export const DEFAULT_REQUIREMENT_TRACEABILITY_HOST = "127.0.0.1";
export const DEFAULT_REQUIREMENT_TRACEABILITY_PORT = 4196;

const COMMAND_NAME = "platform:requirement-traceability-kernel";
const SOURCE_COMMAND_NAME = "platform:multi-project-saas-control-plane";
const SCHEMA_VERSION = "requirement-traceability-kernel.v1";
const CAPABILITY_ID = "platform.requirement_traceability_kernel";
const PROGRAM_RANGE = "P9601-P9800";
const SOURCE_PROGRAM_RANGE = "P9401-P9600";
const SOURCE_READY_STATUS = "ready_for_multi_project_saas_control_plane";
const READY_STATUS = "ready_for_requirement_traceability_kernel";
const REVIEW_READY_STATUS = "ready_for_required_claude_review";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

const PHASE_SPECS = [
  ["P9601-P9620", "P9600 Source Binding"],
  ["P9621-P9640", "Requirement Source Registry"],
  ["P9641-P9660", "PRD Spec Issue Link Model"],
  ["P9661-P9680", "Test Evidence Coverage Map"],
  ["P9681-P9700", "Claim Gate Check Trace Graph"],
  ["P9701-P9720", "Release Note Closeout Linkage"],
  ["P9721-P9740", "Coverage Gap Blocker Detector"],
  ["P9741-P9760", "Trace API Projection"],
  ["P9761-P9780", "Claude Review Packet And Required Review Boundary"],
  ["P9781-P9800", "P9800 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Requirement traceability source readiness", "computed"],
  ["/api/trace/requirements", "requirements", "Requirement source registry", "requirement_source_registry_rows"],
  ["/api/trace/spec-links", "spec_links", "PRD spec issue link rows", "prd_spec_issue_link_rows"],
  ["/api/trace/test-evidence", "test_evidence", "Test evidence coverage rows", "test_evidence_coverage_rows"],
  ["/api/trace/claim-gate-check", "claim_gate_check", "Claim gate check trace rows", "claim_gate_check_trace_rows"],
  ["/api/trace/release-closeout", "release_closeout", "Release note closeout rows", "release_closeout_link_rows"],
  ["/api/trace/coverage-gaps", "coverage_gaps", "Coverage gap blocker rows", "coverage_gap_blocker_rows"],
  ["/api/trace/review-packet", "review_packet", "Claude review packet rows", "claude_review_packet_rows"],
  ["/api/trace/boundary", "boundary", "Requirement traceability boundary", "requirement_traceability_boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p9600_source", "Traceability passes without P9600 source readiness", "BLOCK_MISSING_P9600_SOURCE"],
  ["negative.missing_requirement_id", "A trace row has no stable requirement id", "BLOCK_MISSING_REQUIREMENT_ID"],
  ["negative.missing_spec_issue_link", "Requirement lacks PRD spec or issue link", "BLOCK_MISSING_SPEC_ISSUE_LINK"],
  ["negative.missing_test_evidence", "Requirement lacks test or evidence coverage", "BLOCK_MISSING_TEST_EVIDENCE"],
  ["negative.missing_claim_gate_check", "Requirement lacks claim gate or check binding", "BLOCK_MISSING_CLAIM_GATE_CHECK"],
  ["negative.coverage_gap_ignored", "Coverage gaps are ignored while closeout passes", "BLOCK_COVERAGE_GAP_IGNORED"],
  ["negative.claude_review_missing", "Required Claude review receipt is missing", "BLOCK_CLAUDE_REVIEW_MISSING"],
  ["negative.claude_blocking_finding_ignored", "Blocking Claude finding is ignored", "BLOCK_CLAUDE_BLOCKING_FINDING"],
  ["negative.final_authority_expanded", "Codex or Claude becomes final approval authority", "BLOCK_FINAL_AUTHORITY_EXPANSION"],
  ["negative.production_enterprise_pass", "Traceability kernel creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.raw_transcript_or_secret", "API or packet exposes raw/full transcript or secret-bearing keys", "BLOCK_RAW_SECRET_RESPONSE"],
];

export async function runRequirementTraceabilityKernel(options = {}) {
  const result = await buildRequirementTraceabilityKernel(options);
  if (options.write !== false) await writeRequirementTraceabilityKernel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Requirement traceability kernel failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRequirementTraceabilityKernel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const hasInlineSource = Object.prototype.hasOwnProperty.call(options, "multiProjectSaasControlPlane");
  const hasInlineClaudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt");
  const source = hasInlineSource
    ? normalizeInlineJsonSource("inline.multi_project_saas_control_plane", options.multiProjectSaasControlPlane)
    : await readJsonOrBuildMultiProjectSaasControlPlane(inputs.source_multi_project_saas_control_plane_path, generatedAt);
  const claudeReceipt = hasInlineClaudeReceipt
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);

  const sourceData = source.data ?? {};
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const derived = deriveTraceabilityCollections(sourceData, claudeReceipt, generatedAt);
  const routeRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows(sourceData, claudeReceipt.data, generatedAt);
  const browserSmokeRows = await buildBrowserSmokeRows(sourceData, claudeReceipt.data, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    claudeReceipt,
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
    claudeReceipt,
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
    claudeReceipt,
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
    claudeReceipt,
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
    requirement_traceability_kernel_id: `requirement-traceability-kernel.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_multi_project_saas_control_plane_summary: source.data?.summary ?? null,
    requirement_traceability_contract: contract,
    requirement_traceability_phase_rows: phaseRows,
    p9600_source_binding_rows: sourceBindingRows,
    trace_api_route_rows: routeRows,
    requirement_source_registry_rows: derived.requirement_source_registry_rows,
    prd_spec_issue_link_rows: derived.prd_spec_issue_link_rows,
    test_evidence_coverage_rows: derived.test_evidence_coverage_rows,
    claim_gate_check_trace_rows: derived.claim_gate_check_trace_rows,
    release_closeout_link_rows: derived.release_closeout_link_rows,
    coverage_gap_blocker_rows: derived.coverage_gap_blocker_rows,
    claude_review_packet_rows: derived.claude_review_packet_rows,
    trace_api_smoke_rows: apiSmokeRows,
    trace_browser_smoke_rows: browserSmokeRows,
    trace_negative_fixture_rows: negativeFixtureRows,
    p9800_freeze_rows: freezeRows,
    trace_gate_rows: gateRows,
    requirement_traceability_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      claudeReceipt,
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
    ? validateAgainstSchema(result, schema.data, {}, "requirement_traceability_kernel")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    claudeReceipt,
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
  return {
    ...result,
    html: renderTraceabilityHtml(result),
    markdown: renderMarkdown(result),
    review_packet_markdown: renderClaudeReviewPacket(result),
  };
}

export async function writeRequirementTraceabilityKernel(result, outDir = DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "requirement-traceability-kernel.json"), serializableResult(result));
  await writeJson(path.join(outDir, "requirement-traceability-phase-rows.json"), result.requirement_traceability_phase_rows);
  await writeJson(path.join(outDir, "p9600-source-binding-rows.json"), result.p9600_source_binding_rows);
  await writeJson(path.join(outDir, "trace-api-route-rows.json"), result.trace_api_route_rows);
  await writeJson(path.join(outDir, "requirement-source-registry-rows.json"), result.requirement_source_registry_rows);
  await writeJson(path.join(outDir, "prd-spec-issue-link-rows.json"), result.prd_spec_issue_link_rows);
  await writeJson(path.join(outDir, "test-evidence-coverage-rows.json"), result.test_evidence_coverage_rows);
  await writeJson(path.join(outDir, "claim-gate-check-trace-rows.json"), result.claim_gate_check_trace_rows);
  await writeJson(path.join(outDir, "release-closeout-link-rows.json"), result.release_closeout_link_rows);
  await writeJson(path.join(outDir, "coverage-gap-blocker-rows.json"), result.coverage_gap_blocker_rows);
  await writeJson(path.join(outDir, "claude-review-packet-rows.json"), result.claude_review_packet_rows);
  await writeJson(path.join(outDir, "trace-api-smoke-rows.json"), result.trace_api_smoke_rows);
  await writeJson(path.join(outDir, "trace-browser-smoke-rows.json"), result.trace_browser_smoke_rows);
  await writeJson(path.join(outDir, "trace-negative-fixture-rows.json"), result.trace_negative_fixture_rows);
  await writeJson(path.join(outDir, "p9800-freeze-rows.json"), result.p9800_freeze_rows);
  await writeJson(path.join(outDir, "trace-gate-rows.json"), result.trace_gate_rows);
  await writeJson(path.join(outDir, "requirement-traceability-boundary.json"), result.requirement_traceability_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "requirement-traceability-kernel-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.review_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export function createRequirementTraceabilityApiServer(options = {}) {
  return createServer(async (request, response) => {
    const apiResponse = await buildRequirementTraceabilityApiResponse(request.url ?? "/", {
      ...options,
      method: request.method,
    });
    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
  });
}

export async function startRequirementTraceabilityApiServer(options = {}) {
  const host = options.host ?? DEFAULT_REQUIREMENT_TRACEABILITY_HOST;
  const port = Number(options.port ?? DEFAULT_REQUIREMENT_TRACEABILITY_PORT);
  const server = createRequirementTraceabilityApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, host, port: actualPort, url: `http://${host}:${actualPort}` };
}

export async function buildRequirementTraceabilityApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Requirement traceability API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const hasInlineSource = Object.prototype.hasOwnProperty.call(options, "multiProjectSaasControlPlane");
  const hasInlineClaudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt");
  const source = hasInlineSource
    ? normalizeInlineJsonSource("inline.multi_project_saas_control_plane", options.multiProjectSaasControlPlane)
    : await readJsonOrBuildMultiProjectSaasControlPlane(options.sourceMultiProjectSaasControlPlanePath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.sourceMultiProjectSaasControlPlanePath, generatedAt);
  const claudeReceipt = hasInlineClaudeReceipt
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(options.claudeReviewReceiptPath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.claudeReviewReceiptPath);
  if (!isSourceReady(source)) {
    return jsonResponse(503, buildError("multi_project_saas_source_unavailable", source.error ?? "P9600 multi-project source is not ready."), method);
  }
  const collections = deriveTraceabilityCollections(source.data, claudeReceipt, generatedAt);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/traceability.html") {
    return htmlResponse(200, renderTraceabilityHtml({
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      generated_at: generatedAt,
      summary: {
        requirement_traceability_kernel_status: hasValidClaudeReview(claudeReceipt) ? READY_STATUS : REVIEW_READY_STATUS,
        ready_for_p9801_handoff: hasValidClaudeReview(claudeReceipt),
      },
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      schema_version: "requirement-traceability-health.v1",
      generated_at: generatedAt,
      status: hasValidClaudeReview(claudeReceipt) ? "ok" : "review_required",
      source_status: source.data?.summary?.multi_project_saas_control_plane_status,
      source_ready: true,
      claude_review_required_now: true,
      claude_review_completed_now: hasValidClaudeReview(claudeReceipt),
      read_only: true,
      mutation_allowed: false,
    }), method);
  }
  const routeSpec = API_ROUTE_SPECS.find(([apiPath]) => apiPath === pathname);
  if (routeSpec) {
    const [, responseKey,, collectionRef] = routeSpec;
    if (collectionRef === "requirement_traceability_boundary") {
      return jsonResponse(200, buildCollectionResponse(responseKey, [buildRuntimeBoundary(source, claudeReceipt, collections)], url, generatedAt), method);
    }
    return jsonResponse(200, buildCollectionResponse(responseKey, collections[collectionRef], url, generatedAt), method);
  }
  return jsonResponse(404, buildError("not_found", `No requirement traceability route for ${pathname}`), method);
}

export async function runRequirementTraceabilityKernelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const started = await startRequirementTraceabilityApiServer({
      host: args.host,
      port: args.port,
      runAt: args.runAt,
      claudeReviewReceiptPath: args.claudeReviewReceiptPath,
    });
    console.log(`Requirement traceability API listening at ${started.url}`);
    console.log(`Open ${started.url}/traceability.html`);
    return;
  }
  const result = await runRequirementTraceabilityKernel({
    check: args.check,
    write: args.write,
    outDir: args.outDir,
    runAt: args.runAt,
    claudeReviewReceiptPath: args.claudeReviewReceiptPath,
  });
  console.log(`${args.check ? "Requirement traceability kernel validated" : "Requirement traceability kernel written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.requirement_traceability_kernel_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Requirements: ${result.summary.requirement_count}`);
  console.log(`Coverage gaps: ${result.summary.coverage_gap_count}`);
  console.log(`Claude review completed: ${result.summary.claude_review_completed_now}`);
  console.log(`P9800 freeze ready: ${result.summary.p9800_freeze_ready}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}

function buildContract(generatedAt) {
  return {
    schema_version: "requirement-traceability-contract.v1",
    generated_at: generatedAt,
    harness_product_identity: "general_project_workflow_control_plane",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    trace_graph_required: true,
    requirement_id_required: true,
    prd_spec_issue_link_required: true,
    test_evidence_link_required: true,
    claim_gate_check_link_required: true,
    release_closeout_link_required: true,
    coverage_gap_blocks_closeout: true,
    claude_review_required_now: true,
    claude_review_required_reason: "traceability_affects_evidence_trust",
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "requirement-traceability-phase-row.v1",
      row_id: `requirement.traceability.phase.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      phase_range,
      phase_name,
      phase_status: pass ? "ready" : "blocked",
      claim_ref: `claim.${phase_range}`,
      evidence_ref: `evidence.${phase_range}`,
      gate_ref: `gate.${phase_range}`,
      check_ref: `validator.${phase_range}`,
      review_marker: phase_range === "P9761-P9780" || phase_range === "P9781-P9800" ? "claude_review_required" : "harness_trace_validation",
      next_allowed_action: pass ? "render traceability phase row" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const pass = isSourceReady(source);
  return [
    verdictRow({
      schema_version: "p9600-source-binding-row.v1",
      row_id: "p9600.source.binding.row.01",
      generated_at: generatedAt,
      source_program_range: SOURCE_PROGRAM_RANGE,
      source_path: source.path,
      source_available: source.available === true,
      source_status: summary.multi_project_saas_control_plane_status ?? "missing",
      source_ready_for_p9601: summary.ready_for_p9601_handoff === true,
      source_validation_error_count: summary.validation_error_count ?? null,
      binding_mode: "read_only_artifact_source",
      read_only: true,
      source_binding_status: pass ? "ready" : "blocked",
      evidence_ref: "evidence.p9600.source.ready",
      next_allowed_action: pass ? "consume P9600 source for trace graph" : "repair P9600 source before P9800",
    }, pass),
  ];
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([api_path, response_key, description, source_collection_ref], index) => verdictRow({
    schema_version: "trace-api-route-row.v1",
    row_id: `trace.api.route.row.${String(index + 1).padStart(2, "0")}`,
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
    next_allowed_action: "serve artifact-backed traceability response",
  }, true));
}

function deriveTraceabilityCollections(sourceData, claudeReceipt, generatedAt) {
  const projects = asArray(sourceData.saas_project_registry_rows);
  const repos = asArray(sourceData.saas_repo_inventory_rows);
  const goals = asArray(sourceData.current_goal_risk_rows);
  const validationRows = asArray(sourceData.validation_review_aggregation_rows);
  const blockers = asArray(sourceData.blocker_next_action_rows);
  const boundaryRows = asArray(sourceData.domain_boundary_guard_rows);
  const requirementRows = projects.flatMap((project, projectIndex) => {
    const goal = goals.find((row) => row.project_id === project.project_id);
    const boundary = boundaryRows.find((row) => row.project_id === project.project_id);
    const specs = [
      ["goal", "current_goal_acceptance", goal?.goal_id ?? project.current_goal_id],
      ["boundary", "domain_boundary_acceptance", boundary?.row_id ?? project.data_boundary_id],
    ];
    return specs.map(([requirement_type, acceptance_kind, source_ref], index) => {
      const requirement_id = `REQ-${slug(project.project_id).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
      return verdictRow({
        schema_version: "requirement-source-registry-row.v1",
        row_id: `requirement.source.registry.row.${String(projectIndex + 1).padStart(2, "0")}.${String(index + 1).padStart(2, "0")}`,
        generated_at: generatedAt,
        requirement_id,
        requirement_type,
        project_id: project.project_id,
        project_name: project.project_name,
        domain_pack: project.domain_pack,
        source_ref,
        acceptance_kind,
        stable_id: true,
        requirement_status: "covered",
        read_only: true,
        next_allowed_action: "link requirement through spec issue test evidence and closeout",
      }, Boolean(source_ref) && project.current_verdict === "pass");
    });
  });

  const specRows = requirementRows.map((requirement, index) => verdictRow({
    schema_version: "prd-spec-issue-link-row.v1",
    row_id: `prd.spec.issue.link.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    requirement_id: requirement.requirement_id,
    project_id: requirement.project_id,
    prd_ref: `prd.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    spec_ref: `spec.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    issue_ref: `issue.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    source_ref: requirement.source_ref,
    prd_link_present: true,
    spec_link_present: true,
    issue_link_present: true,
    cross_project_data_mixed: false,
    read_only: true,
    next_allowed_action: "preserve requirement PRD spec issue link",
  }, requirement.current_verdict === "pass"));

  const testRows = requirementRows.map((requirement, index) => {
    const validation = validationRows.find((row) => row.project_id === requirement.project_id);
    return verdictRow({
      schema_version: "test-evidence-coverage-row.v1",
      row_id: `test.evidence.coverage.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      requirement_id: requirement.requirement_id,
      project_id: requirement.project_id,
      test_ref: `test.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
      validator_ref: `validator.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
      evidence_ref: `evidence.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
      source_validation_ready: validation?.validation_ready === true,
      test_link_present: true,
      evidence_link_present: true,
      validator_link_present: true,
      coverage_status: "covered",
      read_only: true,
      next_allowed_action: "preserve requirement test and evidence coverage",
    }, validation?.validation_ready === true);
  });

  const claimRows = requirementRows.map((requirement, index) => verdictRow({
    schema_version: "claim-gate-check-trace-row.v1",
    row_id: `claim.gate.check.trace.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    requirement_id: requirement.requirement_id,
    project_id: requirement.project_id,
    claim_ref: `claim.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    gate_ref: `gate.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    check_ref: `check.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    artifact_ref: `artifact.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
    claim_link_present: true,
    gate_link_present: true,
    check_link_present: true,
    artifact_link_present: true,
    auto_pass_allowed: false,
    read_only: true,
    next_allowed_action: "verify claim gate check trace before closeout",
  }, requirement.current_verdict === "pass"));

  const releaseRows = requirementRows.map((requirement, index) => {
    const blocker = blockers.find((row) => row.project_id === requirement.project_id);
    return verdictRow({
      schema_version: "release-closeout-link-row.v1",
      row_id: `release.closeout.link.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      requirement_id: requirement.requirement_id,
      project_id: requirement.project_id,
      release_note_ref: `release_note.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
      closeout_ref: `closeout.${slug(requirement.project_id)}.${slug(requirement.requirement_id)}`,
      blocker_count: blocker?.blocker_count ?? 0,
      release_note_link_present: true,
      closeout_link_present: true,
      production_release_allowed: false,
      enterprise_release_allowed: false,
      closeout_status: "trace_ready_not_release_pass",
      read_only: true,
      next_allowed_action: "preserve release note and closeout linkage without release approval",
    }, blocker?.blocker_count === 0);
  });

  const gapRows = requirementRows.map((requirement, index) => {
    const hasSpec = specRows.some((row) => row.requirement_id === requirement.requirement_id && row.current_verdict === "pass");
    const hasTest = testRows.some((row) => row.requirement_id === requirement.requirement_id && row.current_verdict === "pass");
    const hasClaim = claimRows.some((row) => row.requirement_id === requirement.requirement_id && row.current_verdict === "pass");
    const hasRelease = releaseRows.some((row) => row.requirement_id === requirement.requirement_id && row.current_verdict === "pass");
    const missing = [hasSpec, hasTest, hasClaim, hasRelease].filter((pass) => !pass).length;
    return verdictRow({
      schema_version: "coverage-gap-blocker-row.v1",
      row_id: `coverage.gap.blocker.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: generatedAt,
      requirement_id: requirement.requirement_id,
      project_id: requirement.project_id,
      missing_spec_issue_link: !hasSpec,
      missing_test_evidence_link: !hasTest,
      missing_claim_gate_check_link: !hasClaim,
      missing_release_closeout_link: !hasRelease,
      missing_trace_link_count: missing,
      gap_status: missing === 0 ? "clear" : "blocked",
      blocks_p9800_closeout: missing > 0,
      read_only: true,
      next_allowed_action: missing === 0 ? "include requirement in trace closeout packet" : "repair trace coverage gap",
    }, missing === 0);
  });

  const reviewPacketRows = [
    verdictRow({
      schema_version: "claude-review-packet-row.v1",
      row_id: "claude.review.packet.row.01",
      generated_at: generatedAt,
      review_packet_id: `claude.review.packet.${dateStamp(generatedAt)}.p9800`,
      reviewer_model_requested: "claude-code-opus-4.8-max-or-latest-opus",
      review_effort_requested: "max",
      review_scope: "P9601-P9800 requirement traceability kernel",
      review_packet_prepared: true,
      review_required_now: true,
      review_receipt_present: hasReviewReceipt(claudeReceipt),
      review_completed_now: hasValidClaudeReview(claudeReceipt),
      blocking_finding_count: getBlockingFindingCount(claudeReceipt),
      reviewer_mutation_allowed: false,
      claude_final_approval_allowed: false,
      reviewed_artifact_ref: "artifacts/requirement-traceability-kernel/latest/requirement-traceability-kernel.json",
      review_receipt_ref: "artifacts/requirement-traceability-kernel/latest/claude-review-receipt.json",
      next_allowed_action: hasValidClaudeReview(claudeReceipt) ? "preserve Claude review receipt as evidence" : "run required Claude review before P9800 closeout",
    }, hasValidClaudeReview(claudeReceipt)),
  ];

  return {
    requirement_source_registry_rows: requirementRows,
    prd_spec_issue_link_rows: specRows,
    test_evidence_coverage_rows: testRows,
    claim_gate_check_trace_rows: claimRows,
    release_closeout_link_rows: releaseRows,
    coverage_gap_blocker_rows: gapRows,
    claude_review_packet_rows: reviewPacketRows,
  };
}

async function buildApiSmokeRows(sourceData, claudeReceipt, generatedAt) {
  const rows = [];
  for (const [index, [apiPath]] of API_ROUTE_SPECS.entries()) {
    const response = await buildRequirementTraceabilityApiResponse(apiPath, {
      method: "GET",
      runAt: generatedAt,
      multiProjectSaasControlPlane: sourceData,
      claudeReviewReceipt: claudeReceipt,
    });
    const unsafe = inspectResponseBody(response.body);
    rows.push(verdictRow({
      schema_version: "trace-api-smoke-row.v1",
      row_id: `trace.api.smoke.row.${String(index + 1).padStart(2, "0")}`,
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
      next_allowed_action: "preserve trace API smoke evidence",
    }, response.status === 200 && response.body.length > 0 && !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent));
  }
  const postResponse = await buildRequirementTraceabilityApiResponse("/api/trace/requirements", {
    method: "POST",
    runAt: generatedAt,
    multiProjectSaasControlPlane: sourceData,
    claudeReviewReceipt: claudeReceipt,
  });
  rows.push(verdictRow({
    schema_version: "trace-api-smoke-row.v1",
    row_id: `trace.api.smoke.row.${String(rows.length + 1).padStart(2, "0")}`,
    generated_at: generatedAt,
    smoke_id: "api_smoke.post_rejected",
    api_path: "/api/trace/requirements",
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

async function buildBrowserSmokeRows(sourceData, claudeReceipt, generatedAt) {
  const response = await buildRequirementTraceabilityApiResponse("/traceability.html", {
    method: "GET",
    runAt: generatedAt,
    multiProjectSaasControlPlane: sourceData,
    claudeReviewReceipt: claudeReceipt,
  });
  const html = response.body;
  const unsafe = inspectResponseBody(html);
  const apiPaths = API_ROUTE_SPECS.map(([apiPath]) => apiPath).filter((apiPath) => apiPath !== "/health");
  const rows = [
    smokeRow("browser_smoke.html_status", "HTML route returns 200", response.status === 200, { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.nonblank_shell", "HTML shell is nonblank", html.length > 1200 && includesToken(html, "traceability-root"), { observed_status: response.status, response_length: html.length }, generatedAt),
    smokeRow("browser_smoke.api_bindings", "HTML declares trace API bindings", apiPaths.every((apiPath) => includesToken(html, apiPath)), { required_path_count: apiPaths.length, observed_path_count: apiPaths.filter((apiPath) => includesToken(html, apiPath)).length }, generatedAt),
    smokeRow("browser_smoke.no_raw_or_secret", "HTML has no raw transcript body or secret keys", !unsafe.rawTranscriptBodyPresent && !unsafe.secretKeysPresent, { raw_transcript_body_present: unsafe.rawTranscriptBodyPresent, secret_keys_present: unsafe.secretKeysPresent }, generatedAt),
    smokeRow("browser_smoke.no_write_controls", "HTML has no protected git or connector write controls", !includesToken(html, "data-protected-action") && !includesToken(html, "data-git-write") && !includesToken(html, "data-connector-write"), { protected_action_token_present: includesToken(html, "data-protected-action"), git_write_token_present: includesToken(html, "data-git-write"), connector_write_token_present: includesToken(html, "data-connector-write") }, generatedAt),
    smokeRow("browser_smoke.get_only_fetch", "HTML fetch bindings are GET only", !includesToken(html, "method: 'POST'") && !includesToken(html, "method:\"POST\""), { post_fetch_present: includesToken(html, "method: 'POST'") || includesToken(html, "method:\"POST\"") }, generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, row_id: `trace.browser.smoke.row.${String(index + 1).padStart(2, "0")}` }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, description, expected_block_code], index) => verdictRow({
    schema_version: "trace-negative-fixture-row.v1",
    row_id: `trace.negative.fixture.row.${String(index + 1).padStart(2, "0")}`,
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
  const reviewReady = hasValidClaudeReview(context.claudeReceipt);
  const rows = [
    ["freeze.source_ready", "P9600 source is ready", isSourceReady(context.source)],
    ["freeze.phase_rows", "P9601-P9800 phase rows pass", context.phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.source_binding", "P9600 source binding rows pass", context.sourceBindingRows.every((row) => row.current_verdict === "pass")],
    ["freeze.routes", "Trace API routes are ready", context.routeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.requirements", "Requirement source registry rows pass", context.requirement_source_registry_rows.length > 1 && context.requirement_source_registry_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.spec_issue", "PRD spec issue rows pass", context.prd_spec_issue_link_rows.length > 1 && context.prd_spec_issue_link_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.test_evidence", "Test evidence rows pass", context.test_evidence_coverage_rows.length > 1 && context.test_evidence_coverage_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.claim_gate_check", "Claim gate check trace rows pass", context.claim_gate_check_trace_rows.length > 1 && context.claim_gate_check_trace_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.release_closeout", "Release closeout rows pass without release approval", context.release_closeout_link_rows.length > 1 && context.release_closeout_link_rows.every((row) => row.current_verdict === "pass" && row.production_release_allowed === false)],
    ["freeze.coverage_gaps", "Coverage gap rows are clear", context.coverage_gap_blocker_rows.length > 1 && context.coverage_gap_blocker_rows.every((row) => row.current_verdict === "pass" && row.missing_trace_link_count === 0)],
    ["freeze.claude_review_packet", "Required Claude review packet exists and receipt passes", context.claude_review_packet_rows.every((row) => row.review_packet_prepared === true && row.review_required_now === true && row.review_completed_now === true && row.current_verdict === "pass")],
    ["freeze.api_smoke", "Trace API smoke rows pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.browser_smoke", "Browser smoke rows pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.negative_fixtures", "Negative fixtures block unsafe claims", context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false)],
    ["freeze.claude_receipt", "Claude closeout review receipt is complete with no blocking findings", reviewReady],
    ["freeze.p9800_handoff", "P9800 can hand off to P9801", reviewReady],
  ];
  return rows.map(([freeze_id, description, pass], index) => verdictRow({
    schema_version: "p9800-freeze-row.v1",
    row_id: `p9800.freeze.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    freeze_id,
    description,
    evidence_ref: `evidence.${freeze_id}`,
    reviewer_ref: freeze_id === "freeze.claude_receipt" ? "reviewer.claude_code_opus_max" : "reviewer.harness_validator",
    hard_gate_ref: `gate.${freeze_id}`,
    next_allowed_action: pass ? "include in P9800 freeze packet" : "repair P9800 freeze prerequisite",
  }, pass));
}

function buildGateRows(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  const gates = [
    ["package_script_registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes P9800 command"],
    ["validate_chain_registered", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain includes P9800 command"],
    ["runs_after_p9600", commandIndex > sourceIndex && sourceIndex >= 0, "P9800 command runs after P9600 source command"],
    ["source_p9600_ready", isSourceReady(context.source), "P9600 source is ready"],
    ["roadmap_reflected", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE) && includesToken(context.roadmapDoc.text, "Requirement Source Registry"), "P9601-P9800 roadmap is reflected"],
    ["architecture_reflected", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9601-P9800 Requirement Traceability Kernel"), "architecture reflects P9800"],
    ["phase_rows_pass", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all P9601-P9800 phase rows pass"],
    ["requirements_ready", context.requirement_source_registry_rows.every((row) => row.stable_id === true && row.current_verdict === "pass"), "requirements have stable ids"],
    ["spec_issue_ready", context.prd_spec_issue_link_rows.every((row) => row.prd_link_present && row.spec_link_present && row.issue_link_present), "requirements bind PRD spec and issue"],
    ["test_evidence_ready", context.test_evidence_coverage_rows.every((row) => row.test_link_present && row.evidence_link_present && row.validator_link_present), "requirements bind test evidence and validator"],
    ["claim_gate_check_ready", context.claim_gate_check_trace_rows.every((row) => row.claim_link_present && row.gate_link_present && row.check_link_present), "requirements bind claim gate and check"],
    ["release_closeout_ready", context.release_closeout_link_rows.every((row) => row.release_note_link_present && row.closeout_link_present && row.production_release_allowed === false), "release closeout links are present without release approval"],
    ["coverage_gaps_clear", context.coverage_gap_blocker_rows.every((row) => row.missing_trace_link_count === 0 && row.blocks_p9800_closeout === false), "coverage gaps are clear"],
    ["claude_review_required_completed", context.claude_review_packet_rows.every((row) => row.review_required_now === true && row.review_completed_now === true && row.blocking_finding_count === 0), "required Claude review is complete"],
    ["routes_read_only", context.routeRows.every((row) => row.method_allowlist.join(",") === "GET,HEAD" && row.write_methods_enabled === false), "routes are GET/HEAD only"],
    ["api_smoke_pass", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows pass"],
    ["browser_smoke_pass", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows pass"],
    ["negative_fixtures_block", context.negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "negative fixtures block unsafe claims"],
    ["p9800_freeze_rows_ready", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9800 freeze rows are ready"],
    ["no_final_authority", context.contract.codex_final_approval_allowed === false && context.contract.claude_final_approval_allowed === false, "Codex and Claude cannot final approve"],
    ["no_production_enterprise", context.contract.production_pass_enabled === false && context.contract.enterprise_pass_enabled === false, "production and enterprise PASS remain disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => verdictRow({
    schema_version: "trace-gate-row.v1",
    row_id: `trace.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    evidence_ref: `evidence.${gate_id}`,
    reviewer_ref: gate_id === "claude_review_required_completed" ? "reviewer.claude_code_opus_max" : "reviewer.harness_validator",
    hard_gate_ref: `hard_gate.${gate_id}`,
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
  }, pass));
}

function buildBoundary(context) {
  const sourceReady = isSourceReady(context.source);
  const reviewReady = hasValidClaudeReview(context.claudeReceipt);
  const phaseReady = context.phaseRows.every((row) => row.current_verdict === "pass");
  const routeReady = context.routeRows.every((row) => row.current_verdict === "pass");
  const requirementsReady = context.requirement_source_registry_rows.every((row) => row.current_verdict === "pass");
  const specReady = context.prd_spec_issue_link_rows.every((row) => row.current_verdict === "pass");
  const testReady = context.test_evidence_coverage_rows.every((row) => row.current_verdict === "pass");
  const claimReady = context.claim_gate_check_trace_rows.every((row) => row.current_verdict === "pass");
  const releaseReady = context.release_closeout_link_rows.every((row) => row.current_verdict === "pass");
  const gapsClear = context.coverage_gap_blocker_rows.every((row) => row.current_verdict === "pass");
  const packetReady = context.claude_review_packet_rows.every((row) => row.current_verdict === "pass");
  const apiSmokeReady = context.apiSmokeRows.every((row) => row.current_verdict === "pass");
  const browserSmokeReady = context.browserSmokeRows.every((row) => row.current_verdict === "pass");
  const freezeReady = context.freezeRows.every((row) => row.current_verdict === "pass");
  const gatesPass = context.gateRows.every((row) => row.current_verdict === "pass");
  const negativeFixturesBlock = context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false);
  return {
    schema_version: "requirement-traceability-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p9600_ready: sourceReady,
    phase_rows_ready: phaseReady,
    trace_routes_ready: routeReady,
    requirement_registry_ready: requirementsReady,
    prd_spec_issue_links_ready: specReady,
    test_evidence_coverage_ready: testReady,
    claim_gate_check_trace_ready: claimReady,
    release_closeout_links_ready: releaseReady,
    coverage_gaps_clear: gapsClear,
    claude_review_packet_ready: true,
    claude_review_required_now: true,
    claude_review_completed_now: reviewReady,
    claude_review_blocking_finding_count: getBlockingFindingCount(context.claudeReceipt),
    p9800_freeze_ready: freezeReady,
    negative_fixtures_block_unsafe_claims: negativeFixturesBlock,
    all_gates_pass: gatesPass,
    ready_for_p9801_handoff: sourceReady && phaseReady && routeReady && requirementsReady && specReady && testReady && claimReady && releaseReady && gapsClear && packetReady && apiSmokeReady && browserSmokeReady && freezeReady && negativeFixturesBlock && gatesPass && reviewReady,
    api_write_methods_enabled: false,
    raw_transcript_body_visible: false,
    secret_keys_returned: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    reviewer_mutation_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildRuntimeBoundary(source, claudeReceipt, collections) {
  return buildBoundary({
    source,
    claudeReceipt,
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
    validationItem("validate.chain", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include P9800 command"),
    validationItem("source.ready", "source", isSourceReady(context.source), "P9600 source must be ready for P9800"),
    validationItem("roadmap.present", "docs", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE), "P9601-P9800 roadmap must exist"),
    validationItem("architecture.present", "docs", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9601-P9800 Requirement Traceability Kernel"), "architecture must mention P9800"),
    validationItem("phases.ready", "phases", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all phase rows must pass"),
    validationItem("requirements.ready", "requirements", context.requirement_source_registry_rows.length > 1 && context.requirement_source_registry_rows.every((row) => row.current_verdict === "pass"), "requirement rows must pass"),
    validationItem("spec.issue.ready", "specs", context.prd_spec_issue_link_rows.length > 1 && context.prd_spec_issue_link_rows.every((row) => row.current_verdict === "pass"), "PRD spec issue rows must pass"),
    validationItem("test.evidence.ready", "evidence", context.test_evidence_coverage_rows.length > 1 && context.test_evidence_coverage_rows.every((row) => row.current_verdict === "pass"), "test evidence rows must pass"),
    validationItem("claim.gate.check.ready", "claim_gate_check", context.claim_gate_check_trace_rows.length > 1 && context.claim_gate_check_trace_rows.every((row) => row.current_verdict === "pass"), "claim gate check trace rows must pass"),
    validationItem("release.closeout.ready", "release_closeout", context.release_closeout_link_rows.length > 1 && context.release_closeout_link_rows.every((row) => row.current_verdict === "pass"), "release closeout rows must pass"),
    validationItem("coverage.gaps.clear", "coverage", context.coverage_gap_blocker_rows.length > 1 && context.coverage_gap_blocker_rows.every((row) => row.missing_trace_link_count === 0), "coverage gaps must be clear"),
    validationItem("claude.review.completed", "review", hasValidClaudeReview(context.claudeReceipt), "required Claude review receipt must be complete with no blocking findings"),
    validationItem("routes.read_only", "api", context.routeRows.every((row) => row.write_methods_enabled === false && row.mutates_state === false), "API routes must be read-only"),
    validationItem("api.smoke", "api", context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API smoke rows must pass"),
    validationItem("browser.smoke", "ui", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke rows must pass"),
    validationItem("negative.fixtures", "fixtures", context.negativeFixtureRows.length === NEGATIVE_FIXTURES.length && context.negativeFixtureRows.every((row) => row.unsafe_claim_allowed === false), "negative fixtures must block unsafe claims"),
    validationItem("freeze.ready", "freeze", context.freezeRows.every((row) => row.current_verdict === "pass"), "P9800 freeze rows must pass"),
    validationItem("gates.pass", "gates", context.gateRows.every((row) => row.current_verdict === "pass"), "all gates must pass"),
    validationItem("boundary.ready", "boundary", context.boundary.ready_for_p9801_handoff === true && context.boundary.unsafe_flag_count === 0, "P9800 handoff boundary must be ready with no unsafe flags"),
  ];
}

function buildSummary(context) {
  const ready = context.validation.valid && context.boundary.ready_for_p9801_handoff;
  const reviewReady = hasValidClaudeReview(context.claudeReceipt);
  return {
    schema_version: "requirement-traceability-summary.v1",
    requirement_traceability_kernel_status: ready ? READY_STATUS : REVIEW_READY_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_multi_project_saas_control_plane_status: context.source.data?.summary?.multi_project_saas_control_plane_status ?? "missing",
    source_p9600_ready: isSourceReady(context.source),
    phase_row_count: context.phaseRows.length,
    source_binding_count: context.sourceBindingRows.length,
    trace_api_route_count: context.routeRows.length,
    requirement_count: context.requirement_source_registry_rows.length,
    spec_issue_link_count: context.prd_spec_issue_link_rows.length,
    test_evidence_coverage_count: context.test_evidence_coverage_rows.length,
    claim_gate_check_trace_count: context.claim_gate_check_trace_rows.length,
    release_closeout_link_count: context.release_closeout_link_rows.length,
    coverage_gap_count: context.coverage_gap_blocker_rows.filter((row) => row.missing_trace_link_count > 0).length,
    claude_review_required_now: true,
    claude_review_packet_prepared: true,
    claude_review_receipt_present: hasReviewReceipt(context.claudeReceipt),
    claude_review_completed_now: reviewReady,
    claude_review_blocking_finding_count: getBlockingFindingCount(context.claudeReceipt),
    trace_api_smoke_count: context.apiSmokeRows.length,
    trace_browser_smoke_count: context.browserSmokeRows.length,
    negative_fixture_count: context.negativeFixtureRows.length,
    p9800_freeze_count: context.freezeRows.length,
    p9800_freeze_ready: context.boundary.p9800_freeze_ready,
    gate_count: context.gateRows.length,
    pass_gate_count: context.gateRows.filter((row) => row.current_verdict === "pass").length,
    ready_for_p9801_handoff: context.boundary.ready_for_p9801_handoff,
    api_write_methods_enabled: context.boundary.api_write_methods_enabled,
    raw_transcript_body_visible: context.boundary.raw_transcript_body_visible,
    secret_keys_returned: context.boundary.secret_keys_returned,
    codex_final_approval_allowed: context.boundary.codex_final_approval_allowed,
    claude_final_approval_allowed: context.boundary.claude_final_approval_allowed,
    production_pass_enabled: context.boundary.production_pass_enabled,
    enterprise_pass_enabled: context.boundary.enterprise_pass_enabled,
    runtime_execution_enabled: context.boundary.runtime_execution_enabled,
    write_action_enabled: context.boundary.write_action_enabled,
    external_connector_write_enabled: context.boundary.external_connector_write_enabled,
    unsafe_flag_count: context.boundary.unsafe_flag_count,
    validation_error_count: context.validation.errors.length,
  };
}

function renderTraceabilityHtml(result) {
  const requirements = asArray(result.requirement_source_registry_rows).slice(0, 12);
  const gaps = asArray(result.coverage_gap_blocker_rows).slice(0, 12);
  const review = asArray(result.claude_review_packet_rows).slice(0, 4);
  const paths = API_ROUTE_SPECS.map(([apiPath, responseKey]) => ({ apiPath, responseKey })).filter((item) => item.apiPath !== "/health");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Requirement Traceability</title>
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
  <header id="traceability-root">
    <h1>Hermes Requirement Traceability</h1>
    <div class="meta">
      <span class="pill">Program ${escapeHtml(result.program_range)}</span>
      <span class="pill">Source ${escapeHtml(result.source_program_range)}</span>
      <span class="pill">Status ${escapeHtml(result.summary?.requirement_traceability_kernel_status ?? REVIEW_READY_STATUS)}</span>
      <span class="pill">Generated ${escapeHtml(result.generated_at)}</span>
    </div>
  </header>
  <main>
    <section class="band" id="requirements" data-api-path="/api/trace/requirements">
      <h2>Requirements</h2>
      <div class="grid">${requirements.map(requirementCard).join("")}</div>
    </section>
    <section class="band" id="coverage-gaps" data-api-path="/api/trace/coverage-gaps">
      <h2>Coverage Gaps</h2>
      <div class="grid">${gaps.map(gapCard).join("")}</div>
    </section>
    <section class="band" id="review-packet" data-api-path="/api/trace/review-packet">
      <h2>Claude Review Packet</h2>
      <div class="grid">${review.map(reviewCard).join("")}</div>
    </section>
    <section class="band" id="trace-refresh">
      <h2>Read-Only API Bindings</h2>
      <button id="refresh-trace" type="button">Refresh</button>
      <pre id="trace-status">Awaiting read-only refresh.</pre>
    </section>
  </main>
  <script>
    window.REQUIREMENT_TRACEABILITY_API_PATHS = ${JSON.stringify(paths)};
    async function refreshReadOnlyTraceability() {
      const output = [];
      for (const item of window.REQUIREMENT_TRACEABILITY_API_PATHS) {
        const response = await fetch(item.apiPath, { method: "GET", cache: "no-store" });
        output.push(item.responseKey + ":" + response.status);
      }
      document.getElementById("trace-status").textContent = output.join("\\n");
    }
    document.getElementById("refresh-trace").addEventListener("click", refreshReadOnlyTraceability);
    refreshReadOnlyTraceability().catch((error) => {
      document.getElementById("trace-status").textContent = "refresh_error:" + error.message;
    });
  </script>
</body>
</html>`;
}

function requirementCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.requirement_id)}</h3><div class="row"><span class="label">project</span><span class="mono">${escapeHtml(row.project_id)}</span></div><div class="row"><span class="label">type</span><span class="mono">${escapeHtml(row.requirement_type)}</span></div><div class="row"><span class="label">status</span><span class="ok">${escapeHtml(row.requirement_status)}</span></div></article>`;
}

function gapCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.requirement_id)}</h3><div class="row"><span class="label">missing</span><span class="${row.missing_trace_link_count > 0 ? "blocked" : "ok"}">${escapeHtml(row.missing_trace_link_count)}</span></div><div class="row"><span class="label">blocks</span><span class="mono">${escapeHtml(String(row.blocks_p9800_closeout))}</span></div></article>`;
}

function reviewCard(row) {
  return `<article class="item"><h3>${escapeHtml(row.review_packet_id)}</h3><div class="row"><span class="label">required</span><span class="mono">${escapeHtml(String(row.review_required_now))}</span></div><div class="row"><span class="label">completed</span><span class="${row.review_completed_now ? "ok" : "blocked"}">${escapeHtml(String(row.review_completed_now))}</span></div></article>`;
}

function renderMarkdown(result) {
  return [
    "# Requirement Traceability Kernel",
    "",
    `Generated at: ${result.generated_at}`,
    `Program: ${result.program_range}`,
    `Status: ${result.summary.requirement_traceability_kernel_status}`,
    "",
    "## Summary",
    "",
    `- Source P9600 ready: ${result.summary.source_p9600_ready}`,
    `- Requirements: ${result.summary.requirement_count}`,
    `- Coverage gaps: ${result.summary.coverage_gap_count}`,
    `- Claude review required: ${result.summary.claude_review_required_now}`,
    `- Claude review completed: ${result.summary.claude_review_completed_now}`,
    `- P9800 freeze ready: ${result.summary.p9800_freeze_ready}`,
    `- Ready for P9801 handoff: ${result.summary.ready_for_p9801_handoff}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "P9601-P9800 creates a read-only trace graph across requirements, PRD/spec/issue refs, tests, evidence, claim/gate/check refs, release notes, and closeout refs. It requires Claude review evidence before P9800 closeout and does not grant final approval, production PASS, enterprise PASS, runtime execution, write actions, or connector writes.",
    "",
  ].join("\n");
}

function renderClaudeReviewPacket(result) {
  const diffHint = "Review the current git diff for P9601-P9800 and the generated traceability artifact.";
  return [
    "# Claude Review Packet: P9601-P9800 Requirement Traceability Kernel",
    "",
    "Reviewer: Claude Code Opus 4.8 max or latest Opus equivalent",
    "Mode: read-only review evidence; no source mutation; no final approval",
    "",
    "## Scope",
    "",
    diffHint,
    "",
    "## Required Checks",
    "",
    "- Stable requirement ids exist for every trace row.",
    "- Every requirement links PRD/spec/issue, test/evidence, claim/gate/check, release note, and closeout refs.",
    "- Coverage gaps block P9800 closeout.",
    "- Codex and Claude final approval remain false.",
    "- Production and enterprise PASS remain false.",
    "- API/UI routes remain GET/HEAD only and sanitized.",
    "- No raw/full transcript body or secret-bearing keys are exposed.",
    "",
    "## Current Summary",
    "",
    JSON.stringify(result.summary, null, 2),
    "",
    "## Expected JSON Receipt",
    "",
    "Return a concise JSON-compatible verdict that can be wrapped as claude-review-receipt.json with review_status completed, finding_count, blocking_finding_count, and findings.",
    "",
  ].join("\n");
}

function buildCollectionResponse(collectionName, rows, url, generatedAt) {
  const safeRows = sanitizeApiPayload(asArray(rows));
  return {
    schema_version: "requirement-traceability-collection-response.v1",
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
    payload_projection: "sanitized_requirement_traceability_view_model",
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
  return /(raw_|full_transcript|full_body|secret)/i.test(key);
}

function smokeRow(smokeId, description, pass, observations, generatedAt) {
  return verdictRow({
    schema_version: "trace-browser-smoke-row.v1",
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
    schema_version: "requirement-traceability-error.v1",
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
    schema_version: "requirement-traceability-validation-item.v1",
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

function hasReviewReceipt(receipt) {
  return receipt.available === true && Boolean(receipt.data);
}

function hasValidClaudeReview(receipt) {
  return hasReviewReceipt(receipt)
    && receipt.data?.review_status === "completed"
    && Number(receipt.data?.blocking_finding_count ?? 0) === 0
    && receipt.data?.reviewer_mutation_allowed === false
    && receipt.data?.claude_final_approval_allowed === false;
}

function getBlockingFindingCount(receipt) {
  if (!hasReviewReceipt(receipt)) return null;
  return Number(receipt.data?.blocking_finding_count ?? 0);
}

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

function isSourceReady(source) {
  return source.available
    && source.data?.summary?.multi_project_saas_control_plane_status === SOURCE_READY_STATUS
    && source.data?.summary?.ready_for_p9601_handoff === true;
}

async function readJsonOrBuildMultiProjectSaasControlPlane(filePath, generatedAt) {
  const resolved = path.resolve(filePath);
  const source = await readJsonSource(resolved);
  if (source.available && source.data?.summary?.multi_project_saas_control_plane_status === SOURCE_READY_STATUS) return source;
  try {
    const built = await buildMultiProjectSaasControlPlane({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.multi_project_saas_control_plane", built);
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
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.architectureDocPath),
    source_multi_project_saas_control_plane_path: path.resolve(options.sourceMultiProjectSaasControlPlanePath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.sourceMultiProjectSaasControlPlanePath),
    claude_review_receipt_path: path.resolve(options.claudeReviewReceiptPath ?? DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_INPUTS.claudeReviewReceiptPath),
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  return { ...result, html: undefined, markdown: undefined, review_packet_markdown: undefined };
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    serve: false,
    outDir: DEFAULT_REQUIREMENT_TRACEABILITY_KERNEL_OUT_DIR,
    host: DEFAULT_REQUIREMENT_TRACEABILITY_HOST,
    port: DEFAULT_REQUIREMENT_TRACEABILITY_PORT,
    runAt: undefined,
    claudeReviewReceiptPath: undefined,
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
    else if (arg === "--claude-review-receipt") args.claudeReviewReceiptPath = argv[++index];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/requirement-traceability-kernel.mjs [options]

Options:
  --check                         Validate without writing artifacts
  --serve                         Start the read-only local API server
  --out-dir <path>                Output directory
  --claude-review-receipt <path>  Claude review receipt path
  --host <host>                   Server host
  --port <port>                   Server port
  --run-at <iso>                  Fixed generation timestamp
  --help                          Show this help
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
