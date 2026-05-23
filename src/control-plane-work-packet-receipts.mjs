import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORK_PACKET_RECEIPTS_OUT_DIR = "artifacts/control-plane-work-packet-receipts/latest";
export const DEFAULT_WORK_PACKET_RECEIPTS_SOURCE_PATH = "artifacts/control-plane-work-packets/latest/control-plane-work-packets.json";

export async function runControlPlaneWorkPacketReceipts(options = {}) {
  const result = await buildControlPlaneWorkPacketReceipts(options);
  if (options.write !== false) await writeControlPlaneWorkPacketReceipts(result, result.output_dir);
  return result;
}

export async function buildControlPlaneWorkPacketReceipts(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_PACKET_RECEIPTS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const workPacketsPath = path.resolve(options.workPacketsPath ?? DEFAULT_WORK_PACKET_RECEIPTS_SOURCE_PATH);
  const workPacketsResult = await readJsonOrError(workPacketsPath);
  const workPackets = workPacketsResult.value?.work_packets ?? [];
  const receiptRequirements = workPackets.map((packet) => buildReceiptRequirement(packet, generatedAt));
  const receiptInputDraft = buildReceiptInputDraft(generatedAt, workPacketsResult.value, receiptRequirements);
  const result = {
    schema_version: "control-plane-work-packet-receipt-drafts.v1",
    generated_at: generatedAt,
    receipt_draft_id: `control-plane-work-packet-receipts.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    receipt_status: deriveReceiptStatus(workPacketsResult, receiptRequirements),
    sources: [
      buildSource("control_plane_work_packets", "Control Plane Work Packets", workPacketsPath, workPacketsResult),
    ],
    summary: summarizeReceiptDrafts(workPacketsResult, receiptRequirements, receiptInputDraft),
    receipt_requirements: receiptRequirements,
    receipt_input_draft: receiptInputDraft,
  };

  return {
    ...result,
    markdown: renderReceiptDraftsMarkdown(result),
  };
}

export async function writeControlPlaneWorkPacketReceipts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-work-packet-receipt-drafts.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    receipt_draft_id: result.receipt_draft_id,
    output_dir: result.output_dir,
    receipt_status: result.receipt_status,
    sources: result.sources,
    summary: result.summary,
    receipt_requirements: result.receipt_requirements,
    receipt_input_draft: result.receipt_input_draft,
  });
  await writeJson(path.join(outDir, "receipt-input-draft.json"), result.receipt_input_draft);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneWorkPacketReceiptsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneWorkPacketReceipts(args);
  console.log(`Control plane work packet receipt drafts written to ${result.output_dir}`);
  console.log(`Receipt status: ${result.receipt_status}`);
  console.log(`Receipt drafts: ${result.summary.receipt_draft_count}`);
  console.log(`Protected receipts: ${result.summary.protected_receipt_count}`);
}

function buildReceiptRequirement(packet, generatedAt) {
  const requiredFields = requiredFieldsForPacket(packet);
  return {
    receipt_requirement_id: `work-packet-receipt-requirement.${slugify(packet.work_packet_id)}`,
    work_packet_id: packet.work_packet_id,
    packet_type: packet.packet_type,
    source_stage: packet.source_stage,
    priority: packet.priority,
    packet_status: packet.status,
    requires_human: packet.requires_human,
    protected_action: packet.protected_action,
    required_receipt_fields: requiredFields,
    acceptance_criteria: acceptanceCriteriaForPacket(packet),
    next_commands: packet.next_commands ?? [],
    work_item_ids: packet.work_item_ids ?? [],
    receipt_form_draft: buildReceiptFormDraft(packet, requiredFields, generatedAt),
  };
}

function buildReceiptFormDraft(packet, requiredFields, generatedAt) {
  return {
    receipt_id: `work-packet-receipt.${slugify(packet.work_packet_id)}`,
    work_packet_id: packet.work_packet_id,
    packet_type: packet.packet_type,
    source_stage: packet.source_stage,
    receipt_status: "pending",
    resolved_by: "",
    resolved_at: "",
    resolution_reference: "",
    resolution_notes: "",
    reviewer: packet.requires_human ? "" : null,
    protected_action_reference: packet.protected_action ? "" : null,
    command_result: packet.next_commands?.length > 0 ? "not_run" : null,
    commands_run: packet.next_commands ?? [],
    completed_work_item_ids: [],
    required_receipt_fields: requiredFields,
    generated_at: generatedAt,
  };
}

function buildReceiptInputDraft(generatedAt, workPacketArtifact, requirements) {
  return {
    schema_version: "control-plane-work-packet-receipts-input.v1",
    generated_at: generatedAt,
    work_packet_run_id: workPacketArtifact?.work_packet_run_id ?? "control-plane-work-packets.unknown",
    instructions: "Fill one receipt row per work packet after human review, protected action, or safe command rerun. Pending rows do not close packets.",
    receipts: requirements.map((requirement) => requirement.receipt_form_draft),
  };
}

function requiredFieldsForPacket(packet) {
  const fields = ["receipt_status", "resolved_by", "resolved_at", "resolution_reference", "resolution_notes"];
  if (packet.requires_human) fields.push("reviewer");
  if (packet.protected_action) fields.push("protected_action_reference");
  if ((packet.next_commands ?? []).length > 0) fields.push("command_result", "commands_run");
  if ((packet.work_item_ids ?? []).length > 0) fields.push("completed_work_item_ids");
  return [...new Set(fields)];
}

function acceptanceCriteriaForPacket(packet) {
  const criteria = [
    ...(packet.checklist ?? []),
    "receipt_status is resolved, deferred, cancelled, or failed",
    "resolved_by and resolved_at are filled for non-pending receipts",
    "resolution_reference points to the source decision, delivery reference, commit, or command output",
  ];
  if (packet.protected_action) criteria.push("protected_action_reference is filled before packet closeout");
  if (packet.requires_human) criteria.push("reviewer records the person who approved, deferred, or rejected the packet");
  return [...new Set(criteria)];
}

function deriveReceiptStatus(workPacketsResult, receiptRequirements) {
  if (!workPacketsResult.ok) return "blocked_missing_work_packets";
  if (receiptRequirements.length > 0) return "pending_receipts";
  return "clear";
}

function summarizeReceiptDrafts(workPacketsResult, receiptRequirements, receiptInputDraft) {
  return {
    receipt_status: deriveReceiptStatus(workPacketsResult, receiptRequirements),
    work_packets_available: workPacketsResult.ok,
    source_work_packet_run_id: workPacketsResult.value?.work_packet_run_id ?? null,
    source_work_packet_count: workPacketsResult.value?.summary?.work_packet_count ?? 0,
    receipt_requirement_count: receiptRequirements.length,
    receipt_draft_count: receiptInputDraft.receipts.length,
    pending_receipt_count: receiptInputDraft.receipts.filter((receipt) => receipt.receipt_status === "pending").length,
    protected_receipt_count: receiptRequirements.filter((item) => item.protected_action).length,
    human_receipt_count: receiptRequirements.filter((item) => item.requires_human).length,
    command_receipt_count: receiptRequirements.filter((item) => item.next_commands.length > 0).length,
    required_field_count: receiptRequirements.reduce((total, item) => total + item.required_receipt_fields.length, 0),
    by_packet_type: countBy(receiptRequirements, "packet_type"),
    by_source_stage: countBy(receiptRequirements, "source_stage"),
  };
}

function renderReceiptDraftsMarkdown(result) {
  const lines = [];
  lines.push("# Control Plane Work Packet Receipt Drafts");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Receipt status: ${result.receipt_status}`);
  lines.push("");
  lines.push(`- Receipt requirements: ${result.summary.receipt_requirement_count}`);
  lines.push(`- Receipt drafts: ${result.summary.receipt_draft_count}`);
  lines.push(`- Human receipts: ${result.summary.human_receipt_count}`);
  lines.push(`- Protected receipts: ${result.summary.protected_receipt_count}`);
  lines.push(`- Command receipts: ${result.summary.command_receipt_count}`);
  lines.push("");
  lines.push("## Requirements");
  lines.push("");
  for (const requirement of result.receipt_requirements) {
    lines.push(`- [${requirement.priority}] ${requirement.work_packet_id} (${requirement.packet_type})`);
    lines.push(`  - Required fields: ${requirement.required_receipt_fields.join(", ")}`);
  }
  if (result.receipt_requirements.length === 0) lines.push("- No receipt requirements.");
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

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    workPacketsPath: DEFAULT_WORK_PACKET_RECEIPTS_SOURCE_PATH,
    outDir: DEFAULT_WORK_PACKET_RECEIPTS_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--work-packets") parsed.workPacketsPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-work-packet-receipts.mjs [options]

Options:
  --work-packets <path>  control-plane-work-packets.json path.
  --out-dir <folder>    Output directory.
  --run-at <iso>        Deterministic generated_at timestamp.
  -h, --help            Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
