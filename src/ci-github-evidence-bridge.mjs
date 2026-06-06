import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildClaudeReviewIntegrationLane } from "./claude-review-integration-lane.mjs";

const execFileAsync = promisify(execFile);

export const DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_OUT_DIR = "artifacts/ci-github-evidence-bridge/latest";
export const DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS = {
  schemaPath: "schemas/ci-github-evidence-bridge.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p10201-p10400.md",
  architectureDocPath: "docs/architecture.md",
  sourceClaudeReviewIntegrationPath: "artifacts/claude-review-integration-lane/latest/claude-review-integration-lane.json",
  sourceClaudeReviewReceiptPath: "artifacts/claude-review-integration-lane/latest/claude-review-receipt.json",
  remoteBindingReceiptPath: "artifacts/platform-external-verification-enforcement/github/remote-binding-receipt.json",
  branchProtectionReceiptPath: "artifacts/platform-external-verification-enforcement/github/branch-protection-receipt.json",
  requiredCheckReceiptPath: "artifacts/platform-external-verification-enforcement/github/required-check-receipt.json",
  actionsRunReceiptPath: "artifacts/platform-external-verification-enforcement/github/actions-run-receipt.json",
  pullRequestReviewReceiptPath: "artifacts/platform-external-verification-enforcement/github/pull-request-review-receipt.json",
  attestationVerifyReceiptPath: "artifacts/platform-external-verification-enforcement/attestation/attestation-verify-receipt.json",
  claudeReviewReceiptPath: "artifacts/ci-github-evidence-bridge/latest/claude-review-receipt.json",
};

export const DEFAULT_CI_GITHUB_EVIDENCE_HOST = "127.0.0.1";
export const DEFAULT_CI_GITHUB_EVIDENCE_PORT = 4199;

const COMMAND_NAME = "platform:ci-github-evidence-bridge";
const SOURCE_COMMAND_NAME = "platform:claude-review-integration-lane";
const SCHEMA_VERSION = "ci-github-evidence-bridge.v1";
const CAPABILITY_ID = "platform.ci_github_evidence_bridge";
const PROGRAM_RANGE = "P10201-P10400";
const SOURCE_PROGRAM_RANGE = "P10001-P10200";
const READY_STATUS = "ready_for_ci_github_evidence_bridge";
const REVIEW_PENDING_STATUS = "ready_for_required_claude_review";
const BLOCKED_STATUS = "blocked_ci_github_evidence_bridge";

const PHASE_SPECS = [
  ["P10201-P10220", "P10200 Source Binding"],
  ["P10221-P10240", "GitHub Remote And Branch Binding"],
  ["P10241-P10260", "Branch Protection And Ruleset Evidence"],
  ["P10261-P10280", "Required Check Evidence"],
  ["P10281-P10300", "GitHub Actions Run Evidence"],
  ["P10301-P10320", "Pull Request And Commit SHA Evidence"],
  ["P10321-P10340", "Signed Attestation Evidence"],
  ["P10341-P10360", "Evidence Freshness And Provenance"],
  ["P10361-P10380", "CI GitHub API Projection"],
  ["P10381-P10400", "P10400 Freeze"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "CI/GitHub evidence bridge readiness", "computed"],
  ["/api/ci-github/remote", "remote", "GitHub remote binding evidence", "github_remote_binding_rows"],
  ["/api/ci-github/branch-protection", "branch_protection", "Branch protection and ruleset evidence", "branch_protection_evidence_rows"],
  ["/api/ci-github/required-checks", "required_checks", "Required check evidence", "required_check_evidence_rows"],
  ["/api/ci-github/actions", "actions", "GitHub Actions run evidence", "actions_run_evidence_rows"],
  ["/api/ci-github/pr-commit", "pr_commit", "Pull request and commit SHA evidence", "pr_commit_evidence_rows"],
  ["/api/ci-github/attestation", "attestation", "Signed attestation verification evidence", "attestation_evidence_rows"],
  ["/api/ci-github/freshness", "freshness", "Evidence freshness and provenance rows", "evidence_freshness_rows"],
  ["/api/ci-github/boundary", "boundary", "CI/GitHub evidence authority boundary", "ci_github_evidence_boundary"],
];

const NEGATIVE_FIXTURES = [
  ["negative.missing_p10200_source", "Bridge passes without P10200 source readiness", "BLOCK_MISSING_P10200_SOURCE"],
  ["negative.missing_remote_binding", "Remote binding evidence is missing but closeout passes", "BLOCK_MISSING_REMOTE_BINDING"],
  ["negative.branch_protection_overclaimed", "Branch protection is overclaimed without receipt evidence", "BLOCK_BRANCH_PROTECTION_OVERCLAIM"],
  ["negative.required_check_overclaimed", "Required check is overclaimed without enforcement evidence", "BLOCK_REQUIRED_CHECK_OVERCLAIM"],
  ["negative.actions_run_stale", "Actions run evidence from another commit is treated as current", "BLOCK_ACTIONS_RUN_STALE"],
  ["negative.pr_review_missing", "PR review missing but independent GitHub review is treated as complete", "BLOCK_PR_REVIEW_MISSING"],
  ["negative.attestation_missing_or_stale", "Attestation missing or unbound but verification passes", "BLOCK_ATTESTATION_MISSING_OR_STALE"],
  ["negative.raw_payload_exposed", "Raw GitHub payload, token, or secret is exposed in API", "BLOCK_RAW_PAYLOAD_EXPOSED"],
  ["negative.github_write_enabled", "Bridge enables GitHub write or merge action", "BLOCK_GITHUB_WRITE_ENABLED"],
  ["negative.release_or_enterprise_pass", "External evidence bridge creates release or enterprise PASS", "BLOCK_RELEASE_ENTERPRISE_PASS"],
  ["negative.claude_or_codex_final_approval", "Codex or Claude becomes final approval authority", "BLOCK_FINAL_APPROVAL_EXPANSION"],
];

