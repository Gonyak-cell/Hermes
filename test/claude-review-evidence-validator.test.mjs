import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildClaudeReviewEvidenceValidator,
  runClaudeReviewEvidenceValidator,
} from "../src/claude-review-evidence-validator.mjs";

const RUN_AT = "2026-06-11T12:30:00.000Z";

const VALID_PAYLOAD = {
  verdict: "approve_no_blocking_findings",
  blocking_findings: [],
  non_blocking_findings: [
    {
      severity: "P3",
      file: "docs/factory-promotion/fb3-candidate-manifest-resolver.md",
      line: 1,
      finding: "Documentation note only.",
      suggested_fix: "None required before commit.",
    },
  ],
  changes_required_before_commit: false,
  validated_commands: ["node --test test/factory-candidate-manifest-resolver.test.mjs"],
  review_notes: ["Read-only review evidence only."],
};

const VALID_RAW_REVIEW = {
  type: "result",
  subtype: "success",
  is_error: false,
  stop_reason: "end_turn",
  session_id: "review-session",
  uuid: "review-uuid",
  result: JSON.stringify(VALID_PAYLOAD),
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
  permission_denials: [],
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    reviewId: "fb3-opus-max-review",
    programRange: "FCORE-FB.3",
    rawReview: VALID_RAW_REVIEW,
    ...extra,
  };
}

test("Claude review evidence validator accepts a valid Opus JSON review payload", async () => {
  const result = await buildClaudeReviewEvidenceValidator(options());

  assert.equal(result.schema_version, "claude-review-evidence-validation.v1");
  assert.equal(result.review_id, "fb3-opus-max-review");
  assert.equal(result.program_range, "FCORE-FB.3");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.evidence_status, "valid_review_evidence");
  assert.equal(result.summary.evidence_valid, true);
  assert.equal(result.summary.review_verdict, "approve_no_blocking_findings");
  assert.equal(result.summary.blocking_finding_count, 0);
  assert.equal(result.summary.counts_as_independent_review_evidence, true);
  assert.equal(result.summary.claude_final_approval_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Claude review evidence validator rejects 429 quota-limited raw output", async () => {
  const rawReview = {
    type: "result",
    subtype: "success",
    is_error: true,
    api_error_status: 429,
    result: "You're out of extra usage · resets 12:40am (Asia/Seoul)",
    modelUsage: {},
  };

  const result = await buildClaudeReviewEvidenceValidator(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.evidence_status, "invalid_not_review_evidence");
  assert.equal(result.summary.counts_as_independent_review_evidence, false);
  assert.ok(result.summary.invalid_reason_ids.includes("raw.wrapper_success"));
  assert.ok(result.summary.invalid_reason_ids.includes("raw.not_quota_limited"));
  assert.ok(result.summary.invalid_reason_ids.includes("payload.verdict_present"));
});

test("Claude review evidence validator rejects login or auth failures", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
  };

  const result = await buildClaudeReviewEvidenceValidator(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.summary.invalid_reason_ids.includes("raw.not_auth_failure"));
  assert.ok(result.summary.invalid_reason_ids.includes("raw.wrapper_success"));
});

test("Claude review evidence validator rejects tool-call-shaped output without verdict", async () => {
  const rawReview = {
    ...VALID_RAW_REVIEW,
    result: JSON.stringify({
      tool_calls: [
        {
          recipient_name: "functions.exec_command",
          input: { cmd: "git diff" },
        },
      ],
    }),
  };

  const result = await buildClaudeReviewEvidenceValidator(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.summary.invalid_reason_ids.includes("raw.not_tool_call_shaped"));
  assert.ok(result.summary.invalid_reason_ids.includes("payload.verdict_present"));
});

test("Claude review evidence validator rejects final approval and source mutation claims", async () => {
  const payload = {
    ...VALID_PAYLOAD,
    is_final_approval: true,
    source_mutation_performed: true,
  };
  const rawReview = {
    ...VALID_RAW_REVIEW,
    result: JSON.stringify(payload),
  };

  const result = await buildClaudeReviewEvidenceValidator(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.summary.invalid_reason_ids.includes("payload.no_final_approval"));
  assert.ok(result.summary.invalid_reason_ids.includes("payload.no_source_mutation"));
});

test("Claude review evidence validator accepts structured_output and does not treat empty as PTY loss", async () => {
  const rawReview = {
    ...VALID_RAW_REVIEW,
    result: "Review packet slot is empty_for_fe4_review before owner adjudication.",
    structured_output: {
      ...VALID_PAYLOAD,
      verdict: "APPROVE_WITH_FINDINGS",
      overall_verdict: "APPROVE_WITH_FINDINGS",
      blocking_findings: [],
      non_blocking_findings: [],
      changes_required_before_commit: false,
      is_final_approval: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      source_mutation_performed: false,
      verification_notes: [
        "The valid review says empty_for_fe4_review will not trip interrupted/PTY-loss detection.",
      ],
    },
  };

  const result = await buildClaudeReviewEvidenceValidator(options({ rawReview, programRange: "FCORE-FE.4" }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.evidence_status, "valid_review_evidence");
  assert.equal(result.summary.review_verdict, "APPROVE_WITH_FINDINGS");
  assert.equal(result.summary.blocking_finding_count, 0);
  assert.equal(result.summary.invalid_reason_ids.includes("raw.not_interrupted"), false);
});

test("Claude review evidence validator writes artifacts when requested", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "claude-review-evidence-"));
  try {
    const result = await runClaudeReviewEvidenceValidator(options({ outDir }));

    assert.equal(result.validation.valid, true);
    const written = JSON.parse(await readFile(path.join(outDir, "claude-review-evidence-validation.json"), "utf8"));
    assert.equal(written.summary.evidence_valid, true);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
