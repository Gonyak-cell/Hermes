import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryWorkbenchReadModel } from "./factory-workbench-read-model.mjs";

export const DEFAULT_FACTORY_CANDIDATE_LANE_OUT_DIR = "artifacts/factory-candidate-lane/latest";
export const DEFAULT_FACTORY_CANDIDATE_WORKTREE_ROOT = "artifacts/factory-candidate-lane/worktrees";

const COMMAND_NAME = "factory:candidate-lane";
const SCHEMA_VERSION = "factory-candidate-lane.v1";
const CAPABILITY_ID = "factory.candidate_lane";
const PROGRAM_RANGE = "FCORE-FC.1";
const READY_STATUS = "ready_factory_candidate_lane";
const BLOCKED_STATUS = "blocked_factory_candidate_lane";
const HASH_RE = /^[a-f0-9]{64}$/;
const PROTECTED_PATH_MARKERS = [".env", "secret", "credential", "infra/", "migrations/"];

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryCandidateLane(options = {}) {
  if (options.apply === true || options.applyNow === true) {
    const blocked = buildApplyAttemptBlockedResult(options);
    const error = new Error("Factory Candidate Lane blocks apply attempts.");
    error.blocked_attempt = blocked;
    throw error;
  }
  const result = await buildFactoryCandidateLane(options);
  if (options.write !== false) await writeFactoryCandidateLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Candidate Lane failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_candidate_lane_status !== READY_STATUS) {
    const error = new Error("Factory Candidate Lane is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryCandidateLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CANDIDATE_LANE_OUT_DIR);
  const repoRoot = path.resolve(options.repoPath ?? process.cwd());
  const worktreeRoot = path.resolve(options.worktreeRoot ?? DEFAULT_FACTORY_CANDIDATE_WORKTREE_ROOT);
  const workbench = await buildFactoryWorkbenchReadModel({
    ...options,
    outDir: options.workbenchOutDir,
    write: false,
  });
  const eligibleRows = workbench.validation.valid
    ? workbench.factory_workbench_rows.filter((row) => row.candidate_manifest_json_available === true)
    : [];
  const candidatePacketRows = eligibleRows.map((row) => buildCandidatePacketRow(row, { generatedAt, repoRoot, worktreeRoot }));
  const diffPacketRows = candidatePacketRows.map((row) => row.diff_packet);
  const rollbackPlanRows = candidatePacketRows.map((row) => row.rollback_plan);
  const preflightRows = candidatePacketRows.map((row) => row.preflight);
  const hashLedgerRows = buildHashLedgerRows(candidatePacketRows, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows({ generatedAt, worktreeRoot });
  const boundary = buildBoundary({ workbench, candidatePacketRows, negativeFixtureRows, worktreeRoot, repoRoot });
  const validationItems = buildValidationItems({ workbench, candidatePacketRows, diffPacketRows, rollbackPlanRows, preflightRows, hashLedgerRows, negativeFixtureRows, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ workbench, candidatePacketRows, hashLedgerRows, negativeFixtureRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs: {
      repo_root: repoRoot,
      worktree_root: worktreeRoot,
    },
    source_workbench: {
      schema_version: "factory-candidate-lane-workbench-source.v1",
      command_name: workbench.command_name,
      program_range: workbench.program_range,
      validation_valid: workbench.validation.valid,
      validation_error_count: workbench.validation.errors.length,
      workbench_row_count: workbench.summary.workbench_row_count,
      candidate_preview_available_count: workbench.summary.candidate_preview_available_count,
    },
    factory_candidate_packet_rows: candidatePacketRows,
    factory_candidate_diff_packet_rows: diffPacketRows,
    factory_candidate_rollback_plan_rows: rollbackPlanRows,
    factory_candidate_preflight_rows: preflightRows,
    factory_candidate_hash_ledger_rows: hashLedgerRows,
    factory_candidate_negative_fixture_rows: negativeFixtureRows,
    factory_candidate_lane_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryCandidateLane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-candidate-lane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "candidate-packet-rows.json"), collectionEnvelope("factory-candidate-packet-rows.v1", "factory_candidate_packet_rows", result.factory_candidate_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-packet-rows.json"), collectionEnvelope("factory-candidate-diff-packet-rows.v1", "factory_candidate_diff_packet_rows", result.factory_candidate_diff_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-plan-rows.json"), collectionEnvelope("factory-candidate-rollback-plan-rows.v1", "factory_candidate_rollback_plan_rows", result.factory_candidate_rollback_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "preflight-rows.json"), collectionEnvelope("factory-candidate-preflight-rows.v1", "factory_candidate_preflight_rows", result.factory_candidate_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "hash-ledger-rows.json"), collectionEnvelope("factory-candidate-hash-ledger-rows.v1", "factory_candidate_hash_ledger_rows", result.factory_candidate_hash_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-candidate-negative-fixture-rows.v1", "factory_candidate_negative_fixture_rows", result.factory_candidate_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_candidate_lane_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-candidate-lane-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryCandidateLaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryCandidateLane(args);
    console.log(`Factory Candidate Lane validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_candidate_lane_status}`);
    console.log(`Candidate packets: ${result.summary.candidate_packet_count}`);
    console.log(`Hash ledger rows: ${result.summary.hash_ledger_row_count}`);
    console.log(`Patch apply enabled: ${result.summary.patch_apply_enabled}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.blocked_attempt) console.error(`- ${error.blocked_attempt.blocked_reason_id}: ${error.blocked_attempt.message}`);
    process.exitCode = 1;
    return null;
  }
}

export function buildApplyAttemptBlockedResult(options = {}) {
  return {
    schema_version: "factory-candidate-apply-attempt-block.v1",
    attempted_at: new Date(options.runAt ?? new Date()).toISOString(),
    apply_attempted: true,
    apply_allowed_now: false,
    patch_apply_enabled: false,
    blocked_reason_id: "factory_candidate_lane_apply_closed",
    message: "Factory Candidate Lane generates reviewable diff packets only; apply is reserved for later receipt-gated phases.",
  };
}

function buildCandidatePacketRow(row, { generatedAt, repoRoot, worktreeRoot }) {
  const candidatePacketId = `factory-candidate-packet.${normalizeKey(row.product_id)}.fc1`;
  const workspacePath = path.join(worktreeRoot, normalizeKey(candidatePacketId));
  const targetRelativePath = `.hermes/factory/${normalizeKey(row.product_id)}.candidate.json`;
  const targetPath = path.join(workspacePath, targetRelativePath);
  const pathPolicy = evaluateCandidatePath({ worktreeRoot, workspacePath, targetPath, targetRelativePath });
  const candidateManifestSha256Recomputed = computeCandidateManifestSha256(row.candidate_manifest_preview);
  const diffContent = buildUnifiedDiff(row, targetRelativePath);
  const diffPacket = {
    schema_version: "factory-candidate-diff-packet.v1",
    diff_packet_id: `diff-packet.${normalizeKey(row.product_id)}.fc1`,
    candidate_packet_id: candidatePacketId,
    product_id: row.product_id,
    target_relative_path: targetRelativePath,
    diff_kind: "unified_diff",
    diff_content: diffContent,
    diff_sha256: sha256(diffContent),
    diff_generated_now: true,
    diff_applied_now: false,
    generated_at: generatedAt,
  };
  const rollbackPlan = buildRollbackPlan(row, candidatePacketId, diffPacket, generatedAt);
  const preflight = buildPreflight(row, candidatePacketId, diffPacket, rollbackPlan, pathPolicy, generatedAt, { candidateManifestSha256Recomputed });
  const packetDraft = {
    schema_version: "factory-candidate-packet.v1",
    candidate_packet_id: candidatePacketId,
    candidate_packet_status: preflight.preflight_status === "passed" ? "candidate_packet_ready" : "blocked_candidate_packet",
    product_id: row.product_id,
    candidate_manifest_id: row.candidate_manifest_id,
    candidate_manifest_sha256: row.candidate_manifest_sha256,
    candidate_manifest_sha256_recomputed: candidateManifestSha256Recomputed,
    workbench_row_id: row.workbench_row_id,
    isolated_workspace_plan: {
      schema_version: "factory-candidate-isolated-workspace-plan.v1",
      isolation_plan_id: `isolation-plan.${normalizeKey(row.product_id)}.fc1`,
      requested_isolation: "git_worktree",
      actual_isolation: "planned_git_worktree",
      repo_root: repoRoot,
      worktree_root: worktreeRoot,
      workspace_path: workspacePath,
      workspace_path_within_root: pathPolicy.workspace_path_within_root,
      worktree_created_now: false,
      worktree_write_performed_now: false,
    },
    target_relative_path: targetRelativePath,
    target_path_within_workspace: pathPolicy.target_path_within_workspace,
    protected_path_blocker_present: pathPolicy.protected_path_blocker_present,
    worktree_lane_status: "planned_isolated_workspace_ready",
    diff_packet_status: "generated_unapplied",
    rollback_plan_status: rollbackPlan.rollback_plan_status,
    preflight_status: preflight.preflight_status,
    diff_packet: diffPacket,
    rollback_plan: rollbackPlan,
    preflight,
    candidate_hash_bound_to_manifest: candidateManifestSha256Recomputed === row.candidate_manifest_sha256,
    generated_at: generatedAt,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    authority_flags: AUTHORITY_CLOSED,
  };
  return {
    ...packetDraft,
    candidate_packet_sha256: sha256(canonicalize(packetDraft)),
  };
}

function buildUnifiedDiff(row, targetRelativePath) {
  const payload = {
    schema_version: "factory-generated-candidate-file.v1",
    product_id: row.product_id,
    candidate_manifest_id: row.candidate_manifest_id,
    candidate_manifest_sha256: row.candidate_manifest_sha256,
    generated_by: COMMAND_NAME,
    apply_allowed_now: false,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const addedLines = body.split("\n").filter((line, index, lines) => index < lines.length - 1).map((line) => `+${line}`);
  return [
    `diff --git a/${targetRelativePath} b/${targetRelativePath}`,
    "new file mode 100644",
    `index 0000000..${gitBlobSha1(body).slice(0, 7)}`,
    "--- /dev/null",
    `+++ b/${targetRelativePath}`,
    `@@ -0,0 +1,${addedLines.length} @@`,
    ...addedLines,
    "",
  ].join("\n");
}

function buildRollbackPlan(row, candidatePacketId, diffPacket, generatedAt) {
  const draft = {
    schema_version: "factory-candidate-rollback-plan.v1",
    rollback_plan_id: `rollback-plan.${normalizeKey(row.product_id)}.fc1`,
    candidate_packet_id: candidatePacketId,
    product_id: row.product_id,
    rollback_plan_status: "draft_not_executable",
    pre_change_state_ref: row.latest_transition_id ?? row.current_product_state,
    diff_packet_sha256: diffPacket.diff_sha256,
    inverse_patch_note: "Delete the generated candidate file from the isolated workspace if the candidate is rejected.",
    restore_plan: "No repository file is changed by FC.1; restore means discarding the isolated candidate packet artifact.",
    rollback_receipt_required_before_execution: true,
    rollback_executed_now: false,
    protected_action_allowed_now: false,
    generated_at: generatedAt,
  };
  return { ...draft, rollback_plan_sha256: sha256(canonicalize(draft)) };
}

function buildPreflight(row, candidatePacketId, diffPacket, rollbackPlan, pathPolicy, generatedAt, { candidateManifestSha256Recomputed }) {
  const checks = [
    preflightCheck("diff.unified", diffPacket.diff_content.startsWith("diff --git "), "Diff packet is a unified diff"),
    preflightCheck("diff.hash_bound", HASH_RE.test(diffPacket.diff_sha256), "Diff packet has SHA-256 hash"),
    preflightCheck("manifest.hash_bound", HASH_RE.test(row.candidate_manifest_sha256 ?? "") && candidateManifestSha256Recomputed === row.candidate_manifest_sha256, "Candidate manifest hash is recomputed and bound"),
    preflightCheck("workspace.path_scoped", pathPolicy.workspace_path_within_root && pathPolicy.target_path_within_workspace, "Candidate target stays inside isolated workspace"),
    preflightCheck("workspace.protected_path_blocked", pathPolicy.protected_path_blocker_present === false, "Candidate target is not a protected path"),
    preflightCheck("rollback.bound", HASH_RE.test(rollbackPlan.rollback_plan_sha256), "Rollback plan is hash-bound"),
    preflightCheck("apply.closed", true, "Apply remains closed"),
  ];
  const draft = {
    schema_version: "factory-candidate-preflight.v1",
    preflight_id: `preflight.${normalizeKey(row.product_id)}.fc1`,
    candidate_packet_id: candidatePacketId,
    product_id: row.product_id,
    preflight_executed_now: true,
    preflight_status: checks.every((check) => check.current_verdict === "pass") ? "passed" : "blocked",
    checks,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    generated_at: generatedAt,
  };
  return { ...draft, preflight_sha256: sha256(canonicalize(draft)) };
}

function preflightCheck(checkId, pass, message) {
  return {
    schema_version: "factory-candidate-preflight-check.v1",
    check_id: checkId,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function buildHashLedgerRows(candidatePacketRows, generatedAt) {
  let prevEntryHash = null;
  return candidatePacketRows.map((row, index) => {
    const draft = {
      schema_version: "factory-candidate-hash-ledger-row.v1",
      ledger_row_id: `factory-candidate-hash-ledger.${String(index + 1).padStart(4, "0")}`,
      candidate_packet_id: row.candidate_packet_id,
      product_id: row.product_id,
      candidate_packet_sha256: row.candidate_packet_sha256,
      candidate_manifest_sha256: row.candidate_manifest_sha256,
      diff_sha256: row.diff_packet.diff_sha256,
      rollback_plan_sha256: row.rollback_plan.rollback_plan_sha256,
      preflight_sha256: row.preflight.preflight_sha256,
      prev_entry_hash: prevEntryHash,
      generated_at: generatedAt,
      ledger_append_allowed_now: false,
    };
    const entryHash = sha256(canonicalize(draft));
    prevEntryHash = entryHash;
    return { ...draft, entry_hash: entryHash };
  });
}

function buildNegativeFixtureRows({ generatedAt, worktreeRoot }) {
  const workspacePath = path.join(worktreeRoot, "negative-fixture-workspace");
  const externalPath = path.resolve(path.dirname(worktreeRoot), "outside-worktree", "candidate.json");
  const protectedPath = path.join(workspacePath, ".env");
  const externalPathPolicy = evaluateCandidatePath({
    worktreeRoot,
    workspacePath,
    targetPath: externalPath,
    targetRelativePath: "../outside-worktree/candidate.json",
  });
  const protectedPathPolicy = evaluateCandidatePath({
    worktreeRoot,
    workspacePath,
    targetPath: protectedPath,
    targetRelativePath: ".env",
  });
  const applyAttempt = buildApplyAttemptBlockedResult({ runAt: generatedAt });
  return [
    {
      schema_version: "factory-candidate-negative-fixture-row.v1",
      fixture_id: "negative.apply_attempt",
      fixture_status: applyAttempt.apply_allowed_now === false && applyAttempt.patch_apply_enabled === false ? "passed" : "failed",
      attempted_action: "apply_candidate",
      observed_outcome: "blocked",
      blocked_reason_id: applyAttempt.blocked_reason_id,
      patch_apply_enabled: applyAttempt.patch_apply_enabled,
      apply_allowed_now: applyAttempt.apply_allowed_now,
      generated_at: generatedAt,
    },
    {
      schema_version: "factory-candidate-negative-fixture-row.v1",
      fixture_id: "negative.external_write_path",
      fixture_status: externalPathPolicy.target_path_within_workspace === false ? "passed" : "failed",
      attempted_action: "write_candidate_outside_worktree",
      attempted_path: externalPath,
      observed_outcome: "blocked",
      blocked_reason_id: "target_path_outside_isolated_workspace",
      path_guard_executed_now: true,
      workspace_path_within_root: externalPathPolicy.workspace_path_within_root,
      path_within_workspace: externalPathPolicy.target_path_within_workspace,
      generated_at: generatedAt,
    },
    {
      schema_version: "factory-candidate-negative-fixture-row.v1",
      fixture_id: "negative.protected_path",
      fixture_status: protectedPathPolicy.protected_path_blocker_present === true ? "passed" : "failed",
      attempted_action: "write_protected_candidate_path",
      attempted_path: protectedPath,
      observed_outcome: "blocked",
      blocked_reason_id: "protected_path_blocker_present",
      path_guard_executed_now: true,
      workspace_path_within_root: protectedPathPolicy.workspace_path_within_root,
      path_within_workspace: protectedPathPolicy.target_path_within_workspace,
      protected_path_blocker_present: protectedPathPolicy.protected_path_blocker_present,
      generated_at: generatedAt,
    },
  ];
}

function evaluateCandidatePath({ worktreeRoot, workspacePath, targetPath, targetRelativePath }) {
  const root = path.resolve(worktreeRoot);
  const workspace = path.resolve(workspacePath);
  const target = path.resolve(targetPath);
  const workspaceWithinRoot = workspace === root || workspace.startsWith(`${root}${path.sep}`);
  const targetWithinWorkspace = target === workspace || target.startsWith(`${workspace}${path.sep}`);
  const normalizedRelative = targetRelativePath.replaceAll("\\", "/");
  return {
    workspace_path_within_root: workspaceWithinRoot,
    target_path_within_workspace: targetWithinWorkspace,
    protected_path_blocker_present: PROTECTED_PATH_MARKERS.some((marker) => normalizedRelative.includes(marker)),
  };
}

function buildBoundary({ workbench, candidatePacketRows, negativeFixtureRows, worktreeRoot, repoRoot }) {
  return {
    schema_version: "factory-candidate-lane-boundary.v1",
    read_only: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    repo_root: repoRoot,
    worktree_root: worktreeRoot,
    source_workbench_valid: workbench.validation.valid,
    candidate_preview_available_count: workbench.summary.candidate_preview_available_count,
    candidate_packet_count: candidatePacketRows.length,
    diff_packet_count: candidatePacketRows.length,
    rollback_plan_count: candidatePacketRows.length,
    preflight_count: candidatePacketRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    actual_git_worktree_created_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
  };
}

function buildValidationItems({ workbench, candidatePacketRows, diffPacketRows, rollbackPlanRows, preflightRows, hashLedgerRows, negativeFixtureRows, boundary }) {
  return [
    validationItem("workbench.valid", "source", workbench.validation.valid, workbench.validation.valid ? "Factory workbench is valid" : `Factory workbench has ${workbench.validation.errors.length} error(s)`),
    validationItem("packets.match_previews", "candidate", candidatePacketRows.length === workbench.summary.candidate_preview_available_count, "Candidate packet count must match visible workbench candidate previews"),
    validationItem("packets.hash_bound", "candidate", candidatePacketRows.every((row) => HASH_RE.test(row.candidate_packet_sha256)), "Every candidate packet must be SHA-256 bound"),
    validationItem("packets.manifest_hash_recomputed", "candidate", candidatePacketRows.every((row) => row.candidate_hash_bound_to_manifest === true && row.candidate_manifest_sha256_recomputed === row.candidate_manifest_sha256), "Every candidate packet must recompute and match the candidate manifest hash"),
    validationItem("diffs.unified", "diff", diffPacketRows.every((row) => row.diff_content.startsWith("diff --git ") && HASH_RE.test(row.diff_sha256)), "Every diff packet must be a hash-bound unified diff"),
    validationItem("rollback.bound", "rollback", rollbackPlanRows.every((row) => HASH_RE.test(row.rollback_plan_sha256) && row.rollback_executed_now === false), "Every rollback plan must be hash-bound and not executed"),
    validationItem("preflight.executed", "preflight", preflightRows.every((row) => row.preflight_executed_now === true && row.preflight_status === "passed"), "Every candidate packet must have an executed passing preflight"),
    validationItem("hash_ledger.chain", "ledger", hashLedgerRows.every((row, index) => index === 0 ? row.prev_entry_hash === null : row.prev_entry_hash === hashLedgerRows[index - 1].entry_hash), "Candidate hash ledger rows must form a deterministic chain"),
    validationItem("negative.apply_blocked", "negative", negativeFixtureRows.some((row) => row.fixture_id === "negative.apply_attempt" && row.observed_outcome === "blocked" && row.patch_apply_enabled === false), "Apply attempt negative fixture must be blocked"),
    validationItem("negative.external_write_blocked", "negative", negativeFixtureRows.some((row) => row.fixture_id === "negative.external_write_path" && row.observed_outcome === "blocked" && row.path_guard_executed_now === true && row.path_within_workspace === false), "External worktree write negative fixture must be blocked by the executed path guard"),
    validationItem("negative.protected_path_blocked", "negative", negativeFixtureRows.some((row) => row.fixture_id === "negative.protected_path" && row.observed_outcome === "blocked" && row.path_guard_executed_now === true && row.protected_path_blocker_present === true), "Protected path negative fixture must be blocked by the executed path guard"),
    validationItem("boundary.no_apply", "authority", boundary.patch_apply_enabled === false && boundary.apply_allowed_now === false, "Candidate lane must keep apply closed"),
    validationItem("boundary.no_write_deploy_trust", "authority", boundary.source_file_write_allowed_now === false && boundary.ledger_append_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.connector_write_allowed_now === false && boundary.deployment_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "Candidate lane must keep write/deploy/trust authority closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Candidate lane authority flags must remain closed"),
  ];
}

function buildSummary({ workbench, candidatePacketRows, hashLedgerRows, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid && workbench.validation.valid && allAuthorityClosed(boundary);
  return {
    factory_candidate_lane_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_workbench_status: workbench.summary.factory_workbench_read_model_status,
    candidate_preview_available_count: workbench.summary.candidate_preview_available_count,
    candidate_packet_count: candidatePacketRows.length,
    diff_packet_count: candidatePacketRows.length,
    rollback_plan_count: candidatePacketRows.length,
    preflight_count: candidatePacketRows.length,
    hash_ledger_row_count: hashLedgerRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    patch_apply_enabled: false,
    apply_allowed_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Candidate Lane",
    "",
    `Status: ${result.summary.factory_candidate_lane_status}`,
    `Program: ${result.summary.program_range}`,
    `Candidate packets: ${result.summary.candidate_packet_count}`,
    `Diff packets: ${result.summary.diff_packet_count}`,
    `Rollback plans: ${result.summary.rollback_plan_count}`,
    `Preflights: ${result.summary.preflight_count}`,
    `Patch apply enabled: ${result.summary.patch_apply_enabled}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-candidate-lane-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allAuthorityClosed(value) {
  return [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ].every((key) => value[key] === false);
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObject(item)]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
}

function computeCandidateManifestSha256(manifest) {
  if (!manifest || typeof manifest !== "object") return null;
  const { candidate_manifest_sha256: _candidateManifestSha256, ...draft } = manifest;
  return sha256(canonicalize(draft));
}

function gitBlobSha1(body) {
  return createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--apply" || arg === "--apply-now") parsed.apply = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-path") parsed.repoPath = argv[++index];
    else if (arg === "--worktree-root") parsed.worktreeRoot = argv[++index];
    else if (arg === "--factory-ledger-dir" || arg === "--ledger-dir") parsed.factoryLedgerDir = argv[++index];
    else if (arg === "--factory-seed-dir" || arg === "--seed-dir") parsed.factorySeedDir = argv[++index];
    else if (arg === "--template-root") parsed.templateRoot = argv[++index];
    else if (arg === "--pack-root") parsed.packRoot = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:candidate-lane -- [--check] [--require-pass] [--out-dir DIR]

Builds the FC.1 factory candidate lane: reviewable diff packets, rollback plans,
executed preflights, and candidate hash ledger rows. Apply stays closed.

Options:
  --check             Fail when validation has errors.
  --require-pass      Require ready_factory_candidate_lane status.
  --apply             Negative fixture: blocked apply attempt.
  --no-write          Build in memory only.
  --out-dir DIR       Output directory.
  --repo-path DIR     Repository root used for candidate metadata.
  --worktree-root DIR Isolated worktree root used for path-boundary checks.
  --factory-ledger-dir DIR
  --factory-seed-dir DIR
  --template-root DIR
  --pack-root DIR
  --run-at ISO_DATE   Deterministic timestamp for tests.
`);
}
