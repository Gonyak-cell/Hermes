import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformConnectorsDataGovernance,
  runPlatformConnectorsDataGovernance,
} from "../src/platform-connectors-data-governance.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformConnectorsDataGovernance({ runAt: RUN_AT, write: false });

test("Connectors data governance consumes memory event observability plane", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_connectors_data_governance_status, "ready_for_platform_connectors_data_governance");
  assert.equal(result.summary.source_memory_event_status, "ready_for_platform_memory_event_observability_plane");
  assert.equal(result.connectors_data_governance_anchor.program_range, "P2721-P2880");
  assert.equal(result.connectors_data_governance_anchor.previous_phase_slot, "P2720");
  assert.equal(result.connectors_data_governance_anchor.next_phase_slot, "P2881");
});

test("Connectors data governance emits registry, preflight, quarantine, classification, evidence span, retrieval, and block rows", async () => {
  const result = await resultPromise;

  assert.equal(result.connectors_governance_component_rows.length, 8);
  assert.equal(result.connector_registry_rows.length, 6);
  assert.equal(result.connector_preflight_rows.length, 6);
  assert.equal(result.ingestion_quarantine_rows.length, 6);
  assert.equal(result.classification_policy_rows.length, 6);
  assert.equal(result.evidence_span_rows.length, 6);
  assert.equal(result.retrieval_policy_rows.length, 5);
  assert.equal(result.connector_action_block_rows.length, 5);
  assert.equal(result.connectors_governance_handoff_rows.length, 3);
  assert.equal(result.connectors_governance_guard_rows.length, 12);
});

test("Connectors data governance keeps connectors closed and quarantined", async () => {
  const result = await resultPromise;

  assert.equal(result.connector_registry_rows.every((row) => row.connection_opened_now === false && row.ingestion_started_now === false), true);
  assert.equal(result.connector_registry_rows.every((row) => row.connector_write_allowed_now === false && row.secret_read_allowed_now === false), true);
  assert.equal(result.connector_preflight_rows.every((row) => row.preflight_required === true && row.preflight_run_now === false), true);
  assert.equal(result.ingestion_quarantine_rows.every((row) => row.quarantine_required === true && row.raw_material_released_now === false), true);
});

test("Connectors data governance requires classification, evidence spans, and retrieval-first recall", async () => {
  const result = await resultPromise;

  assert.equal(result.classification_policy_rows.every((row) => row.classification_required === true && row.classified_now === false), true);
  assert.equal(result.evidence_span_rows.every((row) => row.citation_required === true && row.raw_excerpt_allowed === false), true);
  assert.equal(result.retrieval_policy_rows.every((row) => row.retrieval_first_required === true && row.bulk_raw_export_allowed === false), true);
  assert.equal(result.connector_action_block_rows.every((row) => row.blocked_now === true && row.connector_write_allowed_now === false), true);
});

test("Connectors data governance prepares P2881 handoff without connector or production authority", async () => {
  const result = await resultPromise;
  const boundary = result.connectors_governance_boundary;

  assert.equal(boundary.connectors_governance_contract_ready, true);
  assert.equal(boundary.retrieval_first_contract_ready, true);
  assert.equal(boundary.quarantine_contract_ready, true);
  assert.equal(boundary.p2881_ready_as_next_goal, true);
  assert.equal(boundary.connector_connection_opened_now, false);
  assert.equal(boundary.preflight_run_now, false);
  assert.equal(boundary.ingestion_started_now, false);
  assert.equal(boundary.raw_export_performed_now, false);
  assert.equal(boundary.connector_write_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.cross_domain_transfer_allowed_now, false);
  assert.equal(boundary.domain_pack_install_allowed_now, false);
  assert.equal(boundary.production_ready_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Connectors data governance --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-connectors-data-governance-"));
  const sentinelPath = path.join(outDir, "platform-connectors-data-governance.json");
  const sentinel = "{ \"sentinel\": \"platform-connectors-data-governance\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformConnectorsDataGovernance({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
