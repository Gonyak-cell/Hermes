import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_OUT_DIR = "artifacts/delivery-closeout-validation/latest";
export const DEFAULT_DELIVERY_CLOSEOUT_QUEUE_PATH = "artifacts/delivery-closeout/latest/delivery-closeout-queue.json";
export const DEFAULT_CLOSEOUT_RECEIPT_INPUT_PATH = "artifacts/delivery-closeout/latest/receipt-input-draft.json";

const APPLY_RECEIPT_STATUSES = new Set(["delivered", "failed", "cancelled"]);

export async function runDeliveryCloseoutReceiptValidation(options = {}) {
  const result = await buildDeliveryCloseoutReceiptValidation(options);
  if (options.write !== false) await writeDeliveryCloseoutReceiptValidation(result, result.output_dir);
  return result;
}

export async function buildDeliveryCloseoutReceiptValidation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const closeoutQueuePath = path.resolve(options.closeoutQueuePath ?? DEFAULT_DELIVERY_CLOSEOUT_QUEUE_PATH);
  const receiptInputPath = path.resolve(options.receiptInputPath ?? DEFAULT_CLOSEOUT_RECEIPT_INPUT_PATH);
  const closeoutResult = await readJsonOrError(closeoutQueuePath);
  const receiptInputResult = await readJsonOrError(receiptInputPath);
  const closeoutItems = closeoutResult.value?.closeout_items ?? [];
  const receiptInput = receiptInputResult.value;
  const receipts = receiptInput?.receipts ?? [];
  const receiptByPacketId = new Map(receipts.map((receipt) => [receipt.packet_id, receipt]));
  const validationItems = [];
  const receiptErrors = [];

  for (const closeoutItem of closeoutItems) {
    const receipt = receiptByPacketId.get(closeoutItem.packet_id);
    const item = validateCloseoutReceipt(closeoutItem, receipt);
    validationItems.push(item);
    receiptErrors.push(...item.errors);
  }

  const closeoutPacketIds = new Set(closeoutItems.map((item) => item.packet_id));
  for (const receipt of receipts) {
    if (closeoutPacketIds.has(receipt.packet_id)) continue;
    const error = {
      packet_id: receipt.packet_id ?? "unknown",
      field: "packet_id",
      message: "Receipt input references a packet outside the current closeout queue.",
    };
    validationItems.push({
      validation_item_id: `validation.unknown.${slugify(receipt.packet_id)}`,
      packet_id: receipt.packet_id ?? "unknown",
      closeout_item_id: null,
      validation_status: "unknown_packet",
      receipt_status: normalizeReceiptStatus(receipt.receipt_status),
      ready_to_apply: false,
      errors: [error],
      receipt,
    });
    receiptErrors.push(error);
  }

  const readyReceipts = validationItems
    .filter((item) => item.ready_to_apply)
    .map((item) => item.receipt);
  const validatedReceiptsToApply = {
    schema_version: "delivery-receipts-input.v1",
    generated_at: generatedAt,
    execution_plan_id: receiptInput?.execution_plan_id ?? closeoutResult.value?.receipt_input_draft?.execution_plan_id ?? "delivery-execution.unknown",
    instructions: "Validated closeout receipts ready for npm run delivery:receipts -- --receipts <this file>.",
    receipts: readyReceipts,
  };
  const validation = {
    schema_version: "delivery-closeout-receipt-validation.v1",
    generated_at: generatedAt,
    validation_id: `delivery-closeout-receipt-validation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    summary: summarizeValidation(closeoutResult, receiptInputResult, closeoutItems, receipts, validationItems, receiptErrors),
    sources: [
      buildSource("delivery_closeout_queue", "Delivery Closeout Queue", closeoutQueuePath, closeoutResult),
      buildSource("receipt_input", "Closeout Receipt Input", receiptInputPath, receiptInputResult),
    ],
    validation_items: validationItems,
    receipt_errors: receiptErrors,
    validated_receipts_to_apply: validatedReceiptsToApply,
  };

  return {
    ...validation,
    markdown: renderCloseoutReceiptValidationMarkdown(validation),
  };
}

export async function writeDeliveryCloseoutReceiptValidation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "closeout-receipt-validation.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    validation_id: result.validation_id,
    summary: result.summary,
    sources: result.sources,
    validation_items: result.validation_items,
    receipt_errors: result.receipt_errors,
    validated_receipts_to_apply: result.validated_receipts_to_apply,
  });
  await writeJson(path.join(outDir, "validated-receipts-to-apply.json"), result.validated_receipts_to_apply);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeliveryCloseoutReceiptValidationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runDeliveryCloseoutReceiptValidation(args);
  console.log(`Closeout receipt validation written to ${result.output_dir}`);
  console.log(`Ready to apply: ${result.summary.ready_to_apply_count}`);
  console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
  console.log(`Invalid receipts: ${result.summary.invalid_receipt_count}`);
}

function validateCloseoutReceipt(closeoutItem, receipt) {
  const receiptStatus = normalizeReceiptStatus(receipt?.receipt_status);
  const errors = [];
  if (!receipt) {
    errors.push(error(closeoutItem.packet_id, "packet_id", "Missing receipt row for closeout packet."));
    return buildValidationItem(closeoutItem, null, "missing_receipt", receiptStatus, errors);
  }
  if (receiptStatus === "pending") {
    return buildValidationItem(closeoutItem, receipt, "pending_receipt", receiptStatus, errors);
  }
  if (!APPLY_RECEIPT_STATUSES.has(receiptStatus)) {
    errors.push(error(closeoutItem.packet_id, "receipt_status", `Unsupported receipt status: ${receiptStatus}`));
  }
  if (!receipt.executed_by) {
    errors.push(error(closeoutItem.packet_id, "executed_by", "Non-pending closeout receipt must include executed_by."));
  }
  if (!receipt.executed_at) {
    errors.push(error(closeoutItem.packet_id, "executed_at", "Non-pending closeout receipt must include executed_at for audit replay."));
  }
  if (receiptStatus === "delivered" && !receipt.delivery_reference) {
    errors.push(error(closeoutItem.packet_id, "delivery_reference", "Delivered closeout receipt must include delivery_reference."));
  }
  const expectedArtifacts = new Set(closeoutItem.artifact_ids ?? []);
  const receivedArtifacts = new Set(receipt.delivered_artifact_ids ?? []);
  if (!sameSet(expectedArtifacts, receivedArtifacts)) {
    errors.push(error(closeoutItem.packet_id, "delivered_artifact_ids", "Receipt artifact ids must match the closeout packet artifact ids."));
  }
  return buildValidationItem(
    closeoutItem,
    receipt,
    errors.length > 0 ? "invalid_receipt" : "ready_to_apply",
    receiptStatus,
    errors,
  );
}

function buildValidationItem(closeoutItem, receipt, validationStatus, receiptStatus, errors) {
  return {
    validation_item_id: `validation.${slugify(closeoutItem.packet_id)}`,
    closeout_item_id: closeoutItem.closeout_item_id,
    packet_id: closeoutItem.packet_id,
    tenant_id: closeoutItem.tenant_id,
    matter_id: closeoutItem.matter_id,
    delivery_channel: closeoutItem.delivery_channel,
    delivery_target: closeoutItem.delivery_target,
    priority: closeoutItem.priority,
    primary_domain_pack: closeoutItem.primary_domain_pack,
    validation_status: validationStatus,
    receipt_status: receiptStatus,
    ready_to_apply: validationStatus === "ready_to_apply",
    error_count: errors.length,
    artifact_ids: closeoutItem.artifact_ids ?? [],
    errors,
    receipt: receipt ?? null,
  };
}

function summarizeValidation(closeoutResult, receiptInputResult, closeoutItems, receipts, validationItems, receiptErrors) {
  return {
    closeout_queue_available: closeoutResult.ok,
    receipt_input_available: receiptInputResult.ok,
    closeout_item_count: closeoutItems.length,
    receipt_count: receipts.length,
    ready_to_apply_count: validationItems.filter((item) => item.validation_status === "ready_to_apply").length,
    pending_receipt_count: validationItems.filter((item) => item.validation_status === "pending_receipt").length,
    missing_receipt_count: validationItems.filter((item) => item.validation_status === "missing_receipt").length,
    invalid_receipt_count: validationItems.filter((item) => item.validation_status === "invalid_receipt").length,
    unknown_packet_count: validationItems.filter((item) => item.validation_status === "unknown_packet").length,
    error_count: receiptErrors.length,
    fully_ready_to_apply: closeoutItems.length > 0
      && validationItems.filter((item) => item.closeout_item_id).every((item) => item.validation_status === "ready_to_apply")
      && receiptErrors.length === 0,
    by_status: countBy(validationItems, "validation_status"),
    by_receipt_status: countBy(validationItems, "receipt_status"),
    by_delivery_channel: countBy(validationItems, "delivery_channel"),
    by_primary_domain_pack: countBy(validationItems, "primary_domain_pack"),
  };
}

function renderCloseoutReceiptValidationMarkdown(validation) {
  const lines = [];
  lines.push("# Delivery Closeout Receipt Validation");
  lines.push("");
  lines.push(`Generated: ${validation.generated_at}`);
  lines.push("");
  lines.push(`- Closeout items: ${validation.summary.closeout_item_count}`);
  lines.push(`- Ready to apply: ${validation.summary.ready_to_apply_count}`);
  lines.push(`- Pending receipts: ${validation.summary.pending_receipt_count}`);
  lines.push(`- Invalid receipts: ${validation.summary.invalid_receipt_count}`);
  lines.push(`- Errors: ${validation.summary.error_count}`);
  lines.push("");
  lines.push("## Validation Items");
  lines.push("");
  for (const item of validation.validation_items) {
    lines.push(`- ${item.packet_id}: ${item.validation_status} (${item.receipt_status})`);
  }
  if (validation.validation_items.length === 0) lines.push("- No closeout receipt validation items.");
  return `${lines.join("\n")}\n`;
}

function error(packetId, field, message) {
  return {
    packet_id: packetId,
    field,
    message,
  };
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function normalizeReceiptStatus(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  return normalized === "" ? "pending" : normalized;
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}

function parseArgs(argv) {
  const parsed = {
    closeoutQueuePath: DEFAULT_DELIVERY_CLOSEOUT_QUEUE_PATH,
    receiptInputPath: DEFAULT_CLOSEOUT_RECEIPT_INPUT_PATH,
    outDir: DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--closeout-queue") parsed.closeoutQueuePath = argv[++index];
    else if (arg === "--receipt-input" || arg === "--receipts") parsed.receiptInputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/delivery-closeout-receipt-validation.mjs [options]

Options:
  --closeout-queue <path>  delivery-closeout-queue.json path.
  --receipt-input <path>   filled or pending delivery-receipts-input.v1 path.
  --out-dir <folder>       Output directory.
  --run-at <iso>           Deterministic generated_at timestamp.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
