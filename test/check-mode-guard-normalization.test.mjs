import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildCheckModeGuardNormalization,
  collectCheckModeGuardFindingsFromSource,
} from "../src/check-mode-guard-normalization.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";

test("Check-Mode Guard Normalization scans value-based one-line branches without false positives", () => {
  const row = collectCheckModeGuardFindingsFromSource(
    "fixture/value-ok.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const value of argv) { if (value === \"--check\") { args.check = true; args.write = false; } } }",
  );

  assert.equal(row.guarded_generator, true);
  assert.equal(row.check_branch_count, 1);
  assert.deepEqual(row.findings, []);
});

test("Check-Mode Guard Normalization scans arg-based multi-line branches without false positives", () => {
  const row = collectCheckModeGuardFindingsFromSource(
    "fixture/arg-ok.mjs",
    [
      "if (options.write !== false) await write();",
      "function parseArgs(argv) {",
      "  const args = {};",
      "  for (const arg of argv) {",
      "    if (arg === \"--check\") {",
      "      args.check = true;",
      "      args.write = false;",
      "    }",
      "  }",
      "}",
    ].join("\n"),
  );

  assert.equal(row.check_branch_count, 1);
  assert.deepEqual(row.findings, []);
});

test("Check-Mode Guard Normalization flags missing write disable and missing branch", () => {
  const missingWrite = collectCheckModeGuardFindingsFromSource(
    "fixture/missing-write.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const value of argv) { if (value === \"--check\") { args.check = true; } } }",
  );
  const missingBranch = collectCheckModeGuardFindingsFromSource(
    "fixture/missing-branch.mjs",
    "if (options.write !== false) await write(); function printHelp() { console.log(\"--check\"); }",
  );

  assert.equal(missingWrite.findings.length, 1);
  assert.equal(missingWrite.findings[0].finding_type, "check_without_write_false");
  assert.equal(missingBranch.findings.length, 1);
  assert.equal(missingBranch.findings[0].finding_type, "missing_check_branch");
});

test("Check-Mode Guard Normalization covers parser shapes beyond variable-left strict equality", () => {
  const fixtures = [
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (\"--check\" === arg) { args.check = true; args.write = false; } } }",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg == \"--check\") { args.check = true; args.write = false; } } }",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { switch (arg) { case \"--check\": args.check = true; args.write = false; break; default: break; } } }",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if ([\"--check\"].includes(arg)) { args.check = true; args.write = false; } } }",
  ];

  for (const [index, source] of fixtures.entries()) {
    const row = collectCheckModeGuardFindingsFromSource(`fixture/parser-${index}.mjs`, source);
    assert.equal(row.check_branch_count, 1);
    assert.deepEqual(row.findings, []);
  }
});

test("Check-Mode Guard Normalization scans alternate check handlers even when parseArgs exists", () => {
  const row = collectCheckModeGuardFindingsFromSource(
    "fixture/alternate-parser.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; args.write = false; } } } const parseOptions = (argv) => { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; } } };",
  );

  assert.equal(row.check_branch_count, 2);
  assert.equal(row.findings.length, 1);
  assert.equal(row.findings[0].finding_type, "check_without_write_false");
});

test("Check-Mode Guard Normalization ignores comments strings and mismatched check literals", () => {
  const commentedWrite = collectCheckModeGuardFindingsFromSource(
    "fixture/commented-write.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; // args.write = false;\n } } }",
  );
  const stringWrite = collectCheckModeGuardFindingsFromSource(
    "fixture/string-write.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; const fake = \"args.write = false\"; } } }",
  );
  const stringBrace = collectCheckModeGuardFindingsFromSource(
    "fixture/string-brace.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { const sample = \"}\"; args.check = true; args.write = false; } } }",
  );
  const mismatchedQuote = collectCheckModeGuardFindingsFromSource(
    "fixture/mismatched-quote.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check') { args.check = true; args.write = false; } } }",
  );
  const unterminatedTemplate = collectCheckModeGuardFindingsFromSource(
    "fixture/unterminated-template.mjs",
    "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === `--check) { args.check = true; args.write = false; } } }",
  );

  assert.equal(commentedWrite.findings[0].finding_type, "check_without_write_false");
  assert.equal(stringWrite.findings[0].finding_type, "check_without_write_false");
  assert.deepEqual(stringBrace.findings, []);
  assert.equal(mismatchedQuote.findings[0].finding_type, "unterminated_string_literal");
  assert.equal(unterminatedTemplate.findings[0].finding_type, "unterminated_template_literal");
});

test("Check-Mode Guard Normalization builds a ready handoff while preserving protected boundaries", async () => {
  const result = await buildCheckModeGuardNormalization({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "check-mode-guard-normalization.v1");
  assert.equal(result.program_range, "P18001-P18400");
  assert.equal(result.source_program_range, "P17601-P18000");
  assert.equal(result.summary.offender_count, 0);
  assert.equal(result.summary.scanner_fixture_passed_now, true);
  assert.equal(result.summary.ready_for_p18401_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.check_mode_guard_boundary.runtime_execution_allowed_now, false);
  assert.equal(result.check_mode_guard_boundary.write_action_allowed_now, false);
  assert.equal(result.check_mode_guard_boundary.connector_write_enabled, false);
  assert.equal(result.check_mode_guard_boundary.final_automated_approval_allowed, false);
});

test("Check-Mode Guard Normalization covers every planned phase", async () => {
  const result = await buildCheckModeGuardNormalization({ runAt: RUN_AT, write: false });
  const phases = new Set(result.check_mode_guard_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P18001-P18040", "P18041-P18080", "P18081-P18120", "P18121-P18160", "P18161-P18200", "P18201-P18240", "P18241-P18280", "P18281-P18320", "P18321-P18360", "P18361-P18400"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.check_mode_guard_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Check-Mode Guard Normalization preserves no-write behavior in --check mode", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-check-mode-guard-"));
  try {
    const sentinelPath = path.join(root, "check-mode-guard-normalization.json");
    const sentinel = '{ "sentinel": "check-mode-guard" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/check-mode-guard-normalization.mjs",
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
