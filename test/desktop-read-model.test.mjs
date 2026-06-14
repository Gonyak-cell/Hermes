import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDesktopReadModel,
  containsForbiddenTrustString,
  isAllowedDesktopReadPath,
  isDeniedDesktopReadPath,
  runDesktopReadModel,
} from "../src/desktop-read-model.mjs";

const RUN_AT = "2026-06-14T09:30:00.000Z";

test("Desktop read model projects release, factory, review, operator, artifact, and authority sections as read-only data", async () => {
  const fixture = await createReadModelFixture();
  try {
    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.schema_version, "desktop-read-model.v1");
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
    assert.equal(result.summary.source_count, 18);
    assert.equal(result.summary.ready_source_count, 18);
    assert.equal(result.summary.section_count, 6);
    assert.equal(result.summary.ready_section_count, 6);
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.summary.authority_boundary_ready, true);
    assert.equal(result.summary.raw_payload_read_allowed, false);
    assert.equal(result.summary.secret_like_path_read_allowed, false);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.summary.enterprise_pass_enabled, false);
    assert.equal(result.sections.every((section) => section.source_path && section.generated_at && section.status && Object.hasOwn(section, "blocker") && Array.isArray(section.section_refs)), true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model fails closed when a required source is missing", async () => {
  const fixture = await createReadModelFixture();
  const missingPath = path.join(fixture.tmpDir, "missing-factory-stage-67.md");
  try {
    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      factoryStage67SummaryPath: missingPath,
      allowlist: [...fixture.allowlist.filter((entry) => entry !== fixture.options.factoryStage67SummaryPath), missingPath],
    });

    const missingRow = result.source_rows.find((row) => row.source_id === "factory_stage_6_7");
    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.desktop_read_model_status, "blocked_desktop_shell");
    assert.equal(missingRow.status, "blocked");
    assert.match(missingRow.blocker, /Missing required source/);
    assert.equal(result.sections.find((section) => section.section_id === "factory").status, "blocked");
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.desktop_write_authority_enabled, false);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model check mode can validate without writing artifacts", async () => {
  const fixture = await createReadModelFixture();
  const outDir = path.join(fixture.tmpDir, "out");
  try {
    const result = await runDesktopReadModel({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.desktop_read_model_status, "ready_for_desktop_shell");
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model denylist takes precedence over allowlist", () => {
  const rawOutputPath = "artifacts/example/review/raw-output.json";
  const secretPath = "artifacts/example/secret-material.json";
  const envPath = ".env.local";

  assert.equal(isDeniedDesktopReadPath(rawOutputPath), true);
  assert.equal(isDeniedDesktopReadPath(secretPath), true);
  assert.equal(isDeniedDesktopReadPath(envPath), true);
  assert.equal(isAllowedDesktopReadPath(rawOutputPath, [rawOutputPath]), false);
  assert.equal(isAllowedDesktopReadPath(secretPath, [secretPath]), false);
  assert.equal(isAllowedDesktopReadPath(envPath, [envPath]), false);
});

test("Desktop read model recognizes forbidden trust claim strings", () => {
  assert.equal(containsForbiddenTrustString("This is production PASS."), true);
  assert.equal(containsForbiddenTrustString("desktop write authority enabled"), true);
  assert.equal(containsForbiddenTrustString("single-owner lower-trust RC only"), false);
});

async function createReadModelFixture() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-read-"));
  const file = (name) => path.join(tmpDir, name);
  const options = {
    packagePath: file("package.json"),
    releaseOwnerDecisionPath: file("release-owner.md"),
    releaseDecisionPacketPath: file("release-decision.md"),
    productionLaunchChecklistPath: file("production-checklist.md"),
    githubFinalReviewPacketPath: file("github-review.md"),
    releaseNoteTagDraftPath: file("release-note.md"),
    desktopPlanPath: file("desktop-plan.md"),
    operatorHandbookPath: file("operator-handbook.json"),
    operatorSurfacesPath: file("operator-surfaces.json"),
    operatorScreensPath: file("operator-screens.json"),
    operatorWorkflowsPath: file("operator-workflows.json"),
    operatorGatesPath: file("operator-gates.json"),
    operatorHandbookBoundaryPath: file("operator-handbook-boundary.json"),
    releaseReadinessSummaryPath: file("release-readiness.md"),
    productionGovernanceSummaryPath: file("production-governance.md"),
    p16800FreezeSummaryPath: file("p16800.md"),
    factoryGateOpeningSummaryPath: file("factory-gate.md"),
    factoryStage67SummaryPath: file("factory-stage-67.md"),
    desktopAuthorityBoundaryPath: file("desktop-authority-boundary.json"),
  };
  await writeFile(options.packagePath, JSON.stringify({ scripts: { "desktop:read-model": "node scripts/desktop-read-model.mjs" } }, null, 2), "utf8");
  for (const markdownPath of [
    options.releaseOwnerDecisionPath,
    options.releaseDecisionPacketPath,
    options.productionLaunchChecklistPath,
    options.githubFinalReviewPacketPath,
    options.releaseNoteTagDraftPath,
    options.desktopPlanPath,
    options.releaseReadinessSummaryPath,
    options.productionGovernanceSummaryPath,
    options.p16800FreezeSummaryPath,
    options.factoryGateOpeningSummaryPath,
    options.factoryStage67SummaryPath,
  ]) {
    await writeFile(markdownPath, "# Fixture\n\nsingle-owner lower-trust RC only.\n", "utf8");
  }
  await writeFile(options.operatorHandbookPath, JSON.stringify({ schema_version: "operator-handbook.v1", summary: { operator_handbook_status: "complete", operator_handbook_id: "operator-handbook.test" } }, null, 2), "utf8");
  await writeFile(options.operatorSurfacesPath, JSON.stringify({ schema_version: "operator-surfaces.v1", operator_surface_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorScreensPath, JSON.stringify({ schema_version: "operator-screens.v1", operator_screen_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorWorkflowsPath, JSON.stringify({ schema_version: "operator-workflows.v1", operator_workflow_rows: [] }, null, 2), "utf8");
  await writeFile(options.operatorGatesPath, JSON.stringify({ schema_version: "operator-gates.v1", operator_gate_results: [] }, null, 2), "utf8");
  await writeFile(options.operatorHandbookBoundaryPath, JSON.stringify({
    schema_version: "operator-handbook-boundary.v1",
    desktop_read_only: true,
    desktop_source_of_truth: false,
  }, null, 2), "utf8");
  await writeFile(options.desktopAuthorityBoundaryPath, JSON.stringify({
    schema_version: "desktop-authority-boundary.v1",
    summary: {
      desktop_authority_boundary_status: "enforced_read_only_desktop_boundary",
      unsafe_flag_count: 0,
      ready_for_desktop_read_model: true,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      protected_closeout_enabled: false,
      desktop_write_authority_enabled: false,
    },
  }, null, 2), "utf8");
  return {
    tmpDir,
    options,
    allowlist: Object.values(options),
  };
}
