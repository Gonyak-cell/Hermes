import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isHermesRepoRoot, resolveHermesRepoRoot } from "../src/main/repo-root.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const APP_DIR = path.join(REPO_ROOT, "apps", "desktop");

test("desktop repo root resolver accepts the checked-out Hermes root", () => {
  assert.equal(isHermesRepoRoot(REPO_ROOT), true);
  assert.equal(resolveHermesRepoRoot({ appDir: APP_DIR, env: { HERMES_REPO_ROOT: REPO_ROOT } }), realpathSync(REPO_ROOT));
});

test("desktop repo root resolver ignores invalid HERMES_REPO_ROOT values", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-invalid-root-"));
  try {
    assert.equal(isHermesRepoRoot(tmpDir), false);
    assert.equal(resolveHermesRepoRoot({ appDir: APP_DIR, env: { HERMES_REPO_ROOT: tmpDir } }), realpathSync(REPO_ROOT));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("desktop repo root resolver falls back when HERMES_REPO_ROOT is unset", () => {
  assert.equal(resolveHermesRepoRoot({ appDir: APP_DIR, env: {} }), realpathSync(REPO_ROOT));
});
