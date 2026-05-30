import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-closeout-ledger/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS = {
  baselinePath: "artifacts/human-review-cycle-receipt-completion-baseline/latest/human-review-cycle-receipt-completion-baseline.json",
  manualRevalidationPath: "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/human-review-cycle-receipt-completion-manual-revalidation.json",
  protectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
  commandQueuePatchProjectionPath: "artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest/human-review-cycle-receipt-completion-command-queue-patch-projection.json",
  heldCommandResolutionPath: "artifacts/human-review-cycle-receipt-completion-held-command-resolution/latest/human-review-cycle-receipt-completion-held-command-resolution.json",
};

export const NORMALIZED_BLOCKER_STATUSES = ["pending", "approved", "rejected", "superseded"];

export async function runHumanReviewCycleReceiptCompletionCloseoutLedger(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCloseoutLedger(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCloseoutLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion closeout ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCloseoutLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const baselinePath = path.resolve(options.baselinePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS.baselinePath);
  const manualRevalidationPath = path.resolve(options.manualRevalidationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS.manualRevalidationPath);
  const protectedApprovalRequestPackPath = path.resolve(options.protectedApprovalRequestPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS.protectedApprovalRequestPackPath);
  const commandQueuePatchProjectionPath = path.resolve(options.commandQueuePatchProjectionPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS.commandQueuePatchProjectionPath);
  const heldCommandResolutionPath = path.resolve(options.heldCommandResolutionPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_CLOSEOUT_LEDGER_INPUTS.heldCommandResolutionPath);
  const baselineResult = await readJsonOrError(baselinePath);
  const manualRevalidationResult = await readJsonOrError(manualRevalidationPath);
  const protectedApprovalRequestPackResult = await readJsonOrError(protectedApprovalRequestPackPath);
  const commandQueuePatchProjectionResult = await readJsonOrError(commandQueuePatchProjectionPath);
  const heldCommandResolutionResult = await readJsonOrError(heldCommandResolutionPath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_baseline", "Human Review Cycle Receipt Completion Baseline", baselinePath, baselineResult),
    buildSource("human_review_cycle_receipt_completion_manual_revalidation", "Human Review Cycle Receipt Completion Manual Revalidation", manualRevalidationPath, manualRevalidationResult),
    buildSource("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human Review Cycle Receipt Completion Protected Approval Request Pack", protectedApprovalRequestPackPath, protectedApprovalRequestPackResult),
    buildSource("human_review_cycle_receipt_completion_command_queue_patch_projection", "Human Review Cycle Receipt Completion Command Queue Patch Projection", commandQueuePatchProjectionPath, commandQueuePatchProjectionResult),
    buildSource("human_review_cycle_receipt_completion_held_command_resolution", "Human Review Cycle Receipt Completion Held Command Resolution", heldCommandResolutionPath, heldCommandResolutionResult),
  ];
  const closeoutItems = buildCloseoutItems({
    baseline: baselineResult.value,
    manualRevalidation: manualRevalidationResult.value,
    protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
    commandQueuePatchProjection: commandQueuePatchProjectionResult.value,
    heldCommandResolution: heldCommandResolutionResult.value,
  });
  const actorCloseouts = buildActorCloseouts(closeoutItems);
  const normalizedBlockerStatuses = buildNormalizedBlockerStatuses(closeoutItems);
  const validation = validateCloseoutLedger({
    sources,
    baseline: baselineResult.value,
    manualRevalidation: manualRevalidationResult.value,
    protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
    commandQueuePatchProjection: commandQueuePatchProjectionResult.value,
    heldCommandResolution: heldCommandResolutionResult.value,
    closeoutItems,
    actorCloseouts,
    normalizedBlockerStatuses,
  });
  const closeoutStatus = deriveCloseoutStatus(validation, normalizedBlockerStatuses);
  const ledger = {
    schema_version: "human-review-cycle-receipt-completion-closeout-ledger.v1",
    generated_at: generatedAt,
    closeout_id: `human-review-cycle-receipt-completion-closeout-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    closeout_status: closeoutStatus,
    safe_handling: {
      auto_execute_allowed: false,
      closeout_ledger_only: true,
      source_artifact_mutation_allowed: false,
      command_queue_patch_applied: false,
      commands_executed: false,
      audit_events_emitted: false,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeCloseoutLedger({
      closeoutStatus,
      baseline: baselineResult.value,
      manualRevalidation: manualRevalidationResult.value,
      protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
      commandQueuePatchProjection: commandQueuePatchProjectionResult.value,
      heldCommandResolution: heldCommandResolutionResult.value,
      closeoutItems,
      actorCloseouts,
      normalizedBlockerStatuses,
      validation,
    }),
    normalized_blocker_statuses: normalizedBlockerStatuses,
    closeout_items: closeoutItems,
    actor_closeouts: actorCloseouts,
    validation,
  };

  return {
    ...ledger,
    markdown: renderCloseoutLedgerMarkdown(ledger),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCloseoutLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-closeout-ledger.json"), serializableLedger(result));
  await writeJson(path.join(outDir, "closeout-items.json"), {
    generated_at: result.generated_at,
    count: result.closeout_items.length,
    closeout_items: result.closeout_items,
  });
  await writeJson(path.join(outDir, "actor-closeouts.json"), {
    generated_at: result.generated_at,
    count: result.actor_closeouts.length,
    actor_closeouts: result.actor_closeouts,
  });
  await writeJson(path.join(outDir, "normalized-blocker-statuses.json"), {
    generated_at: result.generated_at,
    normalized_blocker_statuses: result.normalized_blocker_statuses,
  });
  for (const actorCloseout of result.actor_closeouts) {
    const actorDir = path.join(outDir, "actors", actorCloseout.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "closeout.json"), actorCloseout);
    await writeFile(path.join(actorDir, "README.md"), renderActorCloseoutMarkdown(actorCloseout), "utf8");
  }
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCloseoutLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCloseoutLedger(args);
    console.log(`Human review cycle receipt completion closeout ledger written to ${result.output_dir}`);
    console.log(`Closeout status: ${result.closeout_status}`);
    console.log(`Closeout items: ${result.summary.closeout_item_count}`);
    console.log(`Actor closeouts: ${result.summary.actor_closeout_count}`);
    console.log(`Pending: ${result.summary.pending_count}`);
    console.log(`Approved: ${result.summary.approved_count}`);
    console.log(`Rejected: ${result.summary.rejected_count}`);
    console.log(`Superseded: ${result.summary.superseded_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCloseoutItems({ baseline, manualRevalidation, protectedApprovalRequestPack, commandQueuePatchProjection, heldCommandResolution }) {
  const revalidationByQueueItemId = new Map((manualRevalidation?.revalidation_items ?? []).map((item) => [item.queue_item_id, item]));
  const projectionByQueueItemId = new Map((commandQueuePatchProjection?.projection_items ?? []).map((item) => [item.queue_item_id, item]));
  const resolutionByBlockerId = new Map((heldCommandResolution?.resolution_plans ?? []).map((plan) => [plan.blocker_id ?? plan.source_refs?.baseline_blocker_id, plan]));
  const approvalByBlockerId = new Map((protectedApprovalRequestPack?.approval_requests ?? []).map((request) => [request.source_refs?.baseline_blocker_id, request]));

  return (baseline?.blocker_inventory ?? []).map((blocker, index) => {
    const revalidationItem = revalidationByQueueItemId.get(blocker.queue_item_id);
    const projectionItem = projectionByQueueItemId.get(blocker.queue_item_id);
    const resolutionPlan = resolutionByBlockerId.get(blocker.blocker_id);
    const approvalRequest = approvalByBlockerId.get(blocker.blocker_id);
    const statusContext = normalizeBlockerStatus({ blocker, revalidationItem, projectionItem, resolutionPlan, approvalRequest });
    const closeoutItemId = `human-review-cycle-receipt-completion-closeout-ledger.item.${String(index + 1).padStart(2, "0")}.${slugify(blocker.blocker_id)}`;
    return {
      closeout_item_id: closeoutItemId,
      source_blocker_id: blocker.blocker_id,
      source_reconciliation_item_id: blocker.source_reconciliation_item_id,
      blocker_type: blocker.blocker_type,
      raw_status: statusContext.raw_status,
      normalized_status: statusContext.normalized_status,
      status_reason: statusContext.status_reason,
      pending_reason: statusContext.normalized_status === "pending" ? statusContext.status_reason : null,
      priority: blocker.priority,
      required_actor: blocker.required_actor,
      protected_hold: Boolean(blocker.protected_hold),
      queue_item_id: blocker.queue_item_id ?? null,
      command_gate_id: blocker.command_gate_id,
      runbook_step_id: blocker.runbook_step_id,
      step_key: blocker.step_key,
      command_kind: blocker.command_kind,
      command: blocker.command,
      next_action: deriveNextAction({ blocker, revalidationItem, resolutionPlan, approvalRequest, statusContext }),
      source_refs: {
        baseline_blocker_id: blocker.blocker_id,
        reconciliation_item_id: blocker.source_reconciliation_item_id ?? null,
        revalidation_item_id: revalidationItem?.revalidation_item_id ?? null,
        projection_item_id: projectionItem?.projection_item_id ?? null,
        resolution_plan_id: resolutionPlan?.resolution_plan_id ?? null,
        approval_request_id: approvalRequest?.approval_request_id ?? null,
      },
      source_state: {
        blocker_status: blocker.blocker_status ?? null,
        receipt_status: blocker.receipt_status ?? null,
        command_result: blocker.command_result ?? null,
        revalidation_status: revalidationItem?.revalidation_status ?? null,
        projection_status: projectionItem?.projection_status ?? null,
        resolution_status: resolutionPlan?.resolution_status ?? null,
        approval_status: approvalRequest?.approval_status ?? null,
        patch_ready: Boolean(projectionItem?.patch_ready),
        human_entered_receipt: Boolean(revalidationItem?.human_entered_receipt),
        requires_explicit_human_approval: Boolean(approvalRequest?.requires_explicit_human_approval ?? resolutionPlan?.requires_explicit_human_approval),
      },
      safe_handling: {
        auto_execute_allowed: false,
        closeout_ledger_only: true,
        source_artifact_mutation_allowed: false,
        command_queue_patch_applied: false,
        commands_executed: false,
        audit_events_emitted: false,
        protected_actions_executed: false,
      },
    };
  });
}

function normalizeBlockerStatus({ blocker, revalidationItem, projectionItem, resolutionPlan, approvalRequest }) {
  if (blocker.blocker_type === "pending_command_receipt") {
    const receiptStatus = revalidationItem?.receipt_status ?? blocker.receipt_status;
    const commandResult = revalidationItem?.command_result ?? blocker.command_result;
    if (["resolved", "completed", "ready", "applied"].includes(receiptStatus) && !["run_failed", "failed", "rejected"].includes(commandResult)) {
      return { normalized_status: "approved", raw_status: receiptStatus, status_reason: "human_command_receipt_ready_or_applied" };
    }
    if (["rejected", "failed"].includes(receiptStatus) || ["run_failed", "failed", "rejected"].includes(commandResult)) {
      return { normalized_status: "rejected", raw_status: receiptStatus ?? commandResult, status_reason: "human_command_receipt_rejected_or_failed" };
    }
    if (!revalidationItem && !projectionItem) {
      return { normalized_status: "superseded", raw_status: blocker.blocker_status, status_reason: "pending_command_receipt_missing_from_latest_revalidation" };
    }
    return { normalized_status: "pending", raw_status: revalidationItem?.revalidation_status ?? projectionItem?.projection_status ?? blocker.blocker_status, status_reason: "waiting_for_human_receipt" };
  }

  if (approvalRequest) {
    const approvalStatus = approvalRequest.approval_status ?? approvalRequest.approval_receipt_template?.decision ?? blocker.blocker_status;
    if (["approved", "approval_recorded"].includes(approvalStatus)) {
      return { normalized_status: "approved", raw_status: approvalStatus, status_reason: "explicit_human_approval_recorded" };
    }
    if (["rejected", "denied"].includes(approvalStatus)) {
      return { normalized_status: "rejected", raw_status: approvalStatus, status_reason: "explicit_human_approval_rejected" };
    }
    return { normalized_status: "pending", raw_status: approvalStatus, status_reason: "pending_explicit_approval" };
  }

  if (resolutionPlan) {
    const resolutionStatus = resolutionPlan.resolution_status ?? blocker.blocker_status;
    if (["resolved", "unblocked", "completed"].includes(resolutionStatus)) {
      return { normalized_status: "approved", raw_status: resolutionStatus, status_reason: "held_command_unblocked" };
    }
    if (["rejected", "blocked_by_actor"].includes(resolutionStatus)) {
      return { normalized_status: "rejected", raw_status: resolutionStatus, status_reason: "held_command_rejected" };
    }
    if (["superseded", "obsolete"].includes(resolutionStatus)) {
      return { normalized_status: "superseded", raw_status: resolutionStatus, status_reason: "held_command_superseded" };
    }
    return { normalized_status: "pending", raw_status: resolutionStatus, status_reason: resolutionPlan.requires_explicit_human_approval ? "pending_explicit_approval" : "waiting_for_manual_input" };
  }

  if (blocker.blocker_type === "held_command") {
    return { normalized_status: "pending", raw_status: blocker.blocker_status, status_reason: blocker.protected_hold ? "pending_explicit_approval" : "waiting_for_manual_input" };
  }

  return { normalized_status: "pending", raw_status: blocker.blocker_status ?? "unknown", status_reason: "waiting_for_human_resolution" };
}

function deriveNextAction({ blocker, revalidationItem, resolutionPlan, approvalRequest, statusContext }) {
  if (statusContext.normalized_status === "approved") return "continue_follow_on_workflow_after_gate_acceptance";
  if (statusContext.normalized_status === "rejected") return "record_rejection_reason_and_replan";
  if (statusContext.normalized_status === "superseded") return "confirm_superseded_source_and_close_item";
  if (approvalRequest) return "authorized_operator_records_explicit_approval_before_any_protected_command";
  if (revalidationItem) return "human_reviewer_runs_command_manually_and_records_receipt";
  if (resolutionPlan?.follow_on_action?.manual_only) return "satisfy_unblock_condition_then_run_follow_on_command_manually";
  return blocker.recommended_action ?? "human_actor_resolves_blocker";
}

function buildActorCloseouts(closeoutItems) {
  const groups = groupBy(closeoutItems, (item) => item.required_actor ?? "unknown");
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([requiredActor, items]) => {
    const normalizedCounts = countBy(items, "normalized_status");
    const pendingItems = items.filter((item) => item.normalized_status === "pending");
    return {
      actor_closeout_id: `human-review-cycle-receipt-completion-closeout-ledger.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      closeout_status: pendingItems.length > 0 ? "pending" : "closed",
      closeout_item_count: items.length,
      pending_count: normalizedCounts.pending ?? 0,
      approved_count: normalizedCounts.approved ?? 0,
      rejected_count: normalizedCounts.rejected ?? 0,
      superseded_count: normalizedCounts.superseded ?? 0,
      priority_order: [...new Set(items.map((item) => item.priority).filter(Boolean))],
      closeout_item_ids: items.map((item) => item.closeout_item_id),
      commands: [...new Set(items.map((item) => item.command).filter(Boolean))],
      next_actions: [...new Set(pendingItems.map((item) => item.next_action).filter(Boolean))],
      normalized_statuses: NORMALIZED_BLOCKER_STATUSES.map((status) => ({
        normalized_status: status,
        count: normalizedCounts[status] ?? 0,
      })),
      safe_handling: {
        auto_execute_allowed: false,
        closeout_ledger_only: true,
        commands_executed: false,
        protected_actions_executed: false,
      },
    };
  });
}

function buildNormalizedBlockerStatuses(closeoutItems) {
  const byStatus = countBy(closeoutItems, "normalized_status");
  const total = closeoutItems.length;
  return NORMALIZED_BLOCKER_STATUSES.map((status) => {
    const items = closeoutItems.filter((item) => item.normalized_status === status);
    return {
      normalized_status: status,
      count: byStatus[status] ?? 0,
      total_count: total,
      blocker_ids: items.map((item) => item.source_blocker_id),
      closeout_item_ids: items.map((item) => item.closeout_item_id),
      required_actors: [...new Set(items.map((item) => item.required_actor).filter(Boolean))],
    };
  });
}

function validateCloseoutLedger({ sources, baseline, manualRevalidation, protectedApprovalRequestPack, commandQueuePatchProjection, heldCommandResolution, closeoutItems, actorCloseouts, normalizedBlockerStatuses }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  for (const [sourceId, sourceArtifact] of Object.entries({
    baseline,
    manual_revalidation: manualRevalidation,
    protected_approval_request_pack: protectedApprovalRequestPack,
    command_queue_patch_projection: commandQueuePatchProjection,
    held_command_resolution: heldCommandResolution,
  })) {
    if (sourceArtifact?.validation && !sourceArtifact.validation.valid) errors.push({ path: `${sourceId}.validation`, message: `${sourceId} source is not valid.` });
  }
  const blockerCount = baseline?.summary?.blocker_count ?? baseline?.blocker_inventory?.length ?? 0;
  if (closeoutItems.length !== blockerCount) {
    errors.push({ path: "closeout_items", message: "Closeout items must cover every baseline blocker." });
  }
  const invalidStatusCount = closeoutItems.filter((item) => !NORMALIZED_BLOCKER_STATUSES.includes(item.normalized_status)).length;
  if (invalidStatusCount > 0) {
    errors.push({ path: "closeout_items.normalized_status", message: "Every closeout item must normalize to pending, approved, rejected, or superseded." });
  }
  const normalizedTotal = normalizedBlockerStatuses.reduce((total, status) => total + status.count, 0);
  if (normalizedTotal !== closeoutItems.length) {
    errors.push({ path: "normalized_blocker_statuses", message: "Normalized status counts must equal closeout item count." });
  }
  const actorCount = new Set(closeoutItems.map((item) => item.required_actor ?? "unknown")).size;
  if (actorCloseouts.length !== actorCount) {
    errors.push({ path: "actor_closeouts", message: "Actor closeouts must cover every required actor." });
  }
  if ((manualRevalidation?.summary?.revalidation_item_count ?? 0) !== (commandQueuePatchProjection?.summary?.projection_item_count ?? 0)) {
    errors.push({ path: "source_counts.manual_revalidation_projection", message: "Manual revalidation item count must match patch projection item count." });
  }
  if ((baseline?.summary?.pending_command_receipt_count ?? 0) !== (manualRevalidation?.summary?.revalidation_item_count ?? 0)) {
    errors.push({ path: "source_counts.pending_command_receipts", message: "Baseline pending command receipts must match manual revalidation items." });
  }
  if ((baseline?.summary?.protected_hold_count ?? 0) !== (protectedApprovalRequestPack?.summary?.approval_request_count ?? 0)) {
    errors.push({ path: "source_counts.protected_approval_requests", message: "Baseline protected holds must match protected approval request count." });
  }
  if ((baseline?.summary?.held_command_count ?? 0) !== (heldCommandResolution?.summary?.resolution_plan_count ?? 0)) {
    errors.push({ path: "source_counts.held_commands", message: "Baseline held commands must match held command resolution plan count." });
  }
  const unsafeExecutionCount = [
    commandQueuePatchProjection?.summary?.patch_applied_count,
    commandQueuePatchProjection?.summary?.audit_event_emitted_count,
    commandQueuePatchProjection?.summary?.command_executed_count,
    commandQueuePatchProjection?.summary?.refresh_command_executed_by_harness_count,
    protectedApprovalRequestPack?.summary?.protected_action_executed_count,
    heldCommandResolution?.summary?.protected_action_executed_count,
  ].reduce((total, value) => total + (value ?? 0), 0);
  if (unsafeExecutionCount !== 0) {
    errors.push({ path: "safe_handling", message: "Closeout ledger sources must not include patch application, audit emission, harness command execution, or protected action execution." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeCloseoutLedger({ closeoutStatus, baseline, manualRevalidation, protectedApprovalRequestPack, commandQueuePatchProjection, heldCommandResolution, closeoutItems, actorCloseouts, normalizedBlockerStatuses, validation }) {
  const counts = Object.fromEntries(normalizedBlockerStatuses.map((entry) => [entry.normalized_status, entry.count]));
  return {
    closeout_status: closeoutStatus,
    source_baseline_status: baseline?.baseline_status ?? null,
    source_manual_revalidation_status: manualRevalidation?.revalidation_status ?? null,
    source_protected_approval_status: protectedApprovalRequestPack?.pack_status ?? null,
    source_projection_status: commandQueuePatchProjection?.projection_status ?? null,
    source_resolution_status: heldCommandResolution?.resolution_status ?? null,
    source_baseline_blocker_count: baseline?.summary?.blocker_count ?? 0,
    closeout_item_count: closeoutItems.length,
    actor_closeout_count: actorCloseouts.length,
    pending_count: counts.pending ?? 0,
    approved_count: counts.approved ?? 0,
    rejected_count: counts.rejected ?? 0,
    superseded_count: counts.superseded ?? 0,
    normalized_status_total_count: NORMALIZED_BLOCKER_STATUSES.reduce((total, status) => total + (counts[status] ?? 0), 0),
    unknown_status_count: closeoutItems.filter((item) => !NORMALIZED_BLOCKER_STATUSES.includes(item.normalized_status)).length,
    pending_command_receipt_count: closeoutItems.filter((item) => item.blocker_type === "pending_command_receipt" && item.normalized_status === "pending").length,
    pending_held_command_count: closeoutItems.filter((item) => item.blocker_type === "held_command" && item.normalized_status === "pending").length,
    pending_protected_approval_count: closeoutItems.filter((item) => item.protected_hold && item.normalized_status === "pending").length,
    approved_command_receipt_count: closeoutItems.filter((item) => item.blocker_type === "pending_command_receipt" && item.normalized_status === "approved").length,
    approved_protected_approval_count: closeoutItems.filter((item) => item.protected_hold && item.normalized_status === "approved").length,
    validation_error_count: validation.errors.length,
    patch_applied_count: 0,
    audit_event_emitted_count: 0,
    command_executed_count: 0,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_normalized_status: countBy(closeoutItems, "normalized_status"),
    by_blocker_type: countBy(closeoutItems, "blocker_type"),
    by_required_actor: countBy(closeoutItems, "required_actor"),
  };
}

function deriveCloseoutStatus(validation, normalizedBlockerStatuses) {
  if (!validation.valid) return "blocked";
  const counts = Object.fromEntries(normalizedBlockerStatuses.map((entry) => [entry.normalized_status, entry.count]));
  if ((counts.pending ?? 0) > 0) return "open_pending";
  if ((counts.rejected ?? 0) > 0) return "closed_with_rejections";
  return "ready_for_freeze";
}

function renderCloseoutLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Closeout Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Closeout status: ${ledger.closeout_status}`);
  lines.push(`Closeout ledger only: ${ledger.safe_handling.closeout_ledger_only}`);
  lines.push("");
  lines.push(`- Closeout items: ${ledger.summary.closeout_item_count}`);
  lines.push(`- Actor closeouts: ${ledger.summary.actor_closeout_count}`);
  lines.push(`- Pending: ${ledger.summary.pending_count}`);
  lines.push(`- Approved: ${ledger.summary.approved_count}`);
  lines.push(`- Rejected: ${ledger.summary.rejected_count}`);
  lines.push(`- Superseded: ${ledger.summary.superseded_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Normalized Statuses");
  for (const status of ledger.normalized_blocker_statuses) {
    lines.push(`- ${status.normalized_status}: ${status.count}`);
  }
  lines.push("");
  lines.push("## Actor Closeouts");
  for (const actorCloseout of ledger.actor_closeouts) {
    lines.push(`- ${actorCloseout.required_actor}: ${actorCloseout.closeout_status} (${actorCloseout.closeout_item_count} item(s))`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorCloseoutMarkdown(actorCloseout) {
  const lines = [];
  lines.push(`# ${actorCloseout.required_actor} Closeout`);
  lines.push("");
  lines.push(`Status: ${actorCloseout.closeout_status}`);
  lines.push(`Items: ${actorCloseout.closeout_item_count}`);
  lines.push(`Pending: ${actorCloseout.pending_count}`);
  lines.push("");
  lines.push("## Next Actions");
  for (const action of actorCloseout.next_actions) {
    lines.push(`- ${action}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.error ?? null,
  };
}

async function readJsonOrError(filePath) {
  try {
    return { ok: true, value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
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
    else if (arg === "--baseline") parsed.baselinePath = argv[++index];
    else if (arg === "--manual-revalidation") parsed.manualRevalidationPath = argv[++index];
    else if (arg === "--protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--command-queue-patch-projection") parsed.commandQueuePatchProjectionPath = argv[++index];
    else if (arg === "--held-command-resolution") parsed.heldCommandResolutionPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-closeout-ledger.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --baseline <path>                        baseline artifact path.
  --manual-revalidation <path>             manual revalidation artifact path.
  --protected-approval-request-pack <path> protected approval request pack artifact path.
  --command-queue-patch-projection <path>  command queue patch projection artifact path.
  --held-command-resolution <path>         held command resolution artifact path.
  --run-at <iso>                           Override generated_at.
  --check                                  Exit non-zero on validation errors.
  --help                                   Show this help.
`);
}
