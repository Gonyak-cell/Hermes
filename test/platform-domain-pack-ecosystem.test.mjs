import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformDomainPackEcosystem,
  runPlatformDomainPackEcosystem,
} from "../src/platform-domain-pack-ecosystem.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformDomainPackEcosystem({ runAt: RUN_AT, write: false });

test("Domain pack ecosystem consumes connectors data governance", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_domain_pack_ecosystem_status, "ready_for_platform_domain_pack_ecosystem");
  assert.equal(result.summary.source_connectors_governance_status, "ready_for_platform_connectors_data_governance");
  assert.equal(result.domain_pack_ecosystem_anchor.program_range, "P2881-P3040");
  assert.equal(result.domain_pack_ecosystem_anchor.previous_phase_slot, "P2880");
  assert.equal(result.domain_pack_ecosystem_anchor.next_phase_slot, "P3041");
});

test("Domain pack ecosystem emits pack, SDK, compatibility, contribution, registry, ontology, and owner rows", async () => {
  const result = await resultPromise;

  assert.equal(result.domain_pack_ecosystem_component_rows.length, 8);
  assert.equal(result.domain_pack_rows.length, 6);
  assert.equal(result.pack_sdk_rows.length, 6);
  assert.equal(result.pack_compatibility_gate_rows.length, 6);
  assert.equal(result.pack_contribution_model_rows.length, 5);
  assert.equal(result.pack_registry_rows.length, 5);
  assert.equal(result.domain_ontology_rows.length, 6);
  assert.equal(result.domain_pass_owner_rows.length, 5);
  assert.equal(result.domain_pack_handoff_rows.length, 3);
  assert.equal(result.domain_pack_guard_rows.length, 12);
});

test("Domain pack ecosystem keeps pack install, SDK generation, compatibility runs, and registry publish closed", async () => {
  const result = await resultPromise;

  assert.equal(result.domain_pack_rows.every((row) => row.pack_manifest_required === true && row.pack_install_allowed_now === false), true);
  assert.equal(result.pack_sdk_rows.every((row) => row.sdk_generated_now === false && row.pack_install_allowed_now === false), true);
  assert.equal(result.pack_compatibility_gate_rows.every((row) => row.compatibility_check_required === true && row.gate_run_now === false), true);
  assert.equal(result.pack_registry_rows.every((row) => row.registry_published_now === false && row.pack_install_allowed_now === false), true);
});

test("Domain pack ecosystem requires contribution review, ontology compatibility, and human PASS owners", async () => {
  const result = await resultPromise;

  assert.equal(result.pack_contribution_model_rows.every((row) => row.review_required === true && row.contribution_merged_now === false), true);
  assert.equal(result.domain_ontology_rows.every((row) => row.ontology_required === true && row.cross_domain_merge_allowed_now === false), true);
  assert.equal(result.domain_pass_owner_rows.every((row) => row.owner_required === true && row.agent_final_pass_allowed === false), true);
  assert.equal(result.domain_pass_owner_rows.every((row) => row.human_final_authority_required === true && row.domain_final_authority_allowed_now === false), true);
});

test("Domain pack ecosystem prepares P3041 handoff without final or production authority", async () => {
  const result = await resultPromise;
  const boundary = result.domain_pack_boundary;

  assert.equal(boundary.domain_pack_ecosystem_contract_ready, true);
  assert.equal(boundary.pack_sdk_contract_ready, true);
  assert.equal(boundary.compatibility_gate_contract_ready, true);
  assert.equal(boundary.p3041_ready_as_next_goal, true);
  assert.equal(boundary.pack_install_performed_now, false);
  assert.equal(boundary.pack_registry_published_now, false);
  assert.equal(boundary.domain_rollout_allowed_now, false);
  assert.equal(boundary.domain_final_authority_allowed_now, false);
  assert.equal(boundary.legal_final_authority_allowed_now, false);
  assert.equal(boundary.release_final_authority_allowed_now, false);
  assert.equal(boundary.trading_live_authority_allowed_now, false);
  assert.equal(boundary.production_ready_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Domain pack ecosystem --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-domain-pack-ecosystem-"));
  const sentinelPath = path.join(outDir, "platform-domain-pack-ecosystem.json");
  const sentinel = "{ \"sentinel\": \"platform-domain-pack-ecosystem\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformDomainPackEcosystem({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
