import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDevelopmentControlConsole,
  runDevelopmentControlConsole,
} from "../src/development-control-console.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildDevelopmentControlConsole({ runAt: RUN_AT, write: false });

test("development control console consumes source plane and improvement signal", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.development_control_console_status, "ready_for_development_control_console_v0");
  assert.equal(result.program_range, "P4601-P5000");
  assert.equal(result.summary.source_plane_status, "ready_for_conversation_source_plane_v0");
  assert.equal(result.summary.improvement_signal_status, "ready_for_conversation_improvement_signal_freeze");
});

test("development control console covers all P4601-P5000 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.console_phase_rows.map((row) => row.phase_range));

  assert.equal(result.console_phase_rows.length, 10);
  assert.equal(phaseRanges.has("P4601-P4640"), true);
  assert.equal(phaseRanges.has("P4641-P4680"), true);
  assert.equal(phaseRanges.has("P4681-P4720"), true);
  assert.equal(phaseRanges.has("P4721-P4760"), true);
  assert.equal(phaseRanges.has("P4761-P4800"), true);
  assert.equal(phaseRanges.has("P4801-P4840"), true);
  assert.equal(phaseRanges.has("P4841-P4880"), true);
  assert.equal(phaseRanges.has("P4881-P4920"), true);
  assert.equal(phaseRanges.has("P4921-P4960"), true);
  assert.equal(phaseRanges.has("P4961-P5000"), true);
  assert.equal(result.console_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("development control console registers the full P4001-P8000 plan", async () => {
  const result = await resultPromise;

  assert.equal(result.plan_registry_rows.length, 12);
  assert.equal(result.plan_registry_rows[0].phase_range, "P4001-P4300");
  assert.equal(result.plan_registry_rows.at(-1).phase_range, "P7801-P8000");
  assert.equal(result.plan_registry_rows.every((row) => row.harness_ui_source_of_truth === true), true);
  assert.equal(result.plan_registry_rows.every((row) => row.claude_code_opus_max_review_required === true), true);
  assert.equal(result.plan_registry_rows.every((row) => row.human_adjudication_required === false), true);
});

test("development control console encodes Codex, Harness, and Claude review roles", async () => {
  const result = await resultPromise;
  const roles = new Set(result.engine_role_rows.map((row) => row.role));

  assert.equal(roles.has("PRIMARY_DEVELOPER"), true);
  assert.equal(roles.has("DETERMINISTIC_VALIDATOR"), true);
  assert.equal(roles.has("INDEPENDENT_REVIEWER"), true);
  assert.equal(result.engine_role_rows.every((row) => row.can_finally_approve === false), true);
  assert.equal(result.engine_role_rows.every((row) => row.can_claim_enterprise_trust === false), true);
});

test("development control console requires the agreed Codex-Harness-Claude review process", async () => {
  const result = await resultPromise;
  const stepIds = result.review_process_rows.map((row) => row.step_id);

  assert.deepEqual(stepIds, [
    "codex_implementation_packet",
    "harness_deterministic_validation",
    "claude_code_opus_max_independent_review",
    "finding_loop_and_revalidation",
    "review_receipt_registration",
    "single_owner_trust_classification",
  ]);
  assert.equal(result.review_process_rows.every((row) => row.receipt_required === true), true);
  assert.equal(result.review_process_rows.every((row) => row.human_adjudication_required === false), true);
  assert.equal(result.review_process_rows.every((row) => row.protected_closeout_enabled === false), true);
});

test("development control console adds Claude review gates for each major milestone", async () => {
  const result = await resultPromise;
  const milestoneRanges = new Set(result.milestone_review_gate_rows.map((row) => row.milestone_range));

  assert.equal(result.milestone_review_gate_rows.length, 10);
  for (const milestone of ["P5000", "P5400", "P5800", "P6200", "P6600", "P7000", "P7300", "P7600", "P7800", "P8000"]) {
    assert.equal(milestoneRanges.has(milestone), true);
  }
  assert.equal(result.milestone_review_gate_rows.every((row) => row.codex_implementation_packet_required === true), true);
  assert.equal(result.milestone_review_gate_rows.every((row) => row.harness_validation_required === true), true);
  assert.equal(result.milestone_review_gate_rows.every((row) => row.claude_review_receipt_required === true), true);
  assert.equal(result.milestone_review_gate_rows.every((row) => row.human_adjudication_required === false), true);
  assert.equal(result.milestone_review_gate_rows.every((row) => row.enterprise_trust_claim_allowed === false), true);
});

test("development control console shows lower-trust classification and blocks enterprise trust", async () => {
  const result = await resultPromise;
  const lowerTrust = result.trust_classification_rows.find((row) => row.trust_tier_id === "trust.single_owner_claude_reviewed_lower_trust");
  const enterprise = result.trust_classification_rows.find((row) => row.trust_tier_id === "trust.enterprise_independent_review");

  assert.equal(lowerTrust.trust_status, "AVAILABLE");
  assert.equal(lowerTrust.enterprise_trust, false);
  assert.equal(enterprise.trust_status, "BLOCKED");
  assert.equal(enterprise.claim_allowed, false);
  assert.equal(result.summary.enterprise_trust_claim_enabled, false);
});

test("development control console remains no-human, no-execution, no-write, and no-Work-OS-claim", async () => {
  const result = await resultPromise;
  const boundary = result.development_control_console_boundary;

  assert.equal(boundary.development_control_console_ready, true);
  assert.equal(boundary.harness_ui_source_of_truth, true);
  assert.equal(boundary.chat_system_of_record_allowed, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.protected_final_decision_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.single_owner_claude_reviewed_mode, true);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("development control console --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "development-control-console-"));
  const sentinelPath = path.join(outDir, "development-control-console.json");
  const sentinel = "{ \"sentinel\": \"development-control-console\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runDevelopmentControlConsole({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