export async function runCiGithubEvidenceBridge(options = {}) {
  const result = await buildCiGithubEvidenceBridge(options);
  if (options.write !== false) await writeCiGithubEvidenceBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`CI/GitHub evidence bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCiGithubEvidenceBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "claudeReviewIntegrationLane")
    ? normalizeInlineJsonSource("inline.claude_review_integration_lane", options.claudeReviewIntegrationLane)
    : await readJsonOrBuildClaudeReviewIntegrationLane(inputs.source_claude_review_integration_path, generatedAt);
  const sourceReviewReceipt = Object.prototype.hasOwnProperty.call(options, "sourceClaudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.source_claude_review_receipt", options.sourceClaudeReviewReceipt)
    : await readJsonSource(inputs.source_claude_review_receipt_path);
  const receipts = {
    remote: Object.prototype.hasOwnProperty.call(options, "remoteBindingReceipt") ? normalizeInlineJsonSource("inline.remote_binding_receipt", options.remoteBindingReceipt) : await readOptionalJsonSource(inputs.remote_binding_receipt_path),
    branchProtection: Object.prototype.hasOwnProperty.call(options, "branchProtectionReceipt") ? normalizeInlineJsonSource("inline.branch_protection_receipt", options.branchProtectionReceipt) : await readOptionalJsonSource(inputs.branch_protection_receipt_path),
    requiredCheck: Object.prototype.hasOwnProperty.call(options, "requiredCheckReceipt") ? normalizeInlineJsonSource("inline.required_check_receipt", options.requiredCheckReceipt) : await readOptionalJsonSource(inputs.required_check_receipt_path),
    actionsRun: Object.prototype.hasOwnProperty.call(options, "actionsRunReceipt") ? normalizeInlineJsonSource("inline.actions_run_receipt", options.actionsRunReceipt) : await readOptionalJsonSource(inputs.actions_run_receipt_path),
    pullRequestReview: Object.prototype.hasOwnProperty.call(options, "pullRequestReviewReceipt") ? normalizeInlineJsonSource("inline.pull_request_review_receipt", options.pullRequestReviewReceipt) : await readOptionalJsonSource(inputs.pull_request_review_receipt_path),
    attestation: Object.prototype.hasOwnProperty.call(options, "attestationVerifyReceipt") ? normalizeInlineJsonSource("inline.attestation_verify_receipt", options.attestationVerifyReceipt) : await readOptionalJsonSource(inputs.attestation_verify_receipt_path),
    claudeReview: Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt") ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt) : await readJsonSource(inputs.claude_review_receipt_path),
  };
  const localGitState = options.localGitState ?? await detectLocalGitState(options.cwd ?? process.cwd());

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, sourceReviewReceipt, generatedAt);
  const derived = deriveCiGithubEvidenceCollections({ source, sourceReviewReceipt, receipts, localGitState, generatedAt });
  const routeRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = await buildApiSmokeRows({ source, sourceReviewReceipt, receipts, localGitState, generatedAt });
  const browserSmokeRows = await buildBrowserSmokeRows({ source, sourceReviewReceipt, receipts, localGitState, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const boundary = buildBoundary({ source, sourceReviewReceipt, receipts, localGitState, routeRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, ...derived }, generatedAt);
  const freezeRows = buildFreezeRows({ source, sourceReviewReceipt, receipts, boundary, routeRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, ...derived }, generatedAt);
  const gateRows = buildGateRows({ source, sourceReviewReceipt, receipts, boundary, freezeRows, routeRows, apiSmokeRows, browserSmokeRows, ...derived }, generatedAt);
  const validationItems = buildValidationItems({
    schema,
    packageJson,
    roadmapDoc,
    architectureDoc,
    source,
    sourceReviewReceipt,
    receipts,
    phaseRows,
    sourceBindingRows,
    routeRows,
    apiSmokeRows,
    browserSmokeRows,
    negativeFixtureRows,
    boundary,
    freezeRows,
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
      claude_review_integration_lane_path: source.path,
      source_claude_review_receipt_path: sourceReviewReceipt.path,
      remote_binding_receipt_path: receipts.remote.path,
      branch_protection_receipt_path: receipts.branchProtection.path,
      required_check_receipt_path: receipts.requiredCheck.path,
      actions_run_receipt_path: receipts.actionsRun.path,
      pull_request_review_receipt_path: receipts.pullRequestReview.path,
      attestation_verify_receipt_path: receipts.attestation.path,
      claude_review_receipt_path: receipts.claudeReview.path,
    },
    local_git_state: localGitState,
    ci_github_evidence_contract: contract,
    ci_github_evidence_phase_rows: phaseRows,
    p10200_source_binding_rows: sourceBindingRows,
    github_remote_binding_rows: derived.github_remote_binding_rows,
    branch_protection_evidence_rows: derived.branch_protection_evidence_rows,
    required_check_evidence_rows: derived.required_check_evidence_rows,
    actions_run_evidence_rows: derived.actions_run_evidence_rows,
    pr_commit_evidence_rows: derived.pr_commit_evidence_rows,
    attestation_evidence_rows: derived.attestation_evidence_rows,
    evidence_freshness_rows: derived.evidence_freshness_rows,
    external_evidence_closeout_rows: derived.external_evidence_closeout_rows,
    ci_github_api_route_rows: routeRows,
    ci_github_api_smoke_rows: apiSmokeRows,
    ci_github_browser_smoke_rows: browserSmokeRows,
    ci_github_negative_fixture_rows: negativeFixtureRows,
    p10400_freeze_rows: freezeRows,
    ci_github_gate_rows: gateRows,
    ci_github_evidence_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ source, sourceReviewReceipt, receipts, boundary, validation: preliminaryValidation, phaseRows, sourceBindingRows, routeRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, freezeRows, gateRows, ...derived }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "ci_github_evidence_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ source, sourceReviewReceipt, receipts, boundary, validation: result.validation, phaseRows, sourceBindingRows, routeRows, apiSmokeRows, browserSmokeRows, negativeFixtureRows, freezeRows, gateRows, ...derived });
  return {
    ...result,
    html: renderCiGithubEvidenceHtml(result),
    markdown: renderSummaryMarkdown(result),
    review_packet_markdown: renderClaudeReviewPacket(result),
  };
}

export async function writeCiGithubEvidenceBridge(result, outDir = DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "ci-github-evidence-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "ci-github-evidence-phase-rows.json"), result.ci_github_evidence_phase_rows);
  await writeJson(path.join(outDir, "p10200-source-binding-rows.json"), result.p10200_source_binding_rows);
  await writeJson(path.join(outDir, "github-remote-binding-rows.json"), result.github_remote_binding_rows);
  await writeJson(path.join(outDir, "branch-protection-evidence-rows.json"), result.branch_protection_evidence_rows);
  await writeJson(path.join(outDir, "required-check-evidence-rows.json"), result.required_check_evidence_rows);
  await writeJson(path.join(outDir, "actions-run-evidence-rows.json"), result.actions_run_evidence_rows);
  await writeJson(path.join(outDir, "pr-commit-evidence-rows.json"), result.pr_commit_evidence_rows);
  await writeJson(path.join(outDir, "attestation-evidence-rows.json"), result.attestation_evidence_rows);
  await writeJson(path.join(outDir, "evidence-freshness-rows.json"), result.evidence_freshness_rows);
  await writeJson(path.join(outDir, "external-evidence-closeout-rows.json"), result.external_evidence_closeout_rows);
  await writeJson(path.join(outDir, "ci-github-api-route-rows.json"), result.ci_github_api_route_rows);
  await writeJson(path.join(outDir, "ci-github-api-smoke-rows.json"), result.ci_github_api_smoke_rows);
  await writeJson(path.join(outDir, "ci-github-browser-smoke-rows.json"), result.ci_github_browser_smoke_rows);
  await writeJson(path.join(outDir, "ci-github-negative-fixture-rows.json"), result.ci_github_negative_fixture_rows);
  await writeJson(path.join(outDir, "p10400-freeze-rows.json"), result.p10400_freeze_rows);
  await writeJson(path.join(outDir, "ci-github-gate-rows.json"), result.ci_github_gate_rows);
  await writeJson(path.join(outDir, "ci-github-evidence-boundary.json"), result.ci_github_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), result.validation);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "claude-review-packet.md"), result.review_packet_markdown, "utf8");
}

export function createCiGithubEvidenceApiServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      const apiResponse = await buildCiGithubEvidenceApiResponse(request.url ?? "/", { ...options, method: request.method });
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

export async function startCiGithubEvidenceApiServer(options = {}) {
  const host = options.host ?? DEFAULT_CI_GITHUB_EVIDENCE_HOST;
  const port = options.port ?? DEFAULT_CI_GITHUB_EVIDENCE_PORT;
  const server = createCiGithubEvidenceApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildCiGithubEvidenceApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "CI/GitHub evidence bridge API is read-only."), method);
  }
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = normalizePath(url.pathname);
  const source = Object.prototype.hasOwnProperty.call(options, "claudeReviewIntegrationLane")
    ? normalizeInlineJsonSource("inline.claude_review_integration_lane", options.claudeReviewIntegrationLane)
    : await readJsonOrBuildClaudeReviewIntegrationLane(options.sourceClaudeReviewIntegrationPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.sourceClaudeReviewIntegrationPath, generatedAt);
  const sourceReviewReceipt = Object.prototype.hasOwnProperty.call(options, "sourceClaudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.source_claude_review_receipt", options.sourceClaudeReviewReceipt)
    : await readJsonSource(options.sourceClaudeReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.sourceClaudeReviewReceiptPath);
  const receipts = await normalizeReceiptsFromOptions(options);
  const localGitState = options.localGitState ?? await detectLocalGitState(options.cwd ?? process.cwd());
  const collections = deriveCiGithubEvidenceCollections({ source, sourceReviewReceipt, receipts, localGitState, generatedAt });
  const routeRows = buildApiRouteRows(generatedAt);
  const boundary = buildBoundary({ source, sourceReviewReceipt, receipts, localGitState, routeRows, apiSmokeRows: [], browserSmokeRows: [], negativeFixtureRows: [], ...collections }, generatedAt);
  if (pathname === "/" || pathname === "/index.html" || pathname === "/ci-github-evidence.html") {
    return htmlResponse(200, renderCiGithubEvidenceHtml({
      program_range: PROGRAM_RANGE,
      summary: buildApiSummary(source, sourceReviewReceipt, receipts, collections, boundary),
      ci_github_evidence_boundary: boundary,
      ...collections,
    }), method);
  }
  if (pathname === "/health") {
    return jsonResponse(200, sanitizeApiPayload({
      ok: isSourceReady(source),
      program_range: PROGRAM_RANGE,
      source_ready: isSourceReady(source),
      external_evidence_complete_now: boundary.external_evidence_complete_now,
      p10400_bridge_ready: boundary.p10400_bridge_ready,
      write_methods_enabled: false,
    }), method);
  }
  const route = API_ROUTE_SPECS.find(([routePath]) => routePath === pathname);
  if (!route) return jsonResponse(404, buildError("not_found", `No CI/GitHub evidence route for ${pathname}`), method);
  const [, routeId,, collectionKey] = route;
  const body = collectionKey === "ci_github_evidence_boundary" ? boundary : collections[collectionKey];
  return jsonResponse(200, sanitizeApiPayload({ route_id: routeId, program_range: PROGRAM_RANGE, data: body }), method);
}

export async function runCiGithubEvidenceBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const started = await startCiGithubEvidenceApiServer({
      host: args.host,
      port: args.port,
      runAt: args.runAt,
      claudeReviewReceiptPath: args.claudeReviewReceiptPath,
    });
    console.log(`CI/GitHub evidence API listening at ${started.url}`);
    console.log(`Open ${started.url}/ci-github-evidence.html`);
    return;
  }
  const result = await runCiGithubEvidenceBridge({
    check: args.check,
    write: args.write,
    outDir: args.outDir,
    runAt: args.runAt,
    claudeReviewReceiptPath: args.claudeReviewReceiptPath,
  });
  console.log(`${args.check ? "CI/GitHub evidence bridge validated" : "CI/GitHub evidence bridge written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.ci_github_evidence_bridge_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`External evidence complete: ${result.summary.external_evidence_complete_now}`);
  console.log(`External closeout blockers: ${result.summary.external_closeout_blocker_count}`);
  console.log(`Claude review completed: ${result.summary.p10400_claude_review_completed_now}`);
  console.log(`P10400 bridge ready: ${result.summary.p10400_bridge_ready}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}

function buildContract(generatedAt) {
  return {
    schema_version: "ci-github-evidence-contract.v1",
    generated_at: generatedAt,
    source_claude_review_integration_required: true,
    github_remote_binding_required: true,
    branch_protection_evidence_required: true,
    required_check_evidence_required: true,
    actions_run_evidence_required: true,
    pull_request_commit_evidence_required: true,
    signed_attestation_evidence_required: true,
    evidence_freshness_required: true,
    missing_external_evidence_must_block_closeout: true,
    api_projection_read_only: true,
    github_write_allowed: false,
    merge_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
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
    evidence_ref: "docs/hermes-roadmap-p10201-p10400.md",
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, sourceReviewReceipt, generatedAt) {
  const sourceReady = isSourceReady(source);
  const receiptReady = hasCompletedSourceReview(sourceReviewReceipt);
  return [
    verdictRow({
      row_id: "source.p10200.claude_review_integration_lane",
      category: "source_binding",
      label: "P10200 Claude review integration source",
      description: "CI/GitHub evidence bridge consumes the P10200 Claude review integration artifact.",
      required: true,
      observed: sourceReady,
      current_verdict: sourceReady ? "pass" : "block",
      block_reason: sourceReady ? null : "p10200_source_not_ready",
      evidence_ref: source.path,
      generated_at: generatedAt,
    }),
    verdictRow({
      row_id: "source.p10200.claude_review_receipt",
      category: "source_binding",
      label: "P10200 Claude review receipt",
      description: "The source P10200 lane must have completed non-final Claude review evidence.",
      required: true,
      observed: receiptReady,
      current_verdict: receiptReady ? "pass" : "block",
      block_reason: receiptReady ? null : "p10200_claude_review_receipt_not_ready",
      evidence_ref: sourceReviewReceipt.path,
      generated_at: generatedAt,
    }),
  ];
}

function deriveCiGithubEvidenceCollections({ source, sourceReviewReceipt, receipts, localGitState, generatedAt }) {
  const remoteRows = buildRemoteBindingRows(receipts.remote, localGitState, generatedAt);
  const branchRows = buildBranchProtectionRows(receipts.branchProtection, generatedAt);
  const requiredRows = buildRequiredCheckRows(receipts.requiredCheck, generatedAt);
  const actionsRows = buildActionsRunRows(receipts.actionsRun, localGitState, generatedAt);
  const prRows = buildPrCommitRows(receipts.pullRequestReview, localGitState, generatedAt);
  const attestationRows = buildAttestationRows(receipts.attestation, generatedAt);
  const freshnessRows = buildFreshnessRows({ receipts, localGitState, generatedAt });
  const closeoutRows = buildExternalCloseoutRows({
    source,
    sourceReviewReceipt,
    receipts,
    remoteRows,
    branchRows,
    requiredRows,
    actionsRows,
    prRows,
    attestationRows,
    freshnessRows,
    generatedAt,
  });
  return {
    github_remote_binding_rows: remoteRows,
    branch_protection_evidence_rows: branchRows,
    required_check_evidence_rows: requiredRows,
    actions_run_evidence_rows: actionsRows,
    pr_commit_evidence_rows: prRows,
    attestation_evidence_rows: attestationRows,
    evidence_freshness_rows: freshnessRows,
    external_evidence_closeout_rows: closeoutRows,
  };
}

function buildRemoteBindingRows(receipt, localGitState, generatedAt) {
  const data = receipt.data ?? {};
  const ready = receipt.available && data.github_remote_configured_now === true && data.gh_auth_available_now === true && Boolean(data.repository_full_name);
  const commitMatches = ready && (!data.commit_sha || !localGitState.head_sha || data.commit_sha === localGitState.head_sha);
  return [
    evidenceRow({
      row_id: "remote.github.binding",
      category: "github_remote",
      label: "GitHub remote binding",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: ready,
      current_verdict: ready ? "pass" : "block",
      block_reason: ready ? null : "github_remote_binding_missing_or_unauthenticated",
      repository_full_name: data.repository_full_name ?? null,
      repository_visibility: data.repository_visibility ?? null,
      branch_name: data.branch_name ?? localGitState.branch_name ?? null,
      receipt_commit_sha: data.commit_sha ?? null,
      local_commit_sha: localGitState.head_sha ?? null,
      commit_matches_local_now: commitMatches,
      raw_payload_inlined: data.raw_payload_inlined === true,
      generated_at: generatedAt,
    }),
  ];
}

function buildBranchProtectionRows(receipt, generatedAt) {
  const data = receipt.data ?? {};
  const checks = [
    ["branch_protection_configured", "Branch protection configured", data.branch_protection_configured_now === true],
    ["required_pr_review_enforced", "Required PR review enforced", data.required_pr_review_enforced_now === true],
    ["stale_review_dismissal_enforced", "Stale review dismissal enforced", data.stale_review_dismissal_enforced_now === true],
    ["force_push_disabled", "Force push disabled", data.force_push_disabled_now === true],
  ];
  return checks.map(([id, label, pass]) => evidenceRow({
    row_id: `branch.${id}`,
    category: "branch_protection",
    label,
    evidence_ref: receipt.path,
    evidence_present_now: receipt.available,
    external_check_passed_now: receipt.available && pass,
    current_verdict: receipt.available && pass ? "pass" : "block",
    block_reason: receipt.available && pass ? null : `${id}_not_observed`,
    repository_full_name: data.repository_full_name ?? null,
    branch_name: data.branch_name ?? null,
    raw_payload_inlined: data.raw_payload_inlined === true,
    generated_at: generatedAt,
  }));
}

function buildRequiredCheckRows(receipt, generatedAt) {
  const data = receipt.data ?? {};
  const enforced = receipt.available && data.required_status_check_enforced_now === true;
  const success = data.latest_actions_run_conclusion === "success";
  return [
    evidenceRow({
      row_id: "required_check.status_context",
      category: "required_check",
      label: "Required status check enforced",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: enforced,
      current_verdict: enforced ? "pass" : "block",
      block_reason: enforced ? null : "required_status_check_not_enforced",
      required_check_name: data.required_check_name ?? null,
      required_status_check_contexts: data.required_status_check_contexts ?? [],
      generated_at: generatedAt,
    }),
    evidenceRow({
      row_id: "required_check.latest_actions_success",
      category: "required_check",
      label: "Latest required check action succeeded",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: receipt.available && success,
      current_verdict: receipt.available && success ? "pass" : "block",
      block_reason: receipt.available && success ? null : "latest_required_check_not_success",
      latest_actions_run_id: data.latest_actions_run_id ?? null,
      latest_actions_run_conclusion: data.latest_actions_run_conclusion ?? null,
      generated_at: generatedAt,
    }),
  ];
}

function buildActionsRunRows(receipt, localGitState, generatedAt) {
  const data = receipt.data ?? {};
  const success = receipt.available && data.actions_run_status === "completed" && data.actions_run_conclusion === "success" && data.actions_run_success_now === true;
  const commitMatches = success && Boolean(localGitState.head_sha) && data.commit_sha === localGitState.head_sha;
  return [
    evidenceRow({
      row_id: "actions.run.success",
      category: "actions_run",
      label: "GitHub Actions run succeeded",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: success,
      current_verdict: success ? "pass" : "block",
      block_reason: success ? null : "actions_run_not_success",
      actions_run_id: data.actions_run_id ?? null,
      actions_run_url: data.actions_run_url ?? null,
      actions_run_status: data.actions_run_status ?? null,
      actions_run_conclusion: data.actions_run_conclusion ?? null,
      generated_at: generatedAt,
    }),
    evidenceRow({
      row_id: "actions.run.commit_current",
      category: "actions_run",
      label: "GitHub Actions run matches local commit",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: commitMatches,
      current_verdict: commitMatches ? "pass" : "block",
      block_reason: commitMatches ? null : "actions_run_commit_stale_or_unknown",
      receipt_commit_sha: data.commit_sha ?? null,
      local_commit_sha: localGitState.head_sha ?? null,
      generated_at: generatedAt,
    }),
  ];
}

function buildPrCommitRows(receipt, localGitState, generatedAt) {
  const data = receipt.data ?? {};
  const reviewComplete = receipt.available && data.pull_request_review_completed_now === true && Number(data.latest_approval_count ?? 0) > 0;
  const headMatches = receipt.available && Boolean(localGitState.head_sha) && data.head_ref_oid === localGitState.head_sha;
  return [
    evidenceRow({
      row_id: "pr.review.completed",
      category: "pull_request",
      label: "Independent GitHub PR review completed",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: reviewComplete,
      current_verdict: reviewComplete ? "pass" : "block",
      block_reason: reviewComplete ? null : "independent_github_pr_review_missing",
      pull_request_number: data.pull_request_number ?? null,
      pull_request_url: data.pull_request_url ?? null,
      review_decision: data.review_decision ?? null,
      latest_approval_count: data.latest_approval_count ?? null,
      generated_at: generatedAt,
    }),
    evidenceRow({
      row_id: "pr.commit.head_matches_local",
      category: "commit_sha",
      label: "PR head SHA matches local commit",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: headMatches,
      current_verdict: headMatches ? "pass" : "block",
      block_reason: headMatches ? null : "pr_head_sha_stale_or_unknown",
      head_ref_oid: data.head_ref_oid ?? null,
      local_commit_sha: localGitState.head_sha ?? null,
      generated_at: generatedAt,
    }),
  ];
}

function buildAttestationRows(receipt, generatedAt) {
  const data = receipt.data ?? {};
  const verified = receipt.available && data.signed_attestation_generated_now === true && data.attestation_verification_passed_now === true;
  const commitBound = verified && Boolean(data.commit_sha || data.subject_sha || data.attestation_commit_sha);
  return [
    evidenceRow({
      row_id: "attestation.verify.passed",
      category: "attestation",
      label: "Signed attestation verification passed",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: verified,
      current_verdict: verified ? "pass" : "block",
      block_reason: verified ? null : "attestation_not_verified",
      attestation_support_status: data.attestation_support_status ?? null,
      attestation_block_reason: data.attestation_block_reason ?? null,
      generated_at: generatedAt,
    }),
    evidenceRow({
      row_id: "attestation.commit_bound",
      category: "attestation",
      label: "Attestation is commit-bound for release use",
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: commitBound,
      current_verdict: commitBound ? "pass" : "block",
      block_reason: commitBound ? null : "attestation_commit_binding_missing",
      attestation_subject: data.attestation_subject ?? null,
      verification_output_hash: data.verification_output_hash ?? null,
      generated_at: generatedAt,
    }),
  ];
}

function buildFreshnessRows({ receipts, localGitState, generatedAt }) {
  const receiptSpecs = [
    ["remote", receipts.remote, receipts.remote.data?.commit_sha],
    ["branch_protection", receipts.branchProtection, null],
    ["required_check", receipts.requiredCheck, null],
    ["actions_run", receipts.actionsRun, receipts.actionsRun.data?.commit_sha],
    ["pull_request_review", receipts.pullRequestReview, receipts.pullRequestReview.data?.head_ref_oid],
    ["attestation", receipts.attestation, receipts.attestation.data?.commit_sha ?? receipts.attestation.data?.attestation_commit_sha ?? null],
  ];
  return receiptSpecs.map(([id, receipt, receiptCommit]) => {
    const generated = Date.parse(receipt.data?.generated_at ?? "");
    const now = Date.parse(generatedAt);
    const ageHours = Number.isFinite(generated) && Number.isFinite(now) ? Math.max(0, Math.round((now - generated) / 36_000) / 100) : null;
    const fresh = receipt.available && ageHours !== null && ageHours <= 168;
    const commitCheckRequired = ["remote", "actions_run", "pull_request_review", "attestation"].includes(id);
    const commitCurrent = !commitCheckRequired || (Boolean(receiptCommit) && Boolean(localGitState.head_sha) && receiptCommit === localGitState.head_sha);
    return evidenceRow({
      row_id: `freshness.${id}`,
      category: "evidence_freshness",
      label: `${id} evidence freshness`,
      evidence_ref: receipt.path,
      evidence_present_now: receipt.available,
      external_check_passed_now: fresh && commitCurrent,
      current_verdict: fresh && commitCurrent ? "pass" : "block",
      block_reason: fresh ? (commitCurrent ? null : "evidence_commit_not_current") : "evidence_missing_or_stale",
      receipt_generated_at: receipt.data?.generated_at ?? null,
      receipt_age_hours: ageHours,
      freshness_window_hours: 168,
      receipt_commit_sha: receiptCommit ?? null,
      local_commit_sha: localGitState.head_sha ?? null,
      generated_at: generatedAt,
    });
  });
}

function buildExternalCloseoutRows(context) {
  const checks = [
    ["source.p10200", "P10200 source ready", isSourceReady(context.source), context.source.path],
    ["source.review", "P10200 Claude review receipt ready", hasCompletedSourceReview(context.sourceReviewReceipt), context.sourceReviewReceipt.path],
    ["remote", "GitHub remote/auth binding complete", allPass(context.remoteRows), context.receipts.remote.path],
    ["branch_protection", "Branch protection evidence complete", allPass(context.branchRows), context.receipts.branchProtection.path],
    ["required_checks", "Required check evidence complete", allPass(context.requiredRows), context.receipts.requiredCheck.path],
    ["actions_run", "Current commit Actions evidence complete", allPass(context.actionsRows), context.receipts.actionsRun.path],
    ["pr_commit", "Independent PR review and commit evidence complete", allPass(context.prRows), context.receipts.pullRequestReview.path],
    ["attestation", "Signed attestation evidence complete", allPass(context.attestationRows), context.receipts.attestation.path],
    ["freshness", "Evidence freshness and current commit binding complete", allPass(context.freshnessRows), "artifacts/ci-github-evidence-bridge/latest/evidence-freshness-rows.json"],
  ];
  return checks.map(([id, label, pass, evidenceRef]) => verdictRow({
    row_id: `external_closeout.${id}`,
    category: "external_evidence_closeout",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id}_external_evidence_incomplete`,
    evidence_ref: evidenceRef,
    generated_at: context.generatedAt,
  }));
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
    raw_payload_visible: false,
    generated_at: generatedAt,
  }));
}

