import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEFAULT_PLATFORM_LIVE_EXTERNAL_VERIFICATION_EVIDENCE_ROOT = "artifacts/platform-external-verification-enforcement";
export const DEFAULT_PLATFORM_LIVE_EXTERNAL_VERIFICATION_RECEIPTS = {
  remoteBindingReceiptPath: "artifacts/platform-external-verification-enforcement/github/remote-binding-receipt.json",
  branchProtectionReceiptPath: "artifacts/platform-external-verification-enforcement/github/branch-protection-receipt.json",
  requiredCheckReceiptPath: "artifacts/platform-external-verification-enforcement/github/required-check-receipt.json",
  actionsRunReceiptPath: "artifacts/platform-external-verification-enforcement/github/actions-run-receipt.json",
  attestationVerifyReceiptPath: "artifacts/platform-external-verification-enforcement/attestation/attestation-verify-receipt.json",
  claudeReviewReceiptPath: "artifacts/platform-external-verification-enforcement/review/claude-review-receipt.json",
  humanAdjudicationReceiptPath: "artifacts/platform-external-verification-enforcement/review/human-adjudication-receipt.json",
};

const COMMAND_NAME = "platform:live-external-verification-evidence";
const PROGRAM_RANGE = "P3681-P3840";
const REQUIRED_WORKFLOW_NAME = "Hermes Verification Trust";
const REQUIRED_CHECK_NAME = "Hermes verification trust";
const REVIEWER_ID = "reviewer.claude_code.opus_max";

