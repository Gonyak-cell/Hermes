import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformExternalVerificationEnforcement,
  runPlatformExternalVerificationEnforcement,
} from "../src/platform-external-verification-enforcement.mjs";
import {
  buildPlatformLiveExternalVerificationEvidence,
  classifyAttestationSupport,
  runPlatformLiveExternalVerificationEvidence,
} from "../src/platform-live-external-verification-evidence.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const BLOCKED_PREFLIGHT = {
  schema_version: "external-verification-live-preflight.v1",
  cwd: "/tmp/hermes",
  generated_at: RUN_AT,
  git_remote_origin: "/tmp/local.bundle",
  git_branch: "main",
  github_remote_configured_now: false,
  github_owner: null,
  github_repo: null,
  gh_cli_available_now: false,
  gh_auth_available_now: false,
  claude_code_available_now: true,
  claude_code_version: "2.1.143 (Claude Code)",
  branch_protection_query_available_now: false,
  branch_protection_configured_now: false,
  required_status_check_enforced_now: false,
  required_pr_review_enforced_now: false,
  stale_review_dismissal_enforced_now: false,
  force_push_disabled_now: false,
  command_observations: [],
};
const MISSING_RECEIPT_OPTIONS = receiptPaths(path.join(os.tmpdir(), `platform-missing-receipts-${process.pid}`)).options;

const resultPromise = buildPlatformExternalVerificationEnforcement({
  runAt: RUN_AT,
  write: false,
  livePreflight: BLOCKED_PREFLIGHT,
  ...MISSING_RECEIPT_OPTIONS,
});

test("External verification enforcement consumes P3361-P3520 activation and stays blocked without external controls", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_external_verification_enforcement_status, "blocked_pending_external_verification_enforcement");
  assert.equal(result.summary.source_activation_status, "ready_for_platform_verification_trust_activation");
  assert.equal(result.external_verification_enforcement_anchor.program_range, "P3521-P3680");
  assert.equal(result.external_verification_enforcement_anchor.previous_phase_slot, "P3520");
  assert.equal(result.external_verification_enforcement_anchor.next_phase_slot, "P3681");
  assert.equal(result.summary.p3680_external_controls_complete, false);
  assert.equal(result.summary.enterprise_trust_claim_allowed_now, false);
});

test("External verification enforcement registers Claude Code Opus max as independent reviewer without final authority", async () => {
  const result = await resultPromise;
  const [reviewer] = result.reviewer_profile_rows;

  assert.equal(result.reviewer_profile_rows.length, 1);
  assert.equal(reviewer.reviewer_id, "reviewer.claude_code.opus_max");
  assert.equal(reviewer.tool, "claude_code");
  assert.equal(reviewer.preferred_model_alias, "opus");
  assert.equal(reviewer.required_reasoning_tier, "max");
  assert.equal(reviewer.model_selection_policy, "latest_available_opus");
  assert.equal(reviewer.claude_code_available_now, true);
  assert.equal(reviewer.write_permission_allowed, false);
  assert.equal(reviewer.final_authority_allowed, false);
});

test("External verification enforcement treats missing Claude Code as blocked evidence, not invalid schema", async () => {
  const result = await buildPlatformExternalVerificationEnforcement({
    runAt: RUN_AT,
    write: false,
    livePreflight: {
      ...BLOCKED_PREFLIGHT,
      claude_code_available_now: false,
      claude_code_version: null,
    },
    ...MISSING_RECEIPT_OPTIONS,
  });
  const [reviewer] = result.reviewer_profile_rows;
  const claudeAvailability = result.independent_review_completion_rows.find((row) => row.control_id === "claude_code_available");
  const availabilityGuard = result.external_verification_guard_rows.find((row) => row.guard_id === "claude_code_availability_not_overclaimed");

  assert.equal(result.validation.valid, true);
  assert.equal(reviewer.claude_code_available_now, false);
  assert.equal(reviewer.current_verdict, "pass");
  assert.equal(claudeAvailability.observed_now, false);
  assert.equal(claudeAvailability.current_verdict, "blocked");
  assert.equal(availabilityGuard.guard_status, "ready");
  assert.equal(result.summary.p3680_external_controls_complete, false);
});

