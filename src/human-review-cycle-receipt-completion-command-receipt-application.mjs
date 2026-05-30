import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipt-application/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_INPUTS = {
  commandReceiptValidationPath: "artifacts/human-review-cycle-receipt-completion-command-receipt-workspace-validation/latest/human-review-cycle-receipt-completion-command-receipt-validation.json",
  commandQueuePath: "artifacts/human-review-cycle-receipt-completion-command-queue/latest/human-review-cycle-receipt-completion-command-queue.json",
};

const APPLIED_COMMAND_STATUSES = {
  resolved: "completed",
  failed: "failed",
  skipped: "skipped",
  deferred: "deferred",
};

export async function runHumanReviewCycleReceiptCompletionCommandReceiptApplication(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceiptApplication(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceiptApplication(result, result.output_dir);
  if (options.check && result.application_status.startsWith("blocked_")) {
    const error = new Error(`Human review cycle receipt completion command receipt application failed: ${result.application_status}.`);
    error.application = result;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceiptApplication(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const validationPath = path.resolve(options.commandReceiptValidationPath ?? options.validationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_INPUTS.commandReceiptValidationPath);
  const commandQueuePath = path.resolve(options.commandQueuePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_INPUTS.commandQueuePath);
  const validationResult = await readJsonOrError(validationPath);
  const commandQueueResult = await readJsonOrError(commandQueuePath);
  const validation = validationResult.value;
  const commandQueue = commandQueueResult.value;
  const validationErrors = validation?.summary?.error_count ?? validation?.receipt_errors?.length ?? 0;
  const validatedCommandReceipts = validation?.validated_command_receipts ?? emptyValidatedCommandReceipts(generatedAt);
  const readyReceipts = validatedCommandReceipts.receipts ?? [];
  const commandQueueItemById = new Map((commandQueue?.command_queue_items ?? []).map((item) => [item.queue_item_id, item]));
  const applicationStatus = deriveApplicationStatus(validationResult, commandQueueResult, validationErrors, readyReceipts.length);
  const canApply = applicationStatus === "applied";
  const appliedReceipts = canApply
    ? readyReceipts.map((receipt) => buildAppliedCommandReceipt(receipt, commandQueueItemById.get(receipt.queue_item_id)))
    : [];
  const patchedCommandQueueItems = canApply ? buildPatchedCommandQueueItems(commandQueue?.command_queue_items ?? [], appliedReceipts) : [];
  const auditEvents = canApply ? appliedReceipts.map((receipt) => buildAuditEvent(receipt, generatedAt)) : [];
  const application = {
    schema_version: "human-review-cycle-receipt-completion-command-receipt-application.v1",
    generated_at: generatedAt,
    application_id: `human-review-cycle-receipt-completion-command-receipt-application.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    application_status: applicationStatus,
    safe_to_apply: canApply,
    safe_handling: {
      auto_execute_allowed: false,
      command_receipt_application_only: true,
      refresh_commands_executed: false,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [
      buildSource("human_review_cycle_receipt_completion_command_receipt_workspace_validation", "Human Review Cycle Receipt Completion Command Receipt Workspace Validation", validationPath, validationResult),
      buildSource("human_review_cycle_receipt_completion_command_queue", "Human Review Cycle Receipt Completion Command Queue", commandQueuePath, commandQueueResult),
    ],
    summary: summarizeApplication({
      validationResult,
      commandQueueResult,
      validation,
      validationErrors,
      readyReceipts,
      appliedReceipts,
      patchedCommandQueueItems,
      auditEvents,
      applicationStatus,
    }),
    validated_command_receipts_to_apply: validatedCommandReceipts,
    applied_command_receipts: appliedReceipts,
    pending_command_receipts: (validation?.validation_items ?? []).filter((item) => item.validation_status === "pending_receipt"),
    receipt_errors: validation?.receipt_errors ?? [],
    audit_events: auditEvents,
    patched_command_queue_items: patchedCommandQueueItems,
  };

  return {
    ...application,
    markdown: renderApplicationMarkdown(application),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceiptApplication(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application.json"), serializableApplication(result));
  await writeJson(path.join(outDir, "validated-command-receipts-to-apply.json"), result.validated_command_receipts_to_apply);
  await writeJson(path.join(outDir, "applied-command-receipts.json"), {
    generated_at: result.generated_at,
    count: result.applied_command_receipts.length,
    receipts: result.applied_command_receipts,
  });
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  if (result.patched_command_queue_items.length > 0) await writeJson(path.join(outDir, "patched-command-queue-items.json"), result.patched_command_queue_items);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptApplicationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceiptApplication(args);
    console.log(`Human review cycle receipt completion command receipt application written to ${result.output_dir}`);
    console.log(`Application status: ${result.application_status}`);
    console.log(`Ready receipts: ${result.summary.ready_receipt_count}`);
    console.log(`Applied receipts: ${result.summary.applied_receipt_count}`);
    console.log(`Audit events: ${result.summary.audit_event_count}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function deriveApplicationStatus(validationResult, commandQueueResult, validationErrors, readyReceiptCount) {
  if (!validationResult.ok) return "blocked_missing_validation";
  if (!commandQueueResult.ok) return "blocked_missing_command_queue";
  if (validationErrors > 0) return "blocked_validation_errors";
  if (readyReceiptCount === 0) return "nothing_to_apply";
  return "applied";
}

function buildAppliedCommandReceipt(receipt, queueItem) {
  return {
    receipt_id: receipt.receipt_id,
    queue_item_id: receipt.queue_item_id,
    command_gate_id: receipt.command_gate_id,
    runbook_step_id: receipt.runbook_step_id,
    step_key: receipt.step_key,
    command_kind: receipt.command_kind,
    command: receipt.command,
    receipt_status: receipt.receipt_status,
    command_result: receipt.command_result,
    applied_command_status: deriveAppliedCommandStatus(receipt),
    executed_by: receipt.executed_by,
    executed_at: receipt.executed_at,
    output_reference: receipt.output_reference,
    notes: receipt.notes,
    commands_run: receipt.commands_run ?? [],
    queue_item_found: Boolean(queueItem),
    source_refs: queueItem?.source_refs ?? {},
    safe_handling: {
      ...(queueItem?.safe_handling ?? {}),
      auto_execute_allowed: false,
      protected_actions_executed: false,
    },
    refresh_command_executed_by_harness: false,
    protected_action_executed: false,
  };
}

function deriveAppliedCommandStatus(receipt) {
  if (receipt.command_result === "run_failed") return "failed";
  if (receipt.command_result === "skipped") return "skipped";
  if (receipt.command_result === "deferred") return "deferred";
  return APPLIED_COMMAND_STATUSES[receipt.receipt_status] ?? "recorded";
}

function buildPatchedCommandQueueItems(commandQueueItems, appliedReceipts) {
  const receiptByQueueItemId = new Map(appliedReceipts.map((receipt) => [receipt.queue_item_id, receipt]));
  return commandQueueItems
    .filter((item) => receiptByQueueItemId.has(item.queue_item_id))
    .map((item) => {
      const receipt = receiptByQueueItemId.get(item.queue_item_id);
      return {
        ...item,
        command_status: receipt.applied_command_status,
        queue_status: "command_receipt_applied",
        applied_receipt_id: receipt.receipt_id,
        applied_at: receipt.executed_at,
        applied_by: receipt.executed_by,
        output_reference: receipt.output_reference,
        protected_actions_executed: false,
      };
    });
}

function buildAuditEvent(receipt, generatedAt) {
  return {
    type: "human_review_cycle.command_receipt.applied",
    time: generatedAt,
    actor: receipt.executed_by,
    correlation_id: receipt.queue_item_id,
    subject: {
      receipt_id: receipt.receipt_id,
      queue_item_id: receipt.queue_item_id,
      command_gate_id: receipt.command_gate_id,
      receipt_status: receipt.receipt_status,
      command_result: receipt.command_result,
      applied_command_status: receipt.applied_command_status,
      refresh_command_executed_by_harness: false,
      protected_action_executed: false,
    },
  };
}

function summarizeApplication(context) {
  return {
    application_status: context.applicationStatus,
    validation_available: context.validationResult.ok,
    command_queue_available: context.commandQueueResult.ok,
    validation_status: context.validation?.validation_status ?? null,
    validation_error_count: context.validationErrors,
    ready_receipt_count: context.readyReceipts.length,
    pending_receipt_count: context.validation?.summary?.pending_receipt_count ?? 0,
    invalid_receipt_count: context.validation?.summary?.invalid_receipt_count ?? 0,
    applied_receipt_count: context.appliedReceipts.length,
    patched_command_queue_item_count: context.patchedCommandQueueItems.length,
    audit_event_count: context.auditEvents.length,
    receipt_error_count: context.validation?.receipt_errors?.length ?? 0,
    refresh_command_executed_by_harness_count: 0,
    protected_action_executed_count: 0,
    by_receipt_status: countBy(context.appliedReceipts, "receipt_status"),
    by_command_result: countBy(context.appliedReceipts, "command_result"),
    by_command_kind: countBy(context.appliedReceipts, "command_kind"),
    by_applied_command_status: countBy(context.appliedReceipts, "applied_command_status"),
  };
}

function emptyValidatedCommandReceipts(generatedAt) {
  return {
    schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
    generated_at: generatedAt,
    command_queue_id: "human-review-cycle-receipt-completion-command-queue.unknown",
    instructions: "No validated command receipts were available.",
    receipts: [],
  };
}

function renderApplicationMarkdown(application) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Command Receipt Application");
  lines.push("");
  lines.push(`Generated: ${application.generated_at}`);
  lines.push(`Application status: ${application.application_status}`);
  lines.push(`Refresh commands executed by harness: ${application.safe_handling.refresh_commands_executed}`);
  lines.push(`Protected actions executed: ${application.safe_handling.protected_actions_executed}`);
  lines.push("");
  lines.push(`- Ready receipts: ${application.summary.ready_receipt_count}`);
  lines.push(`- Applied receipts: ${application.summary.applied_receipt_count}`);
  lines.push(`- Pending receipts: ${application.summary.pending_receipt_count}`);
  lines.push(`- Patched command queue items: ${application.summary.patched_command_queue_item_count}`);
  lines.push(`- Audit events: ${application.summary.audit_event_count}`);
  lines.push(`- Validation errors: ${application.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Applied Command Receipts");
  lines.push("");
  for (const receipt of application.applied_command_receipts) {
    lines.push(`- ${receipt.queue_item_id}: ${receipt.command_result} -> ${receipt.applied_command_status}`);
  }
  if (application.applied_command_receipts.length === 0) lines.push("- No command receipts applied.");
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

function serializableApplication(result) {
  const { markdown, ...artifact } = result;
  return artifact;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const parsed = {
    commandReceiptValidationPath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_INPUTS.commandReceiptValidationPath,
    commandQueuePath: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_INPUTS.commandQueuePath,
    outDir: DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_APPLICATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--validation" || arg === "--command-receipt-validation") parsed.commandReceiptValidationPath = argv[++index];
    else if (arg === "--command-queue") parsed.commandQueuePath = argv[++index];
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
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipt-application.mjs [options]

Options:
  --validation <path>            command receipt validation artifact path.
  --command-receipt-validation <path>
                                 alias for --validation.
  --command-queue <path>         human review cycle receipt completion command queue artifact path.
  --out-dir <path>               output directory.
  --run-at <iso>                 fixed generated_at timestamp.
  --check                        fail only when application is blocked.
  --help                         show this help.
`);
}
