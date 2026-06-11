import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryF0ReviewRequestDoctor,
  runFactoryF0ReviewRequestDoctor,
} from "../src/factory-f0-review-request-doctor.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";

const VALID_INDEX = {
  schema_version: "factory-f0-review-request-index.v1",
  status: "request_packets_only_not_review_evidence",
  generated_at: "2026-06-11T17:12:36+09:00",
  requests: [
    {
      scope_id: "connector_external_app_governance",
      prompt_path: "docs/factory-promotion/f0-review-requests/connector-external-app-governance-opus-review-request.md",
      prompt_sha256: "connector-hash",
      required_receipt_path: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
      required_validator_command: "npm run platform:connector-external-app-governance -- --check",
    },
    {
      scope_id: "execution_write_authority_maturity",
      prompt_path: "docs/factory-promotion/f0-review-requests/execution-write-authority-maturity-opus-review-request.md",
      prompt_sha256: "execution-hash",
      required_receipt_path: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
      required_validator_command: "npm run platform:execution-write-authority-maturity -- --check",
    },
  ],
  is_review_evidence: false,
  is_validation_substrate: false,
};

const CONNECTOR_PROMPT = [
  "This is a read-only review.",
  "Do not edit files, create commits, apply patches.",
  "reviewed_commit_sha prompt_sha256 raw_output_sha256 engine_resolved_model_id unresolved_finding_count",
  "If you find any unresolved issue, do not imply approval.",
  "production_pass_enabled enterprise_pass_enabled",
].join("\n");

const EXECUTION_PROMPT = [
  "This is a read-only review.",
  "Do not edit files, create commits, apply patches.",
  "reviewed_commit_sha prompt_sha256 raw_output_sha256 engine_resolved_model_id unresolved_finding_count",
  "If you find any unresolved issue, do not imply approval.",
  "production_pass_enabled enterprise_pass_enabled",
].join("\n");

async function options(overrides = {}) {
  const index = structuredClone(VALID_INDEX);
  index.requests[0].prompt_sha256 = createHash("sha256").update(CONNECTOR_PROMPT).digest("hex");
  index.requests[1].prompt_sha256 = createHash("sha256").update(EXECUTION_PROMPT).digest("hex");
  return {
    runAt: RUN_AT,
    write: false,
    requestIndex: index,
    promptTexts: {
      connector_external_app_governance: CONNECTOR_PROMPT,
      execution_write_authority_maturity: EXECUTION_PROMPT,
    },
    ...overrides,
  };
}

test("Factory F0 Review Request Doctor passes a drift-free request index", async () => {
  const result = await buildFactoryF0ReviewRequestDoctor(await options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-f0-review-request-doctor.v1");
  assert.equal(result.summary.factory_f0_review_request_doctor_status, "ready_f0_review_request_doctor");
  assert.equal(result.summary.f0_review_request_doctor_passed, true);
  assert.equal(result.summary.request_pass_count, 2);
  assert.equal(result.summary.request_packets_are_review_evidence, false);
  assert.equal(result.summary.request_packets_are_validation_substrate, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory F0 Review Request Doctor catches prompt hash drift", async () => {
  const base = await options();
  base.requestIndex.requests[0].prompt_sha256 = "0".repeat(64);
  const result = await buildFactoryF0ReviewRequestDoctor(base);

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.f0_review_request_doctor_passed, false);
  assert.equal(result.summary.factory_f0_review_request_doctor_status, "blocked_f0_review_request_doctor");
  assert.equal(result.review_request_rows.find((row) => row.row_id === "connector_external_app_governance.prompt_sha256").current_verdict, "blocked");
});

test("Factory F0 Review Request Doctor rejects unsafe evidence flags", async () => {
  const base = await options();
  base.requestIndex.is_review_evidence = true;
  const result = await buildFactoryF0ReviewRequestDoctor(base);

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.f0_review_request_doctor_passed, false);
  assert.equal(result.factory_f0_review_request_doctor_validation_items.some((item) => item.item_id === "not.evidence" && item.current_verdict === "fail"), true);
});

test("Factory F0 Review Request Doctor catches receipt path drift", async () => {
  const base = await options();
  base.requestIndex.requests[1].required_receipt_path = "artifacts/unsafe/review.json";
  const result = await buildFactoryF0ReviewRequestDoctor(base);

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.f0_review_request_doctor_passed, false);
  assert.equal(result.review_request_rows.find((row) => row.row_id === "execution_write_authority_maturity.receipt_path").current_verdict, "blocked");
});

test("Factory F0 Review Request Doctor --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-f0-review-request-doctor-"));
  const sentinelPath = path.join(outDir, "factory-f0-review-request-doctor.json");
  const sentinel = "{ \"sentinel\": \"factory-f0-review-request-doctor\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryF0ReviewRequestDoctor({ ...(await options()), outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory F0 Review Request Doctor --require-pass rejects drift", async () => {
  const base = await options();
  base.requestIndex.requests[0].prompt_sha256 = "0".repeat(64);
  await assert.rejects(
    () => runFactoryF0ReviewRequestDoctor({ ...base, requirePass: true }),
    /did not pass/,
  );
});