export async function runPlatformLiveExternalVerificationEvidence(options = {}) {
  const result = await buildPlatformLiveExternalVerificationEvidence(options);
  if (options.write !== false) await writePlatformLiveExternalVerificationEvidence(result);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform live external verification evidence failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformLiveExternalVerificationEvidence(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const cwd = options.cwd ?? process.cwd();
  const receiptPaths = normalizeReceiptPaths(options);
  const existingAttestationReceipt = await readOptionalJson(receiptPaths.attestation_verify_receipt_path);
  const existingClaudeReviewReceipt = await readOptionalJson(receiptPaths.claude_review_receipt_path);
  const existingHumanAdjudicationReceipt = await readOptionalJson(receiptPaths.human_adjudication_receipt_path);
  const humanAdjudicationInput = options.humanAdjudicationInputPath
    ? await readOptionalJson(options.humanAdjudicationInputPath)
    : { available: false, path: null, raw: "", data: null };

  const gitRemote = await runShellCommand("git_remote_origin", "git config --get remote.origin.url", cwd);
  const gitHubRemote = await runShellCommand("git_remote_github", "git config --get remote.github.url", cwd);
  const gitBranch = await runShellCommand("git_branch", "git branch --show-current", cwd);
  const gitHead = await runShellCommand("git_head_sha", "git rev-parse HEAD", cwd);
  const ghPath = await runShellCommand("gh_path", "command -v gh", cwd);
  const ghAuth = ghPath.exit_code === 0
    ? await runShellCommand("gh_auth_status", "gh auth status", cwd)
    : skippedCommand("gh_auth_status", "gh auth status", "gh_not_available");
  const selectedRemoteUrl = options.githubRepoUrl ?? firstGithubRemoteUrl([gitHubRemote.stdout.trim(), gitRemote.stdout.trim()]);
  const parsedRemote = parseGithubRemote(selectedRemoteUrl);
  const branchName = options.branch ?? (gitBranch.stdout.trim() || "main");
  const repositoryFullName = options.repositoryFullName ?? (parsedRemote ? `${parsedRemote.owner}/${parsedRemote.repo}` : null);
  const repoFlag = repositoryFullName ? ` -R ${quoteShell(repositoryFullName)}` : "";

  const repoView = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName
    ? await runShellCommand("gh_repo_view", `gh repo view${repoFlag} --json nameWithOwner,defaultBranchRef,url`, cwd)
    : skippedCommand("gh_repo_view", "gh repo view --json nameWithOwner,defaultBranchRef,url", missingGitHubReason({ ghPath, ghAuth, repositoryFullName }));
  const protection = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName
    ? await runShellCommand("gh_branch_protection", `gh api repos/${repositoryFullName}/branches/${quotePathPart(branchName)}/protection`, cwd)
    : skippedCommand("gh_branch_protection", "gh api repos/{owner}/{repo}/branches/{branch}/protection", missingGitHubReason({ ghPath, ghAuth, repositoryFullName }));
  const actionsRun = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName
    ? await runShellCommand("gh_actions_run", `gh run list${repoFlag} --workflow ${quoteShell(REQUIRED_WORKFLOW_NAME)} --branch ${quoteShell(branchName)} --limit 1 --json databaseId,headSha,status,conclusion,workflowName,displayTitle,url,createdAt,updatedAt`, cwd)
    : skippedCommand("gh_actions_run", "gh run list --workflow Hermes Verification Trust", missingGitHubReason({ ghPath, ghAuth, repositoryFullName }));
  const attestationVerify = ghPath.exit_code === 0 && ghAuth.exit_code === 0 && repositoryFullName && options.attestationSubject
    ? await runShellCommand("gh_attestation_verify", `gh attestation verify ${quoteShell(options.attestationSubject)} --repo ${quoteShell(repositoryFullName)}`, cwd)
    : skippedCommand("gh_attestation_verify", "gh attestation verify <subject> --repo {owner}/{repo}", options.attestationSubject ? missingGitHubReason({ ghPath, ghAuth, repositoryFullName }) : "attestation_subject_not_provided");

  const protectionJson = parseJsonMaybe(protection.stdout);
  const repoViewJson = parseJsonMaybe(repoView.stdout);
  const actionsRunJson = parseJsonMaybe(actionsRun.stdout);
  const latestRun = Array.isArray(actionsRunJson) ? actionsRunJson[0] ?? null : null;
  const requiredContexts = protectionJson?.required_status_checks?.contexts ?? [];
  const prReviews = protectionJson?.required_pull_request_reviews ?? {};

  const commandObservations = [gitRemote, gitHubRemote, gitBranch, gitHead, ghPath, ghAuth, repoView, protection, actionsRun, attestationVerify];
  const remoteBindingReceipt = buildRemoteBindingReceipt({
    generatedAt,
    cwd,
    receiptPath: receiptPaths.remote_binding_receipt_path,
    gitRemote,
    gitHubRemote,
    selectedRemoteUrl,
    gitBranch,
    gitHead,
    ghPath,
    ghAuth,
    repoViewJson,
    repositoryFullName,
    parsedRemote,
    commandObservations: [gitRemote, gitHubRemote, gitBranch, gitHead, ghPath, ghAuth, repoView],
  });
  const branchProtectionReceipt = buildBranchProtectionReceipt({
    generatedAt,
    receiptPath: receiptPaths.branch_protection_receipt_path,
    repositoryFullName,
    branchName,
    protection,
    protectionJson,
  });
  const requiredCheckReceipt = buildRequiredCheckReceipt({
    generatedAt,
    receiptPath: receiptPaths.required_check_receipt_path,
    repositoryFullName,
    branchName,
    requiredContexts,
    latestRun,
    protectionJson,
  });
  const actionsRunReceipt = buildActionsRunReceipt({
    generatedAt,
    receiptPath: receiptPaths.actions_run_receipt_path,
    repositoryFullName,
    branchName,
    gitHead,
    actionsRun,
    latestRun,
  });
  const attestationVerifyReceipt = buildAttestationVerifyReceipt({
    generatedAt,
    receiptPath: receiptPaths.attestation_verify_receipt_path,
    repositoryFullName,
    attestationSubject: options.attestationSubject ?? null,
    attestationVerify,
    existingReceipt: existingAttestationReceipt,
  });
  const claudeReviewReceipt = buildClaudeReviewReceipt({
    generatedAt,
    receiptPath: receiptPaths.claude_review_receipt_path,
    existingReceipt: existingClaudeReviewReceipt,
  });
  const humanAdjudicationReceipt = buildHumanAdjudicationReceipt({
    generatedAt,
    receiptPath: receiptPaths.human_adjudication_receipt_path,
    existingReceipt: existingHumanAdjudicationReceipt,
    inputReceipt: humanAdjudicationInput,
    claudeReviewReceipt: existingClaudeReviewReceipt,
  });

  const receipts = {
    remote_binding_receipt: remoteBindingReceipt,
    branch_protection_receipt: branchProtectionReceipt,
    required_check_receipt: requiredCheckReceipt,
    actions_run_receipt: actionsRunReceipt,
    attestation_verify_receipt: attestationVerifyReceipt,
    claude_review_receipt: claudeReviewReceipt,
    human_adjudication_receipt: humanAdjudicationReceipt,
  };
  const validationItems = buildValidationItems({ receiptPaths, receipts });
  const validation = summarizeValidation(validationItems);
  return {
    schema_version: "platform-live-external-verification-evidence.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    command_name: COMMAND_NAME,
    cwd,
    receipt_paths: receiptPaths,
    receipts,
    command_observations: commandObservations,
    validation_items: validationItems,
    validation,
    summary: buildSummary({ receipts, validation }),
  };
}

export async function writePlatformLiveExternalVerificationEvidence(result) {
  for (const receipt of Object.values(result.receipts)) {
    await mkdir(path.dirname(receipt.receipt_path), { recursive: true });
    await writeJson(receipt.receipt_path, receipt);
  }
  const latestDir = path.join(DEFAULT_PLATFORM_LIVE_EXTERNAL_VERIFICATION_EVIDENCE_ROOT, "live-evidence/latest");
  await mkdir(latestDir, { recursive: true });
  await writeJson(path.join(latestDir, "platform-live-external-verification-evidence.json"), serializableResult(result));
  await writeFile(path.join(latestDir, "summary.md"), renderMarkdown(result), "utf8");
}

export async function runPlatformLiveExternalVerificationEvidenceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformLiveExternalVerificationEvidence(args);
    console.log(`Platform live external verification evidence ${args.check ? "validated" : "written"}`);
    console.log(`GitHub remote configured: ${result.summary.github_remote_configured_now}`);
    console.log(`GitHub auth available: ${result.summary.gh_auth_available_now}`);
    console.log(`Branch protection configured: ${result.summary.branch_protection_configured_now}`);
    console.log(`Required check enforced: ${result.summary.required_status_check_enforced_now}`);
    console.log(`Actions run success: ${result.summary.actions_run_success_now}`);
    console.log(`Attestation verified: ${result.summary.attestation_verification_passed_now}`);
    console.log(`Claude review completed: ${result.summary.claude_review_completed_now}`);
    console.log(`Human adjudication present: ${result.summary.human_adjudication_receipt_present_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRemoteBindingReceipt({ generatedAt, cwd, receiptPath, gitRemote, gitHubRemote, selectedRemoteUrl, gitBranch, gitHead, ghPath, ghAuth, repoViewJson, repositoryFullName, parsedRemote, commandObservations }) {
  const githubRemoteConfigured = Boolean(parsedRemote);
  const ghAvailable = ghPath.exit_code === 0;
  const ghAuthAvailable = ghAuth.exit_code === 0;
  const observed = githubRemoteConfigured && ghAvailable && ghAuthAvailable && Boolean(repositoryFullName);
  return receipt({
    schema_version: "github-remote-binding-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `github.remote_binding.${dateStamp(generatedAt)}`,
    receipt_status: observed ? "observed" : "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    cwd,
    repository_full_name: repositoryFullName,
    repository_url: repoViewJson?.url ?? (parsedRemote ? `https://github.com/${parsedRemote.owner}/${parsedRemote.repo}` : null),
    remote_url: selectedRemoteUrl ?? null,
    origin_remote_url: gitRemote.stdout.trim(),
    github_remote_url: gitHubRemote.stdout.trim(),
    branch_name: gitBranch.stdout.trim() || null,
    commit_sha: gitHead.stdout.trim() || null,
    github_remote_configured_now: githubRemoteConfigured,
    gh_cli_available_now: ghAvailable,
    gh_auth_available_now: ghAuthAvailable,
    raw_payload_inlined: false,
    command_observations: commandObservations,
    next_allowed_action: observed ? "preserve GitHub remote/auth binding evidence" : "run gh auth login and set origin to https://github.com/<owner>/<repo>.git",
  });
}