test("External verification enforcement defines blind review packets and normalized finding fields", async () => {
  const result = await resultPromise;
  const findingFields = result.finding_schema_rows.map((row) => row.field_name);

  assert.equal(result.review_packet_rows.length, 6);
  assert.equal(result.review_packet_rows.every((row) => row.default_review_mode === "independent"), true);
  assert.equal(result.review_packet_rows.every((row) => row.primary_conclusion_hidden_by_default === true), true);
  assert.equal(result.review_packet_rows.every((row) => row.external_transfer_requires_classification === true), true);
  assert.equal(result.finding_schema_rows.length, 10);
  assert.deepEqual(findingFields, [
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
  ]);
});

test("External verification enforcement does not overclaim GitHub branch protection or attestation", async () => {
  const result = await resultPromise;
  const branchConfigured = result.branch_protection_rows.find((row) => row.control_id === "branch_protection_configured");
  const statusEnforced = result.required_status_check_rows.find((row) => row.check_id === "external_enforcement");
  const attestationGenerated = result.signed_attestation_rows.find((row) => row.control_id === "signed_attestation_generated");
  const attestationVerified = result.signed_attestation_rows.find((row) => row.control_id === "attestation_verification_passed");

  assert.equal(result.branch_protection_rows.length, 9);
  assert.equal(branchConfigured.observed_now, false);
  assert.equal(branchConfigured.current_verdict, "blocked");
  assert.equal(statusEnforced.workflow_defined_now, true);
  assert.equal(statusEnforced.required_status_check_enforced_now, false);
  assert.equal(statusEnforced.current_verdict, "blocked");
  assert.equal(result.signed_attestation_rows.length, 5);
  assert.equal(attestationGenerated.observed_now, false);
  assert.equal(attestationGenerated.current_verdict, "blocked");
  assert.equal(attestationVerified.observed_now, false);
  assert.equal(attestationVerified.current_verdict, "blocked");
});

