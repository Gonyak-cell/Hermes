import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POST_DELIVERY_RECONCILIATION_OUT_DIR = "artifacts/post-delivery-reconciliation/latest";
export const DEFAULT_DELIVERY_RECEIPT_LEDGER_PATH = "artifacts/delivery-receipts/latest/delivery-receipt-ledger.json";
export const DEFAULT_RECONCILED_DELIVERY_QUEUE_PATH = "artifacts/delivery-receipts/latest/patched-delivery-queue.json";
export const DEFAULT_RECONCILED_OUTPUT_CATALOG_PATH = "artifacts/delivery-receipts/latest/patched-output-catalog.json";

export async function runPostDeliveryReconciliation(options = {}) {
  const result = await buildPostDeliveryReconciliation(options);
  if (options.write !== false) await writePostDeliveryReconciliation(result, result.output_dir);
  return result;
}

export async function buildPostDeliveryReconciliation(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_POST_DELIVERY_RECONCILIATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const receiptLedgerPath = path.resolve(options.receiptLedgerPath ?? DEFAULT_DELIVERY_RECEIPT_LEDGER_PATH);
  const deliveryQueuePath = options.deliveryQueuePath === false
    ? null
    : path.resolve(options.deliveryQueuePath ?? DEFAULT_RECONCILED_DELIVERY_QUEUE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_RECONCILED_OUTPUT_CATALOG_PATH);
  const receiptLedgerResult = await readJsonOrError(receiptLedgerPath);
  const deliveryQueueResult = deliveryQueuePath ? await readJsonOrError(deliveryQueuePath) : { ok: false, value: null, error: "disabled" };
  const outputCatalogResult = outputCatalogPath ? await readJsonOrError(outputCatalogPath) : { ok: false, value: null, error: "disabled" };
  const matterMap = new Map();

  addOutputArtifacts(matterMap, outputCatalogResult.value);
  addDeliveryActions(matterMap, deliveryQueueResult.value);
  addReceiptLedger(matterMap, receiptLedgerResult.value);

  const reconciledMatters = [...matterMap.values()]
    .map(finalizeMatter)
    .sort((left, right) => left.matter_id.localeCompare(right.matter_id) || left.tenant_id.localeCompare(right.tenant_id));
  const deliveredArtifacts = (outputCatalogResult.value?.artifacts ?? [])
    .filter((artifact) => artifact.delivery_state === "delivered" || artifact.status === "delivered")
    .map(toDeliveredArtifact)
    .sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
  const outstandingReceipts = receiptLedgerResult.value?.pending_receipts ?? [];
  const reconciliation = {
    schema_version: "post-delivery-reconciliation.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary: summarizeReconciliation(receiptLedgerResult, deliveryQueueResult, outputCatalogResult, reconciledMatters, deliveredArtifacts, outstandingReceipts),
    sources: [
      buildSource("delivery_receipt_ledger", "Delivery Receipt Ledger", receiptLedgerPath, receiptLedgerResult),
      buildSource("delivery_queue", "Receipt-Patched Delivery Queue", deliveryQueuePath, deliveryQueueResult),
      buildSource("output_catalog", "Receipt-Patched Output Catalog", outputCatalogPath, outputCatalogResult),
    ],
    reconciled_matters: reconciledMatters,
    delivered_artifacts: deliveredArtifacts,
    outstanding_receipts: outstandingReceipts,
  };

  return {
    ...reconciliation,
    markdown: renderPostDeliveryReconciliationMarkdown(reconciliation),
  };
}

export async function writePostDeliveryReconciliation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "post-delivery-reconciliation.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    reconciled_matters: result.reconciled_matters,
    delivered_artifacts: result.delivered_artifacts,
    outstanding_receipts: result.outstanding_receipts,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPostDeliveryReconciliationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runPostDeliveryReconciliation(args);
  console.log(`Post-delivery reconciliation written to ${result.output_dir}`);
  console.log(`Reconciled matters: ${result.summary.reconciled_matter_count}`);
  console.log(`Delivered artifacts: ${result.summary.delivered_artifact_count}`);
  console.log(`Outstanding receipts: ${result.summary.outstanding_receipt_count}`);
}

function addOutputArtifacts(matterMap, outputCatalog) {
  if (!outputCatalog) return;
  for (const artifact of outputCatalog.artifacts ?? []) {
    const record = ensureMatter(matterMap, artifact.tenant_id, artifact.matter_id);
    record.domain_packs.add(artifact.domain_pack);
    record.output_artifact_ids.add(artifact.artifact_id);
    record.approved_artifact_count += artifact.status === "approved" ? 1 : 0;
    record.delivered_artifact_count += artifact.status === "delivered" || artifact.delivery_state === "delivered" ? 1 : 0;
    record.ready_artifact_count += artifact.delivery_state === "ready_for_delivery" ? 1 : 0;
    record.blocked_artifact_count += artifact.delivery_state?.startsWith("blocked_") ? 1 : 0;
    record.latest_activity_at = latest(record.latest_activity_at, artifact.created_at);
  }
}