function buildBranchProtectionReceipt({ generatedAt, receiptPath, repositoryFullName, branchName, protection, protectionJson }) {
  const requiredContexts = protectionJson?.required_status_checks?.contexts ?? [];
  const prReviews = protectionJson?.required_pull_request_reviews ?? {};
  const observed = protection.exit_code === 0 && Boolean(protectionJson);
  return receipt({
    schema_version: "github-branch-protection-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `github.branch_protection.${dateStamp(generatedAt)}`,
    receipt_status: observed ? "observed" : "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    repository_full_name: repositoryFullName,
    branch_name: branchName,
    branch_protection_query_available_now: protection.exit_code === 0,
    branch_protection_configured_now: observed,
    required_status_check_contexts: requiredContexts,
    required_pr_review_enforced_now: Number(prReviews.required_approving_review_count ?? 0) >= 1,
    stale_review_dismissal_enforced_now: prReviews.dismiss_stale_reviews === true,
    force_push_disabled_now: protectionJson?.allow_force_pushes?.enabled === false,
    protection_response_hash: observed ? sha256(protection.stdout) : null,
    raw_payload_inlined: false,
    command_observations: [protection],
    next_allowed_action: observed ? "preserve branch protection evidence" : "configure branch protection/ruleset and rerun evidence capture",
  });
}

