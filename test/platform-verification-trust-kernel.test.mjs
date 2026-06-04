import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateAgainstSchema } from "../src/core-contract-validator.mjs";
import {
  buildPlatformVerificationTrustKernel,
  runPlatformVerificationTrustKernel,
} from "../src/platform-verification-trust-kernel.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformVerificationTrustKernel({ runAt: RUN_AT, write: false });

test("Verification trust kernel consumes production governance freeze", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_verification_trust_kernel_status, "ready_for_platform_verification_trust_kernel");
  assert.equal(result.summary.source_production_governance_status, "ready_for_platform_production_governance_work_os_freeze");
  assert.equal(result.verification_trust_anchor.program_range, "P3201-P3360");
  assert.equal(result.verification_trust_anchor.previous_phase_slot, "P3200");
  assert.equal(result.verification_trust_anchor.next_phase_slot, "P3361");
});

test("Verification trust kernel emits standard schema, negative fixture, provenance, ledger, coverage, and review rows", async () => {
  const result = await resultPromise;

  assert.equal(result.verification_trust_component_rows.length, 8);
  assert.equal(result.standard_schema_validator_rows.length, 6);
  assert.equal(result.negative_fixture_rows.length, 7);
  assert.equal(result.evidence_provenance_rows.length, 8);
  assert.equal(result.validation_result_ledger_rows.length, 6);
  assert.equal(result.trust_coverage_rows.length, 7);
  assert.equal(result.independent_review_rows.length, 4);
  assert.equal(result.verification_trust_guard_rows.length, 12);
});

test("Verification trust kernel blocks all negative fixtures as expected", async () => {
  const result = await resultPromise;

  assert.equal(result.negative_fixture_rows.every((row) => row.expected_blocked === true && row.observed_blocked === true), true);
  assert.equal(result.summary.blocked_negative_fixture_count, 7);
  assert.equal(result.negative_fixture_rows.some((row) => row.fixture_id === "max_items_violation" && row.detection_error_paths.includes("negative_fixture")), true);
});

test("Core schema validator now detects maxItems", () => {
  const errors = validateAgainstSchema(["one", "two"], { type: "array", maxItems: 1, items: { type: "string" } }, {}, "sample");

  assert.equal(errors.some((error) => error.message.includes("Expected at most 1")), true);
});

test("Verification trust kernel binds evidence to hashes and chains validation ledger rows", async () => {
  const result = await resultPromise;
  const ledgerRows = result.validation_result_ledger_rows;

  assert.equal(result.evidence_provenance_rows.every((row) => row.provenance_status === "hash_bound" && row.content_hash.startsWith("sha256:") && row.raw_payload_inlined === false), true);
  assert.equal(ledgerRows.every((row) => row.row_hash.startsWith("sha256:") && row.chain_hash.startsWith("sha256:")), true);
  assert.equal(ledgerRows[0].previous_hash, "sha256:GENESIS");
  for (let index = 1; index < ledgerRows.length; index += 1) {
    assert.equal(ledgerRows[index].previous_hash, ledgerRows[index - 1].chain_hash);
  }
});

test("Verification trust kernel keeps enterprise trust, CI, attestation, independent review, runtime, and write blocked", async () => {
  const result = await resultPromise;
  const boundary = result.verification_trust_boundary;

  assert.equal(boundary.p3361_ready_as_next_goal, true);
  assert.equal(boundary.standard_validator_active_now, false);
  assert.equal(boundary.ci_required_check_configured_now, false);
  assert.equal(boundary.external_attestation_present_now, false);
  assert.equal(boundary.independent_review_completed_now, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Verification trust kernel --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-verification-trust-kernel-"));
  const sentinelPath = path.join(outDir, "platform-verification-trust-kernel.json");
  const sentinel = "{ \"sentinel\": \"platform-verification-trust-kernel\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformVerificationTrustKernel({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
