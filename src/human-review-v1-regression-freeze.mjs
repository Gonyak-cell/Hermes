import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_V1_REGRESSION_FREEZE_OUT_DIR = "artifacts/human-review-v1-regression-freeze/latest";
export const DEFAULT_HUMAN_REVIEW_V1_REGRESSION_FREEZE_INPUTS = {
  reconciliationPath: "artifacts/human-review-cycle-receipt-completion-reconciliation/latest/human-review-cycle-receipt-completion-reconciliation.json",
  baselinePath: "artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json",
  manualCommandReceiptPackPath: "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json",
  heldCommandResolutionPath: "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json",
  protectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
  manualRevalidationPath: "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/human-review-cycle-receipt-completion-manual-revalidation.json",
  commandQueuePatchProjectionPath: "artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/human-review-cycle-receipt-completion-command-queue-patch-projection.json",
  closeoutLedgerPath: "artifacts/human-review-cycle-receipt-completion-closeout-ledger/latest/human-review-cycle-receipt-completion-closeout-ledger.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  dashboardPath: "artifacts/dashboard/latest/review-dashboard.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CLOSURE_SOURCE_DEFINITIONS = [
  sourceDefinition("human_review_cycle_receipt_completion_reconciliation", "Human Review Cycle Receipt Completion Reconciliation", "reconciliationPath", "P088-supporting", true),
  sourceDefinition("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", "baselinePath", "P089", true),
  sourceDefinition("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human Review Cycle Receipt Completion Manual Command Receipt Pack", "manualCommandReceiptPackPath", "P090", true),
  sourceDefinition("human_review_cycle_receipt_completion_held_command_resolution", "Human Review Cycle Receipt Completion Held Command Resolution", "heldCommandResolutionPath", "P091", true),
  sourceDefinition("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human Review Cycle Receipt Completion Protected Approval Request Pack", "protectedApprovalRequestPackPath", "P092", true),
  sourceDefinition("human_review_cycle_receipt_completion_manual_revalidation", "Human Review Cycle Receipt Completion Manual Revalidation", "manualRevalidationPath", "P093", true),
  sourceDefinition("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human Review Cycle Receipt Completion Command Queue Patch Projection", "commandQueuePatchProjectionPath", "P094", true),
  sourceDefinition("human_review_cycle_receipt_completion_closeout_ledger", "Human Review Cycle Receipt Completion Closeout Ledger", "closeoutLedgerPath", "P095", true),
];

const SUPPORT_SOURCE_DEFINITIONS = [
  sourceDefinition("control_plane_loop", "Control Plane Loop", "controlPlaneLoopPath", "verification", true),
  sourceDefinition("review_dashboard", "Review Dashboard", "dashboardPath", "verification", false),
  sourceDefinition("package_json", "Package Scripts", "packagePath", "verification", true),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "roadmapPath", "verification", true, "text"),
];

const REQUIRED_COMMANDS = [
  "npm run validate",
  "npm test",
  "npm run api:smoke",
  "npm run control-plane:review-cycle:completion-closeout-ledger",
  "npm run control-plane:review-cycle:freeze",
  "npm run control-plane:loop",
];