test("External verification enforcement surfaces attestation block reason from receipt evidence", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-attestation-block-reason-"));
  const paths = receiptPaths(outDir);

  try {
    await writeReceipt(paths.attestationVerifyReceiptPath, {
      schema_version: "attestation-verify-receipt.v1",
      receipt_status: "blocked_missing_external_evidence",
      repository_full_name: "example/hermes",
      repository_visibility: "private",
      repository_is_private: true,
      repository_owner_type: "User",
      signed_attestation_generated_now: false,
      attestation_verification_passed_now: false,
      attestation_support_status: "blocked_private_or_internal_repository",
      attestation_block_reason: "github_private_user_repository_requires_enterprise_cloud_for_artifact_attestations",
      attestation_policy_ref: "github_docs.artifact_attestations.private_internal_requires_enterprise_cloud",
      raw_payload_inlined: false,
    });
    const base = await resultPromise;
    const result = await buildPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      write: false,
      livePreflight: BLOCKED_PREFLIGHT,
      sourceActivation: { summary: base.source_verification_trust_activation_summary },
      ...paths.options,
    });
    const attestationRow = result.signed_attestation_rows.find((row) => row.control_id === "attestation_verification_passed");

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.attestation_support_status, "blocked_private_or_internal_repository");
    assert.equal(result.summary.attestation_block_reason, "github_private_user_repository_requires_enterprise_cloud_for_artifact_attestations");
    assert.equal(result.summary.attestation_policy_ref, "github_docs.artifact_attestations.private_internal_requires_enterprise_cloud");
    assert.equal(attestationRow.attestation_support_status, "blocked_private_or_internal_repository");
    assert.equal(result.summary.p3680_external_controls_complete, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("External verification enforcement requires Claude review receipts plus human adjudication before completion", async () => {
  const result = await resultPromise;
  const claudeReceipt = result.independent_review_completion_rows.find((row) => row.control_id === "claude_review_receipt_present");
  const humanReceipt = result.independent_review_completion_rows.find((row) => row.control_id === "human_adjudication_receipt_present");

  assert.equal(result.independent_review_completion_rows.length, 6);
  assert.equal(claudeReceipt.observed_now, false);
  assert.equal(claudeReceipt.current_verdict, "blocked");
  assert.equal(humanReceipt.observed_now, false);
  assert.equal(humanReceipt.current_verdict, "blocked");
  assert.equal(result.summary.independent_review_completed_now, false);
  assert.equal(result.summary.human_adjudication_receipt_present_now, false);
});

test("External verification enforcement keeps provenance hash-bound and validation ledger chained", async () => {
  const result = await resultPromise;

  assert.equal(result.evidence_provenance_rows.length, 15);
  assert.equal(result.evidence_provenance_rows.every((row) => row.raw_payload_inlined === false), true);
  assert.equal(result.evidence_provenance_rows.filter((row) => row.provenance_status === "hash_bound").length >= 8, true);
  assert.equal(result.validation_result_ledger_rows.length, 8);
  assert.equal(result.validation_result_ledger_rows.every((row, index) => row.chain_hash.startsWith("sha256:") && (index === 0 || row.previous_hash === result.validation_result_ledger_rows[index - 1].chain_hash)), true);
});

test("Live external verification evidence capture creates the seven concrete receipt contracts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-live-external-evidence-"));
  const paths = receiptPaths(outDir);

  try {
    const result = await runPlatformLiveExternalVerificationEvidence({
      runAt: RUN_AT,
      write: true,
      branch: "main",
      actionsBranch: "codex/test-actions-branch",
      ...paths.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(Object.keys(result.receipts).length, 7);
    assert.equal(result.receipts.remote_binding_receipt.receipt_path, paths.remoteBindingReceiptPath);
    assert.equal(result.receipts.branch_protection_receipt.receipt_path, paths.branchProtectionReceiptPath);
    assert.equal(result.receipts.required_check_receipt.receipt_path, paths.requiredCheckReceiptPath);
    assert.equal(result.receipts.actions_run_receipt.receipt_path, paths.actionsRunReceiptPath);
    assert.equal(result.receipts.branch_protection_receipt.branch_name, "main");
    assert.equal(result.receipts.required_check_receipt.actions_branch_name, "codex/test-actions-branch");
    assert.equal(result.receipts.actions_run_receipt.branch_name, "codex/test-actions-branch");
    assert.equal(result.receipts.actions_run_receipt.protected_branch_name, "main");
    assert.equal(result.receipts.attestation_verify_receipt.receipt_path, paths.attestationVerifyReceiptPath);
    assert.equal(result.receipts.claude_review_receipt.receipt_path, paths.claudeReviewReceiptPath);
    assert.equal(result.receipts.human_adjudication_receipt.receipt_path, paths.humanAdjudicationReceiptPath);
    assert.equal(await readJson(paths.claudeReviewReceiptPath).then((data) => data.review_completed_now), false);
    assert.equal(await readJson(paths.humanAdjudicationReceiptPath).then((data) => data.human_adjudication_receipt_present_now), false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Live external verification evidence promotes complete human adjudication input to observed receipt", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-human-adjudication-input-"));
  const paths = receiptPaths(outDir);
  const inputPath = path.join(outDir, "human-adjudication-input.json");

  try {
    await writeObservedClaudeReviewReceipt(paths.claudeReviewReceiptPath, ["F-001", "F-002"]);
    await writeFile(inputPath, `${JSON.stringify({
      schema_version: "human-adjudication-input.v1",
      adjudicator_id: "human.owner",
      adjudicator_role: "human_owner",
      adjudicated_at: RUN_AT,
      raw_payload_inlined: false,
      final_authority_allowed_now: false,
      decisions: [
        {
          finding_id: "F-001",
          decision: "ACCEPT_WITH_MODIFICATION",
          rationale_summary: "Owner accepts the finding but will apply a narrower change.",
          follow_up_required: true,
        },
        {
          finding_id: "F-002",
          decision: "HOLD",
          owner_note: "Needs a separate review lane.",
        },
      ],
    }, null, 2)}\n`, "utf8");

    const result = await runPlatformLiveExternalVerificationEvidence({
      runAt: RUN_AT,
      write: true,
      humanAdjudicationInputPath: inputPath,
      ...paths.options,
    });
    const receipt = result.receipts.human_adjudication_receipt;

    assert.equal(result.validation.valid, true);
    assert.equal(receipt.receipt_status, "observed");
    assert.equal(receipt.human_adjudication_receipt_present_now, true);
    assert.equal(receipt.adjudication_input_hash.startsWith("sha256:"), true);
    assert.equal(receipt.reviewed_findings_count, 2);
    assert.equal(receipt.adjudicated_findings_count, 2);
    assert.equal(receipt.decision_summary.ACCEPT_WITH_MODIFICATION, 1);
    assert.equal(receipt.decision_summary.HOLD, 1);
    assert.equal(receipt.decisions.every((decision) => !("rationale_summary" in decision) && !("owner_note" in decision)), true);
    assert.equal(await readJson(paths.humanAdjudicationReceiptPath).then((data) => data.receipt_status), "observed");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Live external verification evidence blocks incomplete human adjudication input", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-human-adjudication-incomplete-"));
  const paths = receiptPaths(outDir);
  const inputPath = path.join(outDir, "human-adjudication-input.json");

  try {
    await writeObservedClaudeReviewReceipt(paths.claudeReviewReceiptPath, ["F-001", "F-002"]);
    await writeFile(inputPath, `${JSON.stringify({
      schema_version: "human-adjudication-input.v1",
      adjudicator_id: "human.owner",
      raw_payload_inlined: false,
      final_authority_allowed_now: false,
      decisions: [{ finding_id: "F-001", decision: "ACCEPT" }],
    }, null, 2)}\n`, "utf8");

    const result = await runPlatformLiveExternalVerificationEvidence({
      runAt: RUN_AT,
      write: true,
      humanAdjudicationInputPath: inputPath,
      ...paths.options,
    });
    const receipt = result.receipts.human_adjudication_receipt;

    assert.equal(result.validation.valid, true);
    assert.equal(receipt.receipt_status, "blocked_missing_external_evidence");
    assert.equal(receipt.human_adjudication_receipt_present_now, false);
    assert.equal(receipt.adjudication_input_valid_now, false);
    assert.equal(receipt.validation_errors.includes("missing_finding_decisions:F-002"), true);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Live external verification evidence writes a non-promoting human adjudication template", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-human-adjudication-template-"));
  const paths = receiptPaths(outDir);
  const templatePath = path.join(outDir, "review", "human-adjudication-input.json");

  try {
    await writeObservedClaudeReviewReceipt(paths.claudeReviewReceiptPath, ["F-001", "F-002", "F-003"]);
    const result = await runPlatformLiveExternalVerificationEvidence({
      runAt: RUN_AT,
      write: true,
      humanAdjudicationTemplatePath: templatePath,
      ...paths.options,
    });
    const template = await readJson(templatePath);

    assert.equal(result.validation.valid, true);
    assert.equal(result.receipts.human_adjudication_receipt.receipt_status, "blocked_missing_external_evidence");
    assert.equal(template.schema_version, "human-adjudication-input.v1");
    assert.equal(template.template_status, "draft_requires_human_completion");
    assert.equal(template.raw_payload_inlined, false);
    assert.equal(template.final_authority_allowed_now, false);
    assert.equal(template.required_finding_count, 3);
    assert.deepEqual(template.decisions.map((decision) => decision.finding_id), ["F-001", "F-002", "F-003"]);
    assert.equal(template.decisions.every((decision) => decision.decision === ""), true);
    assert.equal(template.template_hash.startsWith("sha256:"), true);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Live external verification evidence classifies private user repo attestations as externally blocked", () => {
  const support = classifyAttestationSupport({
    verified: false,
    attestationSubject: "/tmp/hermes-verification-trust-artifacts.tgz",
    repositoryVisibility: "private",
    repositoryIsPrivate: true,
    repositoryOwnerType: "User",
    attestationVerify: {
      executed: true,
      exit_code: 1,
      stderr: "Error: HTTP 404: Not Found",
      stdout: "",
    },
  });

  assert.equal(support.status, "blocked_private_or_internal_repository");
  assert.equal(support.blockReason, "github_private_user_repository_requires_enterprise_cloud_for_artifact_attestations");
  assert.equal(support.policyRef, "github_docs.artifact_attestations.private_internal_requires_enterprise_cloud");
  assert.equal(support.nextActionCode, "move_to_enterprise_cloud_or_public_attestation_lane");
});

