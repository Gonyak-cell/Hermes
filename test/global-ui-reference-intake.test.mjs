import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGlobalUiReferenceIntake,
  runGlobalUiReferenceIntake,
} from "../src/global-ui-reference-intake.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const INLINE_REFERENCE_PACK = {
  available: true,
  path: "inline.operator-console-reference",
  files: [
    {
      relative_path: "hermes-p9000-ui-plan.md",
      file_kind: "reference_plan",
      bytes: 1200,
      sha256: "a".repeat(64),
    },
    {
      relative_path: "report.html",
      file_kind: "research_report",
      bytes: 2400,
      sha256: "b".repeat(64),
    },
    {
      relative_path: "references/linear-product-development-system.png",
      file_kind: "comparative_screenshot",
      bytes: 3600,
      sha256: "c".repeat(64),
    },
  ],
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    referencePack: INLINE_REFERENCE_PACK,
    ...overrides,
  };
}

test("Global UI reference intake validates the P10801-P11800 detailed plan", async () => {
  const result = await buildGlobalUiReferenceIntake(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "global-ui-reference-intake.v1");
  assert.equal(result.program_range, "P10801-P11000");
  assert.equal(result.design_system_range, "P10801-P11800");
  assert.equal(result.summary.global_ui_reference_intake_status, "ready_for_global_ui_reference_intake");
  assert.equal(result.summary.phase_count, 50);
  assert.equal(result.summary.ready_for_p11001_handoff, true);
  assert.equal(result.summary.ready_for_p11801_handoff, false);
});

test("Global UI reference intake covers every 20-phase slice through P11800", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const phases = new Set(result.p10801_p11800_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P10801-P10820", "P10981-P11000", "P11001-P11020", "P11181-P11200", "P11201-P11220", "P11381-P11400", "P11401-P11420", "P11581-P11600", "P11601-P11620", "P11781-P11800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.p10801_p11800_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Global UI reference intake treats local reference pack as evidence refs only", async () => {
  const result = await buildGlobalUiReferenceIntake(options());

  assert.equal(result.reference_pack_source_rows.length, 3);
  assert.equal(result.reference_pack_source_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.reference_pack_source_rows.every((row) => row.body_embedded === false), true);
  assert.equal(result.reference_pack_source_rows.every((row) => row.binary_embedded === false), true);
  assert.equal(result.reference_pack_source_rows.every((row) => row.product_asset_enabled === false), true);
});

test("Global UI reference intake reclassifies misleading UI language", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const renames = new Map(result.reference_reclassification_rows.map((row) => [row.original_phrase, row.required_phrase]));

  assert.equal(renames.get("P9000 UI Reference Plan"), "Hermes Global Operator Console Reference");
  assert.equal(renames.get("Conversation Source Queue"), "Conversation Source saved view");
  assert.equal(renames.get("AI Review Surface"), "Review Evidence Trace");
  assert.equal(renames.get("Scorecard"), "Readiness Rule Matrix");
  assert.equal(result.reference_reclassification_rows.every((row) => row.old_phrase_allowed_in_product_ui === false), true);
});

test("Global UI reference intake fixes the trace spine and navigation contract", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const trace = result.trace_spine_rows.map((row) => row.label);
  const nav = new Set(result.navigation_contract_rows.map((row) => row.label));

  assert.deepEqual(trace, ["Source", "Claim", "Requirement", "Evidence", "Gate", "Review", "Verdict", "Next Action"]);
  for (const item of ["Queue", "Projects", "Requirements", "Evidence", "Reviews", "Gates", "Conversations", "Actions", "Domain Packs", "Governance", "Audit"]) {
    assert.equal(nav.has(item), true);
  }
  assert.equal(result.navigation_contract_rows.every((row) => row.write_enabled === false), true);
});

