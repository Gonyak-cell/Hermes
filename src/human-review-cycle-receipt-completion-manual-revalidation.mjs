import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS = {
  manualCommandReceiptPackPath: "artifacts/human-review-cycle-receipt-completion-manual-command-receipt-pack/latest/human-review-cycle-receipt-completion-manual-command-receipt-pack.json",
  commandReceiptWorkspaceMergePath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-merge/latest/human-review-cycle-receipt-completion-command-receipt-workspace-merge.json",
  commandReceiptWorkspaceValidationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
  commandReceiptApplicationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/human-review-cycle-receipt-completion-command-receipt-application.json",
  protectedApprovalRequestPackPath: "artifacts/human-review-cycle-receipt-completion-protected-approval-request-pack/latest/human-review-cycle-receipt-completion-protected-approval-request-pack.json",
};

const TERMINAL_RECEIPT_STATUSES = new Set(["resolved", "failed", "skipped", "deferred"]);
const TERMINAL_COMMAND_RESULTS = new Set(["run_success", "run_failed", "skipped", "deferred"]);
const NON_HUMAN_EXECUTORS = new Set(["", "automation", "automated", "harness", "system", "codex", "claude", "agent"]);

export async function runHumanReviewCycleReceiptCompletionManualRevalidation(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionManualRevalidation(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionManualRevalidation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion manual revalidation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionManualRevalidation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const manualCommandReceiptPackPath = path.resolve(options.manualCommandReceiptPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.manualCommandReceiptPackPath);
  const commandReceiptWorkspaceMergePath = path.resolve(options.commandReceiptWorkspaceMergePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptWorkspaceMergePath);
  const commandReceiptWorkspaceValidationPath = path.resolve(options.commandReceiptWorkspaceValidationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptWorkspaceValidationPath);
  const commandReceiptApplicationPath = path.resolve(options.commandReceiptApplicationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptApplicationPath);
  const protectedApprovalRequestPackPath = path.resolve(options.protectedApprovalRequestPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.protectedApprovalRequestPackPath);
  const manualPackResult = await readJsonOrError(manualCommandReceiptPackPath);
  const workspaceMergeResult = await readJsonOrError(commandReceiptWorkspaceMergePath);
  const workspaceValidationResult = await readJsonOrError(commandReceiptWorkspaceValidationPath);
  const applicationResult = await readJsonOrError(commandReceiptApplicationPath);
  const protectedApprovalRequestPackResult = await readJsonOrError(protectedApprovalRequestPackPath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_manual_command_receipt_pack", "Human Review Cycle Receipt Completion Manual Command Receipt Pack", manualCommandReceiptPackPath, manualPackResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_workspace_merge", "Human Review Cycle Receipt Completion Command Receipt Workspace Merge", commandReceiptWorkspaceMergePath, workspaceMergeResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_workspace_validation", "Human Review Cycle Receipt Completion Command Receipt Workspace Validation", commandReceiptWorkspaceValidationPath, workspaceValidationResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_application", "Human Review Cycle Receipt Completion Command Receipt Application", commandReceiptApplicationPath, applicationResult),
    buildSource("human_review_cycle_receipt_completion_protected_approval_request_pack", "Human Review Cycle Receipt Completion Protected Approval Request Pack", protectedApprovalRequestPackPath, protectedApprovalRequestPackResult),
  ];
  const revalidationItems = buildRevalidationItems({
    manualPack: manualPackResult.value,
    workspaceMerge: workspaceMergeResult.value,
    workspaceValidation: workspaceValidationResult.value,
    application: applicationResult.value,
    protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
  });
  const actorRevalidations = buildActorRevalidations({ revalidationItems, outputDir });
  const readyManualReceipts = buildReadyManualReceipts(revalidationItems, generatedAt);
  const validation = validateManualRevalidation({
    sources,
    manualPack: manualPackResult.value,
    workspaceMerge: workspaceMergeResult.value,
    workspaceValidation: workspaceValidationResult.value,
    application: applicationResult.value,
    protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
    revalidationItems,
    actorRevalidations,
    readyManualReceipts,
  });
  const revalidationStatus = deriveRevalidationStatus(validation, revalidationItems);
  const revalidation = {
    schema_version: "human-review-cycle-receipt-completion-manual-revalidation.v1",
    generated_at: generatedAt,
    revalidation_id: `human-review-cycle-receipt-completion-manual-revalidation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    revalidation_status: revalidationStatus,
    safe_handling: {
      auto_execute_allowed: false,
      manual_revalidation_only: true,
      receipt_edits_must_be_manual: true,
      source_artifact_mutation_allowed: false,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeManualRevalidation({
      manualPack: manualPackResult.value,
      workspaceMerge: workspaceMergeResult.value,
      workspaceValidation: workspaceValidationResult.value,
      application: applicationResult.value,
      protectedApprovalRequestPack: protectedApprovalRequestPackResult.value,
      revalidationItems,
      actorRevalidations,
      validation,
      revalidationStatus,
    }),
    revalidation_items: revalidationItems,
    actor_revalidations: actorRevalidations,
    ready_manual_receipts: readyManualReceipts,
    validation,
  };

  return {
    ...revalidation,
    markdown: renderManualRevalidationMarkdown(revalidation),
  };
}

export async function writeHumanReviewCycleReceiptCompletionManualRevalidation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation.json"), serializableRevalidation(result));
  await writeJson(path.join(outDir, "revalidation-items.json"), {
    generated_at: result.generated_at,
    count: result.revalidation_items.length,
    revalidation_items: result.revalidation_items,
  });
  await writeJson(path.join(outDir, "actor-revalidations.json"), {
    generated_at: result.generated_at,
    count: result.actor_revalidations.length,
    actor_revalidations: result.actor_revalidations,
  });
  await writeJson(path.join(outDir, "ready-manual-receipts.json"), result.ready_manual_receipts);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actorRevalidation of result.actor_revalidations) {
    const actorDir = path.join(outDir, "actors", actorRevalidation.required_actor);
    const actorItems = result.revalidation_items.filter((item) => item.required_actor === actorRevalidation.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "manual-revalidation.json"), {
      generated_at: result.generated_at,
      required_actor: actorRevalidation.required_actor,
      revalidation_status: actorRevalidation.revalidation_status,
      revalidation_item_count: actorRevalidation.revalidation_item_count,
      revalidation_items: actorItems,
    });
    await writeFile(path.join(actorDir, "README.md"), renderActorRevalidationMarkdown(actorRevalidation, actorItems), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionManualRevalidationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionManualRevalidation(args);
    console.log(`Human review cycle receipt completion manual revalidation written to ${result.output_dir}`);
    console.log(`Revalidation status: ${result.revalidation_status}`);
    console.log(`Items: ${result.summary.revalidation_item_count}`);
    console.log(`Human-entered ready receipts: ${result.summary.human_entered_ready_receipt_count}`);
    console.log(`Applied manual receipts: ${result.summary.human_entered_applied_receipt_count}`);
    console.log(`Auto-executed receipts: ${result.summary.auto_executed_receipt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRevalidationItems({ manualPack, workspaceMerge, workspaceValidation, application, protectedApprovalRequestPack }) {
  const mergeByQueueItemId = new Map((workspaceMerge?.merge_items ?? []).map((item) => [item.queue_item_id, item]));
  const validationByQueueItemId = new Map((workspaceValidation?.validation_items ?? []).map((item) => [item.queue_item_id, item]));
  const appliedByQueueItemId = new Map((application?.applied_command_receipts ?? []).map((receipt) => [receipt.queue_item_id, receipt]));
  const protectedCommands = new Set((protectedApprovalRequestPack?.approval_requests ?? []).map((request) => request.command).filter(Boolean));
  const protectedCommandGates = new Set((protectedApprovalRequestPack?.approval_requests ?? []).map((request) => request.command_gate_id).filter(Boolean));
  return (manualPack?.pack_items ?? []).map((packItem, index) => {
    const mergeItem = mergeByQueueItemId.get(packItem.queue_item_id);
    const validationItem = validationByQueueItemId.get(packItem.queue_item_id);
    const appliedReceipt = appliedByQueueItemId.get(packItem.queue_item_id);
    const receipt = appliedReceipt ?? validationItem?.receipt ?? mergeItem?.receipt ?? packItem.editable_receipt ?? null;
    const humanEntered = Boolean(receipt) && isHumanEnteredReceipt(receipt);
    const readyCandidate = Boolean(validationItem?.ready_to_confirm) && humanEntered;
    const appliedCandidate = Boolean(appliedReceipt) && humanEntered;
    const protectedOverlap = protectedCommands.has(packItem.command) || protectedCommandGates.has(packItem.command_gate_id);
    const status = deriveItemStatus({ packItem, mergeItem, validationItem, appliedReceipt, humanEntered, readyCandidate, appliedCandidate, protectedOverlap });
    return {
      revalidation_item_id: `human-review-cycle-receipt-completion-manual-revalidation.item.${String(index + 1).padStart(2, "0")}.${slugify(packItem.queue_item_id)}`,
      source_pack_item_id: packItem.pack_item_id,
      source_merge_item_id: mergeItem?.merge_item_id ?? null,
      source_validation_item_id: validationItem?.validation_item_id ?? null,
      source_applied_receipt_id: appliedReceipt?.receipt_id ?? null,
      required_actor: packItem.required_actor,
      priority: packItem.priority ?? "medium",
      queue_item_id: packItem.queue_item_id,
      command_gate_id: packItem.command_gate_id,
      runbook_step_id: packItem.runbook_step_id,
      step_key: packItem.step_key,
      command_kind: packItem.command_kind,
      command: packItem.command,
      revalidation_status: status,
      receipt_status: normalizeReceiptStatus(receipt?.receipt_status),
      command_result: normalizeCommandResult(receipt?.command_result),
      human_entered_receipt: humanEntered,
      ready_manual_receipt_candidate: readyCandidate,
      applied_manual_receipt_candidate: appliedCandidate,
      ready_or_applied_candidate: readyCandidate || appliedCandidate,
      protected_approval_overlap: protectedOverlap,
      auto_executed_receipt: isAutoExecutedReceipt(receipt),
      required_receipt_fields: packItem.required_receipt_fields ?? [],
      receipt: receipt ?? null,
      source_refs: {
        manual_pack_item_id: packItem.pack_item_id,
        merge_item_id: mergeItem?.merge_item_id ?? null,
        validation_item_id: validationItem?.validation_item_id ?? null,
        applied_receipt_id: appliedReceipt?.receipt_id ?? null,
      },
      safe_handling: {
        auto_execute_allowed: false,
        manual_revalidation_only: true,
        refresh_command_executed_by_harness: false,
        protected_action_executed: false,
      },
    };
  });
}

function deriveItemStatus({ mergeItem, validationItem, appliedReceipt, humanEntered, readyCandidate, appliedCandidate, protectedOverlap }) {
  if (protectedOverlap) return "blocked_protected_approval_overlap";
  if (appliedCandidate) return "applied_manual_receipt";
  if (appliedReceipt && !humanEntered) return "blocked_non_human_applied_receipt";
  if (readyCandidate) return "ready_manual_receipt";
  if (validationItem?.ready_to_confirm && !humanEntered) return "blocked_non_human_ready_receipt";
  if (validationItem?.validation_status === "invalid_receipt") return "invalid_manual_receipt";
  if (validationItem?.validation_status === "unknown_command_receipt") return "unknown_manual_receipt";
  if (validationItem?.validation_status === "missing_receipt" || mergeItem?.merge_status === "missing_actor_receipt") return "missing_manual_receipt";
  return "pending_human_receipt";
}

function isHumanEnteredReceipt(receipt) {
  if (!receipt) return false;
  const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
  const commandResult = normalizeCommandResult(receipt.command_result);
  return TERMINAL_RECEIPT_STATUSES.has(receiptStatus)
    && TERMINAL_COMMAND_RESULTS.has(commandResult)
    && !NON_HUMAN_EXECUTORS.has(String(receipt.executed_by ?? "").trim().toLowerCase())
    && Boolean(receipt.executed_at)
    && Boolean(receipt.output_reference)
    && Array.isArray(receipt.commands_run)
    && receipt.commands_run.includes(receipt.command);
}

function isAutoExecutedReceipt(receipt) {
  if (!receipt) return false;
  const actor = String(receipt.executed_by ?? "").trim().toLowerCase();
  return ["automation", "automated", "harness", "system", "codex", "claude", "agent"].includes(actor);
}

function buildActorRevalidations({ revalidationItems, outputDir }) {
  return Object.entries(groupBy(revalidationItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => ({
      actor_revalidation_id: `human-review-cycle-receipt-completion-manual-revalidation.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      revalidation_status: items.some((item) => String(item.revalidation_status).startsWith("blocked")) ? "blocked"
        : items.some((item) => item.revalidation_status === "ready_manual_receipt") ? "ready_manual_receipts"
          : items.some((item) => item.revalidation_status === "applied_manual_receipt") ? "applied_manual_receipts"
            : "waiting_for_human_receipts",
      priority: highestPriority(items),
      revalidation_item_count: items.length,
      pending_human_receipt_count: items.filter((item) => item.revalidation_status === "pending_human_receipt").length,
      ready_manual_receipt_count: items.filter((item) => item.revalidation_status === "ready_manual_receipt").length,
      applied_manual_receipt_count: items.filter((item) => item.revalidation_status === "applied_manual_receipt").length,
      blocked_item_count: items.filter((item) => String(item.revalidation_status).startsWith("blocked")).length,
      item_path: path.join(outputDir, "actors", requiredActor, "manual-revalidation.json"),
      readme_path: path.join(outputDir, "actors", requiredActor, "README.md"),
      revalidation_item_ids: items.map((item) => item.revalidation_item_id),
      queue_item_ids: items.map((item) => item.queue_item_id),
      commands_waiting_for_manual_receipt: items.filter((item) => item.revalidation_status === "pending_human_receipt").map((item) => item.command),
      safe_handling: {
        auto_execute_allowed: false,
        manual_revalidation_only: true,
        refresh_commands_executed: false,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorRevalidations);
}

function buildReadyManualReceipts(revalidationItems, generatedAt) {
  const readyReceipts = revalidationItems
    .filter((item) => item.ready_manual_receipt_candidate)
    .map((item) => item.receipt);
  return {
    schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
    generated_at: generatedAt,
    instructions: "Only human-entered command receipts that passed manual revalidation are included. This file is a projection and does not execute or apply commands.",
    receipts: readyReceipts,
  };
}

function validateManualRevalidation({ sources, manualPack, workspaceMerge, workspaceValidation, application, protectedApprovalRequestPack, revalidationItems, actorRevalidations, readyManualReceipts }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  if (manualPack?.validation && !manualPack.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_manual_command_receipt_pack.validation", message: "Manual command receipt pack source is not valid." });
  }
  if (workspaceMerge?.validation && !workspaceMerge.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_workspace_merge.validation", message: "Command receipt workspace merge source is not valid." });
  }
  if ((workspaceValidation?.summary?.error_count ?? workspaceValidation?.receipt_errors?.length ?? 0) > 0) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_workspace_validation.receipt_errors", message: "Command receipt workspace validation has receipt errors." });
  }
  if ((application?.summary?.validation_error_count ?? 0) > 0 || (application?.receipt_errors?.length ?? 0) > 0) {
    errors.push({ path: "human_review_cycle_receipt_completion_command_receipt_application.receipt_errors", message: "Command receipt application has receipt errors." });
  }
  if (protectedApprovalRequestPack?.validation && !protectedApprovalRequestPack.validation.valid) {
    errors.push({ path: "human_review_cycle_receipt_completion_protected_approval_request_pack.validation", message: "Protected approval request pack source is not valid." });
  }
  if ((manualPack?.summary?.receipt_pack_item_count ?? 0) !== revalidationItems.length) {
    errors.push({ path: "revalidation_items", message: "Revalidation item count must match manual command receipt pack item count." });
  }
  for (const item of revalidationItems) {
    if (item.ready_or_applied_candidate && !item.human_entered_receipt) {
      errors.push({ path: `revalidation_items.${item.revalidation_item_id}.human_entered_receipt`, message: "Ready/applied manual receipt candidates must be human-entered." });
    }
    if (item.protected_approval_overlap) {
      errors.push({ path: `revalidation_items.${item.revalidation_item_id}.protected_approval_overlap`, message: "Protected approval requests must not be mixed into manual receipt revalidation." });
    }
    if (item.auto_executed_receipt) {
      errors.push({ path: `revalidation_items.${item.revalidation_item_id}.auto_executed_receipt`, message: "Automatically executed receipts cannot become ready/applied manual candidates." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.refresh_command_executed_by_harness || item.safe_handling.protected_action_executed) {
      errors.push({ path: `revalidation_items.${item.revalidation_item_id}.safe_handling`, message: "Manual revalidation must not execute refresh commands or protected actions." });
    }
  }
  for (const actorRevalidation of actorRevalidations) {
    if (actorRevalidation.safe_handling.auto_execute_allowed || actorRevalidation.safe_handling.refresh_commands_executed || actorRevalidation.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_revalidations.${actorRevalidation.actor_revalidation_id}.safe_handling`, message: "Actor revalidation summaries must remain non-executing." });
    }
  }
  if ((readyManualReceipts.receipts ?? []).length !== revalidationItems.filter((item) => item.ready_manual_receipt_candidate).length) {
    errors.push({ path: "ready_manual_receipts.receipts", message: "Ready manual receipts projection must contain only ready human-entered receipts." });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function deriveRevalidationStatus(validation, revalidationItems) {
  if (!validation.valid) return "blocked";
  if (revalidationItems.some((item) => item.revalidation_status === "ready_manual_receipt")) return "ready_for_manual_receipt_application";
  if (revalidationItems.some((item) => item.revalidation_status === "applied_manual_receipt")) return "manual_receipts_applied";
  if (revalidationItems.some((item) => item.revalidation_status === "pending_human_receipt")) return "waiting_for_human_receipts";
  return "clear";
}

function summarizeManualRevalidation({ manualPack, workspaceMerge, workspaceValidation, application, protectedApprovalRequestPack, revalidationItems, actorRevalidations, validation, revalidationStatus }) {
  return {
    revalidation_status: revalidationStatus,
    source_pack_status: manualPack?.pack_status ?? null,
    source_merge_status: workspaceMerge?.merge_status ?? null,
    source_validation_status: workspaceValidation?.validation_status ?? null,
    source_application_status: application?.application_status ?? null,
    source_protected_approval_status: protectedApprovalRequestPack?.pack_status ?? null,
    revalidation_item_count: revalidationItems.length,
    source_pack_item_count: manualPack?.summary?.receipt_pack_item_count ?? 0,
    source_validation_item_count: workspaceValidation?.summary?.validation_item_count ?? 0,
    source_application_ready_receipt_count: application?.summary?.ready_receipt_count ?? 0,
    source_application_applied_receipt_count: application?.summary?.applied_receipt_count ?? 0,
    actor_revalidation_count: actorRevalidations.length,
    pending_human_receipt_count: revalidationItems.filter((item) => item.revalidation_status === "pending_human_receipt").length,
    human_entered_ready_receipt_count: revalidationItems.filter((item) => item.ready_manual_receipt_candidate).length,
    human_entered_applied_receipt_count: revalidationItems.filter((item) => item.applied_manual_receipt_candidate).length,
    ready_or_applied_candidate_count: revalidationItems.filter((item) => item.ready_or_applied_candidate).length,
    non_human_ready_or_applied_candidate_count: revalidationItems.filter((item) => ["blocked_non_human_ready_receipt", "blocked_non_human_applied_receipt"].includes(item.revalidation_status)).length,
    protected_approval_overlap_count: revalidationItems.filter((item) => item.protected_approval_overlap).length,
    auto_executed_receipt_count: revalidationItems.filter((item) => item.auto_executed_receipt).length,
    validation_error_count: validation.errors.length,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_required_actor: countBy(revalidationItems, "required_actor"),
    by_revalidation_status: countBy(revalidationItems, "revalidation_status"),
    by_command_kind: countBy(revalidationItems, "command_kind"),
  };
}

function renderManualRevalidationMarkdown(revalidation) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Manual Revalidation");
  lines.push("");
  lines.push(`Generated: ${revalidation.generated_at}`);
  lines.push(`Revalidation status: ${revalidation.revalidation_status}`);
  lines.push("");
  lines.push(`- Revalidation items: ${revalidation.summary.revalidation_item_count}`);
  lines.push(`- Pending human receipts: ${revalidation.summary.pending_human_receipt_count}`);
  lines.push(`- Human-entered ready receipts: ${revalidation.summary.human_entered_ready_receipt_count}`);
  lines.push(`- Human-entered applied receipts: ${revalidation.summary.human_entered_applied_receipt_count}`);
  lines.push(`- Non-human ready/applied candidates: ${revalidation.summary.non_human_ready_or_applied_candidate_count}`);
  lines.push(`- Protected approval overlaps: ${revalidation.summary.protected_approval_overlap_count}`);
  lines.push(`- Auto-executed receipts: ${revalidation.summary.auto_executed_receipt_count}`);
  lines.push("");
  lines.push("## Actor Revalidation");
  lines.push("");
  for (const actor of revalidation.actor_revalidations) {
    lines.push(`- ${actor.required_actor}: ${actor.revalidation_status}, ${actor.pending_human_receipt_count} pending.`);
  }
  if (revalidation.actor_revalidations.length === 0) lines.push("- No manual receipt actor revalidations.");
  return `${lines.join("\n")}\n`;
}

function renderActorRevalidationMarkdown(actorRevalidation, items) {
  const lines = [];
  lines.push(`# Manual Revalidation: ${actorRevalidation.required_actor}`);
  lines.push("");
  lines.push(`Revalidation status: ${actorRevalidation.revalidation_status}`);
  lines.push(`Items: ${actorRevalidation.revalidation_item_count}`);
  lines.push(`Pending human receipts: ${actorRevalidation.pending_human_receipt_count}`);
  lines.push(`Ready manual receipts: ${actorRevalidation.ready_manual_receipt_count}`);
  lines.push("");
  lines.push("Items:");
  for (const item of items) lines.push(`- ${item.step_key}: ${item.revalidation_status}`);
  return `${lines.join("\n")}\n`;
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
    error: result.ok ? null : result.error,
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function serializableRevalidation(result) {
  const { markdown, ...artifact } = result;
  return artifact;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeReceiptStatus(status) {
  return String(status ?? "missing").trim() || "missing";
}

function normalizeCommandResult(result) {
  return String(result ?? "missing").trim() || "missing";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function highestPriority(items) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...items].sort((left, right) => (order[left.priority] ?? 99) - (order[right.priority] ?? 99))[0]?.priority ?? "medium";
}

function compareActorRevalidations(left, right) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[left.priority] ?? 99) - (order[right.priority] ?? 99) || left.required_actor.localeCompare(right.required_actor);
}

function parseArgs(argv) {
  const parsed = {
    manualCommandReceiptPackPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.manualCommandReceiptPackPath,
    commandReceiptWorkspaceMergePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptWorkspaceMergePath,
    commandReceiptWorkspaceValidationPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptWorkspaceValidationPath,
    commandReceiptApplicationPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.commandReceiptApplicationPath,
    protectedApprovalRequestPackPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_INPUTS.protectedApprovalRequestPackPath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_MANUAL_REVALIDATION_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--manual-command-receipt-pack") parsed.manualCommandReceiptPackPath = argv[++index];
    else if (arg === "--command-receipt-workspace-merge") parsed.commandReceiptWorkspaceMergePath = argv[++index];
    else if (arg === "--command-receipt-workspace-validation") parsed.commandReceiptWorkspaceValidationPath = argv[++index];
    else if (arg === "--command-receipt-application") parsed.commandReceiptApplicationPath = argv[++index];
    else if (arg === "--protected-approval-request-pack") parsed.protectedApprovalRequestPackPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
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
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-manual-revalidation.mjs [options]

Options:
  --manual-command-receipt-pack <path>          manual command receipt pack artifact path.
  --command-receipt-workspace-merge <path>      command receipt workspace merge artifact path.
  --command-receipt-workspace-validation <path> command receipt workspace validation artifact path.
  --command-receipt-application <path>          command receipt application artifact path.
  --protected-approval-request-pack <path>      protected approval request pack artifact path.
  --out-dir <path>                              output directory.
  --run-at <iso>                                fixed generated_at timestamp.
  --check                                       fail when manual revalidation has errors.
  --help                                        show this help.
`);
}
