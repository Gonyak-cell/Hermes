import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSaasQualityGatePacks,
  runSaasQualityGatePacks,
} from "../src/saas-quality-gate-packs.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P11800_READY = {
  schema_version: "global-ui-governance-freeze.v1",
  program_range: "P11601-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_governance_freeze_status: "ready_for_global_ui_governance_freeze",
    ready_for_p11801_handoff: true,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  },
  global_ui_governance_freeze_boundary: {
    ready_for_p11801_handoff: true,
    write_control_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  },
};

const P11800_BLOCKED = {
  schema_version: "global-ui-governance-freeze.v1",
  program_range: "P11601-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_governance_freeze_status: "blocked_global_ui_governance_freeze",
    ready_for_p11801_handoff: false,
    claude_review_block_visible_now: true,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  },
  global_ui_governance_freeze_boundary: {
    ready_for_p11801_handoff: false,
    claude_review_block_visible_now: true,
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
    globalUiGovernanceFreeze: P11800_READY,
    ...overrides,
  };
}

test("SaaS quality gate packs build reusable gate packs through P12000", async () => {
  const result = await buildSaasQualityGatePacks(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "saas-quality-gate-packs.v1");
  assert.equal(result.program_range, "P11801-P12000");
  assert.equal(result.source_program_range, "P11601-P11800");
  assert.equal(result.summary.saas_quality_gate_packs_status, "ready_for_saas_quality_gate_packs");
  assert.equal(result.summary.quality_gate_pack_count, 10);
  assert.equal(result.summary.quality_gate_component_count, 50);
  assert.equal(result.summary.ready_for_p12001_handoff, true);
});

test("SaaS quality gate packs cover every planned phase", async () => {
  const result = await buildSaasQualityGatePacks(options());
  const phases = new Set(result.saas_quality_gate_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P11801-P11820", "P11821-P11840", "P11841-P11860", "P11861-P11880", "P11881-P11900", "P11901-P11920", "P11921-P11940", "P11941-P11960", "P11961-P11980", "P11981-P12000"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.saas_quality_gate_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("SaaS quality gate packs define all reusable pack categories and components", async () => {
  const result = await buildSaasQualityGatePacks(options());
  const packIds = new Set(result.saas_quality_gate_pack_rows.map((row) => row.gate_pack_id));

  for (const packId of ["security", "permissions", "data_model", "ux", "api", "performance", "docs", "deployment_rollback", "provenance", "registry"]) {
    assert.equal(packIds.has(packId), true);
  }
  assert.equal(result.saas_quality_gate_pack_rows.every((row) => row.reusable_across_saas_projects === true), true);
  assert.equal(result.saas_quality_gate_pack_rows.every((row) => row.opens_write_action === false && row.opens_release_approval === false), true);
  assert.equal(result.saas_quality_gate_component_rows.length, 50);
  assert.equal(result.saas_quality_gate_component_rows.every((row) => row.deterministic_check_required === true && row.evidence_ref_required === true), true);
});

test("SaaS quality gate packs keep blocked P11800 source visible without opening P12001 handoff", async () => {
  const result = await buildSaasQualityGatePacks(options({ globalUiGovernanceFreeze: P11800_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.saas_quality_gate_packs_status, "blocked_saas_quality_gate_packs");
  assert.equal(result.summary.source_ready_for_p11801_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12001_handoff, false);
  assert.equal(result.saas_quality_gate_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
});

test("SaaS quality gate packs fail validation if P11800 source is missing", async () => {
  const result = await buildSaasQualityGatePacks(options({ globalUiGovernanceFreeze: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.saas_quality_gate_packs_status, "blocked_saas_quality_gate_packs");
  assert.equal(result.saas_quality_gate_boundary.source_global_ui_governance_freeze_available, false);
});

test("SaaS quality gate boundary keeps protected capabilities closed", async () => {
  const result = await buildSaasQualityGatePacks(options());
  const boundary = result.saas_quality_gate_boundary;

  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.form_button_execution_enabled, false);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.release_approval_enabled, false);
  assert.equal(boundary.domain_pack_product_identity_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("SaaS quality gate HTML is read-only and avoids unsafe trust copy", async () => {
  const result = await buildSaasQualityGatePacks(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|approve now|merge now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("SaaS quality gate packs --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "saas-quality-gate-packs-"));
  const sentinelPath = path.join(outDir, "saas-quality-gate-packs.json");
  const sentinel = "{ \"sentinel\": \"saas-quality-gate-packs\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runSaasQualityGatePacks(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
