import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runPlatformRuntimeDriftCheck } from "../src/platform-runtime-drift.mjs";
import { runPlatformRuntimeBaseline } from "../src/platform-runtime-baseline.mjs";
import { runPlatformRuntimeReplayWindow } from "../src/platform-runtime-replay-window.mjs";
import { runPlatformOperatorHandoff } from "../src/platform-operator-handoff.mjs";
import { runPlatformArtifactGuard } from "../src/platform-artifact-guard.mjs";

test("platform runtime baseline pins reproducibility without enabling mutation", async () => {
  const result = await runPlatformRuntimeBaseline({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_baseline_status, "complete");
  assert.equal(result.summary.phase_slot, "P341");
  assert.equal(result.summary.previous_phase_slot, "P340");
  assert.equal(result.summary.next_phase_slot, "P342");
  assert.equal(result.summary.pinned_node_version, "26.0.0");
  assert.equal(result.summary.pinned_package_manager, "npm@11.12.1");
  assert.equal(result.summary.package_lock_present, true);
  assert.equal(result.summary.p340_bundle_hash_recorded, true);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
});

test("platform runtime baseline --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-baseline-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-runtime-baseline.json");
    const sentinel = "{ \"sentinel\": \"runtime-baseline\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformRuntimeBaseline({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime drift check compares current state to the P341 baseline", async () => {
  const result = await runPlatformRuntimeDriftCheck({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_drift_status, "stable");
  assert.equal(result.summary.phase_slot, "P342");
  assert.equal(result.summary.previous_phase_slot, "P341");
  assert.equal(result.summary.next_phase_slot, "P343");
  assert.equal(result.summary.baseline_phase_slot, "P341");
  assert.equal(result.summary.baseline_status, "complete");
  assert.equal(result.summary.drifted_row_count, 0);
  assert.equal(result.summary.runtime_drift_row_count, 7);
  assert.equal(result.summary.stable_runtime_drift_row_count, 7);
  assert.equal(result.summary.dependency_drift_row_count, 6);
  assert.equal(result.summary.stable_dependency_drift_row_count, 6);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
});

test("platform runtime drift check detects dependency drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-drift-detect-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.dependencies = { "unexpected-runtime-dependency": "1.0.0" };
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformRuntimeDriftCheck({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_runtime_drift_status, "drift_detected");
    assert.ok(result.summary.drifted_row_ids.includes("dependency.dependency_free_core"));
    assert.ok(result.dependency_drift_rows.some((row) => row.source_row_id === "dependency.dependency_free_core" && row.drift_status === "drifted" && row.human_review_required));
    await assert.rejects(
      () => runPlatformRuntimeDriftCheck({ packagePath, write: false, check: true }),
      /Platform runtime drift check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime drift check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-drift-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-runtime-drift.json");
    const sentinel = "{ \"sentinel\": \"runtime-drift\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformRuntimeDriftCheck({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime replay window maps P343 operator replay without executing commands", async () => {
  const result = await runPlatformRuntimeReplayWindow({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_replay_window_status, "ready");
  assert.equal(result.summary.phase_slot, "P343");
  assert.equal(result.summary.previous_phase_slot, "P342");
  assert.equal(result.summary.next_phase_slot, "P344");
  assert.equal(result.summary.baseline_phase_slot, "P341");
  assert.equal(result.summary.drift_phase_slot, "P342");
  assert.equal(result.summary.source_drift_status, "stable");
  assert.equal(result.summary.source_drifted_row_count, 0);
  assert.equal(result.summary.replay_window_count, 6);
  assert.equal(result.summary.ready_replay_window_count, 6);
  assert.equal(result.summary.replay_command_count, 13);
  assert.equal(result.summary.ready_replay_command_count, 13);
  assert.equal(result.summary.executed_command_count, 0);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.replay_command_rows.every((row) => row.executed_by_report === false && row.mutation_allowed_by_report === false));
  assert.ok(result.operator_handoff_rows.every((row) => row.human_review_required && row.command_execution_allowed_by_report === false));
});

test("platform runtime replay window blocks when P342 drift is present", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-replay-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.dependencies = { "unexpected-runtime-dependency": "1.0.0" };
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformRuntimeReplayWindow({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_runtime_replay_window_status, "blocked");
    assert.equal(result.summary.source_drift_status, "drift_detected");
    assert.equal(result.summary.source_drifted_row_count > 0, true);
    await assert.rejects(
      () => runPlatformRuntimeReplayWindow({ packagePath, write: false, check: true }),
      /Platform runtime replay window failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime replay window --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-replay-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-runtime-replay-window.json");
    const sentinel = "{ \"sentinel\": \"runtime-replay-window\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformRuntimeReplayWindow({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operator handoff maps P344 packets without executing commands", async () => {
  const result = await runPlatformOperatorHandoff({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operator_handoff_status, "ready");
  assert.equal(result.summary.phase_slot, "P344");
  assert.equal(result.summary.previous_phase_slot, "P343");
  assert.equal(result.summary.next_phase_slot, "P345");
  assert.equal(result.summary.baseline_phase_slot, "P341");
  assert.equal(result.summary.drift_phase_slot, "P342");
  assert.equal(result.summary.replay_window_phase_slot, "P343");
  assert.equal(result.summary.source_replay_window_status, "ready");
  assert.equal(result.summary.source_executed_command_count, 0);
  assert.equal(result.summary.handoff_packet_count, 6);
  assert.equal(result.summary.ready_handoff_packet_count, 6);
  assert.equal(result.summary.evidence_row_count, 8);
  assert.equal(result.summary.ready_evidence_row_count, 8);
  assert.equal(result.summary.decision_row_count, 6);
  assert.equal(result.summary.ready_decision_row_count, 6);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.operator_handoff_packets.every((row) => row.human_review_required && row.command_execution_allowed_by_report === false));
  assert.ok(result.handoff_decision_rows.every((row) => row.requires_human_gate && row.client_facing_ready === false));
});

test("platform operator handoff blocks when source replay window is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-operator-handoff-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.dependencies = { "unexpected-runtime-dependency": "1.0.0" };
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperatorHandoff({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operator_handoff_status, "blocked");
    assert.equal(result.summary.source_replay_window_status, "blocked");
    await assert.rejects(
      () => runPlatformOperatorHandoff({ packagePath, write: false, check: true }),
      /Platform operator handoff failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operator handoff --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-operator-handoff-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operator-handoff.json");
    const sentinel = "{ \"sentinel\": \"operator-handoff\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperatorHandoff({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform artifact guard closes P345 read-only artifact policy", async () => {
  const result = await runPlatformArtifactGuard({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_artifact_guard_status, "guarded");
  assert.equal(result.summary.phase_slot, "P345");
  assert.equal(result.summary.previous_phase_slot, "P344");
  assert.equal(result.summary.next_phase_slot, "P346");
  assert.equal(result.summary.source_operator_handoff_status, "ready");
  assert.equal(result.summary.artifact_guard_row_count, 5);
  assert.equal(result.summary.guarded_artifact_row_count, 5);
  assert.equal(result.summary.check_mode_row_count, 5);
  assert.equal(result.summary.check_mode_ready_count, 5);
  assert.equal(result.summary.source_policy_row_count, 5);
  assert.equal(result.summary.source_policy_ready_count, 5);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.artifact_overwrite_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.artifact_guard_rows.every((row) => row.artifact_guard_status === "guarded" && row.artifact_tree_ignored_by_git));
  assert.ok(result.check_mode_rows.every((row) => row.check_mode_status === "ready" && row.check_overwrite_allowed === false));
});

test("platform artifact guard blocks when a platform script is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-artifact-guard-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:artifact-guard"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:artifact-guard -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformArtifactGuard({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_artifact_guard_status, "blocked");
    assert.ok(result.check_mode_rows.some((row) => row.package_script_name === "platform:artifact-guard" && row.check_mode_status === "blocked"));
    assert.ok(result.source_policy_rows.some((row) => row.row_key === "platform_validate_chain_registered" && row.source_policy_status === "blocked"));
    await assert.rejects(
      () => runPlatformArtifactGuard({ packagePath, write: false, check: true }),
      /Platform artifact guard failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform artifact guard --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-artifact-guard-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-artifact-guard.json");
    const sentinel = "{ \"sentinel\": \"artifact-guard\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformArtifactGuard({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
