import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLaunchNonHumanReadiness,
  runLaunchNonHumanReadiness,
} from "../src/launch-non-human-readiness.mjs";

const RUN_AT = "2026-06-13T12:00:00.000Z";

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fixtureInputs() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "launch-non-human-readiness-"));
  const paths = {
    dir,
    releaseReadinessPath: path.join(dir, "release-readiness-control-plane.json"),
    releaseCandidatePath: path.join(dir, "release-candidate-report.json"),
    gSeriesReadinessPath: path.join(dir, "factory-g-series-advancement-readiness.json"),
    stage67ReadinessPath: path.join(dir, "factory-stage6-7-execution-readiness.json"),
    workOsSmokePath: path.join(dir, "work-os-read-only-api-ui-smoke.json"),
    amplitudeUiAuditPath: path.join(dir, "amplitude-ui-reference-audit.json"),
  };
  await writeJson(paths.releaseReadinessPath, {
    summary: {
      release_readiness_control_plane_status: "blocked_release_readiness_control_plane",
      source_ready_for_p12801_handoff: false,
      signed_provenance_receipt_present_now: false,
      release_approval_allowed_now: false,
      deployment_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  await writeJson(paths.releaseCandidatePath, {
    summary: {
      release_candidate_status: "complete",
      client_facing_ready: false,
      approval_required_for_release: true,
    },
  });
  await writeJson(paths.gSeriesReadinessPath, {
    summary: {
      g_series_code_development_allowed_now: true,
      g_series_runtime_authority_open_now: false,
      project_creation_allowed_now: false,
      repo_write_allowed_now: false,
      command_execution_allowed_now: false,
      deployment_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  await writeJson(paths.stage67ReadinessPath, {
    summary: {
      stage6_7_contract_development_allowed_now: true,
      stage6_7_runtime_authority_open_now: false,
      deployment_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  await writeJson(paths.workOsSmokePath, {
    summary: {
      work_os_read_only_api_ui_smoke_status: "ready_for_work_os_read_only_api_ui_smoke",
      deployment_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
    },
  });
  await writeJson(paths.amplitudeUiAuditPath, {
    summary: {
      validation_error_count: 0,
      locale_switch_ready: true,
      korean_font_manifest_ready: true,
    },
  });
  return paths;
}

function buildOptions(paths, overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    releaseReadinessPath: paths.releaseReadinessPath,
    releaseCandidatePath: paths.releaseCandidatePath,
    gSeriesReadinessPath: paths.gSeriesReadinessPath,
    stage67ReadinessPath: paths.stage67ReadinessPath,
    workOsSmokePath: paths.workOsSmokePath,
    amplitudeUiAuditPath: paths.amplitudeUiAuditPath,
    ...overrides,
  };
}

test("Launch non-human readiness excludes human approval and keeps authority closed", async () => {
  const paths = await fixtureInputs();
  try {
    const result = await buildLaunchNonHumanReadiness(buildOptions(paths));

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.launch_non_human_readiness_status, "ready_for_non_human_launch_readiness_execution");
    assert.equal(result.summary.human_approval_excluded_now, true);
    assert.equal(result.summary.non_human_workstream_count, 6);
    assert.equal(result.summary.non_human_workstream_ready_count, 6);
    assert.equal(result.summary.closed_authority_flag_count, result.summary.authority_flag_count);
    assert.equal(result.summary.codex_final_approval_allowed, false);
    assert.equal(result.summary.release_approval_allowed_now, false);
    assert.equal(result.summary.deployment_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.summary.enterprise_pass_enabled, false);
  } finally {
    await rm(paths.dir, { recursive: true, force: true });
  }
});

test("Launch non-human readiness records detailed workstreams and commands", async () => {
  const paths = await fixtureInputs();
  try {
    const result = await buildLaunchNonHumanReadiness(buildOptions(paths));
    const workstreams = new Set(result.non_human_workstream_rows.map((row) => row.workstream_id));
    const commands = new Set(result.non_human_command_rows.map((row) => row.command_name));

    for (const id of ["ui.product_shell", "factory.g_series_contracts", "factory.stage6_stage7_contracts", "release.evidence_packet", "release.review_packet_prep", "ci.pr_observability"]) {
      assert.equal(workstreams.has(id), true);
    }
    for (const command of ["platform:work-os-read-only-api-ui-smoke", "factory:g-series-advancement-readiness", "factory:stage6-7-execution-readiness", "platform:launch-non-human-readiness"]) {
      assert.equal(commands.has(command), true);
    }
    assert.equal(result.execution_plan_rows.every((row) => row.blocked_by_human_approval === false), true);
    assert.equal(result.execution_plan_rows.every((row) => row.detailed_steps.length >= 3), true);
  } finally {
    await rm(paths.dir, { recursive: true, force: true });
  }
});

test("Launch non-human readiness writes artifacts and check mode does not overwrite", async () => {
  const paths = await fixtureInputs();
  const outDir = await mkdtemp(path.join(os.tmpdir(), "launch-non-human-readiness-out-"));
  try {
    const result = await runLaunchNonHumanReadiness(buildOptions(paths, { outDir, write: true }));
    const artifact = JSON.parse(await readFile(path.join(outDir, "launch-non-human-readiness.json"), "utf8"));
    const workstreams = JSON.parse(await readFile(path.join(outDir, "non-human-workstream-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "launch-non-human-boundary.json"), "utf8"));

    assert.equal(result.summary.launch_non_human_readiness_status, "ready_for_non_human_launch_readiness_execution");
    assert.equal(artifact.summary.human_approval_excluded_now, true);
    assert.equal(workstreams.count, 6);
    assert.equal(boundary.deployment_allowed_now, false);

    const sentinelPath = path.join(outDir, "launch-non-human-readiness.json");
    const sentinel = '{ "sentinel": "launch-non-human-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const checkResult = spawnSync("node", [
      "scripts/launch-non-human-readiness.mjs",
      "--check",
      "--out-dir",
      outDir,
      "--release-readiness",
      paths.releaseReadinessPath,
      "--release-candidate",
      paths.releaseCandidatePath,
      "--g-series",
      paths.gSeriesReadinessPath,
      "--stage67",
      paths.stage67ReadinessPath,
      "--work-os-smoke",
      paths.workOsSmokePath,
      "--amplitude-ui-audit",
      paths.amplitudeUiAuditPath,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(checkResult.status, 0, checkResult.stdout + checkResult.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(paths.dir, { recursive: true, force: true });
  }
});