function buildRequiredCheckReceipt({ generatedAt, receiptPath, repositoryFullName, branchName, requiredContexts, latestRun, protectionJson }) {
  const requiredStatusCheckEnforced = requiredContexts.includes(REQUIRED_CHECK_NAME);
  return receipt({
    schema_version: "github-required-check-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `github.required_check.${dateStamp(generatedAt)}`,
    receipt_status: requiredStatusCheckEnforced ? "observed" : "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    repository_full_name: repositoryFullName,
    branch_name: branchName,
    required_check_name: REQUIRED_CHECK_NAME,
    required_status_check_enforced_now: requiredStatusCheckEnforced,
    required_status_check_contexts: requiredContexts,
    protection_hash: protectionJson ? sha256(JSON.stringify(protectionJson)) : null,
    latest_actions_run_id: latestRun?.databaseId ?? null,
    latest_actions_run_status: latestRun?.status ?? null,
    latest_actions_run_conclusion: latestRun?.conclusion ?? null,
    raw_payload_inlined: false,
    next_allowed_action: requiredStatusCheckEnforced ? "preserve required check evidence" : "make Hermes verification trust a required status check",
  });
}

function buildActionsRunReceipt({ generatedAt, receiptPath, repositoryFullName, branchName, gitHead, actionsRun, latestRun }) {
  const runSuccess = latestRun?.conclusion === "success";
  return receipt({
    schema_version: "github-actions-run-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `github.actions_run.${dateStamp(generatedAt)}`,
    receipt_status: runSuccess ? "observed" : "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    repository_full_name: repositoryFullName,
    branch_name: branchName,
    workflow_name: REQUIRED_WORKFLOW_NAME,
    commit_sha: latestRun?.headSha ?? gitHead.stdout.trim() ?? null,
    actions_run_id: latestRun?.databaseId ?? null,
    actions_run_url: latestRun?.url ?? null,
    actions_run_status: latestRun?.status ?? null,
    actions_run_conclusion: latestRun?.conclusion ?? null,
    actions_run_success_now: runSuccess,
    raw_payload_inlined: false,
    command_observations: [actionsRun],
    next_allowed_action: runSuccess ? "preserve GitHub Actions run evidence" : "push branch and wait for Hermes Verification Trust workflow success",
  });
}

