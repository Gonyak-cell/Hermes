import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDesktopAuthorityBoundary,
  runDesktopAuthorityBoundary,
} from "../src/desktop-authority-boundary.mjs";

const RUN_AT = "2026-06-14T09:00:00.000Z";

test("Desktop authority boundary closes forbidden capabilities and binds operator handbook", async () => {
  const fixture = await createAuthorityFixture();
  try {
    const result = await buildDesktopAuthorityBoundary({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.schema_version, "desktop-authority-boundary.v1");
    assert.equal(result.summary.desktop_authority_boundary_status, "enforced_read_only_desktop_boundary");
    assert.equal(result.summary.closed_forbidden_capability_count, 14);
    assert.equal(result.summary.ready_electron_security_row_count, 10);
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.summary.unsafe_flag_count, 0);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.summary.enterprise_pass_enabled, false);
    assert.equal(result.summary.desktop_write_authority_enabled, false);
    assert.equal(result.forbidden_capability_rows.every((row) => row.negative_fixture_id && row.negative_fixture_description), true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop authority boundary preserves blocked operator-handbook binding as visible validation evidence", async () => {
  const fixture = await createAuthorityFixture({ operatorBoundary: { desktop_read_only: false, desktop_source_of_truth: true } });
  try {
    const result = await buildDesktopAuthorityBoundary({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.desktop_authority_boundary_status, "blocked_desktop_boundary");
    assert.equal(result.summary.operator_handbook_bound, false);
    assert.equal(result.operator_handbook_binding_rows.some((row) => row.current_verdict === "blocked" && row.blocker), true);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.desktop_write_authority_enabled, false);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop authority boundary check mode can validate without writing artifacts", async () => {
  const fixture = await createAuthorityFixture();
  const outDir = path.join(fixture.tmpDir, "out");
  try {
    const result = await runDesktopAuthorityBoundary({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(() => stat(path.join(outDir, "desktop-authority-boundary.json")));
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

async function createAuthorityFixture(overrides = {}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-authority-"));
  const packagePath = path.join(tmpDir, "package.json");
  const desktopPlanPath = path.join(tmpDir, "desktop-plan.md");
  const operatorHandbookPath = path.join(tmpDir, "operator-handbook.json");
  const operatorHandbookBoundaryPath = path.join(tmpDir, "operator-handbook-boundary.json");
  await writeFile(packagePath, JSON.stringify({ scripts: { "desktop:authority-boundary": "node scripts/desktop-authority-boundary.mjs" } }, null, 2), "utf8");
  await writeFile(desktopPlanPath, [
    "# Desktop Plan",
    "TUW D1.1 - Desktop Authority Boundary",
    "TUW D1.2 - Read Model Contract",
    "BrowserWindow webPreferences include sandbox: true, contextIsolation: true, webSecurity: true, nodeIntegration: false, and nodeIntegrationInWorker: false.",
    "Disable remote module.",
    "Apply strict Content-Security-Policy for local resources only.",
    "Restrict external navigation.",
    "Use allowlisted preload API.",
    "Include outbound renderer network denial tests.",
    "Block renderer `fetch` / XHR to non-local origins.",
  ].join("\n"), "utf8");
  await writeFile(operatorHandbookPath, JSON.stringify({ schema_version: "operator-handbook.v1", summary: { operator_handbook_status: "complete" } }, null, 2), "utf8");
  await writeFile(operatorHandbookBoundaryPath, JSON.stringify({
    schema_version: "operator-handbook-boundary.v1",
    read_only: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    source_content_read_performed: false,
    source_artifact_mutation_performed: false,
    command_execution_performed: false,
    route_execution_performed: false,
    recovery_execution_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    ...(overrides.operatorBoundary ?? {}),
  }, null, 2), "utf8");
  await readFile("schemas/desktop-authority-boundary.schema.json", "utf8");
  return {
    tmpDir,
    options: {
      packagePath,
      desktopPlanPath,
      operatorHandbookPath,
      operatorHandbookBoundaryPath,
    },
  };
}
