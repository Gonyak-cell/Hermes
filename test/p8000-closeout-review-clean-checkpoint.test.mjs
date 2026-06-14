import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildP8000CloseoutReviewCleanCheckpoint,
  runP8000CloseoutReviewCleanCheckpoint,
} from "../src/p8000-closeout-review-clean-checkpoint.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";

const VALID_SOURCE_WORK_OS_FREEZE = {
  summary: {
    work_os_ui_production_freeze_status: "ready_for_work_os_ui_production_freeze_v0",
  },
};

const VALIDATION_SUMMARY = {
  schema_version: "p8000-validation-summary.v1",
  command_results: [
    {
      command_id: "command.node_test_targeted",
      command: "node --test test/p8000-closeout-review-clean-checkpoint.test.mjs",
      status: "pass",
      exit_code: 0,
      summary: "targeted P8001-P8080 regression passed",
      evidence_ref: "evidence.validation.node_test_targeted",
    },
    {
      command_id: "command.platform_work_os_check",
      command: "npm run platform:work-os-ui-production-freeze -- --check",
      status: "pass",
      exit_code: 0,
      summary: "P7801-P8000 source freeze gate passed",
      evidence_ref: "evidence.validation.platform_work_os_check",
    },
    {
      command_id: "command.review_authority_check",
      command: "npm run platform:review-authority-contract -- --check",
      status: "pass",
      exit_code: 0,
      summary: "review authority boundary gate passed",
      evidence_ref: "evidence.validation.review_authority_check",
    },
    {
      command_id: "command.review_process_check",
      command: "npm run platform:review-process-upgrade -- --check",
      status: "pass",
      exit_code: 0,
      summary: "Codex-Harness-Claude process gate passed",
      evidence_ref: "evidence.validation.review_process_check",
    },
    {
      command_id: "command.git_diff_check",
      command: "git diff --check",
      status: "pass",
      exit_code: 0,
      summary: "whitespace and patch sanity gate passed",
      evidence_ref: "evidence.validation.git_diff_check",
    },
  ],
};

const VALID_CLAUDE_RECEIPT = {
  schema_version: "p8000-claude-review-receipt.v1",
  receipt_status: "observed",
  reviewer: "claude_code_opus_max",
  model: "claude-opus-4-8",
  overall_verdict: "PASS",
  blocks_clean_checkpoint: false,
  raw_output_ref: "artifacts/p8000-closeout-review-clean-checkpoint/claude-review/raw.json",
  prompt_hash: "sha256.prompt",
  output_hash: "sha256.output",
  evidence_ref: "evidence.p8000.claude_review_receipt",
  source_mutation_performed: false,
  reviewer_final_approval_allowed: false,
  findings: [],
};

function validBuildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    sourceWorkOsFreeze: VALID_SOURCE_WORK_OS_FREEZE,
    validationSummary: VALIDATION_SUMMARY,
    claudeReviewReceipt: VALID_CLAUDE_RECEIPT,
    gitStatus: " M docs/example.md\n?? artifacts/example.json\n",
    ...overrides,
  };
}

test("P8000 closeout checkpoint is ready with source freeze, validation, Claude receipt, and clear findings", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.p8000_closeout_review_clean_checkpoint_status, "ready_for_p8000_closeout_review_clean_checkpoint");
  assert.equal(result.summary.program_range, "P8001-P8080");
  assert.equal(result.summary.source_work_os_ui_production_freeze_ready, true);
  assert.equal(result.summary.validation_summary_passed_now, true);
  assert.equal(result.summary.claude_review_receipt_observed_now, true);
  assert.equal(result.summary.finding_loop_clear_now, true);
  assert.equal(result.summary.clean_checkpoint_ready, true);
});

test("P8000 closeout checkpoint covers all P8001-P8080 phase rows", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions());
  const phaseRanges = new Set(result.p8000_closeout_phase_rows.map((row) => row.phase_range));

  assert.equal(result.p8000_closeout_phase_rows.length, 4);
  for (const phase of ["P8001-P8020", "P8021-P8040", "P8041-P8060", "P8061-P8080"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.p8000_closeout_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("P8000 closeout checkpoint keeps no-human and no-final-approval boundaries closed", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions());
  const boundary = result.p8000_closeout_boundary;

  assert.equal(boundary.human_adjudication_included, false);
  assert.equal(boundary.human_final_gate_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.codex_self_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.work_os_production_claim_enabled, false);
  assert.equal(boundary.validation_cycle_alone_trust_allowed, false);
  assert.equal(boundary.git_commit_performed_by_this_command, false);
  assert.equal(boundary.single_owner_trust_classification, "single_owner_lower_trust_claude_reviewed");
});

