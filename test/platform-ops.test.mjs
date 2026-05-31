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
import { runPlatformReplayEvidenceChecklist } from "../src/platform-replay-evidence-checklist.mjs";
import { runPlatformReplayHandoffCloseout } from "../src/platform-replay-handoff-closeout.mjs";
import { runPlatformReproducibilityCheckRegistry } from "../src/platform-reproducibility-check-registry.mjs";
import { runPlatformReproducibilityEvidenceMatrix } from "../src/platform-reproducibility-evidence-matrix.mjs";
import { runPlatformReproducibilityProofIndex } from "../src/platform-reproducibility-proof-index.mjs";
import { runPlatformReproducibilityOperatorReview } from "../src/platform-reproducibility-operator-review.mjs";
import { runPlatformReproducibilityCloseout } from "../src/platform-reproducibility-closeout.mjs";
import { runPlatformOpsCheck } from "../src/platform-ops-check.mjs";
import { runPlatformReleaseCheck } from "../src/platform-release-check.mjs";
import { runPlatformReleaseCheckNoWriteAudit } from "../src/platform-release-check-no-write-audit.mjs";
import { runPlatformReleaseCheckEvidenceIndex } from "../src/platform-release-check-evidence-index.mjs";
import { runPlatformReleaseCheckReviewPacket } from "../src/platform-release-check-review-packet.mjs";
import { runPlatformReleaseCheckSignoffLedger } from "../src/platform-release-check-signoff-ledger.mjs";
import { runPlatformReleaseCheckSignoffReceiptTemplate } from "../src/platform-release-check-signoff-receipt-template.mjs";

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

test("platform replay evidence checklist records P354 without collecting evidence", async () => {
  const result = await runPlatformReplayEvidenceChecklist({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_replay_evidence_checklist_status, "ready");
  assert.equal(result.summary.phase_slot, "P354");
  assert.equal(result.summary.previous_phase_slot, "P353");
  assert.equal(result.summary.next_phase_slot, "P355");
  assert.equal(result.summary.source_replay_handoff_map_status, "ready");
  assert.equal(result.summary.replay_evidence_count, 8);
  assert.equal(result.summary.ready_replay_evidence_count, 8);
  assert.equal(result.summary.replay_evidence_gate_count, 7);
  assert.equal(result.summary.ready_replay_evidence_gate_count, 7);
  assert.equal(result.summary.evidence_collected, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.replay_evidence_rows.every((row) => row.replay_evidence_status === "ready" && row.evidence_collected_by_report === false));
  assert.ok(result.replay_evidence_gate_rows.every((row) => row.gate_status === "ready" && row.command_execution_performed_by_report === false));
});

test("platform replay evidence checklist blocks when validation chain is missing P354", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-evidence-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:replay-evidence-checklist"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:replay-evidence-checklist -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReplayEvidenceChecklist({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_replay_evidence_checklist_status, "blocked");
    assert.ok(result.replay_evidence_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.replay_evidence_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReplayEvidenceChecklist({ packagePath, write: false, check: true }),
      /Platform replay evidence checklist failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform replay evidence checklist --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-evidence-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-replay-evidence-checklist.json");
    const sentinel = "{ \"sentinel\": \"replay-evidence-checklist\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReplayEvidenceChecklist({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform replay handoff closeout closes P355 without replay execution", async () => {
  const result = await runPlatformReplayHandoffCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_replay_handoff_closeout_status, "ready");
  assert.equal(result.summary.phase_slot, "P355");
  assert.equal(result.summary.previous_phase_slot, "P354");
  assert.equal(result.summary.next_phase_slot, "P356");
  assert.equal(result.summary.source_replay_evidence_checklist_status, "ready");
  assert.equal(result.summary.closeout_count, 5);
  assert.equal(result.summary.ready_closeout_count, 5);
  assert.equal(result.summary.closeout_gate_count, 7);
  assert.equal(result.summary.ready_closeout_gate_count, 7);
  assert.equal(result.summary.replay_execution_performed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.replay_handoff_closeout_rows.every((row) => row.closeout_status === "ready" && row.replay_execution_performed_by_report === false));
  assert.ok(result.replay_handoff_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.command_execution_performed_by_report === false));
});

