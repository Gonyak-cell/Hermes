import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildWorkOsUiProductionFreeze,
  runWorkOsUiProductionFreeze,
} from "../src/work-os-ui-production-freeze.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildWorkOsUiProductionFreeze({ runAt: RUN_AT, write: false });

test("Work OS freeze consumes the security governance plane", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_ui_production_freeze_status, "ready_for_work_os_ui_production_freeze_v0");
  assert.equal(result.program_range, "P7801-P8000");
  assert.equal(result.summary.security_governance_compliance_rule_conflict_plane_status, "ready_for_security_governance_compliance_rule_conflict_plane_v0");
});

test("Work OS freeze covers all P7801-P8000 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.work_os_ui_production_freeze_phase_rows.map((row) => row.phase_range));

  assert.equal(result.work_os_ui_production_freeze_phase_rows.length, 10);
  for (const phase of ["P7801-P7820", "P7821-P7840", "P7841-P7860", "P7861-P7880", "P7881-P7900", "P7901-P7920", "P7921-P7940", "P7941-P7960", "P7961-P7980", "P7981-P8000"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_ui_production_freeze_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS freeze requires the Codex-Harness-Claude review process", async () => {
  const result = await resultPromise;
  const contract = result.work_os_ui_production_freeze_contract;

  assert.equal(contract.codex_implementation_packet_required, true);
  assert.equal(contract.harness_deterministic_validation_required, true);
  assert.equal(contract.claude_code_opus_max_review_receipt_required, true);
  assert.equal(contract.finding_loop_and_revalidation_required, true);
  assert.equal(contract.review_receipt_registration_required, true);
  assert.equal(contract.single_owner_trust_classification_required, true);
  assert.equal(contract.codex_self_approval_allowed, false);
  assert.equal(contract.claude_final_approval_allowed, false);
});

test("Work OS freeze registers full navigation and action inbox without protected execution", async () => {
  const result = await resultPromise;
  const navigationIds = new Set(result.work_os_navigation_freeze_rows.map((row) => row.item_id));

  assert.equal(result.work_os_navigation_freeze_rows.length, 12);
  assert.equal(navigationIds.has("nav.queue"), true);
  assert.equal(navigationIds.has("nav.audit"), true);
  assert.equal(result.work_os_navigation_freeze_rows.every((row) => row.production_readiness_claim_allowed === false), true);
  assert.equal(result.operator_action_inbox_rows.length, 6);
  assert.equal(result.operator_action_inbox_rows.every((row) => row.blocked_action_visible), true);
  assert.equal(result.operator_action_inbox_rows.every((row) => row.protected_action_execution_enabled === false), true);
});

test("Work OS freeze keeps closed-loop proof as a contract without production claim", async () => {
  const result = await resultPromise;

  assert.equal(result.closed_loop_maturity_evidence_rows.length, 8);
  assert.equal(result.closed_loop_maturity_evidence_rows.every((row) => row.closed_loop_contract_ready), true);
  assert.equal(result.closed_loop_maturity_evidence_rows.every((row) => row.l6_proof_passed_now === false), true);
  assert.equal(result.closed_loop_maturity_evidence_rows.every((row) => row.work_os_claim_allowed_from_this_row === false), true);
});

test("Work OS freeze registers domain rollout and API handbook alignment as non-launch contracts", async () => {
  const result = await resultPromise;

  assert.equal(result.domain_pack_rollout_matrix_rows.length, 6);
  assert.equal(result.domain_pack_rollout_matrix_rows.every((row) => row.trust_tier_required), true);
  assert.equal(result.domain_pack_rollout_matrix_rows.every((row) => row.product_launch_enabled === false), true);
  assert.equal(result.api_handbook_alignment_rows.length, 4);
  assert.equal(result.api_handbook_alignment_rows.every((row) => row.docs_can_claim_blocked_capability === false), true);
});

test("Work OS freeze creates Claude review ledger rows for every major milestone", async () => {
  const result = await resultPromise;
  const milestones = new Set(result.milestone_claude_review_completion_ledger_rows.map((row) => row.milestone));

  assert.equal(result.milestone_claude_review_completion_ledger_rows.length, 10);
  for (const milestone of ["P5000", "P5400", "P5800", "P6200", "P6600", "P7000", "P7300", "P7600", "P7800", "P8000"]) {
    assert.equal(milestones.has(milestone), true);
  }
  assert.equal(result.milestone_claude_review_completion_ledger_rows.every((row) => row.claude_code_opus_max_review_receipt_required), true);
  assert.equal(result.milestone_claude_review_completion_ledger_rows.every((row) => row.durable_raw_json_required), true);
  assert.equal(result.milestone_claude_review_completion_ledger_rows.every((row) => row.reviewer_final_approval_allowed === false), true);
});

test("Work OS freeze negative fixtures block unsafe final claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.work_os_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.work_os_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.no_source_context", "negative.no_evidence_pass", "negative.no_review_closeout", "negative.no_human_as_final", "negative.claude_as_approver", "negative.no_l6_work_os", "negative.ui_only_production", "negative.lower_trust_as_enterprise"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
});

test("Work OS freeze is ready while Work OS production and enterprise trust remain blocked", async () => {
  const result = await resultPromise;
  const boundary = result.work_os_ui_production_freeze_boundary;

  assert.equal(boundary.work_os_ui_production_freeze_ready, true);
  assert.equal(boundary.full_work_os_navigation_ready, true);
  assert.equal(boundary.milestone_claude_review_completion_ledger_ready, true);
  assert.equal(boundary.l6_closed_loop_proof_passed_now, false);
  assert.equal(boundary.l7_work_os_operating_system_claim_allowed_now, false);
  assert.equal(boundary.work_os_production_claim_enabled, false);
  assert.equal(boundary.ui_only_production_claim_allowed, false);
  assert.equal(boundary.lower_trust_as_enterprise_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.codex_self_approval_allowed, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS freeze --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-ui-production-freeze-"));
  const sentinelPath = path.join(outDir, "work-os-ui-production-freeze.json");
  const sentinel = "{ \"sentinel\": \"work-os-ui-production-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsUiProductionFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
