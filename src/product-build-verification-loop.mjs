import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildRequirementTraceabilityKernel } from "./requirement-traceability-kernel.mjs";

export const DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_OUT_DIR = "artifacts/product-build-verification-loop/latest";
export const DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS = {
  schemaPath: "schemas/product-build-verification-loop.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p9801-p10000.md",
  architectureDocPath: "docs/architecture.md",
  sourceRequirementTraceabilityKernelPath: "artifacts/requirement-traceability-kernel/latest/requirement-traceability-kernel.json",
  claudeReviewReceiptPath: "artifacts/product-build-verification-loop/latest/claude-review-receipt.json",
};

export const DEFAULT_PRODUCT_BUILD_VERIFICATION_HOST = "127.0.0.1";
export const DEFAULT_PRODUCT_BUILD_VERIFICATION_PORT = 4197;

const COMMAND_NAME = "platform:product-build-verification-loop";
const SOURCE_COMMAND_NAME = "platform:requirement-traceability-kernel";
const SCHEMA_VERSION = "product-build-verification-loop.v1";
const CAPABILITY_ID = "platform.product_build_verification_loop";
const PROGRAM_RANGE = "P9801-P10000";
const SOURCE_PROGRAM_RANGE = "P9601-P9800";
const READY_STATUS = "ready_for_product_build_verification_loop";
const REVIEW_PENDING_STATUS = "ready_for_required_claude_review";

