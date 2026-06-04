import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformMemoryEventObservabilityPlane,
  runPlatformMemoryEventObservabilityPlane,
} from "../src/platform-memory-event-observability-plane.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformMemoryEventObservabilityPlane({ runAt: RUN_AT, write: false });

test("Memory event observability plane consumes controlled write console v2", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_memory_event_observability_plane_status, "ready_for_platform_memory_event_observability_plane");
  assert.equal(result.summary.source_controlled_write_status, "ready_for_platform_controlled_write_operator_console_v2");
  assert.equal(result.memory_event_observability_anchor.program_range, "P2561-P2720");
  assert.equal(result.memory_event_observability_anchor.previous_phase_slot, "P2560");
  assert.equal(result.memory_event_observability_anchor.next_phase_slot, "P2721");
});

test("Memory event observability plane emits event, object, observability, memory, retention, recall, and handoff rows", async () => {
  const result = await resultPromise;

  assert.equal(result.memory_event_component_rows.length, 8);
  assert.equal(result.append_only_event_store_rows.length, 7);
  assert.equal(result.object_store_artifact_rows.length, 6);
  assert.equal(result.observability_signal_rows.length, 6);
  assert.equal(result.memory_operation_rows.length, 8);
  assert.equal(result.retention_backup_restore_rows.length, 5);
  assert.equal(result.grounded_recall_guard_rows.length, 6);
  assert.equal(result.memory_event_handoff_rows.length, 3);
  assert.equal(result.memory_event_guard_rows.length, 12);
});

test("Memory event observability plane keeps storage and event operations closed", async () => {
  const result = await resultPromise;

  assert.equal(result.append_only_event_store_rows.every((row) => row.append_only_required === true && row.event_written_now === false), true);
  assert.equal(result.append_only_event_store_rows.every((row) => row.in_place_update_allowed === false && row.delete_allowed_without_retention_gate === false), true);
  assert.equal(result.object_store_artifact_rows.every((row) => row.object_written_now === false && row.raw_material_allowed === false), true);
  assert.equal(result.observability_signal_rows.every((row) => row.collection_started_now === false && row.raw_value_allowed === false), true);
});

test("Memory event observability plane requires grounded recall and domain boundaries", async () => {
  const result = await resultPromise;

  assert.equal(result.memory_operation_rows.every((row) => row.grounded_evidence_required === true && row.citation_required === true), true);
  assert.equal(result.memory_operation_rows.every((row) => row.domain_boundary_required === true && row.ungrounded_recall_allowed === false), true);
  assert.equal(result.grounded_recall_guard_rows.every((row) => row.source_status_required === true && row.next_condition_required === true), true);
  assert.equal(result.grounded_recall_guard_rows.every((row) => row.recall_performed_now === false && row.ungrounded_recall_allowed === false), true);
});

test("Memory event observability plane prepares P2721 handoff without connector or production authority", async () => {
  const result = await resultPromise;
  const boundary = result.memory_event_boundary;

  assert.equal(boundary.memory_event_plane_contract_ready, true);
  assert.equal(boundary.append_only_event_contract_ready, true);
  assert.equal(boundary.grounded_recall_contract_ready, true);
  assert.equal(boundary.p2721_ready_as_next_goal, true);
  assert.equal(boundary.event_written_now, false);
  assert.equal(boundary.object_written_now, false);
  assert.equal(boundary.memory_mutation_performed_now, false);
  assert.equal(boundary.event_store_started, false);
  assert.equal(boundary.storage_service_started, false);
  assert.equal(boundary.connector_ingestion_allowed_now, false);
  assert.equal(boundary.connector_write_allowed_now, false);
  assert.equal(boundary.raw_material_access_allowed_now, false);
  assert.equal(boundary.production_ready_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Memory event observability plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-memory-event-observability-plane-"));
  const sentinelPath = path.join(outDir, "platform-memory-event-observability-plane.json");
  const sentinel = "{ \"sentinel\": \"platform-memory-event-observability-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformMemoryEventObservabilityPlane({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
