import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { collectCheckModeGuardFindings } from "../src/check-mode-guard-normalization.mjs";

const repoRoot = path.resolve(".");

test("--check CLI parsers disable artifact writes for guarded generators", async () => {
  const scan = await collectCheckModeGuardFindings({ repoRoot, srcDir: path.join(repoRoot, "src") });
  const offenders = scan.findings.map((item) => `${item.file_path}: ${item.message}`);

  assert.deepEqual(offenders, []);
});

test("representative --check generator preserves existing out-dir artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-check-no-write-"));
  try {
    const sentinelPath = path.join(root, "policy-matrix-catalog.json");
    const sentinel = '{ "sentinel": "policy-matrix-catalog" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const check = spawnSync("node", [
      "scripts/policy-matrix-catalog.mjs",
      "--check",
      "--out-dir",
      root,
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
