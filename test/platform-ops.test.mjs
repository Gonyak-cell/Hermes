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
import { runPlatformReleaseCheckSignoffReceiptIntake } from "../src/platform-release-check-signoff-receipt-intake.mjs";
import { runPlatformReleaseCheckSignoffCloseout } from "../src/platform-release-check-signoff-closeout.mjs";
import { runPlatformReleaseCheckStatusLedger } from "../src/platform-release-check-status-ledger.mjs";
import { runPlatformReleaseCheckReceiptQueue } from "../src/platform-release-check-receipt-queue.mjs";
import { runPlatformReleaseCheckReceiptValidationRules } from "../src/platform-release-check-receipt-validation-rules.mjs";
import { runPlatformReleaseCheckReceiptWorkspace } from "../src/platform-release-check-receipt-workspace.mjs";
import { runPlatformReleaseCheckReceiptWorkspaceMerge } from "../src/platform-release-check-receipt-workspace-merge.mjs";
import { runPlatformReleaseCheckReceiptMergePreflight } from "../src/platform-release-check-receipt-merge-preflight.mjs";
import { runPlatformReleaseCheckReceiptValidationPacket } from "../src/platform-release-check-receipt-validation-packet.mjs";
import { runPlatformReleaseCheckReceiptApprovalPlan } from "../src/platform-release-check-receipt-approval-plan.mjs";
import { runPlatformReleaseCheckReceiptApprovalCloseout } from "../src/platform-release-check-receipt-approval-closeout.mjs";
import { runPlatformReleaseCheckReceiptCloseout } from "../src/platform-release-check-receipt-closeout.mjs";
import { runPlatformOperationsFreezeSourceInventory } from "../src/platform-operations-freeze-source-inventory.mjs";
import { runPlatformOperationsFreezeCommandMatrix } from "../src/platform-operations-freeze-command-matrix.mjs";
import { runPlatformOperationsFreezeEvidenceIndex } from "../src/platform-operations-freeze-evidence-index.mjs";
import { runPlatformOperationsFreezeReviewPacket } from "../src/platform-operations-freeze-review-packet.mjs";
import { runPlatformOperationsFreezeSignoffLedger } from "../src/platform-operations-freeze-signoff-ledger.mjs";
import { runPlatformOperationsFreezeSignoffReceiptTemplate } from "../src/platform-operations-freeze-signoff-receipt-template.mjs";
import { runPlatformOperationsFreezeSignoffReceiptIntake } from "../src/platform-operations-freeze-signoff-receipt-intake.mjs";
import { runPlatformOperationsFreezeSignoffCloseout } from "../src/platform-operations-freeze-signoff-closeout.mjs";
import { runPlatformOperationsFreezeStatusLedger } from "../src/platform-operations-freeze-status-ledger.mjs";
import { runPlatformOperationsFreezeReceiptQueue } from "../src/platform-operations-freeze-receipt-queue.mjs";
import { runPlatformOperationsFreezeReceiptValidationRules } from "../src/platform-operations-freeze-receipt-validation-rules.mjs";
import { runPlatformOperationsFreezeReceiptWorkspace } from "../src/platform-operations-freeze-receipt-workspace.mjs";
import { runPlatformOperationsFreezeReceiptWorkspaceMerge } from "../src/platform-operations-freeze-receipt-workspace-merge.mjs";
import { runPlatformOperationsFreezeReceiptMergePreflight } from "../src/platform-operations-freeze-receipt-merge-preflight.mjs";
import { runPlatformOperationsFreezeReceiptValidationPacket } from "../src/platform-operations-freeze-receipt-validation-packet.mjs";
import { runPlatformOperationsFreezeReceiptApprovalPlan } from "../src/platform-operations-freeze-receipt-approval-plan.mjs";
import { runPlatformOperationsFreezeReceiptApprovalCloseout } from "../src/platform-operations-freeze-receipt-approval-closeout.mjs";
import { runPlatformOperationsFreezeReceiptCloseout } from "../src/platform-operations-freeze-receipt-closeout.mjs";
import { runPlatformOperationsFreezeReceiptChainRegression } from "../src/platform-operations-freeze-receipt-chain-regression.mjs";
import { runPlatformOperationsFreezeCloseout } from "../src/platform-operations-freeze-closeout.mjs";

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

test("platform release-check signoff receipt intake records P369 without receiving receipts", async () => {
  const result = await runPlatformReleaseCheckSignoffReceiptIntake({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_signoff_receipt_intake_status, "ready");
  assert.equal(result.summary.phase_slot, "P369");
  assert.equal(result.summary.previous_phase_slot, "P368");
  assert.equal(result.summary.next_phase_slot, "P370");
  assert.equal(result.summary.source_receipt_template_status, "ready");
  assert.equal(result.summary.intake_row_count, 4);
  assert.equal(result.summary.ready_intake_row_count, 4);
  assert.equal(result.summary.intake_gate_count, 8);
  assert.equal(result.summary.ready_intake_gate_count, 8);
  assert.equal(result.summary.receipt_template_consumed_in_memory, true);
  assert.equal(result.summary.receipt_template_artifact_read_performed, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.ready_for_validation, false);
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
  assert.ok(result.release_check_signoff_receipt_intake_rows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input && row.receipt_received_by_intake === false && row.approval_applied_by_intake === false));
  assert.ok(result.release_check_signoff_receipt_intake_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_intake === false));
});

