import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORK_PACKET_RECEIPT_APPLICATION_OUT_DIR = "artifacts/control-plane-work-packet-receipt-application/latest";
export const DEFAULT_WORK_PACKET_RECEIPT_VALIDATION_PATH = "artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json";
export const DEFAULT_WORK_PACKETS_PATH = "artifacts/control-plane-work-packets/latest/control-plane-work-packets.json";

const CLOSED_STATUSES = {
  resolved: "closed",
  deferred: "deferred",
  cancelled: "cancelled",
  failed: "failed",
};

export async function runControlPlaneWorkPacketReceiptApplication(options = {}) {
  const result = await buildControlPlaneWorkPacketReceiptApplication(options);
  if (options.write !== false) await writeControlPlaneWorkPacketReceiptApplication(result, result.output_dir);
  return result;
}

export async function buildControlPlaneWorkPacketReceiptApplication(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_PACKET_RECEIPT_APPLICATION_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const validationPath = path.resolve(options.validationPath ?? DEFAULT_WORK_PACKET_RECEIPT_VALIDATION_PATH);
  const workPacketsPath = path.resolve(options.workPacketsPath ?? DEFAULT_WORK_PACKETS_PATH);
  const validationResult = await readJsonOrError(validationPath);
  const workPacketsResult = await readJsonOrError(workPacketsPath);
  const validation = validationResult.value;
  const workPacketArtifact = workPacketsResult.value;
  const validationErrors = validation?.summary?.error_count ?? validation?.receipt_errors?.length ?? 0;
  const readyReceipts = validation?.validated_receipts_to_apply?.receipts ?? [];
  const workPacketById = new Map((workPacketArtifact?.work_packets ?? []).map((packet) => [packet.work_packet_id, packet]));
  const applicationStatus = deriveApplicationStatus(validationResult, workPacketsResult, validationErrors, readyReceipts.length);
  const canApply = applicationStatus === "applied";
  const appliedReceipts = canApply
    ? readyReceipts.map((receipt) => buildAppliedReceipt(receipt, workPacketById.get(receipt.work_packet_id)))
    : [];
  const patchedWorkPackets = canApply ? buildPatchedWorkPackets(workPacketArtifact?.work_packets ?? [], appliedReceipts) : [];
  const patchedWorkItems = canApply ? buildPatchedWorkItems(workPacketArtifact?.work_items ?? [], readyReceipts) : [];
  const auditEvents = canApply
    ? appliedReceipts.map((receipt) => buildAuditEvent(receipt, generatedAt))
    : [];
  const application = {
    schema_version: "control-plane-work-packet-receipt-application.v1",
    generated_at: generatedAt,
    application_id: `control-plane-work-packet-receipt-application.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    application_status: applicationStatus,
    safe_to_apply: canApply,
    sources: [
      buildSource("work_packet_receipt_validation", "Work Packet Receipt Validation", validationPath, validationResult),
      buildSource("control_plane_work_packets", "Control Plane Work Packets", workPacketsPath, workPacketsResult),
    ],
    summary: summarizeApplication({
      validationResult,
      workPacketsResult,
      validation,
      validationErrors,
      readyReceipts,
      appliedReceipts,
      patchedWorkPackets,
      patchedWorkItems,
      auditEvents,
      applicationStatus,
    }),
    validated_receipts_to_apply: validation?.validated_receipts_to_apply ?? emptyValidatedReceipts(generatedAt),
    applied_receipts: appliedReceipts,
    pending_receipts: (validation?.validation_items ?? []).filter((item) => item.validation_status === "pending_receipt"),
    receipt_errors: validation?.receipt_errors ?? [],
    audit_events: auditEvents,
    patched_work_packets: patchedWorkPackets,
    patched_work_items: patchedWorkItems,
  };

  return {
    ...application,
    markdown: renderApplicationMarkdown(application),
  };
}

export async function writeControlPlaneWorkPacketReceiptApplication(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-work-packet-receipt-application.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    application_id: result.application_id,
    output_dir: result.output_dir,
    application_status: result.application_status,
    safe_to_apply: result.safe_to_apply,
    sources: result.sources,
    summary: result.summary,
    validated_receipts_to_apply: result.validated_receipts_to_apply,
    applied_receipts: result.applied_receipts,
    pending_receipts: result.pending_receipts,
    receipt_errors: result.receipt_errors,
    audit_events: result.audit_events,
    patched_work_packets: result.patched_work_packets,
    patched_work_items: result.patched_work_items,
  });
  await writeJson(path.join(outDir, "validated-work-packet-receipts.json"), result.validated_receipts_to_apply);
  await writeJson(path.join(outDir, "applied-work-packet-receipts.json"), {
    generated_at: result.generated_at,
    count: result.applied_receipts.length,
    receipts: result.applied_receipts,
  });
  await writeJson(path.join(outDir, "audit-events.json"), {
    generated_at: result.generated_at,
    count: result.audit_events.length,
    events: result.audit_events,
  });
  if (result.patched_work_packets.length > 0) await writeJson(path.join(outDir, "patched-work-packets.json"), result.patched_work_packets);
  if (result.patched_work_items.length > 0) await writeJson(path.join(outDir, "patched-work-items.json"), result.patched_work_items);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneWorkPacketReceiptApplicationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneWorkPacketReceiptApplication(args);
  console.log(`Control plane work packet receipt application written to ${result.output_dir}`);
  console.log(`Application status: ${result.application_status}`);
  console.log(`Applied receipts: ${result.summary.applied_receipt_count}`);
  console.log(`Patched packets: ${result.summary.patched_work_packet_count}`);
}

function deriveApplicationStatus(validationResult, workPacketsResult, validationErrors, readyReceiptCount) {
  if (!validationResult.ok) return "blocked_missing_validation";
  if (!workPacketsResult.ok) return "blocked_missing_work_packets";
  if (validationErrors > 0) return "blocked_validation_errors";
  if (readyReceiptCount === 0) return "nothing_to_apply";
  return "applied";
}

function buildAppliedReceipt(receipt, packet) {
  return {
    receipt_id: receipt.receipt_id,
    work_packet_id: receipt.work_packet_id,
    packet_type: receipt.packet_type,
    source_stage: receipt.source_stage,
    receipt_status: receipt.receipt_status,
    applied_packet_status: CLOSED_STATUSES[receipt.receipt_status] ?? "closed",
    resolved_by: receipt.resolved_by,
    resolved_at: receipt.resolved_at,
    resolution_reference: receipt.resolution_reference,
    reviewer: receipt.reviewer ?? null,
    protected_action_reference: receipt.protected_action_reference ?? null,
    command_result: receipt.command_result ?? null,
    completed_work_item_ids: receipt.completed_work_item_ids ?? [],
    packet_found: Boolean(packet),
  };
}

function buildPatchedWorkPackets(workPackets, appliedReceipts) {
  const receiptByPacketId = new Map(appliedReceipts.map((receipt) => [receipt.work_packet_id, receipt]));
  return workPackets
    .filter((packet) => receiptByPacketId.has(packet.work_packet_id))
    .map((packet) => {
      const receipt = receiptByPacketId.get(packet.work_packet_id);
      return {
        ...packet,
        status: receipt.applied_packet_status,
        applied_receipt_id: receipt.receipt_id,
        applied_at: receipt.resolved_at,
        resolution_reference: receipt.resolution_reference,
      };
    });
}

function buildPatchedWorkItems(workItems, readyReceipts) {
  const completedItemIds = new Set(readyReceipts.flatMap((receipt) => receipt.completed_work_item_ids ?? []));
  return workItems
    .filter((item) => completedItemIds.has(item.work_item_id))
    .map((item) => ({
      ...item,
      status: "completed",
    }));
}

function buildAuditEvent(receipt, generatedAt) {
  return {
    type: "work_packet.receipt.applied",
    time: generatedAt,
    actor: receipt.resolved_by,
    correlation_id: receipt.work_packet_id,
    subject: {
      receipt_id: receipt.receipt_id,
      work_packet_id: receipt.work_packet_id,
      receipt_status: receipt.receipt_status,
      applied_packet_status: receipt.applied_packet_status,
    },
  };
}

function summarizeApplication(context) {
  return {
    application_status: context.applicationStatus,
    validation_available: context.validationResult.ok,
    work_packets_available: context.workPacketsResult.ok,
    validation_status: context.validation?.validation_status ?? null,
    validation_error_count: context.validationErrors,
    ready_receipt_count: context.readyReceipts.length,
    pending_receipt_count: context.validation?.summary?.pending_receipt_count ?? 0,
    invalid_receipt_count: context.validation?.summary?.invalid_receipt_count ?? 0,
    applied_receipt_count: context.appliedReceipts.length,
    patched_work_packet_count: context.patchedWorkPackets.length,
    patched_work_item_count: context.patchedWorkItems.length,
    audit_event_count: context.auditEvents.length,
    receipt_error_count: context.validation?.receipt_errors?.length ?? 0,
    by_receipt_status: countBy(context.appliedReceipts, "receipt_status"),
    by_packet_type: countBy(context.appliedReceipts, "packet_type"),
    by_source_stage: countBy(context.appliedReceipts, "source_stage"),
  };
}

function emptyValidatedReceipts(generatedAt) {
  return {
    schema_version: "control-plane-work-packet-receipts-input.v1",
    generated_at: generatedAt,
    work_packet_run_id: "control-plane-work-packets.unknown",
    instructions: "No validated work packet receipts were available.",
    receipts: [],
  };
}

function renderApplicationMarkdown(application) {
  const lines = [];
  lines.push("# Control Plane Work Packet Receipt Application");
  lines.push("");
  lines.push(`Generated: ${application.generated_at}`);
  lines.push(`Application status: ${application.application_status}`);
  lines.push("");
  lines.push(`- Ready receipts: ${application.summary.ready_receipt_count}`);
  lines.push(`- Applied receipts: ${application.summary.applied_receipt_count}`);
  lines.push(`- Patched work packets: ${application.summary.patched_work_packet_count}`);
  lines.push(`- Audit events: ${application.summary.audit_event_count}`);
  lines.push("");
  lines.push("## Applied Receipts");
  lines.push("");
  for (const receipt of application.applied_receipts) {
    lines.push(`- ${receipt.work_packet_id}: ${receipt.receipt_status} -> ${receipt.applied_packet_status}`);
  }
  if (application.applied_receipts.length === 0) lines.push("- No work packet receipts applied.");
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

function parseArgs(argv) {
  const parsed = {
    validationPath: DEFAULT_WORK_PACKET_RECEIPT_VALIDATION_PATH,
    workPacketsPath: DEFAULT_WORK_PACKETS_PATH,
    outDir: DEFAULT_WORK_PACKET_RECEIPT_APPLICATION_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--validation") parsed.validationPath = argv[++index];
    else if (arg === "--work-packets") parsed.workPacketsPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-work-packet-receipt-application.mjs [options]

Options:
  --validation <path>    control-plane-work-packet-receipt-validation.json path.
  --work-packets <path>  control-plane-work-packets.json path.
  --out-dir <folder>     Output directory.
  --run-at <iso>         Deterministic generated_at timestamp.
  -h, --help             Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
