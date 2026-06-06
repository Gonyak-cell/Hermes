import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDomainPackSdkV2,
  runDomainPackSdkV2,
} from "../src/domain-pack-sdk-v2.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P12000_READY = {
  schema_version: "saas-quality-gate-packs.v1",
  program_range: "P11801-P12000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    saas_quality_gate_packs_status: "ready_for_saas_quality_gate_packs",
    ready_for_p12001_handoff: true,
    quality_gate_pack_count: 10,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  saas_quality_gate_boundary: {
    ready_for_p12001_handoff: true,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P12000_BLOCKED = {
  schema_version: "saas-quality-gate-packs.v1",
  program_range: "P11801-P12000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    saas_quality_gate_packs_status: "blocked_saas_quality_gate_packs",
    ready_for_p12001_handoff: false,
    source_block_visible_now: true,
    quality_gate_pack_count: 10,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  saas_quality_gate_boundary: {
    ready_for_p12001_handoff: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const DOMAIN_PACK_REGISTRY = {
  schema_version: "domain-pack-registry.v1",
  summary: { pack_count: 5, capability_count: 12, valid: true },
  packs: [
    { pack_id: "common" },
    { pack_id: "creative-document" },
    { pack_id: "law-firm" },
    { pack_id: "personal-dev" },
    { pack_id: "trading" },
  ],
  capabilities: [],
  validation: { valid: true, errors: [] },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    saasQualityGatePacks: P12000_READY,
    domainPackRegistry: DOMAIN_PACK_REGISTRY,
    ...overrides,
  };
}

test("Domain Pack SDK v2 builds reusable domain contracts through P12200", async () => {
  const result = await buildDomainPackSdkV2(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "domain-pack-sdk-v2.v1");
  assert.equal(result.program_range, "P12001-P12200");
  assert.equal(result.source_program_range, "P11801-P12000");
  assert.equal(result.summary.domain_pack_sdk_v2_status, "ready_for_domain_pack_sdk_v2");
  assert.equal(result.summary.domain_count, 7);
  assert.equal(result.summary.sdk_contract_row_count, 42);
  assert.equal(result.summary.ready_for_p12201_handoff, true);
});

test("Domain Pack SDK v2 covers every planned phase", async () => {
  const result = await buildDomainPackSdkV2(options());
  const phases = new Set(result.domain_pack_sdk_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P12001-P12020", "P12021-P12040", "P12041-P12060", "P12061-P12080", "P12081-P12100", "P12101-P12120", "P12121-P12140", "P12141-P12160", "P12161-P12180", "P12181-P12200"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.domain_pack_sdk_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Domain Pack SDK v2 models all SaaS domain contexts without product identity", async () => {
  const result = await buildDomainPackSdkV2(options());
  const domainIds = new Set(result.domain_pack_sdk_domain_rows.map((row) => row.domain_id));

  for (const domainId of ["hr", "law_firm", "crm", "erp", "document", "trading", "future_saas"]) {
    assert.equal(domainIds.has(domainId), true);
  }
  assert.equal(result.domain_pack_sdk_domain_rows.every((row) => row.context_only === true), true);
  assert.equal(result.domain_pack_sdk_domain_rows.every((row) => row.opens_product_identity === false), true);
  assert.equal(result.domain_pack_sdk_domain_rows.every((row) => row.opens_write_action === false && row.opens_final_approval === false), true);
});

test("Domain Pack SDK v2 defines every manifest, capability, boundary, review, gate, migration, and contribution contract", async () => {
  const result = await buildDomainPackSdkV2(options());

  assert.equal(result.pack_manifest_v2_contract_rows.length, 6);
  assert.equal(result.capability_interface_contract_rows.length, 6);
  assert.equal(result.domain_data_boundary_rows.length, 6);
  assert.equal(result.domain_review_authority_rows.length, 5);
  assert.equal(result.domain_gate_pack_binding_rows.length, 9);
  assert.equal(result.domain_compatibility_migration_rows.length, 5);
  assert.equal(result.domain_contribution_contract_rows.length, 5);
  assert.equal(result.domain_pack_sdk_registry_rows.length, 7);

  const allContractRows = [
    ...result.pack_manifest_v2_contract_rows,
    ...result.capability_interface_contract_rows,
    ...result.domain_data_boundary_rows,
    ...result.domain_review_authority_rows,
    ...result.domain_gate_pack_binding_rows,
    ...result.domain_compatibility_migration_rows,
    ...result.domain_contribution_contract_rows,
  ];
  assert.equal(allContractRows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(allContractRows.every((row) => row.opens_write_action === false && row.opens_final_approval === false), true);
});

test("Domain Pack SDK v2 preserves blocked P12000 source without opening P12201 handoff", async () => {
  const result = await buildDomainPackSdkV2(options({ saasQualityGatePacks: P12000_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.domain_pack_sdk_v2_status, "blocked_domain_pack_sdk_v2");
  assert.equal(result.summary.source_ready_for_p12001_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12201_handoff, false);
  assert.equal(result.domain_pack_sdk_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p12200_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
});

test("Domain Pack SDK v2 fails validation if P12000 source is missing", async () => {
  const result = await buildDomainPackSdkV2(options({ saasQualityGatePacks: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.domain_pack_sdk_v2_status, "blocked_domain_pack_sdk_v2");
  assert.equal(result.domain_pack_sdk_boundary.source_saas_quality_gate_packs_available, false);
});

test("Domain Pack SDK v2 boundary keeps protected capabilities closed", async () => {
  const result = await buildDomainPackSdkV2(options());
  const boundary = result.domain_pack_sdk_boundary;

  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.final_approval_ui_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.domain_pack_product_identity_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Domain Pack SDK v2 HTML is read-only and avoids unsafe trust copy", async () => {
  const result = await buildDomainPackSdkV2(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|approve now|merge now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Domain Pack SDK v2 --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "domain-pack-sdk-v2-"));
  const sentinelPath = path.join(outDir, "domain-pack-sdk-v2.json");
  const sentinel = "{ \"sentinel\": \"domain-pack-sdk-v2\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runDomainPackSdkV2(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
