import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DELIVERY_RECEIPTS_OUT_DIR = "artifacts/delivery-receipts/latest";
export const DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH = "artifacts/delivery-execution/latest/delivery-execution-draft.json";
export const DEFAULT_DELIVERY_RECEIPTS_PATH = "artifacts/delivery-receipts/latest/receipt-template.json";
export const DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH = "artifacts/approval-inbox-decisions/latest/patched-delivery-queue.json";
export const DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH = "artifacts/approval-inbox-decisions/latest/patched-output-catalog.json";

const APPLIED_RECEIPT_STATUSES = new Set(["delivered", "failed", "cancelled"]);
const DELIVERED_RECEIPT_STATUSES = new Set(["delivered"]);
const FAILED_RECEIPT_STATUSES = new Set(["failed"]);
const CANCELLED_RECEIPT_STATUSES = new Set(["cancelled"]);

export async function runDeliveryReceipts(options = {}) {
  const result = await buildDeliveryReceipts(options);
  if (options.write !== false) await writeDeliveryReceipts(result, result.output_dir);
  return result;
}

export async function buildDeliveryReceipts(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DELIVERY_RECEIPTS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const executionDraftPath = path.resolve(options.executionDraftPath ?? DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH);
  const receiptsPath = options.receiptsPath === false ? null : path.resolve(options.receiptsPath ?? DEFAULT_DELIVERY_RECEIPTS_PATH);
  const deliveryQueuePath = options.deliveryQueuePath === false
    ? null
    : path.resolve(options.deliveryQueuePath ?? DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH);
  const executionDraft = JSON.parse(await readFile(executionDraftPath, "utf8"));
  const receiptsResult = receiptsPath ? await readJsonOrError(receiptsPath) : { ok: false, value: null, error: "disabled" };
  const deliveryQueue = deliveryQueuePath ? await readJsonIfExists(deliveryQueuePath) : null;
  const outputCatalog = outputCatalogPath ? await readJsonIfExists(outputCatalogPath) : null;
  const patchedDeliveryQueue = deliveryQueue ? structuredClone(deliveryQueue) : null;
  const patchedOutputCatalog = outputCatalog ? structuredClone(outputCatalog) : null;
  const packetById = new Map((executionDraft.execution_packets ?? []).map((packet) => [packet.packet_id, packet]));
  const receiptByPacketId = new Map((receiptsResult.value?.receipts ?? []).map((receipt) => [receipt.packet_id, receipt]));
  const receiptTemplate = buildReceiptTemplate(generatedAt, executionDraft);
  const receiptErrors = validateReceipts(receiptsResult.value, packetById);
  const erroredPacketIds = new Set(receiptErrors.map((error) => error.packet_id));
  const appliedReceipts = [];
  const pendingReceipts = [];
  const auditEvents = [];

  for (const packet of executionDraft.execution_packets ?? []) {
    const receipt = receiptByPacketId.get(packet.packet_id);
    const receiptStatus = normalizeReceiptStatus(receipt?.receipt_status);
    if (!receipt || receiptStatus === "pending") {
      pendingReceipts.push(toPendingReceipt(packet, receipt));
      continue;
    }
    if (erroredPacketIds.has(packet.packet_id)) {
      pendingReceipts.push(toPendingReceipt(packet, receipt, "receipt_error"));
      continue;
    }

    const applied = applyReceipt(packet, receipt, {
      receiptStatus,
      generatedAt,
      patchedDeliveryQueue,
      patchedOutputCatalog,
    });
    appliedReceipts.push(applied);
    auditEvents.push(buildReceiptAuditEvent(executionDraft, packet, receipt, receiptStatus, generatedAt));
  }

  if (patchedDeliveryQueue) {
    patchedDeliveryQueue.generated_at = generatedAt;
    patchedDeliveryQueue.summary = summarizeDeliveryQueue(patchedDeliveryQueue);
  }
  if (patchedOutputCatalog) {
    patchedOutputCatalog.generated_at = generatedAt;
    patchedOutputCatalog.summary = summarizeOutputCatalog(patchedOutputCatalog);
  }

  const result = {
    schema_version: "delivery-receipt-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `delivery-receipts.${dateStamp(generatedAt)}`,
    source_execution_draft: executionDraftPath,
    source_receipts: receiptsPath,
    source_delivery_queue: deliveryQueuePath,
    source_output_catalog: outputCatalogPath,
    output_dir: outputDir,
    summary: summarizeReceiptLedger(executionDraft, receiptsResult, appliedReceipts, pendingReceipts, receiptErrors, patchedDeliveryQueue, patchedOutputCatalog),
    sources: [
      buildSource("delivery_execution_draft", "Delivery Execution Draft", executionDraftPath, { ok: true, value: executionDraft, error: null }),
      buildSource("delivery_receipts", "Delivery Receipt Input", receiptsPath, receiptsResult),
      buildSource("delivery_queue", "Patched Delivery Queue", deliveryQueuePath, deliveryQueue ? { ok: true, value: deliveryQueue, error: null } : { ok: false, value: null, error: deliveryQueuePath ? "not_found" : "disabled" }),
      buildSource("output_catalog", "Patched Output Catalog", outputCatalogPath, outputCatalog ? { ok: true, value: outputCatalog, error: null } : { ok: false, value: null, error: outputCatalogPath ? "not_found" : "disabled" }),
    ],
    receipt_template: receiptTemplate,
    applied_receipts: appliedReceipts,
    pending_receipts: pendingReceipts,
    audit_events: auditEvents,
    patched_delivery_queue: patchedDeliveryQueue,
    patched_output_catalog: patchedOutputCatalog,
    receipt_errors: receiptErrors,
  };

  return {
    ...result,
    markdown: renderDeliveryReceiptSummary(result),
  };
}