test("Live external verification evidence classifies verified attestations as preserved evidence", () => {
  const support = classifyAttestationSupport({
    verified: true,
    attestationSubject: "/tmp/hermes-verification-trust-artifacts.tgz",
    repositoryVisibility: "public",
    repositoryIsPrivate: false,
    repositoryOwnerType: "Organization",
    attestationVerify: {
      executed: true,
      exit_code: 0,
      stderr: "",
      stdout: "[{\"verificationResult\":\"ok\"}]",
    },
  });

  assert.equal(support.status, "verified");
  assert.equal(support.blockReason, null);
  assert.equal(support.nextActionCode, "preserve_verified_attestation");
});

test("External verification enforcement keeps blocked placeholder receipts from becoming completed review evidence", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-blocked-receipts-"));
  const paths = receiptPaths(outDir);

  try {
    await runPlatformLiveExternalVerificationEvidence({
      runAt: RUN_AT,
      write: true,
      ...paths.options,
    });
    const base = await resultPromise;
    const result = await buildPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      write: false,
      livePreflight: BLOCKED_PREFLIGHT,
      sourceActivation: { summary: base.source_verification_trust_activation_summary },
      ...paths.options,
    });
    const claudeReceipt = result.independent_review_completion_rows.find((row) => row.control_id === "claude_review_receipt_present");
    const findings = result.independent_review_completion_rows.find((row) => row.control_id === "findings_normalized");

    assert.equal(result.validation.valid, true);
    assert.equal(claudeReceipt.observed_now, false);
    assert.equal(findings.observed_now, false);
    assert.equal(result.summary.independent_review_completed_now, false);
    assert.equal(result.summary.p3680_external_controls_complete, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("External verification enforcement does not promote gh CLI evidence from a blocked remote receipt", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-blocked-remote-receipt-"));
  const paths = receiptPaths(outDir);

  try {
    await writeReceipt(paths.remoteBindingReceiptPath, {
      schema_version: "github-remote-binding-receipt.v1",
      receipt_status: "blocked_missing_external_evidence",
      repository_full_name: "example/hermes",
      github_remote_configured_now: false,
      gh_cli_available_now: true,
      gh_auth_available_now: false,
      raw_payload_inlined: false,
    });
    const base = await resultPromise;
    const result = await buildPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      write: false,
      livePreflight: {
        ...BLOCKED_PREFLIGHT,
        gh_cli_available_now: false,
      },
      sourceActivation: { summary: base.source_verification_trust_activation_summary },
      ...paths.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.gh_cli_available_now, false);
    assert.equal(result.summary.github_remote_configured_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("External verification enforcement turns controls true only when observed receipts prove them", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-observed-receipts-"));
  const paths = receiptPaths(outDir);

  try {
    await writeObservedReceipts(paths);
    const base = await resultPromise;
    const result = await buildPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      write: false,
      livePreflight: BLOCKED_PREFLIGHT,
      sourceActivation: { summary: base.source_verification_trust_activation_summary },
      ...paths.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.github_remote_configured_now, true);
    assert.equal(result.summary.gh_auth_available_now, true);
    assert.equal(result.summary.branch_protection_configured_now, true);
    assert.equal(result.summary.required_status_check_enforced_now, true);
    assert.equal(result.summary.actions_run_success_now, true);
    assert.equal(result.summary.required_pr_review_enforced_now, true);
    assert.equal(result.summary.force_push_disabled_now, true);
    assert.equal(result.summary.signed_attestation_generated_now, true);
    assert.equal(result.summary.attestation_verification_passed_now, true);
    assert.equal(result.summary.independent_review_completed_now, true);
    assert.equal(result.summary.human_adjudication_receipt_present_now, true);
    assert.equal(result.summary.p3680_external_controls_complete, true);
    assert.equal(result.summary.platform_external_verification_enforcement_status, "ready_for_platform_external_verification_enforcement");
    assert.equal(result.summary.enterprise_trust_claim_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("External verification enforcement requires observed Actions run success before completion", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-observed-without-actions-"));
  const paths = receiptPaths(outDir);

  try {
    await writeObservedReceipts(paths);
    await writeReceipt(paths.actionsRunReceiptPath, {
      schema_version: "github-actions-run-receipt.v1",
      receipt_status: "blocked_missing_external_evidence",
      actions_run_id: null,
      actions_run_conclusion: null,
      actions_run_success_now: false,
      raw_payload_inlined: false,
    });
    const base = await resultPromise;
    const result = await buildPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      write: false,
      livePreflight: BLOCKED_PREFLIGHT,
      sourceActivation: { summary: base.source_verification_trust_activation_summary },
      ...paths.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.actions_run_success_now, false);
    assert.equal(result.summary.attestation_verification_passed_now, true);
    assert.equal(result.summary.independent_review_completed_now, true);
    assert.equal(result.summary.p3680_external_controls_complete, false);
    assert.equal(result.summary.platform_external_verification_enforcement_status, "blocked_pending_external_verification_enforcement");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("External verification enforcement --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-external-verification-enforcement-"));
  const sentinelPath = path.join(outDir, "platform-external-verification-enforcement.json");
  const sentinel = "{ \"sentinel\": \"platform-external-verification-enforcement\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformExternalVerificationEnforcement({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      livePreflight: BLOCKED_PREFLIGHT,
      ...MISSING_RECEIPT_OPTIONS,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function receiptPaths(root) {
  const remoteBindingReceiptPath = path.join(root, "github", "remote-binding-receipt.json");
  const branchProtectionReceiptPath = path.join(root, "github", "branch-protection-receipt.json");
  const requiredCheckReceiptPath = path.join(root, "github", "required-check-receipt.json");
  const actionsRunReceiptPath = path.join(root, "github", "actions-run-receipt.json");
  const attestationVerifyReceiptPath = path.join(root, "attestation", "attestation-verify-receipt.json");
  const claudeReviewReceiptPath = path.join(root, "review", "claude-review-receipt.json");
  const humanAdjudicationReceiptPath = path.join(root, "review", "human-adjudication-receipt.json");
  return {
    remoteBindingReceiptPath,
    branchProtectionReceiptPath,
    requiredCheckReceiptPath,
    actionsRunReceiptPath,
    attestationVerifyReceiptPath,
    claudeReviewReceiptPath,
    humanAdjudicationReceiptPath,
    options: {
      remoteBindingReceiptPath,
      branchProtectionReceiptPath,
      requiredCheckReceiptPath,
      actionsRunReceiptPath,
      attestationVerifyReceiptPath,
      claudeReviewReceiptPath,
      humanAdjudicationReceiptPath,
    },
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeObservedReceipts(paths) {
  await writeReceipt(paths.remoteBindingReceiptPath, {
    schema_version: "github-remote-binding-receipt.v1",
    receipt_status: "observed",
    repository_full_name: "example/hermes",
    github_remote_configured_now: true,
    gh_cli_available_now: true,
    gh_auth_available_now: true,
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.branchProtectionReceiptPath, {
    schema_version: "github-branch-protection-receipt.v1",
    receipt_status: "observed",
    repository_full_name: "example/hermes",
    branch_protection_query_available_now: true,
    branch_protection_configured_now: true,
    required_pr_review_enforced_now: true,
    stale_review_dismissal_enforced_now: true,
    force_push_disabled_now: true,
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.requiredCheckReceiptPath, {
    schema_version: "github-required-check-receipt.v1",
    receipt_status: "observed",
    required_check_name: "Hermes verification trust",
    required_status_check_enforced_now: true,
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.actionsRunReceiptPath, {
    schema_version: "github-actions-run-receipt.v1",
    receipt_status: "observed",
    actions_run_id: 12345,
    actions_run_conclusion: "success",
    actions_run_success_now: true,
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.attestationVerifyReceiptPath, {
    schema_version: "attestation-verify-receipt.v1",
    receipt_status: "observed",
    signed_attestation_generated_now: true,
    attestation_verification_passed_now: true,
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.claudeReviewReceiptPath, {
    schema_version: "claude-review-receipt.v1",
    receipt_status: "observed",
    reviewer_id: "reviewer.claude_code.opus_max",
    resolved_model_id: "claude-opus-test",
    model_resolution_timestamp: RUN_AT,
    review_completed_now: true,
    findings: [{
      finding_id: "F-001",
      severity: "info",
      category: "verification",
      location: "test/platform-external-verification-enforcement.test.mjs",
      evidence: "observed receipt regression",
      issue: "no issue",
      proposed_change: "preserve behavior",
      confidence: "high",
      risk_if_accepted: "low",
      risk_if_rejected: "low",
    }],
    raw_payload_inlined: false,
  });
  await writeReceipt(paths.humanAdjudicationReceiptPath, {
    schema_version: "human-adjudication-receipt.v1",
    receipt_status: "observed",
    human_adjudication_receipt_present_now: true,
    adjudicator_id: "human.owner",
    decisions: [{ finding_id: "F-001", decision: "ACCEPT" }],
    final_authority_allowed_now: false,
    raw_payload_inlined: false,
  });
}

async function writeObservedClaudeReviewReceipt(filePath, findingIds = ["F-001"]) {
  await writeReceipt(filePath, {
    schema_version: "claude-review-receipt.v1",
    receipt_status: "observed",
    reviewer_id: "reviewer.claude_code.opus_max",
    resolved_model_id: "claude-opus-test",
    model_resolution_timestamp: RUN_AT,
    review_completed_now: true,
    findings: findingIds.map((findingId) => ({
      finding_id: findingId,
      severity: "info",
      category: "verification",
      location: "test/platform-external-verification-enforcement.test.mjs",
      evidence: "observed receipt regression",
      issue: "no issue",
      proposed_change: "preserve behavior",
      confidence: "high",
      risk_if_accepted: "low",
      risk_if_rejected: "low",
    })),
    raw_payload_inlined: false,
  });
}

async function writeReceipt(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify({
    receipt_path: filePath,
    generated_at: RUN_AT,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    ...payload,
  }, null, 2)}\n`, "utf8");
}
