import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_VALIDATION_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-command-receipt-validation/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_VALIDATION_INPUTS = {
  commandReceiptsPath: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/human-review-cycle-receipt-completion-command-receipts.json",
  receiptInputPath: "artifacts/human-review-cycle-receipt-completion-command-receipts/latest/receipt-input-draft.json",
};

const TERMINAL_RECEIPT_STATUSES = new Set(["resolved", "failed", "skipped", "deferred"]);
const TERMINAL_COMMAND_RESULTS = new Set(["run_success", "run_failed", "skipped", "deferred"]);

export async function runHumanReviewCycleReceiptCompletionCommandReceiptValidation(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionCommandReceiptValidation(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionCommandReceiptValidation(result, result.output_dir);
  if (options.check && result.summary.error_count > 0) {
    const error = new Error(`Human review cycle receipt completion command receipt validation failed with ${result.summary.error_count} error(s).`);
    error.validation = result;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionCommandReceiptValidation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_VALIDATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const commandReceiptsPath = path.resolve(options.commandReceiptsPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_VALIDATION_INPUTS.commandReceiptsPath);
  const receiptInputPath = path.resolve(options.receiptInputPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_COMMAND_RECEIPT_VALIDATION_INPUTS.receiptInputPath);
  const commandReceiptsResult = await readJsonOrError(commandReceiptsPath);
  const receiptInputResult = await readJsonOrError(receiptInputPath);
  const requirements = commandReceiptsResult.value?.receipt_requirements ?? [];
  const receipts = receiptInputResult.value?.receipts ?? [];
  const requirementByQueueItemId = new Map(requirements.map((requirement) => [requirement.queue_item_id, requirement]));
  const receiptByQueueItemId = new Map(receipts.map((receipt) => [receipt.queue_item_id, receipt]));
  const validationItems = [];
  const receiptErrors = [];

  for (const requirement of requirements) {
    const receipt = receiptByQueueItemId.get(requirement.queue_item_id);
    const item = validateCommandReceipt(requirement, receipt);
    validationItems.push(item);
    receiptErrors.push(...item.errors);
  }

  for (const receipt of receipts) {
    if (requirementByQueueItemId.has(receipt.queue_item_id)) continue;
    const item = unknownCommandReceiptValidationItem(receipt);
    validationItems.push(item);
    receiptErrors.push(...item.errors);
  }

  const validatedCommandReceipts = {
    schema_version: "human-review-cycle-receipt-completion-command-receipts-input.v1",
    generated_at: generatedAt,
    command_queue_id: receiptInputResult.value?.command_queue_id ?? commandReceiptsResult.value?.receipt_input_draft?.command_queue_id ?? "human-review-cycle-receipt-completion-command-queue.unknown",
    instructions: "Validated command receipts only prove manually run refresh commands. They do not execute commands, edit target receipt inputs, or apply protected actions.",
    receipts: validationItems.filter((item) => item.ready_to_confirm).map((item) => item.receipt),
  };

  const validation = {
    schema_version: "human-review-cycle-receipt-completion-command-receipt-validation.v1",
    generated_at: generatedAt,
    validation_id: `human-review-cycle-receipt-completion-command-receipt-validation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    validation_status: deriveValidationStatus(commandReceiptsResult, receiptInputResult, validationItems, receiptErrors),
    safe_handling: {
      auto_execute_allowed: false,
      command_receipt_validation_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources: [
      buildSource("human_review_cycle_receipt_completion_command_receipts", "Human Review Cycle Receipt Completion Command Receipts", commandReceiptsPath, commandReceiptsResult),
      buildSource("human_review_cycle_receipt_completion_command_receipt_input", "Human Review Cycle Receipt Completion Command Receipt Input", receiptInputPath, receiptInputResult),
    ],
    summary: summarizeValidation(commandReceiptsResult, receiptInputResult, requirements, receipts, validationItems, receiptErrors),
    validation_items: validationItems,
    receipt_errors: receiptErrors,
    validated_command_receipts: validatedCommandReceipts,
  };

  return {
    ...validation,
    markdown: renderValidationMarkdown(validation),
  };
}

export async function writeHumanReviewCycleReceiptCompletionCommandReceiptValidation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-validation.json"), serializableValidation(result));
  await writeJson(path.join(outDir, "validated-command-receipts.json"), result.validated_command_receipts);
  await writeJson(path.join(outDir, "receipt-errors.json"), {
    generated_at: result.generated_at,
    count: result.receipt_errors.length,
    receipt_errors: result.receipt_errors,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionCommandReceiptValidationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionCommandReceiptValidation(args);
    console.log(`Human review cycle receipt completion command receipt validation written to ${result.output_dir}`);
    console.log(`Validation status: ${result.validation_status}`);
    console.log(`Ready to confirm: ${result.summary.ready_to_confirm_count}`);
    console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
    console.log(`Invalid receipts: ${result.summary.invalid_receipt_count}`);
    console.log(`Errors: ${result.summary.error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.receipt_errors ?? []) {
      console.error(`- ${validationError.queue_item_id}: ${validationError.field} - ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateCommandReceipt(requirement, receipt) {
  const receiptStatus = normalizeReceiptStatus(receipt?.receipt_status);
  const commandResult = normalizeCommandResult(receipt?.command_result);
  const errors = [];
  if (!receipt) {
    errors.push(error(requirement.queue_item_id, "queue_item_id", "Missing command receipt row."));
    return buildValidationItem(requirement, null, "missing_receipt", receiptStatus, commandResult, errors);
  }
  if (receiptStatus === "pending") {
    return buildValidationItem(requirement, receipt, "pending_receipt", receiptStatus, commandResult, errors);
  }
  if (!TERMINAL_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push(error(requirement.queue_item_id, "receipt_status", `Receipt status must be one of ${[...TERMINAL_RECEIPT_STATUSES].join(", ")} for non-pending command receipts.`));
  }
  if (!TERMINAL_COMMAND_RESULTS.has(commandResult)) {
    errors.push(error(requirement.queue_item_id, "command_result", `Command result must be one of ${[...TERMINAL_COMMAND_RESULTS].join(", ")} for non-pending command receipts.`));
  }
  for (const field of requirement.required_receipt_fields ?? []) {
    validateRequiredField(requirement, receipt, field, errors);
  }
  if (!Array.isArray(receipt.commands_run) || !receipt.commands_run.includes(requirement.command)) {
    errors.push(error(requirement.queue_item_id, "commands_run", "commands_run must include the exact queued command."));
  }
  return buildValidationItem(requirement, receipt, errors.length > 0 ? "invalid_receipt" : "ready_to_confirm", receiptStatus, commandResult, errors);
}

function validateRequiredField(requirement, receipt, field, errors) {
  if (field === "commands_run") {
    if (!Array.isArray(receipt.commands_run)) errors.push(error(requirement.queue_item_id, field, "commands_run must be an array."));
    return;
  }
  if (!receipt[field]) {
    errors.push(error(requirement.queue_item_id, field, `${field} is required for non-pending command receipts.`));
  }
}

function buildValidationItem(requirement, receipt, validationStatus, receiptStatus, commandResult, errors) {
  return {
    validation_item_id: `human-review-cycle-receipt-completion-command-receipt-validation.${slugify(requirement.queue_item_id)}`,
    receipt_requirement_id: requirement.receipt_requirement_id,
    queue_item_id: requirement.queue_item_id,
    command_gate_id: requirement.command_gate_id,
    runbook_step_id: requirement.runbook_step_id,
    step_key: requirement.step_key,
    command_kind: requirement.command_kind,
    command: requirement.command,
    validation_status: validationStatus,
    receipt_status: receiptStatus,
    command_result: commandResult,
    ready_to_confirm: validationStatus === "ready_to_confirm",
    error_count: errors.length,
    required_receipt_fields: requirement.required_receipt_fields ?? [],
    errors,
    receipt: receipt ?? null,
  };
}

function unknownCommandReceiptValidationItem(receipt) {
  const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
  const commandResult = normalizeCommandResult(receipt.command_result);
  const itemError = error(receipt.queue_item_id ?? "unknown", "queue_item_id", "Receipt input references a command outside the current command receipt requirement set.");
  return {
    validation_item_id: `human-review-cycle-receipt-completion-command-receipt-validation.unknown.${slugify(receipt.queue_item_id)}`,
    receipt_requirement_id: null,
    queue_item_id: receipt.queue_item_id ?? "unknown",
    command_gate_id: receipt.command_gate_id ?? "unknown",
    runbook_step_id: receipt.runbook_step_id ?? "unknown",
    step_key: receipt.step_key ?? "unknown",
    command_kind: receipt.command_kind ?? "unknown",
    command: receipt.command ?? "unknown",
    validation_status: "unknown_command_receipt",
    receipt_status: receiptStatus,
    command_result: commandResult,
    ready_to_confirm: false,
    error_count: 1,
    required_receipt_fields: [],
    errors: [itemError],
    receipt,
  };
}

function deriveValidationStatus(commandReceiptsResult, receiptInputResult, validationItems, receiptErrors) {
  if (!commandReceiptsResult.ok || !receiptInputResult.ok) return "blocked_missing_source";
  if (receiptErrors.length > 0) return "blocked_invalid_receipts";
  if (validationItems.some((item) => ["pending_receipt", "missing_receipt"].includes(item.validation_status))) return "pending_receipts";
  if (validationItems.some((item) => item.ready_to_confirm)) return "ready_to_confirm";
  return "clear";
}

function summarizeValidation(commandReceiptsResult, receiptInputResult, requirements, receipts, validationItems, receiptErrors) {
  return {
    validation_status: deriveValidationStatus(commandReceiptsResult, receiptInputResult, validationItems, receiptErrors),
    command_receipts_available: commandReceiptsResult.ok,
    receipt_input_available: receiptInputResult.ok,
    receipt_requirement_count: requirements.length,
    receipt_count: receipts.length,
    validation_item_count: validationItems.length,
    ready_to_confirm_count: validationItems.filter((item) => item.ready_to_confirm).length,
    pending_receipt_count: validationItems.filter((item) => item.validation_status === "pending_receipt").length,
    missing_receipt_count: validationItems.filter((item) => item.validation_status === "missing_receipt").length,
    invalid_receipt_count: validationItems.filter((item) => item.validation_status === "invalid_receipt").length,
    unknown_receipt_count: validationItems.filter((item) => item.validation_status === "unknown_command_receipt").length,
    error_count: receiptErrors.length,
    command_success_count: validationItems.filter((item) => item.command_result === "run_success").length,
    command_failed_count: validationItems.filter((item) => item.command_result === "run_failed").length,
    skipped_count: validationItems.filter((item) => item.command_result === "skipped").length,
    deferred_count: validationItems.filter((item) => item.command_result === "deferred").length,
    by_validation_status: countBy(validationItems, "validation_status"),
    by_receipt_status: countBy(validationItems, "receipt_status"),
    by_command_kind: countBy(validationItems, "command_kind"),
  };
}

function renderValidationMarkdown(validation) {
  const lines = [];
  lines.push("# Human Review Cycle Receipt Completion Command Receipt Validation");
  lines.push("");
  lines.push(`Generated: ${validation.generated_at}`);
  lines.push(`Validation status: ${validation.validation_status}`);
  lines.push("");
  lines.push(`- Validation items: ${validation.summary.validation_item_count}`);
  lines.push(`- Ready to confirm: ${validation.summary.ready_to_confirm_count}`);
  lines.push(`- Pending receipts: ${validation.summary.pending_receipt_count}`);
  lines.push(`- Invalid receipts: ${validation.summary.invalid_receipt_count}`);
  lines.push(`- Errors: ${validation.summary.error_count}`);
  lines.push("");
  lines.push("## Items");
  lines.push("");
  for (const item of validation.validation_items) {
    lines.push(`- ${item.step_key}: ${item.validation_status} (${item.receipt_status}, ${item.command_result})`);
  }
  if (validation.validation_items.length === 0) lines.push("- No command receipt validation items.");
  return `${lines.join("\n")}\n`;
}

function serializableValidation(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    validation_id: result.validation_id,
    output_dir: result.output_dir,
    validation_status: result.validation_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    validation_items: result.validation_items,
    receipt_errors: result.receipt_errors,
    validated_command_receipts: result.validated_command_receipts,
  };
}

function error(queueItemId, field, message) {
  return {
    queue_item_id: queueItemId,
    field,
    message,
  };
}

function normalizeReceiptStatus(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  return normalized === "" ? "pending" : normalized;
}

function normalizeCommandResult(value) {
  const normalized = String(value ?? "not_run").trim().toLowerCase();
  return normalized === "" ? "not_run" : normalized;
}

async function readJsonOrError(filePath) {
  if (!filePath) return { ok: false, value: null, error: "disabled" };
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error_) {
    return {
      ok: false,
      value: null,
      error: error_.code === "ENOENT" ? "not_found" : error_.message,
    };
  }
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

function dateStamp(value) {
  return value.replaceAll(":", "").replaceAll(".", "").replace("T", ".").replace("Z", "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--command-receipts") args.commandReceiptsPath = argv[++index];
    else if (arg === "--receipt-input") args.receiptInputPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-command-receipt-validation.mjs [options]

Options:
  --command-receipts <path> Human Review Cycle Receipt Completion Command Receipts artifact
  --receipt-input <path>    Receipt input file to validate
  --out-dir <dir>           Output directory
  --run-at <iso>            Override generated_at
  --check                   Exit non-zero when command receipt validation has errors
`);
}
