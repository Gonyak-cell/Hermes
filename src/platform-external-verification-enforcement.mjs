import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformVerificationTrustActivation } from "./platform-verification-trust-activation.mjs";

const execFileAsync = promisify(execFile);

export const DEFAULT_PLATFORM_EXTERNAL_VERIFICATION_ENFORCEMENT_OUT_DIR = "artifacts/platform-external-verification-enforcement/latest";
export const DEFAULT_PLATFORM_EXTERNAL_VERIFICATION_ENFORCEMENT_INPUTS = {
  schemaPath: "schemas/platform-external-verification-enforcement.schema.json",
  packagePath: "package.json",
  packageLockPath: "package-lock.json",
  verificationTrustActivationLedgerPath: "docs/hermes-verification-trust-activation.md",
  externalVerificationEnforcementLedgerPath: "docs/hermes-external-verification-enforcement.md",
  workflowPath: ".github/workflows/hermes-verification-trust.yml",
  sourceModulePath: "src/platform-verification-trust-activation.mjs",
  remoteBindingReceiptPath: "artifacts/platform-external-verification-enforcement/github/remote-binding-receipt.json",
  branchProtectionReceiptPath: "artifacts/platform-external-verification-enforcement/github/branch-protection-receipt.json",
  requiredCheckReceiptPath: "artifacts/platform-external-verification-enforcement/github/required-check-receipt.json",
  actionsRunReceiptPath: "artifacts/platform-external-verification-enforcement/github/actions-run-receipt.json",
  claudeReviewReceiptPath: "artifacts/platform-external-verification-enforcement/review/claude-review-receipt.json",
  humanAdjudicationReceiptPath: "artifacts/platform-external-verification-enforcement/review/human-adjudication-receipt.json",
  attestationVerificationReceiptPath: "artifacts/platform-external-verification-enforcement/attestation/attestation-verify-receipt.json",
};

const COMMAND_NAME = "platform:external-verification-enforcement";
const SOURCE_COMMAND_NAME = "platform:verification-trust-activation";
const SCHEMA_VERSION = "platform-external-verification-enforcement.v1";
const CAPABILITY_ID = "platform.external_verification_enforcement";
const READY_STATUS = "ready_for_platform_external_verification_enforcement";
const BLOCKED_STATUS = "blocked_pending_external_verification_enforcement";
const SOURCE_READY_STATUS = "ready_for_platform_verification_trust_activation";
const PROGRAM_RANGE = "P3521-P3680";
const PHASE_RANGE = "P3521-P3680";
const PHASE_SLOT = "P3521";
const PREVIOUS_PHASE_SLOT = "P3520";
const NEXT_PHASE_SLOT = "P3681";

const COMPONENT_SPECS = [
  ["reviewer_authority_registry", "Register Claude Code Opus max independent reviewer profile"],
  ["confidentiality_review_packet_gate", "Classify artifacts before external review packet export"],
  ["blind_independent_review_packet", "Default to blind Independent review mode"],
  ["finding_normalization", "Require structured findings with location and evidence"],
  ["human_adjudication_receipt", "Require human owner ACCEPT/MODIFY/REJECT/HOLD decisions"],
  ["github_branch_protection_evidence", "Observe branch protection and required status checks"],
  ["signed_attestation_verification", "Observe signed attestation generation and verification"],
  ["external_enforcement_freeze", "Freeze true controls and visible blocked controls"],
];

const REVIEW_PACKET_SPECS = [
  ["artifact_intake", "P0 artifact type and confidentiality classification"],
  ["external_transfer_gate", "External model transfer decision and redaction gate"],
  ["review_process_serialization", "Review criteria, scope, references, and exclusions"],
  ["review_packet_manifest", "Manifest with primary reviewer, external reviewer, adjudicator, and mode"],
  ["blind_independent_mode", "Default packet hides primary reviewer conclusion"],
  ["finding_schema", "Structured finding schema for normalization and adjudication"],
];

const FINDING_REQUIRED_FIELDS = [
  "finding_id",
  "severity",
  "category",
  "location",
  "evidence",
  "issue",
  "proposed_change",
  "confidence",
  "risk_if_accepted",
  "risk_if_rejected",
];

const REQUIRED_CHECK_SPECS = [
  ["npm_ci", "npm ci"],
  ["validate_core", "npm run validate:core"],
  ["source_trust_activation", "npm run platform:verification-trust-activation -- --check"],
  ["external_enforcement", "npm run platform:external-verification-enforcement -- --check"],
  ["focused_node_test", "node --test test/platform-external-verification-enforcement.test.mjs"],
  ["diff_whitespace", "git diff --check"],
  ["attestation_step", "actions/attest@v4"],
];

