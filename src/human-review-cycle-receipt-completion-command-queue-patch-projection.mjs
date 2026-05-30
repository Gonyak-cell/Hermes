import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-queue-patch-projection/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_INPUTS = {
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
  manualRevalidationPath: "artifacts/human-review-cycle-receipt-completion-manual-revalidation/latest/human-review-cycle-receipt-completion-manual-revalidation.json",
  commandReceiptApplicationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest/human-review-cycle-receipt-completion-command-receipt-application.json",
};

const APPLIED_COMMAND_STATUSES = {
  resolved: "completed",
  failed: "failed",
  skipped: "skipped",
  deferred: "deferred",
};

export async function runHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion command queue patch projection failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_INPUTS.commandQueuePath);
  const manualRevalidationPath = path.resolve(options.manualRevalidationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_INPUTS.manualRevalidationPath);
  const commandReceiptApplicationPath = path.resolve(options.commandReceiptApplicationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_QUEUE_PATCH_PROJECTION_INPUTS.commandReceiptApplicationPath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const manualRevalidationResult = await readJsonOrError(manualRevalidationPath);
  const commandReceiptApplicationResult = await readJsonOrError(commandReceiptApplicationPath);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
    buildSource("human_review_cycle_receipt_completion_manual_revalidation", "Human Review Cycle Receipt Completion Manual Revalidation", manualRevalidationPath, manualRevalidationResult),
    buildSource("human_review_cycle_receipt_completion_command_receipt_application", "Human Review Cycle Receipt Completion Command Receipt Application", commandReceiptApplicationPath, commandReceiptApplicationResult),
  ];
  const projectionItems = buildProjectionItems({
    commandQueue: commandQueueResult.value,
    manualRevalidation: manualRevalidationResult.value,
    generatedAt,
  });
  const patchOperations = projectionItems.flatMap((item) => item.patch_operations);
  const auditEventCandidates = projectionItems.map((item) => item.audit_event_candidate);
  const validation = validateCommandQueuePatchProjection({
    sources,
    commandQueue: commandQueueResult.value,
    manualRevalidation: manualRevalidationResult.value,
    commandReceiptApplication: commandReceiptApplicationResult.value,
    projectionItems,
    patchOperations,
    auditEventCandidates,
  });
  const projectionStatus = deriveProjectionStatus(validation, projectionItems);
  const projection = {
    schema_version: "human-review-cycle-receipt-completion-command-queue-patch-projection.v1",
    generated_at: generatedAt,
    projection_id: `human-review-cycle-receipt-completion-command-queue-patch-projection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    projection_status: projectionStatus,
    safe_handling: {
      auto_execute_allowed: false,
      patch_projection_only: true,
      source_artifact_mutation_allowed: false,
      command_queue_patch_applied: false,
      commands_executed: false,
      audit_events_emitted: false,
      refresh_commands_executed: false,
      protected_actions_executed: false,
    },
    sources,
    summary: summarizeProjection({
      commandQueue: commandQueueResult.value,
      manualRevalidation: manualRevalidationResult.value,
      commandReceiptApplication: commandReceiptApplicationResult.value,
      projectionItems,
      patchOperations,
      auditEventCandidates,
      validation,
      projectionStatus,
    }),
    projection_items: projectionItems,
    patch_operations: patchOperations,
    audit_event_candidates: auditEventCandidates,
    validation,
  };

  return {
    ...projection,
    markdown: renderProjectionMarkdown(projection),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection.json"), serializableProjection(result));
  await writeJson(path.join(outDir, "projection-items.json"), {
    generated_at: result.generated_at,
    count: result.projection_items.length,
    projection_items: result.projection_items,
  });
  await writeJson(path.join(outDir, "patch-operations.json"), {
    generated_at: result.generated_at,
    count: result.patch_operations.length,
    patch_operations: result.patch_operations,
  });
  await writeJson(path.join(outDir, "audit-event-candidates.json"), {
    generated_at: result.generated_at,
    count: result.audit_event_candidates.length,
    audit_event_candidates: result.audit_event_candidates,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandQueuePatchProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandQueuePatchProjection(args);
    console.log(`Human review cycle receipt completion command queue patch projection written to ${result.output_dir}`);
    console.log(`Projection status: ${result.projection_status}`);
    console.log(`Projection items: ${result.summary.projection_item_count}`);
    console.log(`Patch targets: ${result.summary.patch_target_count}`);
    console.log(`Ready patches: ${result.summary.ready_patch_count}`);
    console.log(`Audit event candidates: ${result.summary.audit_event_candidate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildProjectionItems({ commandQueue, manualRevalidation, generatedAt }) {
  const queueItemsById = new Map((commandQueue?.command_queue_items ?? []).map((item) => [item.queue_item_id, item]));
  return (manualRevalidation?.revalidation_items ?? []).map((revalidationItem, index) => {
    const queueItem = queueItemsById.get(revalidationItem.queue_item_id);
    const receipt = revalidationItem.human_entered_receipt ? revalidationItem.receipt : null;
    const patchReady = Boolean(revalidationItem.ready_or_applied_candidate && revalidationItem.human_entered_receipt);
    const beforeState = buildBeforeState(queueItem);
    const afterState = buildAfterState({ beforeState, revalidationItem, receipt, patchReady });
    const patchStatus = derivePatchStatus({ revalidationItem, queueItem, patchReady });
    const projectionItemId = `human-review-cycle-receipt-completion-command-queue-patch-projection.item.${String(index + 1).padStart(2, "0")}.${slugify(revalidationItem.queue_item_id)}`;
    const patchOperations = patchReady ? buildPatchOperations({ projectionItemId, queueItemId: revalidationItem.queue_item_id, beforeState, afterState }) : [];
    return {
      projection_item_id: projectionItemId,
      source_revalidation_item_id: revalidationItem.revalidation_item_id,
      source_pack_item_id: revalidationItem.source_pack_item_id,
      queue_item_id: revalidationItem.queue_item_id,
      command_gate_id: revalidationItem.command_gate_id,
      runbook_step_id: revalidationItem.runbook_step_id,
      step_key: revalidationItem.step_key,
      command_kind: revalidationItem.command_kind,
      command: revalidationItem.command,
      required_actor: revalidationItem.required_actor,
      projection_status: patchStatus,
      patch_target_available: Boolean(queueItem),
      patch_ready: patchReady,
      patch_applied: false,
      audit_event_emitted: false,
      before_state: beforeState,
      after_state: afterState,
      patch_operations: patchOperations,
      audit_event_candidate: buildAuditEventCandidate({
        generatedAt,
        revalidationItem,
        receipt,
        patchReady,
        beforeState,
        afterState,
      }),
      source_refs: {
        command_queue_item_id: queueItem?.queue_item_id ?? null,
        revalidation_item_id: revalidationItem.revalidation_item_id,
        source_validation_item_id: revalidationItem.source_validation_item_id ?? null,
        source_applied_receipt_id: revalidationItem.source_applied_receipt_id ?? null,
      },
      safe_handling: {
        auto_execute_allowed: false,
        patch_projection_only: true,
        source_artifact_mutation_allowed: false,
        command_queue_patch_applied: false,
        commands_executed: false,
        audit_events_emitted: false,
        protected_actions_executed: false,
      },
    };
  });
}

function buildBeforeState(queueItem) {
  if (!queueItem) {
    return {
      queue_item_found: false,
      command_status: null,
      queue_status: null,
      applied_receipt_id: null,
      applied_at: null,
      applied_by: null,
      output_reference: null,
      protected_actions_executed: false,
    };
  }
  return {
    queue_item_found: true,
    command_status: queueItem.command_status ?? null,
    queue_status: queueItem.queue_status ?? null,
    applied_receipt_id: queueItem.applied_receipt_id ?? null,
    applied_at: queueItem.applied_at ?? null,
    applied_by: queueItem.applied_by ?? null,
    output_reference: queueItem.output_reference ?? null,
    protected_actions_executed: Boolean(queueItem.protected_actions_executed),
  };
}

function buildAfterState({ beforeState, revalidationItem, receipt, patchReady }) {
  if (!patchReady || !receipt) return { ...beforeState };
  return {
    queue_item_found: beforeState.queue_item_found,
    command_status: deriveAppliedCommandStatus(receipt),
    queue_status: "command_receipt_projected",
    applied_receipt_id: receipt.receipt_id ?? revalidationItem.source_applied_receipt_id ?? null,
    applied_at: receipt.executed_at ?? null,
    applied_by: receipt.executed_by ?? null,
    output_reference: receipt.output_reference ?? null,
    protected_actions_executed: false,
  };
}

function buildPatchOperations({ projectionItemId, queueItemId, beforeState, afterState }) {
  return ["command_status", "queue_status", "applied_receipt_id", "applied_at", "applied_by", "output_reference", "protected_actions_executed"]
    .filter((field) => beforeState[field] !== afterState[field])
    .map((field) => ({
      operation_id: `${projectionItemId}.patch.${field}`,
      op: beforeState[field] === undefined || beforeState[field] === null ? "add" : "replace",
      path: `/command_queue_items/by_queue_item_id/${queueItemId}/${field}`,
      field,
      before: beforeState[field] ?? null,
      after: afterState[field] ?? null,
      applied: false,
    }));
}

function buildAuditEventCandidate({ generatedAt, revalidationItem, receipt, patchReady, beforeState, afterState }) {
  return {
    candidate_id: `human-review-cycle-receipt-completion-command-queue-patch-projection.audit.${slugify(revalidationItem.queue_item_id)}`,
    type: patchReady ? "human_review_cycle.command_queue_patch.projected" : "human_review_cycle.command_queue_patch.held",
    time: generatedAt,
    actor: receipt?.executed_by ?? revalidationItem.required_actor ?? "human_reviewer",
    correlation_id: revalidationItem.queue_item_id,
    event_status: patchReady ? "ready_to_emit_after_explicit_apply" : "held_pending_manual_receipt",
    would_emit_on_apply: patchReady,
    emitted: false,
    subject: {
      queue_item_id: revalidationItem.queue_item_id,
      command_gate_id: revalidationItem.command_gate_id,
      receipt_id: receipt?.receipt_id ?? revalidationItem.source_applied_receipt_id ?? null,
      before_command_status: beforeState.command_status,
      after_command_status: afterState.command_status,
      before_queue_status: beforeState.queue_status,
      after_queue_status: afterState.queue_status,
      patch_ready: patchReady,
      protected_action_executed: false,
      command_executed_by_harness: false,
    },
  };
}

function derivePatchStatus({ revalidationItem, queueItem, patchReady }) {
  if (!queueItem) return "blocked_missing_command_queue_item";
  if (revalidationItem.protected_approval_overlap) return "blocked_protected_approval_overlap";
  if (revalidationItem.auto_executed_receipt) return "blocked_auto_executed_receipt";
  if (revalidationItem.ready_or_applied_candidate && !revalidationItem.human_entered_receipt) return "blocked_non_human_receipt_candidate";
  if (patchReady) return "ready_for_patch_projection";
  return "waiting_for_human_receipt";
}

function deriveAppliedCommandStatus(receipt) {
  if (receipt?.command_result === "run_failed") return "failed";
  if (receipt?.command_result === "skipped") return "skipped";
  if (receipt?.command_result === "deferred") return "deferred";
  return APPLIED_COMMAND_STATUSES[receipt?.receipt_status] ?? "recorded";
}

function validateCommandQueuePatchProjection({ sources, commandQueue, manualRevalidation, commandReceiptApplication, projectionItems, patchOperations, auditEventCandidates }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  if (commandQueue?.validation && !commandQueue.validation.valid) errors.push({ path: "human_review_cycle_receipt_completion_command_queue.validation", message: "Command queue source is not valid." });
  if (manualRevalidation?.validation && !manualRevalidation.validation.valid) errors.push({ path: "human_review_cycle_receipt_completion_manual_revalidation.validation", message: "Manual revalidation source is not valid." });
  const revalidationItemCount = manualRevalidation?.summary?.revalidation_item_count ?? manualRevalidation?.revalidation_items?.length ?? 0;
  if (projectionItems.length !== revalidationItemCount) {
    errors.push({ path: "projection_items", message: "Projection items must cover every manual revalidation item." });
  }
  for (const item of projectionItems) {
    if (!item.before_state || !item.after_state) errors.push({ path: `projection_items.${item.projection_item_id}.state`, message: "Projection item must include before_state and after_state." });
    if (!item.audit_event_candidate) errors.push({ path: `projection_items.${item.projection_item_id}.audit_event_candidate`, message: "Projection item must include an audit event candidate." });
    if (item.patch_ready && !item.patch_target_available) errors.push({ path: `projection_items.${item.projection_item_id}.patch_target_available`, message: "Ready patches require an existing command queue target." });
    if (item.patch_ready && item.audit_event_candidate?.would_emit_on_apply !== true) errors.push({ path: `projection_items.${item.projection_item_id}.audit_event_candidate`, message: "Ready patches require an emittable audit event candidate." });
    if (item.safe_handling.command_queue_patch_applied || item.patch_applied || item.audit_event_emitted) errors.push({ path: `projection_items.${item.projection_item_id}.safe_handling`, message: "Patch projection must not apply patches or emit events." });
  }
  const readyCandidateCount = manualRevalidation?.summary?.ready_or_applied_candidate_count ?? 0;
  if (projectionItems.filter((item) => item.patch_ready).length !== readyCandidateCount) {
    errors.push({ path: "projection_items.patch_ready", message: "Ready patch count must match manual revalidation ready/applied human candidate count." });
  }
  const unsafeCount = projectionItems.filter((item) => item.projection_status.startsWith("blocked_")).length;
  if (unsafeCount > 0) errors.push({ path: "projection_items", message: "Patch projection contains blocked unsafe items." });
  if ((manualRevalidation?.summary?.non_human_ready_or_applied_candidate_count ?? 0) > 0) errors.push({ path: "manual_revalidation.non_human_ready_or_applied_candidate_count", message: "Non-human ready/applied candidates cannot be projected." });
  if ((manualRevalidation?.summary?.protected_approval_overlap_count ?? 0) > 0) errors.push({ path: "manual_revalidation.protected_approval_overlap_count", message: "Protected approval overlaps cannot be projected as command queue patches." });
  if ((manualRevalidation?.summary?.auto_executed_receipt_count ?? 0) > 0) errors.push({ path: "manual_revalidation.auto_executed_receipt_count", message: "Auto-executed receipts cannot be projected." });
  if ((commandReceiptApplication?.summary?.refresh_command_executed_by_harness_count ?? 0) > 0 || (commandReceiptApplication?.summary?.protected_action_executed_count ?? 0) > 0) {
    errors.push({ path: "command_receipt_application.safe_handling", message: "Source command receipt application must not execute refresh commands or protected actions." });
  }
  if (patchOperations.some((operation) => operation.applied)) errors.push({ path: "patch_operations", message: "Patch operations must remain unapplied in projection." });
  if (auditEventCandidates.some((event) => event.emitted)) errors.push({ path: "audit_event_candidates", message: "Audit event candidates must remain un-emitted in projection." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeProjection({ commandQueue, manualRevalidation, commandReceiptApplication, projectionItems, patchOperations, auditEventCandidates, validation, projectionStatus }) {
  return {
    projection_status: projectionStatus,
    source_command_queue_status: commandQueue?.queue_status ?? null,
    source_revalidation_status: manualRevalidation?.revalidation_status ?? null,
    source_application_status: commandReceiptApplication?.application_status ?? null,
    source_revalidation_item_count: manualRevalidation?.summary?.revalidation_item_count ?? manualRevalidation?.revalidation_items?.length ?? 0,
    source_ready_or_applied_candidate_count: manualRevalidation?.summary?.ready_or_applied_candidate_count ?? 0,
    projection_item_count: projectionItems.length,
    patch_target_count: projectionItems.filter((item) => item.patch_target_available).length,
    ready_patch_count: projectionItems.filter((item) => item.patch_ready).length,
    waiting_patch_count: projectionItems.filter((item) => item.projection_status === "waiting_for_human_receipt").length,
    blocked_patch_count: projectionItems.filter((item) => item.projection_status.startsWith("blocked_")).length,
    unchanged_projection_count: projectionItems.filter((item) => item.patch_operations.length === 0).length,
    patch_operation_count: patchOperations.length,
    audit_event_candidate_count: auditEventCandidates.length,
    emittable_audit_event_candidate_count: auditEventCandidates.filter((event) => event.would_emit_on_apply).length,
    missing_queue_item_count: projectionItems.filter((item) => !item.patch_target_available).length,
    non_human_patch_candidate_count: manualRevalidation?.summary?.non_human_ready_or_applied_candidate_count ?? 0,
    protected_overlap_count: manualRevalidation?.summary?.protected_approval_overlap_count ?? 0,
    auto_executed_receipt_count: manualRevalidation?.summary?.auto_executed_receipt_count ?? 0,
    validation_error_count: validation.errors.length,
    patch_applied_count: 0,
    audit_event_emitted_count: 0,
    command_executed_count: 0,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_projection_status: countBy(projectionItems, "projection_status"),
    by_command_kind: countBy(projectionItems, "command_kind"),
  };
}

function deriveProjectionStatus(validation, projectionItems) {
  if (!validation.valid) return "blocked";
  if (projectionItems.some((item) => item.patch_ready)) return "ready_for_patch_projection";
  if (projectionItems.some((item) => item.projection_status === "waiting_for_human_receipt")) return "waiting_for_human_receipts";
  return "projected_clear";
}

function renderProjectionMarkdown(projection) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Command Queue Patch Projection");
  lines.push("");
  lines.push(`Generated: ${projection.generated_at}`);
  lines.push(`Projection status: ${projection.projection_status}`);
  lines.push(`Patch applied: ${projection.safe_handling.command_queue_patch_applied}`);
  lines.push(`Audit events emitted: ${projection.safe_handling.audit_events_emitted}`);
  lines.push("");
  lines.push(`- Projection items: ${projection.summary.projection_item_count}`);
  lines.push(`- Patch targets: ${projection.summary.patch_target_count}`);
  lines.push(`- Ready patches: ${projection.summary.ready_patch_count}`);
  lines.push(`- Waiting patches: ${projection.summary.waiting_patch_count}`);
  lines.push(`- Patch operations: ${projection.summary.patch_operation_count}`);
  lines.push(`- Audit event candidates: ${projection.summary.audit_event_candidate_count}`);
  lines.push(`- Validation errors: ${projection.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Projection Items");
  for (const item of projection.projection_items) {
    lines.push(`- ${item.projection_item_id}: ${item.projection_status} -> ${item.after_state.command_status ?? "unchanged"} (${item.command})`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableProjection(result) {
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
    else if (arg === "--command-queue") parsed.commandQueuePath = argv[++index];
    else if (arg === "--manual-revalidation") parsed.manualRevalidationPath = argv[++index];
    else if (arg === "--command-receipt-application") parsed.commandReceiptApplicationPath = argv[++index];
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
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-queue-patch-projection.mjs [options]

Options:
  --out-dir <path>                     Output directory.
  --command-queue <path>               command queue artifact path.
  --manual-revalidation <path>         manual receipt revalidation artifact path.
  --command-receipt-application <path> command receipt application artifact path.
  --run-at <iso>                       Override generated_at.
  --check                              Exit non-zero on validation errors.
  --help                               Show this help.
`);
}