test("P8000 closeout checkpoint blocks when Claude review receipt is missing", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint({
    ...validBuildOptions({ claudeReviewReceipt: undefined }),
    claudeReviewReceiptPath: "artifacts/does-not-exist/claude-review-receipt.json",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.claude_review_receipt_observed_now, false);
  assert.equal(result.summary.clean_checkpoint_ready, false);
  assert.equal(result.validation.errors.some((error) => error.path === "claude.receipt"), true);
});

test("P8000 closeout checkpoint blocks unresolved P1 findings", async () => {
  const receipt = {
    ...VALID_CLAUDE_RECEIPT,
    overall_verdict: "PASS_WITH_FINDINGS",
    findings: [
      {
        finding_id: "finding.p1.review_boundary",
        severity: "P1",
        status: "open",
        summary: "A P1 finding remains unresolved.",
        affected_refs: ["src/p8000-closeout-review-clean-checkpoint.mjs"],
      },
    ],
  };
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions({ claudeReviewReceipt: receipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.finding_loop_clear_now, false);
  assert.equal(result.p8000_finding_loop_rows[0].current_verdict, "blocked");
});

test("P8000 closeout checkpoint blocks reviewer mutation or final approval claims", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions({
    claudeReviewReceipt: {
      ...VALID_CLAUDE_RECEIPT,
      source_mutation_performed: true,
      reviewer_final_approval_allowed: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.claude_review_receipt_observed_now, false);
  assert.equal(result.p8000_claude_review_receipt_rows.some((row) => row.receipt_id === "receipt.no_mutation" && row.current_verdict === "blocked"), true);
  assert.equal(result.p8000_claude_review_receipt_rows.some((row) => row.receipt_id === "receipt.no_final_approval" && row.current_verdict === "blocked"), true);
});

test("P8000 closeout checkpoint blocks missing validation command evidence", async () => {
  const partialValidationSummary = {
    ...VALIDATION_SUMMARY,
    command_results: VALIDATION_SUMMARY.command_results.filter((row) => row.command_id !== "command.git_diff_check"),
  };
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions({
    validationSummary: partialValidationSummary,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.validation_summary_passed_now, false);
  assert.equal(result.p8000_validation_command_rows.some((row) => row.command_id === "command.git_diff_check" && row.current_verdict === "blocked"), true);
});

test("P8000 closeout checkpoint blocks when source Work OS freeze is not ready", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions({
    sourceWorkOsFreeze: {
      summary: {
        work_os_ui_production_freeze_status: "blocked",
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_work_os_ui_production_freeze_ready, false);
  assert.equal(result.summary.clean_checkpoint_ready, false);
  assert.equal(result.p8000_closeout_packet_rows.some((row) => row.packet_id === "packet.source_p8000_freeze" && row.current_verdict === "blocked"), true);
});

test("P8000 closeout checkpoint negative fixtures block unsafe trust shortcuts", async () => {
  const result = await buildP8000CloseoutReviewCleanCheckpoint(validBuildOptions());
  const fixtureIds = new Set(result.p8000_closeout_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.p8000_closeout_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.codex_self_approval", "negative.claude_final_approval", "negative.human_gate_reintroduced", "negative.missing_receipt_as_pass", "negative.unresolved_finding_ignored", "negative.validation_cycle_as_trust", "negative.production_claim", "negative.single_owner_as_enterprise"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.p8000_closeout_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.p8000_closeout_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("P8000 closeout checkpoint --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "p8000-closeout-review-clean-checkpoint-"));
  const sentinelPath = path.join(outDir, "p8000-closeout-review-clean-checkpoint.json");
  const sentinel = "{ \"sentinel\": \"p8000-closeout-review-clean-checkpoint\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runP8000CloseoutReviewCleanCheckpoint(validBuildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
