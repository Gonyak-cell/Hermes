import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDesktopPackagingManifest,
  parseDesktopPackagingManifestArgs,
  runDesktopPackagingManifest,
} from "../src/desktop-packaging-manifest.mjs";

const RUN_AT = "2026-06-14T10:00:00.000Z";

test("Desktop packaging manifest supports local start while packaging authority stays closed", async () => {
  const fixture = await createPackagingFixture();
  try {
    const result = await buildDesktopPackagingManifest({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.desktop_packaging_status, "local_build_ready_packaging_closed");
    assert.equal(result.summary.ready_script_count, result.summary.script_count);
    assert.equal(result.summary.local_build_supported, true);
    assert.equal(result.summary.ready_for_local_desktop_start, true);
    assert.equal(result.summary.auto_update_enabled, false);
    assert.equal(result.summary.auto_update_dependency_present, false);
    assert.equal(result.summary.auto_update_import_present, false);
    assert.equal(result.summary.packaging_authority_open, false);
    assert.equal(result.summary.production_release_packaged, false);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop packaging manifest blocks updater dependencies and main-process updater terms", async () => {
  const fixture = await createPackagingFixture({
    desktopPackageExtra: { dependencies: { "electron-updater": "1.0.0" } },
    desktopMainText: "import { autoUpdater } from 'electron-updater';\nautoUpdater.checkForUpdates();\n",
  });
  try {
    const result = await buildDesktopPackagingManifest({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.desktop_packaging_status, "blocked_desktop_packaging_manifest");
    assert.equal(result.summary.auto_update_enabled, false);
    assert.equal(result.summary.auto_update_dependency_present, true);
    assert.equal(result.summary.auto_update_import_present, true);
    assert.equal(result.summary.update_write_authority_enabled, false);
    assert.equal(result.auto_update_rows.some((row) => row.status === "blocked"), true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop packaging manifest check mode validates without writing artifacts", async () => {
  const fixture = await createPackagingFixture();
  const outDir = path.join(fixture.tmpDir, "out");
  try {
    const result = await runDesktopPackagingManifest({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(() => stat(path.join(outDir, "desktop-packaging-manifest.json")));
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop packaging manifest CLI parser accepts only known flags", () => {
  assert.deepEqual(parseDesktopPackagingManifestArgs(["--check", "--desktop-main-path", "apps/desktop/main.mjs"]), {
    check: true,
    write: false,
    desktopMainPath: "apps/desktop/main.mjs",
  });
  assert.throws(() => parseDesktopPackagingManifestArgs(["--allowlist", "docs/example.md"]), /Unknown argument: --allowlist/);
  assert.throws(() => parseDesktopPackagingManifestArgs(["--desktop-main-path"]), /Missing value for --desktop-main-path/);
});

async function createPackagingFixture(overrides = {}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-packaging-"));
  const file = (name) => path.join(tmpDir, name);
  const rootPackagePath = file("package.json");
  const desktopPackagePath = file("apps/desktop/package.json");
  const desktopLockfilePath = file("apps/desktop/package-lock.json");
  const desktopMainPath = file("apps/desktop/src/main/main.mjs");
  const desktopRunbookPath = file("docs/runbook.md");

  await writeFileTree(rootPackagePath, JSON.stringify({
    scripts: {
      "desktop:build": "npm --prefix apps/desktop run build",
      "desktop:start": "npm --prefix apps/desktop start --",
      "desktop:local-preflight": "npm run desktop:read-model && npm run desktop:smoke:render",
      "desktop:smoke:render": "npm --prefix apps/desktop run smoke:render --",
    },
  }, null, 2));
  await writeFileTree(desktopPackagePath, JSON.stringify({
    scripts: {
      build: "vite build",
      start: "electron .",
      "smoke:render": "electron scripts/capture-render.mjs --assert-no-forbidden-trust-copy",
    },
    dependencies: { react: "19.2.7", ...(overrides.desktopPackageExtra?.dependencies ?? {}) },
    devDependencies: { electron: "42.4.0", vite: "8.0.16" },
    ...(overrides.desktopPackageExtra ?? {}),
  }, null, 2));
  await writeFileTree(desktopLockfilePath, JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { react: "19.2.7" }, devDependencies: { electron: "42.4.0" } },
      "node_modules/electron": { version: "42.4.0" },
    },
  }, null, 2));
  await writeFileTree(desktopMainPath, overrides.desktopMainText ?? "app.setName('Hermes Operator Desktop');\n");
  await writeFileTree(desktopRunbookPath, "Local build only. No packaging, signing, notarization, updater, or publish authority is configured.\n");

  return {
    tmpDir,
    options: {
      rootPackagePath,
      desktopPackagePath,
      desktopLockfilePath,
      desktopMainPath,
      desktopRunbookPath,
    },
  };
}

async function writeFileTree(filePath, content) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