function buildAttestationVerifyReceipt({ generatedAt, receiptPath, repositoryFullName, attestationSubject, attestationVerify, existingReceipt }) {
  if (isObservedReceipt(existingReceipt.data)) {
    return { ...existingReceipt.data, preserved_existing_receipt: true };
  }
  const verified = attestationVerify.exit_code === 0;
  return receipt({
    schema_version: "attestation-verify-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `attestation.verify.${dateStamp(generatedAt)}`,
    receipt_status: verified ? "observed" : "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    repository_full_name: repositoryFullName,
    attestation_subject: attestationSubject,
    signed_attestation_generated_now: verified,
    attestation_verification_passed_now: verified,
    verification_output_hash: verified ? sha256(attestationVerify.stdout) : null,
    raw_payload_inlined: false,
    command_observations: [attestationVerify],
    next_allowed_action: verified ? "preserve signed attestation verification evidence" : "provide CI-generated attestation subject and rerun gh attestation verify",
  });
}

function buildClaudeReviewReceipt({ generatedAt, receiptPath, existingReceipt }) {
  if (isObservedReceipt(existingReceipt.data) || existingReceipt.data?.review_completed_now === true) {
    return { ...existingReceipt.data, preserved_existing_receipt: true };
  }
  return receipt({
    schema_version: "claude-review-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `claude.review.${dateStamp(generatedAt)}`,
    receipt_status: "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    reviewer_id: REVIEWER_ID,
    tool: "claude_code",
    requested_model_alias: "opus",
    required_reasoning_tier: "max",
    model_selection_policy: "latest_available_opus",
    resolved_model_id: null,
    model_resolution_timestamp: null,
    review_completed_now: false,
    findings: [],
    raw_payload_inlined: false,
    next_allowed_action: "run Claude Code Opus max review and capture resolved model id plus normalized findings",
  });
}

function buildHumanAdjudicationReceipt({ generatedAt, receiptPath, existingReceipt, inputReceipt, claudeReviewReceipt }) {
  if (isObservedReceipt(existingReceipt.data) || existingReceipt.data?.human_adjudication_receipt_present_now === true) {
    return { ...existingReceipt.data, preserved_existing_receipt: true };
  }
  const inputValidation = validateHumanAdjudicationInput(inputReceipt, claudeReviewReceipt);
  if (inputValidation.valid) {
    const inputData = inputReceipt.data;
    const decisionSummary = summarizeDecisionCounts(inputData.decisions);
    return receipt({
      schema_version: "human-adjudication-receipt.v1",
      receipt_path: receiptPath,
      generated_at: generatedAt,
      receipt_id: `human.adjudication.${dateStamp(generatedAt)}`,
      receipt_status: "observed",
      program_range: PROGRAM_RANGE,
      human_adjudication_receipt_present_now: true,
      adjudicator_id: inputData.adjudicator_id,
      adjudicator_role: inputData.adjudicator_role ?? "human_owner",
      adjudicated_at: inputData.adjudicated_at ?? generatedAt,
      adjudication_input_path: inputReceipt.path,
      adjudication_input_hash: sha256(inputReceipt.raw),
      reviewed_reviewer_id: claudeReviewReceipt.data?.reviewer_id ?? REVIEWER_ID,
      reviewed_model_id: claudeReviewReceipt.data?.resolved_model_id ?? null,
      reviewed_findings_count: inputValidation.requiredFindingIds.length,
      adjudicated_findings_count: inputValidation.decisions.length,
      decision_summary: decisionSummary,
      allowed_decisions: ["ACCEPT", "ACCEPT_WITH_MODIFICATION", "REJECT", "HOLD"],
      decisions: inputValidation.decisions,
      final_authority_allowed_now: false,
      raw_payload_inlined: false,
      adjudication_input_valid_now: true,
      validation_errors: [],
      next_allowed_action: "preserve human adjudication receipt and rerun external verification enforcement",
    });
  }
  return receipt({
    schema_version: "human-adjudication-receipt.v1",
    receipt_path: receiptPath,
    generated_at: generatedAt,
    receipt_id: `human.adjudication.${dateStamp(generatedAt)}`,
    receipt_status: "blocked_missing_external_evidence",
    program_range: PROGRAM_RANGE,
    human_adjudication_receipt_present_now: false,
    adjudicator_id: null,
    allowed_decisions: ["ACCEPT", "ACCEPT_WITH_MODIFICATION", "REJECT", "HOLD"],
    decisions: [],
    final_authority_allowed_now: false,
    raw_payload_inlined: false,
    adjudication_input_path: inputReceipt?.path ?? null,
    adjudication_input_valid_now: false,
    validation_errors: inputValidation.errors,
    next_allowed_action: "human owner must adjudicate every Claude finding with ACCEPT/ACCEPT_WITH_MODIFICATION/REJECT/HOLD decisions",
  });
}

