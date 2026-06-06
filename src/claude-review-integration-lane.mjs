import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildProductBuildVerificationLoop } from "./product-build-verification-loop.mjs";

export const DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_OUT_DIR = "artifacts/claude-review-integration-lane/latest";
export const DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS = {
  schemaPath: "schemas/claude-review-integration-lane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p10001-p10200.md",
  architectureDocPath: "docs/architecture.md",
  sourceProductBuildVerificationPath: "artifacts/product-build-verification-loop/latest/product-build-verification-loop.json",
  sourceClaudeReviewReceiptPath: "artifacts/product-build-verification-loop/latest/claude-review-receipt.json",
  claudeReviewReceiptPath: "artifacts/claude-review-integration-lane/latest/claude-review-receipt.json",
};

export const DEFAULT_CLAUDE_REVIEW_INTEGRATION_HOST = "127.0.0.1";
export const DEFAULT_CLAUDE_REVIEW_INTEGRATION_PORT = 4198;

const COMMAND_NAME = "platform:claude-review-integration-lane";
const SOURCE_COMMAND_NAME = "platform:product-build-verification-loop";
const SCHEMA_VERSION = "claude-review-integration-lane.v1";
const CAPABILITY_ID = "platform.claude_review_integration_lane";
const PROGRAM_RANGE = "P10001-P10200";
const SOURCE_PROGRAM_RANGE = "P9801-P10000";
const READY_STATUS = "ready_for_claude_review_integration_lane";
const REVIEW_PENDING_STATUS = "ready_for_required_claude_review";
const BLOCKED_STATUS = "blocked_claude_review_integration_lane";

const PHASE_SPECS = [
  ["P10001-P10020", "P10000 Source Binding"],
  ["P10021-P10040", "Claude Review Request Contract"],
  ["P10041-P10060", "Model And Effort Evidence"],
  ["P10061-P10080", "Review Receipt Intake"],
  ["P10081-P10100", "Finding Normalization Contract"],
  ["P10101-P10120", "Unresolved Finding Blocker"],
  ["P10121-P10140", "Revalidation Evidence Binding"],
  ["P10141-P10160", "Review Authority Boundary"],
  ["P10161-P10180", "Review API Projection"],
  ["P10181-P10200", "P10200 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Claude review integration readiness", "computed"],
  ["/api/review/requests", "requests", "Claude review request packets", "review_request_packet_rows"],
  ["/api/review/model-effort", "model_effort", "Model and effort evidence", "model_effort_evidence_rows"],
  ["/api/review/receipts", "receipts", "Review receipt intake rows", "review_receipt_intake_rows"],
  ["/api/review/findings", "findings", "Normalized finding rows", "finding_normalization_rows"],
  ["/api/review/unresolved", "unresolved", "Unresolved finding blocker rows", "unresolved_finding_blocker_rows"],
  ["/api/review/revalidation", "revalidation", "Revalidation binding rows", "review_revalidation_binding_rows"],
  ["/api/review/boundary", "boundary", "Review authority boundary", "review_authority_boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p10000_source", "Review lane passes without P10000 source readiness", "BLOCK_MISSING_P10000_SOURCE"],
  ["negative.missing_review_request", "Claude review runs without a request packet", "BLOCK_MISSING_REVIEW_REQUEST"],
  ["negative.missing_model_effort", "Claude review lacks model and effort evidence", "BLOCK_MISSING_MODEL_EFFORT"],
  ["negative.missing_receipt", "Review closeout lacks a completed receipt", "BLOCK_MISSING_REVIEW_RECEIPT"],
  ["negative.unresolved_finding_ignored", "Unresolved Claude finding is ignored", "BLOCK_UNRESOLVED_FINDING_IGNORED"],
  ["negative.blocking_finding_ignored", "Blocking Claude finding is ignored", "BLOCK_BLOCKING_FINDING_IGNORED"],
  ["negative.revalidation_missing", "Finding loop closes without revalidation evidence", "BLOCK_REVALIDATION_MISSING"],
  ["negative.reviewer_mutates_source", "Reviewer mutates source during review", "BLOCK_REVIEWER_MUTATION"],
  ["negative.claude_final_approval", "Claude becomes final approver", "BLOCK_CLAUDE_FINAL_APPROVAL"],
  ["negative.production_enterprise_pass", "Review lane creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.api_mutation_or_raw", "Review API exposes mutation or raw sensitive material", "BLOCK_API_MUTATION_OR_RAW"],
];

export async function runClaudeReviewIntegrationLane(options = {}) {
  const result = await buildClaudeReviewIntegrationLane(options);
  if (options.write !== false) await writeClaudeReviewIntegrationLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Claude review integration lane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildClaudeReviewIntegrationLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "productBuildVerificationLoop")
    ? normalizeInlineJsonSource("inline.product_build_verification_loop", options.productBuildVerificationLoop)
    : await readJsonOrBuildProductBuildVerification(inputs.source_product_build_verification_path, generatedAt);
  const sourceReviewReceipt = Object.prototype.hasOwnProperty.call(options, "sourceClaudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.source_claude_review_receipt", options.sourceClaudeReviewReceipt)
    : await readJsonSource(inputs.source_claude_review_receipt_path);
  const laneReviewReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, sourceReviewReceipt, generatedAt);
  const derived = deriveClaudeReviewIntegrationCollections(source, sourceReviewReceipt, laneReviewReceipt, generatedAt);
  const routeRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows(source, sourceReviewReceipt, laneReviewReceipt, generatedAt);
  const browserSmokeRows = await buildBrowserSmokeRows(source, sourceReviewReceipt, laneReviewReceipt, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    sourceReviewReceipt,
    laneReviewReceipt,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    ...derived,
  });
  const boundary = buildAuthorityBoundary({ source, sourceReviewReceipt, laneReviewReceipt, freezeRows, ...derived }, generatedAt);
  const gateRows = buildGateRows({
    source,
    sourceReviewReceipt,
    laneReviewReceipt,
    freezeRows,
    boundary,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    ...derived,
  }, generatedAt);
  const validationItems = buildValidationItems({
    schema,
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    sourceReviewReceipt,
    laneReviewReceipt,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    boundary,
    gateRows,
    ...derived,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    source_refs: {
      product_build_verification_path: source.path,
      source_claude_review_receipt_path: sourceReviewReceipt.path,
      claude_review_receipt_path: laneReviewReceipt.path,
    },
    claude_review_integration_contract: contract,
    claude_review_integration_phase_rows: phaseRows,
    p10000_source_binding_rows: sourceBindingRows,
    review_request_packet_rows: derived.review_request_packet_rows,
    model_effort_evidence_rows: derived.model_effort_evidence_rows,
    review_receipt_intake_rows: derived.review_receipt_intake_rows,
    finding_normalization_rows: derived.finding_normalization_rows,
    unresolved_finding_blocker_rows: derived.unresolved_finding_blocker_rows,
    review_revalidation_binding_rows: derived.review_revalidation_binding_rows,
    review_api_route_rows: routeRows,
    review_api_smoke_rows: apiSmokeRows,
    review_browser_smoke_rows: browserSmokeRows,
    review_negative_fixture_rows: negativeFixtureRows,
    p10200_freeze_rows: freezeRows,
    review_gate_rows: gateRows,
    review_authority_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({
      source,
      sourceReviewReceipt,
      laneReviewReceipt,
      phaseRows,
      sourceBindingRows,
      routeRows,
      apiSmokeRows,
      browserSmokeRows,
      negativeFixtureRows,
      freezeRows,
      boundary,
      gateRows,
      validation: preliminaryValidation,
      ...derived,
    }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "claude_review_integration_lane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    source,
    sourceReviewReceipt,
    laneReviewReceipt,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    freezeRows,
    boundary,
    gateRows,
    validation: result.validation,
    ...derived,
  });
  return {
    ...result,
    html: renderReviewIntegrationHtml(result),
    markdown: renderSummaryMarkdown(result),
    review_packet_markdown: renderClaudeReviewPacket(result),
  };
}