test("platform release-check signoff receipt intake blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-intake-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-signoff-receipt-intake"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-signoff-receipt-intake -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckSignoffReceiptIntake({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_receipt_intake_status, "blocked");
    assert.ok(result.release_check_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffReceiptIntake({ packagePath, write: false, check: true }),
      /Platform release-check signoff receipt intake failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff receipt intake blocks when source receipt template is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-intake-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check intake evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckSignoffReceiptIntake({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_receipt_intake_status, "blocked");
    assert.equal(result.summary.source_receipt_template_status, "blocked");
    assert.ok(result.release_check_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "p368_receipt_template_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffReceiptIntake({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check signoff receipt intake failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff receipt intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-intake-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-signoff-receipt-intake.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-signoff-receipt-intake\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckSignoffReceiptIntake({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff closeout records P370 without completing signoff", async () => {
  const result = await runPlatformReleaseCheckSignoffCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_signoff_closeout_status, "ready_for_human_receipt_collection");
  assert.equal(result.summary.phase_slot, "P370");
  assert.equal(result.summary.previous_phase_slot, "P369");
  assert.equal(result.summary.next_phase_slot, "P371");
  assert.equal(result.summary.source_receipt_intake_status, "ready");
  assert.equal(result.summary.closeout_row_count, 4);
  assert.equal(result.summary.ready_closeout_row_count, 4);
  assert.equal(result.summary.closeout_gate_count, 8);
  assert.equal(result.summary.ready_closeout_gate_count, 8);
  assert.equal(result.summary.receipt_intake_consumed_in_memory, true);
  assert.equal(result.summary.receipt_intake_artifact_read_performed, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_signoff_closeout_rows.every((row) => row.closeout_status === "ready_for_human_receipt_collection" && row.source_receipt_intake_status === "awaiting_human_receipt" && row.receipt_received_by_closeout === false && row.approval_applied_by_closeout === false));
  assert.ok(result.release_check_signoff_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_closeout === false));
});

test("platform release-check signoff closeout blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-signoff-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-signoff-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckSignoffCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_closeout_status, "blocked");
    assert.ok(result.release_check_signoff_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_signoff_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffCloseout({ packagePath, write: false, check: true }),
      /Platform release-check signoff closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff closeout blocks when source receipt intake is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-closeout-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check closeout evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckSignoffCloseout({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_signoff_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_intake_status, "blocked");
    assert.ok(result.release_check_signoff_closeout_gate_rows.some((row) => row.row_key === "p369_receipt_intake_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckSignoffCloseout({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check signoff closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check signoff closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-signoff-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-signoff-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-signoff-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckSignoffCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check status ledger records P371 while human receipts remain pending", async () => {
  const result = await runPlatformReleaseCheckStatusLedger({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_status_ledger_status, "ready_pending_human_receipt");
  assert.equal(result.summary.phase_slot, "P371");
  assert.equal(result.summary.previous_phase_slot, "P370");
  assert.equal(result.summary.next_phase_slot, "P372");
  assert.equal(result.summary.source_signoff_closeout_status, "ready_for_human_receipt_collection");
  assert.equal(result.summary.status_row_count, 4);
  assert.equal(result.summary.ready_status_row_count, 4);
  assert.equal(result.summary.status_gate_count, 8);
  assert.equal(result.summary.ready_status_gate_count, 8);
  assert.equal(result.summary.signoff_closeout_consumed_in_memory, true);
  assert.equal(result.summary.signoff_closeout_artifact_read_performed, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.human_receipt_pending, true);
  assert.equal(result.summary.release_ready_without_human_receipt, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_status_rows.every((row) => row.release_check_status === "ready_pending_human_receipt" && row.source_closeout_status === "ready_for_human_receipt_collection" && row.human_receipt_collection_required && row.human_receipt_pending && row.receipt_received_by_status_ledger === false && row.approval_applied_by_status_ledger === false));
  assert.ok(result.release_check_status_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_status_ledger === false));
});

test("platform release-check status ledger blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-status-ledger-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-status-ledger"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-status-ledger -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckStatusLedger({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_status_ledger_status, "blocked");
    assert.ok(result.release_check_status_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_status_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckStatusLedger({ packagePath, write: false, check: true }),
      /Platform release-check status ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check status ledger blocks when source signoff closeout is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-status-ledger-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check status ledger evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckStatusLedger({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_status_ledger_status, "blocked");
    assert.equal(result.summary.source_signoff_closeout_status, "blocked");
    assert.ok(result.release_check_status_gate_rows.some((row) => row.row_key === "p370_signoff_closeout_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckStatusLedger({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check status ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check status ledger --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-status-ledger-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-status-ledger.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-status-ledger\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckStatusLedger({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt queue records P372 without receiving receipts", async () => {
  const result = await runPlatformReleaseCheckReceiptQueue({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_queue_status, "queued_for_human_receipt");
  assert.equal(result.summary.phase_slot, "P372");
  assert.equal(result.summary.previous_phase_slot, "P371");
  assert.equal(result.summary.next_phase_slot, "P373");
  assert.equal(result.summary.source_status_ledger_status, "ready_pending_human_receipt");
  assert.equal(result.summary.queue_row_count, 4);
  assert.equal(result.summary.ready_queue_row_count, 4);
  assert.equal(result.summary.queue_gate_count, 8);
  assert.equal(result.summary.ready_queue_gate_count, 8);
  assert.equal(result.summary.status_ledger_consumed_in_memory, true);
  assert.equal(result.summary.status_ledger_artifact_read_performed, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.human_receipt_pending, true);
  assert.equal(result.summary.ready_for_human_input, true);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.release_ready_without_human_receipt, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.deepEqual(result.release_check_receipt_queue_rows.map((row) => row.queue_position), [1, 2, 3, 4]);
  assert.ok(result.release_check_receipt_queue_rows.every((row) => row.receipt_queue_status === "queued_for_human_receipt" && row.source_release_check_status === "ready_pending_human_receipt" && row.ready_for_human_input && row.ready_for_validation === false && row.receipt_received_by_queue === false && row.approval_applied_by_queue === false));
  assert.ok(result.release_check_receipt_queue_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_queue === false));
});

test("platform release-check receipt queue blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-queue-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-queue"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-queue -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptQueue({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_queue_status, "blocked");
    assert.ok(result.release_check_receipt_queue_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_queue_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptQueue({ packagePath, write: false, check: true }),
      /Platform release-check receipt queue failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt queue blocks when source status ledger is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-queue-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt queue evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptQueue({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_queue_status, "blocked");
    assert.equal(result.summary.source_status_ledger_status, "blocked");
    assert.ok(result.release_check_receipt_queue_gate_rows.some((row) => row.row_key === "p371_status_ledger_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptQueue({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt queue failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt queue --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-queue-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-queue.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-queue\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptQueue({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation rules records P373 without receipt payloads", async () => {
  const result = await runPlatformReleaseCheckReceiptValidationRules({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_validation_rules_status, "ready_for_future_receipt_validation");
  assert.equal(result.summary.phase_slot, "P373");
  assert.equal(result.summary.previous_phase_slot, "P372");
  assert.equal(result.summary.next_phase_slot, "P374");
  assert.equal(result.summary.source_receipt_queue_status, "queued_for_human_receipt");
  assert.equal(result.summary.rule_row_count, 4);
  assert.equal(result.summary.ready_rule_row_count, 4);
  assert.equal(result.summary.rule_gate_count, 8);
  assert.equal(result.summary.ready_rule_gate_count, 8);
  assert.equal(result.summary.required_receipt_field_count, 6);
  assert.equal(result.summary.allowed_receipt_decision_count, 2);
  assert.equal(result.summary.receipt_queue_consumed_in_memory, true);
  assert.equal(result.summary.receipt_queue_artifact_read_performed, false);
  assert.equal(result.summary.validation_rules_declared, true);
  assert.equal(result.summary.future_receipt_validation_required, true);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_to_validate_receipt_payload, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_validation_rule_rows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.source_receipt_queue_status === "queued_for_human_receipt" && row.required_receipt_fields.includes("reviewer_id") && row.required_receipt_fields.includes("blocker_note") && row.allowed_receipt_decisions.includes("signoff_ready") && row.allowed_receipt_decisions.includes("return_with_blocker") && row.receipt_payload_present === false && row.receipt_validated_by_rules === false));
  assert.ok(result.release_check_receipt_validation_rules_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_rules === false));
});

test("platform release-check receipt validation rules blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-rules-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-validation-rules"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-validation-rules -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptValidationRules({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_validation_rules_status, "blocked");
    assert.ok(result.release_check_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptValidationRules({ packagePath, write: false, check: true }),
      /Platform release-check receipt validation rules failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation rules blocks when source receipt queue is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-rules-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt validation rules evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptValidationRules({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_validation_rules_status, "blocked");
    assert.equal(result.summary.source_receipt_queue_status, "blocked");
    assert.ok(result.release_check_receipt_validation_rules_gate_rows.some((row) => row.row_key === "p372_receipt_queue_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptValidationRules({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt validation rules failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation rules --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-rules-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-validation-rules.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-validation-rules\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptValidationRules({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace records P374 without materializing receipt inputs", async () => {
  const result = await runPlatformReleaseCheckReceiptWorkspace({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_workspace_status, "ready_for_human_receipt_workspace");
  assert.equal(result.summary.phase_slot, "P374");
  assert.equal(result.summary.previous_phase_slot, "P373");
  assert.equal(result.summary.next_phase_slot, "P375");
  assert.equal(result.summary.source_receipt_validation_rules_status, "ready_for_future_receipt_validation");
  assert.equal(result.summary.workspace_row_count, 4);
  assert.equal(result.summary.ready_workspace_row_count, 4);
  assert.equal(result.summary.workspace_gate_count, 8);
  assert.equal(result.summary.ready_workspace_gate_count, 8);
  assert.equal(result.summary.validation_rules_consumed_in_memory, true);
  assert.equal(result.summary.validation_rules_artifact_read_performed, false);
  assert.equal(result.summary.workspace_rows_declared, true);
  assert.equal(result.summary.editable_receipt_fields_declared, true);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_workspace_rows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.source_receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.editable_receipt_fields_declared && row.receipt_input_file_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_workspace === false));
  assert.ok(result.release_check_receipt_workspace_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_workspace === false));
});

test("platform release-check receipt workspace blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-workspace"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-workspace -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptWorkspace({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_workspace_status, "blocked");
    assert.ok(result.release_check_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptWorkspace({ packagePath, write: false, check: true }),
      /Platform release-check receipt workspace failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace blocks when source validation rules are blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt workspace evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptWorkspace({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_workspace_status, "blocked");
    assert.equal(result.summary.source_receipt_validation_rules_status, "blocked");
    assert.ok(result.release_check_receipt_workspace_gate_rows.some((row) => row.row_key === "p373_receipt_validation_rules_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptWorkspace({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt workspace failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-workspace.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-workspace\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptWorkspace({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace merge records P375 without merging receipt inputs", async () => {
  const result = await runPlatformReleaseCheckReceiptWorkspaceMerge({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_workspace_merge_status, "ready_for_future_receipt_merge");
  assert.equal(result.summary.phase_slot, "P375");
  assert.equal(result.summary.previous_phase_slot, "P374");
  assert.equal(result.summary.next_phase_slot, "P376");
  assert.equal(result.summary.source_receipt_workspace_status, "ready_for_human_receipt_workspace");
  assert.equal(result.summary.merge_row_count, 4);
  assert.equal(result.summary.ready_merge_row_count, 4);
  assert.equal(result.summary.merge_gate_count, 8);
  assert.equal(result.summary.ready_merge_gate_count, 8);
  assert.equal(result.summary.receipt_workspace_consumed_in_memory, true);
  assert.equal(result.summary.receipt_workspace_artifact_read_performed, false);
  assert.equal(result.summary.merge_manifest_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_workspace_merge_rows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && row.source_workspace_status === "ready_for_human_receipt_input" && row.actor_workspace_required && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_merge === false));
  assert.ok(result.release_check_receipt_workspace_merge_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_merge === false));
});

test("platform release-check receipt workspace merge blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-merge-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-workspace-merge"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-workspace-merge -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptWorkspaceMerge({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_workspace_merge_status, "blocked");
    assert.ok(result.release_check_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptWorkspaceMerge({ packagePath, write: false, check: true }),
      /Platform release-check receipt workspace merge failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace merge blocks when source workspace is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-merge-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt workspace merge evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptWorkspaceMerge({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_workspace_merge_status, "blocked");
    assert.equal(result.summary.source_receipt_workspace_status, "blocked");
    assert.ok(result.release_check_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "p374_receipt_workspace_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptWorkspaceMerge({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt workspace merge failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt workspace merge --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-workspace-merge-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-workspace-merge.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-workspace-merge\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptWorkspaceMerge({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt merge preflight records P376 without validating receipts", async () => {
  const result = await runPlatformReleaseCheckReceiptMergePreflight({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_merge_preflight_status, "ready_for_future_receipt_merge_validation");
  assert.equal(result.summary.phase_slot, "P376");
  assert.equal(result.summary.previous_phase_slot, "P375");
  assert.equal(result.summary.next_phase_slot, "P377");
  assert.equal(result.summary.source_receipt_workspace_merge_status, "ready_for_future_receipt_merge");
  assert.equal(result.summary.preflight_row_count, 4);
  assert.equal(result.summary.ready_preflight_row_count, 4);
  assert.equal(result.summary.preflight_gate_count, 8);
  assert.equal(result.summary.ready_preflight_gate_count, 8);
  assert.equal(result.summary.receipt_workspace_merge_consumed_in_memory, true);
  assert.equal(result.summary.receipt_workspace_merge_artifact_read_performed, false);
  assert.equal(result.summary.merge_validation_preflight_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_merge_preflight_rows.every((row) => row.preflight_status === "ready_for_future_receipt_merge_validation" && row.source_workspace_merge_status === "ready_for_future_receipt_merge" && row.merge_validation_preflight_declared && row.future_validation_checks.length >= 6 && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_preflight === false));
  assert.ok(result.release_check_receipt_merge_preflight_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_preflight === false));
});

test("platform release-check receipt merge preflight blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-merge-preflight-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-merge-preflight"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-merge-preflight -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptMergePreflight({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_merge_preflight_status, "blocked");
    assert.ok(result.release_check_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptMergePreflight({ packagePath, write: false, check: true }),
      /Platform release-check receipt merge preflight failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt merge preflight blocks when source merge is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-merge-preflight-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt merge preflight evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptMergePreflight({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_merge_preflight_status, "blocked");
    assert.equal(result.summary.source_receipt_workspace_merge_status, "blocked");
    assert.ok(result.release_check_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "p375_receipt_workspace_merge_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptMergePreflight({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt merge preflight failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt merge preflight --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-merge-preflight-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-merge-preflight.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-merge-preflight\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptMergePreflight({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation packet records P377 without validating receipts", async () => {
  const result = await runPlatformReleaseCheckReceiptValidationPacket({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_validation_packet_status, "ready_for_future_receipt_validation_packet");
  assert.equal(result.summary.phase_slot, "P377");
  assert.equal(result.summary.previous_phase_slot, "P376");
  assert.equal(result.summary.next_phase_slot, "P378");
  assert.equal(result.summary.source_receipt_merge_preflight_status, "ready_for_future_receipt_merge_validation");
  assert.equal(result.summary.packet_row_count, 4);
  assert.equal(result.summary.ready_packet_row_count, 4);
  assert.equal(result.summary.packet_gate_count, 8);
  assert.equal(result.summary.ready_packet_gate_count, 8);
  assert.equal(result.summary.receipt_merge_preflight_consumed_in_memory, true);
  assert.equal(result.summary.receipt_merge_preflight_artifact_read_performed, false);
  assert.equal(result.summary.validation_packet_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_validation_packet_rows.every((row) => row.validation_packet_status === "ready_for_future_receipt_validation_packet" && row.source_merge_preflight_status === "ready_for_future_receipt_merge_validation" && row.validation_packet_declared && row.validation_packet_checks.length >= 6 && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_packet === false));
  assert.ok(result.release_check_receipt_validation_packet_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_packet === false));
});

test("platform release-check receipt validation packet blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-packet-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-validation-packet"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-validation-packet -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptValidationPacket({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_validation_packet_status, "blocked");
    assert.ok(result.release_check_receipt_validation_packet_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_validation_packet_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptValidationPacket({ packagePath, write: false, check: true }),
      /Platform release-check receipt validation packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation packet blocks when source preflight is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-packet-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt validation packet evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptValidationPacket({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_validation_packet_status, "blocked");
    assert.equal(result.summary.source_receipt_merge_preflight_status, "blocked");
    assert.ok(result.release_check_receipt_validation_packet_gate_rows.some((row) => row.row_key === "p376_receipt_merge_preflight_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptValidationPacket({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt validation packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt validation packet --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-validation-packet-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-validation-packet.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-validation-packet\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptValidationPacket({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval plan records P378 without applying approvals", async () => {
  const result = await runPlatformReleaseCheckReceiptApprovalPlan({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_approval_plan_status, "ready_for_future_receipt_approval_plan");
  assert.equal(result.summary.phase_slot, "P378");
  assert.equal(result.summary.previous_phase_slot, "P377");
  assert.equal(result.summary.next_phase_slot, "P379");
  assert.equal(result.summary.source_receipt_validation_packet_status, "ready_for_future_receipt_validation_packet");
  assert.equal(result.summary.approval_plan_row_count, 4);
  assert.equal(result.summary.ready_approval_plan_row_count, 4);
  assert.equal(result.summary.approval_plan_gate_count, 8);
  assert.equal(result.summary.ready_approval_plan_gate_count, 8);
  assert.equal(result.summary.receipt_validation_packet_consumed_in_memory, true);
  assert.equal(result.summary.receipt_validation_packet_artifact_read_performed, false);
  assert.equal(result.summary.approval_plan_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_approval_plan_rows.every((row) => row.approval_plan_status === "ready_for_future_receipt_approval_plan" && row.source_validation_packet_status === "ready_for_future_receipt_validation_packet" && row.approval_plan_declared && row.approval_plan_checks.length >= 6 && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_approval_application === false && row.approval_applied_by_plan === false));
  assert.ok(result.release_check_receipt_approval_plan_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_plan === false));
});

test("platform release-check receipt approval plan blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-plan-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-approval-plan"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-approval-plan -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptApprovalPlan({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_approval_plan_status, "blocked");
    assert.ok(result.release_check_receipt_approval_plan_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_approval_plan_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptApprovalPlan({ packagePath, write: false, check: true }),
      /Platform release-check receipt approval plan failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval plan blocks when source validation packet is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-plan-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt approval plan evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptApprovalPlan({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_approval_plan_status, "blocked");
    assert.equal(result.summary.source_receipt_validation_packet_status, "blocked");
    assert.ok(result.release_check_receipt_approval_plan_gate_rows.some((row) => row.row_key === "p377_receipt_validation_packet_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptApprovalPlan({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt approval plan failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval plan --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-plan-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-approval-plan.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-approval-plan\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptApprovalPlan({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval closeout records P379 without applying approvals", async () => {
  const result = await runPlatformReleaseCheckReceiptApprovalCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_approval_closeout_status, "ready_for_future_receipt_approval_closeout");
  assert.equal(result.summary.phase_slot, "P379");
  assert.equal(result.summary.previous_phase_slot, "P378");
  assert.equal(result.summary.next_phase_slot, "P380");
  assert.equal(result.summary.source_receipt_approval_plan_status, "ready_for_future_receipt_approval_plan");
  assert.equal(result.summary.approval_closeout_row_count, 4);
  assert.equal(result.summary.ready_approval_closeout_row_count, 4);
  assert.equal(result.summary.approval_closeout_gate_count, 8);
  assert.equal(result.summary.ready_approval_closeout_gate_count, 8);
  assert.equal(result.summary.receipt_approval_plan_consumed_in_memory, true);
  assert.equal(result.summary.receipt_approval_plan_artifact_read_performed, false);
  assert.equal(result.summary.approval_closeout_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_approval_closeout_rows.every((row) => row.approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.source_approval_plan_status === "ready_for_future_receipt_approval_plan" && row.approval_closeout_declared && row.approval_closeout_checks.length >= 6 && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_approval_application === false && row.approval_applied_by_closeout === false));
  assert.ok(result.release_check_receipt_approval_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_closeout === false));
});

test("platform release-check receipt approval closeout blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-approval-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-approval-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptApprovalCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_approval_closeout_status, "blocked");
    assert.ok(result.release_check_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptApprovalCloseout({ packagePath, write: false, check: true }),
      /Platform release-check receipt approval closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval closeout blocks when source approval plan is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-closeout-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt approval closeout evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptApprovalCloseout({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_approval_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_approval_plan_status, "blocked");
    assert.ok(result.release_check_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "p378_receipt_approval_plan_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptApprovalCloseout({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt approval closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt approval closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-approval-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-approval-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-approval-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptApprovalCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt closeout records P380 without applying approvals", async () => {
  const result = await runPlatformReleaseCheckReceiptCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_release_check_receipt_closeout_status, "ready_for_release_check_receipt_chain_closeout");
  assert.equal(result.summary.phase_slot, "P380");
  assert.equal(result.summary.previous_phase_slot, "P379");
  assert.equal(result.summary.next_phase_slot, "P381");
  assert.equal(result.summary.source_receipt_approval_closeout_status, "ready_for_future_receipt_approval_closeout");
  assert.equal(result.summary.receipt_closeout_row_count, 4);
  assert.equal(result.summary.ready_receipt_closeout_row_count, 4);
  assert.equal(result.summary.receipt_closeout_gate_count, 8);
  assert.equal(result.summary.ready_receipt_closeout_gate_count, 8);
  assert.equal(result.summary.receipt_approval_closeout_consumed_in_memory, true);
  assert.equal(result.summary.receipt_approval_closeout_artifact_read_performed, false);
  assert.equal(result.summary.receipt_closeout_declared, true);
  assert.equal(result.summary.p361_p380_chain_ready, true);
  assert.equal(result.summary.human_receipts_pending, true);
  assert.equal(result.summary.ready_for_p381_safety_regression, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
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
  assert.ok(result.release_check_receipt_closeout_rows.every((row) => row.receipt_closeout_status === "ready_for_release_check_receipt_chain_closeout" && row.source_approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.receipt_closeout_declared && row.p361_p380_chain_ready && row.human_receipts_pending && row.ready_for_p381_safety_regression && row.receipt_closeout_checks.length >= 6 && row.actor_workspace_input_present === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_approval_application === false && row.approval_applied_by_closeout === false));
  assert.ok(result.release_check_receipt_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.protected_action_executed_by_closeout === false));
});

test("platform release-check receipt closeout blocks when validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:release-check-receipt-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:release-check-receipt-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformReleaseCheckReceiptCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_closeout_status, "blocked");
    assert.ok(result.release_check_receipt_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.release_check_receipt_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptCloseout({ packagePath, write: false, check: true }),
      /Platform release-check receipt closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt closeout blocks when source approval closeout is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-closeout-source-"));
  try {
    const docPath = path.join(root, "platform-release-check.md");
    await writeFile(docPath, "# Missing release-check receipt closeout evidence\n\nNo command evidence here.\n", "utf8");

    const result = await runPlatformReleaseCheckReceiptCloseout({ platformReleaseCheckDocPath: docPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_release_check_receipt_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_approval_closeout_status, "blocked");
    assert.ok(result.release_check_receipt_closeout_gate_rows.some((row) => row.row_key === "p379_receipt_approval_closeout_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformReleaseCheckReceiptCloseout({ platformReleaseCheckDocPath: docPath, write: false, check: true }),
      /Platform release-check receipt closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform release-check receipt closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-release-receipt-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-release-check-receipt-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-release-check-receipt-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformReleaseCheckReceiptCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze source inventory records P341-P480 without executing commands", async () => {
  const result = await runPlatformOperationsFreezeSourceInventory({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_source_inventory_status, "ready_for_operations_freeze");
  assert.equal(result.summary.phase_slot, "P481");
  assert.equal(result.summary.previous_phase_slot, "P480");
  assert.equal(result.summary.next_phase_slot, "P482");
  assert.equal(result.summary.expected_source_count, 140);
  assert.equal(result.summary.source_inventory_row_count, 140);
  assert.equal(result.summary.discovered_ledger_row_count, 140);
  assert.equal(result.summary.complete_source_row_count, 140);
  assert.equal(result.summary.blocked_source_row_count, 0);
  assert.equal(result.summary.platform_source_row_count, 39);
  assert.equal(result.summary.trading_source_row_count, 101);
  assert.equal(result.summary.package_script_registered_source_count, 140);
  assert.equal(result.summary.validation_chain_registered_source_count, 139);
  assert.equal(result.summary.validation_chain_satisfied_source_count, 140);
  assert.equal(result.summary.validation_chain_exception_source_count, 1);
  assert.equal(result.summary.freeze_gate_count, 8);
  assert.equal(result.summary.ready_freeze_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.source_inventory_artifact_write_requested, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.source_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_source_inventory_rows.every((row) => row.source_inventory_status === "complete" && row.ledger_row_present && row.package_script_registered && row.validation_chain_satisfied && row.command_execution_performed_by_inventory === false && row.artifact_write_performed_by_inventory === false && row.protected_action_executed_by_inventory === false));
  assert.ok(result.operations_freeze_source_inventory_rows.some((row) => row.source_phase_slot === "P363" && row.validation_chain_registered === false && row.validation_chain_exception_documented && row.validation_chain_policy === "documented_recursive_validation_exclusion"));
  assert.ok(result.operations_freeze_source_inventory_gate_rows.every((row) => row.gate_status === "ready" && row.command_execution_performed_by_gate === false && row.protected_action_executed_by_gate === false));
});

test("platform operations freeze source inventory blocks when a source ledger row is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-source-inventory-ledger-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeSourceInventory({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_source_inventory_status, "blocked");
    assert.equal(result.summary.discovered_ledger_row_count, 139);
    assert.equal(result.summary.missing_source_phase_count, 1);
    assert.deepEqual(result.summary.missing_source_phases, ["P480"]);
    assert.ok(result.operations_freeze_source_inventory_rows.some((row) => row.source_phase_slot === "P480" && row.source_inventory_status === "blocked" && row.documented_blocker.includes("missing ledger row")));
    assert.ok(result.operations_freeze_source_inventory_gate_rows.some((row) => row.row_key === "source_phase_range_complete" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSourceInventory({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze source inventory failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze source inventory blocks when a source package script is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-source-inventory-package-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures"];
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSourceInventory({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_source_inventory_status, "blocked");
    assert.equal(result.summary.package_script_registered_source_count, 139);
    assert.ok(result.operations_freeze_source_inventory_rows.some((row) => row.source_phase_slot === "P480" && row.source_inventory_status === "blocked" && row.documented_blocker.includes("missing package script")));
    assert.ok(result.operations_freeze_source_inventory_gate_rows.some((row) => row.row_key === "source_package_scripts_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSourceInventory({ packagePath, write: false, check: true }),
      /Platform operations freeze source inventory failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze source inventory blocks when P481 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-source-inventory-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-source-inventory -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSourceInventory({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_source_inventory_status, "blocked");
    assert.ok(result.operations_freeze_source_inventory_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSourceInventory({ packagePath, write: false, check: true }),
      /Platform operations freeze source inventory failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze source inventory --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-source-inventory-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-source-inventory.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-source-inventory\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeSourceInventory({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze command matrix records acceptance commands without executing them", async () => {
  const result = await runPlatformOperationsFreezeCommandMatrix({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_command_matrix_status, "ready_for_operations_freeze_command_matrix");
  assert.equal(result.summary.phase_slot, "P482");
  assert.equal(result.summary.previous_phase_slot, "P481");
  assert.equal(result.summary.next_phase_slot, "P483");
  assert.equal(result.summary.source_inventory_status, "ready_for_operations_freeze");
  assert.equal(result.summary.source_inventory_row_count, 140);
  assert.equal(result.summary.source_inventory_complete_source_row_count, 140);
  assert.equal(result.summary.command_row_count, 7);
  assert.equal(result.summary.ready_command_row_count, 7);
  assert.equal(result.summary.check_mode_command_count, 4);
  assert.equal(result.summary.no_check_exception_command_count, 3);
  assert.equal(result.summary.package_script_registered_command_count, 7);
  assert.equal(result.summary.ledger_acceptance_declared_command_count, 7);
  assert.equal(result.summary.freeze_gate_count, 8);
  assert.equal(result.summary.ready_freeze_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.command_matrix_artifact_write_requested, false);
  assert.equal(result.summary.source_inventory_consumed_in_memory, true);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_command_matrix_rows.every((row) => row.command_matrix_status === "ready" && row.package_script_registered && row.ledger_acceptance_declared && row.check_mode_policy_satisfied && row.command_execution_performed_by_matrix === false && row.protected_action_executed_by_matrix === false));
  assert.ok(result.operations_freeze_command_matrix_rows.some((row) => row.row_key === "control_plane_loop" && row.check_mode_required === false && row.no_check_reason.includes("does not expose --check")));
  assert.ok(result.operations_freeze_command_matrix_gate_rows.every((row) => row.gate_status === "ready" && row.command_execution_performed_by_gate === false && row.protected_action_executed_by_gate === false));
});

test("platform operations freeze command matrix blocks when the P481 source inventory is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-command-matrix-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeCommandMatrix({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_command_matrix_status, "blocked");
    assert.equal(result.summary.source_inventory_status, "blocked");
    assert.ok(result.operations_freeze_command_matrix_gate_rows.some((row) => row.row_key === "p481_source_inventory_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeCommandMatrix({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze command matrix failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze command matrix blocks when an acceptance command package script is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-command-matrix-package-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["release:freeze"];
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeCommandMatrix({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_command_matrix_status, "blocked");
    assert.equal(result.summary.package_script_registered_command_count, 6);
    assert.ok(result.operations_freeze_command_matrix_rows.some((row) => row.row_key === "release_freeze" && row.command_matrix_status === "blocked" && row.package_script_registered === false));
    assert.ok(result.operations_freeze_command_matrix_gate_rows.some((row) => row.row_key === "freeze_command_rows_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeCommandMatrix({ packagePath, write: false, check: true }),
      /Platform operations freeze command matrix failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze command matrix blocks when P482 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-command-matrix-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-command-matrix -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeCommandMatrix({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_command_matrix_status, "blocked");
    assert.ok(result.operations_freeze_command_matrix_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeCommandMatrix({ packagePath, write: false, check: true }),
      /Platform operations freeze command matrix failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze command matrix --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-command-matrix-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-command-matrix.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-command-matrix\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeCommandMatrix({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze evidence index maps freeze commands to proof slots without execution", async () => {
  const result = await runPlatformOperationsFreezeEvidenceIndex({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_evidence_index_status, "ready_for_operations_freeze_evidence_index");
  assert.equal(result.summary.phase_slot, "P483");
  assert.equal(result.summary.previous_phase_slot, "P482");
  assert.equal(result.summary.next_phase_slot, "P484");
  assert.equal(result.summary.source_command_matrix_status, "ready_for_operations_freeze_command_matrix");
  assert.equal(result.summary.source_command_matrix_row_count, 7);
  assert.equal(result.summary.source_command_matrix_ready_command_row_count, 7);
  assert.equal(result.summary.evidence_row_count, 7);
  assert.equal(result.summary.ready_evidence_row_count, 7);
  assert.equal(result.summary.generated_report_evidence_row_count, 5);
  assert.equal(result.summary.command_result_capture_row_count, 2);
  assert.equal(result.summary.human_review_slot_count, 7);
  assert.equal(result.summary.freeze_evidence_gate_count, 8);
  assert.equal(result.summary.ready_freeze_evidence_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.evidence_index_artifact_write_requested, false);
  assert.equal(result.summary.command_matrix_consumed_in_memory, true);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_evidence_rows.every((row) => row.evidence_status === "ready" && row.command_matrix_row_ready && row.package_script_registered && row.ledger_acceptance_declared && row.check_mode_policy_satisfied && row.expected_artifact_declared && row.evidence_path_policy_satisfied && row.human_review_evidence_slot.startsWith("operations-freeze.p483.") && row.command_execution_performed_by_index === false && row.generated_artifact_read_performed_by_index === false && row.protected_action_executed_by_index === false));
  assert.ok(result.operations_freeze_evidence_rows.some((row) => row.row_key === "platform_release_check" && row.expected_report_path === "artifacts/platform-release-check/latest/platform-release-check.json"));
  assert.ok(result.operations_freeze_evidence_rows.some((row) => row.row_key === "control_plane_loop" && row.expected_report_path === "artifacts/control-plane-loop/latest/control-plane-loop.json"));
  assert.ok(result.operations_freeze_evidence_rows.some((row) => row.row_key === "validate" && row.expected_report_path === null && row.no_artifact_reason.includes("aggregate command chain")));
  assert.ok(result.operations_freeze_evidence_rows.some((row) => row.row_key === "test" && row.expected_report_path === null && row.no_artifact_reason.includes("test runner")));
  assert.ok(result.operations_freeze_evidence_gate_rows.every((row) => row.gate_status === "ready" && row.command_execution_performed_by_gate === false && row.generated_artifact_read_performed_by_gate === false && row.protected_action_executed_by_gate === false));
});

test("platform operations freeze evidence index blocks when the P482 command matrix is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-evidence-index-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeEvidenceIndex({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_evidence_index_status, "blocked");
    assert.equal(result.summary.source_command_matrix_status, "blocked");
    assert.ok(result.operations_freeze_evidence_gate_rows.some((row) => row.row_key === "p482_command_matrix_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeEvidenceIndex({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze evidence index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze evidence index blocks when a freeze evidence command package script is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-evidence-index-package-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["release:freeze"];
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeEvidenceIndex({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_evidence_index_status, "blocked");
    assert.ok(result.operations_freeze_evidence_rows.some((row) => row.row_key === "release_freeze" && row.evidence_status === "blocked" && row.package_script_registered === false));
    assert.ok(result.operations_freeze_evidence_gate_rows.some((row) => row.row_key === "p482_command_matrix_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeEvidenceIndex({ packagePath, write: false, check: true }),
      /Platform operations freeze evidence index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze evidence index blocks when P483 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-evidence-index-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-evidence-index -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeEvidenceIndex({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_evidence_index_status, "blocked");
    assert.ok(result.operations_freeze_evidence_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeEvidenceIndex({ packagePath, write: false, check: true }),
      /Platform operations freeze evidence index failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze evidence index --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-evidence-index-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-evidence-index.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-evidence-index\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeEvidenceIndex({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze review packet records P484 without applying approvals", async () => {
  const result = await runPlatformOperationsFreezeReviewPacket({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_review_packet_status, "ready_for_operations_freeze_review_packet");
  assert.equal(result.summary.phase_slot, "P484");
  assert.equal(result.summary.previous_phase_slot, "P483");
  assert.equal(result.summary.next_phase_slot, "P485");
  assert.equal(result.summary.source_evidence_index_status, "ready_for_operations_freeze_evidence_index");
  assert.equal(result.summary.source_evidence_index_row_count, 7);
  assert.equal(result.summary.source_evidence_index_ready_evidence_row_count, 7);
  assert.equal(result.summary.review_packet_row_count, 7);
  assert.equal(result.summary.ready_review_packet_row_count, 7);
  assert.equal(result.summary.review_packet_gate_count, 8);
  assert.equal(result.summary.ready_review_packet_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.review_packet_artifact_write_requested, false);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.evidence_index_consumed_in_memory, true);
  assert.equal(result.summary.evidence_index_artifact_read_performed, false);
  assert.equal(result.summary.evidence_collected, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_review_packet_rows.every((row) => row.review_packet_status === "ready" && row.source_evidence_status === "ready" && row.evidence_path_policy_satisfied && row.review_completed_by_packet === false && row.approval_applied_by_packet === false && row.command_execution_performed_by_packet === false && row.generated_artifact_read_performed_by_packet === false && row.secret_exposure_allowed_by_packet === false));
  assert.ok(result.operations_freeze_review_packet_rows.some((row) => row.source_evidence_row_key === "trading_release_check" && row.required_reviewer_role === "trading_safety_reviewer"));
  assert.ok(result.operations_freeze_review_packet_rows.some((row) => row.source_evidence_row_key === "test" && row.required_reviewer_role === "qa_reviewer"));
  assert.ok(result.operations_freeze_review_packet_rows.some((row) => row.source_evidence_row_key === "control_plane_loop" && row.required_reviewer_role === "control_plane_operator"));
  assert.ok(result.operations_freeze_review_packet_gate_rows.every((row) => row.gate_status === "ready" && row.approval_applied_by_gate === false && row.generated_artifact_read_performed_by_gate === false && row.protected_action_executed_by_gate === false));
});

test("platform operations freeze review packet blocks when the P483 evidence index is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-review-packet-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReviewPacket({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_review_packet_status, "blocked");
    assert.equal(result.summary.source_evidence_index_status, "blocked");
    assert.ok(result.operations_freeze_review_packet_gate_rows.some((row) => row.row_key === "p483_evidence_index_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReviewPacket({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze review packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze review packet blocks when P484 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-review-packet-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-review-packet"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-review-packet -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReviewPacket({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_review_packet_status, "blocked");
    assert.ok(result.operations_freeze_review_packet_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_review_packet_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReviewPacket({ packagePath, write: false, check: true }),
      /Platform operations freeze review packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze review packet --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-review-packet-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-review-packet.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-review-packet\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReviewPacket({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff ledger records P485 without completing signoff", async () => {
  const result = await runPlatformOperationsFreezeSignoffLedger({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_signoff_ledger_status, "ready_for_operations_freeze_signoff_ledger");
  assert.equal(result.summary.phase_slot, "P485");
  assert.equal(result.summary.previous_phase_slot, "P484");
  assert.equal(result.summary.next_phase_slot, "P486");
  assert.equal(result.summary.source_review_packet_status, "ready_for_operations_freeze_review_packet");
  assert.equal(result.summary.source_review_packet_row_count, 7);
  assert.equal(result.summary.source_review_packet_ready_review_row_count, 7);
  assert.equal(result.summary.signoff_row_count, 7);
  assert.equal(result.summary.ready_signoff_row_count, 7);
  assert.equal(result.summary.signoff_gate_count, 8);
  assert.equal(result.summary.ready_signoff_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.signoff_ledger_artifact_write_requested, false);
  assert.equal(result.summary.review_packet_consumed_in_memory, true);
  assert.equal(result.summary.review_packet_artifact_read_performed, false);
  assert.equal(result.summary.review_completed, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_signoff_rows.every((row) => row.signoff_status === "ready_for_human_signoff" && row.source_review_packet_status === "ready" && row.source_evidence_status === "ready" && row.signoff_completed_by_ledger === false && row.approval_applied_by_ledger === false && row.receipt_received_by_ledger === false && row.command_execution_performed_by_ledger === false && row.secret_exposure_allowed_by_ledger === false));
  assert.ok(result.operations_freeze_signoff_rows.some((row) => row.source_evidence_row_key === "trading_release_check" && row.required_signoff_role === "trading_safety_reviewer"));
  assert.ok(result.operations_freeze_signoff_rows.some((row) => row.source_evidence_row_key === "test" && row.required_signoff_role === "qa_reviewer"));
  assert.ok(result.operations_freeze_signoff_rows.some((row) => row.source_evidence_row_key === "control_plane_loop" && row.required_signoff_role === "control_plane_operator"));
  assert.ok(result.operations_freeze_signoff_gate_rows.every((row) => row.gate_status === "ready" && row.signoff_completed_by_gate === false && row.approval_applied_by_gate === false && row.receipt_received_by_gate === false && row.protected_action_executed_by_gate === false));
});

test("platform operations freeze signoff ledger blocks when the P484 review packet is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-ledger-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeSignoffLedger({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_ledger_status, "blocked");
    assert.equal(result.summary.source_review_packet_status, "blocked");
    assert.ok(result.operations_freeze_signoff_gate_rows.some((row) => row.row_key === "p484_review_packet_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffLedger({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze signoff ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff ledger blocks when P485 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-ledger-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-signoff-ledger"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-signoff-ledger -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSignoffLedger({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_ledger_status, "blocked");
    assert.ok(result.operations_freeze_signoff_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_signoff_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffLedger({ packagePath, write: false, check: true }),
      /Platform operations freeze signoff ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff ledger --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-ledger-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-signoff-ledger.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-signoff-ledger\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeSignoffLedger({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt template records P486 without receiving receipts", async () => {
  const result = await runPlatformOperationsFreezeSignoffReceiptTemplate({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_signoff_receipt_template_status, "ready_for_operations_freeze_signoff_receipt_template");
  assert.equal(result.summary.phase_slot, "P486");
  assert.equal(result.summary.previous_phase_slot, "P485");
  assert.equal(result.summary.next_phase_slot, "P487");
  assert.equal(result.summary.source_signoff_ledger_status, "ready_for_operations_freeze_signoff_ledger");
  assert.equal(result.summary.source_signoff_row_count, 7);
  assert.equal(result.summary.source_signoff_ready_row_count, 7);
  assert.equal(result.summary.receipt_template_count, 7);
  assert.equal(result.summary.ready_receipt_template_count, 7);
  assert.equal(result.summary.template_gate_count, 8);
  assert.equal(result.summary.ready_template_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_template_artifact_write_requested, false);
  assert.equal(result.summary.signoff_ledger_consumed_in_memory, true);
  assert.equal(result.summary.signoff_ledger_artifact_read_performed, false);
  assert.equal(result.summary.receipt_completed, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_signoff_receipt_templates.every((row) => row.receipt_template_status === "ready_for_human_receipt" && row.source_signoff_status === "ready_for_human_signoff" && row.receipt_completed_by_template === false && row.receipt_received_by_template === false && row.approval_applied_by_template === false && row.command_execution_performed_by_template === false && row.secret_exposure_allowed_by_template === false));
  assert.ok(result.operations_freeze_signoff_receipt_templates.some((row) => row.source_evidence_row_key === "trading_release_check" && row.allowed_decisions.includes("approve_ready_evidence")));
  assert.ok(result.operations_freeze_signoff_receipt_templates.some((row) => row.source_evidence_row_key === "test" && row.required_receipt_fields.includes("command_result_reference")));
  assert.ok(result.operations_freeze_signoff_receipt_template_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_completed_by_template === false && row.receipt_received_by_template === false && row.protected_action_executed_by_template === false));
});

test("platform operations freeze signoff receipt template blocks when the P485 signoff ledger is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-template-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeSignoffReceiptTemplate({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_receipt_template_status, "blocked");
    assert.equal(result.summary.source_signoff_ledger_status, "blocked");
    assert.ok(result.operations_freeze_signoff_receipt_template_gate_rows.some((row) => row.row_key === "p485_signoff_ledger_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffReceiptTemplate({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze signoff receipt template failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt template blocks when P486 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-template-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-signoff-receipt-template"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-signoff-receipt-template -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSignoffReceiptTemplate({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_receipt_template_status, "blocked");
    assert.ok(result.operations_freeze_signoff_receipt_template_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_signoff_receipt_template_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffReceiptTemplate({ packagePath, write: false, check: true }),
      /Platform operations freeze signoff receipt template failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt template --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-template-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-signoff-receipt-template.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-signoff-receipt-template\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeSignoffReceiptTemplate({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt intake records P487 without receiving receipts", async () => {
  const result = await runPlatformOperationsFreezeSignoffReceiptIntake({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_signoff_receipt_intake_status, "ready_for_operations_freeze_signoff_receipt_intake");
  assert.equal(result.summary.phase_slot, "P487");
  assert.equal(result.summary.previous_phase_slot, "P486");
  assert.equal(result.summary.next_phase_slot, "P488");
  assert.equal(result.summary.source_receipt_template_status, "ready_for_operations_freeze_signoff_receipt_template");
  assert.equal(result.summary.source_receipt_template_count, 7);
  assert.equal(result.summary.source_receipt_template_ready_count, 7);
  assert.equal(result.summary.intake_row_count, 7);
  assert.equal(result.summary.ready_intake_row_count, 7);
  assert.equal(result.summary.intake_gate_count, 8);
  assert.equal(result.summary.ready_intake_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_intake_artifact_write_requested, false);
  assert.equal(result.summary.receipt_template_consumed_in_memory, true);
  assert.equal(result.summary.receipt_template_artifact_read_performed, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_signoff_receipt_intake_rows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input && row.ready_for_validation === false && row.receipt_received_by_intake === false && row.receipt_validated_by_intake === false && row.approval_applied_by_intake === false && row.secret_exposure_allowed_by_intake === false));
  assert.ok(result.operations_freeze_signoff_receipt_intake_rows.some((row) => row.source_evidence_row_key === "test" && row.required_receipt_fields.includes("command_result_reference")));
  assert.ok(result.operations_freeze_signoff_receipt_intake_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_received_by_intake === false && row.receipt_validated_by_intake === false && row.protected_action_executed_by_intake === false));
});

test("platform operations freeze signoff receipt intake blocks when the P486 receipt template is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-intake-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeSignoffReceiptIntake({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_receipt_intake_status, "blocked");
    assert.equal(result.summary.source_receipt_template_status, "blocked");
    assert.ok(result.operations_freeze_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "p486_receipt_template_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffReceiptIntake({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze signoff receipt intake failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt intake blocks when P487 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-intake-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-signoff-receipt-intake"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-signoff-receipt-intake -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSignoffReceiptIntake({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_receipt_intake_status, "blocked");
    assert.ok(result.operations_freeze_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_signoff_receipt_intake_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffReceiptIntake({ packagePath, write: false, check: true }),
      /Platform operations freeze signoff receipt intake failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff receipt intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-receipt-intake-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-signoff-receipt-intake.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-signoff-receipt-intake\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeSignoffReceiptIntake({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff closeout records P488 without completing signoff", async () => {
  const result = await runPlatformOperationsFreezeSignoffCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_signoff_closeout_status, "ready_for_operations_freeze_signoff_closeout");
  assert.equal(result.summary.phase_slot, "P488");
  assert.equal(result.summary.previous_phase_slot, "P487");
  assert.equal(result.summary.next_phase_slot, "P489");
  assert.equal(result.summary.source_receipt_intake_status, "ready_for_operations_freeze_signoff_receipt_intake");
  assert.equal(result.summary.closeout_row_count, 7);
  assert.equal(result.summary.ready_closeout_row_count, 7);
  assert.equal(result.summary.closeout_gate_count, 8);
  assert.equal(result.summary.ready_closeout_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.closeout_artifact_write_requested, false);
  assert.equal(result.summary.receipt_intake_consumed_in_memory, true);
  assert.equal(result.summary.receipt_intake_artifact_read_performed, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.receipt_materialized, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_signoff_closeout_rows.every((row) => row.closeout_status === "ready_for_human_receipt_collection" && row.source_receipt_intake_status === "awaiting_human_receipt" && row.human_receipt_collection_required && row.receipt_received_by_closeout === false && row.ready_for_validation_by_closeout === false && row.signoff_completed_by_closeout === false && row.approval_applied_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
  assert.ok(result.operations_freeze_signoff_closeout_rows.some((row) => row.source_evidence_row_key === "control_plane_loop" && row.required_receipt_fields.includes("evidence_reference")));
  assert.ok(result.operations_freeze_signoff_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_received_by_closeout === false && row.receipt_validated_by_closeout === false && row.protected_action_executed_by_closeout === false));
});

test("platform operations freeze signoff closeout blocks when the P487 receipt intake is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-closeout-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeSignoffCloseout({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_intake_status, "blocked");
    assert.ok(result.operations_freeze_signoff_closeout_gate_rows.some((row) => row.row_key === "p487_receipt_intake_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffCloseout({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze signoff closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff closeout blocks when P488 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-signoff-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-signoff-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeSignoffCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_signoff_closeout_status, "blocked");
    assert.ok(result.operations_freeze_signoff_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_signoff_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeSignoffCloseout({ packagePath, write: false, check: true }),
      /Platform operations freeze signoff closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze signoff closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-signoff-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-signoff-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-signoff-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeSignoffCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze status ledger records P489 while human receipts remain pending", async () => {
  const result = await runPlatformOperationsFreezeStatusLedger({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_status_ledger_status, "ready_pending_human_receipt");
  assert.equal(result.summary.phase_slot, "P489");
  assert.equal(result.summary.previous_phase_slot, "P488");
  assert.equal(result.summary.next_phase_slot, "P490");
  assert.equal(result.summary.source_signoff_closeout_status, "ready_for_operations_freeze_signoff_closeout");
  assert.equal(result.summary.status_row_count, 7);
  assert.equal(result.summary.ready_status_row_count, 7);
  assert.equal(result.summary.status_gate_count, 8);
  assert.equal(result.summary.ready_status_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.status_ledger_artifact_write_requested, false);
  assert.equal(result.summary.signoff_closeout_consumed_in_memory, true);
  assert.equal(result.summary.signoff_closeout_artifact_read_performed, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.human_receipt_pending, true);
  assert.equal(result.summary.operations_freeze_ready_without_human_receipt, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_status_rows.every((row) => row.operations_freeze_status === "ready_pending_human_receipt" && row.source_closeout_status === "ready_for_human_receipt_collection" && row.human_receipt_collection_required && row.human_receipt_pending && row.operations_freeze_ready_without_human_receipt === false && row.receipt_received_by_status_ledger === false && row.approval_applied_by_status_ledger === false && row.secret_exposure_allowed_by_status_ledger === false));
  assert.ok(result.operations_freeze_status_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_status_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_received_by_status_ledger === false && row.protected_action_executed_by_status_ledger === false));
});

test("platform operations freeze status ledger blocks when the P488 signoff closeout is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-status-ledger-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P480: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeStatusLedger({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_status_ledger_status, "blocked");
    assert.equal(result.summary.source_signoff_closeout_status, "blocked");
    assert.ok(result.operations_freeze_status_gate_rows.some((row) => row.row_key === "p488_signoff_closeout_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeStatusLedger({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze status ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze status ledger blocks when P489 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-status-ledger-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-status-ledger"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-status-ledger -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeStatusLedger({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_status_ledger_status, "blocked");
    assert.ok(result.operations_freeze_status_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_status_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeStatusLedger({ packagePath, write: false, check: true }),
      /Platform operations freeze status ledger failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze status ledger --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-status-ledger-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-status-ledger.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-status-ledger\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeStatusLedger({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt queue records P490 while human receipts remain pending", async () => {
  const result = await runPlatformOperationsFreezeReceiptQueue({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_queue_status, "queued_for_human_receipt");
  assert.equal(result.summary.phase_slot, "P490");
  assert.equal(result.summary.previous_phase_slot, "P489");
  assert.equal(result.summary.next_phase_slot, "P491");
  assert.equal(result.summary.source_status_ledger_status, "ready_pending_human_receipt");
  assert.equal(result.summary.queue_row_count, 7);
  assert.equal(result.summary.ready_queue_row_count, 7);
  assert.equal(result.summary.queue_gate_count, 8);
  assert.equal(result.summary.ready_queue_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_queue_artifact_write_requested, false);
  assert.equal(result.summary.status_ledger_consumed_in_memory, true);
  assert.equal(result.summary.status_ledger_artifact_read_performed, false);
  assert.equal(result.summary.human_receipt_collection_required, true);
  assert.equal(result.summary.human_receipt_pending, true);
  assert.equal(result.summary.ready_for_human_input, true);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.operations_freeze_ready_without_human_receipt, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.deepEqual(result.operations_freeze_receipt_queue_rows.map((row) => row.queue_position), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(result.operations_freeze_receipt_queue_rows.every((row) => row.receipt_queue_status === "queued_for_human_receipt" && row.source_operations_freeze_status === "ready_pending_human_receipt" && row.human_receipt_collection_required && row.human_receipt_pending && row.ready_for_human_input && row.ready_for_validation === false && row.operations_freeze_ready_without_human_receipt === false && row.receipt_received_by_queue === false && row.approval_applied_by_queue === false && row.secret_exposure_allowed_by_queue === false));
  assert.ok(result.operations_freeze_receipt_queue_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_queue_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_received_by_queue === false && row.protected_action_executed_by_queue === false));
});

test("platform operations freeze receipt queue blocks when the P489 status ledger is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-queue-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P489: `platform:operations-freeze-status-ledger`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptQueue({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_queue_status, "blocked");
    assert.equal(result.summary.source_status_ledger_status, "blocked");
    assert.ok(result.operations_freeze_receipt_queue_gate_rows.some((row) => row.row_key === "p489_status_ledger_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptQueue({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt queue failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt queue blocks when P490 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-queue-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-queue"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-queue -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptQueue({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_queue_status, "blocked");
    assert.ok(result.operations_freeze_receipt_queue_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_queue_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptQueue({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt queue failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt queue --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-queue-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-queue.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-queue\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptQueue({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation rules record P491 without receipt payloads", async () => {
  const result = await runPlatformOperationsFreezeReceiptValidationRules({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_validation_rules_status, "ready_for_future_receipt_validation");
  assert.equal(result.summary.phase_slot, "P491");
  assert.equal(result.summary.previous_phase_slot, "P490");
  assert.equal(result.summary.next_phase_slot, "P492");
  assert.equal(result.summary.source_receipt_queue_status, "queued_for_human_receipt");
  assert.equal(result.summary.rule_row_count, 7);
  assert.equal(result.summary.ready_rule_row_count, 7);
  assert.equal(result.summary.rule_gate_count, 8);
  assert.equal(result.summary.ready_rule_gate_count, 8);
  assert.equal(result.summary.required_receipt_field_count, 7);
  assert.equal(result.summary.allowed_receipt_decision_count, 2);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_validation_rules_artifact_write_requested, false);
  assert.equal(result.summary.receipt_queue_consumed_in_memory, true);
  assert.equal(result.summary.receipt_queue_artifact_read_performed, false);
  assert.equal(result.summary.validation_rules_declared, true);
  assert.equal(result.summary.future_receipt_validation_required, true);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_to_validate_receipt_payload, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_validation_rule_rows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.source_receipt_queue_status === "queued_for_human_receipt" && row.required_receipt_fields.includes("reviewer_id") && row.required_receipt_fields.includes("command_result_reference") && row.required_receipt_fields.includes("blocker_note") && row.allowed_receipt_decisions.includes("approve_ready_evidence") && row.allowed_receipt_decisions.includes("return_with_blocker") && row.receipt_payload_present === false && row.ready_to_validate_receipt_payload === false && row.receipt_validated_by_rules === false && row.approval_applied_by_rules === false && row.secret_exposure_allowed_by_rules === false));
  assert.ok(result.operations_freeze_receipt_validation_rule_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_validation_rules_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_validated_by_rules === false && row.protected_action_executed_by_rules === false));
});

test("platform operations freeze receipt validation rules block when the P490 receipt queue is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-rules-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P490: `platform:operations-freeze-receipt-queue`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptValidationRules({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_validation_rules_status, "blocked");
    assert.equal(result.summary.source_receipt_queue_status, "blocked");
    assert.ok(result.operations_freeze_receipt_validation_rules_gate_rows.some((row) => row.row_key === "p490_receipt_queue_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptValidationRules({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt validation rules failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation rules block when P491 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-rules-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-validation-rules"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-validation-rules -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptValidationRules({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_validation_rules_status, "blocked");
    assert.ok(result.operations_freeze_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_validation_rules_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptValidationRules({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt validation rules failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation rules --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-rules-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-validation-rules.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-validation-rules\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptValidationRules({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace records P492 without materializing receipt inputs", async () => {
  const result = await runPlatformOperationsFreezeReceiptWorkspace({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_workspace_status, "ready_for_human_receipt_workspace");
  assert.equal(result.summary.phase_slot, "P492");
  assert.equal(result.summary.previous_phase_slot, "P491");
  assert.equal(result.summary.next_phase_slot, "P493");
  assert.equal(result.summary.source_receipt_validation_rules_status, "ready_for_future_receipt_validation");
  assert.equal(result.summary.workspace_row_count, 7);
  assert.equal(result.summary.ready_workspace_row_count, 7);
  assert.equal(result.summary.workspace_gate_count, 8);
  assert.equal(result.summary.ready_workspace_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_workspace_artifact_write_requested, false);
  assert.equal(result.summary.validation_rules_consumed_in_memory, true);
  assert.equal(result.summary.validation_rules_artifact_read_performed, false);
  assert.equal(result.summary.workspace_rows_declared, true);
  assert.equal(result.summary.editable_receipt_fields_declared, true);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_workspace_rows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.source_receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.required_receipt_fields.includes("reviewer_id") && row.required_receipt_fields.includes("command_result_reference") && row.allowed_receipt_decisions.includes("approve_ready_evidence") && row.allowed_receipt_decisions.includes("return_with_blocker") && row.editable_receipt_fields_declared && row.receipt_input_file_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_workspace === false && row.approval_applied_by_workspace === false && row.secret_exposure_allowed_by_workspace === false));
  assert.ok(result.operations_freeze_receipt_workspace_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_workspace_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_validated_by_workspace === false && row.protected_action_executed_by_workspace === false && row.secret_exposure_allowed_by_workspace === false));
});

test("platform operations freeze receipt workspace blocks when the P491 validation rules are blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P491: `platform:operations-freeze-receipt-validation-rules`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptWorkspace({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_workspace_status, "blocked");
    assert.equal(result.summary.source_receipt_validation_rules_status, "blocked");
    assert.ok(result.operations_freeze_receipt_workspace_gate_rows.some((row) => row.row_key === "p491_receipt_validation_rules_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptWorkspace({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt workspace failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace blocks when P492 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-workspace"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-workspace -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptWorkspace({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_workspace_status, "blocked");
    assert.ok(result.operations_freeze_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_workspace_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptWorkspace({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt workspace failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-workspace.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-workspace\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptWorkspace({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace merge records P493 without merging receipt inputs", async () => {
  const result = await runPlatformOperationsFreezeReceiptWorkspaceMerge({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_workspace_merge_status, "ready_for_future_receipt_merge");
  assert.equal(result.summary.phase_slot, "P493");
  assert.equal(result.summary.previous_phase_slot, "P492");
  assert.equal(result.summary.next_phase_slot, "P494");
  assert.equal(result.summary.source_receipt_workspace_status, "ready_for_human_receipt_workspace");
  assert.equal(result.summary.merge_row_count, 7);
  assert.equal(result.summary.ready_merge_row_count, 7);
  assert.equal(result.summary.merge_gate_count, 8);
  assert.equal(result.summary.ready_merge_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_workspace_merge_artifact_write_requested, false);
  assert.equal(result.summary.receipt_workspace_consumed_in_memory, true);
  assert.equal(result.summary.receipt_workspace_artifact_read_performed, false);
  assert.equal(result.summary.merge_manifest_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_workspace_merge_rows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && row.source_workspace_status === "ready_for_human_receipt_input" && row.actor_workspace_required && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_merge === false && row.approval_applied_by_merge === false && row.secret_exposure_allowed_by_merge === false));
  assert.ok(result.operations_freeze_receipt_workspace_merge_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_workspace_merge_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_validated_by_merge === false && row.protected_action_executed_by_merge === false && row.secret_exposure_allowed_by_merge === false));
});

test("platform operations freeze receipt workspace merge blocks when the P492 workspace is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-merge-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P492: `platform:operations-freeze-receipt-workspace`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptWorkspaceMerge({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_workspace_merge_status, "blocked");
    assert.equal(result.summary.source_receipt_workspace_status, "blocked");
    assert.ok(result.operations_freeze_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "p492_receipt_workspace_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptWorkspaceMerge({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt workspace merge failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace merge blocks when P493 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-merge-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-workspace-merge"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-workspace-merge -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptWorkspaceMerge({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_workspace_merge_status, "blocked");
    assert.ok(result.operations_freeze_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_workspace_merge_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptWorkspaceMerge({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt workspace merge failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt workspace merge --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-workspace-merge-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-workspace-merge.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-workspace-merge\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptWorkspaceMerge({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt merge preflight records P494 without validating receipts", async () => {
  const result = await runPlatformOperationsFreezeReceiptMergePreflight({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_merge_preflight_status, "ready_for_future_receipt_merge_validation");
  assert.equal(result.summary.phase_slot, "P494");
  assert.equal(result.summary.previous_phase_slot, "P493");
  assert.equal(result.summary.next_phase_slot, "P495");
  assert.equal(result.summary.source_receipt_workspace_merge_status, "ready_for_future_receipt_merge");
  assert.equal(result.summary.preflight_row_count, 7);
  assert.equal(result.summary.ready_preflight_row_count, 7);
  assert.equal(result.summary.preflight_gate_count, 8);
  assert.equal(result.summary.ready_preflight_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_merge_preflight_artifact_write_requested, false);
  assert.equal(result.summary.receipt_workspace_merge_consumed_in_memory, true);
  assert.equal(result.summary.receipt_workspace_merge_artifact_read_performed, false);
  assert.equal(result.summary.merge_validation_preflight_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_merge_preflight_rows.every((row) => row.preflight_status === "ready_for_future_receipt_merge_validation" && row.source_workspace_merge_status === "ready_for_future_receipt_merge" && row.merge_validation_preflight_declared && row.future_validation_checks.includes("command_result_reference_present") && row.actor_workspace_required && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_preflight === false && row.approval_applied_by_preflight === false && row.secret_exposure_allowed_by_preflight === false));
  assert.ok(result.operations_freeze_receipt_merge_preflight_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_merge_preflight_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_validated_by_preflight === false && row.protected_action_executed_by_preflight === false && row.secret_exposure_allowed_by_preflight === false));
});

test("platform operations freeze receipt merge preflight blocks when the P493 workspace merge is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-merge-preflight-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P493: `platform:operations-freeze-receipt-workspace-merge`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptMergePreflight({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_merge_preflight_status, "blocked");
    assert.equal(result.summary.source_receipt_workspace_merge_status, "blocked");
    assert.ok(result.operations_freeze_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "p493_receipt_workspace_merge_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptMergePreflight({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt merge preflight failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt merge preflight blocks when P494 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-merge-preflight-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-merge-preflight"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-merge-preflight -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptMergePreflight({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_merge_preflight_status, "blocked");
    assert.ok(result.operations_freeze_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_merge_preflight_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptMergePreflight({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt merge preflight failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt merge preflight --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-merge-preflight-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-merge-preflight.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-merge-preflight\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptMergePreflight({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation packet records P495 without validating receipts", async () => {
  const result = await runPlatformOperationsFreezeReceiptValidationPacket({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_validation_packet_status, "ready_for_future_receipt_validation_packet");
  assert.equal(result.summary.phase_slot, "P495");
  assert.equal(result.summary.previous_phase_slot, "P494");
  assert.equal(result.summary.next_phase_slot, "P496");
  assert.equal(result.summary.source_receipt_merge_preflight_status, "ready_for_future_receipt_merge_validation");
  assert.equal(result.summary.packet_row_count, 7);
  assert.equal(result.summary.ready_packet_row_count, 7);
  assert.equal(result.summary.packet_gate_count, 8);
  assert.equal(result.summary.ready_packet_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_validation_packet_artifact_write_requested, false);
  assert.equal(result.summary.receipt_merge_preflight_consumed_in_memory, true);
  assert.equal(result.summary.receipt_merge_preflight_artifact_read_performed, false);
  assert.equal(result.summary.validation_packet_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_validation_packet_rows.every((row) => row.validation_packet_status === "ready_for_future_receipt_validation_packet" && row.source_merge_preflight_status === "ready_for_future_receipt_merge_validation" && row.validation_packet_declared && row.validation_packet_checks.includes("command_result_reference_present") && row.actor_workspace_required && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.receipt_validated_by_packet === false && row.approval_applied_by_packet === false && row.secret_exposure_allowed_by_packet === false));
  assert.ok(result.operations_freeze_receipt_validation_packet_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_validation_packet_gate_rows.every((row) => row.gate_status === "ready" && row.receipt_validated_by_packet === false && row.protected_action_executed_by_packet === false && row.secret_exposure_allowed_by_packet === false));
});

test("platform operations freeze receipt validation packet blocks when the P494 merge preflight is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-packet-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P494: `platform:operations-freeze-receipt-merge-preflight`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptValidationPacket({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_validation_packet_status, "blocked");
    assert.equal(result.summary.source_receipt_merge_preflight_status, "blocked");
    assert.ok(result.operations_freeze_receipt_validation_packet_gate_rows.some((row) => row.row_key === "p494_receipt_merge_preflight_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptValidationPacket({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt validation packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation packet blocks when P495 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-packet-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-validation-packet"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-validation-packet -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptValidationPacket({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_validation_packet_status, "blocked");
    assert.ok(result.operations_freeze_receipt_validation_packet_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_validation_packet_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptValidationPacket({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt validation packet failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt validation packet --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-validation-packet-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-validation-packet.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-validation-packet\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptValidationPacket({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval plan records P496 without applying approvals", async () => {
  const result = await runPlatformOperationsFreezeReceiptApprovalPlan({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_approval_plan_status, "ready_for_future_receipt_approval_plan");
  assert.equal(result.summary.phase_slot, "P496");
  assert.equal(result.summary.previous_phase_slot, "P495");
  assert.equal(result.summary.next_phase_slot, "P497");
  assert.equal(result.summary.source_receipt_validation_packet_status, "ready_for_future_receipt_validation_packet");
  assert.equal(result.summary.approval_plan_row_count, 7);
  assert.equal(result.summary.ready_approval_plan_row_count, 7);
  assert.equal(result.summary.approval_plan_gate_count, 8);
  assert.equal(result.summary.ready_approval_plan_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_approval_plan_artifact_write_requested, false);
  assert.equal(result.summary.receipt_validation_packet_consumed_in_memory, true);
  assert.equal(result.summary.receipt_validation_packet_artifact_read_performed, false);
  assert.equal(result.summary.approval_plan_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_approval_plan_rows.every((row) => row.approval_plan_status === "ready_for_future_receipt_approval_plan" && row.source_validation_packet_status === "ready_for_future_receipt_validation_packet" && row.approval_plan_declared && row.approval_plan_checks.includes("human_gate_application_future_only") && row.actor_workspace_required && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.ready_for_approval_application === false && row.receipt_validated_by_plan === false && row.approval_applied_by_plan === false && row.secret_exposure_allowed_by_plan === false));
  assert.ok(result.operations_freeze_receipt_approval_plan_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_approval_plan_gate_rows.every((row) => row.gate_status === "ready" && row.ready_for_approval_application_by_plan === false && row.receipt_validated_by_plan === false && row.protected_action_executed_by_plan === false && row.secret_exposure_allowed_by_plan === false));
});

test("platform operations freeze receipt approval plan blocks when the P495 validation packet is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-plan-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P495: `platform:operations-freeze-receipt-validation-packet`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptApprovalPlan({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_approval_plan_status, "blocked");
    assert.equal(result.summary.source_receipt_validation_packet_status, "blocked");
    assert.ok(result.operations_freeze_receipt_approval_plan_gate_rows.some((row) => row.row_key === "p495_receipt_validation_packet_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptApprovalPlan({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt approval plan failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval plan blocks when P496 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-plan-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-approval-plan"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-approval-plan -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptApprovalPlan({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_approval_plan_status, "blocked");
    assert.ok(result.operations_freeze_receipt_approval_plan_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_approval_plan_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptApprovalPlan({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt approval plan failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval plan --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-plan-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-approval-plan.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-approval-plan\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptApprovalPlan({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval closeout records P497 without applying approvals", async () => {
  const result = await runPlatformOperationsFreezeReceiptApprovalCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_approval_closeout_status, "ready_for_future_receipt_approval_closeout");
  assert.equal(result.summary.phase_slot, "P497");
  assert.equal(result.summary.previous_phase_slot, "P496");
  assert.equal(result.summary.next_phase_slot, "P498");
  assert.equal(result.summary.source_receipt_approval_plan_status, "ready_for_future_receipt_approval_plan");
  assert.equal(result.summary.approval_closeout_row_count, 7);
  assert.equal(result.summary.ready_approval_closeout_row_count, 7);
  assert.equal(result.summary.approval_closeout_gate_count, 8);
  assert.equal(result.summary.ready_approval_closeout_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_approval_closeout_artifact_write_requested, false);
  assert.equal(result.summary.receipt_approval_plan_consumed_in_memory, true);
  assert.equal(result.summary.receipt_approval_plan_artifact_read_performed, false);
  assert.equal(result.summary.approval_closeout_declared, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_approval_closeout_rows.every((row) => row.approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.source_approval_plan_status === "ready_for_future_receipt_approval_plan" && row.approval_closeout_declared && row.approval_closeout_checks.includes("reviewer_role_matches_plan") && row.actor_workspace_required && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_validation === false && row.ready_for_approval_application === false && row.receipt_validated_by_closeout === false && row.approval_applied_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
  assert.ok(result.operations_freeze_receipt_approval_closeout_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_approval_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.ready_for_approval_application_by_closeout === false && row.receipt_validated_by_closeout === false && row.protected_action_executed_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
});

test("platform operations freeze receipt approval closeout blocks when the P496 approval plan is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-closeout-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P496: `platform:operations-freeze-receipt-approval-plan`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptApprovalCloseout({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_approval_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_approval_plan_status, "blocked");
    assert.ok(result.operations_freeze_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "p496_receipt_approval_plan_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptApprovalCloseout({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt approval closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval closeout blocks when P497 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-approval-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-approval-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptApprovalCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_approval_closeout_status, "blocked");
    assert.ok(result.operations_freeze_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_approval_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptApprovalCloseout({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt approval closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt approval closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-approval-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-approval-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-approval-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptApprovalCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt closeout records P498 without applying approvals", async () => {
  const result = await runPlatformOperationsFreezeReceiptCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_closeout_status, "ready_for_operations_freeze_receipt_chain_closeout");
  assert.equal(result.summary.phase_slot, "P498");
  assert.equal(result.summary.previous_phase_slot, "P497");
  assert.equal(result.summary.next_phase_slot, "P499");
  assert.equal(result.summary.source_receipt_approval_closeout_status, "ready_for_future_receipt_approval_closeout");
  assert.equal(result.summary.receipt_closeout_row_count, 7);
  assert.equal(result.summary.ready_receipt_closeout_row_count, 7);
  assert.equal(result.summary.receipt_closeout_gate_count, 8);
  assert.equal(result.summary.ready_receipt_closeout_gate_count, 8);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_approval_closeout_consumed_in_memory, true);
  assert.equal(result.summary.receipt_approval_closeout_artifact_read_performed, false);
  assert.equal(result.summary.receipt_closeout_declared, true);
  assert.equal(result.summary.p481_p498_chain_ready, true);
  assert.equal(result.summary.human_receipts_pending, true);
  assert.equal(result.summary.ready_for_p499_chain_regression, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_closeout_rows.every((row) => row.receipt_closeout_status === "ready_for_operations_freeze_receipt_chain_closeout" && row.source_approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.receipt_closeout_declared && row.p481_p498_chain_ready && row.human_receipts_pending && row.ready_for_p499_chain_regression && row.receipt_closeout_checks.includes("acceptance_command_execution_disabled") && row.actor_workspace_input_present === false && row.receipt_input_file_materialized === false && row.merged_receipt_input_materialized === false && row.receipt_payload_present === false && row.ready_for_approval_application === false && row.approval_applied_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
  assert.ok(result.operations_freeze_receipt_closeout_rows.some((row) => row.source_evidence_row_key === "validate" && row.package_script_name === "validate"));
  assert.ok(result.operations_freeze_receipt_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.ready_for_approval_application_by_closeout === false && row.receipt_validated_by_closeout === false && row.protected_action_executed_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
});

test("platform operations freeze receipt closeout blocks when the P497 approval closeout is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-closeout-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P497: `platform:operations-freeze-receipt-approval-closeout`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptCloseout({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_approval_closeout_status, "blocked");
    assert.ok(result.operations_freeze_receipt_closeout_gate_rows.some((row) => row.row_key === "p497_receipt_approval_closeout_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptCloseout({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt closeout blocks when P498 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_closeout_status, "blocked");
    assert.ok(result.operations_freeze_receipt_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptCloseout({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt chain regression records P499 without receiving receipts", async () => {
  const result = await runPlatformOperationsFreezeReceiptChainRegression({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_receipt_chain_regression_status, "ready_for_operations_freeze_receipt_chain_regression");
  assert.equal(result.summary.phase_slot, "P499");
  assert.equal(result.summary.previous_phase_slot, "P498");
  assert.equal(result.summary.next_phase_slot, "P500");
  assert.equal(result.summary.source_receipt_closeout_status, "ready_for_operations_freeze_receipt_chain_closeout");
  assert.equal(result.summary.chain_phase_count, 18);
  assert.equal(result.summary.ready_chain_phase_count, 18);
  assert.equal(result.summary.chain_gate_count, 9);
  assert.equal(result.summary.ready_chain_gate_count, 9);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.receipt_closeout_consumed_in_memory, true);
  assert.equal(result.summary.receipt_closeout_artifact_read_performed, false);
  assert.equal(result.summary.receipt_chain_regression_declared, true);
  assert.equal(result.summary.p481_p498_chain_ready, true);
  assert.equal(result.summary.human_receipts_pending, true);
  assert.equal(result.summary.ready_for_p500_closeout, true);
  assert.equal(result.summary.actor_workspace_input_present, false);
  assert.equal(result.summary.receipt_input_file_materialized, false);
  assert.equal(result.summary.merged_receipt_input_materialized, false);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_receipt_chain_regression_rows.every((row) => row.chain_phase_status === "ready_for_operations_freeze_receipt_chain_regression" && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.receipt_chain_regression_declared && row.p481_p498_chain_ready && row.human_receipts_pending && row.receipt_payload_present === false && row.ready_for_validation === false && row.ready_for_approval_application === false && row.approval_applied_by_regression === false && row.acceptance_command_execution_performed_by_regression === false && row.secret_exposure_allowed_by_regression === false));
  assert.ok(result.operations_freeze_receipt_chain_regression_rows.some((row) => row.source_phase_slot === "P498" && row.package_script_name === "platform:operations-freeze-receipt-closeout"));
  assert.ok(result.operations_freeze_receipt_chain_regression_gate_rows.every((row) => row.gate_status === "ready" && row.approval_applied_by_regression === false && row.acceptance_command_execution_performed_by_regression === false && row.protected_action_executed_by_regression === false && row.secret_exposure_allowed_by_regression === false));
});

test("platform operations freeze receipt chain regression blocks when the P498 closeout is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-chain-regression-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P498: `platform:operations-freeze-receipt-closeout`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeReceiptChainRegression({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_chain_regression_status, "blocked");
    assert.equal(result.summary.source_receipt_closeout_status, "blocked");
    assert.ok(result.operations_freeze_receipt_chain_regression_gate_rows.some((row) => row.row_key === "p498_receipt_closeout_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptChainRegression({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze receipt chain regression failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt chain regression blocks when P499 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-chain-regression-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-receipt-chain-regression"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-receipt-chain-regression -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeReceiptChainRegression({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_receipt_chain_regression_status, "blocked");
    assert.ok(result.operations_freeze_receipt_chain_regression_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_receipt_chain_regression_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeReceiptChainRegression({ packagePath, write: false, check: true }),
      /Platform operations freeze receipt chain regression failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze receipt chain regression --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-receipt-chain-regression-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-receipt-chain-regression.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-receipt-chain-regression\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeReceiptChainRegression({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze closeout records P500 without executing acceptance commands", async () => {
  const result = await runPlatformOperationsFreezeCloseout({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_operations_freeze_closeout_status, "ready_for_platform_operations_stability_closeout");
  assert.equal(result.summary.phase_slot, "P500");
  assert.equal(result.summary.previous_phase_slot, "P499");
  assert.equal(result.summary.next_phase_slot, "complete");
  assert.equal(result.summary.source_receipt_chain_regression_status, "ready_for_operations_freeze_receipt_chain_regression");
  assert.equal(result.summary.closeout_row_count, 7);
  assert.equal(result.summary.ready_closeout_row_count, 7);
  assert.equal(result.summary.closeout_gate_count, 9);
  assert.equal(result.summary.ready_closeout_gate_count, 9);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.closeout_declared, true);
  assert.equal(result.summary.p341_p500_program_ready, true);
  assert.equal(result.summary.human_receipts_pending, true);
  assert.equal(result.summary.final_program_phase, true);
  assert.equal(result.summary.receipt_payload_present, false);
  assert.equal(result.summary.ready_for_validation, false);
  assert.equal(result.summary.ready_for_approval_application, false);
  assert.equal(result.summary.receipt_received, false);
  assert.equal(result.summary.receipt_validated, false);
  assert.equal(result.summary.signoff_completed, false);
  assert.equal(result.summary.approval_applied, false);
  assert.equal(result.summary.command_execution_performed, false);
  assert.equal(result.summary.package_command_execution_performed, false);
  assert.equal(result.summary.acceptance_command_execution_performed, false);
  assert.equal(result.summary.generated_artifact_read_performed, false);
  assert.equal(result.summary.artifact_read_performed, false);
  assert.equal(result.summary.artifact_write_performed, false);
  assert.equal(result.summary.dependency_install_performed, false);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.git_operation_performed, false);
  assert.equal(result.summary.protected_action_executed, false);
  assert.equal(result.summary.protected_recovery_execution_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
  assert.equal(result.summary.exchange_write_allowed, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.secret_exposure_allowed, false);
  assert.equal(result.summary.secret_values_read, false);
  assert.equal(result.summary.env_file_read, false);
  assert.equal(result.summary.desktop_config_content_inspected, false);
  assert.equal(result.summary.desktop_provider_key_visible, false);
  assert.equal(result.summary.credential_lookup_allowed, false);
  assert.ok(result.operations_freeze_closeout_rows.every((row) => row.closeout_status === "ready_for_platform_operations_stability_closeout" && row.source_receipt_chain_regression_status === "ready_for_operations_freeze_receipt_chain_regression" && row.closeout_declared && row.human_review_required && row.human_signoff_required && row.human_receipts_pending && row.p341_p500_program_ready && row.receipt_payload_present === false && row.ready_for_validation === false && row.ready_for_approval_application === false && row.approval_applied_by_closeout === false && row.acceptance_command_execution_performed_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
  assert.ok(result.operations_freeze_closeout_rows.some((row) => row.closeout_lane_key === "chain_regression_handoff"));
  assert.ok(result.operations_freeze_closeout_gate_rows.every((row) => row.gate_status === "ready" && row.approval_applied_by_closeout === false && row.acceptance_command_execution_performed_by_closeout === false && row.protected_action_executed_by_closeout === false && row.secret_exposure_allowed_by_closeout === false));
});

test("platform operations freeze closeout blocks when the P499 chain regression is blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-closeout-source-"));
  try {
    const ledgerText = await readFile("docs/platform-operations-stability-phase-ledger.md", "utf8");
    const ledgerPath = path.join(root, "platform-operations-stability-phase-ledger.md");
    await writeFile(ledgerPath, ledgerText.replace(/^- P499: `platform:operations-freeze-receipt-chain-regression`.*\n/m, ""), "utf8");

    const result = await runPlatformOperationsFreezeCloseout({ platformOpsLedgerPath: ledgerPath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_closeout_status, "blocked");
    assert.equal(result.summary.source_receipt_chain_regression_status, "blocked");
    assert.ok(result.operations_freeze_closeout_gate_rows.some((row) => row.row_key === "p499_chain_regression_ready" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeCloseout({ platformOpsLedgerPath: ledgerPath, write: false, check: true }),
      /Platform operations freeze closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze closeout blocks when P500 validation-chain registration is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-closeout-validation-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    delete packageJson.scripts["platform:operations-freeze-closeout"];
    packageJson.scripts.validate = packageJson.scripts.validate.replace(" && npm run platform:operations-freeze-closeout -- --check", "");
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformOperationsFreezeCloseout({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_operations_freeze_closeout_status, "blocked");
    assert.ok(result.operations_freeze_closeout_gate_rows.some((row) => row.row_key === "platform_package_script_registered" && row.gate_status === "blocked"));
    assert.ok(result.operations_freeze_closeout_gate_rows.some((row) => row.row_key === "platform_validation_chain_registered" && row.gate_status === "blocked"));
    await assert.rejects(
      () => runPlatformOperationsFreezeCloseout({ packagePath, write: false, check: true }),
      /Platform operations freeze closeout failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform operations freeze closeout --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-freeze-closeout-no-overwrite-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-operations-freeze-closeout.json");
    const sentinel = "{ \"sentinel\": \"platform-operations-freeze-closeout\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformOperationsFreezeCloseout({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