function validateHumanAdjudicationInput(inputReceipt, claudeReviewReceipt) {
  const errors = [];
  const allowedDecisions = new Set(["ACCEPT", "ACCEPT_WITH_MODIFICATION", "REJECT", "HOLD"]);
  const claudeData = claudeReviewReceipt?.data;
  const claudeObserved = isObservedReceipt(claudeData) || claudeData?.review_completed_now === true;
  const requiredFindingIds = Array.isArray(claudeData?.findings)
    ? claudeData.findings.map((finding) => finding.finding_id).filter((findingId) => typeof findingId === "string" && findingId.length > 0)
    : [];

  if (!inputReceipt?.available) errors.push("human_adjudication_input_missing");
  const data = inputReceipt?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) errors.push("human_adjudication_input_not_object");
  if (!claudeObserved) errors.push("claude_review_receipt_not_observed");
  if (requiredFindingIds.length === 0) errors.push("claude_review_findings_missing");
  if (data?.schema_version !== "human-adjudication-input.v1") errors.push("schema_version_must_be_human_adjudication_input_v1");
  if (!nonEmptyString(data?.adjudicator_id)) errors.push("adjudicator_id_required");
  if (data?.raw_payload_inlined !== false) errors.push("raw_payload_inlined_must_be_false");
  if (data?.final_authority_allowed_now === true) errors.push("final_authority_allowed_now_must_not_be_true");
  if (!Array.isArray(data?.decisions) || data.decisions.length === 0) errors.push("decisions_required");

  const decisions = Array.isArray(data?.decisions)
    ? data.decisions.map((decision) => normalizeHumanDecision(decision)).filter(Boolean)
    : [];
  const decisionIds = new Set(decisions.map((decision) => decision.finding_id));
  const missingFindingIds = requiredFindingIds.filter((findingId) => !decisionIds.has(findingId));
  const unknownDecisionIds = decisions.map((decision) => decision.finding_id).filter((findingId) => !requiredFindingIds.includes(findingId));
  if (decisions.length !== data?.decisions?.length) errors.push("decision_shape_invalid");
  if (decisions.some((decision) => !allowedDecisions.has(decision.decision))) errors.push("decision_value_invalid");
  if (new Set(decisions.map((decision) => decision.finding_id)).size !== decisions.length) errors.push("duplicate_finding_decision");
  if (missingFindingIds.length > 0) errors.push(`missing_finding_decisions:${missingFindingIds.join(",")}`);
  if (unknownDecisionIds.length > 0) errors.push(`unknown_finding_decisions:${unknownDecisionIds.join(",")}`);

  return {
    valid: errors.length === 0,
    errors,
    requiredFindingIds,
    decisions,
  };
}

function normalizeHumanDecision(decision) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return null;
  if (!nonEmptyString(decision.finding_id) || !nonEmptyString(decision.decision)) return null;
  return {
    finding_id: decision.finding_id,
    decision: decision.decision,
    rationale_summary_hash: nonEmptyString(decision.rationale_summary) ? sha256(decision.rationale_summary) : null,
    follow_up_required: decision.follow_up_required === true,
    owner_note_hash: nonEmptyString(decision.owner_note) ? sha256(decision.owner_note) : null,
  };
}

function summarizeDecisionCounts(decisions) {
  return decisions.reduce((summary, decision) => {
    summary[decision.decision] = (summary[decision.decision] ?? 0) + 1;
    return summary;
  }, { ACCEPT: 0, ACCEPT_WITH_MODIFICATION: 0, REJECT: 0, HOLD: 0 });
}

