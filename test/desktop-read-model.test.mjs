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
  parseDesktopReadModelArgs,
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
    assert.equal(result.summary.source_count, 20);
    assert.equal(result.summary.ready_source_count, 20);
    assert.equal(result.summary.section_count, 6);
    assert.equal(result.summary.ready_section_count, 6);
    assert.equal(result.summary.operator_handbook_bound, true);
    assert.equal(result.summary.authority_boundary_ready, true);
    assert.equal(result.summary.raw_payload_read_allowed, false);
    assert.equal(result.summary.secret_like_path_read_allowed, false);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.summary.enterprise_pass_enabled, false);
    assert.equal(result.release_projection.candidate_commit, "8200ed3b754b74900a95fe5a48875a1daf707335");
    assert.equal(result.release_projection.local_rc_tag, "v0.1.0-rc.20260615.8200ed3");
    assert.equal(result.release_projection.github_independent_approval_status, "not_pursued_single_owner_local_rc");
    assert.equal(result.release_projection.production_launch_approval_status, "missing");
    assert.equal(result.release_projection.deployment_authorized, false);
    assert.equal(result.release_projection.production_pass_enabled, false);
    assert.equal(result.factory_projection.gate_open_now, 0);
    assert.equal(result.factory_projection.runtime_authority_open, false);
    assert.equal(result.factory_projection.stage6_limited_execution_allowed, false);
    assert.equal(result.factory_projection.stage7_release_candidate_allowed, false);
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

test("Desktop read model projection refuses malicious authority text", async () => {
  const fixture = await createReadModelFixture();
  try {
    await writeFile(fixture.options.releaseDecisionPacketPath, [
      "# Malicious Fixture",
      "",
      "| Candidate commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |",
      "| Local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
      "GitHub independent approval: approved",
      "Owner production launch approval: approved",
      "deployment_authorized: true",
      "production PASS",
    ].join("\n"), "utf8");
    await writeFile(fixture.options.factoryGateOpeningSummaryPath, [
      "# Malicious Factory",
      "",
      "Status: ready_factory_gate_opening_readiness",
      "Gate open now: 9",
      "G1a status: source_evidence_complete_runtime_authority_closed",
      "Production PASS enabled: true",
      "Enterprise PASS enabled: true",
    ].join("\n"), "utf8");

    const result = await buildDesktopReadModel({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
      allowlist: fixture.allowlist,
    });

    assert.equal(result.release_projection.github_independent_approval_status, "missing");
    assert.equal(result.release_projection.production_launch_approval_status, "not_approved");
    assert.equal(result.release_projection.deployment_authorized, false);
    assert.equal(result.release_projection.production_pass_enabled, false);
    assert.equal(result.release_projection.enterprise_pass_enabled, false);
    assert.equal(result.factory_projection.observed_gate_open_now_input, 9);
    assert.equal(result.factory_projection.gate_open_now, 0);
    assert.equal(result.factory_projection.runtime_authority_open, false);
    assert.equal(result.factory_projection.stage6_limited_execution_allowed, false);
    assert.equal(result.factory_projection.stage7_release_candidate_allowed, false);
    assert.equal(result.factory_projection.production_pass_enabled, false);
    assert.equal(result.factory_projection.projection_rows.find((row) => row.row_id === "gate_open_now").status, "input_rejected_closed");
    assert.equal(result.validation.valid, true);
  } finally {
    await rm(fixture.tmpDir, { recursive: true, force: true });
  }
});

test("Desktop read model recognizes forbidden trust claim strings", () => {
  assert.equal(containsForbiddenTrustString("This is production PASS."), true);
  assert.equal(containsForbiddenTrustString("desktop write authority enabled"), true);
  assert.equal(containsForbiddenTrustString("single-owner lower-trust RC only"), false);
});

test("Desktop read model CLI parser accepts only known flags", () => {
  assert.deepEqual(parseDesktopReadModelArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseDesktopReadModelArgs(["--allowlist", "docs/example.md"]), /Unknown argument: --allowlist/);
  assert.throws(() => parseDesktopReadModelArgs(["--schema-path"]), /Missing value for --schema-path/);
});

async function createReadModelFixture() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-desktop-read-"));
  const file = (name) => path.join(tmpDir, name);
  const options = {
    packagePath: file("package.json"),
    releaseOwnerDecisionPath: file("release-owner.md"),
    releaseDecisionPacketPath: file("release-decision.md"),
    productionLaunchChecklistPath: file("production-checklist.md"),
    claudeFinalReviewPacketPath: file("claude-review.md"),
    releaseNoteTagDraftPath: file("release-note.md"),
    desktopPlanPath: file("desktop-plan.md"),
    desktopLocalLaunchRunbookPath: file("desktop-local-launch-runbook.md"),
    desktopPackagingManifestSummaryPath: file("desktop-packaging-manifest-summary.md"),
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
    options.claudeFinalReviewPacketPath,
    options.releaseNoteTagDraftPath,
    options.desktopPlanPath,
    options.desktopLocalLaunchRunbookPath,
    options.desktopPackagingManifestSummaryPath,
    options.releaseReadinessSummaryPath,
    options.productionGovernanceSummaryPath,
    options.p16800FreezeSummaryPath,
    options.factoryGateOpeningSummaryPath,
    options.factoryStage67SummaryPath,
  ]) {
    await writeFile(markdownPath, "# Fixture\n\nsingle-owner lower-trust RC only.\n", "utf8");
  }
  await writeFile(options.releaseDecisionPacketPath, [
    "# Release Decision",
    "",
    "| Candidate commit | `8200ed3b754b74900a95fe5a48875a1daf707335` |",
    "| Previous local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
    "| Proposed local RC tag | `v0.1.0-rc.20260615.8200ed3` |",
    "| Trust mode | `single-owner lower-trust RC`; GitHub independent approval not pursued |",
    "| Owner production launch approval | missing |",
  ].join("\n"), "utf8");
  await writeFile(options.releaseOwnerDecisionPath, [
    "# Historical Release Owner Decision",
    "",
    "| Candidate commit | `5e332b1c6327b255cf9bf418bc455b7965172658` |",
    "| Local RC tag | `v0.1.0-rc.20260614.5e332b1` |",
  ].join("\n"), "utf8");
  await writeFile(options.factoryGateOpeningSummaryPath, [
    "# Factory Gate Opening Readiness",
    "",
    "Status: ready_factory_gate_opening_readiness",
    "Gate open now: 0",
    "G1a status: source_evidence_complete_runtime_authority_closed",
    "Production PASS enabled: false",
    "Enterprise PASS enabled: false",
  ].join("\n"), "utf8");
  await writeFile(options.factoryStage67SummaryPath, [
    "# Factory Stage6/7 Execution Readiness",
    "",
    "Status: ready_stage6_stage7_contract_development",
    "Runtime authority open: false",
    "Stage6 limited execution allowed: false",
    "Stage7 release candidate allowed: false",
    "Contract development allowed: true",
    "Factory goal complete allowed: false",
  ].join("\n"), "utf8");
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
