import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGlobalUiContract,
  buildGlobalUiContractApiResponse,
  runGlobalUiContract,
  startGlobalUiContractApiServer,
} from "../src/global-ui-contract.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P11000_READY = {
  schema_version: "global-ui-reference-intake.v1",
  program_range: "P10801-P11000",
  design_system_range: "P10801-P11800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    global_ui_reference_intake_status: "ready_for_global_ui_reference_intake",
    ready_for_p11001_handoff: true,
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
    globalUiReferenceIntake: P11000_READY,
    ...overrides,
  };
}

test("Global UI contract consumes P10801 source and freezes P11001-P11200", async () => {
  const result = await buildGlobalUiContract(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "global-ui-contract.v1");
  assert.equal(result.program_range, "P11001-P11200");
  assert.equal(result.source_program_range, "P10801-P11000");
  assert.equal(result.summary.global_ui_contract_status, "ready_for_global_ui_contract");
  assert.equal(result.summary.source_ready_for_p11001_handoff, true);
  assert.equal(result.summary.ready_for_p11201_handoff, true);
  assert.equal(result.summary.ready_for_p11801_handoff, false);
});

test("Global UI contract covers all phase rows through P11200", async () => {
  const result = await buildGlobalUiContract(options());
  const phases = new Set(result.global_ui_contract_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P11001-P11020", "P11021-P11040", "P11041-P11060", "P11061-P11080", "P11081-P11100", "P11101-P11120", "P11121-P11140", "P11141-P11160", "P11161-P11180", "P11181-P11200"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.global_ui_contract_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Global UI contract defines the eight-object trace model", async () => {
  const result = await buildGlobalUiContract(options());
  const objectTypes = result.global_object_model_rows.map((row) => row.object_type);

  assert.deepEqual(objectTypes, ["source", "claim", "requirement", "evidence", "gate", "review", "verdict", "action"]);
  assert.equal(result.global_object_model_rows.every((row) => row.stable_id_required === true), true);
  assert.equal(result.global_object_model_rows.every((row) => row.raw_body_allowed === false && row.secret_key_allowed === false), true);
  assert.equal(result.global_object_model_rows.every((row) => row.write_enabled === false && row.final_approval_enabled === false), true);
});

test("Global UI contract fixes navigation without phase top-nav or write affordances", async () => {
  const result = await buildGlobalUiContract(options());
  const nav = new Set(result.global_navigation_ia_rows.map((row) => row.label));

  for (const item of ["Queue", "Projects", "Requirements", "Evidence", "Reviews", "Gates", "Conversations", "Actions", "Domain Packs", "Governance", "Audit"]) {
    assert.equal(nav.has(item), true);
  }
  assert.equal(result.global_navigation_ia_rows.every((row) => row.top_level_allowed === true), true);
  assert.equal(result.global_navigation_ia_rows.every((row) => row.phase_tranche_top_nav_allowed === false), true);
  assert.equal(result.global_navigation_ia_rows.every((row) => row.write_enabled === false && row.raw_body_visible === false), true);
});

test("Global UI contract defines inspector, review gate, conversation, and domain boundaries", async () => {
  const result = await buildGlobalUiContract(options());

  assert.equal(result.object_inspector_contract_rows.length >= 10, true);
  assert.equal(result.object_inspector_contract_rows.every((row) => row.right_panel_section === true && row.write_control_enabled === false), true);
  assert.equal(result.review_gate_boundary_rows.every((row) => row.approval_button_allowed === false && row.reviewer_final_approval_allowed === false), true);
  assert.equal(result.conversation_source_detail_rows.every((row) => row.raw_body_visible === false && row.full_body_visible === false && row.auto_truth_enabled === false), true);
  assert.equal(result.domain_pack_context_rows.every((row) => row.context_only === true && row.product_identity_enabled === false), true);
});

test("Global UI contract negative invariants block unsafe UI claims", async () => {
  const result = await buildGlobalUiContract(options());
  const fixtures = new Set(result.ui_negative_invariant_rows.map((row) => row.row_id));

  for (const fixture of ["negative.raw_body_visible", "negative.secret_key_visible", "negative.write_control", "negative.protected_action", "negative.codex_final_approval", "negative.claude_final_approval", "negative.production_pass", "negative.enterprise_pass", "negative.domain_as_product", "negative.phase_top_nav", "negative.auto_resolved", "negative.ai_approved"]) {
    assert.equal(fixtures.has(fixture), true);
  }
  assert.equal(result.ui_negative_invariant_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.ui_negative_invariant_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Global UI contract API projection is GET HEAD only and sanitized", async () => {
  const result = await buildGlobalUiContract(options());

  assert.equal(result.global_ui_api_route_rows.every((row) => row.methods_allowed.includes("GET") && row.methods_allowed.includes("HEAD")), true);
  assert.equal(result.global_ui_api_route_rows.every((row) => row.write_enabled === false && row.mutates_state === false), true);

  const response = await buildGlobalUiContractApiResponse("/api/global-ui/objects", options());
  assert.equal(response.status, 200);
  assert.equal(hasSensitiveKey(JSON.parse(response.body)), false);

  const blocked = await buildGlobalUiContractApiResponse("/api/global-ui/objects", { ...options(), method: "POST" });
  assert.equal(blocked.status, 405);
});

test("Global UI contract API server serves summary route", async () => {
  const { server, url } = await startGlobalUiContractApiServer({ ...options(), port: 0 });
  try {
    const response = await fetch(`${url}/api/global-ui/summary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ready_for_p11201_handoff, true);
    assert.equal(body.write_control_enabled, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Global UI contract accessibility and freeze rows keep P11800 closed", async () => {
  const result = await buildGlobalUiContract(options());
  const boundary = result.global_ui_contract_boundary;

  assert.equal(result.accessibility_density_rows.length, 10);
  assert.equal(result.accessibility_density_rows.every((row) => row.accessibility_required === true && row.overlap_allowed === false), true);
  assert.equal(result.p11200_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.global_ui_contract_ready, true);
  assert.equal(boundary.p11201_token_component_handoff_ready, true);
  assert.equal(boundary.p11800_design_system_freeze_ready, false);
  assert.equal(boundary.ready_for_p11801_handoff, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Global UI contract blocks if P10801 source is not ready", async () => {
  const result = await buildGlobalUiContract(options({
    globalUiReferenceIntake: {
      schema_version: "global-ui-reference-intake.v1",
      summary: {
        global_ui_reference_intake_status: "blocked_global_ui_reference_intake",
        ready_for_p11001_handoff: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_ready_for_p11001_handoff, false);
  assert.equal(result.summary.global_ui_contract_status, "blocked_global_ui_contract");
});

test("Global UI contract HTML is read-only and does not expose unsafe controls", async () => {
  const result = await buildGlobalUiContract(options());

  assert.equal(/<form|<button|type="submit"|apply now|merge now|delete now|send now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Global UI contract --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "global-ui-contract-"));
  const sentinelPath = path.join(outDir, "global-ui-contract.json");
  const sentinel = "{ \"sentinel\": \"global-ui-contract\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runGlobalUiContract(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => /(^raw_|raw_|full_transcript|full_body|secret|api_key|token|authorization|body_embedded|binary_embedded)/i.test(key) || hasSensitiveKey(entry));
}
