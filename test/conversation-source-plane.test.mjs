import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildConversationSourcePlane,
  runConversationSourcePlane,
} from "../src/conversation-source-plane.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildConversationSourcePlane({ runAt: RUN_AT, write: false });

test("conversation source plane closes P4001-P4300 source contract", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.conversation_source_plane_status, "ready_for_conversation_source_plane_v0");
  assert.equal(result.program_range, "P4001-P4300");
  assert.equal(result.conversation_source_contract.raw_transcript_is_source_material, true);
  assert.equal(result.conversation_source_contract.summary_is_claim, true);
  assert.equal(result.conversation_source_contract.plan_change_is_reviewed_candidate, true);
  assert.equal(result.conversation_source_contract.harness_ui_status_is_source_of_truth, true);
});

test("conversation source plane covers all P4001-P4300 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.conversation_source_phase_rows.map((row) => row.phase_range));

  assert.equal(result.conversation_source_phase_rows.length, 8);
  assert.equal(phaseRanges.has("P4001-P4040"), true);
  assert.equal(phaseRanges.has("P4041-P4080"), true);
  assert.equal(phaseRanges.has("P4081-P4120"), true);
  assert.equal(phaseRanges.has("P4121-P4160"), true);
  assert.equal(phaseRanges.has("P4161-P4200"), true);
  assert.equal(phaseRanges.has("P4201-P4240"), true);
  assert.equal(phaseRanges.has("P4241-P4280"), true);
  assert.equal(phaseRanges.has("P4281-P4300"), true);
  assert.equal(result.conversation_source_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("conversation source plane separates Codex and Claude authority", async () => {
  const result = await resultPromise;
  const engines = new Set(result.conversation_source_rows.map((row) => row.engine));

  assert.equal(engines.has("Codex"), true);
  assert.equal(engines.has("Claude Code"), true);
  assert.equal(result.adapter_lineage_rows.every((row) => row.mutation_allowed === false), true);
  assert.equal(result.adapter_lineage_rows.every((row) => row.approval_allowed === false), true);
  assert.equal(result.adapter_lineage_rows.every((row) => row.final_pass_allowed === false), true);
});

test("conversation source plane keeps claims, plan changes, and context cited but not truth", async () => {
  const result = await resultPromise;

  assert.equal(result.extracted_claim_rows.every((row) => row.source_citation_required === true), true);
  assert.equal(result.extracted_claim_rows.every((row) => row.harness_truth_allowed_now === false), true);
  assert.equal(result.extracted_claim_rows.every((row) => row.adopted_as_truth === false), true);
  assert.equal(result.plan_candidate_rows.every((row) => row.adopted === false), true);
  assert.equal(result.plan_candidate_rows.every((row) => row.adopted_without_review === false), true);
  assert.equal(result.context_recovery_bundle_rows.every((row) => row.citation_missing === false), true);
  assert.equal(result.context_recovery_bundle_rows.every((row) => row.context_status === "READY_FOR_NEXT_SESSION"), true);
});

test("conversation source plane makes Conversation Source Queue the first read-only UI surface", async () => {
  const result = await resultPromise;
  const components = new Set(result.transcript_ui_component_rows.map((row) => row.component_name));
  const forbiddenCopy = new Set(result.ui_copy_rule_rows.filter((row) => row.forbidden).map((row) => row.copy_text));

  assert.equal(result.summary.first_surface, "Conversation Source Queue");
  assert.equal(result.conversation_source_queue_rows.every((row) => row.queue_first === true), true);
  assert.equal(result.conversation_source_queue_rows.every((row) => row.kpi_home_surface === false), true);
  assert.equal(result.transcript_ui_component_rows.length, 12);
  assert.equal(components.has("ConversationSourceRow"), true);
  assert.equal(components.has("NoSourceNoClaimNotice"), true);
  assert.equal(forbiddenCopy.has("AI confidence score"), true);
  assert.equal(forbiddenCopy.has("context health score"), true);
});

test("conversation source plane remains no-execution, no-write, and no-Work-OS-claim", async () => {
  const result = await resultPromise;
  const boundary = result.conversation_source_boundary;

  assert.equal(boundary.conversation_source_plane_ready, true);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.receipt_application_enabled, false);
  assert.equal(boundary.raw_transcript_body_default_visible, false);
  assert.equal(boundary.raw_secret_material_allowed, false);
  assert.equal(boundary.raw_client_material_allowed, false);
  assert.equal(boundary.agent_final_pass_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.kpi_home_surface_allowed, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("conversation source plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "conversation-source-plane-"));
  const sentinelPath = path.join(outDir, "conversation-source-plane.json");
  const sentinel = "{ \"sentinel\": \"conversation-source-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runConversationSourcePlane({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
