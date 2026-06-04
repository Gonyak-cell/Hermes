import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformReviewProcessUpgrade,
  runPlatformReviewProcessUpgrade,
} from "../src/platform-review-process-upgrade.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";

test("Review process upgrade freezes P3861-P4000 lanes after authority contract readiness", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewProcessUpgrade({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.review_process_anchor.program_range, "P3841-P4000");
    assert.equal(result.review_process_anchor.phase_range, "P3861-P4000");
    assert.equal(result.review_process_anchor.next_phase_slot, "P4001");
    assert.equal(result.summary.review_process_upgrade_status, "ready_for_review_process_upgrade");
    assert.equal(result.summary.p4000_review_process_upgrade_ready, true);
    assert.equal(result.summary.work_intake_field_count, 8);
    assert.equal(result.summary.claude_multi_pass_review_count, 6);
    assert.equal(result.summary.pr_type_policy_count, 6);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review process upgrade keeps Codex plan-only and self-review non-authoritative", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewProcessUpgrade({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.codex_plan_only_lane_rows.every((row) => row.file_edit_allowed_before_plan_review === false), true);
    assert.equal(result.claude_plan_review_lane_rows.every((row) => row.required_before_implementation === true), true);
    assert.equal(result.codex_self_review_rows.every((row) => row.final_approval_allowed === false), true);
    assert.equal(result.codex_self_review_rows.every((row) => row.independent_review_credit_allowed === false), true);
    assert.equal(result.summary.codex_self_review_independent_credit_allowed_now, false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review process upgrade encodes high-risk PR and unresolved finding closeout bars", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewProcessUpgrade({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });
    const securityPolicy = result.pr_type_policy_rows.find((row) => row.pr_type === "security_auth");
    const dependencyPolicy = result.pr_type_policy_rows.find((row) => row.pr_type === "dependency");
    const notFixedResolution = result.finding_fix_loop_rows.find((row) => row.resolution === "not_fixed");

    assert.equal(securityPolicy.high_risk_evidence_bar, true);
    assert.equal(dependencyPolicy.high_risk_evidence_bar, true);
    assert.equal(notFixedResolution.human_adjudication_required_for_unresolved_high, true);
    assert.equal(result.summary.unresolved_high_findings_block_closeout_now, true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review process upgrade fails closed when instruction freeze source is missing", async () => {
  const fixture = await writeFixture({ omitReviewInstructions: true });
  try {
    const result = await buildPlatformReviewProcessUpgrade({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });
    const reviewInstruction = result.instruction_freeze_rows.find((row) => row.source_id === "review_md");

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.instruction_freeze_ready_now, false);
    assert.equal(result.summary.p4000_review_process_upgrade_ready, false);
    assert.equal(reviewInstruction.current_verdict, "blocked");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review process upgrade check mode rejects an unready authority contract", async () => {
  const fixture = await writeFixture({ authorityReady: false });
  try {
    await assert.rejects(
      () => runPlatformReviewProcessUpgrade({
        runAt: RUN_AT,
        write: false,
        check: true,
        ...fixture.options,
      }),
      /Platform review process upgrade failed/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function writeFixture(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-review-process-upgrade-"));
  const githubDir = path.join(root, ".github");
  const docsDir = path.join(root, "docs");
  const authorityDir = path.join(root, "authority");
  await mkdir(githubDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(authorityDir, { recursive: true });
  const packagePath = path.join(root, "package.json");
  const reviewAuthorityContractPath = path.join(authorityDir, "platform-review-authority-contract.json");
  const externalVerificationLedgerPath = path.join(docsDir, "hermes-external-verification-enforcement.md");
  const agentsInstructionsPath = path.join(root, "AGENTS.md");
  const claudeInstructionsPath = path.join(root, "CLAUDE.md");
  const reviewInstructionsPath = path.join(root, "REVIEW.md");
  const promptTemplatesPath = path.join(docsDir, "review-process-prompt-templates.md");
  const pullRequestTemplatePath = path.join(githubDir, "pull_request_template.md");
  await writeJson(packagePath, {
    scripts: {
      "platform:review-process-upgrade": "node scripts/platform-review-process-upgrade.mjs",
    },
  });
  await writeJson(reviewAuthorityContractPath, {
    schema_version: "platform-review-authority-contract.v1",
    summary: {
      p4000_role_authority_contract_ready: options.authorityReady !== false,
    },
  });
  await writeFile(externalVerificationLedgerPath, "# P3841-P4000 Review Process Upgrade\n", "utf8");
  await writeFile(agentsInstructionsPath, "Codex cannot finally approve Codex-created work.\n", "utf8");
  await writeFile(claudeInstructionsPath, "Claude review cannot replace human adjudication.\n", "utf8");
  if (!options.omitReviewInstructions) await writeFile(reviewInstructionsPath, "Single-owner mode is lower-trust readiness only.\n", "utf8");
  await writeFile(promptTemplatesPath, "Prompt templates for plan, review, fix verification, and adjudication.\n", "utf8");
  await writeFile(pullRequestTemplatePath, "Codex final approval claimed: no\n", "utf8");
  return {
    root,
    options: {
      packagePath,
      reviewAuthorityContractPath,
      externalVerificationLedgerPath,
      agentsInstructionsPath,
      claudeInstructionsPath,
      reviewInstructionsPath,
      promptTemplatesPath,
      pullRequestTemplatePath,
    },
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
