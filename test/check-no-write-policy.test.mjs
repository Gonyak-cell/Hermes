import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const repoRoot = path.resolve(".");

test("--check CLI parsers disable artifact writes for guarded generators", async () => {
  const offenders = [];
  for (const filePath of await listMjsFiles(path.join(repoRoot, "src"))) {
    const source = await readFile(filePath, "utf8");
    if (!source.includes("options.write !== false") || !source.includes("--check")) continue;
    const checkBranches = [...source.matchAll(/(?:if|else if)\s*\(arg\s*===\s*"--check"\)\s*\{([\s\S]*?)\n\s*\}/g)];
    if (checkBranches.length === 0) {
      offenders.push(relativePath(filePath, "has --check and write guard but no parse branch block"));
      continue;
    }
    for (const branch of checkBranches) {
      if (!/\.(?:check)\s*=\s*true;/.test(branch[1]) || !/\.write\s*=\s*false;/.test(branch[1])) {
        offenders.push(relativePath(filePath, "sets check without disabling write"));
      }
    }
  }

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

async function listMjsFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listMjsFiles(filePath));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(filePath);
  }
  return files;
}

function relativePath(filePath, message) {
  return `${path.relative(repoRoot, filePath).replaceAll(path.sep, "/")}: ${message}`;
}