function addDeliveryActions(matterMap, deliveryQueue) {
  if (!deliveryQueue) return;
  for (const action of deliveryQueue.delivery_actions ?? []) {
    const record = ensureMatter(matterMap, action.tenant_id, action.matter_id);
    record.domain_packs.add(action.domain_pack);
    record.delivery_action_ids.add(action.delivery_action_id);
    record.delivery_channels.add(action.delivery_channel);
    record.ready_delivery_count += action.delivery_status === "ready_for_delivery" ? 1 : 0;
    record.delivered_delivery_count += action.delivery_status === "delivered" ? 1 : 0;
    record.blocked_delivery_count += action.delivery_status?.startsWith("blocked_") || action.delivery_status === "draft_only" ? 1 : 0;
    record.latest_activity_at = latest(record.latest_activity_at, action.created_at);
  }
}

function addReceiptLedger(matterMap, receiptLedger) {
  if (!receiptLedger) return;
  for (const receipt of receiptLedger.applied_receipts ?? []) {
    const record = ensureMatter(matterMap, inferTenantFromReceipt(receipt), receipt.matter_id);
    record.delivery_channels.add(receipt.delivery_channel);
    record.applied_receipt_count += 1;
    record.delivered_receipt_count += receipt.receipt_status === "delivered" ? 1 : 0;
    record.failed_receipt_count += receipt.receipt_status === "failed" ? 1 : 0;
    record.cancelled_receipt_count += receipt.receipt_status === "cancelled" ? 1 : 0;
    record.receipt_artifact_ids = new Set([...record.receipt_artifact_ids, ...(receipt.artifact_ids ?? [])]);
    record.latest_activity_at = latest(record.latest_activity_at, receipt.executed_at);
  }
  for (const pending of receiptLedger.pending_receipts ?? []) {
    const record = ensureMatter(matterMap, pending.tenant_id, pending.matter_id);
    record.delivery_channels.add(pending.delivery_channel);
    record.pending_receipt_count += 1;
    record.receipt_artifact_ids = new Set([...record.receipt_artifact_ids, ...(pending.artifact_ids ?? [])]);
  }
}

function ensureMatter(matterMap, tenantId, matterId) {
  const normalizedTenantId = tenantId ?? "tenant.unknown";
  const normalizedMatterId = matterId ?? "matter.unknown";
  const matterKey = `${normalizedTenantId}:${normalizedMatterId}`;
  if (!matterMap.has(matterKey)) {
    matterMap.set(matterKey, {
      matter_key: matterKey,
      tenant_id: normalizedTenantId,
      matter_id: normalizedMatterId,
      domain_packs: new Set(),
      delivery_channels: new Set(),
      output_artifact_ids: new Set(),
      delivery_action_ids: new Set(),
      receipt_artifact_ids: new Set(),
      approved_artifact_count: 0,
      delivered_artifact_count: 0,
      ready_artifact_count: 0,
      blocked_artifact_count: 0,
      ready_delivery_count: 0,
      delivered_delivery_count: 0,
      blocked_delivery_count: 0,
      applied_receipt_count: 0,
      delivered_receipt_count: 0,
      failed_receipt_count: 0,
      cancelled_receipt_count: 0,
      pending_receipt_count: 0,
      latest_activity_at: null,
    });
  }
  return matterMap.get(matterKey);
}

function finalizeMatter(record) {
  return {
    matter_key: record.matter_key,
    tenant_id: record.tenant_id,
    matter_id: record.matter_id,
    status: deriveReconciledMatterStatus(record),
    domain_packs: [...record.domain_packs].filter(Boolean).sort(),
    delivery_channels: [...record.delivery_channels].filter(Boolean).sort(),
    output_artifact_count: record.output_artifact_ids.size,
    delivery_action_count: record.delivery_action_ids.size,
    receipt_artifact_count: record.receipt_artifact_ids.size,
    approved_artifact_count: record.approved_artifact_count,
    delivered_artifact_count: record.delivered_artifact_count,
    ready_artifact_count: record.ready_artifact_count,
    blocked_artifact_count: record.blocked_artifact_count,
    ready_delivery_count: record.ready_delivery_count,
    delivered_delivery_count: record.delivered_delivery_count,
    blocked_delivery_count: record.blocked_delivery_count,
    applied_receipt_count: record.applied_receipt_count,
    delivered_receipt_count: record.delivered_receipt_count,
    failed_receipt_count: record.failed_receipt_count,
    cancelled_receipt_count: record.cancelled_receipt_count,
    pending_receipt_count: record.pending_receipt_count,
    latest_activity_at: record.latest_activity_at,
    output_artifact_ids: [...record.output_artifact_ids].sort(),
    delivery_action_ids: [...record.delivery_action_ids].sort(),
    receipt_artifact_ids: [...record.receipt_artifact_ids].sort(),
  };
}

