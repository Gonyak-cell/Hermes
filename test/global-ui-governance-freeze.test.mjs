import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGlobalUiGovernanceFreeze,
  runGlobalUiGovernanceFreeze,
} from "../src/global-ui-governance-freeze.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P11600_READY = {
  schema_version: "global-ui-operator-queue.v1",
  program_range: "P11401-P11600",
  design_system_range: "P10801-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_operator_queue_status: "ready_for_global_ui_operator_queue",
    ready_for_p11601_handoff: true,
    write_control_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  },
};

const CLAUDE_RECEIPT_READY = {
  schema_version: "global-ui-governance-freeze.claude-review-receipt.v1",
  receipt_status: "observed",
  model_id: "claude-opus-4-8",
  effort: "max",
  raw_json_ref: "artifacts/global-ui-governance-freeze/latest/claude-review.raw.json",
  durable_raw_json_present_now: true,
  reviewed_file_refs: [
    "docs/hermes-roadmap-p11601-p11800.md",
    "src/global-ui-governance-freeze.mjs",
    "scripts/global-ui-governance-freeze.mjs",
    "schemas/global-ui-governance-freeze.schema.json",
    "test/global-ui-governance-freeze.test.mjs",
    "package.json",
    "docs/architecture.md",
  ],
  summary_only_review: false,
  self_attestation_only: false,
  reviewer_mutation_allowed: false,
  reviewer_final_approval_allowed: false,
  finding_loop_clear_now: true,
  unresolved_p0_p1_count: 0,
};

const CLAUDE_RECEIPT_BLOCKED = {
  schema_version: "global-ui-governance-freeze.claude-review-receipt.v1",
  receipt_status: "blocked",
  model_id: "claude-opus-4-8",
  effort: "max",
  raw_json_ref: "artifacts/global-ui-governance-freeze/latest/claude-review.raw.json",
  durable_raw_json_present_now: true,
  reviewed_file_refs: [],
  summary_only_review: true,
  self_attestation_only: true,
  reviewer_mutation_allowed: false,
  reviewer_final_approval_allowed: false,
  finding_loop_clear_now: false,
  unresolved_p0_p1_count: 999,
  block_reason: "summary_only_review_rejected_by_claude",
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    globalUiOperatorQueue: P11600_READY,
    claudeReviewReceipt: CLAUDE_RECEIPT_READY,
    ...overrides,
  };
}

test("Global UI governance freeze consumes P11600 source and requires Claude review evidence", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "global-ui-governance-freeze.v1");
  assert.equal(result.program_range, "P11601-P11800");
  assert.equal(result.source_program_range, "P11401-P11600");
  assert.equal(result.summary.global_ui_governance_freeze_status, "ready_for_global_ui_governance_freeze");
  assert.equal(result.summary.claude_review_receipt_observed_now, true);
  assert.equal(result.summary.claude_finding_loop_clear_now, true);
  assert.equal(result.summary.p11800_design_system_freeze_ready, true);
  assert.equal(result.summary.ready_for_p11801_handoff, true);
});

test("Global UI governance freeze covers every phase row through P11800", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());
  const phases = new Set(result.global_ui_governance_freeze_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P11601-P11620", "P11621-P11640", "P11641-P11660", "P11661-P11680", "P11681-P11700", "P11701-P11720", "P11721-P11740", "P11741-P11760", "P11761-P11780", "P11781-P11800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.global_ui_governance_freeze_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Global UI governance freeze defines negative visual accessibility smoke and copy fixtures", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());

  assert.equal(result.negative_ui_fixture_rows.length, 10);
  assert.equal(result.visual_regression_fixture_rows.length, 8);
  assert.equal(result.accessibility_regression_rows.length, 8);
  assert.equal(result.read_only_governance_smoke_rows.length, 8);
  assert.equal(result.boundary_copy_audit_rows.length, 8);
  assert.equal(result.negative_ui_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_claim_allowed === false), true);
  assert.equal(result.read_only_governance_smoke_rows.every((row) => row.methods_allowed.includes("GET") && row.methods_allowed.includes("HEAD") && row.mutates_state === false), true);
  assert.equal(result.boundary_copy_audit_rows.every((row) => row.forbidden_copy === true && row.allowed_in_ui === false), true);
});