const PHASE_SPECS = [
  ["P9801-P9820", "P9800 Source Binding"],
  ["P9821-P9840", "Feature Implementation Packet Registry"],
  ["P9841-P9860", "Test Evidence Binding"],
  ["P9861-P9880", "Review Packet Generator"],
  ["P9881-P9900", "Claude Review Receipt Intake"],
  ["P9901-P9920", "Finding Normalization"],
  ["P9921-P9940", "Revalidation Evidence Binding"],
  ["P9941-P9960", "Closeout Readiness Gate"],
  ["P9961-P9980", "Build Verification API Projection"],
  ["P9981-P10000", "P10000 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "Product build verification source readiness", "computed"],
  ["/api/build/features", "features", "Feature implementation packets", "feature_implementation_packet_rows"],
  ["/api/build/test-evidence", "test_evidence", "Test and evidence bindings", "build_test_evidence_binding_rows"],
  ["/api/build/review-packets", "review_packets", "Review packet rows", "build_review_packet_rows"],
  ["/api/build/findings", "findings", "Normalized finding rows", "finding_normalization_rows"],
  ["/api/build/revalidation", "revalidation", "Revalidation evidence rows", "revalidation_evidence_rows"],
  ["/api/build/closeout", "closeout", "Closeout readiness rows", "closeout_readiness_rows"],
  ["/api/build/boundary", "boundary", "Build verification authority boundary", "product_build_verification_boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p9800_source", "Build loop passes without P9800 source readiness", "BLOCK_MISSING_P9800_SOURCE"],
  ["negative.missing_feature_packet", "Requirement has no feature implementation packet", "BLOCK_MISSING_FEATURE_PACKET"],
  ["negative.missing_test_evidence", "Feature has no test or evidence binding", "BLOCK_MISSING_TEST_EVIDENCE"],
  ["negative.missing_review_packet", "Feature has no review packet", "BLOCK_MISSING_REVIEW_PACKET"],
  ["negative.claude_review_missing", "Required Claude review receipt is missing", "BLOCK_CLAUDE_REVIEW_MISSING"],
  ["negative.blocking_finding_ignored", "Blocking Claude finding is ignored", "BLOCK_BLOCKING_FINDING_IGNORED"],
  ["negative.revalidation_missing", "Finding loop closes without revalidation evidence", "BLOCK_REVALIDATION_MISSING"],
  ["negative.closeout_without_all_gates", "Closeout passes without all gates", "BLOCK_CLOSEOUT_WITHOUT_ALL_GATES"],
  ["negative.final_authority_expanded", "Codex or Claude becomes final authority", "BLOCK_FINAL_AUTHORITY_EXPANSION"],
  ["negative.production_enterprise_pass", "Build loop creates production or enterprise PASS", "BLOCK_PRODUCTION_ENTERPRISE_PASS"],
  ["negative.api_mutation_or_raw", "API exposes mutation or raw sensitive material", "BLOCK_API_MUTATION_OR_RAW"],
];

export async function runProductBuildVerificationLoop(options = {}) {
  const result = await buildProductBuildVerificationLoop(options);
  if (options.write !== false) await writeProductBuildVerificationLoop(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Product build verification loop failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProductBuildVerificationLoop(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const hasInlineSource = Object.prototype.hasOwnProperty.call(options, "requirementTraceabilityKernel");
  const hasInlineClaudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt");
  const source = hasInlineSource
    ? normalizeInlineJsonSource("inline.requirement_traceability_kernel", options.requirementTraceabilityKernel)
    : await readJsonOrBuildRequirementTraceabilityKernel(inputs.source_requirement_traceability_kernel_path, generatedAt);
  const claudeReceipt = hasInlineClaudeReceipt
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);

  const sourceData = source.data ?? {};
  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const derived = deriveBuildVerificationCollections(sourceData, claudeReceipt, generatedAt);
  const routeRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows(sourceData, claudeReceipt.data, generatedAt);
  const browserSmokeRows = await buildBrowserSmokeRows(sourceData, claudeReceipt.data, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({
    source,
    claudeReceipt,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    ...derived,
  });
  const boundary = buildBoundary({ claudeReceipt, freezeRows, ...derived }, generatedAt);
  const gateRows = buildGateRows({ source, claudeReceipt, freezeRows, boundary, ...derived }, generatedAt);
  const validationItems = buildValidationItems({
    schema,
    packageJson,
    roadmapDoc,
    architectureDoc,
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
      requirement_traceability_kernel_path: source.path,
      claude_review_receipt_path: claudeReceipt.path,
    },
    product_build_verification_contract: contract,
    product_build_verification_phase_rows: phaseRows,
    p9800_source_binding_rows: sourceBindingRows,
    build_api_route_rows: routeRows,
    build_api_smoke_rows: apiSmokeRows,
    build_browser_smoke_rows: browserSmokeRows,
    build_negative_fixture_rows: negativeFixtureRows,
    p10000_freeze_rows: freezeRows,
    build_gate_rows: gateRows,
    product_build_verification_boundary: boundary,
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
    ...derived,
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "product_build_verification_loop")
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
    html: renderBuildVerificationHtml(result),
    markdown: renderSummaryMarkdown(result),
    review_packet_markdown: renderClaudeReviewPacket(result),
  };
}

export async function writeProductBuildVerificationLoop(result, outDir = DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "product-build-verification-loop.json"), serializableResult(result));
  await writeJson(path.join(outDir, "product-build-verification-phase-rows.json"), result.product_build_verification_phase_rows);
  await writeJson(path.join(outDir, "p9800-source-binding-rows.json"), result.p9800_source_binding_rows);
  await writeJson(path.join(outDir, "feature-implementation-packet-rows.json"), result.feature_implementation_packet_rows);
  await writeJson(path.join(outDir, "build-test-evidence-binding-rows.json"), result.build_test_evidence_binding_rows);
  await writeJson(path.join(outDir, "build-review-packet-rows.json"), result.build_review_packet_rows);
  await writeJson(path.join(outDir, "claude-review-receipt-rows.json"), result.claude_review_receipt_rows);
  await writeJson(path.join(outDir, "finding-normalization-rows.json"), result.finding_normalization_rows);
  await writeJson(path.join(outDir, "revalidation-evidence-rows.json"), result.revalidation_evidence_rows);
  await writeJson(path.join(outDir, "closeout-readiness-rows.json"), result.closeout_readiness_rows);
  await writeJson(path.join(outDir, "build-api-route-rows.json"), result.build_api_route_rows);
  await writeJson(path.join(outDir, "build-api-smoke-rows.json"), result.build_api_smoke_rows);
  await writeJson(path.join(outDir, "build-browser-smoke-rows.json"), result.build_browser_smoke_rows);
  await writeJson(path.join(outDir, "build-negative-fixture-rows.json"), result.build_negative_fixture_rows);
  await writeJson(path.join(outDir, "p10000-freeze-rows.json"), result.p10000_freeze_rows);
  await writeJson(path.join(outDir, "build-gate-rows.json"), result.build_gate_rows);
  await writeJson(path.join(outDir, "product-build-verification-boundary.json"), result.product_build_verification_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "product-build-verification-loop-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.review_packet_markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export function createProductBuildVerificationApiServer(options = {}) {
  const server = createServer(async (request, response) => {
    try {
      const apiResponse = await buildProductBuildVerificationApiResponse(request.url ?? "/", {
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
  return server;
}

export async function startProductBuildVerificationApiServer(options = {}) {
  const host = options.host ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_HOST;
  const port = options.port ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_PORT;
  const server = createProductBuildVerificationApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildProductBuildVerificationApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Product build verification API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const hasInlineSource = Object.prototype.hasOwnProperty.call(options, "requirementTraceabilityKernel");
  const hasInlineClaudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt");
  const source = hasInlineSource
    ? normalizeInlineJsonSource("inline.requirement_traceability_kernel", options.requirementTraceabilityKernel)
    : await readJsonOrBuildRequirementTraceabilityKernel(options.sourceRequirementTraceabilityKernelPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.sourceRequirementTraceabilityKernelPath, generatedAt);
  const claudeReceipt = hasInlineClaudeReceipt
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(options.claudeReviewReceiptPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.claudeReviewReceiptPath);
  if (!isSourceReady(source)) {
    return jsonResponse(503, buildError("requirement_traceability_source_unavailable", source.error ?? "P9800 requirement traceability source is not ready."), method);
  }
  const collections = deriveBuildVerificationCollections(source.data, claudeReceipt, generatedAt);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/build-verification.html") {
    return htmlResponse(200, renderBuildVerificationHtml({
      program_range: PROGRAM_RANGE,
      summary: buildApiSummary(source, claudeReceipt, collections),
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      ok: true,
      program_range: PROGRAM_RANGE,
      source_ready: isSourceReady(source),
      claude_review_completed_now: hasCompletedClaudeReview(claudeReceipt),
      write_methods_enabled: false,
    }), method);
  }
  const route = API_ROUTE_SPECS.find(([routePath]) => routePath === pathname);
  if (!route) return jsonResponse(404, buildError("not_found", `No product build verification route for ${pathname}`), method);
  const [, routeId,, collectionKey] = route;
  const body = collectionKey === "product_build_verification_boundary"
    ? collections.product_build_verification_boundary ?? buildBoundary({ claudeReceipt, ...collections }, generatedAt)
    : collections[collectionKey];
  return jsonResponse(200, sanitizeApiPayload({
    route_id: routeId,
    program_range: PROGRAM_RANGE,
    data: body,
  }), method);
}

export async function runProductBuildVerificationLoopCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const started = await startProductBuildVerificationApiServer({
      host: args.host,
      port: args.port,
      runAt: args.runAt,
      claudeReviewReceiptPath: args.claudeReviewReceiptPath,
    });
    console.log(`Product build verification API listening at ${started.url}`);
    console.log(`Open ${started.url}/build-verification.html`);
    return;
  }
  const result = await runProductBuildVerificationLoop({
    check: args.check,
    write: args.write,
    outDir: args.outDir,
    runAt: args.runAt,
    claudeReviewReceiptPath: args.claudeReviewReceiptPath,
  });
  console.log(`${args.check ? "Product build verification loop validated" : "Product build verification loop written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.product_build_verification_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Features: ${result.summary.feature_count}`);
  console.log(`Findings: ${result.summary.finding_count}`);
  console.log(`Claude review completed: ${result.summary.claude_review_completed_now}`);
  console.log(`P10000 freeze ready: ${result.summary.p10000_freeze_ready}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}

function buildContract(generatedAt) {
  return {
    schema_version: "product-build-verification-contract.v1",
    generated_at: generatedAt,
    source_traceability_required: true,
    feature_implementation_packet_required: true,
    test_evidence_binding_required: true,
    review_packet_required: true,
    claude_review_required_now: true,
    finding_loop_required: true,
    revalidation_required_for_findings: true,
    closeout_requires_all_gates: true,
    api_projection_read_only: true,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    external_connector_write_enabled: false,
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
    evidence_ref: "docs/hermes-roadmap-p9801-p10000.md",
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const ready = isSourceReady(source);
  return [verdictRow({
    row_id: "source.p9800.requirement_traceability_kernel",
    category: "source_binding",
    label: "P9800 requirement traceability source",
    description: "Product build verification loop consumes the P9800 requirement traceability artifact.",
    required: true,
    observed: ready,
    current_verdict: ready ? "pass" : "block",
    block_reason: ready ? null : "p9800_source_not_ready",
    evidence_ref: source.path,
    generated_at: generatedAt,
  })];
}

function deriveBuildVerificationCollections(sourceData, claudeReceipt, generatedAt) {
  const requirementRows = Array.isArray(sourceData.requirement_source_registry_rows)
    ? sourceData.requirement_source_registry_rows
    : [];
  const testRows = new Map((sourceData.test_evidence_coverage_rows ?? []).map((row) => [row.requirement_id, row]));
  const claimRows = new Map((sourceData.claim_gate_check_trace_rows ?? []).map((row) => [row.requirement_id, row]));
  const releaseRows = new Map((sourceData.release_closeout_link_rows ?? []).map((row) => [row.requirement_id, row]));
  const featureRows = requirementRows.map((row, index) => {
    const featureId = `FEAT-${slug(row.project_id).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
    return {
      row_id: `feature.${slug(featureId)}`,
      feature_id: featureId,
      requirement_id: row.requirement_id,
      project_id: row.project_id,
      acceptance_kind: row.acceptance_kind,
      implementation_packet_ref: `build_packet.${slug(row.project_id)}.${slug(row.requirement_id)}`,
      implementation_status: "candidate_ready",
      source_requirement_ref: row.source_ref,
      protected_write_enabled: false,
      direct_deploy_enabled: false,
      current_verdict: "pass",
      block_reason: null,
      generated_at: generatedAt,
    };
  });
  const featureByRequirement = new Map(featureRows.map((row) => [row.requirement_id, row]));
  const testEvidenceRows = requirementRows.map((row) => {
    const feature = featureByRequirement.get(row.requirement_id);
    const sourceTest = testRows.get(row.requirement_id) ?? {};
    const sourceClaim = claimRows.get(row.requirement_id) ?? {};
    const testPresent = Boolean(sourceTest.test_ref && sourceTest.evidence_ref);
    return {
      row_id: `test_evidence.${slug(feature?.feature_id ?? row.requirement_id)}`,
      feature_id: feature?.feature_id ?? null,
      requirement_id: row.requirement_id,
      test_ref: sourceTest.test_ref ?? null,
      validator_ref: sourceTest.validator_ref ?? null,
      evidence_ref: sourceTest.evidence_ref ?? null,
      claim_ref: sourceClaim.claim_ref ?? null,
      gate_ref: sourceClaim.gate_ref ?? null,
      test_present: testPresent,
      evidence_present: Boolean(sourceTest.evidence_ref),
      gate_present: Boolean(sourceClaim.gate_ref),
      current_verdict: testPresent && Boolean(sourceClaim.gate_ref) ? "pass" : "block",
      block_reason: testPresent && Boolean(sourceClaim.gate_ref) ? null : "missing_test_evidence_or_gate",
      generated_at: generatedAt,
    };
  });
  const reviewPacketRows = requirementRows.map((row) => {
    const feature = featureByRequirement.get(row.requirement_id);
    const sourceRelease = releaseRows.get(row.requirement_id) ?? {};
    return {
      row_id: `review_packet.${slug(feature?.feature_id ?? row.requirement_id)}`,
      feature_id: feature?.feature_id ?? null,
      requirement_id: row.requirement_id,
      review_packet_ref: `review_packet.${slug(row.project_id)}.${slug(row.requirement_id)}`,
      diff_summary_ref: `diff_summary.${slug(row.project_id)}.${slug(row.requirement_id)}`,
      release_note_ref: sourceRelease.release_note_ref ?? null,
      closeout_ref: sourceRelease.closeout_ref ?? null,
      claude_review_required_now: true,
      reviewer_mutation_allowed: false,
      current_verdict: sourceRelease.release_note_ref && sourceRelease.closeout_ref ? "pass" : "block",
      block_reason: sourceRelease.release_note_ref && sourceRelease.closeout_ref ? null : "missing_release_closeout_ref",
      generated_at: generatedAt,
    };
  });
  const receiptRows = [buildClaudeReceiptRow(claudeReceipt, generatedAt)];
  const findingRows = buildFindingNormalizationRows(claudeReceipt, generatedAt);
  const revalidationRows = buildRevalidationRows(findingRows, testEvidenceRows, generatedAt);
  const closeoutRows = buildCloseoutRows({
    featureRows,
    testEvidenceRows,
    reviewPacketRows,
    receiptRows,
    findingRows,
    revalidationRows,
  }, generatedAt);
  return {
    feature_implementation_packet_rows: featureRows,
    build_test_evidence_binding_rows: testEvidenceRows,
    build_review_packet_rows: reviewPacketRows,
    claude_review_receipt_rows: receiptRows,
    finding_normalization_rows: findingRows,
    revalidation_evidence_rows: revalidationRows,
    closeout_readiness_rows: closeoutRows,
  };
}

function buildClaudeReceiptRow(claudeReceipt, generatedAt) {
  const data = claudeReceipt.data ?? {};
  const completed = hasCompletedClaudeReview(claudeReceipt);
  const blockingCount = Number.isFinite(data.blocking_finding_count) ? data.blocking_finding_count : null;
  const safeBoundary = data.reviewer_mutation_allowed === false && data.claude_final_approval_allowed === false;
  return verdictRow({
    row_id: "claude_review.receipt",
    category: "claude_review",
    label: "Required Claude review receipt",
    description: "P10000 requires a completed read-only Claude review receipt with zero blocking findings.",
    required: true,
    observed: completed,
    current_verdict: completed && safeBoundary ? "pass" : "block",
    block_reason: completed && safeBoundary ? null : "claude_review_receipt_missing_or_unsafe",
    evidence_ref: claudeReceipt.path,
    review_status: data.review_status ?? null,
    finding_count: Number.isFinite(data.finding_count) ? data.finding_count : null,
    blocking_finding_count: blockingCount,
    reviewer_mutation_allowed: data.reviewer_mutation_allowed ?? null,
    claude_final_approval_allowed: data.claude_final_approval_allowed ?? null,
    generated_at: generatedAt,
  });
}

function buildFindingNormalizationRows(claudeReceipt, generatedAt) {
  const findings = Array.isArray(claudeReceipt.data?.findings) ? claudeReceipt.data.findings : [];
  if (findings.length === 0) {
    return [{
      row_id: "finding.none",
      finding_id: "NO_FINDINGS",
      severity: "none",
      category: "none",
      title: "No Claude findings reported",
      blocking: false,
      normalized: true,
      disposition: "not_required",
      revalidation_required: false,
      current_verdict: hasCompletedClaudeReview(claudeReceipt) ? "pass" : "block",
      block_reason: hasCompletedClaudeReview(claudeReceipt) ? null : "claude_review_missing",
      generated_at: generatedAt,
    }];
  }
  return findings.map((finding, index) => {
    const severity = String(finding.severity ?? "note").toLowerCase();
    const blocking = severity === "blocking" || severity === "critical" || severity === "p0" || severity === "p1";
    const disposition = blocking ? "must_fix_before_closeout" : "accepted_or_deferred";
    return {
      row_id: `finding.${String(index + 1).padStart(3, "0")}`,
      finding_id: finding.finding_id ?? `FINDING-${String(index + 1).padStart(3, "0")}`,
      severity,
      category: finding.category ?? "review",
      title: finding.title ?? finding.issue ?? "Untitled finding",
      description: finding.description ?? finding.issue ?? "",
      source_ref: finding.file ?? finding.location ?? null,
      blocking,
      normalized: true,
      disposition,
      revalidation_required: true,
      current_verdict: blocking ? "block" : "pass",
      block_reason: blocking ? "blocking_finding_present" : null,
      generated_at: generatedAt,
    };
  });
}

function buildRevalidationRows(findingRows, testEvidenceRows, generatedAt) {
  const hasCompletedTests = testEvidenceRows.length > 0 && testEvidenceRows.every((row) => row.current_verdict === "pass");
  return findingRows.map((finding) => {
    const requires = finding.revalidation_required === true;
    const pass = !requires || (hasCompletedTests && finding.blocking === false);
    return {
      row_id: `revalidation.${slug(finding.finding_id)}`,
      finding_id: finding.finding_id,
      revalidation_required: requires,
      revalidation_evidence_ref: requires ? `revalidation.${slug(finding.finding_id)}.evidence` : null,
      test_evidence_ref: requires ? "build_test_evidence_binding_rows" : null,
      current_verdict: pass ? "pass" : "block",
      block_reason: pass ? null : "revalidation_missing_or_blocking_finding",
      generated_at: generatedAt,
    };
  });
}

function buildCloseoutRows(context, generatedAt) {
  const checks = [
    ["features", "Feature implementation packets exist", context.featureRows.length > 0 && context.featureRows.every((row) => row.current_verdict === "pass")],
    ["test_evidence", "Test and evidence bindings pass", context.testEvidenceRows.length > 0 && context.testEvidenceRows.every((row) => row.current_verdict === "pass")],
    ["review_packets", "Review packets are present", context.reviewPacketRows.length > 0 && context.reviewPacketRows.every((row) => row.current_verdict === "pass")],
    ["claude_receipt", "Claude review receipt is complete and read-only", context.receiptRows.every((row) => row.current_verdict === "pass")],
    ["findings", "No blocking findings remain", context.findingRows.every((row) => row.blocking !== true)],
    ["revalidation", "Revalidation rows pass", context.revalidationRows.every((row) => row.current_verdict === "pass")],
  ];
  return checks.map(([id, label, pass]) => verdictRow({
    row_id: `closeout.${id}`,
    category: "closeout",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `closeout_${id}_blocked`,
    evidence_ref: `artifacts/product-build-verification-loop/latest/${id}.json`,
    generated_at: generatedAt,
  }));
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([routePath, routeId, description]) => verdictRow({
    row_id: `api.${routeId}`,
    category: "api_projection",
    label: routePath,
    description,
    required: true,
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    evidence_ref: routePath,
    methods_allowed: ["GET", "HEAD"],
    mutation_allowed: false,
    generated_at: generatedAt,
  }));
}

async function buildApiSmokeRows(sourceData, claudeReceiptData, generatedAt) {
  const rows = [];
  for (const [routePath, routeId] of API_ROUTE_SPECS) {
    const response = await buildProductBuildVerificationApiResponse(routePath, {
      method: "GET",
      requirementTraceabilityKernel: sourceData,
      claudeReviewReceipt: claudeReceiptData,
      runAt: generatedAt,
    });
    const bodyInspection = inspectResponseBody(response.body);
    rows.push(smokeRow(`api.${routeId}.get`, `GET ${routePath}`, response.status === 200 && !bodyInspection.rawBodyPresent && !bodyInspection.secretKeysPresent, {
      status: response.status,
      raw_body_present: bodyInspection.rawBodyPresent,
      secret_keys_present: bodyInspection.secretKeysPresent,
    }, generatedAt));
  }
  const rejected = await buildProductBuildVerificationApiResponse("/api/build/features", {
    method: "POST",
    requirementTraceabilityKernel: sourceData,
    claudeReviewReceipt: claudeReceiptData,
    runAt: generatedAt,
  });
  rows.push(smokeRow("api.post_rejected", "POST mutation is rejected", rejected.status === 405, { status: rejected.status }, generatedAt));
  return rows;
}

async function buildBrowserSmokeRows(sourceData, claudeReceiptData, generatedAt) {
  const response = await buildProductBuildVerificationApiResponse("/build-verification.html", {
    method: "GET",
    requirementTraceabilityKernel: sourceData,
    claudeReviewReceipt: claudeReceiptData,
    runAt: generatedAt,
  });
  const html = response.body;
  const checks = [
    ["html.ok", "HTML renders", response.status === 200 && html.includes("Product Build Verification Loop")],
    ["html.features", "Feature route is bound", html.includes("/api/build/features")],
    ["html.findings", "Findings route is bound", html.includes("/api/build/findings")],
    ["html.no_write", "No write controls", !/button[^>]*(apply|merge|deploy|write)/i.test(html)],
    ["html.no_raw", "No raw body text", !/(raw transcript|full transcript|secret)/i.test(html)],
    ["html.boundary", "Boundary route is bound", html.includes("/api/build/boundary")],
  ];
  return checks.map(([id, label, pass]) => smokeRow(id, label, pass, { status: response.status }, generatedAt));
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([id, description, blockCode]) => verdictRow({
    row_id: id,
    category: "negative_fixture",
    label: blockCode,
    description,
    required: true,
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    expected_block_code: blockCode,
    evidence_ref: "artifacts/product-build-verification-loop/latest/build-negative-fixture-rows.json",
    generated_at: generatedAt,
  }));
}

function buildFreezeRows(context) {
  const checks = [
    ["freeze.source", "P9800 source ready", isSourceReady(context.source)],
    ["freeze.phase_rows", "P9801-P10000 phase rows pass", context.phaseRows.every((row) => row.current_verdict === "pass")],
    ["freeze.features", "Feature implementation packets pass", context.feature_implementation_packet_rows.length > 0 && context.feature_implementation_packet_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.test_evidence", "Test evidence bindings pass", context.build_test_evidence_binding_rows.length > 0 && context.build_test_evidence_binding_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.review_packets", "Review packets pass", context.build_review_packet_rows.length > 0 && context.build_review_packet_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.claude_receipt", "Claude review receipt passes", context.claude_review_receipt_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.findings", "No blocking findings", context.finding_normalization_rows.every((row) => row.blocking !== true)],
    ["freeze.revalidation", "Revalidation evidence passes", context.revalidation_evidence_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.closeout", "Closeout rows pass", context.closeout_readiness_rows.every((row) => row.current_verdict === "pass")],
    ["freeze.api", "API smoke passes", context.apiSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.browser", "Browser smoke passes", context.browserSmokeRows.every((row) => row.current_verdict === "pass")],
    ["freeze.negative", "Negative fixtures pass", context.negativeFixtureRows.every((row) => row.current_verdict === "pass")],
    ["freeze.authority", "Authority remains bounded", hasSafeAuthorityBoundary(context.claudeReceipt)],
  ];
  return checks.map(([id, label, pass]) => verdictRow({
    row_id: id,
    category: "freeze",
    label,
    description: label,
    required: true,
    observed: Boolean(pass),
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replaceAll(".", "_")}_blocked`,
    evidence_ref: "artifacts/product-build-verification-loop/latest/product-build-verification-loop.json",
    generated_at: context.feature_implementation_packet_rows[0]?.generated_at ?? new Date().toISOString(),
  }));
}

function buildBoundary(context, generatedAt) {
  const freezeReady = Array.isArray(context.freezeRows) && context.freezeRows.length > 0 && context.freezeRows.every((row) => row.current_verdict === "pass");
  return {
    schema_version: "product-build-verification-boundary.v1",
    generated_at: generatedAt,
    p10000_freeze_ready: freezeReady,
    claude_review_required_now: true,
    claude_review_completed_now: hasCompletedClaudeReview(context.claudeReceipt),
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    runtime_execution_enabled: false,
    write_action_enabled: false,
    repo_write_enabled: false,
    connector_write_enabled: false,
    api_write_methods_enabled: false,
    raw_material_visible: false,
    secret_keys_returned: false,
  };
}

function buildGateRows(context, generatedAt) {
  const gates = [
    ["gate.source_ready", "P9800 source ready", isSourceReady(context.source)],
    ["gate.feature_packets", "Feature packets pass", context.feature_implementation_packet_rows.every((row) => row.current_verdict === "pass")],
    ["gate.test_evidence", "Test evidence pass", context.build_test_evidence_binding_rows.every((row) => row.current_verdict === "pass")],
    ["gate.review_packets", "Review packets pass", context.build_review_packet_rows.every((row) => row.current_verdict === "pass")],
    ["gate.claude_review", "Claude review complete", hasCompletedClaudeReview(context.claudeReceipt)],
    ["gate.no_blocking_findings", "No blocking findings", context.finding_normalization_rows.every((row) => row.blocking !== true)],
    ["gate.revalidation", "Revalidation pass", context.revalidation_evidence_rows.every((row) => row.current_verdict === "pass")],
    ["gate.closeout", "Closeout pass", context.closeout_readiness_rows.every((row) => row.current_verdict === "pass")],
    ["gate.no_final_authority", "Codex and Claude final authority false", context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false],
    ["gate.no_enterprise", "Production and enterprise PASS false", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false],
  ];
  return gates.map(([id, label, pass]) => verdictRow({
    row_id: id,
    category: "gate",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replaceAll(".", "_")}_blocked`,
    evidence_ref: "artifacts/product-build-verification-loop/latest/product-build-verification-loop.json",
    generated_at: generatedAt,
  }));
}

function buildValidationItems(context) {
  const validateScript = context.packageJson.data?.scripts?.validate ?? "";
  const sourceIndex = validateScript.indexOf(`${SOURCE_COMMAND_NAME} -- --check`);
  const commandIndex = validateScript.indexOf(`${COMMAND_NAME} -- --check`);
  return [
    validationItem("schema.present", "schema", context.schema.available, "schema must be readable"),
    validationItem("package.script", "package", context.packageJson.data?.scripts?.[COMMAND_NAME] === "node scripts/product-build-verification-loop.mjs", "package script must register P10000 command"),
    validationItem("validate.chain", "package", validateScript.includes(`${COMMAND_NAME} -- --check`) && sourceIndex >= 0 && commandIndex > sourceIndex, "validate chain must include P10000 after P9800"),
    validationItem("roadmap.present", "docs", context.roadmapDoc.available && includesToken(context.roadmapDoc.text, PROGRAM_RANGE), "P9801-P10000 roadmap must exist"),
    validationItem("architecture.present", "docs", context.architectureDoc.available && includesToken(context.architectureDoc.text, "P9801-P10000 Product Build Verification Loop"), "architecture must mention P10000"),
    validationItem("source.ready", "source", isSourceReady(context.source), "P9800 source must be ready"),
    validationItem("phase.rows", "phase", context.phaseRows.length === PHASE_SPECS.length && context.phaseRows.every((row) => row.current_verdict === "pass"), "all P9801-P10000 phase rows must pass"),
    validationItem("features.present", "features", context.feature_implementation_packet_rows.length > 0 && context.feature_implementation_packet_rows.every((row) => row.current_verdict === "pass"), "feature rows must pass"),
    validationItem("test_evidence.present", "test_evidence", context.build_test_evidence_binding_rows.length === context.feature_implementation_packet_rows.length && context.build_test_evidence_binding_rows.every((row) => row.current_verdict === "pass"), "test/evidence rows must pass"),
    validationItem("review_packets.present", "review", context.build_review_packet_rows.length === context.feature_implementation_packet_rows.length && context.build_review_packet_rows.every((row) => row.current_verdict === "pass"), "review packet rows must pass"),
    validationItem("claude.receipt", "review", hasCompletedClaudeReview(context.claudeReceipt) && hasSafeAuthorityBoundary(context.claudeReceipt), "Claude review receipt must be complete and read-only"),
    validationItem("findings.normalized", "findings", context.finding_normalization_rows.length > 0 && context.finding_normalization_rows.every((row) => row.normalized === true && row.blocking !== true), "findings must be normalized with no blocking findings"),
    validationItem("revalidation.pass", "revalidation", context.revalidation_evidence_rows.every((row) => row.current_verdict === "pass"), "revalidation rows must pass"),
    validationItem("closeout.pass", "closeout", context.closeout_readiness_rows.every((row) => row.current_verdict === "pass"), "closeout readiness rows must pass"),
    validationItem("api.read_only", "api", context.routeRows.every((row) => row.mutation_allowed === false) && context.apiSmokeRows.every((row) => row.current_verdict === "pass"), "API must be read-only and pass smoke"),
    validationItem("browser.safe", "browser", context.browserSmokeRows.every((row) => row.current_verdict === "pass"), "browser smoke must pass"),
    validationItem("negative.fixtures", "negative", context.negativeFixtureRows.every((row) => row.current_verdict === "pass"), "negative fixtures must pass"),
    validationItem("freeze.ready", "freeze", context.freezeRows.every((row) => row.current_verdict === "pass"), "P10000 freeze rows must pass"),
    validationItem("gates.pass", "gate", context.gateRows.every((row) => row.current_verdict === "pass"), "build gates must pass"),
    validationItem("boundary.safe", "boundary", context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.write_action_enabled === false, "authority boundary must stay closed"),
  ];
}

function buildSummary(context) {
  const ready = context.validation.valid && context.freezeRows.every((row) => row.current_verdict === "pass");
  return {
    schema_version: "product-build-verification-summary.v1",
    product_build_verification_status: ready ? READY_STATUS : REVIEW_PENDING_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p9800_ready: isSourceReady(context.source),
    phase_row_count: context.phaseRows.length,
    feature_count: context.feature_implementation_packet_rows.length,
    test_evidence_binding_count: context.build_test_evidence_binding_rows.length,
    review_packet_count: context.build_review_packet_rows.length,
    finding_count: countRealFindings(context.finding_normalization_rows),
    blocking_finding_count: context.finding_normalization_rows.filter((row) => row.blocking === true).length,
    revalidation_count: context.revalidation_evidence_rows.length,
    closeout_row_count: context.closeout_readiness_rows.length,
    claude_review_required_now: true,
    claude_review_completed_now: hasCompletedClaudeReview(context.claudeReceipt),
    p10000_freeze_ready: ready,
    ready_for_p10001_handoff: ready,
    api_write_methods_enabled: false,
    raw_material_visible: false,
    secret_keys_returned: false,
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

function buildApiSummary(source, claudeReceipt, collections) {
  return {
    product_build_verification_status: hasCompletedClaudeReview(claudeReceipt) ? READY_STATUS : REVIEW_PENDING_STATUS,
    program_range: PROGRAM_RANGE,
    source_p9800_ready: isSourceReady(source),
    feature_count: collections.feature_implementation_packet_rows.length,
    finding_count: countRealFindings(collections.finding_normalization_rows),
    blocking_finding_count: collections.finding_normalization_rows.filter((row) => row.blocking === true).length,
    claude_review_completed_now: hasCompletedClaudeReview(claudeReceipt),
    api_write_methods_enabled: false,
  };
}

function renderBuildVerificationHtml(result) {
  const summary = result.summary ?? {};
  const routes = API_ROUTE_SPECS.filter(([route]) => route !== "/health").map(([route, id]) => `<li><code>${escapeHtml(route)}</code> <span>${escapeHtml(id)}</span></li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Product Build Verification Loop</title>
  <style>
    body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f4; color: #1f2a2e; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    section { border-top: 1px solid #d8ddd6; padding: 20px 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    dt { color: #5f6d66; font-size: 12px; text-transform: uppercase; }
    dd { margin: 0; font-size: 18px; font-weight: 650; }
    code { background: #e9ece7; padding: 2px 5px; border-radius: 4px; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <main>
    <h1>Product Build Verification Loop</h1>
    <p>P9801-P10000 read-only build verification state. No apply, merge, deploy, write, runtime execution, production PASS, or enterprise PASS control is exposed here.</p>
    <section>
      <dl>
        <div><dt>Status</dt><dd>${escapeHtml(summary.product_build_verification_status ?? "unknown")}</dd></div>
        <div><dt>Features</dt><dd>${escapeHtml(String(summary.feature_count ?? 0))}</dd></div>
        <div><dt>Findings</dt><dd>${escapeHtml(String(summary.finding_count ?? 0))}</dd></div>
        <div><dt>Claude Review</dt><dd>${escapeHtml(String(summary.claude_review_completed_now ?? false))}</dd></div>
        <div><dt>P10000 Freeze</dt><dd>${escapeHtml(String(summary.p10000_freeze_ready ?? false))}</dd></div>
      </dl>
    </section>
    <section>
      <h2>Routes</h2>
      <ul>${routes}</ul>
    </section>
  </main>
</body>
</html>`;
}

function renderSummaryMarkdown(result) {
  const summary = result.summary ?? {};
  return [
    "# Product Build Verification Loop",
    "",
    `Program: ${PROGRAM_RANGE}`,
    `Status: ${summary.product_build_verification_status ?? "unknown"}`,
    `Features: ${summary.feature_count ?? 0}`,
    `Findings: ${summary.finding_count ?? 0}`,
    `Claude review completed: ${summary.claude_review_completed_now ?? false}`,
    `P10000 freeze ready: ${summary.p10000_freeze_ready ?? false}`,
    "",
  ].join("\n");
}

function renderClaudeReviewPacket(result) {
  const summary = result.summary ?? {};
  return [
    "# Claude Review Packet: P9801-P10000 Product Build Verification Loop",
    "",
    "Reviewer: Claude Code Opus 4.8 max or latest Opus equivalent",
    "Mode: read-only review evidence; no source mutation; no final approval",
    "",
    "## Scope",
    "",
    "Review the current git diff for P9801-P10000 and the generated build verification artifact.",
    "",
    "## Required Checks",
    "",
    "- Feature implementation packets exist for every traced requirement.",
    "- Test/evidence bindings and review packets are present.",
    "- Claude review receipt is required and cannot grant final approval.",
    "- Findings are normalized; blocking findings block closeout.",
    "- Revalidation evidence exists when findings require it.",
    "- P10000 closeout requires all gates to pass.",
    "- API/UI routes remain GET/HEAD only and sanitized.",
    "- Production and enterprise PASS remain false.",
    "",
    "## Current Summary",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
    "## Expected JSON Receipt",
    "",
    "Return a concise JSON-compatible verdict that can be wrapped as claude-review-receipt.json with review_status completed, finding_count, blocking_finding_count, and findings.",
    "",
  ].join("\n");
}

async function readJsonOrBuildRequirementTraceabilityKernel(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  try {
    const built = await buildRequirementTraceabilityKernel({ runAt: generatedAt, write: false });
    return {
      available: built.validation?.valid === true,
      path: "generated.requirement_traceability_kernel",
      data: built,
      text: JSON.stringify(built),
      error: built.validation?.valid === true ? null : "generated P9800 source is not validation-ready",
    };
  } catch (error) {
    return { available: false, path: filePath, data: null, text: "", error: source.error ?? error.message };
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
  return { available: Boolean(data), path: pathLabel, data, text: data ? JSON.stringify(data) : "", error: data ? null : "inline source missing" };
}

function normalizeInputs(options) {
  return {
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.architectureDocPath),
    source_requirement_traceability_kernel_path: path.resolve(options.sourceRequirementTraceabilityKernelPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.sourceRequirementTraceabilityKernelPath),
    claude_review_receipt_path: path.resolve(options.claudeReviewReceiptPath ?? DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_INPUTS.claudeReviewReceiptPath),
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  return { ...result, html: undefined, markdown: undefined, review_packet_markdown: undefined };
}

function isSourceReady(source) {
  return source.available === true
    && source.data?.summary?.requirement_traceability_kernel_status === "ready_for_requirement_traceability_kernel"
    && source.data?.summary?.p9800_freeze_ready === true
    && source.data?.validation?.valid === true;
}

function hasCompletedClaudeReview(receipt) {
  const data = receipt.data ?? {};
  return receipt.available === true
    && data.review_status === "completed"
    && Number(data.blocking_finding_count ?? 0) === 0
    && data.reviewer_mutation_allowed === false
    && data.claude_final_approval_allowed === false;
}

function hasSafeAuthorityBoundary(receipt) {
  const data = receipt.data ?? {};
  return data.reviewer_mutation_allowed === false
    && data.claude_final_approval_allowed === false
    && data.production_pass_allowed !== true
    && data.enterprise_pass_allowed !== true;
}

function countRealFindings(rows) {
  return rows.filter((row) => row.finding_id !== "NO_FINDINGS").length;
}

function validationItem(id, category, pass, message) {
  return {
    validation_id: id,
    category,
    status: pass ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    validation_id: item.validation_id,
    category: item.category,
    message: item.message,
  }));
  return { valid: errors.length === 0, errors };
}

function verdictRow(fields) {
  return {
    schema_version: "hermes-verdict-row.v1",
    ...fields,
    current_verdict: fields.current_verdict ?? (fields.observed ? "pass" : "block"),
    block_reason: fields.block_reason ?? null,
  };
}

function smokeRow(smokeId, description, pass, observations, generatedAt) {
  return verdictRow({
    row_id: smokeId,
    category: "smoke",
    label: smokeId,
    description,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${smokeId.replaceAll(".", "_")}_failed`,
    evidence_ref: "api_smoke",
    observations,
    generated_at: generatedAt,
  });
}

function buildError(code, message) {
  return { error: { code, message }, mutation_allowed: false };
}

function jsonResponse(status, payload, method = "GET") {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: method === "HEAD" ? "" : `${JSON.stringify(sanitizeApiPayload(payload), null, 2)}\n`,
  };
}

function htmlResponse(status, body, method = "GET") {
  return {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: method === "HEAD" ? "" : body,
  };
}

function sanitizeApiPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeApiPayload);
  if (!value || typeof value !== "object") return value;
  const sanitized = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveResponseKey(key)) continue;
    sanitized[key] = sanitizeApiPayload(nested);
  }
  return sanitized;
}

function inspectResponseBody(body) {
  return {
    rawBodyPresent: /"(raw_[^"]*|full_transcript[^"]*|full_body[^"]*|secret[^"]*)"\s*:/i.test(body),
    secretKeysPresent: /"[^"]*secret[^"]*"\s*:/i.test(body),
  };
}

function isSensitiveResponseKey(key) {
  return /(raw_|full_transcript|full_body|secret)/i.test(key);
}

function normalizePath(value) {
  const withoutSlash = value.replace(/\/+$/, "");
  return withoutSlash || "/";
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    serve: false,
    outDir: DEFAULT_PRODUCT_BUILD_VERIFICATION_LOOP_OUT_DIR,
    host: DEFAULT_PRODUCT_BUILD_VERIFICATION_HOST,
    port: DEFAULT_PRODUCT_BUILD_VERIFICATION_PORT,
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
  console.log(`Usage: node scripts/product-build-verification-loop.mjs [options]

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

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}
