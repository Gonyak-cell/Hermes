import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH,
  DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH,
  DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH,
  buildDeliveryReceipts,
} from "./delivery-receipts.mjs";

export const DEFAULT_CLOSEOUT_RECEIPT_APPLICATION_OUT_DIR = "artifacts/delivery-closeout-application/latest";
export const DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_PATH = "artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json";

export async function runDeliveryCloseoutReceiptApplication(options = {}) {
  const result = await buildDeliveryCloseoutReceiptApplication(options);
  if (options.write !== false) await writeDeliveryCloseoutReceiptApplication(result, result.output_dir);
  return result;
}

export async function buildDeliveryCloseoutReceiptApplication(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLOSEOUT_RECEIPT_APPLICATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const validationPath = path.resolve(options.validationPath ?? DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_PATH);
  const executionDraftPath = path.resolve(options.executionDraftPath ?? DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH);
  const deliveryQueuePath = options.deliveryQueuePath === false
    ? null
    : path.resolve(options.deliveryQueuePath ?? DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH);
  const validationResult = await readJsonOrError(validationPath);
  const validation = validationResult.value;
  const validatedReceipts = validation?.validated_receipts_to_apply ?? {
    schema_version: "delivery-receipts-input.v1",
    generated_at: generatedAt,
    execution_plan_id: "delivery-execution.unknown",
    instructions: "No validated closeout receipts were available.",
    receipts: [],
  };
  const validationErrors = validation?.summary?.error_count ?? validation?.receipt_errors?.length ?? 0;
  const readyReceiptCount = validatedReceipts.receipts?.length ?? 0;
  const applicationStatus = deriveApplicationStatus(validationResult, validationErrors, readyReceiptCount);
  const canApply = applicationStatus === "applied";
  const deliveryReceiptLedger = canApply
    ? await buildDeliveryReceipts({
      executionDraftPath,
      receiptsInput: validatedReceipts,
      receiptsSourcePath: `${validationPath}#validated_receipts_to_apply`,
      deliveryQueuePath,
      outputCatalogPath,
      outDir: outputDir,
      runAt: generatedAt,
    })
    : null;
  const summary = summarizeApplication({
    validationResult,
    validation,
    validationErrors,
    readyReceiptCount,
    applicationStatus,
    deliveryReceiptLedger,
  });
  const application = {
    schema_version: "delivery-closeout-receipt-application.v1",
    generated_at: generatedAt,
    application_id: `delivery-closeout-receipt-application.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    application_status: applicationStatus,
    safe_to_apply: canApply,
    summary,
    sources: [
      buildSource("closeout_receipt_validation", "Closeout Receipt Validation", validationPath, validationResult),
      buildSource("delivery_execution_draft", "Delivery Execution Draft", executionDraftPath, deliveryReceiptLedger?.sources?.find((source) => source.source_id === "delivery_execution_draft")),
      buildSource("delivery_queue", "Patched Delivery Queue", deliveryQueuePath, deliveryReceiptLedger?.sources?.find((source) => source.source_id === "delivery_queue")),
      buildSource("output_catalog", "Patched Output Catalog", outputCatalogPath, deliveryReceiptLedger?.sources?.find((source) => source.source_id === "output_catalog")),
    ],
    validated_receipts_to_apply: validatedReceipts,
    applied_receipts: deliveryReceiptLedger?.applied_receipts ?? [],
    pending_receipts: deliveryReceiptLedger?.pending_receipts ?? [],
    receipt_errors: [
      ...(validation?.receipt_errors ?? []),
      ...(deliveryReceiptLedger?.receipt_errors ?? []),
    ],
    audit_events: deliveryReceiptLedger?.audit_events ?? [],
    delivery_receipt_ledger: deliveryReceiptLedger ? stripRuntimeOnlyFields(deliveryReceiptLedger) : null,
    patched_delivery_queue: deliveryReceiptLedger?.patched_delivery_queue ?? null,
    patched_output_catalog: deliveryReceiptLedger?.patched_output_catalog ?? null,
  };

  return {
    ...application,
    markdown: renderCloseoutReceiptApplicationMarkdown(application),
  };
}

export async function writeDeliveryCloseoutReceiptApplication(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "closeout-receipt-application.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    application_id: result.application_id,
    application_status: result.application_status,
    safe_to_apply: result.safe_to_apply,
    summary: result.summary,
    sources: result.sources,
    validated_receipts_to_apply: result.validated_receipts_to_apply,
    applied_receipts: result.applied_receipts,
    pending_receipts: result.pending_receipts,
    receipt_errors: result.receipt_errors,
    audit_events: result.audit_events,
    delivery_receipt_ledger: result.delivery_receipt_ledger,
    patched_delivery_queue: result.patched_delivery_queue,
    patched_output_catalog: result.patched_output_catalog,
  });
  await writeJson(path.join(outDir, "validated-receipts-to-apply.json"), result.validated_receipts_to_apply);
  if (result.delivery_receipt_ledger) await writeJson(path.join(outDir, "delivery-receipt-ledger.json"), result.delivery_receipt_ledger);
  if (result.patched_delivery_queue) await writeJson(path.join(outDir, "patched-delivery-queue.json"), result.patched_delivery_queue);
  if (result.patched_output_catalog) await writeJson(path.join(outDir, "patched-output-catalog.json"), result.patched_output_catalog);
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeliveryCloseoutReceiptApplicationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runDeliveryCloseoutReceiptApplication(args);
  console.log(`Closeout receipt application written to ${result.output_dir}`);
  console.log(`Application status: ${result.application_status}`);
  console.log(`Applied receipts: ${result.summary.applied_receipt_count}`);
  console.log(`Delivered artifacts: ${result.summary.delivered_artifact_count}`);
}

function deriveApplicationStatus(validationResult, validationErrors, readyReceiptCount) {
  if (!validationResult.ok) return "blocked_missing_validation";
  if (validationErrors > 0) return "blocked_validation_errors";
  if (readyReceiptCount === 0) return "nothing_to_apply";
  return "applied";
}

function summarizeApplication(context) {
  const ledgerSummary = context.deliveryReceiptLedger?.summary ?? {};
  return {
    validation_available: context.validationResult.ok,
    validation_error_count: context.validationErrors,
    closeout_item_count: context.validation?.summary?.closeout_item_count ?? 0,
    ready_receipt_count: context.readyReceiptCount,
    pending_receipt_count: context.validation?.summary?.pending_receipt_count ?? 0,
    invalid_receipt_count: context.validation?.summary?.invalid_receipt_count ?? 0,
    application_status: context.applicationStatus,
    applied_receipt_count: ledgerSummary.applied_receipt_count ?? 0,
    pending_application_receipt_count: ledgerSummary.pending_receipt_count ?? 0,
    delivered_packet_count: ledgerSummary.delivered_packet_count ?? 0,
    delivered_artifact_count: ledgerSummary.delivered_artifact_count ?? 0,
    failed_packet_count: ledgerSummary.failed_packet_count ?? 0,
    cancelled_packet_count: ledgerSummary.cancelled_packet_count ?? 0,
    audit_event_count: ledgerSummary.audit_event_count ?? 0,
    receipt_error_count: (context.validation?.receipt_errors?.length ?? 0) + (context.deliveryReceiptLedger?.receipt_errors?.length ?? 0),
    patched_delivery_delivered_count: ledgerSummary.patched_delivery_delivered_count ?? 0,
    patched_output_delivered_count: ledgerSummary.patched_output_delivered_count ?? 0,
    by_receipt_status: ledgerSummary.by_receipt_status ?? {},
    by_delivery_channel: ledgerSummary.by_delivery_channel ?? {},
    by_delivery_target: ledgerSummary.by_delivery_target ?? {},
  };
}

function renderCloseoutReceiptApplicationMarkdown(application) {
  const lines = [];
  lines.push("# Delivery Closeout Receipt Application");
  lines.push("");
  lines.push(`Generated: ${application.generated_at}`);
  lines.push(`Application status: ${application.application_status}`);
  lines.push("");
  lines.push(`- Ready receipts: ${application.summary.ready_receipt_count}`);
  lines.push(`- Applied receipts: ${application.summary.applied_receipt_count}`);
  lines.push(`- Delivered artifacts: ${application.summary.delivered_artifact_count}`);
  lines.push(`- Validation errors: ${application.summary.validation_error_count}`);
  lines.push(`- Audit events: ${application.summary.audit_event_count}`);
  lines.push("");
  lines.push("## Applied Receipts");
  lines.push("");
  for (const receipt of application.applied_receipts) {
    lines.push(`- ${receipt.packet_id}: ${receipt.receipt_status} (${receipt.artifact_ids.length} artifact(s))`);
  }
  if (application.applied_receipts.length === 0) lines.push("- No closeout receipts applied.");
  return `${lines.join("\n")}\n`;
}

function buildSource(sourceId, label, sourcePath, sourceResult = null) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: Boolean(sourceResult?.ok ?? sourceResult?.available),
    schema_version: sourceResult?.value?.schema_version ?? sourceResult?.schema_version ?? null,
    generated_at: sourceResult?.value?.generated_at ?? sourceResult?.generated_at ?? null,
    summary: sourceResult?.value?.summary ?? sourceResult?.summary ?? null,
    error: sourceResult?.ok === false ? sourceResult.error : sourceResult?.error ?? null,
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

function stripRuntimeOnlyFields(ledger) {
  const { markdown, output_dir, ...artifact } = ledger;
  return artifact;
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    validationPath: DEFAULT_CLOSEOUT_RECEIPT_VALIDATION_PATH,
    executionDraftPath: DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH,
    deliveryQueuePath: DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH,
    outputCatalogPath: DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_CLOSEOUT_RECEIPT_APPLICATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--validation") parsed.validationPath = argv[++index];
    else if (arg === "--execution-draft") parsed.executionDraftPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--no-delivery-queue") parsed.deliveryQueuePath = false;
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputCatalogPath = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/delivery-closeout-receipt-application.mjs [options]

Options:
  --validation <path>        closeout-receipt-validation.json path.
  --execution-draft <path>   delivery-execution-draft.json path.
  --delivery-queue <path>    patched-delivery-queue.json to patch.
  --no-delivery-queue        Do not write patched delivery queue.
  --output-catalog <path>    patched-output-catalog.json to patch.
  --no-output-catalog        Do not write patched output catalog.
  --out-dir <folder>         Output directory.
  --run-at <iso>             Deterministic generated_at timestamp.
  -h, --help                 Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
