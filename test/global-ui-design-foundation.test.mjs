import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGlobalUiDesignFoundation,
  runGlobalUiDesignFoundation,
} from "../src/global-ui-design-foundation.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P11200_READY = {
  schema_version: "global-ui-contract.v1",
  program_range: "P11001-P11200",
  design_system_range: "P10801-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_contract_status: "ready_for_global_ui_contract",
    ready_for_p11201_handoff: true,
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
    globalUiContract: P11200_READY,
    ...overrides,
  };
}

test("Global UI design foundation consumes P11200 source and freezes P11201-P11400", async () => {
  const result = await buildGlobalUiDesignFoundation(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "global-ui-design-foundation.v1");
  assert.equal(result.program_range, "P11201-P11400");
  assert.equal(result.source_program_range, "P11001-P11200");
  assert.equal(result.summary.global_ui_design_foundation_status, "ready_for_global_ui_design_foundation");
  assert.equal(result.summary.source_ready_for_p11201_handoff, true);
  assert.equal(result.summary.ready_for_p11401_handoff, true);
  assert.equal(result.summary.ready_for_p11801_handoff, false);
  assert.equal(result.summary.p11800_design_system_freeze_ready, false);
});

test("Global UI design foundation covers all phase rows through P11400", async () => {
  const result = await buildGlobalUiDesignFoundation(options());
  const phases = new Set(result.global_ui_design_foundation_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P11201-P11220", "P11221-P11240", "P11241-P11260", "P11261-P11280", "P11281-P11300", "P11301-P11320", "P11321-P11340", "P11341-P11360", "P11361-P11380", "P11381-P11400"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.global_ui_design_foundation_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Global UI design foundation defines restrained design tokens", async () => {
  const result = await buildGlobalUiDesignFoundation(options());
  const tokens = result.design_token_rows.map((row) => row.label);

  assert.deepEqual(tokens, ["color.neutral", "color.accent", "color.semantic", "typography", "spacing", "radius", "shadow", "motion"]);
  assert.equal(result.design_token_rows.every((row) => row.hardcoded_value_allowed === false), true);
  assert.equal(result.design_token_rows.every((row) => row.viewport_font_scaling_allowed === false), true);
  assert.equal(result.design_token_rows.every((row) => row.negative_letter_spacing_allowed === false), true);
  assert.equal(result.design_token_rows.every((row) => row.authority_semantics_allowed === false), true);
});

test("Global UI design foundation fixes table, detail, timeline, and boundary primitives without execution controls", async () => {
  const result = await buildGlobalUiDesignFoundation(options());

  assert.equal(result.table_list_primitive_rows.length, 8);
  assert.equal(result.detail_inspector_primitive_rows.length, 9);
  assert.equal(result.timeline_primitive_rows.length, 7);
  assert.equal(result.boundary_notice_receipt_rows.length, 8);
  assert.equal(result.table_list_primitive_rows.every((row) => row.stable_dimensions_required === true && row.write_control_enabled === false), true);
  assert.equal(result.detail_inspector_primitive_rows.every((row) => row.raw_body_visible === false && row.final_approval_enabled === false), true);
  assert.equal(result.boundary_notice_receipt_rows.every((row) => row.display_as_execution_button === false && row.protected_action_enabled === false), true);
});

test("Global UI design foundation represents readiness as rules and review as evidence trace", async () => {
  const result = await buildGlobalUiDesignFoundation(options());

  assert.equal(result.readiness_rule_matrix_rows.length, 8);
  assert.equal(result.review_evidence_trace_rows.length, 8);
  assert.equal(result.readiness_rule_matrix_rows.every((row) => row.scorecard_kpi_allowed === false), true);
  assert.equal(result.readiness_rule_matrix_rows.every((row) => row.production_claim_allowed === false && row.enterprise_claim_allowed === false), true);
  assert.equal(result.review_evidence_trace_rows.every((row) => row.reviewer_final_approval_allowed === false), true);
  assert.equal(result.review_evidence_trace_rows.every((row) => row.source_mutation_allowed === false && row.raw_review_body_visible === false), true);
});

test("Global UI design foundation states and smoke fixtures block unsafe claims", async () => {
  const result = await buildGlobalUiDesignFoundation(options());
  const states = new Set(result.component_state_matrix_rows.map((row) => row.label));

  for (const state of ["default", "hover", "focus", "selected", "disabled", "loading", "stale", "blocked", "missing evidence", "review pending"]) {
    assert.equal(states.has(state), true);
  }
  assert.equal(result.component_state_matrix_rows.every((row) => row.write_control_enabled === false && row.raw_body_visible === false), true);
  assert.equal(result.ui_smoke_fixture_plan_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.ui_smoke_fixture_plan_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Global UI design foundation boundary keeps protected capabilities closed", async () => {
  const result = await buildGlobalUiDesignFoundation(options());
  const boundary = result.global_ui_design_foundation_boundary;

  assert.equal(result.p11400_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.global_ui_design_foundation_ready, true);
  assert.equal(boundary.p11401_operator_queue_ui_handoff_ready, true);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_ui_enabled, false);
  assert.equal(boundary.enterprise_pass_ui_enabled, false);
  assert.equal(boundary.scorecard_kpi_enabled, false);
  assert.equal(boundary.review_trace_final_approval_enabled, false);
  assert.equal(boundary.p11800_design_system_freeze_ready, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Global UI design foundation blocks if P11200 source is not ready", async () => {
  const result = await buildGlobalUiDesignFoundation(options({
    globalUiContract: {
      schema_version: "global-ui-contract.v1",
      summary: {
        global_ui_contract_status: "blocked_global_ui_contract",
        ready_for_p11201_handoff: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_ready_for_p11201_handoff, false);
  assert.equal(result.summary.global_ui_design_foundation_status, "blocked_global_ui_design_foundation");
});

test("Global UI design foundation HTML is read-only and does not expose unsafe controls", async () => {
  const result = await buildGlobalUiDesignFoundation(options());

  assert.equal(/<form|<button|type="submit"|apply now|merge now|delete now|send now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Global UI design foundation --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "global-ui-design-foundation-"));
  const sentinelPath = path.join(outDir, "global-ui-design-foundation.json");
  const sentinel = "{ \"sentinel\": \"global-ui-design-foundation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runGlobalUiDesignFoundation(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