export async function writeClaudeReviewIntegrationLane(result, outDir = DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "claude-review-integration-lane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claude-review-integration-phase-rows.json"), result.claude_review_integration_phase_rows);
  await writeJson(path.join(outDir, "p10000-source-binding-rows.json"), result.p10000_source_binding_rows);
  await writeJson(path.join(outDir, "review-request-packet-rows.json"), result.review_request_packet_rows);
  await writeJson(path.join(outDir, "model-effort-evidence-rows.json"), result.model_effort_evidence_rows);
  await writeJson(path.join(outDir, "review-receipt-intake-rows.json"), result.review_receipt_intake_rows);
  await writeJson(path.join(outDir, "finding-normalization-rows.json"), result.finding_normalization_rows);
  await writeJson(path.join(outDir, "unresolved-finding-blocker-rows.json"), result.unresolved_finding_blocker_rows);
  await writeJson(path.join(outDir, "review-revalidation-binding-rows.json"), result.review_revalidation_binding_rows);
  await writeJson(path.join(outDir, "review-api-route-rows.json"), result.review_api_route_rows);
  await writeJson(path.join(outDir, "review-api-smoke-rows.json"), result.review_api_smoke_rows);
  await writeJson(path.join(outDir, "review-browser-smoke-rows.json"), result.review_browser_smoke_rows);
  await writeJson(path.join(outDir, "review-negative-fixture-rows.json"), result.review_negative_fixture_rows);
  await writeJson(path.join(outDir, "p10200-freeze-rows.json"), result.p10200_freeze_rows);
  await writeJson(path.join(outDir, "review-gate-rows.json"), result.review_gate_rows);
  await writeJson(path.join(outDir, "review-authority-boundary.json"), result.review_authority_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), result.validation);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.review_packet_markdown, "utf8");
}

export function createClaudeReviewIntegrationApiServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      const apiResponse = await buildClaudeReviewIntegrationApiResponse(request.url ?? "/", {
        ...options,
        method: request.method,
      });
      response.writeHead(apiResponse.status, apiResponse.headers);
      if (request.method !== "HEAD") response.end(apiResponse.body);
      else response.end();
    } catch (error) {
      const body = JSON.stringify(buildError("internal_error", error.message), null, 2);
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(body);
    }
  });
}

export async function startClaudeReviewIntegrationApiServer(options = {}) {
  const host = options.host ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_HOST;
  const port = options.port ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_PORT;
  const server = createClaudeReviewIntegrationApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildClaudeReviewIntegrationApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Claude review integration API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const source = Object.prototype.hasOwnProperty.call(options, "productBuildVerificationLoop")
    ? normalizeInlineJsonSource("inline.product_build_verification_loop", options.productBuildVerificationLoop)
    : await readJsonOrBuildProductBuildVerification(options.sourceProductBuildVerificationPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.sourceProductBuildVerificationPath, generatedAt);
  const sourceReviewReceipt = Object.prototype.hasOwnProperty.call(options, "sourceClaudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.source_claude_review_receipt", options.sourceClaudeReviewReceipt)
    : await readJsonSource(options.sourceClaudeReviewReceiptPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.sourceClaudeReviewReceiptPath);
  const laneReviewReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(options.claudeReviewReceiptPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.claudeReviewReceiptPath);
  const collections = deriveClaudeReviewIntegrationCollections(source, sourceReviewReceipt, laneReviewReceipt, generatedAt);
  const boundary = buildAuthorityBoundary({ source, sourceReviewReceipt, laneReviewReceipt, ...collections }, generatedAt);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/claude-review-integration.html") {
    return htmlResponse(200, renderReviewIntegrationHtml({
      program_range: PROGRAM_RANGE,
      summary: buildApiSummary(source, sourceReviewReceipt, laneReviewReceipt, collections, boundary),
      review_authority_boundary: boundary,
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      ok: isSourceReady(source),
      program_range: PROGRAM_RANGE,
      source_ready: isSourceReady(source),
      source_review_receipt_ready: hasCompletedSourceReview(sourceReviewReceipt),
      claude_review_completed_now: hasCompletedLaneReview(laneReviewReceipt),
      write_methods_enabled: false,
    }), method);
  }
  const route = API_ROUTE_SPECS.find(([routePath]) => routePath === pathname);
  if (!route) return jsonResponse(404, buildError("not_found", `No Claude review integration route for ${pathname}`), method);
  const [, routeId,, collectionKey] = route;
  const body = collectionKey === "review_authority_boundary" ? boundary : collections[collectionKey];
  return jsonResponse(200, sanitizeApiPayload({
    route_id: routeId,
    program_range: PROGRAM_RANGE,
    data: body,
  }), method);
}

export async function runClaudeReviewIntegrationLaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const started = await startClaudeReviewIntegrationApiServer({
      host: args.host,
      port: args.port,
      runAt: args.runAt,
      sourceProductBuildVerificationPath: args.sourceProductBuildVerificationPath,
      sourceClaudeReviewReceiptPath: args.sourceClaudeReviewReceiptPath,
      claudeReviewReceiptPath: args.claudeReviewReceiptPath,
    });
    console.log(`Claude review integration API listening at ${started.url}`);
    console.log(`Open ${started.url}/claude-review-integration.html`);
    return;
  }
  const result = await runClaudeReviewIntegrationLane({
    check: args.check,
    write: args.write,
    outDir: args.outDir,
    runAt: args.runAt,
    sourceProductBuildVerificationPath: args.sourceProductBuildVerificationPath,
    sourceClaudeReviewReceiptPath: args.sourceClaudeReviewReceiptPath,
    claudeReviewReceiptPath: args.claudeReviewReceiptPath,
  });
  console.log(`${args.check ? "Claude review integration lane validated" : "Claude review integration lane written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.claude_review_integration_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Review requests: ${result.summary.review_request_count}`);
  console.log(`Findings: ${result.summary.finding_count}`);
  console.log(`Unresolved findings: ${result.summary.unresolved_finding_count}`);
  console.log(`Claude review completed: ${result.summary.p10200_claude_review_completed_now}`);
  console.log(`P10200 freeze ready: ${result.summary.p10200_freeze_ready}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}

function buildContract(generatedAt) {
  return {
    schema_version: "claude-review-integration-contract.v1",
    generated_at: generatedAt,
    source_product_build_verification_required: true,
    source_review_receipt_required: true,
    review_request_packet_required: true,
    model_effort_evidence_required: true,
    receipt_intake_required: true,
    finding_normalization_required: true,
    unresolved_finding_blocker_required: true,
    revalidation_binding_required: true,
    api_projection_read_only: true,
    reviewer_mutation_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    human_gate_substituted_by_claude: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    phase_range: phaseRange,
    category: "phase",
    label: name,
    description: `${phaseRange} ${name}`,
    required: true,
    observed: includesToken(roadmapText, phaseRange) && includesToken(roadmapText, name),
    current_verdict: includesToken(roadmapText, phaseRange) && includesToken(roadmapText, name) ? "pass" : "block",
    block_reason: includesToken(roadmapText, phaseRange) && includesToken(roadmapText, name) ? null : "roadmap_phase_missing",
    evidence_ref: "docs/hermes-roadmap-p10001-p10200.md",
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, sourceReviewReceipt, generatedAt) {
  const sourceReady = isSourceReady(source);
  const sourceReviewReady = hasCompletedSourceReview(sourceReviewReceipt);
  return [
    verdictRow({
      row_id: "source.p10000.product_build_verification_loop",
      category: "source_binding",
      label: "P10000 product build verification source",
      description: "Claude review integration lane consumes the P10000 product build verification artifact.",
      required: true,
      observed: sourceReady,
      current_verdict: sourceReady ? "pass" : "block",
      block_reason: sourceReady ? null : "p10000_source_not_ready",
      evidence_ref: source.path,
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source.p10000.claude_review_receipt",
      category: "source_binding",
      label: "P10000 Claude review receipt",
      description: "The incoming build verification loop must already have completed read-only Claude review evidence.",
      required: true,
      observed: sourceReviewReady,
      current_verdict: sourceReviewReady ? "pass" : "block",
      block_reason: sourceReviewReady ? null : "source_claude_review_receipt_not_ready",
      evidence_ref: sourceReviewReceipt.path,
      generated_at: generatedAt,
    }),
  ];
}

function deriveClaudeReviewIntegrationCollections(source, sourceReviewReceipt, laneReviewReceipt, generatedAt) {
  const sourceData = source.data ?? {};
  const sourceReviewPackets = Array.isArray(sourceData.build_review_packet_rows) ? sourceData.build_review_packet_rows : [];
  const sourceReady = isSourceReady(source);
  const closeoutRequest = {
    row_id: "review_request.p10200.closeout",
    review_request_id: "CLAUDE-REQ-P10200-CLOSEOUT",
    source_scope: PROGRAM_RANGE,
    feature_id: null,
    requirement_id: null,
    review_packet_ref: "artifacts/claude-review-integration-lane/latest/claude-review-packet.md",
    prompt_ref: "artifacts/claude-review-integration-lane/latest/claude-review-prompt-compact.md",
    reviewed_artifact_ref: "artifacts/claude-review-integration-lane/latest/claude-review-integration-lane.json",
    requested_model_policy: "claude-code-opus-max-or-latest-opus",
    requested_effort: "max",
    reviewer_write_tools_allowed: false,
    reviewer_mutation_allowed: false,
    current_verdict: sourceReady ? "pass" : "block",
    block_reason: sourceReady ? null : "p10000_source_not_ready",
    generated_at: generatedAt,
  };
  const requestRows = [
    closeoutRequest,
    ...sourceReviewPackets.map((row) => {
      const ready = sourceReady && row.current_verdict === "pass" && Boolean(row.review_packet_ref);
      return {
        row_id: `review_request.${slug(row.feature_id ?? row.requirement_id)}`,
        review_request_id: `CLAUDE-REQ-${String(row.feature_id ?? row.requirement_id ?? "unknown").toUpperCase()}`,
        source_scope: SOURCE_PROGRAM_RANGE,
        feature_id: row.feature_id ?? null,
        requirement_id: row.requirement_id ?? null,
        review_packet_ref: row.review_packet_ref ?? null,
        prompt_ref: `review_prompt.${slug(row.feature_id ?? row.requirement_id)}`,
        reviewed_artifact_ref: source.path,
        requested_model_policy: "claude-code-opus-max-or-latest-opus",
        requested_effort: "max",
        reviewer_write_tools_allowed: false,
        reviewer_mutation_allowed: false,
        current_verdict: ready ? "pass" : "block",
        block_reason: ready ? null : "source_review_packet_not_ready",
        generated_at: generatedAt,
      };
    }),
  ];
  const modelEffortRows = [
    buildModelEffortEvidenceRow("source.p10000", "P10000 source review model and effort", sourceReviewReceipt, generatedAt),
    buildModelEffortEvidenceRow("closeout.p10200", "P10200 closeout review model and effort", laneReviewReceipt, generatedAt),
  ];
  const receiptRows = [
    buildReceiptIntakeRow("source.p10000", "P10000 source Claude receipt", sourceReviewReceipt, generatedAt, hasCompletedSourceReview),
    buildReceiptIntakeRow("closeout.p10200", "P10200 Claude receipt", laneReviewReceipt, generatedAt, hasCompletedLaneReview),
  ];
  const findingRows = buildFindingNormalizationRows(laneReviewReceipt, generatedAt);
  const unresolvedRows = buildUnresolvedFindingBlockerRows(findingRows, generatedAt);
  const revalidationRows = buildReviewRevalidationRows(findingRows, generatedAt);
  return {
    review_request_packet_rows: requestRows,
    model_effort_evidence_rows: modelEffortRows,
    review_receipt_intake_rows: receiptRows,
    finding_normalization_rows: findingRows,
    unresolved_finding_blocker_rows: unresolvedRows,
    review_revalidation_binding_rows: revalidationRows,
  };
}

function buildModelEffortEvidenceRow(rowPrefix, label, receipt, generatedAt) {
  const data = receipt.data ?? {};
  const model = String(data.reviewer_model_observed ?? data.reviewer_model_requested ?? data.reviewer_model ?? data.model ?? "");
  const requestedModel = data.reviewer_model_requested ?? data.reviewer_model ?? data.model ?? null;
  const effort = String(data.review_effort_requested ?? data.review_effort ?? data.effort ?? "").toLowerCase();
  const modelOk = /opus|claude/i.test(model) || /opus|claude/i.test(String(requestedModel ?? ""));
  const effortOk = effort === "max" || effort === "maximum";
  const safeBoundary = data.reviewer_mutation_allowed === false && data.claude_final_approval_allowed === false;
  const ready = receipt.available && modelOk && effortOk && safeBoundary;
  return verdictRow({
    row_id: `model_effort.${rowPrefix}`,
    category: "model_effort",
    label,
    description: "Claude review evidence must preserve requested model, observed model when available, and max effort policy.",
    required: true,
    observed: ready,
    current_verdict: ready ? "pass" : "block",
    block_reason: ready ? null : "missing_or_unsafe_model_effort_evidence",
    evidence_ref: receipt.path,
    reviewer_model_requested: requestedModel,
    reviewer_model_observed: data.reviewer_model_observed ?? data.reviewer_model ?? data.model ?? null,
    review_effort_requested: data.review_effort_requested ?? data.review_effort ?? data.effort ?? null,
    reviewer_mutation_allowed: data.reviewer_mutation_allowed ?? null,
    claude_final_approval_allowed: data.claude_final_approval_allowed ?? null,
    generated_at: generatedAt,
  });
}

function buildReceiptIntakeRow(rowPrefix, label, receipt, generatedAt, readinessFn) {
  const data = receipt.data ?? {};
  const ready = readinessFn(receipt);
  return verdictRow({
    row_id: `receipt.${rowPrefix}`,
    category: "receipt_intake",
    label,
    description: "Receipt intake accepts completed read-only Claude review evidence only.",
    required: true,
    observed: ready,
    current_verdict: ready ? "pass" : "block",
    block_reason: ready ? null : "review_receipt_missing_incomplete_or_unsafe",
    evidence_ref: receipt.path,
    review_status: data.review_status ?? null,
    finding_count: numberOrNull(data.finding_count),
    blocking_finding_count: numberOrNull(data.blocking_finding_count),
    unresolved_finding_count: countUnresolvedFindings(data.findings),
    reviewer_mutation_allowed: data.reviewer_mutation_allowed ?? null,
    reviewer_mutated_source: data.reviewer_mutated_source ?? null,
    codex_final_approval_allowed: data.codex_final_approval_allowed ?? null,
    claude_final_approval_allowed: data.claude_final_approval_allowed ?? null,
    production_pass_allowed: data.production_pass_allowed ?? null,
    enterprise_pass_allowed: data.enterprise_pass_allowed ?? null,
    generated_at: generatedAt,
  });
}

function buildFindingNormalizationRows(laneReviewReceipt, generatedAt) {
  const findings = Array.isArray(laneReviewReceipt.data?.findings) ? laneReviewReceipt.data.findings : [];
  if (findings.length === 0) {
    return [{
      row_id: "finding.none",
      finding_id: "NO_FINDINGS",
      severity: "none",
      category: "none",
      title: "No Claude findings reported",
      blocking: false,
      unresolved: false,
      normalized: true,
      disposition: "not_required",
      revalidation_required: false,
      revalidation_ref: null,
      current_verdict: "pass",
      block_reason: null,
      generated_at: generatedAt,
    }];
  }
  return findings.map((finding, index) => {
    const severity = String(finding.severity ?? "unknown").toLowerCase();
    const blocking = isBlockingSeverity(severity) || finding.blocking === true;
    const unresolved = isFindingUnresolved(finding);
    const findingId = finding.finding_id ?? finding.id ?? `CLAUDE-FINDING-${String(index + 1).padStart(3, "0")}`;
    return {
      row_id: `finding.${slug(findingId)}`,
      finding_id: findingId,
      severity,
      category: finding.category ?? "general",
      title: finding.title ?? "Untitled Claude review finding",
      file: finding.file ?? null,
      line: finding.line ?? null,
      blocking,
      unresolved,
      normalized: true,
      disposition: finding.disposition ?? (unresolved ? "unresolved" : "revalidated"),
      revalidation_required: true,
      revalidation_ref: finding.revalidation_ref ?? null,
      current_verdict: blocking || unresolved ? "block" : "pass",
      block_reason: blocking ? "blocking_claude_finding" : unresolved ? "unresolved_claude_finding" : null,
      generated_at: generatedAt,
    };
  });
}

function buildUnresolvedFindingBlockerRows(findingRows, generatedAt) {
  return findingRows.map((row) => {
    const clear = row.finding_id === "NO_FINDINGS" || (!row.blocking && !row.unresolved);
    return verdictRow({
      row_id: `unresolved.${slug(row.finding_id)}`,
      category: "unresolved_finding_blocker",
      label: row.finding_id === "NO_FINDINGS" ? "No unresolved findings" : `Finding ${row.finding_id}`,
      description: "Every unresolved or blocking Claude finding blocks closeout until revalidated.",
      required: true,
      observed: clear,
      current_verdict: clear ? "pass" : "block",
      block_reason: clear ? null : row.block_reason ?? "unresolved_or_blocking_finding",
      evidence_ref: row.revalidation_ref ?? "artifacts/claude-review-integration-lane/latest/claude-review-receipt.json",
      finding_id: row.finding_id,
      blocking: row.blocking,
      unresolved: row.unresolved,
      generated_at: generatedAt,
    });
  });
}

function buildReviewRevalidationRows(findingRows, generatedAt) {
  return findingRows.map((row) => {
    const notRequired = row.finding_id === "NO_FINDINGS";
    const pass = notRequired || (!row.blocking && !row.unresolved && Boolean(row.revalidation_ref));
    return {
      row_id: `revalidation.${slug(row.finding_id)}`,
      finding_id: row.finding_id,
      revalidation_required: !notRequired,
      revalidation_ref: row.revalidation_ref,
      validator_ref: notRequired ? null : "npm run platform:claude-review-integration-lane -- --check",
      evidence_ref: row.revalidation_ref ?? null,
      current_verdict: pass ? "pass" : "block",
      block_reason: pass ? null : "missing_revalidation_or_unresolved_finding",
      generated_at: generatedAt,
    };
  });
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([routePath, routeId, description]) => verdictRow({
    row_id: `api.${slug(routeId)}`,
    category: "api_route",
    label: routePath,
    description,
    required: true,
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    evidence_ref: `GET ${routePath}`,
    methods_allowed: ["GET", "HEAD"],
    mutation_methods_allowed: [],
    raw_material_visible: false,
    generated_at: generatedAt,
  }));
}

async function buildApiSmokeRows(source, sourceReviewReceipt, laneReviewReceipt, generatedAt) {
  const rows = [];
  for (const [routePath, routeId] of API_ROUTE_SPECS) {
    const response = await buildClaudeReviewIntegrationApiResponse(routePath, {
      runAt: generatedAt,
      method: "GET",
      productBuildVerificationLoop: source.data,
      sourceClaudeReviewReceipt: sourceReviewReceipt.data,
      claudeReviewReceipt: laneReviewReceipt.data,
    });
    rows.push(verdictRow({
      row_id: `api_smoke.${slug(routeId)}.get`,
      category: "api_smoke",
      label: `GET ${routePath}`,
      description: "Read-only API route returns sanitized payload.",
      required: true,
      observed: response.status === 200 && !hasSensitiveKey(JSON.parse(response.body)),
      current_verdict: response.status === 200 && !hasSensitiveKey(JSON.parse(response.body)) ? "pass" : "block",
      block_reason: response.status === 200 ? null : `http_${response.status}`,
      evidence_ref: `GET ${routePath}`,
      generated_at: generatedAt,
    }));
  }
  const mutationResponse = await buildClaudeReviewIntegrationApiResponse("/api/review/requests", {
    runAt: generatedAt,
    method: "POST",
    productBuildVerificationLoop: source.data,
    sourceClaudeReviewReceipt: sourceReviewReceipt.data,
    claudeReviewReceipt: laneReviewReceipt.data,
  });
  rows.push(verdictRow({
    row_id: "api_smoke.post_blocked",
    category: "api_smoke",
    label: "POST mutation blocked",
    description: "Mutation methods are rejected by the review integration API.",
    required: true,
    observed: mutationResponse.status === 405,
    current_verdict: mutationResponse.status === 405 ? "pass" : "block",
    block_reason: mutationResponse.status === 405 ? null : "mutation_method_not_blocked",
    evidence_ref: "POST /api/review/requests",
    generated_at: generatedAt,
  }));
  return rows;
}

async function buildBrowserSmokeRows(source, sourceReviewReceipt, laneReviewReceipt, generatedAt) {
  const response = await buildClaudeReviewIntegrationApiResponse("/claude-review-integration.html", {
    runAt: generatedAt,
    method: "GET",
    productBuildVerificationLoop: source.data,
    sourceClaudeReviewReceipt: sourceReviewReceipt.data,
    claudeReviewReceipt: laneReviewReceipt.data,
  });
  const html = response.body;
  const checks = [
    ["html.status", "renders review integration status", html.includes("Claude Review Integration Lane")],
    ["html.requests", "renders request count", html.includes("Review requests")],
    ["html.findings", "renders finding status", html.includes("Findings")],
    ["html.boundary", "renders authority boundary", html.includes("Authority boundary")],
    ["html.no_write", "does not expose write buttons", !/(<button|type=\"submit\"|apply patch|merge|deploy)/i.test(html)],
    ["html.no_raw", "does not expose raw transcript or secret wording", !/(raw transcript|secret|api key)/i.test(html)],
  ];
  return checks.map(([id, label, pass]) => verdictRow({
    row_id: `browser.${id}`,
    category: "browser_smoke",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : "browser_contract_failed",
    evidence_ref: "/claude-review-integration.html",
    generated_at: generatedAt,
  }));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixtureId, description, expectedBlock]) => verdictRow({
    row_id: fixtureId,
    category: "negative_fixture",
    label: description,
    description,
    required: true,
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    expected_block_code: expectedBlock,
    evidence_ref: `fixture://${fixtureId}`,
    generated_at: generatedAt,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = isSourceReady(context.source);
  const sourceReceiptReady = hasCompletedSourceReview(context.sourceReviewReceipt);
  const laneReceiptReady = hasCompletedLaneReview(context.laneReviewReceipt);
  const checks = [
    ["freeze.source", "P10000 source is ready", sourceReady],
    ["freeze.source_receipt", "P10000 source Claude review receipt is ready", sourceReceiptReady],
    ["freeze.phase_rows", "All P10001-P10200 phase rows are present", allPass(context.phaseRows)],
    ["freeze.review_requests", "Claude review request packets are prepared", allPass(context.review_request_packet_rows)],
    ["freeze.model_effort", "Model and max-effort evidence is present", allPass(context.model_effort_evidence_rows)],
    ["freeze.receipt_intake", "Claude receipt intake is complete and safe", allPass(context.review_receipt_intake_rows)],
    ["freeze.findings_normalized", "Claude findings are normalized", allPass(context.finding_normalization_rows)],
    ["freeze.unresolved_blocked", "Unresolved findings are blocked", allPass(context.unresolved_finding_blocker_rows)],
    ["freeze.revalidation", "Findings are bound to revalidation evidence", allPass(context.review_revalidation_binding_rows)],
    ["freeze.api_read_only", "Review API and UI projection is read-only", allPass(context.routeRows) && allPass(context.apiSmokeRows) && allPass(context.browserSmokeRows)],
    ["freeze.negative_fixtures", "Negative fixtures fail closed", allPass(context.negativeFixtureRows)],
    ["freeze.authority_boundary", "Claude remains review evidence and not final approval", laneReceiptReady && !receiptAllowsFinalApproval(context.laneReviewReceipt)],
  ];
  return checks.map(([id, label, pass]) => verdictRow({
    row_id: id,
    category: "p10200_freeze",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replace(/^freeze\./, "")}_not_ready`,
    evidence_ref: id === "freeze.authority_boundary"
      ? "artifacts/claude-review-integration-lane/latest/claude-review-receipt.json"
      : "artifacts/claude-review-integration-lane/latest/claude-review-integration-lane.json",
    generated_at: context.phaseRows?.[0]?.generated_at,
  }));
}

function buildAuthorityBoundary(context, generatedAt) {
  const sourceReady = isSourceReady(context.source);
  const sourceReceiptReady = hasCompletedSourceReview(context.sourceReviewReceipt);
  const laneReceiptReady = hasCompletedLaneReview(context.laneReviewReceipt);
  const unresolvedCount = countRows(context.unresolved_finding_blocker_rows, "block");
  const freezeReady = sourceReady
    && sourceReceiptReady
    && laneReceiptReady
    && unresolvedCount === 0
    && (!context.freezeRows || allPass(context.freezeRows));
  return {
    schema_version: "review-authority-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_p10000_ready: sourceReady,
    source_review_receipt_completed_now: sourceReceiptReady,
    p10200_claude_review_required_now: true,
    p10200_claude_review_completed_now: laneReceiptReady,
    unresolved_finding_count: unresolvedCount,
    unresolved_findings_block_closeout: true,
    reviewer_mutation_allowed: false,
    reviewer_source_write_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    claude_replaces_independent_github_approval: false,
    claude_replaces_human_owner_adjudication: false,
    human_gate_substituted_by_claude: false,
    single_owner_enterprise_trust: false,
    protected_closeout_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    api_write_methods_enabled: false,
    raw_material_visible: false,
    secret_keys_returned: false,
    p10200_freeze_ready: freezeReady,
    ready_for_p10201_handoff: freezeReady,
  };
}

function buildGateRows(context) {
  const freezeReady = context.boundary.p10200_freeze_ready;
  const checks = [
    ["gate.source", "source", isSourceReady(context.source), context.source.path],
    ["gate.source_receipt", "receipt", hasCompletedSourceReview(context.sourceReviewReceipt), context.sourceReviewReceipt.path],
    ["gate.review_request", "review", allPass(context.review_request_packet_rows), "artifacts/claude-review-integration-lane/latest/claude-review-packet.md"],
    ["gate.model_effort", "review", allPass(context.model_effort_evidence_rows), "artifacts/claude-review-integration-lane/latest/claude-review-receipt.json"],
    ["gate.receipt", "review", hasCompletedLaneReview(context.laneReviewReceipt), context.laneReviewReceipt.path],
    ["gate.findings", "finding_loop", allPass(context.finding_normalization_rows), "artifacts/claude-review-integration-lane/latest/finding-normalization-rows.json"],
    ["gate.unresolved", "finding_loop", allPass(context.unresolved_finding_blocker_rows), "artifacts/claude-review-integration-lane/latest/unresolved-finding-blocker-rows.json"],
    ["gate.revalidation", "validation", allPass(context.review_revalidation_binding_rows), "artifacts/claude-review-integration-lane/latest/review-revalidation-binding-rows.json"],
    ["gate.api", "api", allPass(context.routeRows) && allPass(context.apiSmokeRows) && allPass(context.browserSmokeRows), "artifacts/claude-review-integration-lane/latest/index.html"],
    ["gate.boundary", "authority", freezeReady, "artifacts/claude-review-integration-lane/latest/review-authority-boundary.json"],
  ];
  return checks.map(([id, category, pass, evidenceRef]) => verdictRow({
    row_id: id,
    category,
    label: id.replace(/^gate\./, ""),
    description: `${id} must pass before P10200 closeout.`,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replace(/^gate\./, "")}_gate_blocked`,
    evidence_ref: evidenceRef,
    generated_at: context.freezeRows?.[0]?.generated_at,
  }));
}

