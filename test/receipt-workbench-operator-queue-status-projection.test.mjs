import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  QUEUE_FALSE_FLAGS,
  SOURCE_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStatusProjection,
  runReceiptWorkbenchOperatorQueueStatusProjection,
} from "../src/receipt-workbench-operator-queue-status-projection.mjs";

const RUN_AT = "2026-06-07T19:15:15.390Z";

const PREVIEW_SURFACES = [
  "summary",
  "task",
  "evidence",
  "review",
  "blocker",
  "detail",
  "next_action",
  "status",
];

const FIXTURE_STATES = [
  "ready",
  "empty",
  "blocked",
  "error",
  "stale",
  "review_pending",
  "redacted_payload",
  "loading",
];

test("P26000 opens P26001 handoff when P25600 source is ready and queue boundaries stay closed", async () => {
  const result = await buildReceiptWorkbenchOperatorQueueStatusProjection({
    runAt: RUN_AT,
    receiptWorkbenchFixtureAcceptanceHandoff: buildP25600Source({ ready: true }),
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-status-projection.v1");
  assert.equal(result.program_range, "P25601-P26000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_status_projection_status, "ready_for_receipt_workbench_operator_queue_status_projection");
  assert.equal(result.summary.ready_for_p26001_handoff, true);
  assert.equal(result.operator_queue_item_rows.length, 8);
  assert.equal(result.queue_status_summary_rows.length, 8);
  assert.equal(result.read_only_queue_filter_rows.length, 8);
  assert.equal(result.operator_attention_guard_rows.length, 8);
  assert.equal(result.no_queue_action_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_queue_action_boundary_rows.length >= 110);
  assert.equal(result.receipt_workbench_operator_queue_status_projection_boundary.p26000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_status_projection_boundary.ready_for_p26001_handoff, true);

  for (const flag of QUEUE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_status_projection_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P26000 remains a valid visible block when P25600 source handoff is not ready", async () => {
  const result = await buildReceiptWorkbenchOperatorQueueStatusProjection({
    runAt: RUN_AT,
    receiptWorkbenchFixtureAcceptanceHandoff: buildP25600Source({ ready: false }),
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_status_projection_status, "valid_block_receipt_workbench_operator_queue_status_projection_pending");
  assert.equal(result.summary.source_p25600_ready_for_p25601_handoff, false);
  assert.equal(result.summary.ready_for_p26001_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_status_projection_boundary.p26000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_status_projection_boundary.ready_for_p26001_handoff, false);
  assert.equal(result.p26000_clean_checkpoint_rows.find((row) => row.row_id === "p26000_checkpoint.p26001_handoff_blocker_visible").current_verdict, "pass");
});

test("queue status summary covers fixture states without live fetch, action, or mutation", async () => {
  const result = await buildReceiptWorkbenchOperatorQueueStatusProjection({
    runAt: RUN_AT,
    receiptWorkbenchFixtureAcceptanceHandoff: buildP25600Source({ ready: true }),
    commitRef: "abc1234",
  });

  assert.deepEqual(result.queue_status_summary_rows.map((row) => row.fixture_state), FIXTURE_STATES);
  assert.ok(result.queue_status_summary_rows.every((row) => row.visible_now === true));
  assert.ok(result.queue_status_summary_rows.every((row) => row.live_fetch_allowed_now === false));
  assert.ok(result.queue_status_summary_rows.every((row) => row.action_enabled_now === false));
  assert.ok(result.queue_status_summary_rows.every((row) => row.mutation_enabled === false));
});

test("queue filters and attention guards are read-only and cannot approve or close out", async () => {
  const result = await buildReceiptWorkbenchOperatorQueueStatusProjection({
    runAt: RUN_AT,
    receiptWorkbenchFixtureAcceptanceHandoff: buildP25600Source({ ready: true }),
    commitRef: "abc1234",
  });

  assert.ok(result.read_only_queue_filter_rows.every((row) => row.read_only === true));
  assert.ok(result.read_only_queue_filter_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.read_only_queue_filter_rows.every((row) => row.approval_allowed_now === false));
  assert.ok(result.read_only_queue_filter_rows.every((row) => row.closeout_allowed_now === false));
  assert.ok(result.operator_attention_guard_rows.every((row) => row.action_enabled_now === false));
  assert.ok(result.operator_attention_guard_rows.every((row) => row.approval_allowed_now === false));
  assert.ok(result.operator_attention_guard_rows.every((row) => row.closeout_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_status_projection_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing projection artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p26000-"));
  try {
    const result = await runReceiptWorkbenchOperatorQueueStatusProjection({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchFixtureAcceptanceHandoff: buildP25600Source({ ready: true }),
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-status-projection.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP25600Source({ ready }) {
  const readinessRows = PREVIEW_SURFACES.map((surface, index) => sourceRow({
    row_id: `acceptance_readiness.${surface}`,
    category: "acceptance_readiness_checklist",
    label: `Acceptance readiness ${surface}`,
    evidence_ref: "acceptance_readiness_checklist_rows",
    consumer_surface_slot: surface,
    preview_surface: surface,
    required_evidence_ref: `smoke_evidence.${FIXTURE_STATES[index]}`,
    read_only: true,
    acceptance_verdict_emitted_now: false,
    final_approval_allowed_now: false,
    closeout_allowed_now: false,
    mutation_enabled: false,
  }));

  const smokeRows = FIXTURE_STATES.map((state) => sourceRow({
    row_id: `smoke_evidence.${state}`,
    category: "smoke_evidence_index",
    label: `Smoke evidence ${state}`,
    evidence_ref: "smoke_evidence_index_rows",
    fixture_state: state,
    visible_now: true,
    raw_body_returns: false,
    full_body_returns: false,
    live_fetch_allowed_now: false,
    mutation_enabled: false,
  }));

  const handoffRows = PREVIEW_SURFACES.map((surface) => sourceRow({
    row_id: `operator_handoff.${surface}`,
    category: "operator_handoff_contract",
    label: `Operator handoff ${surface}`,
    evidence_ref: "operator_handoff_contract_rows",
    consumer_surface_slot: surface,
    preview_surface: surface,
    handoff_key: `handoff.${surface}`,
    read_only: true,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    write_allowed_now: false,
    bounded_payload_only: true,
    mutation_enabled: false,
  }));

  const visibilityRows = [
    "readiness",
    "smoke_evidence",
    "handoff",
    "blocker",
    "source_ref",
    "redaction",
    "no_acceptance",
    "no_action",
  ].map((guard) => sourceRow({
    row_id: `acceptance_visibility.${guard}`,
    category: "acceptance_visibility_guard",
    label: `Acceptance visibility ${guard}`,
    evidence_ref: "acceptance_visibility_guard_rows",
    visible_now: true,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
  }));

  const boundary = {
    p25600_contract_ready: true,
    ready_for_p25601_handoff: ready,
    source_p25200_ready_for_p25201_handoff: true,
    source_validation_valid_now: true,
    acceptance_readiness_checklist_visible_now: true,
    smoke_evidence_index_visible_now: true,
    operator_handoff_contract_visible_now: true,
    acceptance_visibility_guard_visible_now: true,
    no_acceptance_boundary_closed_now: true,
    acceptance_readiness_checklist_count: readinessRows.length,
    smoke_evidence_index_count: smokeRows.length,
    operator_handoff_contract_count: handoffRows.length,
    acceptance_visibility_guard_count: visibilityRows.length,
    ...Object.fromEntries(SOURCE_FALSE_FLAGS.map((flag) => [flag, false])),
  };

  return {
    schema_version: "receipt-workbench-fixture-acceptance-handoff.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_fixture_acceptance_handoff",
    program_range: "P25201-P25600",
    source_program_range: "P24801-P25200",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_fixture_acceptance_handoff_status: ready
        ? "ready_for_receipt_workbench_fixture_acceptance_handoff"
        : "valid_block_receipt_workbench_fixture_acceptance_handoff_pending",
      source_p25200_ready_for_p25201_handoff: true,
      acceptance_readiness_checklist_count: readinessRows.length,
      smoke_evidence_index_count: smokeRows.length,
      operator_handoff_contract_count: handoffRows.length,
      acceptance_visibility_guard_count: visibilityRows.length,
      ready_for_p25601_handoff: ready,
      fixture_acceptance_approval_allowed_now: false,
      fixture_acceptance_closeout_allowed_now: false,
      fixture_acceptance_apply_allowed_now: false,
      production_pass_enabled: false,
    },
    acceptance_readiness_checklist_rows: readinessRows,
    smoke_evidence_index_rows: smokeRows,
    operator_handoff_contract_rows: handoffRows,
    acceptance_visibility_guard_rows: visibilityRows,
    no_acceptance_boundary_rows: SOURCE_FALSE_FLAGS.map((flag) => sourceRow({
      row_id: `no_acceptance.${flag}`,
      category: "no_acceptance_boundary",
      label: `${flag} remains false`,
      evidence_ref: "no_acceptance_boundary_rows",
      boundary_flag: flag,
      allowed_now: false,
    })),
    p25600_clean_checkpoint_rows: [],
    receipt_workbench_fixture_acceptance_handoff_boundary: boundary,
    receipt_workbench_fixture_acceptance_handoff_validation_items: [],
  };
}

function sourceRow(fields) {
  return {
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    generated_at: RUN_AT,
    ...fields,
  };
}
