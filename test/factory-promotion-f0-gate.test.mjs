import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryPromotionF0Gate,
  runFactoryPromotionF0Gate,
} from "../src/factory-promotion-f0-gate.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const COMMIT_SHA = "f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7";

const OWNER_RECEIPT = {
  receipt_id: "rcpt-s0-owner-adjudication-20260611",
  receipt_kind: "human_owner_adjudication",
  scope: {
    program: "Hermes Factory Promotion",
    stage: "S0",
  },
  adjudicated_decisions: [
    { decision_id: "S0-1", receipt_id: "rcpt-s0-1-engine-identity-20260611", decision: "A_then_B", source_ref: "S0-1.md" },
    { decision_id: "S0-2", receipt_id: "rcpt-s0-2-corrective-baseline-waiver-20260611", decision: "corrective_baseline_waiver", expires_before: "FA.6 freeze", source_ref: "S0-2.md" },
    { decision_id: "S0-3", receipt_id: "rcpt-s0-3-hrm-caps-20260611", decision: "parallel_with_adopted_caps", source_ref: "S0-3.md" },
    { decision_id: "S0-4", receipt_id: "rcpt-s0-4-merge-governance-20260611", decision: "pilot_merge_governance", source_ref: "S0-4.md" },
    { decision_id: "S0-5", receipt_id: "rcpt-s0-5-identity-id-scheme-20260611", decision: "factory_now_product_later_fcore_canonical", source_ref: "S0-5.md" },
  ],
  authority_flags: {
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    command_execution_allowed_now: false,
    api_write_methods_allowed_now: false,
    store_mutation_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    fable_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const OWNER_NO_OPUS_EXCEPTION_RECEIPT = {
  receipt_id: "rcpt-f0-1-owner-no-opus-exception-20260611",
  receipt_kind: "human_owner_no_opus_exception",
  status: "accepted_limited_low_trust",
  scope: {
    program: "Hermes Factory Promotion",
    stage: "F0.1",
    applies_once: true,
  },
  exception: {
    skip_opus_review_this_run: true,
    allows_fa_implementation_without_opus_now: true,
    requires_deferred_independent_review_before_production_or_enterprise: true,
    expires_before: "FA.6 freeze",
    trust_level: "owner_exception_low_trust",
  },
  authority_flags: {
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    command_execution_allowed_now: false,
    api_write_methods_allowed_now: false,
    store_mutation_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    fable_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P15000_BLOCKED = {
  schema_version: "multi-engine-orchestration.v1",
  program_range: "P14601-P15000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    multi_engine_orchestration_status: "blocked_multi_engine_orchestration",
    ready_for_p15001_handoff: false,
    engine_registry_row_count: 6,
    role_authority_matrix_row_count: 6,
    routing_decision_contract_row_count: 6,
    cross_engine_final_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  multi_engine_boundary: {
    ready_for_p15001_handoff: false,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    protected_action_routing_allowed_now: false,
    raw_source_exposure_allowed: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    connector_write_enabled: false,
  },
};

const CONNECTOR_RECEIPT = {
  schema_version: "connector-governance-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_connector_external_app_governance: true,
  scope_id: "connector_external_app_governance",
  unresolved_finding_count: 0,
  reviewed_commit_sha: COMMIT_SHA,
  prompt_sha256: HASH_A,
  raw_output_sha256: HASH_B,
  engine_resolved_model_id: "claude-opus-4-1-20260501",
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

const EXECUTION_RECEIPT = {
  schema_version: "execution-write-authority-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_execution_write_authority_maturity: true,
  scope_id: "execution_write_authority_maturity",
  unresolved_finding_count: 0,
  reviewed_commit_sha: COMMIT_SHA,
  prompt_sha256: HASH_B,
  raw_output_sha256: HASH_A,
  engine_resolved_model_id: "claude-opus-4-1-20260501",
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    ownerAdjudicationReceipt: OWNER_RECEIPT,
    ownerNoOpusExceptionReceipt: null,
    multiEngineOrchestration: P15000_BLOCKED,
    inlineReceipts: {
      "f0_1.connector_external_app_governance": CONNECTOR_RECEIPT,
      "f0_1.execution_write_authority_maturity": EXECUTION_RECEIPT,
    },
    ...overrides,
  };
}

test("Factory Promotion F0 Gate opens FA implementation only after all F0 rows pass", async () => {
  const result = await buildFactoryPromotionF0Gate(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-promotion-f0-gate.v1");
  assert.equal(result.summary.factory_promotion_f0_gate_status, "ready_for_fa_implementation");
  assert.equal(result.summary.f0_phase_count, 5);
  assert.equal(result.summary.f0_phase_pass_count, 5);
  assert.equal(result.summary.f0_1_receipt_preflight_passed, true);
  assert.equal(result.summary.f0_2_source_handoff_or_visible_waiver_now, true);
  assert.equal(result.summary.source_ready_for_p15001_handoff, false);
  assert.equal(result.summary.source_blocker_waived_for_fcore_corrective_baseline_now, true);
  assert.equal(result.summary.fa_implementation_allowed_now, true);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Promotion F0 Gate keeps FA blocked when independent review receipts are missing", async () => {
  const result = await buildFactoryPromotionF0Gate(options({
    inlineReceipts: {
      "f0_1.connector_external_app_governance": null,
      "f0_1.execution_write_authority_maturity": null,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_promotion_f0_gate_status, "blocked_factory_promotion_f0_gate");
  assert.equal(result.summary.f0_1_receipt_preflight_passed, false);
  assert.equal(result.summary.f0_2_source_handoff_or_visible_waiver_now, true);
  assert.equal(result.summary.fa_implementation_allowed_now, false);
  assert.deepEqual(result.summary.blocked_phase_ids, ["F0.1"]);
});

test("Factory Promotion F0 Gate allows low-trust FA start with one-time owner no-Opus exception", async () => {
  const result = await buildFactoryPromotionF0Gate(options({
    ownerNoOpusExceptionReceipt: OWNER_NO_OPUS_EXCEPTION_RECEIPT,
    inlineReceipts: {
      "f0_1.connector_external_app_governance": null,
      "f0_1.execution_write_authority_maturity": null,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_promotion_f0_gate_status, "ready_for_fa_implementation");
  assert.equal(result.summary.f0_1_receipt_preflight_passed, false);
  assert.equal(result.summary.f0_1_owner_no_opus_exception_active_now, true);
  assert.equal(result.summary.independent_review_deferred_now, true);
  assert.equal(result.summary.fa_implementation_trust_level, "owner_exception_low_trust");
  assert.equal(result.summary.fa_implementation_allowed_now, true);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.f0_phase_rows.find((row) => row.row_id === "F0.1").owner_no_opus_exception_active, true);
});

test("Factory Promotion F0 Gate keeps missing owner decisions visible", async () => {
  const ownerWithoutS04 = {
    ...OWNER_RECEIPT,
    adjudicated_decisions: OWNER_RECEIPT.adjudicated_decisions.filter((decision) => decision.decision_id !== "S0-4"),
  };
  const result = await buildFactoryPromotionF0Gate(options({ ownerAdjudicationReceipt: ownerWithoutS04 }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.fa_implementation_allowed_now, false);
  assert.equal(result.f0_phase_rows.find((row) => row.row_id === "F0.4").current_verdict, "blocked");
  assert.deepEqual(result.summary.blocked_phase_ids, ["F0.4"]);
});

test("Factory Promotion F0 Gate --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-promotion-f0-gate-"));
  const sentinelPath = path.join(outDir, "factory-promotion-f0-gate.json");
  const sentinel = "{ \"sentinel\": \"factory-promotion-f0-gate\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryPromotionF0Gate(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Promotion F0 Gate --require-pass rejects blocked F0.1 receipts", async () => {
  await assert.rejects(
    () => runFactoryPromotionF0Gate(options({
      requirePass: true,
      inlineReceipts: {
        "f0_1.connector_external_app_governance": null,
        "f0_1.execution_write_authority_maturity": null,
      },
    })),
    /not ready for FA implementation/,
  );
});