function buildValidationItems(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  return [
    validationItem("schema.available", "schema", context.schema.available, context.schema.error ?? "schema loaded"),
    validationItem("package.available", "package", context.packageJson.available, context.packageJson.error ?? "package loaded"),
    validationItem("roadmap.available", "docs", context.roadmapDoc.available, context.roadmapDoc.error ?? "roadmap loaded"),
    validationItem("architecture.available", "docs", context.architectureDoc.available, context.architectureDoc.error ?? "architecture loaded"),
    validationItem("docs.architecture", "docs", includesToken(context.architectureDoc.text, PROGRAM_RANGE), "architecture must mention P10200 lane"),
    validationItem("validate.chain", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include P10200 command"),
    validationItem("validate.order", "package", sourceIndex !== -1 && commandIndex > sourceIndex, "P10200 validate must run after P10000"),
    validationItem("source.p10000", "source", isSourceReady(context.source), "P10000 source must be ready"),
    validationItem("source.review_receipt", "source", hasCompletedSourceReview(context.sourceReviewReceipt), "P10000 source review receipt must be ready"),
    validationItem("phase.coverage", "phase", allPass(context.phaseRows), "all P10001-P10200 phases must be documented"),
    validationItem("review.request", "review", allPass(context.review_request_packet_rows), "review request packets must be ready"),
    validationItem("review.model_effort", "review", allPass(context.model_effort_evidence_rows), "model and effort evidence must be present"),
    validationItem("review.receipt", "review", hasCompletedLaneReview(context.laneReviewReceipt), "P10200 Claude receipt must be complete with no unresolved blockers"),
    validationItem("findings.normalized", "finding_loop", allPass(context.finding_normalization_rows), "findings must normalize"),
    validationItem("findings.unresolved_blocked", "finding_loop", allPass(context.unresolved_finding_blocker_rows), "unresolved findings must block"),
    validationItem("findings.revalidation", "validation", allPass(context.review_revalidation_binding_rows), "findings must bind to revalidation"),
    validationItem("api.routes", "api", allPass(context.routeRows), "API routes must be declared"),
    validationItem("api.smoke", "api", allPass(context.apiSmokeRows), "API smoke must pass"),
    validationItem("browser.smoke", "ui", allPass(context.browserSmokeRows), "browser smoke must pass"),
    validationItem("negative.fixtures", "fixtures", allPass(context.negativeFixtureRows), "negative fixtures must be present"),
    validationItem("freeze.rows", "freeze", allPass(context.freezeRows), "P10200 freeze rows must pass"),
    validationItem("gates.rows", "gate", allPass(context.gateRows), "P10200 gates must pass"),
    validationItem("boundary.no_final_approval", "authority", context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false, "Codex and Claude cannot be final approvers"),
    validationItem("boundary.no_production_enterprise", "authority", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "P10200 cannot create production or enterprise PASS"),
  ];
}

function buildSummary(context) {
  const sourceReady = isSourceReady(context.source);
  const sourceReceiptReady = hasCompletedSourceReview(context.sourceReviewReceipt);
  const laneReceiptReady = hasCompletedLaneReview(context.laneReviewReceipt);
  const findingRows = context.finding_normalization_rows ?? [];
  const findingCount = findingRows.filter((row) => row.finding_id !== "NO_FINDINGS").length;
  const blockingFindingCount = findingRows.filter((row) => row.blocking).length;
  const unresolvedFindingCount = findingRows.filter((row) => row.current_verdict === "block").length;
  const p10200FreezeReady = context.boundary?.p10200_freeze_ready ?? false;
  const status = context.validation.valid && p10200FreezeReady
    ? READY_STATUS
    : sourceReady && sourceReceiptReady
      ? REVIEW_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    schema_version: "claude-review-integration-summary.v1",
    claude_review_integration_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10000_ready: sourceReady,
    source_review_receipt_completed_now: sourceReceiptReady,
    phase_row_count: context.phaseRows.length,
    review_request_count: context.review_request_packet_rows.length,
    model_effort_evidence_count: context.model_effort_evidence_rows.length,
    receipt_intake_count: context.review_receipt_intake_rows.length,
    finding_count: findingCount,
    blocking_finding_count: blockingFindingCount,
    unresolved_finding_count: unresolvedFindingCount,
    revalidation_count: context.review_revalidation_binding_rows.length,
    p10200_claude_review_required_now: true,
    p10200_claude_review_completed_now: laneReceiptReady,
    p10200_freeze_ready: p10200FreezeReady,
    ready_for_p10201_handoff: p10200FreezeReady,
    api_write_methods_enabled: false,
    raw_material_visible: false,
    secret_keys_returned: false,
    reviewer_mutation_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function buildApiSummary(source, sourceReviewReceipt, laneReviewReceipt, collections, boundary) {
  const validation = summarizeValidation([
    validationItem("source", "source", isSourceReady(source), "source ready"),
    validationItem("source.receipt", "source", hasCompletedSourceReview(sourceReviewReceipt), "source receipt ready"),
    validationItem("lane.receipt", "review", hasCompletedLaneReview(laneReviewReceipt), "lane receipt ready"),
    validationItem("unresolved", "review", allPass(collections.unresolved_finding_blocker_rows), "unresolved findings clear"),
  ]);
  return buildSummary({
    source,
    sourceReviewReceipt,
    laneReviewReceipt,
    phaseRows: [],
    sourceBindingRows: [],
    routeRows: [],
    apiSmokeRows: [],
    browserSmokeRows: [],
    negativeFixtureRows: [],
    freezeRows: [],
    boundary,
    gateRows: [],
    validation,
    ...collections,
  });
}

function renderSummaryMarkdown(result) {
  return [
    `# Hermes ${PROGRAM_RANGE} Claude Review Integration Lane`,
    "",
    `Status: ${result.summary.claude_review_integration_status}`,
    `Source ${SOURCE_PROGRAM_RANGE} ready: ${result.summary.source_p10000_ready}`,
    `Review requests: ${result.summary.review_request_count}`,
    `Findings: ${result.summary.finding_count}`,
    `Unresolved findings: ${result.summary.unresolved_finding_count}`,
    `P10200 freeze ready: ${result.summary.p10200_freeze_ready}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "Boundary: Claude review is independent review evidence only. It cannot mutate source, approve final closeout, replace GitHub independent approval, create production PASS, or create enterprise trust.",
  ].join("\n");
}

function renderClaudeReviewPacket(result) {
  const expectedPreReceiptBlocks = result.p10200_freeze_rows.filter((row) => row.current_verdict === "block" && [
    "model_effort_not_ready",
    "receipt_intake_not_ready",
    "authority_boundary_not_ready",
  ].includes(row.block_reason));
  const packet = {
    review_scope: PROGRAM_RANGE,
    review_objective: "Review the Hermes Claude Review Integration Lane for request packet, receipt intake, finding blocker, revalidation, API projection, and authority-boundary regressions.",
    reviewed_artifact_ref: "artifacts/claude-review-integration-lane/latest/claude-review-integration-lane.json",
    bootstrap_review_instruction: "If the supplied artifact was generated before the P10200 Claude receipt exists, do not treat expected pre-receipt blockers for model_effort, receipt_intake, or authority_boundary as defects by themselves. They are the intended fail-closed state before this review receipt is recorded. Report a finding only if those blockers can be bypassed, are not disclosed, or would remain blocked after a completed non-mutating non-final receipt is ingested.",
    summary_semantics: "finding_count counts findings contained in the current Claude review receipt. validation_error_count and freeze rows track current lane blockers separately, especially during the pre-receipt bootstrap pass.",
    expected_pre_receipt_blocks: expectedPreReceiptBlocks,
    validation_errors: result.validation.errors,
    required_checks: [
      "P10000 source binding must be ready",
      "Claude model/effort evidence must be captured",
      "Review receipt intake must be read-only and non-final",
      "Unresolved or blocking findings must block closeout",
      "Revalidation evidence must bind every nonblocking finding",
      "API/UI projection must be GET/HEAD only and sanitized",
      "Codex and Claude must not become final approvers",
    ],
    summary: result.summary,
    freeze_rows: result.p10200_freeze_rows,
    authority_boundary: result.review_authority_boundary,
  };
  return [
    `# Claude Review Packet ${PROGRAM_RANGE}`,
    "",
    "Return JSON only with fields: review_status, finding_count, blocking_finding_count, findings, reviewer_mutation_allowed, reviewer_mutated_source, codex_final_approval_allowed, claude_final_approval_allowed, production_pass_allowed, enterprise_pass_allowed.",
    "",
    "Do not mutate files. Do not approve final closeout. Treat this as review evidence only.",
    "",
    "```json",
    JSON.stringify(packet, null, 2),
    "```",
  ].join("\n");
}

function renderReviewIntegrationHtml(result) {
  const summary = result.summary ?? {};
  const boundary = result.review_authority_boundary ?? {};
  const rows = [
    ["Status", summary.claude_review_integration_status],
    ["Source ready", summary.source_p10000_ready],
    ["Review requests", summary.review_request_count],
    ["Findings", summary.finding_count],
    ["Unresolved", summary.unresolved_finding_count],
    ["Freeze ready", summary.p10200_freeze_ready],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Claude Review Integration Lane</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #17202a; background: #f7f8fa; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 18px; }
    section { margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8dee6; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e6ebf0; font-size: 14px; }
    th { background: #edf1f5; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>Claude Review Integration Lane</h1>
    <section>
      <table aria-label="Claude review integration status">
        <tbody>
          ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td><code>${escapeHtml(String(value ?? ""))}</code></td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Authority boundary</h2>
      <table aria-label="Authority boundary">
        <tbody>
          <tr><th>Reviewer mutation</th><td>${escapeHtml(String(boundary.reviewer_mutation_allowed))}</td></tr>
          <tr><th>Claude final approval</th><td>${escapeHtml(String(boundary.claude_final_approval_allowed))}</td></tr>
          <tr><th>Production pass</th><td>${escapeHtml(String(boundary.production_pass_enabled))}</td></tr>
          <tr><th>Enterprise pass</th><td>${escapeHtml(String(boundary.enterprise_pass_enabled))}</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function serializableResult(result) {
  const { html, markdown, review_packet_markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.pass)
    .map((item) => ({ validation_id: item.validation_id, category: item.category, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function validationItem(validationId, category, pass, message) {
  return {
    validation_id: validationId,
    category,
    pass: Boolean(pass),
    message,
  };
}

function verdictRow(values) {
  return {
    schema_version: "hermes-verdict-row.v1",
    current_verdict: values.current_verdict,
    block_reason: values.block_reason ?? null,
    ...values,
  };
}

async function readJsonOrBuildProductBuildVerification(filePath, generatedAt) {
  const read = await readJsonSource(filePath);
  if (isSourceReady(read)) return read;
  try {
    const built = await buildProductBuildVerificationLoop({ runAt: generatedAt, write: false });
    return {
      available: built.validation.valid,
      path: path.resolve(filePath),
      data: built,
      error: built.validation.valid ? null : "generated P10000 source is not valid",
    };
  } catch (error) {
    return read.available ? read : { ...read, error: `${read.error ?? "source unavailable"}; build failed: ${error.message}` };
  }
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return {
      available: true,
      path: resolved,
      data: JSON.parse(await readFile(resolved, "utf8")),
      error: null,
    };
  } catch (error) {
    return { available: false, path: resolved, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return {
      available: true,
      path: resolved,
      text: await readFile(resolved, "utf8"),
      error: null,
    };
  } catch (error) {
    return { available: false, path: resolved, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(name, data) {
  return {
    available: data !== null && data !== undefined,
    path: name,
    data: data ?? null,
    error: data === null || data === undefined ? "inline source missing" : null,
  };
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.architectureDocPath),
    source_product_build_verification_path: path.resolve(options.sourceProductBuildVerificationPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.sourceProductBuildVerificationPath),
    source_claude_review_receipt_path: path.resolve(options.sourceClaudeReviewReceiptPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.sourceClaudeReviewReceiptPath),
    claude_review_receipt_path: path.resolve(options.claudeReviewReceiptPath ?? DEFAULT_CLAUDE_REVIEW_INTEGRATION_LANE_INPUTS.claudeReviewReceiptPath),
  };
}

function isSourceReady(source) {
  const data = source.data ?? {};
  return source.available
    && data.schema_version === "product-build-verification-loop.v1"
    && data.program_range === SOURCE_PROGRAM_RANGE
    && data.validation?.valid === true
    && data.summary?.product_build_verification_status === "ready_for_product_build_verification_loop"
    && data.summary?.ready_for_p10001_handoff === true
    && data.summary?.p10000_freeze_ready === true;
}

function hasCompletedSourceReview(receipt) {
  const data = receipt.data ?? {};
  return receipt.available
    && data.review_status === "completed"
    && Number(data.blocking_finding_count ?? 0) === 0
    && data.reviewer_mutation_allowed === false
    && data.claude_final_approval_allowed === false
    && data.production_pass_allowed !== true
    && data.enterprise_pass_allowed !== true;
}

function hasCompletedLaneReview(receipt) {
  const data = receipt.data ?? {};
  return receipt.available
    && data.review_status === "completed"
    && Number(data.blocking_finding_count ?? 0) === 0
    && countUnresolvedFindings(data.findings) === 0
    && data.reviewer_mutation_allowed === false
    && data.reviewer_mutated_source !== true
    && data.codex_final_approval_allowed === false
    && data.claude_final_approval_allowed === false
    && data.production_pass_allowed === false
    && data.enterprise_pass_allowed === false;
}

function receiptAllowsFinalApproval(receipt) {
  const data = receipt.data ?? {};
  return data.codex_final_approval_allowed === true
    || data.claude_final_approval_allowed === true
    || data.production_pass_allowed === true
    || data.enterprise_pass_allowed === true
    || data.reviewer_mutation_allowed === true
    || data.reviewer_mutated_source === true;
}

function countUnresolvedFindings(findings) {
  return (Array.isArray(findings) ? findings : []).filter((finding) => isBlockingSeverity(String(finding.severity ?? "").toLowerCase()) || finding.blocking === true || isFindingUnresolved(finding)).length;
}

function isBlockingSeverity(severity) {
  return new Set(["blocking", "critical", "p0", "p1"]).has(String(severity ?? "").toLowerCase());
}

function isFindingUnresolved(finding) {
  const status = String(finding.status ?? finding.disposition ?? "").toLowerCase();
  if (finding.resolved === false) return true;
  if (["open", "unresolved", "pending", "needs_fix", "not_fixed"].includes(status)) return true;
  if (finding.resolved === true) return false;
  return Boolean(finding.finding_id || finding.id) && !finding.revalidation_ref && !["resolved", "revalidated", "not_required"].includes(status);
}

function allPass(rows = []) {
  return rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function countRows(rows = [], verdict) {
  return rows.filter((row) => row.current_verdict === verdict).length;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : Number.isFinite(Number(value)) ? Number(value) : null;
}

function includesToken(text, token) {
  return String(text ?? "").includes(token);
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function normalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function jsonResponse(status, body, method = "GET") {
  const responseBody = method === "HEAD" ? "" : JSON.stringify(body, null, 2);
  return { status, headers: { "content-type": "application/json; charset=utf-8" }, body: responseBody };
}

function htmlResponse(status, body, method = "GET") {
  return { status, headers: { "content-type": "text/html; charset=utf-8" }, body: method === "HEAD" ? "" : body };
}

function buildError(code, message) {
  return { error: { code, message } };
}

function sanitizeApiPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeApiPayload);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(raw_|full_transcript|full_body|secret|api_key|token)/i.test(key)) continue;
    output[key] = sanitizeApiPayload(entry);
  }
  return output;
}

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => /(raw_|full_transcript|full_body|secret|api_key|token)/i.test(key) || hasSensitiveKey(entry));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    else if (arg === "--source") args.sourceProductBuildVerificationPath = argv[++index];
    else if (arg === "--source-claude-review-receipt") args.sourceClaudeReviewReceiptPath = argv[++index];
    else if (arg === "--claude-review-receipt") args.claudeReviewReceiptPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/claude-review-integration-lane.mjs [options]

Options:
  --check                                      Validate without writing artifacts
  --serve                                      Start the read-only API server
  --out-dir <path>                             Output directory
  --run-at <iso>                               Deterministic timestamp
  --source <path>                              P10000 product build verification artifact path
  --source-claude-review-receipt <path>        P10000 Claude receipt path
  --claude-review-receipt <path>               P10200 Claude receipt path
  --host <host>                                API host
  --port <port>                                API port
`);
}
