import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCheckModeScannerRobustness } from "../src/check-mode-scanner-robustness.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";

test("Check-Mode Scanner Robustness closes P18400 scanner finding classes", async () => {
  const result = await buildCheckModeScannerRobustness({ runAt: RUN_AT, write: false });

  assert.equal(result.schema_version, "check-mode-scanner-robustness.v1");
  assert.equal(result.program_range, "P18401-P18800");
  assert.equal(result.source_program_range, "P18001-P18400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.finding_closure_count, 7);
  assert.equal(result.summary.blocking_finding_count, 0);
  assert.equal(result.summary.parser_fixture_passed_now, true);
  assert.equal(result.summary.tokenizer_fixture_passed_now, true);
  assert.equal(result.summary.ready_for_p18801_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Check-Mode Scanner Robustness covers every planned phase", async () => {
  const result = await buildCheckModeScannerRobustness({ runAt: RUN_AT, write: false });
  const phases = new Set(result.scanner_robustness_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P18401-P18440", "P18441-P18520", "P18521-P18600", "P18601-P18680", "P18681-P18740", "P18741-P18800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.scanner_robustness_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Check-Mode Scanner Robustness preserves protected authority boundaries", async () => {
  const result = await buildCheckModeScannerRobustness({ runAt: RUN_AT, write: false });
  const protectedFalseFlags = [
    "deployment_allowed_now",
    "release_approval_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "enterprise_trust_claim_allowed_now",
    "protected_closeout_enabled",
    "human_gate_bypass_allowed_now",
    "independent_review_bypass_allowed_now",
    "single_owner_enterprise_trust_allowed_now",
    "runtime_execution_allowed_now",
    "write_action_allowed_now",
    "protected_action_allowed_now",
    "connector_write_enabled",
    "external_service_mutation_allowed_now",
    "raw_source_exposure_allowed",
    "secret_read_allowed_now",
    "reviewer_mutation_allowed_now",
    "final_automated_approval_allowed",
  ];

  for (const flag of protectedFalseFlags) {
    assert.equal(result.scanner_robustness_boundary[flag], false, flag);
  }
  assert.equal(result.guard_convention_rows.some((row) => row.row_id === "unsupported_member_expression_condition"), true);
  assert.equal(result.guard_convention_rows.some((row) => row.row_id === "unsupported_template_literal_condition"), true);
  assert.equal(result.guard_convention_rows.some((row) => row.row_id === "unsupported_destructured_flag_condition"), true);
  assert.equal(result.parser_shape_fixture_rows.some((row) => row.row_id === "alternate_parser_missing_write_blocked"), true);
  assert.equal(result.tokenizer_fixture_rows.some((row) => row.row_id === "unterminated_template_blocked"), true);
  assert.equal(result.scanner_finding_closure_rows.some((row) => row.closure_status === "resolved"), true);
});

test("Check-Mode Scanner Robustness --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-check-mode-scanner-"));
  try {
    const sentinelPath = path.join(root, "check-mode-scanner-robustness.json");
    const sentinel = '{ "sentinel": "check-mode-scanner" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/check-mode-scanner-robustness.mjs",
      "--check",
      "--out-dir",
      root,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
