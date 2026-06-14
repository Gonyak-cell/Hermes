import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGlobalUiOperatorQueue,
  runGlobalUiOperatorQueue,
} from "../src/global-ui-operator-queue.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P11400_READY = {
  schema_version: "global-ui-design-foundation.v1",
  program_range: "P11201-P11400",
  design_system_range: "P10801-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_design_foundation_status: "ready_for_global_ui_design_foundation",
    ready_for_p11401_handoff: true,
    ready_for_p11801_handoff: false,
    write_control_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    globalUiDesignFoundation: P11400_READY,
    ...overrides,
  };
}

test("Global UI operator queue consumes P11400 source and freezes P11401-P11600", async () => {
  const result = await buildGlobalUiOperatorQueue(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "global-ui-operator-queue.v1");
  assert.equal(result.program_range, "P11401-P11600");
  assert.equal(result.source_program_range, "P11201-P11400");
  assert.equal(result.summary.global_ui_operator_queue_status, "ready_for_global_ui_operator_queue");
  assert.equal(result.summary.source_ready_for_p11401_handoff, true);
  assert.equal(result.summary.ready_for_p11601_handoff, true);
  assert.equal(result.summary.ready_for_p11801_handoff, false);
  assert.equal(result.summary.p11800_design_system_freeze_ready, false);
});

test("Global UI operator queue covers every phase row through P11600", async () => {
  const result = await buildGlobalUiOperatorQueue(options());
  const phases = new Set(result.global_ui_operator_queue_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P11401-P11420", "P11421-P11440", "P11441-P11460", "P11461-P11480", "P11481-P11500", "P11501-P11520", "P11521-P11540", "P11541-P11560", "P11561-P11580", "P11581-P11600"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.global_ui_operator_queue_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Global UI operator queue shell is the home surface without KPI dashboard framing", async () => {
  const result = await buildGlobalUiOperatorQueue(options());
  const shell = new Set(result.global_operator_queue_shell_rows.map((row) => row.row_id));

  assert.equal(shell.has("queue.home_surface"), true);
  assert.equal(shell.has("queue.not_kpi_dashboard"), true);
  assert.equal(result.global_operator_queue_shell_rows.every((row) => row.read_only === true), true);
  assert.equal(result.global_operator_queue_shell_rows.every((row) => row.write_control_enabled === false && row.final_approval_enabled === false), true);
});

test("Global UI operator queue rows preserve the trace spine", async () => {
  const result = await buildGlobalUiOperatorQueue(options());
  const labels = result.queue_row_source_card_rows.map((row) => row.label);

  for (const label of ["source", "claim", "requirement", "evidence", "gate", "review", "next action", "blocker reason"]) {
    assert.equal(labels.includes(label), true);
  }
  assert.equal(result.queue_row_source_card_rows.every((row) => row.raw_body_visible === false && row.secret_key_visible === false), true);
});

test("Global UI operator queue defines inspector, requirement trace, review gate, and evidence timeline", async () => {
  const result = await buildGlobalUiOperatorQueue(options());

  assert.equal(result.object_inspector_panel_rows.length, 9);
  assert.equal(result.requirement_trace_detail_rows.length, 8);
  assert.equal(result.review_gate_detail_rows.length, 9);
  assert.equal(result.evidence_timeline_rows.length, 8);
  assert.equal(result.object_inspector_panel_rows.every((row) => row.stable_section_required === true), true);
  assert.equal(result.review_gate_detail_rows.every((row) => row.approval_control_enabled === false && row.protected_action_enabled === false), true);
  assert.equal(result.review_gate_detail_rows.every((row) => row.reviewer_final_approval_allowed === false), true);
});

test("Global UI operator queue conversation and domain detail stay redacted and contextual", async () => {
  const result = await buildGlobalUiOperatorQueue(options());

  assert.equal(result.conversation_source_detail_ui_rows.length, 8);
  assert.equal(result.domain_pack_detail_rows.length, 8);
  assert.equal(result.conversation_source_detail_ui_rows.every((row) => row.redacted_summary_visible === true && row.raw_body_visible === false && row.full_body_visible === false), true);
  assert.equal(result.domain_pack_detail_rows.every((row) => row.context_only === true && row.product_identity_enabled === false), true);
  assert.equal(result.domain_pack_detail_rows.every((row) => row.cross_domain_data_mix_allowed === false && row.protected_output_enabled === false), true);
});

test("Global UI operator queue read-only smoke rows block unsafe UI and API behavior", async () => {
  const result = await buildGlobalUiOperatorQueue(options());

  assert.equal(result.read_only_ui_api_smoke_rows.length, 10);
  assert.equal(result.read_only_ui_api_smoke_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.read_only_ui_api_smoke_rows.every((row) => row.methods_allowed.includes("GET") && row.methods_allowed.includes("HEAD")), true);
  assert.equal(result.read_only_ui_api_smoke_rows.every((row) => row.mutates_state === false && row.form_button_execution_enabled === false), true);
  assert.equal(result.read_only_ui_api_smoke_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Global UI operator queue boundary keeps protected capabilities closed", async () => {
  const result = await buildGlobalUiOperatorQueue(options());
  const boundary = result.global_ui_operator_queue_boundary;

  assert.equal(result.p11600_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.global_ui_operator_queue_ready, true);
  assert.equal(boundary.p11601_visual_accessibility_handoff_ready, true);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.full_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.form_button_execution_enabled, false);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.final_approval_ui_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_ui_enabled, false);
  assert.equal(boundary.enterprise_pass_ui_enabled, false);
  assert.equal(boundary.domain_pack_product_identity_enabled, false);
  assert.equal(boundary.kpi_dashboard_home_enabled, false);
  assert.equal(boundary.review_gate_approval_control_enabled, false);
  assert.equal(boundary.p11800_design_system_freeze_ready, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Global UI operator queue blocks if P11400 source is not ready", async () => {
  const result = await buildGlobalUiOperatorQueue(options({
    globalUiDesignFoundation: {
      schema_version: "global-ui-design-foundation.v1",
      summary: {
        global_ui_design_foundation_status: "blocked_global_ui_design_foundation",
        ready_for_p11401_handoff: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_ready_for_p11401_handoff, false);
  assert.equal(result.summary.global_ui_operator_queue_status, "blocked_global_ui_operator_queue");
});

test("Global UI operator queue HTML is read-only and does not expose unsafe controls", async () => {
  const result = await buildGlobalUiOperatorQueue(options());

  assert.equal(/<form|<button|type="submit"|apply now|merge now|delete now|send now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Global UI operator queue --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "global-ui-operator-queue-"));
  const sentinelPath = path.join(outDir, "global-ui-operator-queue.json");
  const sentinel = "{ \"sentinel\": \"global-ui-operator-queue\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runGlobalUiOperatorQueue(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
