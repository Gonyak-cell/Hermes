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
import { runPlatformProvenanceLedger } from "../src/platform-provenance-ledger.mjs";
import { runPlatformReleaseBundleProvenance } from "../src/platform-release-bundle-provenance.mjs";
import { runPlatformSignedTagProvenance } from "../src/platform-signed-tag-provenance.mjs";
import { runPlatformProvenanceFreezePreflight } from "../src/platform-provenance-freeze-preflight.mjs";
import { runPlatformProvenanceFreeze } from "../src/platform-provenance-freeze.mjs";
import { runPlatformMacWindowsReplayNotes } from "../src/platform-mac-windows-replay-notes.mjs";
import { runPlatformLockfilePolicy } from "../src/platform-lockfile-policy.mjs";
import { runPlatformReplayHandoffMap } from "../src/platform-replay-handoff-map.mjs";

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

test("platform provenance ledger records P346 release hash and signed tag policy", async () => {
  const result = await runPlatformProvenanceLedger({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_provenance_ledger_status, "ready");
  assert.equal(result.summary.phase_slot, "P346");
  assert.equal(result.summary.previous_phase_slot, "P345");
  assert.equal(result.summary.next_phase_slot, "P347");
  assert.equal(result.summary.source_artifact_guard_status, "guarded");
  assert.equal(result.summary.provenance_record_count, 5);
  assert.equal(result.summary.ready_provenance_record_count, 5);
  assert.equal(result.summary.release_hash_policy_count, 3);
  assert.equal(result.summary.ready_release_hash_policy_count, 3);
  assert.equal(result.summary.signed_tag_requirement_count, 3);
  assert.equal(result.summary.ready_signed_tag_requirement_count, 3);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.git_tag_created, false);
  assert.equal(result.summary.signed_tag_created, false);
  assert.equal(result.summary.release_bundle_created, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.provenance_records.some((row) => row.record_key === "p340_verified_bundle_hash" && row.hash_recorded));
  assert.ok(result.signed_tag_requirement_rows.every((row) => row.git_tag_created_by_report === false && row.human_review_required));
});