export async function writeDeliveryReceipts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "delivery-receipt-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    source_execution_draft: result.source_execution_draft,
    source_receipts: result.source_receipts,
    source_delivery_queue: result.source_delivery_queue,
    source_output_catalog: result.source_output_catalog,
    summary: result.summary,
    sources: result.sources,
    receipt_template: result.receipt_template,
    applied_receipts: result.applied_receipts,
    pending_receipts: result.pending_receipts,
    audit_events: result.audit_events,
    patched_delivery_queue: result.patched_delivery_queue,
    patched_output_catalog: result.patched_output_catalog,
    receipt_errors: result.receipt_errors,
  });
  await writeJson(path.join(outDir, "receipt-template.json"), result.receipt_template);
  if (result.patched_delivery_queue) {
    await writeJson(path.join(outDir, "patched-delivery-queue.json"), result.patched_delivery_queue);
  }
  if (result.patched_output_catalog) {
    await writeJson(path.join(outDir, "patched-output-catalog.json"), result.patched_output_catalog);
  }
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeliveryReceiptsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runDeliveryReceipts(args);
  console.log(`Delivery receipt ledger written to ${result.output_dir}`);
  console.log(`Applied receipts: ${result.summary.applied_receipt_count}`);
  console.log(`Pending receipts: ${result.summary.pending_receipt_count}`);
  console.log(`Delivered artifacts: ${result.summary.delivered_artifact_count}`);
}

function buildReceiptTemplate(generatedAt, executionDraft) {
  return {
    schema_version: "delivery-receipts-input.v1",
    generated_at: generatedAt,
    execution_plan_id: executionDraft.execution_plan_id,
    instructions: "After manual execution, set receipt_status, executed_by, executed_at, delivery_reference, and notes for each packet. Pending receipts do not patch delivery state.",
    receipts: (executionDraft.execution_packets ?? []).map((packet) => ({
      receipt_id: `receipt.${packet.packet_id}`,
      packet_id: packet.packet_id,
      receipt_status: "pending",
      executed_by: "",
      executed_at: "",
      delivery_reference: "",
      notes: "",
      delivered_artifact_ids: packet.artifact_ids,
    })),
  };
}

function applyReceipt(packet, receipt, context) {
  const deliveryPatches = packet.execution_candidate_ids.map((candidateId, index) => {
    const artifactId = packet.artifact_ids[index] ?? null;
    return context.patchedDeliveryQueue && artifactId
      ? patchDeliveryAction(context.patchedDeliveryQueue, artifactId, receipt, context.receiptStatus)
      : null;
  }).filter(Boolean);
  const outputPatches = packet.artifact_ids.map((artifactId) => (
    context.patchedOutputCatalog
      ? patchOutputArtifact(context.patchedOutputCatalog, artifactId, receipt, context.receiptStatus)
      : null
  )).filter(Boolean);

  return {
    receipt_id: receipt.receipt_id ?? `receipt.${packet.packet_id}`,
    packet_id: packet.packet_id,
    tenant_id: packet.tenant_id,
    delivery_channel: packet.delivery_channel,
    delivery_target: packet.delivery_target,
    matter_id: packet.matter_id,
    priority: packet.priority,
    receipt_status: context.receiptStatus,
    status_after: mapReceiptStatusAfter(context.receiptStatus),
    executed_by: receipt.executed_by ?? null,
    executed_at: receipt.executed_at || context.generatedAt,
    delivery_reference: receipt.delivery_reference ?? "",
    notes: receipt.notes ?? "",
    artifact_ids: packet.artifact_ids,
    delivery_patches: deliveryPatches,
    output_patches: outputPatches,
  };
}