export async function runHumanReviewV1RegressionFreeze(options = {}) {
  const result = await buildHumanReviewV1RegressionFreeze(options);
  if (options.write !== false) await writeHumanReviewV1RegressionFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human Review v1 regression freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewV1RegressionFreeze(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_V1_REGRESSION_FREEZE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const closureSources = await readSources(CLOSURE_SOURCE_DEFINITIONS, options);
  const supportSources = await readSources(SUPPORT_SOURCE_DEFINITIONS, options);
  const artifacts = Object.fromEntries([...closureSources, ...supportSources].map((source) => [source.source_id, source.data]));
  const regressionFixture = buildRegressionFixture({ generatedAt, closureSources, supportSources, artifacts });
  const verificationCheckpoints = buildVerificationCheckpoints(artifacts, regressionFixture);
  const validation = validateRegressionFreeze({ closureSources, supportSources, artifacts, regressionFixture, verificationCheckpoints });
  const freezeStatus = deriveFreezeStatus(validation, artifacts.human_review_cycle_receipt_completion_closeout_ledger);
  const freezeNote = buildFreezeNote({ generatedAt, freezeStatus, artifacts, verificationCheckpoints });
  const result = {
    schema_version: "human-review-v1-regression-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `human-review-v1-regression-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    freeze_status: freezeStatus,
    safe_handling: {
      auto_execute_allowed: false,
      regression_freeze_only: true,
      source_artifact_mutation_allowed: false,
      commands_executed: false,
      protected_actions_executed: false,
      audit_events_emitted: false,
    },
    sources: [...closureSources, ...supportSources].map(({ data, raw, ...source }) => source),
    summary: summarizeFreeze({ freezeStatus, closureSources, supportSources, artifacts, regressionFixture, verificationCheckpoints, validation }),
    regression_fixture: regressionFixture,
    freeze_note: freezeNote,
    verification_checkpoints: verificationCheckpoints,
    validation,
  };

  return {
    ...result,
    markdown: renderFreezeMarkdown(result),
  };
}

export async function writeHumanReviewV1RegressionFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-v1-regression-freeze.json"), serializableFreeze(result));
  await writeJson(path.join(outDir, "regression-fixture.json"), result.regression_fixture);
  await writeJson(path.join(outDir, "artifact-manifest.json"), {
    generated_at: result.generated_at,
    count: result.regression_fixture.artifact_refs.length,
    artifact_refs: result.regression_fixture.artifact_refs,
  });
  await writeJson(path.join(outDir, "verification-checkpoints.json"), {
    generated_at: result.generated_at,
    count: result.verification_checkpoints.length,
    verification_checkpoints: result.verification_checkpoints,
  });
  await writeJson(path.join(outDir, "freeze-note.json"), result.freeze_note);
  await writeFile(path.join(outDir, "freeze-note.md"), renderFreezeNoteMarkdown(result.freeze_note), "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewV1RegressionFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewV1RegressionFreeze(args);
    console.log(`Human Review v1 regression freeze written to ${result.output_dir}`);
    console.log(`Freeze status: ${result.freeze_status}`);
    console.log(`Fixture artifacts: ${result.summary.regression_fixture_artifact_count}`);
    console.log(`Verification checkpoints: ${result.summary.verification_checkpoint_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readSources(definitions, options) {
  const sources = [];
  for (const definition of definitions) {
    const configuredPath = options[definition.option] ?? DEFAULT_HUMAN_REVIEW_V1_REGRESSION_FREEZE_INPUTS[definition.option];
    if (configuredPath === false) {
      sources.push({
        ...definition,
        path: null,
        available: false,
        schema_version: null,
        generated_at: null,
        summary: null,
        content_hash: null,
        error: "disabled",
        data: null,
        raw: null,
      });
      continue;
    }
    const resolvedPath = path.resolve(configuredPath);
    const readResult = definition.format === "text"
      ? await readTextOrError(resolvedPath)
      : await readJsonOrError(resolvedPath);
    sources.push({
      ...definition,
      path: resolvedPath,
      available: readResult.ok,
      schema_version: readResult.value?.schema_version ?? null,
      generated_at: readResult.value?.generated_at ?? null,
      summary: readResult.value?.summary ?? null,
      content_hash: readResult.raw ? sha256(readResult.raw) : null,
      error: readResult.error,
      data: readResult.value,
      raw: readResult.raw,
    });
  }
  return sources;
}

function buildRegressionFixture({ generatedAt, closureSources, supportSources, artifacts }) {
  const closeout = artifacts.human_review_cycle_receipt_completion_closeout_ledger;
  const baseline = artifacts.human_review_cycle_receipt_completion_baseline;
  const loop = artifacts.control_plane_loop;
  return {
    fixture_id: `human-review-v1-regression-fixture.${dateStamp(generatedAt)}`,
    fixture_scope: "human_review_cycle_closure_v1",
    frozen_slots: ["P089", "P090", "P091", "P092", "P093", "P094", "P095", "P096"],
    source_phase_range: "Phase 89-95",
    artifact_refs: closureSources.map((source) => ({
      source_id: source.source_id,
      label: source.label,
      planned_slot: source.planned_slot,
      path: source.path,
      available: source.available,
      schema_version: source.schema_version,
      generated_at: source.generated_at,
      content_hash: source.content_hash,
      summary: source.summary,
      required: source.required,
    })),
    support_refs: supportSources.map((source) => ({
      source_id: source.source_id,
      label: source.label,
      path: source.path,
      available: source.available,
      schema_version: source.schema_version,
      generated_at: source.generated_at,
      content_hash: source.content_hash,
      summary: source.summary,
      required: source.required,
    })),
    invariant_snapshot: {
      baseline_blocker_count: baseline?.summary?.blocker_count ?? 0,
      baseline_pending_command_receipt_count: baseline?.summary?.pending_command_receipt_count ?? 0,
      baseline_held_command_count: baseline?.summary?.held_command_count ?? 0,
      baseline_protected_hold_count: baseline?.summary?.protected_hold_count ?? 0,
      closeout_item_count: closeout?.summary?.closeout_item_count ?? 0,
      closeout_pending_count: closeout?.summary?.pending_count ?? 0,
      closeout_approved_count: closeout?.summary?.approved_count ?? 0,
      closeout_rejected_count: closeout?.summary?.rejected_count ?? 0,
      closeout_superseded_count: closeout?.summary?.superseded_count ?? 0,
      closeout_unknown_status_count: closeout?.summary?.unknown_status_count ?? 0,
      closeout_normalized_status_total_count: closeout?.summary?.normalized_status_total_count ?? 0,
      loop_status: loop?.loop_status ?? null,
      loop_step_count: loop?.summary?.step_count ?? 0,
      loop_passed_step_count: loop?.summary?.passed_step_count ?? 0,
      loop_failed_step_count: loop?.summary?.failed_step_count ?? 0,
      loop_missing_artifact_count: loop?.summary?.missing_artifact_count ?? 0,
    },
    verification_contract: REQUIRED_COMMANDS.map((command) => ({
      command,
      required_for_phase_freeze: true,
      executed_by_freeze_command: false,
    })),
  };
}

function buildVerificationCheckpoints(artifacts, regressionFixture) {
  const baseline = artifacts.human_review_cycle_receipt_completion_baseline;
  const manualPack = artifacts.human_review_cycle_receipt_completion_manual_command_receipt_pack;
  const heldResolution = artifacts.human_review_cycle_receipt_completion_held_command_resolution;
  const protectedPack = artifacts.human_review_cycle_receipt_completion_protected_approval_request_pack;
  const manualRevalidation = artifacts.human_review_cycle_receipt_completion_manual_revalidation;
  const patchProjection = artifacts.human_review_cycle_receipt_completion_command_queue_patch_projection;
  const closeout = artifacts.human_review_cycle_receipt_completion_closeout_ledger;
  const loop = artifacts.control_plane_loop;
  const packageJson = artifacts.package_json;
  const roadmapText = artifacts.implementation_roadmap;
  const checkpoints = [
    check("closure_sources_available", "All required closure sources are available", regressionFixture.artifact_refs.every((source) => source.available)),
    check("source_validations_clean", "Closure source validation error counts are zero", regressionFixture.artifact_refs.every((source) => (source.summary?.validation_error_count ?? 0) === 0)),
    check("baseline_closeout_count_match", "Closeout item count matches baseline blocker count", (closeout?.summary?.closeout_item_count ?? -1) === (baseline?.summary?.blocker_count ?? -2)),
    check("closeout_statuses_exhaustive", "Closeout normalized statuses exhaust all closeout items", (closeout?.summary?.normalized_status_total_count ?? -1) === (closeout?.summary?.closeout_item_count ?? -2) && (closeout?.summary?.unknown_status_count ?? -1) === 0),
    check("manual_pack_covers_pending_receipts", "Manual command receipt pack covers every pending command receipt", (manualPack?.summary?.receipt_pack_item_count ?? -1) === (baseline?.summary?.pending_command_receipt_count ?? -2)),
    check("held_resolution_covers_held_commands", "Held command resolution covers every held command", (heldResolution?.summary?.resolution_plan_count ?? -1) === (baseline?.summary?.held_command_count ?? -2)),
    check("protected_pack_covers_protected_holds", "Protected approval request pack covers every protected hold", (protectedPack?.summary?.approval_request_count ?? -1) === (baseline?.summary?.protected_hold_count ?? -2)),
    check("manual_revalidation_covers_manual_pack", "Manual revalidation covers every manual receipt pack item", (manualRevalidation?.summary?.revalidation_item_count ?? -1) === (manualPack?.summary?.receipt_pack_item_count ?? -2)),
    check("patch_projection_covers_revalidation", "Command queue patch projection covers every revalidation item", (patchProjection?.summary?.projection_item_count ?? -1) === (manualRevalidation?.summary?.revalidation_item_count ?? -2)),
    check("closeout_pending_state_preserved", "Current freeze preserves pending human action state", (closeout?.summary?.pending_count ?? -1) === (closeout?.summary?.closeout_item_count ?? -2)),
    check("no_closure_execution_side_effects", "Closure artifacts report no command/protected action/patch/audit side effects", sumExecutionCounts([baseline, manualPack, heldResolution, protectedPack, manualRevalidation, patchProjection, closeout]) === 0),
    check("control_plane_loop_passed", "Latest control-plane loop artifact passed", loop?.loop_status === "passed" && (loop?.summary?.failed_step_count ?? 1) === 0 && (loop?.summary?.missing_artifact_count ?? 1) === 0),
    check("required_package_scripts_present", "Required verification scripts are present in package.json", requiredScriptsPresent(packageJson)),
    check("roadmap_phase_95_recorded", "Roadmap records at least Phase 95 before Phase 96 freeze", latestRoadmapPhaseNumber(roadmapText) >= 95),
  ];
  return checkpoints.map((checkpoint, index) => ({
    checkpoint_id: `human-review-v1-regression-freeze.check.${String(index + 1).padStart(2, "0")}.${checkpoint.key}`,
    ...checkpoint,
  }));
}

function validateRegressionFreeze({ closureSources, supportSources, artifacts, regressionFixture, verificationCheckpoints }) {
  const errors = [];
  for (const source of [...closureSources, ...supportSources]) {
    if (source.required && !source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} is required for freeze but unavailable: ${source.error}` });
  }
  for (const source of closureSources) {
    if (source.data?.validation && !source.data.validation.valid) errors.push({ path: `sources.${source.source_id}.validation`, message: `${source.label} validation is not valid.` });
  }
  if (regressionFixture.artifact_refs.filter((source) => source.available).length !== closureSources.length) {
    errors.push({ path: "regression_fixture.artifact_refs", message: "Regression fixture must include every closure artifact." });
  }
  for (const checkpoint of verificationCheckpoints) {
    if (checkpoint.status !== "passed") errors.push({ path: `verification_checkpoints.${checkpoint.key}`, message: checkpoint.message });
  }
  if (sumExecutionCounts(Object.values(artifacts)) !== 0) {
    errors.push({ path: "safe_handling", message: "Regression freeze sources must not report command execution, patch application, audit emission, or protected action execution." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFreeze({ freezeStatus, closureSources, supportSources, artifacts, regressionFixture, verificationCheckpoints, validation }) {
  const passedCheckpoints = verificationCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length;
  const requiredSources = [...closureSources, ...supportSources].filter((source) => source.required);
  const availableRequiredSources = requiredSources.filter((source) => source.available);
  const closeout = artifacts.human_review_cycle_receipt_completion_closeout_ledger;
  const loop = artifacts.control_plane_loop;
  return {
    freeze_status: freezeStatus,
    required_source_count: requiredSources.length,
    available_required_source_count: availableRequiredSources.length,
    regression_fixture_artifact_count: regressionFixture.artifact_refs.length,
    regression_fixture_hash_count: regressionFixture.artifact_refs.filter((source) => source.content_hash).length,
    verification_checkpoint_count: verificationCheckpoints.length,
    passed_verification_checkpoint_count: passedCheckpoints,
    failed_verification_checkpoint_count: verificationCheckpoints.length - passedCheckpoints,
    closeout_item_count: closeout?.summary?.closeout_item_count ?? 0,
    closeout_pending_count: closeout?.summary?.pending_count ?? 0,
    closeout_unknown_status_count: closeout?.summary?.unknown_status_count ?? 0,
    loop_status: loop?.loop_status ?? null,
    loop_step_count: loop?.summary?.step_count ?? 0,
    loop_passed_step_count: loop?.summary?.passed_step_count ?? 0,
    loop_failed_step_count: loop?.summary?.failed_step_count ?? 0,
    loop_missing_artifact_count: loop?.summary?.missing_artifact_count ?? 0,
    validation_error_count: validation.errors.length,
    command_executed_count: 0,
    patch_applied_count: 0,
    audit_event_emitted_count: 0,
    protected_action_executed_count: 0,
    by_checkpoint_status: countBy(verificationCheckpoints, "status"),
  };
}

function deriveFreezeStatus(validation, closeout) {
  if (!validation.valid) return "blocked";
  if ((closeout?.summary?.pending_count ?? 0) > 0) return "frozen_with_pending_human_actions";
  return "frozen_clear";
}

function buildFreezeNote({ generatedAt, freezeStatus, artifacts, verificationCheckpoints }) {
  const closeout = artifacts.human_review_cycle_receipt_completion_closeout_ledger;
  return {
    note_id: `human-review-v1-freeze-note.${dateStamp(generatedAt)}`,
    freeze_status: freezeStatus,
    frozen_at: generatedAt,
    scope: "Human Review Cycle Closure P089-P096",
    next_planned_slot: "P097",
    next_track: "Core Contracts, Schema, Migration Spine",
    residual_human_actions: {
      pending_closeout_count: closeout?.summary?.pending_count ?? 0,
      pending_command_receipt_count: closeout?.summary?.pending_command_receipt_count ?? 0,
      pending_held_command_count: closeout?.summary?.pending_held_command_count ?? 0,
      pending_protected_approval_count: closeout?.summary?.pending_protected_approval_count ?? 0,
    },
    verification_summary: {
      checkpoint_count: verificationCheckpoints.length,
      passed_checkpoint_count: verificationCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length,
      failed_checkpoint_count: verificationCheckpoints.filter((checkpoint) => checkpoint.status !== "passed").length,
    },
    freeze_decision: freezeStatus === "blocked"
      ? "do_not_freeze_until_validation_errors_are_cleared"
      : "freeze_regression_contract_and_continue_to_p097",
  };
}

function sourceDefinition(sourceId, label, option, plannedSlot, required, format = "json") {
  return {
    source_id: sourceId,
    label,
    option,
    planned_slot: plannedSlot,
    required,
    format,
  };
}

function check(key, message, passed) {
  return {
    key,
    message,
    status: passed ? "passed" : "failed",
  };
}

function requiredScriptsPresent(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  return [
    "validate",
    "test",
    "api:smoke",
    "control-plane:review-cycle:completion-closeout-ledger",
    "control-plane:review-cycle:freeze",
    "control-plane:loop",
  ].every((scriptName) => Boolean(scripts[scriptName]));
}

function sumExecutionCounts(artifacts) {
  return artifacts.reduce((total, artifact) => {
    const summary = artifact?.summary ?? {};
    return total
      + (summary.command_executed_count ?? 0)
      + (summary.refresh_command_executed_by_harness_count ?? 0)
      + (summary.protected_action_executed_count ?? 0)
      + (summary.patch_applied_count ?? 0)
      + (summary.audit_event_emitted_count ?? 0);
  }, 0);
}

function latestRoadmapPhaseNumber(roadmapText) {
  const matches = [...String(roadmapText ?? "").matchAll(/^## Phase (\d+):/gm)];
  if (matches.length === 0) return 0;
  return Number(matches.at(-1)[1]);
}

function renderFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Human Review v1 Regression Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze status: ${result.freeze_status}`);
  lines.push(`Regression freeze only: ${result.safe_handling.regression_freeze_only}`);
  lines.push("");
  lines.push(`- Fixture artifacts: ${result.summary.regression_fixture_artifact_count}`);
  lines.push(`- Artifact hashes: ${result.summary.regression_fixture_hash_count}`);
  lines.push(`- Verification checkpoints: ${result.summary.passed_verification_checkpoint_count}/${result.summary.verification_checkpoint_count}`);
  lines.push(`- Closeout pending: ${result.summary.closeout_pending_count}`);
  lines.push(`- Loop: ${result.summary.loop_status} (${result.summary.loop_passed_step_count}/${result.summary.loop_step_count})`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Checkpoints");
  for (const checkpoint of result.verification_checkpoints) {
    lines.push(`- ${checkpoint.status}: ${checkpoint.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderFreezeNoteMarkdown(note) {
  const lines = [];
  lines.push("# Human Review v1 Freeze Note");
  lines.push("");
  lines.push(`Status: ${note.freeze_status}`);
  lines.push(`Scope: ${note.scope}`);
  lines.push(`Next: ${note.next_planned_slot} ${note.next_track}`);
  lines.push("");
  lines.push("## Residual Human Actions");
  lines.push(`- Pending closeout items: ${note.residual_human_actions.pending_closeout_count}`);
  lines.push(`- Pending command receipts: ${note.residual_human_actions.pending_command_receipt_count}`);
  lines.push(`- Pending held commands: ${note.residual_human_actions.pending_held_command_count}`);
  lines.push(`- Pending protected approvals: ${note.residual_human_actions.pending_protected_approval_count}`);
  lines.push("");
  lines.push(`Decision: ${note.freeze_decision}`);
  return `${lines.join("\n")}\n`;
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw), raw, error: null };
  } catch (error) {
    return { ok: false, value: null, raw: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: raw, raw, error: null };
  } catch (error) {
    return { ok: false, value: null, raw: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--reconciliation") parsed.reconciliationPath = argv[++index];
    else if (arg === "--baseline") parsed.baselinePath = argv[++index];
    else if (arg === "--manual-command-receipt-pack") parsed.manualCommandReceiptPackPath = argv[++index];
    else if (arg === "--held-command-resolution") parsed.heldCommandResolutionPath = argv[++index];
    else if (arg === "--protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--manual-revalidation") parsed.manualRevalidationPath = argv[++index];
    else if (arg === "--command-queue-patch-projection") parsed.commandQueuePatchProjectionPath = argv[++index];
    else if (arg === "--closeout-ledger") parsed.closeoutLedgerPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--dashboard") parsed.dashboardPath = argv[++index];
    else if (arg === "--no-dashboard") parsed.dashboardPath = false;
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-v1-regression-freeze.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --reconciliation <path>                  reconciliation artifact path.
  --baseline <path>                        baseline artifact path.
  --manual-command-receipt-pack <path>     manual command receipt pack artifact path.
  --held-command-resolution <path>         held command resolution artifact path.
  --protected-approval-request-pack <path> protected approval request pack artifact path.
  --manual-revalidation <path>             manual revalidation artifact path.
  --command-queue-patch-projection <path>  command queue patch projection artifact path.
  --closeout-ledger <path>                 closeout ledger artifact path.
  --control-plane-loop <path>              control plane loop artifact path.
  --dashboard <path>                       dashboard artifact path.
  --no-dashboard                           Do not include dashboard evidence.
  --package <path>                         package.json path.
  --roadmap <path>                         implementation roadmap path.
  --run-at <iso>                           Override generated_at.
  --check                                  Exit non-zero on validation errors.
  --help                                   Show this help.
`);
}