function receipt(fields) {
  return {
    ...fields,
    content_hash: sha256(JSON.stringify(canonicalize({ ...fields, content_hash: undefined }))),
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildValidationItems({ receiptPaths, receipts }) {
  return [
    validationItem("receipt.remote_binding.path", "receipt_path", receipts.remote_binding_receipt.receipt_path === receiptPaths.remote_binding_receipt_path, "remote binding receipt path must match contract"),
    validationItem("receipt.branch_protection.path", "receipt_path", receipts.branch_protection_receipt.receipt_path === receiptPaths.branch_protection_receipt_path, "branch protection receipt path must match contract"),
    validationItem("receipt.required_check.path", "receipt_path", receipts.required_check_receipt.receipt_path === receiptPaths.required_check_receipt_path, "required check receipt path must match contract"),
    validationItem("receipt.actions_run.path", "receipt_path", receipts.actions_run_receipt.receipt_path === receiptPaths.actions_run_receipt_path, "actions run receipt path must match contract"),
    validationItem("receipt.attestation.path", "receipt_path", receipts.attestation_verify_receipt.receipt_path === receiptPaths.attestation_verify_receipt_path, "attestation verify receipt path must match contract"),
    validationItem("receipt.claude_review.path", "receipt_path", receipts.claude_review_receipt.receipt_path === receiptPaths.claude_review_receipt_path, "Claude review receipt path must match contract"),
    validationItem("receipt.human_adjudication.path", "receipt_path", receipts.human_adjudication_receipt.receipt_path === receiptPaths.human_adjudication_receipt_path, "human adjudication receipt path must match contract"),
    validationItem("receipt.raw_not_inlined", "receipt_safety", Object.values(receipts).every((item) => item.raw_payload_inlined === false), "receipts must not inline raw external payloads"),
    validationItem("receipt.unsafe_false", "receipt_safety", Object.values(receipts).every((item) => item.unsafe_flags_false === true), "receipts must keep unsafe flags false"),
  ];
}

function buildSummary({ receipts, validation }) {
  return {
    schema_version: "platform-live-external-verification-evidence-summary.v1",
    program_range: PROGRAM_RANGE,
    github_remote_configured_now: receipts.remote_binding_receipt.github_remote_configured_now,
    gh_cli_available_now: receipts.remote_binding_receipt.gh_cli_available_now,
    gh_auth_available_now: receipts.remote_binding_receipt.gh_auth_available_now,
    branch_protection_configured_now: receipts.branch_protection_receipt.branch_protection_configured_now,
    required_status_check_enforced_now: receipts.required_check_receipt.required_status_check_enforced_now,
    actions_run_success_now: receipts.actions_run_receipt.actions_run_success_now,
    signed_attestation_generated_now: receipts.attestation_verify_receipt.signed_attestation_generated_now,
    attestation_verification_passed_now: receipts.attestation_verify_receipt.attestation_verification_passed_now,
    claude_review_completed_now: receipts.claude_review_receipt.review_completed_now,
    human_adjudication_receipt_present_now: receipts.human_adjudication_receipt.human_adjudication_receipt_present_now,
    observed_receipt_count: Object.values(receipts).filter((item) => item.receipt_status === "observed").length,
    blocked_receipt_count: Object.values(receipts).filter((item) => item.receipt_status !== "observed").length,
    validation_error_count: validation.errors.length,
  };
}

async function runShellCommand(commandId, command, cwd) {
  try {
    const result = await execFileAsync("/bin/zsh", ["-lc", command], { cwd, timeout: 10000, maxBuffer: 1024 * 1024 });
    return commandResult(commandId, command, true, 0, result.stdout, result.stderr);
  } catch (error) {
    return commandResult(commandId, command, true, Number.isInteger(error.code) ? error.code : 1, error.stdout ?? "", error.stderr ?? error.message ?? "");
  }
}

function commandResult(commandId, command, executed, exitCode, stdout, stderr) {
  return {
    command_id: commandId,
    command,
    executed,
    exit_code: exitCode,
    stdout: redactOutput(stdout),
    stderr: redactOutput(stderr),
    output_hash: sha256(`${stdout ?? ""}\n${stderr ?? ""}`),
    raw_payload_inlined: false,
  };
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
    output_hash: null,
    raw_payload_inlined: false,
  };
}

function missingGitHubReason({ ghPath, ghAuth, repositoryFullName }) {
  if (ghPath.exit_code !== 0) return "gh_not_available";
  if (ghAuth.exit_code !== 0) return "gh_not_authenticated";
  if (!repositoryFullName) return "github_repository_not_configured";
  return "github_precondition_missing";
}

function isObservedReceipt(data) {
  return data?.receipt_status === "observed";
}

function firstGithubRemoteUrl(remoteUrls) {
  return remoteUrls.find((remoteUrl) => parseGithubRemote(remoteUrl)) ?? null;
}

function parseGithubRemote(remoteUrl) {
  const trimmed = String(remoteUrl ?? "").trim();
  let match = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  match = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  return null;
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readOptionalJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { available: true, path: filePath, raw, data: JSON.parse(raw) };
  } catch (error) {
    return { available: false, path: filePath, raw: "", data: null, error: error.message };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function renderMarkdown(result) {
  return [
    "# Platform Live External Verification Evidence",
    "",
    `Program: ${result.program_range}`,
    `GitHub remote configured: ${result.summary.github_remote_configured_now}`,
    `GitHub auth available: ${result.summary.gh_auth_available_now}`,
    `Branch protection configured: ${result.summary.branch_protection_configured_now}`,
    `Required check enforced: ${result.summary.required_status_check_enforced_now}`,
    `Actions run success: ${result.summary.actions_run_success_now}`,
    `Attestation verified: ${result.summary.attestation_verification_passed_now}`,
    `Claude review completed: ${result.summary.claude_review_completed_now}`,
    `Human adjudication present: ${result.summary.human_adjudication_receipt_present_now}`,
    `Observed receipts: ${result.summary.observed_receipt_count}`,
    `Blocked receipts: ${result.summary.blocked_receipt_count}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableResult(result) {
  return result;
}

function normalizeReceiptPaths(options) {
  const defaults = DEFAULT_PLATFORM_LIVE_EXTERNAL_VERIFICATION_RECEIPTS;
  return {
    remote_binding_receipt_path: options.remoteBindingReceiptPath ?? defaults.remoteBindingReceiptPath,
    branch_protection_receipt_path: options.branchProtectionReceiptPath ?? defaults.branchProtectionReceiptPath,
    required_check_receipt_path: options.requiredCheckReceiptPath ?? defaults.requiredCheckReceiptPath,
    actions_run_receipt_path: options.actionsRunReceiptPath ?? defaults.actionsRunReceiptPath,
    attestation_verify_receipt_path: options.attestationVerifyReceiptPath ?? defaults.attestationVerifyReceiptPath,
    claude_review_receipt_path: options.claudeReviewReceiptPath ?? defaults.claudeReviewReceiptPath,
    human_adjudication_receipt_path: options.humanAdjudicationReceiptPath ?? defaults.humanAdjudicationReceiptPath,
  };
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    cwd: undefined,
    githubRepoUrl: undefined,
    repositoryFullName: undefined,
    branch: undefined,
    attestationSubject: undefined,
    humanAdjudicationInputPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--cwd") {
      args.cwd = argv[index + 1];
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
    } else if (arg === "--attestation-subject") {
      args.attestationSubject = argv[index + 1];
      index += 1;
    } else if (arg === "--human-adjudication-input") {
      args.humanAdjudicationInputPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-live-external-verification-evidence.mjs [options]

Options:
  --check                         Validate without writing receipt artifacts.
  --repo <owner/repo>             GitHub repository full name.
  --github-repo-url <url>         GitHub repository URL.
  --branch <branch>               Branch to inspect.
  --attestation-subject <path>    Artifact path or subject for gh attestation verify.
  --human-adjudication-input <path>
                                  Human owner decision input JSON.
  --help                          Show this help.
`);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function quoteShell(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function quotePathPart(value) {
  return encodeURIComponent(String(value));
}

function redactOutput(value) {
  return String(value ?? "")
    .replace(/ghp_[A-Za-z0-9_]+/g, "ghp_[REDACTED]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_[REDACTED]")
    .slice(0, 6000);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