function patchDeliveryAction(queue, artifactId, receipt, receiptStatus) {
  const action = (queue.delivery_actions ?? []).find((candidate) => candidate.artifact_id === artifactId);
  if (!action) {
    return {
      patched: false,
      reason: "delivery_action_not_found",
      artifact_id: artifactId,
    };
  }

  const before = snapshotDeliveryAction(action);
  if (DELIVERED_RECEIPT_STATUSES.has(receiptStatus)) {
    action.delivery_status = "delivered";
    action.protected_action = false;
    action.blocked_reasons = [];
    action.recommended_actions = ["delivery_receipt_recorded"];
  }
  action.metadata = {
    ...(action.metadata ?? {}),
    delivery_receipt: buildReceiptMetadata(receipt, receiptStatus),
  };

  return {
    patched: true,
    delivery_action_id: action.delivery_action_id,
    before,
    after: snapshotDeliveryAction(action),
  };
}

function patchOutputArtifact(catalog, artifactId, receipt, receiptStatus) {
  const artifact = (catalog.artifacts ?? []).find((candidate) => candidate.artifact_id === artifactId);
  if (!artifact) {
    return {
      patched: false,
      reason: "output_artifact_not_found",
      artifact_id: artifactId,
    };
  }

  const before = snapshotOutputArtifact(artifact);
  if (DELIVERED_RECEIPT_STATUSES.has(receiptStatus)) {
    artifact.status = "delivered";
    artifact.delivery_state = "delivered";
  }
  artifact.metadata = {
    ...(artifact.metadata ?? {}),
    delivery_receipt: buildReceiptMetadata(receipt, receiptStatus),
  };

  return {
    patched: true,
    artifact_id: artifact.artifact_id,
    before,
    after: snapshotOutputArtifact(artifact),
  };
}

function validateReceipts(receipts, packetById) {
  const errors = [];
  const seen = new Set();
  for (const receipt of receipts?.receipts ?? []) {
    const packetId = receipt.packet_id;
    const packet = packetById.get(packetId);
    if (seen.has(packetId)) {
      errors.push({
        packet_id: packetId,
        message: "Duplicate receipt for delivery execution packet.",
      });
    }
    seen.add(packetId);
    if (!packet) {
      errors.push({
        packet_id: packetId,
        message: "Receipt references an unknown delivery execution packet.",
      });
      continue;
    }

    const receiptStatus = normalizeReceiptStatus(receipt.receipt_status);
    if (receiptStatus === "pending") continue;
    if (!APPLIED_RECEIPT_STATUSES.has(receiptStatus)) {
      errors.push({
        packet_id: packetId,
        message: `Receipt status ${receiptStatus} is not supported.`,
      });
    }
    if (!receipt.executed_by) {
      errors.push({
        packet_id: packetId,
        message: "Non-pending receipt should include executed_by.",
      });
    }
    if (!receipt.delivery_reference && DELIVERED_RECEIPT_STATUSES.has(receiptStatus)) {
      errors.push({
        packet_id: packetId,
        message: "Delivered receipt should include delivery_reference.",
      });
    }
  }
  return errors;
}

function buildReceiptAuditEvent(executionDraft, packet, receipt, receiptStatus, generatedAt) {
  const eventType = DELIVERED_RECEIPT_STATUSES.has(receiptStatus)
    ? "delivery.executed"
    : FAILED_RECEIPT_STATUSES.has(receiptStatus)
      ? "delivery.failed"
      : CANCELLED_RECEIPT_STATUSES.has(receiptStatus)
        ? "delivery.cancelled"
        : "delivery.receipt_recorded";
  return {
    schema_version: "audit-event.v1",
    id: `event.delivery_receipt.${shortHash(`${executionDraft.execution_plan_id}:${packet.packet_id}:${receiptStatus}`)}`,
    type: eventType,
    time: receipt.executed_at || generatedAt,
    tenant_id: packet.tenant_id,
    actor: {
      actor_type: receipt.executed_by ? "human" : "manual",
      actor_id: receipt.executed_by || "manual.unassigned",
      display_name: receipt.executed_by || "Unassigned Executor",
    },
    subject: {
      subject_type: "delivery_execution_packet",
      subject_id: packet.packet_id,
    },
    correlation_id: executionDraft.execution_plan_id,
    data: {
      packet_id: packet.packet_id,
      receipt_status: receiptStatus,
      delivery_reference: receipt.delivery_reference ?? "",
      artifact_ids: packet.artifact_ids,
      notes: receipt.notes ?? "",
    },
    metadata: {
      delivery_channel: packet.delivery_channel,
      delivery_target: packet.delivery_target,
      matter_id: packet.matter_id,
    },
  };
}