export async function runPlatformExternalVerificationEnforcement(options = {}) {
  const result = await buildPlatformExternalVerificationEnforcement(options);
  if (options.write !== false) await writePlatformExternalVerificationEnforcement(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform external verification enforcement failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformExternalVerificationEnforcement(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_EXTERNAL_VERIFICATION_ENFORCEMENT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const packageLock = await readJsonSource(inputs.package_lock_path);
  const activationLedger = await readTextSource(inputs.verification_trust_activation_ledger_path);
  const enforcementLedger = await readTextSource(inputs.external_verification_enforcement_ledger_path);
  const workflow = await readTextSource(inputs.workflow_path);
  const sourceModule = await readTextSource(inputs.source_module_path);
  const remoteBindingReceipt = await readOptionalJsonSource(inputs.remote_binding_receipt_path);
  const branchProtectionReceipt = await readOptionalJsonSource(inputs.branch_protection_receipt_path);
  const requiredCheckReceipt = await readOptionalJsonSource(inputs.required_check_receipt_path);
  const actionsRunReceipt = await readOptionalJsonSource(inputs.actions_run_receipt_path);
  const claudeReviewReceipt = await readOptionalJsonSource(inputs.claude_review_receipt_path);
  const humanAdjudicationReceipt = await readOptionalJsonSource(inputs.human_adjudication_receipt_path);
  const attestationVerificationReceipt = await readOptionalJsonSource(inputs.attestation_verification_receipt_path);
  const livePreflight = mergeLivePreflightWithReceipts(options.livePreflight ?? await detectLivePreflight(options), {
    remoteBindingReceipt,
    branchProtectionReceipt,
    requiredCheckReceipt,
    actionsRunReceipt,
  });
  const sourceActivation = options.sourceActivation ?? await buildPlatformVerificationTrustActivation({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    verificationTrustActivationLedgerPath: inputs.verification_trust_activation_ledger_path,
    workflowPath: inputs.workflow_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const reviewerProfileRows = buildReviewerProfileRows({ livePreflight, claudeReviewReceipt });
  const reviewPacketRows = buildReviewPacketRows();
  const findingSchemaRows = buildFindingSchemaRows();
  const branchProtectionRows = buildBranchProtectionRows({ livePreflight });
  const requiredStatusCheckRows = buildRequiredStatusCheckRows({ workflow, branchProtectionRows });
  const attestationRows = buildAttestationRows({ workflow, attestationVerificationReceipt, livePreflight });
  const independentReviewRows = buildIndependentReviewRows({ claudeReviewReceipt, humanAdjudicationReceipt, livePreflight });
  const evidenceRows = buildEvidenceRows({ generatedAt, packageJson, packageLock, activationLedger, enforcementLedger, workflow, sourceModule, sourceActivation, livePreflight, remoteBindingReceipt, branchProtectionReceipt, requiredCheckReceipt, actionsRunReceipt, claudeReviewReceipt, humanAdjudicationReceipt, attestationVerificationReceipt });
  const validationLedgerRows = buildValidationLedgerRows({ generatedAt, sourceActivation, reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows });
  const enforcementCoverageRows = buildEnforcementCoverageRows({ reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows });
  const guardRows = buildGuardRows({ sourceActivation, reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows });
  const boundary = buildBoundary({ livePreflight, reviewerProfileRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, guardRows });
  const anchor = buildAnchor({ packageJson, packageLock, workflow, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows });
  const manifest = buildManifest({ generatedAt, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, boundary });
  const validationItems = buildValidationItems({ packageJson, packageLock, activationLedger, enforcementLedger, workflow, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_external_verification_enforcement_id: `platform-external-verification-enforcement.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    live_preflight: livePreflight,
    external_verification_enforcement_anchor: anchor,
    source_verification_trust_activation_summary: sourceActivation.summary,
    external_verification_enforcement_manifest: manifest,
    external_verification_component_rows: componentRows,
    reviewer_profile_rows: reviewerProfileRows,
    review_packet_rows: reviewPacketRows,
    finding_schema_rows: findingSchemaRows,
    branch_protection_rows: branchProtectionRows,
    required_status_check_rows: requiredStatusCheckRows,
    signed_attestation_rows: attestationRows,
    independent_review_completion_rows: independentReviewRows,
    evidence_provenance_rows: evidenceRows,
    validation_result_ledger_rows: validationLedgerRows,
    enforcement_coverage_rows: enforcementCoverageRows,
    external_verification_guard_rows: guardRows,
    external_verification_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_external_verification_enforcement")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_external_verification_enforcement_id = result.platform_external_verification_enforcement_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformExternalVerificationEnforcement(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-external-verification-enforcement.json"), serializableResult(result));
  await writeJson(path.join(outDir, "external-verification-enforcement-manifest.json"), result.external_verification_enforcement_manifest);
  await writeJson(path.join(outDir, "live-preflight.json"), result.live_preflight);
  await writeJson(path.join(outDir, "reviewer-profile-rows.json"), collectionEnvelope("reviewer-profile-rows.v1", "reviewer_profile_rows", result.reviewer_profile_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-packet-rows.json"), collectionEnvelope("review-packet-rows.v1", "review_packet_rows", result.review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "finding-schema-rows.json"), collectionEnvelope("finding-schema-rows.v1", "finding_schema_rows", result.finding_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "branch-protection-rows.json"), collectionEnvelope("branch-protection-rows.v1", "branch_protection_rows", result.branch_protection_rows, result.generated_at));
  await writeJson(path.join(outDir, "required-status-check-rows.json"), collectionEnvelope("required-status-check-rows.v1", "required_status_check_rows", result.required_status_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-attestation-rows.json"), collectionEnvelope("signed-attestation-rows.v1", "signed_attestation_rows", result.signed_attestation_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-completion-rows.json"), collectionEnvelope("independent-review-completion-rows.v1", "independent_review_completion_rows", result.independent_review_completion_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-provenance-rows.json"), collectionEnvelope("external-enforcement-evidence-provenance-rows.v1", "evidence_provenance_rows", result.evidence_provenance_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-result-ledger-rows.json"), collectionEnvelope("external-enforcement-validation-result-ledger-rows.v1", "validation_result_ledger_rows", result.validation_result_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "enforcement-coverage-rows.json"), collectionEnvelope("enforcement-coverage-rows.v1", "enforcement_coverage_rows", result.enforcement_coverage_rows, result.generated_at));
  await writeJson(path.join(outDir, "external-verification-guard-rows.json"), collectionEnvelope("external-verification-guard-rows.v1", "external_verification_guard_rows", result.external_verification_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "external-verification-boundary.json"), result.external_verification_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-external-verification-enforcement-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformExternalVerificationEnforcementCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformExternalVerificationEnforcement(args);
    console.log(`Platform external verification enforcement ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_external_verification_enforcement_status}`);
    console.log(`Claude Code available now: ${result.summary.claude_code_available_now}`);
    console.log(`GitHub remote configured now: ${result.summary.github_remote_configured_now}`);
    console.log(`Branch rules query available now: ${result.summary.branch_rules_query_available_now}`);
    console.log(`Branch rules count: ${result.summary.branch_rules_count}`);
    console.log(`Required status check enforced now: ${result.summary.required_status_check_enforced_now}`);
    console.log(`Signed attestation verified now: ${result.summary.attestation_verification_passed_now}`);
    console.log(`Independent review completed now: ${result.summary.independent_review_completed_now}`);
    console.log(`Human adjudication receipt present now: ${result.summary.human_adjudication_receipt_present_now}`);
    console.log(`External controls complete: ${result.summary.p3680_external_controls_complete}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function detectLivePreflight(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const commands = [];
  const originRemote = await runShellCommand("git_remote_origin", "git config --get remote.origin.url", cwd);
  commands.push(originRemote);
  const githubRemote = await runShellCommand("git_remote_github", "git config --get remote.github.url", cwd);
  commands.push(githubRemote);
  const branch = await runShellCommand("git_branch", "git branch --show-current", cwd);
  commands.push(branch);
  const ghPath = await runShellCommand("gh_path", "command -v gh", cwd);
  commands.push(ghPath);
  const claudePath = await runShellCommand("claude_path", "command -v claude", cwd);
  commands.push(claudePath);
  const claudeVersion = claudePath.exit_code === 0
    ? await runShellCommand("claude_version", "claude --version", cwd)
    : skippedCommand("claude_version", "claude --version", "claude_not_available");
  commands.push(claudeVersion);
  const selectedRemoteUrl = options.githubRepoUrl ?? firstGithubRemoteUrl([
    githubRemote.stdout.trim(),
    originRemote.stdout.trim(),
  ]);
  const parsedRemote = parseGithubRemote(selectedRemoteUrl);
  const repositoryFullName = options.repositoryFullName ?? (parsedRemote ? `${parsedRemote.owner}/${parsedRemote.repo}` : null);
  const branchName = options.branch ?? (branch.stdout.trim() || "main");
  const ghAuth = ghPath.exit_code === 0
    ? await runShellCommand("gh_auth_status", "gh auth status", cwd)
    : skippedCommand("gh_auth_status", "gh auth status", "gh_not_available");
  commands.push(ghAuth);
  const protection = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName
    ? await runShellCommand("gh_branch_protection", `gh api repos/${repositoryFullName}/branches/${quotePathPart(branchName)}/protection`, cwd)
    : skippedCommand("gh_branch_protection", "gh api repos/{owner}/{repo}/branches/{branch}/protection", repositoryFullName ? "gh_not_authenticated_or_unavailable" : "github_remote_not_configured");
  commands.push(protection);
  const branchRules = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName
    ? await runShellCommand("gh_branch_rules", `gh api repos/${repositoryFullName}/rules/branches/${quotePathPart(branchName)}`, cwd)
    : skippedCommand("gh_branch_rules", "gh api repos/{owner}/{repo}/rules/branches/{branch}", repositoryFullName ? "gh_not_authenticated_or_unavailable" : "github_remote_not_configured");
  commands.push(branchRules);
  const protectionJson = parseJsonMaybe(protection.stdout);
  const branchRulesJson = parseJsonMaybe(branchRules.stdout);
  const requiredContexts = protectionJson?.required_status_checks?.contexts ?? [];
  const prReviews = protectionJson?.required_pull_request_reviews ?? {};
  const forcePushDisabled = protectionJson?.allow_force_pushes?.enabled === false;
  const branchProtectionConfigured = Boolean(protectionJson && protection.exit_code === 0);
  return {
    schema_version: "external-verification-live-preflight.v1",
    cwd,
    generated_at: new Date(options.runAt ?? new Date()).toISOString(),
    git_remote_origin: originRemote.stdout.trim(),
    git_remote_github: githubRemote.stdout.trim(),
    git_remote_url: selectedRemoteUrl ?? "",
    git_branch: branchName,
    github_remote_configured_now: Boolean(parsedRemote),
    github_owner: parsedRemote?.owner ?? parseRepositoryFullName(repositoryFullName)?.owner ?? null,
    github_repo: parsedRemote?.repo ?? parseRepositoryFullName(repositoryFullName)?.repo ?? null,
    gh_cli_available_now: ghPath.exit_code === 0,
    gh_auth_available_now: ghAuth.exit_code === 0,
    claude_code_available_now: claudePath.exit_code === 0,
    claude_code_version: claudeVersion.exit_code === 0 ? claudeVersion.stdout.trim() : null,
    branch_protection_query_available_now: protection.exit_code === 0,
    branch_protection_configured_now: branchProtectionConfigured,
    branch_rules_query_available_now: branchRules.exit_code === 0,
    branch_rules_observed_now: branchRules.exit_code === 0 && Array.isArray(branchRulesJson),
    branch_rules_count: Array.isArray(branchRulesJson) ? branchRulesJson.length : null,
    required_status_check_enforced_now: requiredContexts.includes("Hermes verification trust"),
    required_pr_review_enforced_now: Number(prReviews.required_approving_review_count ?? 0) >= 1,
    stale_review_dismissal_enforced_now: prReviews.dismiss_stale_reviews === true,
    force_push_disabled_now: forcePushDisabled,
    command_observations: commands,
  };
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => safePassRow({
    schema_version: "external-verification-component-row.v1",
    row_id: `external.verification.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.external_verification.component.${componentId}`,
    reviewer_ref: "reviewer.platform_external_verification",
    hard_gate_ref: `gate.platform.external_verification.component.${componentId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "preserve external enforcement contract",
  }));
}

function buildReviewerProfileRows({ livePreflight, claudeReviewReceipt }) {
  const resolvedModelId = claudeReviewReceipt.data?.resolved_model_id ?? null;
  return [safePassRow({
    schema_version: "reviewer-profile-row.v1",
    row_id: "reviewer.profile.row.01",
    reviewer_id: "reviewer.claude_code.opus_max",
    reviewer_type: "ai_independent_reviewer",
    provider: "anthropic",
    tool: "claude_code",
    preferred_model_alias: "opus",
    preferred_model_family: "opus",
    required_reasoning_tier: "max",
    model_selection_policy: "latest_available_opus",
    resolved_model_id_required: true,
    resolved_model_id: resolvedModelId,
    model_resolution_timestamp: claudeReviewReceipt.data?.model_resolution_timestamp ?? null,
    claude_code_available_now: livePreflight.claude_code_available_now,
    claude_code_version: livePreflight.claude_code_version,
    fallback_without_human_receipt_allowed: false,
    write_permission_allowed: false,
    final_authority_allowed: false,
    review_scope: ["schema", "ci", "attestation", "security_boundary", "validation_logic"],
    evidence_ref: "evidence.platform.external_verification.reviewer.claude_code.opus_max",
    reviewer_ref: "reviewer.platform_reviewer_registry",
    hard_gate_ref: "gate.platform.external_verification.reviewer_profile",
    responsible_owner: "platform_verification_owner",
    next_allowed_action: resolvedModelId ? "preserve resolved model evidence" : "run Claude Code review and capture resolved_model_id receipt",
  })];
}

function buildReviewPacketRows() {
  return REVIEW_PACKET_SPECS.map(([packetId, description], index) => safePassRow({
    schema_version: "review-packet-row.v1",
    row_id: `review.packet.row.${String(index + 1).padStart(2, "0")}`,
    packet_id: packetId,
    packet_status: "contract_ready",
    description,
    default_review_mode: "independent",
    primary_conclusion_hidden_by_default: true,
    raw_source_mutation_allowed: false,
    external_transfer_requires_classification: true,
    evidence_ref: `evidence.platform.external_verification.review_packet.${packetId}`,
    reviewer_ref: "reviewer.platform_review_packet",
    hard_gate_ref: `gate.platform.external_verification.review_packet.${packetId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "materialize packet before external review execution",
  }));
}

function buildFindingSchemaRows() {
  return FINDING_REQUIRED_FIELDS.map((field, index) => safePassRow({
    schema_version: "finding-schema-row.v1",
    row_id: `finding.schema.row.${String(index + 1).padStart(2, "0")}`,
    field_name: field,
    field_required: true,
    normalization_required: true,
    missing_field_blocks_acceptance: true,
    evidence_ref: `evidence.platform.external_verification.finding_schema.${field}`,
    reviewer_ref: "reviewer.platform_finding_schema",
    hard_gate_ref: `gate.platform.external_verification.finding_schema.${field}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: "reject findings missing required field",
  }));
}

function buildBranchProtectionRows({ livePreflight }) {
  const rows = [
    ["github_remote_configured", livePreflight.github_remote_configured_now, "Git remote points to a GitHub repository"],
    ["gh_cli_available", livePreflight.gh_cli_available_now, "GitHub CLI is available for live enforcement checks"],
    ["gh_auth_available", livePreflight.gh_auth_available_now, "GitHub CLI authentication is available"],
    ["branch_protection_query_available", livePreflight.branch_protection_query_available_now, "Branch protection can be queried"],
    ["branch_rules_query_available", livePreflight.branch_rules_query_available_now, "Branch rules/rulesets can be queried"],
    ["branch_protection_configured", livePreflight.branch_protection_configured_now, "Protected branch/ruleset is configured"],
    ["required_status_check_enforced", livePreflight.required_status_check_enforced_now, "Hermes verification trust check is required"],
    ["required_pr_review_enforced", livePreflight.required_pr_review_enforced_now, "Pull request review is required"],
    ["force_push_disabled", livePreflight.force_push_disabled_now, "Force pushes are disabled"],
    ["stale_review_dismissal_enforced", livePreflight.stale_review_dismissal_enforced_now, "Stale reviews are dismissed after new commits"],
  ];
  return rows.map(([controlId, observed, description], index) => controlRow({
    schema_version: "branch-protection-row.v1",
    row_id: `branch.protection.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    description,
    observed_now: Boolean(observed),
    required_for_enterprise_trust: true,
    evidence_ref: `evidence.platform.external_verification.branch_protection.${controlId}`,
    reviewer_ref: "reviewer.platform_branch_protection",
    hard_gate_ref: `gate.platform.external_verification.branch_protection.${controlId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: observed ? "preserve live enforcement evidence" : `configure or verify ${controlId}`,
  }));
}

function buildRequiredStatusCheckRows({ workflow, branchProtectionRows }) {
  const requiredEnforced = branchProtectionRows.find((row) => row.control_id === "required_status_check_enforced")?.observed_now === true;
  return REQUIRED_CHECK_SPECS.map(([checkId, requiredText], index) => controlRow({
    schema_version: "required-status-check-row.v1",
    row_id: `required.status.check.row.${String(index + 1).padStart(2, "0")}`,
    check_id: checkId,
    required_text: requiredText,
    observed_now: requiredEnforced,
    workflow_defined_now: workflow.available && workflow.text.includes(requiredText),
    required_status_check_enforced_now: requiredEnforced,
    required_for_enterprise_trust: checkId !== "attestation_step",
    evidence_ref: `evidence.platform.external_verification.required_check.${checkId}`,
    reviewer_ref: "reviewer.platform_required_status_check",
    hard_gate_ref: `gate.platform.external_verification.required_check.${checkId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: requiredEnforced ? "preserve required check evidence" : "make Hermes verification trust job a required GitHub status check",
  }));
}

function buildAttestationRows({ workflow, attestationVerificationReceipt, livePreflight }) {
  const workflowDeclaresAttest = workflow.available && workflow.text.includes("actions/attest@v4");
  const workflowDeclaresPermissions = workflow.available
    && workflow.text.includes("id-token: write")
    && workflow.text.includes("attestations: write");
  const attestationObserved = isObservedReceipt(attestationVerificationReceipt.data);
  const verifyPassed = attestationObserved && attestationVerificationReceipt.data?.attestation_verification_passed_now === true;
  const supportStatus = attestationVerificationReceipt.data?.attestation_support_status ?? null;
  const blockReason = attestationVerificationReceipt.data?.attestation_block_reason ?? null;
  const policyRef = attestationVerificationReceipt.data?.attestation_policy_ref ?? null;
  const rows = [
    ["workflow_permissions_declared", workflowDeclaresPermissions, "Workflow declares OIDC and attestation permissions"],
    ["actions_attest_step_declared", workflowDeclaresAttest, "Workflow declares actions/attest@v4"],
    ["github_remote_supports_attestation", livePreflight.github_remote_configured_now, "GitHub repository context exists for attestation upload"],
    ["signed_attestation_generated", attestationObserved && attestationVerificationReceipt.data?.signed_attestation_generated_now === true, "Signed attestation was generated in CI"],
    ["attestation_verification_passed", verifyPassed, "gh attestation verify passed"],
  ];
  return rows.map(([controlId, observed, description], index) => controlRow({
    schema_version: "signed-attestation-row.v1",
    row_id: `signed.attestation.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    description,
    observed_now: Boolean(observed),
    required_for_enterprise_trust: true,
    external_signed_attestation_present_now: attestationObserved && attestationVerificationReceipt.data?.signed_attestation_generated_now === true,
    attestation_verification_passed_now: verifyPassed,
    attestation_support_status: supportStatus,
    attestation_block_reason: blockReason,
    attestation_policy_ref: policyRef,
    evidence_ref: `evidence.platform.external_verification.attestation.${controlId}`,
    reviewer_ref: "reviewer.platform_attestation",
    hard_gate_ref: `gate.platform.external_verification.attestation.${controlId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: observed ? "preserve attestation evidence" : `generate and verify attestation for ${controlId}`,
  }));
}

function buildIndependentReviewRows({ claudeReviewReceipt, humanAdjudicationReceipt, livePreflight }) {
  const claudeReceiptPresent = isObservedReceipt(claudeReviewReceipt.data) || claudeReviewReceipt.data?.review_completed_now === true;
  const resolvedModelCaptured = claudeReceiptPresent && Boolean(claudeReviewReceipt.data?.resolved_model_id);
  const findingsNormalized = claudeReceiptPresent
    && Array.isArray(claudeReviewReceipt.data?.findings)
    && claudeReviewReceipt.data.findings.length > 0
    && claudeReviewReceipt.data.findings.every((finding) => FINDING_REQUIRED_FIELDS.every((field) => field in finding));
  const adjudicationPresent = isObservedReceipt(humanAdjudicationReceipt.data) || humanAdjudicationReceipt.data?.human_adjudication_receipt_present_now === true;
  const rows = [
    ["reviewer_profile_registered", true, "Claude Code Opus max reviewer profile is registered"],
    ["claude_code_available", livePreflight.claude_code_available_now, "Claude Code is installed locally"],
    ["claude_review_receipt_present", claudeReceiptPresent, "Claude review receipt exists"],
    ["resolved_model_id_captured", resolvedModelCaptured, "Resolved model id and timestamp are captured"],
    ["findings_normalized", findingsNormalized, "Claude findings satisfy the finding schema"],
    ["human_adjudication_receipt_present", adjudicationPresent, "Human adjudication receipt exists"],
  ];
  return rows.map(([controlId, observed, description], index) => controlRow({
    schema_version: "independent-review-completion-row.v1",
    row_id: `independent.review.completion.row.${String(index + 1).padStart(2, "0")}`,
    control_id: controlId,
    description,
    observed_now: Boolean(observed),
    required_for_enterprise_trust: true,
    review_completed_now: claudeReceiptPresent && resolvedModelCaptured && findingsNormalized,
    human_adjudication_receipt_present_now: adjudicationPresent,
    evidence_ref: `evidence.platform.external_verification.independent_review.${controlId}`,
    reviewer_ref: "reviewer.platform_independent_review",
    hard_gate_ref: `gate.platform.external_verification.independent_review.${controlId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: observed ? "preserve review evidence" : `complete ${controlId}`,
  }));
}

function buildEvidenceRows({ generatedAt, packageJson, packageLock, activationLedger, enforcementLedger, workflow, sourceModule, sourceActivation, livePreflight, remoteBindingReceipt, branchProtectionReceipt, requiredCheckReceipt, actionsRunReceipt, claudeReviewReceipt, humanAdjudicationReceipt, attestationVerificationReceipt }) {
  const sources = [
    ["package_json", packageJson.path, packageJson.raw, packageJson.available],
    ["package_lock", packageLock.path, packageLock.raw, packageLock.available],
    ["verification_trust_activation_ledger", activationLedger.path, activationLedger.text, activationLedger.available],
    ["external_verification_enforcement_ledger", enforcementLedger.path, enforcementLedger.text, enforcementLedger.available],
    ["github_actions_workflow", workflow.path, workflow.text, workflow.available],
    ["source_module", sourceModule.path, sourceModule.text, sourceModule.available],
    ["source_activation_summary", "generated:platform-verification-trust-activation.summary", JSON.stringify(sourceActivation.summary), true],
    ["live_preflight", "generated:external-verification-live-preflight", JSON.stringify(livePreflight), true],
    ["github_remote_binding_receipt", remoteBindingReceipt.path, remoteBindingReceipt.raw, remoteBindingReceipt.available],
    ["github_branch_protection_receipt", branchProtectionReceipt.path, branchProtectionReceipt.raw, branchProtectionReceipt.available],
    ["github_required_check_receipt", requiredCheckReceipt.path, requiredCheckReceipt.raw, requiredCheckReceipt.available],
    ["github_actions_run_receipt", actionsRunReceipt.path, actionsRunReceipt.raw, actionsRunReceipt.available],
    ["claude_review_receipt", claudeReviewReceipt.path, claudeReviewReceipt.raw, claudeReviewReceipt.available],
    ["human_adjudication_receipt", humanAdjudicationReceipt.path, humanAdjudicationReceipt.raw, humanAdjudicationReceipt.available],
    ["attestation_verification_receipt", attestationVerificationReceipt.path, attestationVerificationReceipt.raw, attestationVerificationReceipt.available],
  ];
  return sources.map(([evidenceId, sourceUri, payload, sourceAvailable], index) => safePassRow({
    schema_version: "external-enforcement-evidence-provenance-row.v1",
    row_id: `external.enforcement.evidence.provenance.row.${String(index + 1).padStart(2, "0")}`,
    evidence_id: evidenceId,
    source_uri: sourceUri,
    source_available: Boolean(sourceAvailable),
    hash_algorithm: "sha256",
    content_hash: sourceAvailable ? sha256(payload ?? "") : null,
    captured_at: generatedAt,
    captured_by: COMMAND_NAME,
    redaction_policy: "raw_not_inlined",
    raw_payload_inlined: false,
    provenance_status: sourceAvailable ? "hash_bound" : "blocked_missing_source",
    evidence_ref: `evidence.platform.external_verification.provenance.${evidenceId}`,
    reviewer_ref: "reviewer.platform_external_evidence_provenance",
    hard_gate_ref: `gate.platform.external_verification.provenance.${evidenceId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: sourceAvailable ? "preserve hash-bound evidence" : `provide ${evidenceId} receipt`,
  }));
}

function buildValidationLedgerRows({ generatedAt, sourceActivation, reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows }) {
  const stages = [
    ["source_activation", sourceActivation.summary.platform_verification_trust_activation_status === SOURCE_READY_STATUS, "Source verification trust activation is ready"],
    ["reviewer_profile", reviewerProfileRows.every((row) => row.reviewer_id === "reviewer.claude_code.opus_max"), "Claude Code Opus max reviewer profile is registered"],
    ["review_packet", reviewPacketRows.every((row) => row.packet_status === "contract_ready"), "Review packet contract is ready"],
    ["branch_protection_preflight", branchProtectionRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Branch protection controls are observed or safely blocked"],
    ["required_status_check_preflight", requiredStatusCheckRows.every((row) => row.workflow_defined_now || row.check_id === "attestation_step"), "Required status check contracts are defined"],
    ["attestation_preflight", attestationRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Attestation controls are observed or safely blocked"],
    ["independent_review_preflight", independentReviewRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Independent review controls are observed or safely blocked"],
    ["evidence_provenance", evidenceRows.every((row) => row.raw_payload_inlined === false), "Evidence rows do not inline raw payloads"],
  ];
  let previousHash = "sha256:GENESIS";
  return stages.map(([stageId, passed, description], index) => {
    const rowCore = {
      schema_version: "external-enforcement-validation-result-ledger-row.v1",
      row_id: `external.enforcement.validation.result.ledger.row.${String(index + 1).padStart(2, "0")}`,
      stage_id: stageId,
      stage_status: passed ? "pass" : "blocked",
      description,
      validation_passed: Boolean(passed),
      generated_at: generatedAt,
      previous_hash: previousHash,
    };
    const rowHash = hashValue(rowCore);
    const chainHash = hashValue({ previous_hash: previousHash, row_hash: rowHash });
    previousHash = chainHash;
    return safePassRow({
      ...rowCore,
      row_hash: rowHash,
      chain_hash: chainHash,
      append_only_required: true,
      ledger_written_now: false,
      evidence_ref: `evidence.platform.external_verification.validation_ledger.${stageId}`,
      reviewer_ref: "reviewer.platform_validation_ledger",
      hard_gate_ref: `gate.platform.external_verification.validation_ledger.${stageId}`,
      responsible_owner: "platform_verification_owner",
      next_allowed_action: passed ? "preserve chained validation row" : `repair validation stage ${stageId}`,
    });
  });
}

function buildEnforcementCoverageRows({ reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows }) {
  const branchCoverageActive = branchProtectionRows.every((row) => row.observed_now === true);
  const requiredStatusCoverageActive = requiredStatusCheckRows.every((row) => row.required_status_check_enforced_now === true || row.required_for_enterprise_trust === false);
  const signedAttestationCoverageActive = attestationRows.every((row) => row.observed_now === true);
  const independentReviewCoverageActive = independentReviewRows.every((row) => row.observed_now === true);
  const specs = [
    ["reviewer_profile_coverage", "active", reviewerProfileRows.length, "Reviewer profile exists"],
    ["review_packet_coverage", "active", reviewPacketRows.length, "Review packet contract exists"],
    ["branch_protection_coverage", branchCoverageActive ? "active" : "blocked", branchProtectionRows.filter((row) => row.observed_now).length, branchCoverageActive ? "Branch protection controls are observed" : "Branch protection controls are not fully observed"],
    ["required_status_check_coverage", requiredStatusCoverageActive ? "active" : "blocked", requiredStatusCheckRows.filter((row) => row.required_status_check_enforced_now).length, requiredStatusCoverageActive ? "Required status check is externally enforced" : "Required status check is not externally enforced"],
    ["signed_attestation_coverage", signedAttestationCoverageActive ? "active" : "blocked", attestationRows.filter((row) => row.observed_now).length, signedAttestationCoverageActive ? "Signed attestation verification is observed" : "Signed attestation verification is not observed"],
    ["independent_review_coverage", independentReviewCoverageActive ? "active" : "blocked", independentReviewRows.filter((row) => row.observed_now).length, independentReviewCoverageActive ? "Independent review completion is observed" : "Independent review completion is not fully observed"],
    ["evidence_provenance_coverage", "active", evidenceRows.filter((row) => row.provenance_status === "hash_bound").length, "Available evidence rows are hash-bound"],
    ["validation_ledger_coverage", "active", validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length, "Validation ledger is hash chained"],
  ];
  return specs.map(([coverageId, coverageStatus, metricValue, description], index) => safePassRow({
    schema_version: "enforcement-coverage-row.v1",
    row_id: `enforcement.coverage.row.${String(index + 1).padStart(2, "0")}`,
    coverage_id: coverageId,
    coverage_status: coverageStatus,
    description,
    metric_value: metricValue,
    enterprise_blocking_gap: coverageStatus === "blocked",
    evidence_ref: `evidence.platform.external_verification.coverage.${coverageId}`,
    reviewer_ref: "reviewer.platform_enforcement_coverage",
    hard_gate_ref: `gate.platform.external_verification.coverage.${coverageId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: coverageStatus === "active" ? "preserve active coverage" : `close ${coverageId} before external enforcement completion`,
  }));
}

function buildGuardRows({ sourceActivation, reviewerProfileRows, reviewPacketRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows }) {
  const claudeAvailabilityRow = independentReviewRows.find((row) => row.control_id === "claude_code_available");
  const guards = [
    ["source_activation_ready", sourceActivation.summary.platform_verification_trust_activation_status === SOURCE_READY_STATUS, "Source activation must be ready"],
    ["reviewer_profile_registered", reviewerProfileRows.length === 1 && reviewerProfileRows[0].reviewer_id === "reviewer.claude_code.opus_max", "Claude reviewer profile must be registered"],
    ["claude_code_availability_not_overclaimed", claudeAvailabilityRow?.observed_now === true || claudeAvailabilityRow?.current_verdict === "blocked", "Claude Code availability must be observed or blocked, never assumed"],
    ["review_packet_contract_ready", reviewPacketRows.length === 6 && reviewPacketRows.every((row) => row.packet_status === "contract_ready"), "Review packet contract must be ready"],
    ["finding_schema_ready", true, "Finding normalization schema must be ready"],
    ["branch_protection_not_overclaimed", branchProtectionRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Missing branch protection controls must remain blocked"],
    ["required_status_check_not_overclaimed", requiredStatusCheckRows.every((row) => !row.required_status_check_enforced_now || row.current_verdict === "pass"), "Required status check must not be overclaimed"],
    ["attestation_not_overclaimed", attestationRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Signed attestation must not be overclaimed"],
    ["independent_review_not_overclaimed", independentReviewRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "Independent review completion must not be overclaimed"],
    ["evidence_raw_not_inlined", evidenceRows.every((row) => row.raw_payload_inlined === false), "Raw external evidence must not be inlined"],
    ["validation_ledger_chained", validationLedgerRows.every((row, index) => row.chain_hash?.startsWith("sha256:") && (index === 0 || row.previous_hash === validationLedgerRows[index - 1].chain_hash)), "Validation ledger must be chained"],
    ["coverage_gaps_visible", enforcementCoverageRows.every((row) => row.coverage_status !== "blocked" || row.enterprise_blocking_gap === true), "External blocking gaps must stay visible until closed"],
    ["no_enterprise_or_production_claim", true, "Enterprise, production, runtime, write, connector write, and final authority remain false"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "external-verification-guard-row.v1",
    row_id: `external.verification.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.external_verification.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_external_verification_guard",
    hard_gate_ref: `gate.platform.external_verification.guard.${guardId}`,
    responsible_owner: "platform_verification_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId}`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ livePreflight, reviewerProfileRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, guardRows }) {
  const branchProtectionConfigured = branchProtectionRows.find((row) => row.control_id === "branch_protection_configured")?.observed_now === true;
  const branchRulesQueryAvailable = branchProtectionRows.find((row) => row.control_id === "branch_rules_query_available")?.observed_now === true;
  const requiredStatusCheckEnforced = requiredStatusCheckRows.some((row) => row.required_status_check_enforced_now === true);
  const actionsRunSuccess = livePreflight.actions_run_success_now === true;
  const requiredPrReviewEnforced = branchProtectionRows.find((row) => row.control_id === "required_pr_review_enforced")?.observed_now === true;
  const forcePushDisabled = branchProtectionRows.find((row) => row.control_id === "force_push_disabled")?.observed_now === true;
  const signedAttestationGenerated = attestationRows.find((row) => row.control_id === "signed_attestation_generated")?.observed_now === true;
  const attestationVerificationPassed = attestationRows.find((row) => row.control_id === "attestation_verification_passed")?.observed_now === true;
  const independentReviewCompleted = independentReviewRows.every((row) => row.observed_now === true) && independentReviewRows.some((row) => row.control_id === "human_adjudication_receipt_present");
  const humanAdjudicationReceiptPresent = independentReviewRows.find((row) => row.control_id === "human_adjudication_receipt_present")?.observed_now === true;
  const externalControlsComplete = branchProtectionConfigured
    && branchRulesQueryAvailable
    && requiredStatusCheckEnforced
    && actionsRunSuccess
    && requiredPrReviewEnforced
    && forcePushDisabled
    && signedAttestationGenerated
    && attestationVerificationPassed
    && independentReviewCompleted
    && humanAdjudicationReceiptPresent;
  const unsafeFlags = [
    reviewerProfileRows[0]?.final_authority_allowed,
    externalControlsComplete && guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "external-verification-boundary.v1",
    external_enforcement_preflight_ready: true,
    claude_code_available_now: livePreflight.claude_code_available_now,
    claude_code_version: livePreflight.claude_code_version,
    github_remote_configured_now: livePreflight.github_remote_configured_now,
    gh_cli_available_now: livePreflight.gh_cli_available_now,
    gh_auth_available_now: livePreflight.gh_auth_available_now,
    branch_protection_configured_now: branchProtectionConfigured,
    branch_rules_query_available_now: branchRulesQueryAvailable,
    branch_rules_count: livePreflight.branch_rules_count ?? null,
    required_status_check_enforced_now: requiredStatusCheckEnforced,
    actions_run_success_now: actionsRunSuccess,
    required_pr_review_enforced_now: requiredPrReviewEnforced,
    force_push_disabled_now: forcePushDisabled,
    signed_attestation_generated_now: signedAttestationGenerated,
    attestation_verification_passed_now: attestationVerificationPassed,
    independent_review_completed_now: independentReviewCompleted,
    human_adjudication_receipt_present_now: humanAdjudicationReceiptPresent,
    enterprise_trust_claim_allowed_now: false,
    production_ready_claimed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_allowed_now: false,
    final_authority_allowed_now: false,
    p3680_external_controls_complete: externalControlsComplete,
    p3681_ready_as_next_goal: externalControlsComplete,
    blocked_control_count: [
      branchProtectionConfigured,
      branchRulesQueryAvailable,
      requiredStatusCheckEnforced,
      actionsRunSuccess,
      requiredPrReviewEnforced,
      forcePushDisabled,
      signedAttestationGenerated,
      attestationVerificationPassed,
      independentReviewCompleted,
      humanAdjudicationReceiptPresent,
    ].filter((value) => !value).length,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildAnchor({ packageJson, packageLock, workflow, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows }) {
  return {
    schema_version: "external-verification-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    package_lock_present: packageLock.available,
    workflow_file_present: workflow.available,
    source_activation_status: sourceActivation.summary.platform_verification_trust_activation_status,
    component_count: componentRows.length,
    reviewer_profile_count: reviewerProfileRows.length,
    review_packet_count: reviewPacketRows.length,
    finding_schema_count: findingSchemaRows.length,
    branch_protection_count: branchProtectionRows.length,
    required_status_check_count: requiredStatusCheckRows.length,
    signed_attestation_count: attestationRows.length,
    independent_review_count: independentReviewRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    enforcement_coverage_count: enforcementCoverageRows.length,
  };
}

function buildManifest({ generatedAt, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, boundary }) {
  return {
    schema_version: "external-verification-enforcement-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_activation_status: sourceActivation.summary.platform_verification_trust_activation_status,
    component_count: componentRows.length,
    reviewer_profile_count: reviewerProfileRows.length,
    review_packet_count: reviewPacketRows.length,
    finding_schema_count: findingSchemaRows.length,
    branch_protection_count: branchProtectionRows.length,
    required_status_check_count: requiredStatusCheckRows.length,
    signed_attestation_count: attestationRows.length,
    independent_review_count: independentReviewRows.length,
    evidence_provenance_count: evidenceRows.length,
    validation_ledger_count: validationLedgerRows.length,
    enforcement_coverage_count: enforcementCoverageRows.length,
    p3680_external_controls_complete: boundary.p3680_external_controls_complete,
    enterprise_trust_claim_allowed_now: false,
    next_allowed_action: boundary.p3680_external_controls_complete ? "request human owner enterprise-trust adjudication" : "configure blocked external controls and rerun preflight",
  };
}

function buildValidationItems({ packageJson, packageLock, activationLedger, enforcementLedger, workflow, sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:external-verification-enforcement"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:external-verification-enforcement -- --check"),
    validationItem("package.lock", "package", packageLock.available, "package-lock.json must be present"),
    validationItem("source.activation", "source_ready", sourceActivation.summary.platform_verification_trust_activation_status === SOURCE_READY_STATUS, "source verification trust activation must be ready"),
    validationItem("ledger.activation", "ledger", activationLedger.available && activationLedger.text.includes("P3361-P3520"), "verification trust activation ledger must be present"),
    validationItem("ledger.enforcement", "ledger", enforcementLedger.available && enforcementLedger.text.includes("P3521-P3680") && enforcementLedger.text.includes("reviewer.claude_code.opus_max"), "external verification enforcement ledger must be present"),
    validationItem("workflow.command", "workflow", workflow.available && workflow.text.includes(COMMAND_NAME), "workflow must include external enforcement command"),
    validationItem("workflow.attest", "workflow", workflow.available && workflow.text.includes("actions/attest@v4") && workflow.text.includes("id-token: write") && workflow.text.includes("attestations: write"), "workflow must declare attestation permissions and action"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all component rows must exist"),
    validationItem("reviewer.profile", "reviewer", reviewerProfileRows.length === 1 && reviewerProfileRows[0].reviewer_id === "reviewer.claude_code.opus_max" && reviewerProfileRows[0].write_permission_allowed === false && reviewerProfileRows[0].final_authority_allowed === false, "Claude Code Opus max reviewer profile must be registered without write or final authority"),
    validationItem("review_packet.count", "review_packet", reviewPacketRows.length === 6 && reviewPacketRows.every((row) => row.primary_conclusion_hidden_by_default === true), "review packet rows must exist and default to blind independent mode"),
    validationItem("finding_schema.count", "finding_schema", findingSchemaRows.length === FINDING_REQUIRED_FIELDS.length && findingSchemaRows.every((row) => row.field_required === true), "finding schema rows must require all fields"),
    validationItem("branch.not_overclaimed", "branch_protection", branchProtectionRows.length === 10 && branchProtectionRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "branch protection/ruleset rows must be observed or safely blocked"),
    validationItem("checks.workflow_defined", "required_status_checks", requiredStatusCheckRows.length === 7 && requiredStatusCheckRows.every((row) => row.workflow_defined_now || row.check_id === "attestation_step"), "required check rows must be workflow-defined where applicable"),
    validationItem("attestation.not_overclaimed", "attestation", attestationRows.length === 5 && attestationRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "attestation rows must be observed or safely blocked"),
    validationItem("review.not_overclaimed", "independent_review", independentReviewRows.length === 6 && independentReviewRows.every((row) => row.observed_now || row.current_verdict === "blocked"), "independent review rows must be observed or safely blocked"),
    validationItem("evidence.count", "evidence", evidenceRows.length === 15 && evidenceRows.every((row) => row.raw_payload_inlined === false), "evidence rows must exist without raw payloads"),
    validationItem("ledger.hash_chain", "validation_ledger", validationLedgerRows.length === 8 && validationLedgerRows.every((row, index) => row.chain_hash?.startsWith("sha256:") && (index === 0 || row.previous_hash === validationLedgerRows[index - 1].chain_hash)), "validation ledger must be hash chained"),
    validationItem("coverage.visible_gaps", "coverage", enforcementCoverageRows.every((row) => row.coverage_status !== "blocked" || row.enterprise_blocking_gap === true), "external enforcement gaps must remain visible until closed"),
    validationItem("guards.safe", "guards", guardRows.every((row) => row.guard_status === "ready"), "all safety guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0 && boundary.enterprise_trust_claim_allowed_now === false && boundary.production_ready_claimed_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "unsafe claims must stay false"),
  ];
}

function buildSummary({ sourceActivation, componentRows, reviewerProfileRows, reviewPacketRows, findingSchemaRows, branchProtectionRows, requiredStatusCheckRows, attestationRows, independentReviewRows, evidenceRows, validationLedgerRows, enforcementCoverageRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-external-verification-enforcement-summary.v1",
    platform_external_verification_enforcement_status: validation.valid && boundary.p3680_external_controls_complete ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_activation_status: sourceActivation.summary.platform_verification_trust_activation_status,
    component_count: componentRows.length,
    reviewer_profile_count: reviewerProfileRows.length,
    review_packet_count: reviewPacketRows.length,
    finding_schema_count: findingSchemaRows.length,
    branch_protection_count: branchProtectionRows.length,
    observed_branch_protection_count: branchProtectionRows.filter((row) => row.observed_now).length,
    required_status_check_count: requiredStatusCheckRows.length,
    workflow_defined_required_check_count: requiredStatusCheckRows.filter((row) => row.workflow_defined_now).length,
    signed_attestation_count: attestationRows.length,
    observed_signed_attestation_count: attestationRows.filter((row) => row.observed_now).length,
    attestation_support_status: attestationRows.find((row) => row.attestation_support_status)?.attestation_support_status ?? null,
    attestation_block_reason: attestationRows.find((row) => row.attestation_block_reason)?.attestation_block_reason ?? null,
    attestation_policy_ref: attestationRows.find((row) => row.attestation_policy_ref)?.attestation_policy_ref ?? null,
    independent_review_count: independentReviewRows.length,
    observed_independent_review_count: independentReviewRows.filter((row) => row.observed_now).length,
    evidence_provenance_count: evidenceRows.length,
    hash_bound_evidence_count: evidenceRows.filter((row) => row.provenance_status === "hash_bound").length,
    validation_ledger_count: validationLedgerRows.length,
    hash_chained_validation_ledger_count: validationLedgerRows.filter((row) => row.chain_hash?.startsWith("sha256:")).length,
    enforcement_coverage_count: enforcementCoverageRows.length,
    enterprise_blocking_gap_count: enforcementCoverageRows.filter((row) => row.enterprise_blocking_gap).length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    claude_code_available_now: boundary.claude_code_available_now,
    claude_code_version: boundary.claude_code_version,
    github_remote_configured_now: boundary.github_remote_configured_now,
    gh_cli_available_now: boundary.gh_cli_available_now,
    gh_auth_available_now: boundary.gh_auth_available_now,
    branch_protection_configured_now: boundary.branch_protection_configured_now,
    branch_rules_query_available_now: boundary.branch_rules_query_available_now,
    branch_rules_count: boundary.branch_rules_count,
    required_status_check_enforced_now: boundary.required_status_check_enforced_now,
    actions_run_success_now: boundary.actions_run_success_now,
    required_pr_review_enforced_now: boundary.required_pr_review_enforced_now,
    force_push_disabled_now: boundary.force_push_disabled_now,
    signed_attestation_generated_now: boundary.signed_attestation_generated_now,
    attestation_verification_passed_now: boundary.attestation_verification_passed_now,
    independent_review_completed_now: boundary.independent_review_completed_now,
    human_adjudication_receipt_present_now: boundary.human_adjudication_receipt_present_now,
    enterprise_trust_claim_allowed_now: boundary.enterprise_trust_claim_allowed_now,
    production_ready_claimed_now: boundary.production_ready_claimed_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    connector_write_allowed_now: boundary.connector_write_allowed_now,
    final_authority_allowed_now: boundary.final_authority_allowed_now,
    p3680_external_controls_complete: boundary.p3680_external_controls_complete,
    p3681_ready_as_next_goal: boundary.p3681_ready_as_next_goal,
    blocked_control_count: boundary.blocked_control_count,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function controlRow(fields) {
  const observed = Boolean(fields.observed_now);
  return {
    ...fields,
    control_status: observed ? "observed" : "blocked_missing_external_evidence",
    block_reason: observed ? null : `missing_external_evidence.${fields.control_id ?? fields.check_id}`,
    current_verdict: observed ? "pass" : "blocked",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function safePassRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function mergeLivePreflightWithReceipts(livePreflight, { remoteBindingReceipt, branchProtectionReceipt, requiredCheckReceipt, actionsRunReceipt }) {
  const remote = remoteBindingReceipt.data ?? {};
  const branch = branchProtectionReceipt.data ?? {};
  const required = requiredCheckReceipt.data ?? {};
  const actions = actionsRunReceipt.data ?? {};
  const githubRemoteObserved = isObservedReceipt(remote);
  const branchObserved = isObservedReceipt(branch);
  const requiredObserved = isObservedReceipt(required);
  const actionsObserved = isObservedReceipt(actions);
  return {
    ...livePreflight,
    github_remote_configured_now: livePreflight.github_remote_configured_now || (githubRemoteObserved && remote.github_remote_configured_now === true),
    github_owner: livePreflight.github_owner ?? (githubRemoteObserved ? parseRepositoryFullName(remote.repository_full_name)?.owner : null) ?? null,
    github_repo: livePreflight.github_repo ?? (githubRemoteObserved ? parseRepositoryFullName(remote.repository_full_name)?.repo : null) ?? null,
    gh_cli_available_now: livePreflight.gh_cli_available_now || (githubRemoteObserved && remote.gh_cli_available_now === true),
    gh_auth_available_now: livePreflight.gh_auth_available_now || (githubRemoteObserved && remote.gh_auth_available_now === true),
    branch_protection_query_available_now: livePreflight.branch_protection_query_available_now || (branchObserved && branch.branch_protection_query_available_now === true),
    branch_protection_configured_now: livePreflight.branch_protection_configured_now || (branchObserved && branch.branch_protection_configured_now === true),
    branch_rules_query_available_now: livePreflight.branch_rules_query_available_now || (branchObserved && branch.branch_rules_query_available_now === true),
    branch_rules_observed_now: livePreflight.branch_rules_observed_now || (branchObserved && branch.branch_rules_observed_now === true),
    branch_rules_count: Number.isInteger(livePreflight.branch_rules_count) ? livePreflight.branch_rules_count : (branchObserved ? branch.branch_rules_count ?? null : null),
    required_status_check_enforced_now: livePreflight.required_status_check_enforced_now || (requiredObserved && required.required_status_check_enforced_now === true),
    required_pr_review_enforced_now: livePreflight.required_pr_review_enforced_now || (branchObserved && branch.required_pr_review_enforced_now === true),
    stale_review_dismissal_enforced_now: livePreflight.stale_review_dismissal_enforced_now || (branchObserved && branch.stale_review_dismissal_enforced_now === true),
    force_push_disabled_now: livePreflight.force_push_disabled_now || (branchObserved && branch.force_push_disabled_now === true),
    actions_run_success_now: actionsObserved && actions.actions_run_success_now === true,
    actions_run_id: actionsObserved ? actions.actions_run_id ?? null : null,
    command_observations: livePreflight.command_observations ?? [],
  };
}

function isObservedReceipt(data) {
  return data?.receipt_status === "observed";
}

function parseRepositoryFullName(value) {
  const match = String(value ?? "").match(/^([^/]+)\/([^/]+)$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

function firstGithubRemoteUrl(remoteUrls) {
  return remoteUrls.find((remoteUrl) => parseGithubRemote(remoteUrl)) ?? null;
}

async function runShellCommand(commandId, command, cwd) {
  try {
    const result = await execFileAsync("/bin/zsh", ["-lc", command], { cwd, timeout: 5000, maxBuffer: 1024 * 1024 });
    return {
      command_id: commandId,
      command,
      executed: true,
      exit_code: 0,
      stdout: redactOutput(result.stdout),
      stderr: redactOutput(result.stderr),
    };
  } catch (error) {
    return {
      command_id: commandId,
      command,
      executed: true,
      exit_code: Number.isInteger(error.code) ? error.code : 1,
      stdout: redactOutput(error.stdout ?? ""),
      stderr: redactOutput(error.stderr ?? error.message ?? ""),
    };
  }
}

function skippedCommand(commandId, command, reason) {
  return {
    command_id: commandId,
    command,
    executed: false,
    exit_code: null,
    stdout: "",
    stderr: "",
    skip_reason: reason,
  };
}

function parseGithubRemote(remoteUrl) {
  const trimmed = String(remoteUrl ?? "").trim();
  let match = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  match = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  return null;
}

function quotePathPart(value) {
  return encodeURIComponent(String(value));
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function redactOutput(value) {
  return String(value ?? "")
    .replace(/ghp_[A-Za-z0-9_]+/g, "ghp_[REDACTED]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_[REDACTED]")
    .slice(0, 6000);
}

function renderMarkdown(result) {
  return [
    "# Platform External Verification Enforcement",
    "",
    `Status: ${result.summary.platform_external_verification_enforcement_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source activation status: ${result.summary.source_activation_status}`,
    `Claude Code available now: ${result.summary.claude_code_available_now}`,
    `Claude Code version: ${result.summary.claude_code_version ?? "not observed"}`,
    `GitHub remote configured now: ${result.summary.github_remote_configured_now}`,
    `GitHub CLI available now: ${result.summary.gh_cli_available_now}`,
    `GitHub auth available now: ${result.summary.gh_auth_available_now}`,
    `Branch protection configured now: ${result.summary.branch_protection_configured_now}`,
    `Branch rules query available now: ${result.summary.branch_rules_query_available_now}`,
    `Branch rules count: ${result.summary.branch_rules_count}`,
    `Required status check enforced now: ${result.summary.required_status_check_enforced_now}`,
    `Actions run success now: ${result.summary.actions_run_success_now}`,
    `Required PR review enforced now: ${result.summary.required_pr_review_enforced_now}`,
    `Force push disabled now: ${result.summary.force_push_disabled_now}`,
    `Signed attestation generated now: ${result.summary.signed_attestation_generated_now}`,
    `Attestation verification passed now: ${result.summary.attestation_verification_passed_now}`,
    `Attestation support status: ${result.summary.attestation_support_status}`,
    `Attestation block reason: ${result.summary.attestation_block_reason}`,
    `Independent review completed now: ${result.summary.independent_review_completed_now}`,
    `Human adjudication receipt present now: ${result.summary.human_adjudication_receipt_present_now}`,
    `Enterprise trust claim allowed now: ${result.summary.enterprise_trust_claim_allowed_now}`,
    `P3680 external controls complete: ${result.summary.p3680_external_controls_complete}`,
    `Blocked control count: ${result.summary.blocked_control_count}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Boundary",
    "",
    "This tranche opens external enforcement preflight. Missing GitHub branch protection, signed attestation verification, Claude review receipts, and human adjudication remain BLOCK rather than being treated as PASS.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_EXTERNAL_VERIFICATION_ENFORCEMENT_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    package_lock_path: options.packageLockPath ?? defaults.packageLockPath,
    verification_trust_activation_ledger_path: options.verificationTrustActivationLedgerPath ?? defaults.verificationTrustActivationLedgerPath,
    external_verification_enforcement_ledger_path: options.externalVerificationEnforcementLedgerPath ?? defaults.externalVerificationEnforcementLedgerPath,
    workflow_path: options.workflowPath ?? defaults.workflowPath,
    source_module_path: options.sourceModulePath ?? defaults.sourceModulePath,
    remote_binding_receipt_path: options.remoteBindingReceiptPath ?? defaults.remoteBindingReceiptPath,
    branch_protection_receipt_path: options.branchProtectionReceiptPath ?? defaults.branchProtectionReceiptPath,
    required_check_receipt_path: options.requiredCheckReceiptPath ?? defaults.requiredCheckReceiptPath,
    actions_run_receipt_path: options.actionsRunReceiptPath ?? defaults.actionsRunReceiptPath,
    claude_review_receipt_path: options.claudeReviewReceiptPath ?? defaults.claudeReviewReceiptPath,
    human_adjudication_receipt_path: options.humanAdjudicationReceiptPath ?? defaults.humanAdjudicationReceiptPath,
    attestation_verification_receipt_path: options.attestationVerificationReceiptPath ?? options.attestationVerifyReceiptPath ?? defaults.attestationVerificationReceiptPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const raw = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, raw, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { available: false, path: sourcePath, raw: "", error: error.message };
  }
}

async function readOptionalJsonSource(sourcePath) {
  try {
    const raw = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, raw, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { available: false, path: sourcePath, raw: "", data: null, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text, content_hash: sha256(text) };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function hashValue(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    packageLockPath: undefined,
    workflowPath: undefined,
    githubRepoUrl: undefined,
    repositoryFullName: undefined,
    branch: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--package-lock") {
      args.packageLockPath = argv[index + 1];
      index += 1;
    } else if (arg === "--workflow") {
      args.workflowPath = argv[index + 1];
      index += 1;
    } else if (arg === "--github-repo-url") {
      args.githubRepoUrl = argv[index + 1];
      index += 1;
    } else if (arg === "--repo") {
      args.repositoryFullName = argv[index + 1];
      index += 1;
    } else if (arg === "--branch") {
      args.branch = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-external-verification-enforcement.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --workflow <path>               GitHub Actions workflow path.
  --github-repo-url <url>         GitHub repository URL.
  --repo <owner/repo>             GitHub repository full name.
  --branch <branch>               Branch to inspect.
  --help                          Show this help.
`);
}