test("platform provenance ledger blocks when P340 hash is missing from ledger", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-provenance-block-"));
  try {
    const ledgerText = (await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8"))
      .replace("1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d", "missing-p340-hash");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText, "utf8");

    const result = await runPlatformProvenanceLedger({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_provenance_ledger_status, "blocked");
    assert.ok(result.provenance_records.some((row) => row.record_key === "p340_verified_bundle_hash" && row.provenance_status === "blocked"));
    await assert.rejects(
      () => runPlatformProvenanceLedger({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform provenance ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform provenance ledger --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-provenance-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-provenance-ledger.json");
    const sentinel = "{ \"sentinel\": \"provenance-ledger\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformProvenanceLedger({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release bundle provenance maps P347 hash and manifest requirements", async () => {
  const result = await runPlatformReleaseBundleProvenance({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_bundle_provenance_status, "ready");
  assert.equal(result.summary.phase_slot, "P347");
  assert.equal(result.summary.previous_phase_slot, "P346");
  assert.equal(result.summary.next_phase_slot, "P348");
  assert.equal(result.summary.source_provenance_ledger_status, "ready");
  assert.equal(result.summary.bundle_hash_requirement_count, 5);
  assert.equal(result.summary.ready_bundle_hash_requirement_count, 5);
  assert.equal(result.summary.bundle_manifest_row_count, 5);
  assert.equal(result.summary.ready_bundle_manifest_row_count, 5);
  assert.equal(result.summary.bundle_verification_row_count, 5);
  assert.equal(result.summary.ready_bundle_verification_row_count, 5);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.git_tag_created, false);
  assert.equal(result.summary.signed_tag_created, false);
  assert.equal(result.summary.release_bundle_created, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.bundle_hash_requirement_rows.every((row) => row.requirement_status === "ready" && row.hash_required));
  assert.ok(result.bundle_manifest_rows.every((row) => row.manifest_row_status === "ready" && row.content_hash));
});

test("platform release bundle provenance blocks when package lock is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-bundle-block-"));
  try {
    const missingPackageLockPath = path.join(root, "missing-package-lock.json");
    const result = await runPlatformReleaseBundleProvenance({ packageLockPath: missingPackageLockPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_bundle_provenance_status, "blocked");
    assert.ok(result.bundle_manifest_rows.some((row) => row.row_key === "package_lock" && row.manifest_row_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseBundleProvenance({ packageLockPath: missingPackageLockPath, write: false, check: true }),
      /Platform release bundle provenance failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release bundle provenance --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-bundle-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-bundle-provenance.json");
    const sentinel = "{ \"sentinel\": \"release-bundle-provenance\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseBundleProvenance({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform signed-tag provenance maps P348 tag policy without git operations", async () => {
  const result = await runPlatformSignedTagProvenance({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_signed_tag_provenance_status, "ready");
  assert.equal(result.summary.phase_slot, "P348");
  assert.equal(result.summary.previous_phase_slot, "P347");
  assert.equal(result.summary.next_phase_slot, "P349");
  assert.equal(result.summary.source_release_bundle_provenance_status, "ready");
  assert.equal(result.summary.signed_tag_policy_count, 5);
  assert.equal(result.summary.ready_signed_tag_policy_count, 5);
  assert.equal(result.summary.signed_tag_gate_count, 5);
  assert.equal(result.summary.ready_signed_tag_gate_count, 5);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.git_tag_created, false);
  assert.equal(result.summary.signed_tag_created, false);
  assert.equal(result.summary.signing_key_materialized, false);
  assert.equal(result.summary.release_bundle_created, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.signed_tag_policy_rows.every((row) => row.signed_tag_policy_status === "ready" && row.signed_tag_created_by_report === false));
  assert.ok(result.signed_tag_gate_rows.every((row) => row.gate_status === "ready" && row.git_operation_performed_by_report === false));
});

test("platform signed-tag provenance blocks when signed-tag policy wording is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-signed-tag-block-"));
  try {
    const ledgerText = (await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8"))
      .replace(/signed-tag/g, "unsigned")
      .replace(/signed tag/g, "unsigned tag");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText, "utf8");

    const result = await runPlatformSignedTagProvenance({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_signed_tag_provenance_status, "blocked");
    assert.ok(result.signed_tag_policy_rows.some((row) => row.row_key === "signed_tag_required_for_future_release" && row.signed_tag_policy_status === "blocked"));
    await assert.rejects(
      () => runPlatformSignedTagProvenance({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform signed-tag provenance failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform signed-tag provenance --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-signed-tag-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-signed-tag-provenance.json");
    const sentinel = "{ \"sentinel\": \"signed-tag-provenance\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformSignedTagProvenance({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform provenance freeze preflight maps P349 sources and gates", async () => {
  const result = await runPlatformProvenanceFreezePreflight({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_provenance_freeze_preflight_status, "ready");
  assert.equal(result.summary.phase_slot, "P349");
  assert.equal(result.summary.previous_phase_slot, "P348");
  assert.equal(result.summary.next_phase_slot, "P350");
  assert.equal(result.summary.source_signed_tag_provenance_status, "ready");
  assert.equal(result.summary.freeze_source_count, 9);
  assert.equal(result.summary.ready_freeze_source_count, 9);
  assert.equal(result.summary.freeze_gate_count, 6);
  assert.equal(result.summary.ready_freeze_gate_count, 6);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.git_tag_created, false);
  assert.equal(result.summary.signed_tag_created, false);
  assert.equal(result.summary.release_bundle_created, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.freeze_source_rows.every((row) => row.freeze_source_status === "ready" && row.check_mode_required));
  assert.ok(result.freeze_gate_rows.every((row) => row.gate_status === "ready" && row.git_operation_performed_by_report === false));
});

test("platform provenance freeze preflight blocks when validation chain is missing P349", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-preflight-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:provenance-freeze-preflight"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:provenance-freeze-preflight -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformProvenanceFreezePreflight({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_provenance_freeze_preflight_status, "blocked");
    assert.ok(result.freeze_gate_rows.some((row) => row.row_key === "platform_package_scripts_registered" && row.gate_status === "blocked"));
    assert.ok(result.freeze_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    assert.ok(result.freeze_source_rows.some((row) => row.source_phase_slot === "P349" && row.freeze_source_status === "blocked"));
    await assert.rejects(
      () => runPlatformProvenanceFreezePreflight({ packagePath, write: false, check: true }),
      /Platform provenance freeze preflight failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform provenance freeze preflight --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-preflight-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-provenance-freeze-preflight.json");
    const sentinel = "{ \"sentinel\": \"provenance-freeze-preflight\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformProvenanceFreezePreflight({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform provenance freeze closes P350 without protected actions", async () => {
  const result = await runPlatformProvenanceFreeze({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_provenance_freeze_status, "ready");
  assert.equal(result.summary.phase_slot, "P350");
  assert.equal(result.summary.previous_phase_slot, "P349");
  assert.equal(result.summary.next_phase_slot, "P351");
  assert.equal(result.summary.source_provenance_freeze_preflight_status, "ready");
  assert.equal(result.summary.freeze_closure_count, 5);
  assert.equal(result.summary.ready_freeze_closure_count, 5);
  assert.equal(result.summary.freeze_gate_count, 7);
  assert.equal(result.summary.ready_freeze_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.git_tag_created, false);
  assert.equal(result.summary.signed_tag_created, false);
  assert.equal(result.summary.release_bundle_created, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.freeze_closure_rows.every((row) => row.freeze_closure_status === "ready" && row.final_freeze_recorded));
  assert.ok(result.freeze_gate_rows.every((row) => row.gate_status === "ready" && row.git_operation_performed_by_report === false));
});

test("platform provenance freeze blocks when validation chain is missing P350", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:provenance-freeze"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:provenance-freeze -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformProvenanceFreeze({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_provenance_freeze_status, "blocked");
    assert.ok(result.freeze_gate_rows.some((row) => row.row_key === "platform_package_scripts_registered" && row.gate_status === "blocked"));
    assert.ok(result.freeze_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    assert.ok(result.freeze_closure_rows.some((row) => row.source_phase_slot === "P350" && row.freeze_closure_status === "blocked"));
    await assert.rejects(
      () => runPlatformProvenanceFreeze({ packagePath, write: false, check: true }),
      /Platform provenance freeze failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform provenance freeze --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-provenance-freeze.json");
    const sentinel = "{ \"sentinel\": \"provenance-freeze\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformProvenanceFreeze({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform Mac/Windows replay notes document P351 without cross-OS mutation", async () => {
  const result = await runPlatformMacWindowsReplayNotes({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_mac_windows_replay_notes_status, "ready");
  assert.equal(result.summary.phase_slot, "P351");
  assert.equal(result.summary.previous_phase_slot, "P350");
  assert.equal(result.summary.next_phase_slot, "P352");
  assert.equal(result.summary.source_provenance_freeze_status, "ready");
  assert.equal(result.summary.replay_note_count, 6);
  assert.equal(result.summary.ready_replay_note_count, 6);
  assert.equal(result.summary.replay_gate_count, 7);
  assert.equal(result.summary.ready_replay_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.replay_note_rows.every((row) => row.replay_note_status === "ready" && row.note_only));
  assert.ok(result.replay_gate_rows.every((row) => row.gate_status === "ready" && row.history_import_performed_by_report === false));
});

test("platform Mac/Windows replay notes block when validation chain is missing P351", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-mac-windows-replay-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:mac-windows-replay-notes"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:mac-windows-replay-notes -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformMacWindowsReplayNotes({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_mac_windows_replay_notes_status, "blocked");
    assert.ok(result.replay_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.replay_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformMacWindowsReplayNotes({ packagePath, write: false, check: true }),
      /Platform Mac\/Windows replay notes failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform Mac/Windows replay notes --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-mac-windows-replay-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-mac-windows-replay-notes.json");
    const sentinel = "{ \"sentinel\": \"mac-windows-replay-notes\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformMacWindowsReplayNotes({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform lockfile policy records P352 without lockfile mutation", async () => {
  const result = await runPlatformLockfilePolicy({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_lockfile_policy_status, "ready");
  assert.equal(result.summary.phase_slot, "P352");
  assert.equal(result.summary.previous_phase_slot, "P351");
  assert.equal(result.summary.next_phase_slot, "P353");
  assert.equal(result.summary.source_mac_windows_replay_notes_status, "ready");
  assert.equal(result.summary.lockfile_policy_count, 6);
  assert.equal(result.summary.ready_lockfile_policy_count, 6);
  assert.equal(result.summary.lockfile_gate_count, 7);
  assert.equal(result.summary.ready_lockfile_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.lockfile_policy_rows.every((row) => row.lockfile_policy_status === "ready" && row.lockfile_required));
  assert.ok(result.lockfile_gate_rows.every((row) => row.gate_status === "ready" && row.lockfile_mutation_performed_by_report === false));
});

test("platform lockfile policy blocks when package-lock evidence is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-lockfile-policy-block-"));
  try {
    const missingPackageLockPath = path.join(root, "missing-package-lock.json");

    const result = await runPlatformLockfilePolicy({ packageLockPath: missingPackageLockPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_lockfile_policy_status, "blocked");
    assert.ok(result.lockfile_policy_rows.some((row) => row.row_key === "package_lock_present" && row.lockfile_policy_status === "blocked"));
    await assert.rejects(
      () => runPlatformLockfilePolicy({ packageLockPath: missingPackageLockPath, write: false, check: true }),
      /Platform lockfile policy failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform lockfile policy --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-lockfile-policy-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-lockfile-policy.json");
    const sentinel = "{ \"sentinel\": \"lockfile-policy\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformLockfilePolicy({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform replay handoff map records P353 without executing replay actions", async () => {
  const result = await runPlatformReplayHandoffMap({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_replay_handoff_map_status, "ready");
  assert.equal(result.summary.phase_slot, "P353");
  assert.equal(result.summary.previous_phase_slot, "P352");
  assert.equal(result.summary.next_phase_slot, "P354");
  assert.equal(result.summary.source_lockfile_policy_status, "ready");
  assert.equal(result.summary.replay_handoff_count, 6);
  assert.equal(result.summary.ready_replay_handoff_count, 6);
  assert.equal(result.summary.replay_handoff_gate_count, 7);
  assert.equal(result.summary.ready_replay_handoff_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.replay_handoff_rows.every((row) => row.replay_handoff_status === "ready" && row.command_execution_allowed_by_report === false));
  assert.ok(result.replay_handoff_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_report === false));
});

test("platform replay handoff map blocks when validation chain is missing P353", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-handoff-map-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:replay-handoff-map"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:replay-handoff-map -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReplayHandoffMap({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_replay_handoff_map_status, "blocked");
    assert.ok(result.replay_handoff_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.replay_handoff_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReplayHandoffMap({ packagePath, write: false, check: true }),
      /Platform replay handoff map failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform replay handoff map --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-handoff-map-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-replay-handoff-map.json");
    const sentinel = "{ \"sentinel\": \"replay-handoff-map\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReplayHandoffMap({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