function summarizeReceiptLedger(executionDraft, receiptsResult, appliedReceipts, pendingReceipts, receiptErrors, patchedDeliveryQueue, patchedOutputCatalog) {
  return {
    execution_draft_packet_count: executionDraft.execution_packets?.length ?? 0,
    receipt_input_available: receiptsResult.ok,
    applied_receipt_count: appliedReceipts.length,
    pending_receipt_count: pendingReceipts.length,
    delivered_packet_count: appliedReceipts.filter((receipt) => DELIVERED_RECEIPT_STATUSES.has(receipt.receipt_status)).length,
    failed_packet_count: appliedReceipts.filter((receipt) => FAILED_RECEIPT_STATUSES.has(receipt.receipt_status)).length,
    cancelled_packet_count: appliedReceipts.filter((receipt) => CANCELLED_RECEIPT_STATUSES.has(receipt.receipt_status)).length,
    delivered_artifact_count: appliedReceipts
      .filter((receipt) => DELIVERED_RECEIPT_STATUSES.has(receipt.receipt_status))
      .reduce((count, receipt) => count + receipt.artifact_ids.length, 0),
    audit_event_count: appliedReceipts.length,
    receipt_error_count: receiptErrors.length,
    patched_delivery_delivered_count: patchedDeliveryQueue?.summary?.delivered_action_count ?? 0,
    patched_output_delivered_count: patchedOutputCatalog?.summary?.delivered_count ?? 0,
    by_receipt_status: countBy(appliedReceipts, "receipt_status"),
    by_delivery_channel: countBy(appliedReceipts, "delivery_channel"),
    by_delivery_target: countBy(appliedReceipts, "delivery_target"),
  };
}

function summarizeDeliveryQueue(queue) {
  const actions = queue.delivery_actions ?? [];
  return {
    output_catalog_available: queue.summary?.output_catalog_available ?? false,
    observability_catalog_available: queue.summary?.observability_catalog_available ?? false,
    delivery_action_count: actions.length,
    protected_action_count: actions.filter((action) => action.protected_action).length,
    blocked_action_count: actions.filter((action) => action.delivery_status.startsWith("blocked_") || action.delivery_status === "draft_only").length,
    pending_approval_count: actions.filter((action) => action.delivery_status === "blocked_pending_approval").length,
    blocked_by_gate_count: actions.filter((action) => action.delivery_status === "blocked_by_gate").length,
    ready_action_count: actions.filter((action) => action.delivery_status === "ready_for_delivery").length,
    delivered_action_count: actions.filter((action) => action.delivery_status === "delivered").length,
    law_firm_action_count: actions.filter((action) => action.domain_pack === "law-firm").length,
    personal_dev_action_count: actions.filter((action) => action.domain_pack === "personal-dev").length,
    creative_document_action_count: actions.filter((action) => action.domain_pack === "creative-document").length,
    total_runtime_seconds: actions.reduce((sum, action) => sum + Number(action.runtime_seconds ?? 0), 0),
    by_delivery_status: countBy(actions, "delivery_status"),
    by_delivery_channel: countBy(actions, "delivery_channel"),
    by_delivery_target: countBy(actions, "delivery_target"),
    by_domain_pack: countBy(actions, "domain_pack"),
  };
}