test("platform replay handoff closeout blocks when validation chain is missing P355", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-closeout-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:replay-handoff-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:replay-handoff-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReplayHandoffCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_replay_handoff_closeout_status, "blocked");
    assert.ok(result.replay_handoff_closeout_gate_rows.some((row) => row.row_key === "platform_package_scripts_registered" && row.gate_status === "blocked"));
    assert.ok(result.replay_handoff_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    assert.ok(result.replay_handoff_closeout_rows.some((row) => row.source_phase_slot === "P355" && row.closeout_status === "blocked"));
    await assert.rejects(
      () => runPlatformReplayHandoffCloseout({ packagePath, write: false, check: true }),
      /Platform replay handoff closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform replay handoff closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-replay-closeout-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-replay-handoff-closeout.json");
    const sentinel = "{ \"sentinel\": \"replay-handoff-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReplayHandoffCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility check registry registers P356 without executing checks", async () => {
  const result = await runPlatformReproducibilityCheckRegistry({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_reproducibility_check_registry_status, "ready");
  assert.equal(result.summary.phase_slot, "P356");
  assert.equal(result.summary.previous_phase_slot, "P355");
  assert.equal(result.summary.next_phase_slot, "P357");
  assert.equal(result.summary.source_replay_handoff_closeout_status, "ready");
  assert.equal(result.summary.reproducibility_check_count, 16);
  assert.equal(result.summary.ready_reproducibility_check_count, 16);
  assert.equal(result.summary.release_chain_bridge_count, 3);
  assert.equal(result.summary.ready_release_chain_bridge_count, 3);
  assert.equal(result.summary.reproducibility_gate_count, 7);
  assert.equal(result.summary.ready_reproducibility_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.reproducibility_check_rows.every((row) => row.reproducibility_check_status === "ready" && row.package_script_registered && row.validation_chain_registered && row.command_execution_performed_by_report === false));
  assert.ok(result.release_chain_bridge_rows.every((row) => row.release_chain_bridge_status === "ready" && row.ledger_declared && row.package_script_required_now === false));
  assert.ok(result.reproducibility_gate_rows.every((row) => row.gate_status === "ready" && row.release_check_execution_performed_by_report === false));
});

test("platform reproducibility check registry blocks when validation chain is missing P356", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-registry-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:reproducibility-check-registry"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:reproducibility-check-registry -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReproducibilityCheckRegistry({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_reproducibility_check_registry_status, "blocked");
    assert.ok(result.reproducibility_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_check_rows.some((row) => row.source_phase_slot === "P356" && row.reproducibility_check_status === "blocked"));
    await assert.rejects(
      () => runPlatformReproducibilityCheckRegistry({ packagePath, write: false, check: true }),
      /Platform reproducibility check registry failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility check registry --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-registry-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-reproducibility-check-registry.json");
    const sentinel = "{ \"sentinel\": \"reproducibility-check-registry\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReproducibilityCheckRegistry({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility evidence matrix records P357 without collecting evidence", async () => {
  const result = await runPlatformReproducibilityEvidenceMatrix({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_reproducibility_evidence_matrix_status, "ready");
  assert.equal(result.summary.phase_slot, "P357");
  assert.equal(result.summary.previous_phase_slot, "P356");
  assert.equal(result.summary.next_phase_slot, "P358");
  assert.equal(result.summary.source_reproducibility_check_registry_status, "ready");
  assert.equal(result.summary.reproducibility_evidence_count, 10);
  assert.equal(result.summary.ready_reproducibility_evidence_count, 10);
  assert.equal(result.summary.reproducibility_evidence_gate_count, 8);
  assert.equal(result.summary.ready_reproducibility_evidence_gate_count, 8);
  assert.equal(result.summary.evidence_collected, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.reproducibility_evidence_rows.every((row) => row.reproducibility_evidence_status === "ready" && row.evidence_collected_by_report === false && row.command_execution_performed_by_report === false));
  assert.ok(result.reproducibility_evidence_gate_rows.every((row) => row.gate_status === "ready" && row.evidence_collected_by_report === false));
});

test("platform reproducibility evidence matrix blocks when validation chain is missing P357", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-evidence-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:reproducibility-evidence-matrix"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:reproducibility-evidence-matrix -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReproducibilityEvidenceMatrix({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_reproducibility_evidence_matrix_status, "blocked");
    assert.ok(result.reproducibility_evidence_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_evidence_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReproducibilityEvidenceMatrix({ packagePath, write: false, check: true }),
      /Platform reproducibility evidence matrix failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility evidence matrix --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-evidence-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-reproducibility-evidence-matrix.json");
    const sentinel = "{ \"sentinel\": \"reproducibility-evidence-matrix\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReproducibilityEvidenceMatrix({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility proof index records P358 without materializing proof", async () => {
  const result = await runPlatformReproducibilityProofIndex({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_reproducibility_proof_index_status, "ready");
  assert.equal(result.summary.phase_slot, "P358");
  assert.equal(result.summary.previous_phase_slot, "P357");
  assert.equal(result.summary.next_phase_slot, "P359");
  assert.equal(result.summary.source_reproducibility_evidence_matrix_status, "ready");
  assert.equal(result.summary.reproducibility_proof_count, 10);
  assert.equal(result.summary.ready_reproducibility_proof_count, 10);
  assert.equal(result.summary.reproducibility_proof_gate_count, 7);
  assert.equal(result.summary.ready_reproducibility_proof_gate_count, 7);
  assert.equal(result.summary.proof_materialized, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.evidence_collected, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.reproducibility_proof_rows.every((row) => row.reproducibility_proof_status === "ready" && row.expected_proof_reference_count > 0 && row.proof_materialized_by_report === false && row.artifact_read_performed_by_report === false));
  assert.ok(result.reproducibility_proof_gate_rows.every((row) => row.gate_status === "ready" && row.proof_materialized_by_report === false));
});

test("platform reproducibility proof index blocks when validation chain is missing P358", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-proof-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:reproducibility-proof-index"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:reproducibility-proof-index -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReproducibilityProofIndex({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_reproducibility_proof_index_status, "blocked");
    assert.ok(result.reproducibility_proof_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_proof_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReproducibilityProofIndex({ packagePath, write: false, check: true }),
      /Platform reproducibility proof index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility proof index --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-proof-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-reproducibility-proof-index.json");
    const sentinel = "{ \"sentinel\": \"reproducibility-proof-index\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReproducibilityProofIndex({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility operator review records P359 without applying approvals", async () => {
  const result = await runPlatformReproducibilityOperatorReview({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_reproducibility_operator_review_status, "ready");
  assert.equal(result.summary.phase_slot, "P359");
  assert.equal(result.summary.previous_phase_slot, "P358");
  assert.equal(result.summary.next_phase_slot, "P360");
  assert.equal(result.summary.source_reproducibility_proof_index_status, "ready");
  assert.equal(result.summary.operator_review_count, 10);
  assert.equal(result.summary.ready_operator_review_count, 10);
  assert.equal(result.summary.operator_review_gate_count, 7);
  assert.equal(result.summary.ready_operator_review_gate_count, 7);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.proof_materialized, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.reproducibility_operator_review_rows.every((row) => row.operator_review_status === "ready" && row.source_proof_status === "ready" && row.review_completed_by_report === false && row.approval_applied_by_report === false));
  assert.ok(result.reproducibility_operator_review_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_report === false));
});

test("platform reproducibility operator review blocks when validation chain is missing P359", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-review-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:reproducibility-operator-review"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:reproducibility-operator-review -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReproducibilityOperatorReview({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_reproducibility_operator_review_status, "blocked");
    assert.ok(result.reproducibility_operator_review_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_operator_review_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReproducibilityOperatorReview({ packagePath, write: false, check: true }),
      /Platform reproducibility operator review failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility operator review --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-review-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-reproducibility-operator-review.json");
    const sentinel = "{ \"sentinel\": \"reproducibility-operator-review\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReproducibilityOperatorReview({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility closeout closes P341-P360 without executing checks", async () => {
  const result = await runPlatformReproducibilityCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_reproducibility_closeout_status, "ready");
  assert.equal(result.summary.phase_slot, "P360");
  assert.equal(result.summary.previous_phase_slot, "P359");
  assert.equal(result.summary.next_phase_slot, "P361");
  assert.equal(result.summary.source_reproducibility_operator_review_status, "ready");
  assert.equal(result.summary.reproducibility_closeout_count, 20);
  assert.equal(result.summary.ready_reproducibility_closeout_count, 20);
  assert.equal(result.summary.reproducibility_closeout_gate_count, 7);
  assert.equal(result.summary.ready_reproducibility_closeout_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.artifact_regeneration_performed, false);
  assert.equal(result.summary.history_import_performed, false);
  assert.equal(result.summary.repository_checkout_changed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.reproducibility_closeout_rows.every((row) => row.reproducibility_closeout_status === "ready" && row.package_script_registered && row.validation_chain_registered && row.command_execution_performed_by_report === false));
  assert.ok(result.reproducibility_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_report === false));
});

test("platform reproducibility closeout blocks when validation chain is missing P360", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-closeout-block-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:reproducibility-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:reproducibility-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReproducibilityCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_reproducibility_closeout_status, "blocked");
    assert.ok(result.reproducibility_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    assert.ok(result.reproducibility_closeout_rows.some((row) => row.source_phase_slot === "P360" && row.reproducibility_closeout_status === "blocked"));
    await assert.rejects(
      () => runPlatformReproducibilityCloseout({ packagePath, write: false, check: true }),
      /Platform reproducibility closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform reproducibility closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-repro-closeout-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-reproducibility-closeout.json");
    const sentinel = "{ \"sentinel\": \"reproducibility-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReproducibilityCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function platformOpsReadyCheckOverrides() {
  return {
    contractGoldenFixtures: {
      result: {
        validation: { valid: true, errors: [] },
        summary: { golden_fixture_status: "complete" },
      },
    },
    contractValidationSuite: {
      result: {
        validation: { valid: true, errors: [] },
        summary: { validation_suite_status: "complete" },
      },
    },
  };
}

test("platform ops check verifies P362 platform readiness without package mutation", async () => {
  const result = await runPlatformOpsCheck({ write: false, check: true, checkOverrides: platformOpsReadyCheckOverrides() });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_ops_check_status, "ready");
  assert.equal(result.summary.phase_slot, "P362");
  assert.equal(result.summary.previous_phase_slot, "P361");
  assert.equal(result.summary.next_phase_slot, "P363");
  assert.equal(result.summary.ops_check_row_count, 6);
  assert.equal(result.summary.ready_ops_check_row_count, 6);
  assert.equal(result.summary.api_smoke_row_count, 6);
  assert.equal(result.summary.ready_api_smoke_row_count, 6);
  assert.equal(result.summary.ops_check_gate_count, 7);
  assert.equal(result.summary.ready_ops_check_gate_count, 7);
  assert.equal(result.summary.default_control_plane_loop_step_count >= 280, true);
  assert.equal(result.summary.command_execution_performed, true);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.control_plane_loop_probe_executed, true);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.dashboard_mutation_performed, false);
  assert.equal(result.summary.api_mutation_performed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.ok(result.ops_check_rows.every((row) => row.ops_check_status === "ready" && row.artifact_write_performed_by_ops_check === false));
  assert.ok(result.api_smoke_rows.every((row) => row.api_smoke_status === "ready" && row.mutating_route_required === false));
});

test("platform ops check blocks when package registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-ops-check-registration-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:ops-check"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:ops-check -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOpsCheck({ packagePath, write: false, checkOverrides: platformOpsReadyCheckOverrides() });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_ops_check_status, "blocked");
    assert.ok(result.ops_check_source_rows.some((row) => row.row_key === "platform_ops_check_script_registered" && row.source_status === "blocked"));
    assert.ok(result.ops_check_source_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.source_status === "blocked"));
    await assert.rejects(
      () => runPlatformOpsCheck({ packagePath, write: false, check: true, checkOverrides: platformOpsReadyCheckOverrides() }),
      /Platform ops check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform ops check blocks when API smoke source routes are missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-ops-check-api-block-"));
  try {
    const smokePath = path.join(root, "review-api-smoke.mjs");
    await writeFile(smokePath, "console.log('/health only');\n", "utf8");

    const result = await runPlatformOpsCheck({ reviewApiSmokeScriptPath: smokePath, write: false, checkOverrides: platformOpsReadyCheckOverrides() });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_ops_check_status, "blocked");
    assert.ok(result.ops_check_source_rows.some((row) => row.row_key === "review_api_smoke_source_ready" && row.source_status === "blocked"));
    assert.ok(result.api_smoke_rows.some((row) => row.row_key === "api_smoke_script_routes" && row.api_smoke_status === "blocked"));
    await assert.rejects(
      () => runPlatformOpsCheck({ reviewApiSmokeScriptPath: smokePath, write: false, check: true, checkOverrides: platformOpsReadyCheckOverrides() }),
      /Platform ops check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform ops check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-ops-check-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-ops-check.json");
    const sentinel = "{ \"sentinel\": \"platform-ops-check\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOpsCheck({ outDir, write: false, check: true, checkOverrides: platformOpsReadyCheckOverrides() });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function passingPlatformReleaseCheckRunner() {
  const calls = [];
  return {
    calls,
    runner: async (spec) => {
      calls.push(spec);
      return {
        exitCode: 0,
        stdout: `${spec.row_key} passed\n`,
        stderr: "",
        durationMs: 1,
      };
    },
  };
}

test("platform release check composes P363 child commands without release or trading mutation", async () => {
  const { calls, runner } = passingPlatformReleaseCheckRunner();

  const result = await runPlatformReleaseCheck({ write: false, check: true, runner });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_status, "complete");
  assert.equal(result.summary.phase_slot, "P363");
  assert.equal(result.summary.previous_phase_slot, "P362");
  assert.equal(result.summary.next_phase_slot, "P364");
  assert.equal(result.summary.command_count, 6);
  assert.equal(result.summary.passed_command_count, 6);
  assert.equal(result.summary.release_check_gate_count, 11);
  assert.equal(result.summary.ready_release_check_gate_count, 11);
  assert.equal(result.summary.command_execution_performed, true);
  assert.equal(result.summary.package_command_execution_performed, true);
  assert.equal(result.summary.release_check_execution_performed, true);
  assert.equal(result.summary.child_commands_guarded, true);
  assert.equal(result.summary.release_check_artifact_write_requested, false);
  assert.equal(result.summary.child_artifact_write_allowed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.deepEqual(calls.map((spec) => spec.row_key), [
    "platform_ops_check",
    "trading_release_check",
    "repo_validate",
    "repo_test",
    "contracts_validate",
    "release_freeze",
  ]);
  assert.ok(result.source_rows.some((row) => row.row_key === "package_validation_chain_non_recursive" && row.source_status === "ready"));
  assert.ok(result.release_check_command_rows.every((row) => row.release_check_command_status === "passed" && row.child_command_guarded && row.artifact_write_allowed_by_child_command === false));
});

test("platform release check blocks when a child command fails", async () => {
  const runner = async (spec) => ({
    exitCode: spec.row_key === "repo_test" ? 1 : 0,
    stdout: "",
    stderr: spec.row_key === "repo_test" ? "test failed\n" : "",
    durationMs: 1,
  });

  const result = await runPlatformReleaseCheck({ write: false, runner });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.platform_release_check_status, "blocked");
  assert.ok(result.release_check_command_rows.some((row) => row.row_key === "repo_test" && row.release_check_command_status === "failed"));
  assert.ok(result.release_check_gate_rows.some((row) => row.row_key === "repo_validation_and_tests_passed" && row.gate_status === "blocked"));
  await assert.rejects(
    () => runPlatformReleaseCheck({ write: false, check: true, runner }),
    /Platform release check failed/,
  );
});

test("platform release check blocks when package registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-check-registration-"));
  try {
    const { runner } = passingPlatformReleaseCheckRunner();
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check"];
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheck({ packagePath, write: false, runner });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_status, "blocked");
    assert.ok(result.source_rows.some((row) => row.row_key === "package_platform_release_check_registered" && row.source_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheck({ packagePath, write: false, check: true, runner }),
      /Platform release check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release check blocks recursive validation-chain registration", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-check-recursion-"));
  try {
    const { runner } = passingPlatformReleaseCheckRunner();
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = `${packageJson.scripts.validate} && npm run platform:release-check -- --check`;
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheck({ packagePath, write: false, runner });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_status, "blocked");
    assert.ok(result.source_rows.some((row) => row.row_key === "package_validation_chain_non_recursive" && row.source_status === "blocked"));
    assert.ok(result.release_check_gate_rows.some((row) => row.row_key === "validate_chain_non_recursive" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheck({ packagePath, write: false, check: true, runner }),
      /Platform release check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-check-no-overwrite-"));
  try {
    const { runner } = passingPlatformReleaseCheckRunner();
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheck({ outDir, write: false, check: true, runner });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check no-write audit verifies P361-P363 guards and tests", async () => {
  const result = await runPlatformReleaseCheckNoWriteAudit({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.no_write_audit_status, "ready");
  assert.equal(result.summary.phase_slot, "P364");
  assert.equal(result.summary.previous_phase_slot, "P363");
  assert.equal(result.summary.next_phase_slot, "P365");
  assert.equal(result.summary.no_write_audit_row_count, 3);
  assert.equal(result.summary.ready_no_write_audit_row_count, 3);
  assert.equal(result.summary.no_write_audit_gate_count, 8);
  assert.equal(result.summary.ready_no_write_audit_gate_count, 8);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.no_write_audit_rows.every((row) => row.no_write_audit_status === "ready" && row.check_parser_write_false && row.write_guard_present && row.no_overwrite_test_present));
});

test("platform release-check no-write audit blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-no-write-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-no-write-audit -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckNoWriteAudit({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.no_write_audit_status, "blocked");
    assert.ok(result.source_rows.some((row) => row.row_key === "validation_chain_registered" && row.source_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckNoWriteAudit({ packagePath, write: false, check: true }),
      /Platform release-check no-write audit failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check no-write audit blocks when a write guard is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-no-write-source-"));
  try {
    const sourcePath = path.join(root, "platform-release-check.mjs");
    const source = await readFile("src/platform-release-check.mjs", "utf8");
    await writeFile(sourcePath, source.replace("parsed.write = false;", "parsed.write = true;"), "utf8");

    const result = await runPlatformReleaseCheckNoWriteAudit({ platformReleaseCheckSourcePath: sourcePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.no_write_audit_status, "blocked");
    assert.ok(result.no_write_audit_rows.some((row) => row.row_key === "platform_release_check" && row.no_write_audit_status === "blocked" && row.check_parser_write_false === false));
    await assert.rejects(
      () => runPlatformReleaseCheckNoWriteAudit({ platformReleaseCheckSourcePath: sourcePath, write: false, check: true }),
      /Platform release-check no-write audit failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check no-write audit --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-no-write-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-no-write-audit.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-no-write-audit\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckNoWriteAudit({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check evidence index maps P361-P364 command evidence", async () => {
  const result = await runPlatformReleaseCheckEvidenceIndex({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.evidence_index_status, "ready");
  assert.equal(result.summary.phase_slot, "P365");
  assert.equal(result.summary.previous_phase_slot, "P364");
  assert.equal(result.summary.next_phase_slot, "P366");
  assert.equal(result.summary.evidence_row_count, 4);
  assert.equal(result.summary.ready_evidence_row_count, 4);
  assert.equal(result.summary.evidence_gate_count, 7);
  assert.equal(result.summary.ready_evidence_gate_count, 7);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.ok(result.release_check_evidence_rows.every((row) => row.evidence_status === "ready" && row.doc_references_command && row.doc_references_check_mode && row.check_mode_no_write_expected));
  assert.ok(result.release_check_evidence_rows.some((row) => row.package_script_name === "platform:release-check" && row.validation_chain_policy === "not_in_validate_recursion_guard" && row.validation_chain_policy_satisfied));
});

test("platform release-check evidence index blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-evidence-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-evidence-index -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckEvidenceIndex({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.evidence_index_status, "blocked");
    assert.ok(result.source_rows.some((row) => row.row_key === "validation_chain_registered" && row.source_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckEvidenceIndex({ packagePath, write: false, check: true }),
      /Platform release-check evidence index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check evidence index blocks when documentation evidence is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-evidence-doc-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing command evidence\n\nNo check command here.\n", "utf8");

    const result = await runPlatformReleaseCheckEvidenceIndex({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.evidence_index_status, "blocked");
    assert.ok(result.release_check_evidence_rows.some((row) => row.row_key === "platform_release_check" && row.evidence_status === "blocked" && row.doc_references_command === false));
    await assert.rejects(
      () => runPlatformReleaseCheckEvidenceIndex({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check evidence index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check evidence index --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-evidence-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-evidence-index.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-evidence-index\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckEvidenceIndex({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check review packet records P366 without applying approvals", async () => {
  const result = await runPlatformReleaseCheckReviewPacket({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_review_packet_status, "ready");
  assert.equal(result.summary.phase_slot, "P366");
  assert.equal(result.summary.previous_phase_slot, "P365");
  assert.equal(result.summary.next_phase_slot, "P367");
  assert.equal(result.summary.source_evidence_index_status, "ready");
  assert.equal(result.summary.review_packet_row_count, 4);
  assert.equal(result.summary.ready_review_packet_row_count, 4);
  assert.equal(result.summary.review_packet_gate_count, 8);
  assert.equal(result.summary.ready_review_packet_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.evidence_index_consumed_in_memory, true);
  assert.equal(result.summary.evidence_index_artifact_read_performed, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.ok(result.release_check_review_packet_rows.every((row) => row.review_packet_status === "ready" && row.source_evidence_status === "ready" && row.review_completed_by_packet === false && row.approval_applied_by_packet === false));
  assert.ok(result.release_check_review_packet_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_packet === false));
});

test("platform release-check review packet blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-review-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-review-packet"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-review-packet -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReviewPacket({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_review_packet_status, "blocked");
    assert.ok(result.release_check_review_packet_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_review_packet_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReviewPacket({ packagePath, write: false, check: true }),
      /Platform release-check review packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check review packet blocks when source evidence index is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-review-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReviewPacket({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_review_packet_status, "blocked");
    assert.equal(result.summary.source_evidence_index_status, "blocked");
    assert.ok(result.release_check_review_packet_gate_rows.some((row) => row.row_key === "p365_evidence_index_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReviewPacket({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check review packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check review packet --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-review-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-review-packet.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-review-packet\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReviewPacket({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff ledger records P367 without completing signoff", async () => {
  const result = await runPlatformReleaseCheckSignoffLedger({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_signoff_ledger_status, "ready");
  assert.equal(result.summary.phase_slot, "P367");
  assert.equal(result.summary.previous_phase_slot, "P366");
  assert.equal(result.summary.next_phase_slot, "P368");
  assert.equal(result.summary.source_review_packet_status, "ready");
  assert.equal(result.summary.signoff_row_count, 4);
  assert.equal(result.summary.ready_signoff_row_count, 4);
  assert.equal(result.summary.signoff_gate_count, 8);
  assert.equal(result.summary.ready_signoff_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.review_packet_consumed_in_memory, true);
  assert.equal(result.summary.review_packet_artifact_read_performed, false);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.human_signoff_required, true);
  assert.ok(result.release_check_signoff_rows.every((row) => row.signoff_status === "ready_for_human_signoff" && row.source_review_packet_status === "ready" && row.signoff_completed_by_ledger === false && row.approval_applied_by_ledger === false));
  assert.ok(result.release_check_signoff_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_ledger === false));
});

test("platform release-check signoff ledger blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-signoff-ledger"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-signoff-ledger -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckSignoffLedger({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_ledger_status, "blocked");
    assert.ok(result.release_check_signoff_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_signoff_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffLedger({ packagePath, write: false, check: true }),
      /Platform release-check signoff ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff ledger blocks when source review packet is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check review evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckSignoffLedger({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_ledger_status, "blocked");
    assert.equal(result.summary.source_review_packet_status, "blocked");
    assert.ok(result.release_check_signoff_gate_rows.some((row) => row.row_key === "p366_review_packet_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffLedger({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check signoff ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff ledger --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-signoff-ledger.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-signoff-ledger\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckSignoffLedger({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff receipt template records P368 without completing receipts", async () => {
  const result = await runPlatformReleaseCheckSignoffReceiptTemplate({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_signoff_receipt_template_status, "ready");
  assert.equal(result.summary.phase_slot, "P368");
  assert.equal(result.summary.previous_phase_slot, "P367");
  assert.equal(result.summary.next_phase_slot, "P369");
  assert.equal(result.summary.source_signoff_ledger_status, "ready");
  assert.equal(result.summary.receipt_template_count, 4);
  assert.equal(result.summary.ready_receipt_template_count, 4);
  assert.equal(result.summary.template_gate_count, 8);
  assert.equal(result.summary.ready_template_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.signoff_ledger_consumed_in_memory, true);
  assert.equal(result.summary.signoff_ledger_artifact_read_performed, false);
  assert.equal(result.summary.receipt_completed, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.release_check_execution_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.human_signoff_required, true);
  assert.ok(result.release_check_signoff_receipt_templates.every((row) => row.receipt_template_status === "ready_for_human_receipt" && row.source_signoff_status === "ready_for_human_signoff" && row.receipt_completed_by_template === false && row.approval_applied_by_template === false));
  assert.ok(result.release_check_signoff_receipt_template_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_template === false));
});

test("platform release-check signoff receipt template blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-template-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-signoff-receipt-template"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-signoff-receipt-template -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckSignoffReceiptTemplate({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_receipt_template_status, "blocked");
    assert.ok(result.release_check_signoff_receipt_template_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_signoff_receipt_template_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffReceiptTemplate({ packagePath, write: false, check: true }),
      /Platform release-check signoff receipt template failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff receipt template blocks when source signoff ledger is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-template-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckSignoffReceiptTemplate({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_receipt_template_status, "blocked");
    assert.equal(result.summary.source_signoff_ledger_status, "blocked");
    assert.ok(result.release_check_signoff_receipt_template_gate_rows.some((row) => row.row_key === "p367_signoff_ledger_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffReceiptTemplate({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check signoff receipt template failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff receipt template --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-template-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-signoff-receipt-template.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-signoff-receipt-template\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckSignoffReceiptTemplate({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