test("Global UI reference intake defines allowed status and forbidden product claims", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const allowed = new Set(result.status_vocabulary_rows.map((row) => row.label));
  const forbidden = new Set(result.forbidden_language_rows.map((row) => row.label));

  for (const status of ["BLOCKED", "NEEDS_REVIEW", "MISSING_EVIDENCE", "READY_FOR_HANDOFF", "READ_ONLY", "LOWER_TRUST", "CANDIDATE", "VALIDATED"]) {
    assert.equal(allowed.has(status), true);
  }
  for (const copy of ["AI approved", "Claude approved", "Codex approved", "Production ready", "Enterprise PASS", "Smart insight", "Auto resolved"]) {
    assert.equal(forbidden.has(copy), true);
  }
  assert.equal(result.forbidden_language_rows.every((row) => row.allowed_in_product_ui === false), true);
});

test("Global UI reference intake defines tokens, components, and surfaces", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const components = new Set(result.component_contract_rows.map((row) => row.label));
  const surfaces = new Set(result.ui_surface_contract_rows.map((row) => row.label));

  assert.equal(result.design_token_rows.length, 8);
  for (const component of ["GlobalShell", "SavedViewSidebar", "OperatorQueueTable", "ObjectInspectorPanel", "TraceSpine", "ReadinessRuleMatrix", "ReviewEvidenceTrace"]) {
    assert.equal(components.has(component), true);
  }
  for (const surface of ["Global Operator Queue", "Object Inspector Panel", "Requirement Trace Detail", "Review Gate Detail", "Evidence Timeline", "Conversation Source Detail", "Domain Pack Detail", "Governance/Audit Surface"]) {
    assert.equal(surfaces.has(surface), true);
  }
  assert.equal(result.ui_surface_contract_rows.every((row) => row.read_only === true && row.write_control_enabled === false), true);
});

test("Global UI reference intake negative fixtures block unsafe UI claims", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const fixtures = new Set(result.ui_negative_fixture_rows.map((row) => row.row_id));

  for (const fixture of ["negative.raw_body_visible", "negative.secret_key_visible", "negative.write_button", "negative.final_approver_codex", "negative.final_approver_claude", "negative.production_ready_copy", "negative.enterprise_pass_copy", "negative.ai_approved_copy", "negative.scorecard_kpi", "negative.domain_as_product", "negative.phase_as_top_nav", "negative.card_report_home"]) {
    assert.equal(fixtures.has(fixture), true);
  }
  assert.equal(result.ui_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.ui_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Global UI reference intake boundary opens no write final approval or production trust", async () => {
  const result = await buildGlobalUiReferenceIntake(options());
  const boundary = result.global_ui_reference_boundary;

  assert.equal(boundary.global_ui_reference_intake_ready, true);
  assert.equal(boundary.ready_for_p11001_handoff, true);
  assert.equal(boundary.ready_for_p11801_handoff, false);
  assert.equal(boundary.p11800_design_system_freeze_ready, false);
  assert.equal(boundary.source_body_embedded, false);
  assert.equal(boundary.binary_body_embedded, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.secret_key_exposure_allowed, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.final_approval_ui_enabled, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_ui_enabled, false);
  assert.equal(boundary.enterprise_pass_ui_enabled, false);
  assert.equal(boundary.domain_pack_product_identity_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Global UI reference intake HTML is read-only and does not expose unsafe controls", async () => {
  const result = await buildGlobalUiReferenceIntake(options());

  assert.equal(/<form|<button|type="submit"|apply now|merge now|delete now|send now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Global UI reference intake supports optional missing local reference pack", async () => {
  const result = await buildGlobalUiReferenceIntake(options({
    referencePack: {
      available: false,
      path: "missing.local.reference.pack",
      files: [],
      error: "not found",
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.global_ui_reference_boundary.local_reference_pack_available, false);
  assert.equal(result.reference_pack_source_rows.length, 1);
  assert.equal(result.reference_pack_source_rows[0].required, false);
});

test("Global UI reference intake --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "global-ui-reference-intake-"));
  const sentinelPath = path.join(outDir, "global-ui-reference-intake.json");
  const sentinel = "{ \"sentinel\": \"global-ui-reference-intake\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runGlobalUiReferenceIntake(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
