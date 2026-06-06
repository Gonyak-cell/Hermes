import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildObservabilityCostPlane,
  runObservabilityCostPlane,
} from "../src/observability-cost-plane.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P13400_READY = {
  schema_version: "enterprise-trust-hardening-control-plane.v1",
  program_range: "P13001-P13400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    enterprise_trust_hardening_control_plane_status: "ready_for_enterprise_trust_hardening_control_plane",
    ready_for_p13401_handoff: true,
    independent_review_hardening_row_count: 6,
    attestation_hardening_row_count: 6,
    sbom_dependency_evidence_row_count: 6,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  enterprise_trust_boundary: {
    ready_for_p13401_handoff: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

const P13400_BLOCKED = {
  schema_version: "enterprise-trust-hardening-control-plane.v1",
  program_range: "P13001-P13400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    enterprise_trust_hardening_control_plane_status: "blocked_enterprise_trust_hardening_control_plane",
    ready_for_p13401_handoff: false,
    independent_review_hardening_row_count: 6,
    attestation_hardening_row_count: 6,
    sbom_dependency_evidence_row_count: 6,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  enterprise_trust_boundary: {
    ready_for_p13401_handoff: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    enterpriseTrustHardeningControlPlane: P13400_READY,
    ...overrides,
  };
}

test("Observability And Cost Plane builds duration, flaky, review latency, token/cost, freshness, failure, drift, projection, authority, and freeze contracts through P13800", async () => {
  const result = await buildObservabilityCostPlane(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "observability-cost-plane.v1");
  assert.equal(result.program_range, "P13401-P13800");
  assert.equal(result.source_program_range, "P13001-P13400");
  assert.equal(result.summary.observability_cost_plane_status, "ready_for_observability_cost_plane");
  assert.equal(result.summary.test_duration_signal_row_count, 6);
  assert.equal(result.summary.flaky_check_signal_row_count, 6);
  assert.equal(result.summary.review_latency_signal_row_count, 6);
  assert.equal(result.summary.token_cost_signal_row_count, 6);
  assert.equal(result.summary.evidence_freshness_signal_row_count, 6);
  assert.equal(result.summary.gate_failure_signal_row_count, 6);
  assert.equal(result.summary.validation_drift_signal_row_count, 6);
  assert.equal(result.summary.observability_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p13801_handoff, true);
  assert.equal(result.summary.metric_write_allowed_now, false);
  assert.equal(result.summary.telemetry_collector_start_allowed_now, false);
  assert.equal(result.summary.budget_mutation_allowed_now, false);
});

test("Observability And Cost Plane covers every planned phase", async () => {
  const result = await buildObservabilityCostPlane(options());
  const phases = new Set(result.observability_cost_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P13401-P13440", "P13441-P13480", "P13481-P13520", "P13521-P13560", "P13561-P13600", "P13601-P13640", "P13641-P13680", "P13681-P13720", "P13721-P13760", "P13761-P13800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.observability_cost_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Observability And Cost Plane defines signal rows without opening metric mutation or trust authority", async () => {
  const result = await buildObservabilityCostPlane(options());

  assert.equal(result.observability_source_binding_rows.length, 8);
  assert.equal(result.test_duration_signal_rows.length, 6);
  assert.equal(result.flaky_check_signal_rows.length, 6);
  assert.equal(result.review_latency_signal_rows.length, 6);
  assert.equal(result.token_cost_signal_rows.length, 6);
  assert.equal(result.evidence_freshness_signal_rows.length, 6);
  assert.equal(result.gate_failure_signal_rows.length, 6);
  assert.equal(result.validation_drift_signal_rows.length, 6);
  assert.equal(result.observability_projection_rows.length, 6);
  assert.equal(result.observability_authority_guard_rows.length, 8);

  assert.equal(result.test_duration_signal_rows.every((row) => row.runtime_control_allowed_now === false), true);
  assert.equal(result.flaky_check_signal_rows.every((row) => row.retry_execution_allowed_now === false && row.quarantine_mutation_allowed_now === false), true);
  assert.equal(result.token_cost_signal_rows.every((row) => row.budget_mutation_allowed_now === false), true);
  assert.equal(result.evidence_freshness_signal_rows.every((row) => row.raw_source_exposure_allowed === false && row.uncited_memory_allowed === false), true);
  assert.equal(result.observability_projection_rows.every((row) => row.metric_mutation_allowed_now === false), true);
  assert.equal(result.observability_authority_guard_rows.every((row) => row.metric_write_allowed_now === false && row.production_pass_enabled === false && row.enterprise_trust_claim_allowed_now === false), true);
});

test("Observability And Cost Plane preserves blocked P13400 source without opening P13801 handoff", async () => {
  const result = await buildObservabilityCostPlane(options({ enterpriseTrustHardeningControlPlane: P13400_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.observability_cost_plane_status, "blocked_observability_cost_plane");
  assert.equal(result.summary.source_ready_for_p13401_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p13801_handoff, false);
  assert.equal(result.observability_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p13800_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p13800_freeze_rows.find((row) => row.row_id === "freeze.source_block_visible").current_verdict, "pass");
});

test("Observability And Cost Plane fails validation if P13400 source is missing", async () => {
  const result = await buildObservabilityCostPlane(options({ enterpriseTrustHardeningControlPlane: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.observability_cost_plane_status, "blocked_observability_cost_plane");
  assert.equal(result.observability_cost_boundary.source_enterprise_trust_hardening_available, false);
});

test("Observability And Cost Plane boundary keeps metrics, collector, budget, provider, raw exposure, release, write, and final approval closed", async () => {
  const result = await buildObservabilityCostPlane(options());
  const boundary = result.observability_cost_boundary;

  assert.equal(boundary.metric_write_allowed_now, false);
  assert.equal(boundary.telemetry_collector_start_allowed_now, false);
  assert.equal(boundary.budget_mutation_allowed_now, false);
  assert.equal(boundary.external_provider_call_allowed_now, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.raw_transcript_exposure_allowed, false);
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

test("Observability And Cost Plane HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildObservabilityCostPlane(options());

  assert.equal(/<form|<button|type="submit"|write metric|start collector|mutate budget|call provider|approve now|deploy now|release now|enterprise approved|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Observability And Cost Plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "observability-cost-plane-"));
  const sentinelPath = path.join(outDir, "observability-cost-plane.json");
  const sentinel = "{ \"sentinel\": \"observability-cost-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runObservabilityCostPlane(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