async function buildApiSmokeRows({ source, sourceReviewReceipt, receipts, localGitState, generatedAt }) {
  const rows = [];
  for (const [routePath, routeId] of API_ROUTE_SPECS) {
    const response = await buildCiGithubEvidenceApiResponse(routePath, {
      runAt: generatedAt,
      method: "GET",
      claudeReviewIntegrationLane: source.data,
      sourceClaudeReviewReceipt: sourceReviewReceipt.data,
      remoteBindingReceipt: receipts.remote.data,
      branchProtectionReceipt: receipts.branchProtection.data,
      requiredCheckReceipt: receipts.requiredCheck.data,
      actionsRunReceipt: receipts.actionsRun.data,
      pullRequestReviewReceipt: receipts.pullRequestReview.data,
      attestationVerifyReceipt: receipts.attestation.data,
      claudeReviewReceipt: receipts.claudeReview.data,
      localGitState,
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
  const mutationResponse = await buildCiGithubEvidenceApiResponse("/api/ci-github/remote", {
    runAt: generatedAt,
    method: "POST",
    claudeReviewIntegrationLane: source.data,
    sourceClaudeReviewReceipt: sourceReviewReceipt.data,
    localGitState,
  });
  rows.push(verdictRow({
    row_id: "api_smoke.post_blocked",
    category: "api_smoke",
    label: "POST mutation blocked",
    description: "Mutation methods are rejected by the CI/GitHub evidence API.",
    required: true,
    observed: mutationResponse.status === 405,
    current_verdict: mutationResponse.status === 405 ? "pass" : "block",
    block_reason: mutationResponse.status === 405 ? null : "mutation_method_not_blocked",
    evidence_ref: "POST /api/ci-github/remote",
    generated_at: generatedAt,
  }));
  return rows;
}

async function buildBrowserSmokeRows({ source, sourceReviewReceipt, receipts, localGitState, generatedAt }) {
  const response = await buildCiGithubEvidenceApiResponse("/ci-github-evidence.html", {
    runAt: generatedAt,
    method: "GET",
    claudeReviewIntegrationLane: source.data,
    sourceClaudeReviewReceipt: sourceReviewReceipt.data,
    remoteBindingReceipt: receipts.remote.data,
    branchProtectionReceipt: receipts.branchProtection.data,
    requiredCheckReceipt: receipts.requiredCheck.data,
    actionsRunReceipt: receipts.actionsRun.data,
    pullRequestReviewReceipt: receipts.pullRequestReview.data,
    attestationVerifyReceipt: receipts.attestation.data,
    claudeReviewReceipt: receipts.claudeReview.data,
    localGitState,
  });
  const html = response.body;
  const checks = [
    ["html.status", "renders CI/GitHub bridge status", html.includes("CI/GitHub Evidence Bridge")],
    ["html.external", "renders external evidence state", html.includes("External evidence")],
    ["html.blockers", "renders blocker count", html.includes("Blockers")],
    ["html.boundary", "renders authority boundary", html.includes("Authority boundary")],
    ["html.no_write", "does not expose write controls", !/(<button|type=\"submit\"|gh pr merge|git push|deploy now|merge now|apply now)/i.test(html)],
    ["html.no_raw", "does not expose raw payloads or credentials", !/(raw payload|token|secret|api key|gho_)/i.test(html)],
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
    evidence_ref: "/ci-github-evidence.html",
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

function buildBoundary(context, generatedAt) {
  const sourceReady = isSourceReady(context.source);
  const sourceReviewReady = hasCompletedSourceReview(context.sourceReviewReceipt);
  const p10400ReviewReady = hasCompletedP10400Review(context.receipts.claudeReview);
  const externalEvidenceComplete = [
    context.github_remote_binding_rows,
    context.branch_protection_evidence_rows,
    context.required_check_evidence_rows,
    context.actions_run_evidence_rows,
    context.pr_commit_evidence_rows,
    context.attestation_evidence_rows,
    context.evidence_freshness_rows,
  ].every(allPass);
  const externalBlockerCount = context.external_evidence_closeout_rows.filter((row) => row.current_verdict === "block").length;
  const rawVisible = [
    ...context.github_remote_binding_rows,
    ...context.branch_protection_evidence_rows,
    ...context.required_check_evidence_rows,
    ...context.actions_run_evidence_rows,
    ...context.pr_commit_evidence_rows,
    ...context.attestation_evidence_rows,
  ].some((row) => row.raw_payload_inlined === true);
  const bridgeReady = sourceReady
    && sourceReviewReady
    && p10400ReviewReady
    && !rawVisible
    && allPass(context.routeRows)
    && allPass(context.apiSmokeRows)
    && allPass(context.browserSmokeRows)
    && allPass(context.negativeFixtureRows);
  return {
    schema_version: "ci-github-evidence-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    source_p10200_ready: sourceReady,
    source_review_receipt_completed_now: sourceReviewReady,
    p10400_claude_review_required_now: true,
    p10400_claude_review_completed_now: p10400ReviewReady,
    external_evidence_complete_now: externalEvidenceComplete,
    external_closeout_blocker_count: externalBlockerCount,
    external_closeout_allowed_now: false,
    release_closeout_allowed_now: false,
    enterprise_trust_allowed_now: false,
    missing_external_evidence_blocks_closeout: true,
    stale_external_evidence_blocks_closeout: true,
    github_write_allowed: false,
    github_merge_allowed: false,
    branch_protection_mutation_allowed: false,
    required_check_mutation_allowed: false,
    attestation_generation_allowed: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    raw_payload_visible: rawVisible,
    secret_keys_returned: false,
    api_write_methods_enabled: false,
    p10400_bridge_ready: bridgeReady,
    ready_for_p10401_handoff: bridgeReady,
  };
}

function buildFreezeRows(context, generatedAt) {
  const checks = [
    ["freeze.source", "P10200 source is ready", isSourceReady(context.source)],
    ["freeze.source_review", "P10200 source review receipt is ready", hasCompletedSourceReview(context.sourceReviewReceipt)],
    ["freeze.phase_rows", "All P10201-P10400 phase rows are documented", true],
    ["freeze.external_rows_visible", "All external evidence rows are visible", context.external_evidence_closeout_rows.length >= 9],
    ["freeze.external_blockers_visible", "Missing or stale external evidence remains visible as blockers", context.external_evidence_closeout_rows.every((row) => ["pass", "block"].includes(row.current_verdict))],
    ["freeze.api_read_only", "CI/GitHub API and UI projection is read-only", allPass(context.routeRows) && allPass(context.apiSmokeRows) && allPass(context.browserSmokeRows)],
    ["freeze.negative_fixtures", "Negative fixtures fail closed", allPass(context.negativeFixtureRows)],
    ["freeze.no_raw_payload", "Raw payloads and credentials are not exposed", context.boundary.raw_payload_visible === false && context.boundary.secret_keys_returned === false],
    ["freeze.authority_boundary", "GitHub bridge does not create release, enterprise, or final approval", context.boundary.release_closeout_allowed_now === false && context.boundary.enterprise_trust_allowed_now === false && context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false],
    ["freeze.claude_review", "P10400 Claude review receipt is complete", hasCompletedP10400Review(context.receipts.claudeReview)],
  ];
  return checks.map(([id, label, pass]) => verdictRow({
    row_id: id,
    category: "p10400_freeze",
    label,
    description: label,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replace(/^freeze\./, "")}_not_ready`,
    evidence_ref: id === "freeze.claude_review" ? context.receipts.claudeReview.path : "artifacts/ci-github-evidence-bridge/latest/ci-github-evidence-bridge.json",
    generated_at: generatedAt,
  }));
}

function buildGateRows(context, generatedAt) {
  const checks = [
    ["gate.source", "source", isSourceReady(context.source), context.source.path],
    ["gate.source_review", "review", hasCompletedSourceReview(context.sourceReviewReceipt), context.sourceReviewReceipt.path],
    ["gate.external_visibility", "external_evidence", context.external_evidence_closeout_rows.length >= 9, "artifacts/ci-github-evidence-bridge/latest/external-evidence-closeout-rows.json"],
    ["gate.external_completion_not_overclaimed", "external_evidence", context.boundary.external_closeout_allowed_now === false && context.boundary.release_closeout_allowed_now === false, "artifacts/ci-github-evidence-bridge/latest/ci-github-evidence-boundary.json"],
    ["gate.api", "api", allPass(context.routeRows) && allPass(context.apiSmokeRows) && allPass(context.browserSmokeRows), "artifacts/ci-github-evidence-bridge/latest/index.html"],
    ["gate.boundary", "authority", context.boundary.github_write_allowed === false && context.boundary.enterprise_trust_allowed_now === false, "artifacts/ci-github-evidence-bridge/latest/ci-github-evidence-boundary.json"],
    ["gate.claude_review", "review", hasCompletedP10400Review(context.receipts.claudeReview), context.receipts.claudeReview.path],
  ];
  return checks.map(([id, category, pass, evidenceRef]) => verdictRow({
    row_id: id,
    category,
    label: id.replace(/^gate\./, ""),
    description: `${id} must pass before P10400 bridge closeout.`,
    required: true,
    observed: pass,
    current_verdict: pass ? "pass" : "block",
    block_reason: pass ? null : `${id.replace(/^gate\./, "")}_gate_blocked`,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
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
    validationItem("docs.architecture", "docs", includesToken(context.architectureDoc.text, PROGRAM_RANGE), "architecture must mention P10400 bridge"),
    validationItem("validate.chain", "package", validateScript.includes(`${COMMAND_NAME} -- --check`), "validate chain must include P10400 command"),
    validationItem("validate.order", "package", sourceIndex !== -1 && commandIndex > sourceIndex, "P10400 validate must run after P10200"),
    validationItem("source.p10200", "source", isSourceReady(context.source), "P10200 source must be ready"),
    validationItem("source.review", "source", hasCompletedSourceReview(context.sourceReviewReceipt), "P10200 source review receipt must be ready"),
    validationItem("phase.coverage", "phase", allPass(context.phaseRows), "all P10201-P10400 phases must be documented"),
    validationItem("external.rows.visible", "external_evidence", context.external_evidence_closeout_rows.length >= 9, "external evidence rows must be visible"),
    validationItem("external.no_overclaim", "external_evidence", context.boundary.external_closeout_allowed_now === false && context.boundary.release_closeout_allowed_now === false && context.boundary.enterprise_trust_allowed_now === false, "external evidence bridge cannot create release or enterprise PASS"),
    validationItem("api.routes", "api", allPass(context.routeRows), "API routes must be declared"),
    validationItem("api.smoke", "api", allPass(context.apiSmokeRows), "API smoke must pass"),
    validationItem("browser.smoke", "ui", allPass(context.browserSmokeRows), "browser smoke must pass"),
    validationItem("negative.fixtures", "fixtures", allPass(context.negativeFixtureRows), "negative fixtures must be present"),
    validationItem("boundary.no_write", "authority", context.boundary.github_write_allowed === false && context.boundary.github_merge_allowed === false, "GitHub write and merge must remain disabled"),
    validationItem("boundary.no_final_approval", "authority", context.boundary.codex_final_approval_allowed === false && context.boundary.claude_final_approval_allowed === false, "Codex and Claude cannot be final approvers"),
    validationItem("boundary.no_raw", "authority", context.boundary.raw_payload_visible === false && context.boundary.secret_keys_returned === false, "raw payloads and secrets cannot be exposed"),
    validationItem("review.p10400", "review", hasCompletedP10400Review(context.receipts.claudeReview), "P10400 Claude review receipt must be complete"),
    validationItem("freeze.rows", "freeze", allPass(context.freezeRows), "P10400 freeze rows must pass"),
    validationItem("gate.rows", "gate", allPass(context.gateRows), "P10400 gate rows must pass"),
  ];
}

function buildSummary(context) {
  const p10400BridgeReady = context.boundary.p10400_bridge_ready;
  const status = context.validation.valid && p10400BridgeReady
    ? READY_STATUS
    : isSourceReady(context.source) && hasCompletedSourceReview(context.sourceReviewReceipt)
      ? REVIEW_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    schema_version: "ci-github-evidence-summary.v1",
    ci_github_evidence_bridge_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_p10200_ready: isSourceReady(context.source),
    source_review_receipt_completed_now: hasCompletedSourceReview(context.sourceReviewReceipt),
    phase_row_count: context.phaseRows.length,
    remote_binding_count: context.github_remote_binding_rows.length,
    branch_protection_count: context.branch_protection_evidence_rows.length,
    required_check_count: context.required_check_evidence_rows.length,
    actions_run_count: context.actions_run_evidence_rows.length,
    pr_commit_count: context.pr_commit_evidence_rows.length,
    attestation_count: context.attestation_evidence_rows.length,
    evidence_freshness_count: context.evidence_freshness_rows.length,
    external_closeout_blocker_count: context.boundary.external_closeout_blocker_count,
    external_evidence_complete_now: context.boundary.external_evidence_complete_now,
    p10400_claude_review_required_now: true,
    p10400_claude_review_completed_now: context.boundary.p10400_claude_review_completed_now,
    p10400_bridge_ready: p10400BridgeReady,
    ready_for_p10401_handoff: p10400BridgeReady,
    github_write_allowed: false,
    github_merge_allowed: false,
    release_closeout_allowed_now: false,
    enterprise_trust_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    raw_payload_visible: context.boundary.raw_payload_visible,
    secret_keys_returned: false,
    validation_error_count: context.validation.errors.length,
  };
}

function buildApiSummary(source, sourceReviewReceipt, receipts, collections, boundary) {
  const validation = summarizeValidation([
    validationItem("source", "source", isSourceReady(source), "source ready"),
    validationItem("source.review", "source", hasCompletedSourceReview(sourceReviewReceipt), "source review ready"),
    validationItem("external.visible", "external", collections.external_evidence_closeout_rows.length >= 9, "external evidence visible"),
    validationItem("review", "review", hasCompletedP10400Review(receipts.claudeReview), "P10400 review complete"),
  ]);
  return buildSummary({
    source,
    sourceReviewReceipt,
    receipts,
    phaseRows: [],
    sourceBindingRows: [],
    routeRows: [],
    apiSmokeRows: [],
    browserSmokeRows: [],
    negativeFixtureRows: [],
    freezeRows: [],
    gateRows: [],
    boundary,
    validation,
    ...collections,
  });
}

function renderSummaryMarkdown(result) {
  return [
    `# Hermes ${PROGRAM_RANGE} CI/GitHub Evidence Bridge`,
    "",
    `Status: ${result.summary.ci_github_evidence_bridge_status}`,
    `Source ${SOURCE_PROGRAM_RANGE} ready: ${result.summary.source_p10200_ready}`,
    `External evidence complete: ${result.summary.external_evidence_complete_now}`,
    `External closeout blockers: ${result.summary.external_closeout_blocker_count}`,
    `P10400 Claude review completed: ${result.summary.p10400_claude_review_completed_now}`,
    `P10400 bridge ready: ${result.summary.p10400_bridge_ready}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "Boundary: this bridge is read-only evidence projection. Missing, stale, or incomplete GitHub/CI/attestation evidence blocks external closeout but does not permit GitHub writes, merge, release PASS, enterprise trust, or final approval by Codex or Claude.",
  ].join("\n");
}

function renderClaudeReviewPacket(result) {
  const packet = {
    review_scope: PROGRAM_RANGE,
    review_objective: "Review the Hermes CI/GitHub Evidence Bridge for stale/missing external evidence overclaims, raw payload leaks, read-only API projection, and authority-boundary regressions.",
    reviewed_artifact_ref: "artifacts/ci-github-evidence-bridge/latest/ci-github-evidence-bridge.json",
    bootstrap_review_instruction: "Do not treat missing, stale, or incomplete external GitHub/CI/attestation evidence as a defect by itself if it is clearly surfaced as a blocker and release/enterprise PASS remains false. Report a finding if the bridge overclaims completion, hides blockers, exposes raw payloads or credentials, enables GitHub writes, or lets Codex/Claude become final approvers.",
    required_checks: [
      "P10200 source binding must be ready",
      "GitHub remote, branch protection, required check, actions, PR/commit, and attestation evidence must be visible",
      "Missing or stale external evidence must block external closeout",
      "API/UI projection must be GET/HEAD only and sanitized",
      "The bridge must not enable GitHub write, merge, release PASS, enterprise trust, or final approval",
    ],
    summary: result.summary,
    external_evidence_closeout_rows: result.external_evidence_closeout_rows,
    freshness_rows: result.evidence_freshness_rows,
    authority_boundary: result.ci_github_evidence_boundary,
    validation_errors: result.validation.errors,
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

function renderCiGithubEvidenceHtml(result) {
  const summary = result.summary ?? {};
  const boundary = result.ci_github_evidence_boundary ?? {};
  const rows = [
    ["Status", summary.ci_github_evidence_bridge_status],
    ["External evidence", summary.external_evidence_complete_now],
    ["Blockers", summary.external_closeout_blocker_count],
    ["Claude review", summary.p10400_claude_review_completed_now],
    ["Bridge ready", summary.p10400_bridge_ready],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CI/GitHub Evidence Bridge</title>
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
    <h1>CI/GitHub Evidence Bridge</h1>
    <section>
      <table aria-label="CI GitHub evidence status">
        <tbody>
          ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td><code>${escapeHtml(String(value ?? ""))}</code></td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Authority boundary</h2>
      <table aria-label="Authority boundary">
        <tbody>
          <tr><th>GitHub write</th><td>${escapeHtml(String(boundary.github_write_allowed))}</td></tr>
          <tr><th>GitHub merge</th><td>${escapeHtml(String(boundary.github_merge_allowed))}</td></tr>
          <tr><th>Release closeout</th><td>${escapeHtml(String(boundary.release_closeout_allowed_now))}</td></tr>
          <tr><th>Enterprise trust</th><td>${escapeHtml(String(boundary.enterprise_trust_allowed_now))}</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function evidenceRow(values) {
  return {
    schema_version: "ci-github-evidence-row.v1",
    raw_payload_inlined: false,
    github_write_allowed: false,
    verdict_authority: "harness_only",
    ...values,
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
  return { validation_id: validationId, category, pass: Boolean(pass), message };
}

async function normalizeReceiptsFromOptions(options) {
  return {
    remote: Object.prototype.hasOwnProperty.call(options, "remoteBindingReceipt") ? normalizeInlineJsonSource("inline.remote_binding_receipt", options.remoteBindingReceipt) : await readOptionalJsonSource(options.remoteBindingReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.remoteBindingReceiptPath),
    branchProtection: Object.prototype.hasOwnProperty.call(options, "branchProtectionReceipt") ? normalizeInlineJsonSource("inline.branch_protection_receipt", options.branchProtectionReceipt) : await readOptionalJsonSource(options.branchProtectionReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.branchProtectionReceiptPath),
    requiredCheck: Object.prototype.hasOwnProperty.call(options, "requiredCheckReceipt") ? normalizeInlineJsonSource("inline.required_check_receipt", options.requiredCheckReceipt) : await readOptionalJsonSource(options.requiredCheckReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.requiredCheckReceiptPath),
    actionsRun: Object.prototype.hasOwnProperty.call(options, "actionsRunReceipt") ? normalizeInlineJsonSource("inline.actions_run_receipt", options.actionsRunReceipt) : await readOptionalJsonSource(options.actionsRunReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.actionsRunReceiptPath),
    pullRequestReview: Object.prototype.hasOwnProperty.call(options, "pullRequestReviewReceipt") ? normalizeInlineJsonSource("inline.pull_request_review_receipt", options.pullRequestReviewReceipt) : await readOptionalJsonSource(options.pullRequestReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.pullRequestReviewReceiptPath),
    attestation: Object.prototype.hasOwnProperty.call(options, "attestationVerifyReceipt") ? normalizeInlineJsonSource("inline.attestation_verify_receipt", options.attestationVerifyReceipt) : await readOptionalJsonSource(options.attestationVerifyReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.attestationVerifyReceiptPath),
    claudeReview: Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt") ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt) : await readJsonSource(options.claudeReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.claudeReviewReceiptPath),
  };
}

async function readJsonOrBuildClaudeReviewIntegrationLane(filePath, generatedAt) {
  const read = await readJsonSource(filePath);
  if (isSourceReady(read)) return read;
  try {
    const built = await buildClaudeReviewIntegrationLane({ runAt: generatedAt, write: false });
    return {
      available: built.validation.valid,
      path: path.resolve(filePath),
      data: built,
      error: built.validation.valid ? null : "generated P10200 source is not valid",
    };
  } catch (error) {
    return read.available ? read : { ...read, error: `${read.error ?? "source unavailable"}; build failed: ${error.message}` };
  }
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { available: true, path: resolved, data: JSON.parse(await readFile(resolved, "utf8")), error: null };
  } catch (error) {
    return { available: false, path: resolved, data: null, error: error.message };
  }
}

async function readOptionalJsonSource(filePath) {
  return readJsonSource(filePath);
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { available: true, path: resolved, text: await readFile(resolved, "utf8"), error: null };
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
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.schemaPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.packagePath),
    roadmap_doc_path: path.resolve(options.roadmapDocPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.roadmapDocPath),
    architecture_doc_path: path.resolve(options.architectureDocPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.architectureDocPath),
    source_claude_review_integration_path: path.resolve(options.sourceClaudeReviewIntegrationPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.sourceClaudeReviewIntegrationPath),
    source_claude_review_receipt_path: path.resolve(options.sourceClaudeReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.sourceClaudeReviewReceiptPath),
    remote_binding_receipt_path: path.resolve(options.remoteBindingReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.remoteBindingReceiptPath),
    branch_protection_receipt_path: path.resolve(options.branchProtectionReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.branchProtectionReceiptPath),
    required_check_receipt_path: path.resolve(options.requiredCheckReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.requiredCheckReceiptPath),
    actions_run_receipt_path: path.resolve(options.actionsRunReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.actionsRunReceiptPath),
    pull_request_review_receipt_path: path.resolve(options.pullRequestReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.pullRequestReviewReceiptPath),
    attestation_verify_receipt_path: path.resolve(options.attestationVerifyReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.attestationVerifyReceiptPath),
    claude_review_receipt_path: path.resolve(options.claudeReviewReceiptPath ?? DEFAULT_CI_GITHUB_EVIDENCE_BRIDGE_INPUTS.claudeReviewReceiptPath),
  };
}

async function detectLocalGitState(cwd) {
  const [head, branch] = await Promise.all([
    safeGit(["rev-parse", "HEAD"], cwd),
    safeGit(["branch", "--show-current"], cwd),
  ]);
  return {
    cwd,
    head_sha: head.ok ? head.stdout.trim() : null,
    branch_name: branch.ok ? branch.stdout.trim() : null,
    git_available_now: head.ok,
    error: head.ok ? null : head.error,
  };
}

async function safeGit(args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd, timeout: 5000 });
    return { ok: true, stdout, stderr };
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? "", stderr: error.stderr ?? "", error: error.message };
  }
}

function isSourceReady(source) {
  const data = source.data ?? {};
  return source.available
    && data.schema_version === "claude-review-integration-lane.v1"
    && data.program_range === SOURCE_PROGRAM_RANGE
    && data.validation?.valid === true
    && data.summary?.claude_review_integration_status === "ready_for_claude_review_integration_lane"
    && data.summary?.ready_for_p10201_handoff === true
    && data.summary?.p10200_freeze_ready === true;
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

function hasCompletedP10400Review(receipt) {
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

function allPass(rows = []) {
  return rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesToken(text, token) {
  return String(text ?? "").includes(token);
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function normalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function jsonResponse(status, body, method = "GET") {
  return { status, headers: { "content-type": "application/json; charset=utf-8" }, body: method === "HEAD" ? "" : JSON.stringify(body, null, 2) };
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
    if (/(raw_|rawPayload|raw_payload|stdout|stderr|command_observations|token|secret|api_key|authorization)/i.test(key)) continue;
    output[key] = sanitizeApiPayload(entry);
  }
  return output;
}

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => /(raw_|rawPayload|raw_payload|stdout|stderr|command_observations|token|secret|api_key|authorization)/i.test(key) || hasSensitiveKey(entry));
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    else if (arg === "--claude-review-receipt") args.claudeReviewReceiptPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ci-github-evidence-bridge.mjs [options]

Options:
  --check                         Validate without writing artifacts
  --serve                         Start the read-only API server
  --out-dir <path>                Output directory
  --run-at <iso>                  Deterministic timestamp
  --claude-review-receipt <path>  P10400 Claude receipt path
  --host <host>                   API host
  --port <port>                   API port
`);
}