function summarizeOutputCatalog(catalog) {
  const artifacts = catalog.artifacts ?? [];
  return {
    source_count: catalog.sources?.length ?? 0,
    available_source_count: (catalog.sources ?? []).filter((source) => source.available).length,
    missing_source_count: (catalog.sources ?? []).filter((source) => !source.available).length,
    artifact_count: artifacts.length,
    draft_count: artifacts.filter((artifact) => artifact.status === "draft").length,
    pending_review_count: artifacts.filter((artifact) => artifact.status === "pending_review").length,
    approved_count: artifacts.filter((artifact) => artifact.status === "approved").length,
    delivered_count: artifacts.filter((artifact) => artifact.status === "delivered").length,
    approval_pending_count: artifacts.filter((artifact) => artifact.approval_status === "pending").length,
    blocked_delivery_count: artifacts.filter((artifact) => artifact.delivery_state.startsWith("blocked_")).length,
    blocking_gate_count: artifacts.reduce((count, artifact) => count + Number(artifact.blocking_gate_count ?? 0), 0),
    by_artifact_type: countBy(artifacts, "artifact_type"),
    by_domain_pack: countBy(artifacts, "domain_pack"),
    by_delivery_state: countBy(artifacts, "delivery_state"),
  };
}

function renderDeliveryReceiptSummary(result) {
  const lines = [];
  lines.push("# Delivery Receipt Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source execution draft: ${result.source_execution_draft}`);
  lines.push(`Source receipts: ${result.source_receipts ?? "none"}`);
  lines.push("");
  lines.push(`- Execution packets: ${result.summary.execution_draft_packet_count}`);
  lines.push(`- Applied receipts: ${result.summary.applied_receipt_count}`);
  lines.push(`- Pending receipts: ${result.summary.pending_receipt_count}`);
  lines.push(`- Delivered artifacts: ${result.summary.delivered_artifact_count}`);
  lines.push(`- Audit events: ${result.summary.audit_event_count}`);
  lines.push("");
  lines.push("## Applied Receipts");
  lines.push("");
  for (const receipt of result.applied_receipts) {
    lines.push(`- ${receipt.packet_id}: ${receipt.receipt_status} (${receipt.artifact_ids.length} artifact(s))`);
  }
  if (result.applied_receipts.length === 0) lines.push("- No delivery receipts applied.");
  return `${lines.join("\n")}\n`;
}

function toPendingReceipt(packet, receipt, reason = null) {
  return {
    packet_id: packet.packet_id,
    tenant_id: packet.tenant_id,
    delivery_channel: packet.delivery_channel,
    delivery_target: packet.delivery_target,
    matter_id: packet.matter_id,
    artifact_ids: packet.artifact_ids,
    reason: reason ?? (receipt ? "receipt_pending" : "receipt_missing"),
  };
}

function buildSource(sourceId, label, sourcePath, result) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function snapshotDeliveryAction(action) {
  return {
    delivery_status: action.delivery_status,
    protected_action: action.protected_action,
    blocked_reasons: action.blocked_reasons ?? [],
    recommended_actions: action.recommended_actions ?? [],
  };
}

function snapshotOutputArtifact(artifact) {
  return {
    status: artifact.status,
    delivery_state: artifact.delivery_state,
  };
}

function buildReceiptMetadata(receipt, receiptStatus) {
  return {
    receipt_status: receiptStatus,
    executed_by: receipt.executed_by ?? null,
    executed_at: receipt.executed_at ?? null,
    delivery_reference: receipt.delivery_reference ?? "",
    notes: receipt.notes ?? "",
  };
}

function mapReceiptStatusAfter(receiptStatus) {
  if (DELIVERED_RECEIPT_STATUSES.has(receiptStatus)) return "delivered";
  if (FAILED_RECEIPT_STATUSES.has(receiptStatus)) return "failed";
  if (CANCELLED_RECEIPT_STATUSES.has(receiptStatus)) return "cancelled";
  return "recorded";
}

function normalizeReceiptStatus(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  return normalized === "" ? "pending" : normalized;
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

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    executionDraftPath: DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH,
    receiptsPath: DEFAULT_DELIVERY_RECEIPTS_PATH,
    deliveryQueuePath: DEFAULT_DELIVERY_RECEIPT_QUEUE_PATH,
    outputCatalogPath: DEFAULT_DELIVERY_RECEIPT_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_DELIVERY_RECEIPTS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--execution-draft") parsed.executionDraftPath = argv[++index];
    else if (arg === "--receipts") parsed.receiptsPath = argv[++index];
    else if (arg === "--no-receipts") parsed.receiptsPath = false;
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
  console.log(`Usage: node scripts/delivery-receipts.mjs [options]

Options:
  --execution-draft <path>   delivery-execution-draft.json path.
  --receipts <path>          Filled delivery receipts input file.
  --no-receipts              Generate receipt template only; do not apply receipts.
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