function deriveReconciledMatterStatus(record) {
  if (record.blocked_delivery_count > 0 || record.failed_receipt_count > 0) return "blocked";
  if (record.pending_receipt_count > 0) return "awaiting_receipt";
  if (record.ready_delivery_count > 0 || record.ready_artifact_count > 0) return "ready_for_delivery";
  if (record.delivered_artifact_count > 0 || record.delivered_delivery_count > 0 || record.delivered_receipt_count > 0) return "delivered";
  return "active";
}

function summarizeReconciliation(receiptLedgerResult, deliveryQueueResult, outputCatalogResult, matters, deliveredArtifacts, outstandingReceipts) {
  return {
    receipt_ledger_available: receiptLedgerResult.ok,
    delivery_queue_available: deliveryQueueResult.ok,
    output_catalog_available: outputCatalogResult.ok,
    reconciled_matter_count: matters.length,
    delivered_matter_count: matters.filter((matter) => matter.status === "delivered").length,
    ready_matter_count: matters.filter((matter) => matter.status === "ready_for_delivery").length,
    awaiting_receipt_matter_count: matters.filter((matter) => matter.status === "awaiting_receipt").length,
    blocked_matter_count: matters.filter((matter) => matter.status === "blocked").length,
    delivered_artifact_count: deliveredArtifacts.length,
    ready_artifact_count: sumBy(matters, "ready_artifact_count"),
    ready_delivery_count: sumBy(matters, "ready_delivery_count"),
    delivered_delivery_count: sumBy(matters, "delivered_delivery_count"),
    applied_receipt_count: sumBy(matters, "applied_receipt_count"),
    outstanding_receipt_count: outstandingReceipts.length,
    receipt_error_count: receiptLedgerResult.value?.receipt_errors?.length ?? 0,
    by_status: countBy(matters, "status"),
    by_primary_domain_pack: countPrimaryDomainPacks(matters),
  };
}

function toDeliveredArtifact(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    artifact_uri: artifact.artifact_uri,
    tenant_id: artifact.tenant_id,
    matter_id: artifact.matter_id,
    domain_pack: artifact.domain_pack,
    delivery_state: artifact.delivery_state,
    status: artifact.status,
    approval_status: artifact.approval_status ?? null,
    delivery_reference: artifact.metadata?.delivery_receipt?.delivery_reference ?? "",
    delivered_at: artifact.metadata?.delivery_receipt?.executed_at ?? null,
    delivered_by: artifact.metadata?.delivery_receipt?.executed_by ?? null,
  };
}

function renderPostDeliveryReconciliationMarkdown(reconciliation) {
  const lines = [];
  lines.push("# Post-Delivery Reconciliation");
  lines.push("");
  lines.push(`Generated: ${reconciliation.generated_at}`);
  lines.push("");
  lines.push(`- Reconciled matters: ${reconciliation.summary.reconciled_matter_count}`);
  lines.push(`- Delivered matters: ${reconciliation.summary.delivered_matter_count}`);
  lines.push(`- Ready matters: ${reconciliation.summary.ready_matter_count}`);
  lines.push(`- Awaiting receipt matters: ${reconciliation.summary.awaiting_receipt_matter_count}`);
  lines.push(`- Delivered artifacts: ${reconciliation.summary.delivered_artifact_count}`);
  lines.push(`- Outstanding receipts: ${reconciliation.summary.outstanding_receipt_count}`);
  lines.push("");
  lines.push("## Matters");
  lines.push("");
  for (const matter of reconciliation.reconciled_matters) {
    lines.push(`- ${matter.matter_id}: ${matter.status} (${matter.delivered_artifact_count} delivered, ${matter.ready_delivery_count} ready)`);
  }
  if (reconciliation.reconciled_matters.length === 0) lines.push("- No reconciled matters found.");
  return `${lines.join("\n")}\n`;
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

function inferTenantFromReceipt(receipt) {
  return receipt.tenant_id ?? "tenant.unknown";
}

function latest(left, right) {
  if (!right) return left;
  if (!left) return right;
  return right > left ? right : left;
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

function countPrimaryDomainPacks(matters) {
  const counts = new Map();
  for (const matter of matters) {
    const value = matter.domain_packs[0] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function parseArgs(argv) {
  const parsed = {
    receiptLedgerPath: DEFAULT_DELIVERY_RECEIPT_LEDGER_PATH,
    deliveryQueuePath: DEFAULT_RECONCILED_DELIVERY_QUEUE_PATH,
    outputCatalogPath: DEFAULT_RECONCILED_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_POST_DELIVERY_RECONCILIATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--receipt-ledger") parsed.receiptLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/post-delivery-reconciliation.mjs [options]

Options:
  --receipt-ledger <path>   delivery-receipt-ledger.json path.
  --delivery-queue <path>   receipt-patched delivery queue path.
  --no-delivery-queue       Do not include delivery queue reconciliation.
  --output-catalog <path>   receipt-patched output catalog path.
  --no-output-catalog       Do not include output catalog reconciliation.
  --out-dir <folder>        Output directory.
  --run-at <iso>            Deterministic generated_at timestamp.
  -h, --help                Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
