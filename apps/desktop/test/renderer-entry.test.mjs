import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MISSING_BUILD_FALLBACK_RELATIVE_PATH,
  RENDERER_ENTRY_RELATIVE_PATH,
  resolveRendererEntry,
} from "../src/main/renderer-entry.mjs";

test("desktop renderer entry resolves the built renderer when present", async () => {
  const appDir = await mkdtemp(path.join(os.tmpdir(), "hermes-renderer-entry-"));
  try {
    const rendererPath = path.join(appDir, RENDERER_ENTRY_RELATIVE_PATH);
    await mkdir(path.dirname(rendererPath), { recursive: true });
    await writeFile(rendererPath, "<!doctype html><title>Hermes</title>", "utf8");

    const entry = await resolveRendererEntry({ appDir });

    assert.equal(entry.status, "ready");
    assert.equal(entry.load_path, rendererPath);
    assert.equal(entry.missing_path, null);
    assert.equal(entry.query, undefined);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test("desktop renderer entry falls back with a build command when renderer is missing", async () => {
  const appDir = await mkdtemp(path.join(os.tmpdir(), "hermes-renderer-entry-"));
  try {
    const entry = await resolveRendererEntry({ appDir });

    assert.equal(entry.status, "missing_build");
    assert.equal(entry.load_path, path.join(appDir, MISSING_BUILD_FALLBACK_RELATIVE_PATH));
    assert.equal(entry.missing_path, path.join(appDir, RENDERER_ENTRY_RELATIVE_PATH));
    assert.equal(entry.query.command, "npm run desktop:build");
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});
