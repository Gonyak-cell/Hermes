import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildMemoryBankEventObservabilityPlane,
  runMemoryBankEventObservabilityPlane,
} from "../src/memory-bank-event-observability-plane.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildMemoryBankEventObservabilityPlane({ runAt: RUN_AT, write: false });

test("memory bank event observability consumes P7000 controlled execution", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.memory_bank_event_observability_plane_status, "ready_for_memory_bank_event_observability_plane_v0");
  assert.equal(result.program_range, "P7001-P7300");
  assert.equal(result.summary.controlled_execution_write_deploy_status, "ready_for_controlled_execution_write_deploy_v0");
});

test("memory bank event observability covers all P7001-P7300 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.memory_bank_event_observability_phase_rows.map((row) => row.phase_range));

  assert.equal(result.memory_bank_event_observability_phase_rows.length, 10);
  for (const phase of ["P7001-P7030", "P7031-P7060", "P7061-P7090", "P7091-P7120", "P7121-P7150", "P7151-P7180", "P7181-P7210", "P7211-P7240", "P7241-P7270", "P7271-P7300"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.memory_bank_event_observability_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("memory bank event observability makes events append-only", async () => {
  const result = await resultPromise;

  assert.equal(result.append_only_event_store_rows.length, 8);
  assert.equal(result.append_only_event_store_rows.every((row) => row.append_only_required), true);
  assert.equal(result.append_only_event_store_rows.every((row) => row.event_id_required), true);
  assert.equal(result.append_only_event_store_rows.every((row) => row.source_ref_required), true);
  assert.equal(result.append_only_event_store_rows.every((row) => row.immutable_after_write), true);
  assert.equal(result.append_only_event_store_rows.every((row) => row.mutation_allowed === false), true);
});

test("memory bank event observability stores object references without raw bodies by default", async () => {
  const result = await resultPromise;

  assert.equal(result.object_artifact_reference_rows.length, 6);
  assert.equal(result.object_artifact_reference_rows.every((row) => row.object_id_required), true);
  assert.equal(result.object_artifact_reference_rows.every((row) => row.hash_required), true);
  assert.equal(result.object_artifact_reference_rows.every((row) => row.raw_body_embedded_by_default === false), true);
  assert.equal(result.object_artifact_reference_rows.every((row) => row.redaction_status_required), true);
});

test("memory bank event observability binds Codex and Claude transcript sources without default raw access", async () => {
  const result = await resultPromise;
  const transcriptIds = new Set(result.transcript_source_event_binding_rows.map((row) => row.transcript_source_id));

  assert.equal(result.transcript_source_event_binding_rows.length, 2);
  assert.equal(transcriptIds.has("transcript.codex"), true);
  assert.equal(transcriptIds.has("transcript.claude_code"), true);
  assert.equal(result.transcript_source_event_binding_rows.every((row) => row.local_archive_required), true);
  assert.equal(result.transcript_source_event_binding_rows.every((row) => row.redaction_required), true);
  assert.equal(result.transcript_source_event_binding_rows.every((row) => row.raw_transcript_default_access_enabled === false), true);
});

test("memory bank event observability binds Claude review receipts as events without approval authority", async () => {
  const result = await resultPromise;
  const row = result.review_receipt_event_binding_rows[0];

  assert.equal(row.receipt_type, "claude_code_opus_max_review");
  assert.equal(row.receipt_event_required, true);
  assert.equal(row.durable_raw_json_object_ref_required, true);
  assert.equal(row.normalized_findings_required, true);
  assert.equal(row.reviewer_mutation_allowed, false);
  assert.equal(row.final_approval_allowed, false);
});

test("memory bank event observability prepares storage index while keeping runtime recall disabled", async () => {
  const result = await resultPromise;

  assert.equal(result.memory_bank_storage_index_rows.length, 6);
  assert.equal(result.memory_bank_storage_index_rows.every((row) => row.storage_index_contract_ready), true);
  assert.equal(result.memory_bank_storage_index_rows.every((row) => row.source_citation_required), true);
  assert.equal(result.memory_bank_storage_index_rows.every((row) => row.source_status_required), true);
  assert.equal(result.memory_bank_storage_index_rows.every((row) => row.domain_boundary_required), true);
  assert.equal(result.memory_bank_storage_index_rows.every((row) => row.runtime_recall_enabled === false), true);
});

test("memory bank event observability negative fixtures block unsafe memory claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.event_observability_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.event_observability_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.mutable_event", "negative.raw_transcript_default", "negative.uncited_memory", "negative.cross_domain_leak", "negative.missing_review_receipt_event", "negative.no_trace_cost", "negative.delete_without_retention", "negative.recall_runtime_enabled"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.event_observability_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.event_observability_negative_fixture_rows.every((row) => row.unsafe_memory_claim_allowed === false), true);
});

test("memory bank event observability remains storage-only and no-Work-OS", async () => {
  const result = await resultPromise;
  const boundary = result.memory_bank_event_observability_boundary;

  assert.equal(boundary.memory_bank_event_observability_plane_ready, true);
  assert.equal(boundary.append_only_event_store_ready, true);
  assert.equal(boundary.object_artifact_reference_store_ready, true);
  assert.equal(boundary.transcript_source_event_binding_ready, true);
  assert.equal(boundary.review_receipt_event_binding_ready, true);
  assert.equal(boundary.gate_verdict_event_ledger_ready, true);
  assert.equal(boundary.trace_audit_cost_observability_ready, true);
  assert.equal(boundary.retention_backup_restore_ready, true);
  assert.equal(boundary.memory_bank_storage_index_ready, true);
  assert.equal(boundary.raw_transcript_default_access_enabled, false);
  assert.equal(boundary.mutable_event_update_enabled, false);
  assert.equal(boundary.runtime_recall_enabled, false);
  assert.equal(boundary.retrieval_layer_enabled, false);
  assert.equal(boundary.cross_domain_memory_leak_allowed, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("memory bank event observability --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "memory-bank-event-observability-plane-"));
  const sentinelPath = path.join(outDir, "memory-bank-event-observability-plane.json");
  const sentinel = "{ \"sentinel\": \"memory-bank-event-observability-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runMemoryBankEventObservabilityPlane({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
