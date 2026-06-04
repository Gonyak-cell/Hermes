import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformVerificationTrustActivation,
  runPlatformVerificationTrustActivation,
} from "../src/platform-verification-trust-activation.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformVerificationTrustActivation({ runAt: RUN_AT, write: false });

test("Verification trust activation consumes P3201-P3360 trust kernel", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_verification_trust_activation_status, "ready_for_platform_verification_trust_activation");
  assert.equal(result.summary.source_verification_trust_kernel_status, "ready_for_platform_verification_trust_kernel");
  assert.equal(result.verification_trust_activation_anchor.program_range, "P3361-P3520");
  assert.equal(result.verification_trust_activation_anchor.previous_phase_slot, "P3360");
  assert.equal(result.verification_trust_activation_anchor.next_phase_slot, "P3521");
});

test("Verification trust activation enables local standard validator dual-run", async () => {
  const result = await resultPromise;

  assert.equal(result.summary.standard_validator_dual_run_active_now, true);
  assert.equal(result.standard_validator_activation_rows.length, 6);
  assert.equal(result.standard_validator_activation_rows.every((row) => row.standard_validator_active_now === true), true);
  assert.equal(result.standard_validator_dual_run_schema_report.custom_validator_valid, true);
  assert.equal(result.standard_validator_dual_run_schema_report.standard_validator_valid, true);
  assert.equal(result.standard_validator_dual_run_schema_report.comparison_status, "matched_pass");
});

test("Verification trust activation matches dual-run fixtures and blocks unsupported keywords", async () => {
  const result = await resultPromise;
  const unsupported = result.dual_run_fixture_rows.find((row) => row.fixture_id === "unsupported_one_of_keyword");

  assert.equal(result.dual_run_fixture_rows.length, 8);
  assert.equal(result.dual_run_fixture_rows.every((row) => row.lanes_agree && row.expected_outcome_observed), true);
  assert.equal(result.summary.dual_run_fixture_match_count, 8);
  assert.equal(unsupported.unsupported_keyword_blocked, true);
  assert.deepEqual(unsupported.unsupported_keywords, ["oneOf"]);
});

test("Verification trust activation expands negative fixtures and provenance", async () => {
  const result = await resultPromise;

  assert.equal(result.negative_fixture_expansion_rows.length, 9);
  assert.equal(result.negative_fixture_expansion_rows.every((row) => row.expected_blocked && row.observed_blocked), true);
  assert.equal(result.summary.blocked_negative_fixture_count, 9);
  assert.equal(result.evidence_provenance_rows.length, 9);
  assert.equal(result.evidence_provenance_rows.every((row) => row.provenance_status === "hash_bound" && row.content_hash.startsWith("sha256:") && row.raw_payload_inlined === false), true);
});

test("Verification trust activation defines CI workflow but keeps branch protection and external attestation false", async () => {
  const result = await resultPromise;
  const boundary = result.verification_trust_activation_boundary;

  assert.equal(result.ci_required_check_rows.length, 6);
  assert.equal(result.ci_required_check_rows.every((row) => row.workflow_file_defined_now === true), true);
  assert.equal(boundary.ci_workflow_defined_now, true);
  assert.equal(boundary.branch_protection_configured_now, false);
  assert.equal(boundary.local_attestation_metadata_generated_now, true);
  assert.equal(boundary.external_signed_attestation_present_now, false);
});

test("Verification trust activation keeps independent review, enterprise, runtime, and write boundaries honest", async () => {
  const result = await resultPromise;
  const boundary = result.verification_trust_activation_boundary;

  assert.equal(result.independent_review_lane_rows.length, 5);
  assert.equal(result.independent_review_lane_rows.every((row) => row.review_lane_active_now && row.review_completed_now === false), true);
  assert.equal(boundary.independent_review_completed_now, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.production_ready_claimed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.p3521_ready_as_next_goal, true);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Verification trust activation --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-verification-trust-activation-"));
  const sentinelPath = path.join(outDir, "platform-verification-trust-activation.json");
  const sentinel = "{ \"sentinel\": \"platform-verification-trust-activation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformVerificationTrustActivation({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
