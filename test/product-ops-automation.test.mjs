import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProductOpsAutomation,
  runProductOpsAutomation,
} from "../src/product-ops-automation.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P13800_READY = {
  schema_version: "observability-cost-plane.v1",
  program_range: "P13401-P13800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    observability_cost_plane_status: "ready_for_observability_cost_plane",
    ready_for_p13801_handoff: true,
    test_duration_signal_row_count: 6,
    token_cost_signal_row_count: 6,
    validation_drift_signal_row_count: 6,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  observability_cost_boundary: {
    ready_for_p13801_handoff: true,
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
    external_provider_call_allowed_now: false,
    raw_source_exposure_allowed: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

const P13800_BLOCKED = {
  schema_version: "observability-cost-plane.v1",
  program_range: "P13401-P13800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    observability_cost_plane_status: "blocked_observability_cost_plane",
    ready_for_p13801_handoff: false,
    test_duration_signal_row_count: 6,
    token_cost_signal_row_count: 6,
    validation_drift_signal_row_count: 6,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  observability_cost_boundary: {
    ready_for_p13801_handoff: false,
    metric_write_allowed_now: false,
    telemetry_collector_start_allowed_now: false,
    budget_mutation_allowed_now: false,
    external_provider_call_allowed_now: false,
    raw_source_exposure_allowed: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    observabilityCostPlane: P13800_READY,
    ...overrides,
  };
}

test("Product Ops Automation builds roadmap, sprint, issue, changelog, support, customer, state link, projection, authority, and freeze contracts through P14200", async () => {
  const result = await buildProductOpsAutomation(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "product-ops-automation.v1");
  assert.equal(result.program_range, "P13801-P14200");
  assert.equal(result.source_program_range, "P13401-P13800");
  assert.equal(result.summary.product_ops_automation_status, "ready_for_product_ops_automation");
  assert.equal(result.summary.roadmap_signal_row_count, 6);
  assert.equal(result.summary.sprint_signal_row_count, 6);
  assert.equal(result.summary.issue_signal_row_count, 6);
  assert.equal(result.summary.changelog_signal_row_count, 6);
  assert.equal(result.summary.support_feedback_signal_row_count, 6);
  assert.equal(result.summary.customer_request_signal_row_count, 6);
  assert.equal(result.summary.harness_state_link_row_count, 6);
  assert.equal(result.summary.product_ops_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p14201_handoff, true);
  assert.equal(result.summary.external_project_write_allowed_now, false);
});

test("Product Ops Automation covers every planned phase", async () => {
  const result = await buildProductOpsAutomation(options());
  const phases = new Set(result.product_ops_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P13801-P13840", "P13841-P13880", "P13881-P13920", "P13921-P13960", "P13961-P14000", "P14001-P14040", "P14041-P14080", "P14081-P14120", "P14121-P14160", "P14161-P14200"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.product_ops_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Product Ops Automation defines product ops rows without opening product, customer, or external writes", async () => {
  const result = await buildProductOpsAutomation(options());

  assert.equal(result.product_ops_source_binding_rows.length, 8);
  assert.equal(result.roadmap_signal_rows.length, 6);
  assert.equal(result.sprint_signal_rows.length, 6);
  assert.equal(result.issue_signal_rows.length, 6);
  assert.equal(result.changelog_signal_rows.length, 6);
  assert.equal(result.support_feedback_signal_rows.length, 6);
  assert.equal(result.customer_request_signal_rows.length, 6);
  assert.equal(result.harness_state_link_rows.length, 6);
  assert.equal(result.product_ops_projection_rows.length, 6);
  assert.equal(result.product_ops_authority_guard_rows.length, 10);

  assert.equal(result.roadmap_signal_rows.every((row) => row.roadmap_write_allowed_now === false), true);
  assert.equal(result.sprint_signal_rows.every((row) => row.sprint_mutation_allowed_now === false), true);
  assert.equal(result.issue_signal_rows.every((row) => row.issue_write_allowed_now === false), true);
  assert.equal(result.changelog_signal_rows.every((row) => row.changelog_publish_allowed_now === false), true);
  assert.equal(result.support_feedback_signal_rows.every((row) => row.support_reply_allowed_now === false && row.raw_contact_exposure_allowed === false), true);
  assert.equal(result.customer_request_signal_rows.every((row) => row.customer_contact_allowed_now === false && row.raw_contact_exposure_allowed === false), true);
  assert.equal(result.product_ops_projection_rows.every((row) => row.external_project_write_allowed_now === false), true);
  assert.equal(result.product_ops_authority_guard_rows.every((row) => row.external_project_write_allowed_now === false && row.production_pass_enabled === false && row.enterprise_trust_claim_allowed_now === false), true);
});

test("Product Ops Automation preserves blocked P13800 source without opening P14201 handoff", async () => {
  const result = await buildProductOpsAutomation(options({ observabilityCostPlane: P13800_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.product_ops_automation_status, "blocked_product_ops_automation");
  assert.equal(result.summary.source_ready_for_p13801_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p14201_handoff, false);
  assert.equal(result.product_ops_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p14200_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p14200_freeze_rows.find((row) => row.row_id === "freeze.source_block_visible").current_verdict, "pass");
});

test("Product Ops Automation fails validation if P13800 source is missing", async () => {
  const result = await buildProductOpsAutomation(options({ observabilityCostPlane: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.product_ops_automation_status, "blocked_product_ops_automation");
  assert.equal(result.product_ops_boundary.source_observability_cost_available, false);
});

test("Product Ops Automation boundary keeps product writes, customer contact, raw exposure, release, write, and final approval closed", async () => {
  const result = await buildProductOpsAutomation(options());
  const boundary = result.product_ops_boundary;

  assert.equal(boundary.roadmap_write_allowed_now, false);
  assert.equal(boundary.sprint_mutation_allowed_now, false);
  assert.equal(boundary.issue_write_allowed_now, false);
  assert.equal(boundary.changelog_publish_allowed_now, false);
  assert.equal(boundary.support_reply_allowed_now, false);
  assert.equal(boundary.customer_contact_allowed_now, false);
  assert.equal(boundary.external_project_write_allowed_now, false);
  assert.equal(boundary.raw_contact_exposure_allowed, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Product Ops Automation HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildProductOpsAutomation(options());

  assert.equal(/<form|<button|type="submit"|write roadmap|mutate sprint|write issue|publish changelog|reply support|contact customer|external write|approve now|deploy now|release now|enterprise approved|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Product Ops Automation --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "product-ops-automation-"));
  const sentinelPath = path.join(outDir, "product-ops-automation.json");
  const sentinel = "{ \"sentinel\": \"product-ops-automation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runProductOpsAutomation(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
