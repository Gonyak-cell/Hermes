import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildConversationImprovementSignal,
  runConversationImprovementSignal,
} from "../src/conversation-improvement-signal.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildConversationImprovementSignal({ runAt: RUN_AT, write: false });

test("conversation improvement signal consumes the P4300 source plane", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.conversation_improvement_signal_status, "ready_for_conversation_improvement_signal_freeze");
  assert.equal(result.program_range, "P4301-P4600");
  assert.equal(result.summary.source_plane_status, "ready_for_conversation_source_plane_v0");
  assert.equal(result.improvement_signal_contract.unreviewed_self_modification_allowed, false);
});

test("conversation improvement signal covers all P4301-P4600 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.improvement_signal_phase_rows.map((row) => row.phase_range));

  assert.equal(result.improvement_signal_phase_rows.length, 8);
  assert.equal(phaseRanges.has("P4301-P4340"), true);
  assert.equal(phaseRanges.has("P4341-P4380"), true);
  assert.equal(phaseRanges.has("P4381-P4420"), true);
  assert.equal(phaseRanges.has("P4421-P4460"), true);
  assert.equal(phaseRanges.has("P4461-P4500"), true);
  assert.equal(phaseRanges.has("P4501-P4540"), true);
  assert.equal(phaseRanges.has("P4541-P4580"), true);
  assert.equal(phaseRanges.has("P4581-P4600"), true);
  assert.equal(result.improvement_signal_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("conversation improvement signal captures all required signal types", async () => {
  const result = await resultPromise;
  const signalTypes = new Set(result.improvement_signal_rows.map((row) => row.signal_type));

  assert.equal(result.improvement_signal_rows.length, 6);
  assert.equal(signalTypes.has("USER_CORRECTION"), true);
  assert.equal(signalTypes.has("ASSISTANT_MISS"), true);
  assert.equal(signalTypes.has("REVIEW_CONFLICT"), true);
  assert.equal(signalTypes.has("BLOCKED_COMMAND"), true);
  assert.equal(signalTypes.has("FAILED_VALIDATION"), true);
  assert.equal(signalTypes.has("REPEATED_CONTEXT_LOSS"), true);
  assert.equal(result.improvement_signal_rows.every((row) => row.source_turn_ref), true);
  assert.equal(result.improvement_signal_rows.every((row) => row.source_citation_ref), true);
});

test("conversation improvement signal classifies user corrections and assistant misses", async () => {
  const result = await resultPromise;

  assert.equal(result.user_correction_classifier_rows.length, 1);
  assert.equal(result.user_correction_classifier_rows.every((row) => row.changes_next_execution_condition === true), true);
  assert.equal(result.user_correction_classifier_rows.every((row) => row.adoption_allowed_without_review === false), true);
  assert.equal(result.assistant_miss_classifier_rows.length, 3);
  assert.equal(result.assistant_miss_classifier_rows.every((row) => row.root_cause), true);
  assert.equal(result.assistant_miss_classifier_rows.every((row) => row.correction_required === true), true);
});

test("conversation improvement signal creates reviewable plan and hook candidates", async () => {
  const result = await resultPromise;

  assert.equal(result.plan_amendment_candidate_rows.length, 6);
  assert.equal(result.plan_amendment_candidate_rows.every((row) => row.reviewer_ref), true);
  assert.equal(result.plan_amendment_candidate_rows.every((row) => row.adopted === false), true);
  assert.equal(result.plan_amendment_candidate_rows.every((row) => row.adopted_without_review === false), true);
  assert.equal(result.soft_rule_promotion_rows.length, 6);
  assert.equal(result.soft_rule_promotion_rows.every((row) => row.hook_candidate_ref), true);
  assert.equal(result.soft_rule_promotion_rows.every((row) => row.hard_hook_enforced_now === false), true);
});

test("conversation improvement signal prepares review packets without self-modification", async () => {
  const result = await resultPromise;

  assert.equal(result.self_improvement_review_packet_rows.length, 6);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.review_packet_status === "READY_FOR_CLAUDE_REVIEW"), true);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.claude_code_opus_max_review_required === true), true);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.human_adjudication_required === false), true);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.self_modification_allowed_now === false), true);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.policy_rewrite_applied_now === false), true);
  assert.equal(result.self_improvement_review_packet_rows.every((row) => row.plan_adoption_applied_now === false), true);
});

test("conversation improvement signal keeps next-condition injection review-pending", async () => {
  const result = await resultPromise;

  assert.equal(result.next_session_context_injection_rows.length, 6);
  assert.equal(result.next_session_context_injection_rows.every((row) => row.review_required_before_injection === true), true);
  assert.equal(result.next_session_context_injection_rows.every((row) => row.claude_code_opus_max_review_required === true), true);
  assert.equal(result.next_session_context_injection_rows.every((row) => row.human_adjudication_required === false), true);
  assert.equal(result.next_session_context_injection_rows.every((row) => row.next_execution_condition_changed_now === false), true);
  assert.equal(result.next_session_context_injection_rows.every((row) => row.injected_now === false), true);
  assert.equal(result.summary.next_condition_update_applied_count, 0);
});

test("conversation improvement signal remains no-execution, no-write, and no-Work-OS-claim", async () => {
  const result = await resultPromise;
  const boundary = result.improvement_signal_boundary;

  assert.equal(boundary.conversation_improvement_signal_ready, true);
  assert.equal(boundary.source_plane_ready, true);
  assert.equal(boundary.unreviewed_self_modification_allowed, false);
  assert.equal(boundary.self_modification_applied_now, false);
  assert.equal(boundary.policy_rewrite_applied_now, false);
  assert.equal(boundary.plan_adoption_applied_now, false);
  assert.equal(boundary.hard_hook_enforced_now, false);
  assert.equal(boundary.next_condition_injected_now, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("conversation improvement signal --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "conversation-improvement-signal-"));
  const sentinelPath = path.join(outDir, "conversation-improvement-signal.json");
  const sentinel = "{ \"sentinel\": \"conversation-improvement-signal\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runConversationImprovementSignal({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
