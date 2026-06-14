import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildConversationCaptureContract,
  runConversationCaptureContract,
} from "../src/conversation-capture-contract.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P8000_CLOSEOUT_READY = {
  summary: {
    p8000_closeout_review_clean_checkpoint_status: "ready_for_p8000_closeout_review_clean_checkpoint",
  },
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    p8000Closeout: P8000_CLOSEOUT_READY,
    ...overrides,
  };
}

test("Conversation capture contract consumes the P8000 closeout checkpoint", async () => {
  const result = await buildConversationCaptureContract(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.conversation_capture_contract_status, "ready_for_conversation_capture_contract");
  assert.equal(result.program_range, "P8081-P8160");
  assert.equal(result.summary.source_p8000_closeout_ready, true);
});

test("Conversation capture contract covers P8081-P8160 phase rows", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const phaseRanges = new Set(result.conversation_capture_phase_rows.map((row) => row.phase_range));

  assert.equal(result.conversation_capture_phase_rows.length, 4);
  for (const phase of ["P8081-P8100", "P8101-P8120", "P8121-P8140", "P8141-P8160"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.conversation_capture_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Conversation capture contract registers Codex and Claude session identity", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const engines = new Set(result.engine_session_rows.map((row) => row.engine_name));

  assert.equal(engines.has("Codex"), true);
  assert.equal(engines.has("Claude Code"), true);
  assert.equal(result.engine_session_rows.every((row) => row.engine_id && row.session_id), true);
  assert.equal(result.engine_session_rows.every((row) => row.final_approval_allowed === false), true);
});

test("Conversation capture contract separates raw full and redacted transcript exposure", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const tierMap = new Map(result.raw_full_redacted_boundary_rows.map((row) => [row.tier_id, row]));

  assert.equal(tierMap.get("tier.raw").ui_visible, false);
  assert.equal(tierMap.get("tier.full").ui_visible, false);
  assert.equal(tierMap.get("tier.redacted").ui_visible, true);
  assert.equal(result.transcript_reference_rows.every((row) => row.raw_body_ui_visible === false), true);
  assert.equal(result.transcript_reference_rows.every((row) => row.full_body_ui_visible === false), true);
  assert.equal(result.transcript_reference_rows.every((row) => row.redacted_summary_ui_visible === true), true);
});

test("Conversation capture contract extracts goal phase blocker decision and validation item", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const extractionTypes = new Set(result.plan_extraction_contract_rows.map((row) => row.extraction_type));

  for (const type of ["goal", "phase", "blocker", "decision", "validation_item"]) {
    assert.equal(extractionTypes.has(type), true);
  }
  assert.equal(result.plan_extraction_contract_rows.every((row) => row.source_citation_required === true), true);
  assert.equal(result.plan_extraction_contract_rows.every((row) => row.source_citation_present === true), true);
  assert.equal(result.plan_extraction_contract_rows.every((row) => row.adopted_as_truth === false), true);
});

test("Conversation capture contract negative fixtures block missing duplicate uncited and authority pollution", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const fixtureIds = new Set(result.conversation_capture_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_transcript_ref", "negative.duplicate_session_event", "negative.uncited_memory_recall", "negative.authority_contamination"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.conversation_capture_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.conversation_capture_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Conversation capture contract keeps no-human production and enterprise boundaries closed", async () => {
  const result = await buildConversationCaptureContract(buildOptions());
  const boundary = result.conversation_capture_boundary;

  assert.equal(boundary.conversation_capture_contract_ready, true);
  assert.equal(boundary.human_gate_in_scope, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Conversation capture contract blocks if source P8000 closeout is not ready", async () => {
  const result = await buildConversationCaptureContract(buildOptions({
    p8000Closeout: {
      summary: {
        p8000_closeout_review_clean_checkpoint_status: "blocked",
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p8000_closeout_ready, false);
  assert.equal(result.summary.conversation_capture_contract_status, "blocked");
});

test("Conversation capture contract --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "conversation-capture-contract-"));
  const sentinelPath = path.join(outDir, "conversation-capture-contract.json");
  const sentinel = "{ \"sentinel\": \"conversation-capture-contract\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runConversationCaptureContract(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