test("Global UI governance freeze treats Claude review as evidence only", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());

  assert.equal(result.claude_review_packet_rows.length, 10);
  assert.equal(result.claude_review_packet_rows.every((row) => row.receipt_observed_now === true), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.durable_raw_json_present_now === true), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.actual_file_refs_observed_now === true), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.summary_only_review === false), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.self_attestation_only === false), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.reviewer_mutation_allowed === false), true);
  assert.equal(result.claude_review_packet_rows.every((row) => row.reviewer_final_approval_allowed === false), true);
});

test("Global UI governance freeze blocks unresolved Claude P0/P1 findings", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options({
    claudeReviewReceipt: {
      ...CLAUDE_RECEIPT_READY,
      finding_loop_clear_now: false,
      unresolved_p0_p1_count: 1,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.global_ui_governance_freeze_status, "blocked_global_ui_governance_freeze");
  assert.equal(result.global_ui_governance_freeze_boundary.unresolved_p0_p1_count, 1);
  assert.equal(result.global_ui_governance_freeze_boundary.p11800_design_system_freeze_ready, false);
});

test("Global UI governance freeze keeps missing Claude receipt as visible BLOCK", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options({ claudeReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.global_ui_governance_freeze_status, "blocked_global_ui_governance_freeze");
  assert.equal(result.summary.claude_review_block_visible_now, true);
  assert.equal(result.summary.claude_review_capture_blocked_now, true);
  assert.equal(result.global_ui_governance_freeze_boundary.claude_review_receipt_observed_now, false);
  assert.equal(result.global_ui_governance_freeze_boundary.ready_for_p11801_handoff, false);
});

test("Global UI governance freeze blocks reviewer mutation or final approval expansion", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options({
    claudeReviewReceipt: {
      ...CLAUDE_RECEIPT_READY,
      reviewer_mutation_allowed: true,
      reviewer_final_approval_allowed: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.claude_review_packet_rows.every((row) => row.current_verdict === "blocked"), true);
});

test("Global UI governance freeze keeps explicit Claude review capture BLOCK without handoff", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options({ claudeReviewReceipt: CLAUDE_RECEIPT_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.global_ui_governance_freeze_status, "blocked_global_ui_governance_freeze");
  assert.equal(result.global_ui_governance_freeze_boundary.claude_review_block_visible_now, true);
  assert.equal(result.global_ui_governance_freeze_boundary.claude_review_capture_blocked_now, true);
  assert.equal(result.global_ui_governance_freeze_boundary.ready_for_p11801_handoff, false);
});

test("Global UI governance freeze blocks summary-only or uncited Claude review receipts from readiness", async () => {
  const summaryOnlyResult = await buildGlobalUiGovernanceFreeze(options({
    claudeReviewReceipt: {
      ...CLAUDE_RECEIPT_READY,
      summary_only_review: true,
      self_attestation_only: true,
    },
  }));
  const missingRefsResult = await buildGlobalUiGovernanceFreeze(options({
    claudeReviewReceipt: {
      ...CLAUDE_RECEIPT_READY,
      reviewed_file_refs: ["src/global-ui-governance-freeze.mjs"],
    },
  }));

  assert.equal(summaryOnlyResult.validation.valid, true);
  assert.equal(summaryOnlyResult.summary.global_ui_governance_freeze_status, "blocked_global_ui_governance_freeze");
  assert.equal(summaryOnlyResult.claude_review_packet_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(missingRefsResult.validation.valid, true);
  assert.equal(missingRefsResult.summary.global_ui_governance_freeze_status, "blocked_global_ui_governance_freeze");
  assert.equal(missingRefsResult.claude_review_packet_rows.every((row) => row.actual_file_refs_observed_now === false), true);
});

test("Global UI governance freeze boundary keeps protected capabilities closed", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());
  const boundary = result.global_ui_governance_freeze_boundary;

  assert.equal(result.p11800_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.full_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.form_button_execution_enabled, false);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_ui_enabled, false);
  assert.equal(boundary.enterprise_pass_ui_enabled, false);
  assert.equal(boundary.domain_pack_product_identity_enabled, false);
  assert.equal(boundary.kpi_dashboard_home_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Global UI governance freeze HTML is read-only and does not expose unsafe controls", async () => {
  const result = await buildGlobalUiGovernanceFreeze(options());

  assert.equal(/<form|<button|type="submit"|apply now|merge now|delete now|send now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Global UI governance freeze --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "global-ui-governance-freeze-"));
  const sentinelPath = path.join(outDir, "global-ui-governance-freeze.json");
  const sentinel = "{ \"sentinel\": \"global-ui-governance-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runGlobalUiGovernanceFreeze(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
