import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformProductionGovernanceWorkOsFreeze,
  runPlatformProductionGovernanceWorkOsFreeze,
} from "../src/platform-production-governance-work-os-freeze.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformProductionGovernanceWorkOsFreeze({ runAt: RUN_AT, write: false });

test("Production governance Work OS freeze consumes domain pack ecosystem", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_production_governance_work_os_freeze_status, "ready_for_platform_production_governance_work_os_freeze");
  assert.equal(result.summary.source_domain_pack_ecosystem_status, "ready_for_platform_domain_pack_ecosystem");
  assert.equal(result.production_governance_anchor.program_range, "P3041-P3200");
  assert.equal(result.production_governance_anchor.previous_phase_slot, "P3040");
  assert.equal(result.production_governance_anchor.next_phase_slot, "P3200");
});

test("Production governance Work OS freeze emits all final governance rows", async () => {
  const result = await resultPromise;

  assert.equal(result.production_governance_component_rows.length, 8);
  assert.equal(result.ai_risk_governance_rows.length, 6);
  assert.equal(result.supply_chain_governance_rows.length, 6);
  assert.equal(result.resilience_governance_rows.length, 6);
  assert.equal(result.release_readiness_rows.length, 7);
  assert.equal(result.work_os_maturity_rows.length, 5);
  assert.equal(result.production_freeze_invariant_rows.length, 8);
  assert.equal(result.final_authority_rows.length, 6);
  assert.equal(result.production_governance_handoff_rows.length, 3);
  assert.equal(result.production_governance_guard_rows.length, 12);
});

test("Production governance Work OS freeze keeps production, runtime, write, connector, and pack install closed", async () => {
  const result = await resultPromise;
  const boundary = result.production_governance_boundary;

  assert.equal(boundary.p3200_final_freeze_candidate, true);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.connector_write_allowed_now, false);
  assert.equal(boundary.pack_install_allowed_now, false);
  assert.equal(boundary.domain_rollout_allowed_now, false);
  assert.equal(boundary.production_ready_claimed_now, false);
  assert.equal(boundary.production_ready_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Production governance Work OS freeze keeps Agent and final authority blocked", async () => {
  const result = await resultPromise;
  const boundary = result.production_governance_boundary;

  assert.equal(result.ai_risk_governance_rows.every((row) => row.agent_final_pass_allowed_now === false && row.protected_action_allowed_now === false), true);
  assert.equal(result.final_authority_rows.every((row) => row.human_required === true && row.agent_final_allowed === false && row.final_authority_granted_now === false), true);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.legal_final_authority_allowed_now, false);
  assert.equal(boundary.release_final_authority_allowed_now, false);
  assert.equal(boundary.production_final_authority_allowed_now, false);
  assert.equal(boundary.trading_live_authority_allowed_now, false);
});

test("Production governance Work OS freeze blocks Work OS final claim until live closed-loop evidence exists", async () => {
  const result = await resultPromise;
  const liveRows = result.work_os_maturity_rows.filter((row) => row.live_closed_loop_required);

  assert.equal(liveRows.length, 2);
  assert.equal(result.work_os_maturity_rows.every((row) => row.maturity_claim_finalized_now === false && row.work_os_claim_allowed_now === false), true);
  assert.equal(result.production_governance_boundary.work_os_claim_finalized_now, false);
  assert.equal(result.production_governance_boundary.l7_declared_now, false);
});

test("Production governance Work OS freeze --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-production-governance-work-os-freeze-"));
  const sentinelPath = path.join(outDir, "platform-production-governance-work-os-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-production-governance-work-os-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformProductionGovernanceWorkOsFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
