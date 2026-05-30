import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_PACKET_LEDGER_OUT_DIR = "artifacts/human-review-packets/latest";
export const DEFAULT_HUMAN_REVIEW_PACKET_GATES_PATH = "artifacts/control-plane-human-gates/latest/control-plane-human-gates.json";
export const DEFAULT_HUMAN_REVIEW_PACKET_RECEIPTS_PATH = "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json";

export async function runHumanReviewPacketLedger(options = {}) {
  const result = await buildHumanReviewPacketLedger(options);
  if (options.write !== false) await writeHumanReviewPacketLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review packet ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewPacketLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_PACKET_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const humanGatesPath = path.resolve(options.humanGatesPath ?? DEFAULT_HUMAN_REVIEW_PACKET_GATES_PATH);
  const humanGateReceiptsPath = path.resolve(options.humanGateReceiptsPath ?? DEFAULT_HUMAN_REVIEW_PACKET_RECEIPTS_PATH);
  const humanGatesResult = await readJsonOrError(humanGatesPath);
  const receiptDraftsResult = await readJsonOrError(humanGateReceiptsPath);
  const reviewItems = buildReviewItems(humanGatesResult.value?.gate_items ?? [], receiptDraftsResult.value);
  const reviewPackets = buildReviewPackets(reviewItems);
  const validation = validateHumanReviewPacketLedger({ humanGatesResult, receiptDraftsResult, reviewItems });
  const ledger = {
    schema_version: "human-review-packet-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `human-review-packet-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    review_status: validation.valid ? (reviewPackets.length > 0 ? "pending_review" : "clear") : "blocked",
    sources: [
      buildSource("control_plane_human_gates", "Control Plane Human Gates", humanGatesPath, humanGatesResult),
      buildSource("control_plane_human_gate_receipts", "Control Plane Human Gate Receipts", humanGateReceiptsPath, receiptDraftsResult),
    ],
    summary: summarizeReviewPackets(reviewPackets, reviewItems, validation),
    review_packets: reviewPackets,
    review_items: reviewItems,
    validation,
  };

  return {
    ...ledger,
    markdown: renderHumanReviewPacketLedgerMarkdown(ledger),
  };
}

export async function writeHumanReviewPacketLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-packet-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    review_status: result.review_status,
    sources: result.sources,
    summary: result.summary,
    review_packets: result.review_packets,
    review_items: result.review_items,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "human-review-packets.json"), {
    generated_at: result.generated_at,
    count: result.review_packets.length,
    review_packets: result.review_packets,
  });
  await writeJson(path.join(outDir, "human-review-items.json"), {
    generated_at: result.generated_at,
    count: result.review_items.length,
    review_items: result.review_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHumanReviewPacketLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewPacketLedger(args);
    console.log(`Human review packet ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Review status: ${result.review_status}`);
    console.log(`Review packets: ${result.summary.review_packet_count}`);
    console.log(`Review items: ${result.summary.review_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildReviewItems(gateItems, receiptDraftArtifact) {
  const requirementsByGate = new Map((receiptDraftArtifact?.receipt_requirements ?? []).map((requirement) => [requirement.gate_item_id, requirement]));
  const receiptsByGate = new Map((receiptDraftArtifact?.receipt_input_draft?.receipts ?? []).map((receipt) => [receipt.gate_item_id, receipt]));
  return gateItems.map((gateItem) => {
    const requirement = requirementsByGate.get(gateItem.gate_item_id);
    const receipt = receiptsByGate.get(gateItem.gate_item_id);
    const requiredActor = requirement?.required_actor ?? gateItem.safe_handling?.required_actor ?? "human_reviewer";
    const requiredFields = requirement?.required_receipt_fields ?? receipt?.required_receipt_fields ?? [];
    return {
      review_item_id: `human-review-item.${slugify(gateItem.gate_item_id)}`,
      gate_item_id: gateItem.gate_item_id,
      source_plan_item_id: gateItem.source_plan_item_id,
      source_stage: gateItem.source_stage,
      gate_type: gateItem.gate_type,
      priority: gateItem.priority,
      gate_status: gateItem.status,
      title: gateItem.title,
      subject_ref: gateItem.subject_ref,
      reason: gateItem.reason,
      required_actor: requiredActor,
      requires_human: Boolean(gateItem.requires_human),
      protected_action: Boolean(gateItem.protected_action),
      receipt_required: Boolean(requirement?.receipt_required ?? gateItem.safe_handling?.receipt_required),
      decision_required: Boolean(requirement?.decision_required ?? gateItem.safe_handling?.decision_required),
      receipt_id: receipt?.receipt_id ?? null,
      receipt_status: receipt?.receipt_status ?? "missing",
      outcome: receipt?.outcome ?? "missing",
      allowed_outcomes: requirement?.allowed_outcomes ?? [],
      required_receipt_fields: requiredFields,
      missing_required_fields: requiredFields.filter((field) => !fieldPresentForPendingReceipt(receipt, field)),
      recommended_actions: gateItem.recommended_actions ?? [],
      next_commands: gateItem.next_commands ?? [],
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        protected_actions_require_receipt: Boolean(gateItem.protected_action),
      },
      checklist: buildChecklist(gateItem, requirement, receipt),
      source_refs: gateItem.source_refs ?? [],
      item_hash: hashValue({
        gate_item_id: gateItem.gate_item_id,
        receipt_id: receipt?.receipt_id ?? null,
        requiredActor,
        requiredFields,
      }),
    };
  });
}

function fieldPresentForPendingReceipt(receipt, field) {
  if (!receipt) return false;
  if (receipt.receipt_status === "pending") return true;
  const value = receipt[field];
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function buildChecklist(gateItem, requirement, receipt) {
  const checklist = [
    "Review the source gate item and subject reference before deciding.",
    "Keep generated outputs draft-only until a valid human receipt is applied.",
  ];
  if (gateItem.requires_human) checklist.push("Record the human reviewer and decision reference.");
  if (gateItem.protected_action) checklist.push("Do not execute protected delivery or merge without a protected action receipt.");
  if ((requirement?.allowed_outcomes ?? []).length > 0) checklist.push(`Allowed outcomes: ${requirement.allowed_outcomes.join(", ")}`);
  if ((gateItem.next_commands ?? []).length > 0) checklist.push("Run follow-up commands only after the human decision is recorded.");
  if (!receipt) checklist.push("Receipt draft is missing and must be regenerated before closeout.");
  return [...new Set(checklist)];
}

function buildReviewPackets(reviewItems) {
  return Object.entries(groupBy(reviewItems, (item) => `${item.required_actor}::${item.gate_type}`))
    .map(([key, items]) => {
      const [requiredActor, gateType] = key.split("::");
      const highest = highestPriority(items);
      const packetId = `human-review-packet.${slugify(requiredActor)}.${slugify(gateType)}`;
      const pendingReceiptCount = items.filter((item) => item.receipt_status === "pending").length;
      const missingReceiptCount = items.filter((item) => item.receipt_status === "missing").length;
      return {
        review_packet_id: packetId,
        packet_type: gateType,
        required_actor: requiredActor,
        packet_status: missingReceiptCount > 0 ? "blocked_missing_receipt" : pendingReceiptCount > 0 ? "pending_human_review" : "clear",
        priority: highest,
        item_count: items.length,
        protected_action_count: items.filter((item) => item.protected_action).length,
        human_required_count: items.filter((item) => item.requires_human).length,
        receipt_required_count: items.filter((item) => item.receipt_required).length,
        pending_receipt_count: pendingReceiptCount,
        missing_receipt_count: missingReceiptCount,
        command_count: items.reduce((sum, item) => sum + item.next_commands.length, 0),
        gate_item_ids: items.map((item) => item.gate_item_id),
        receipt_ids: items.map((item) => item.receipt_id).filter(Boolean),
        source_stages: countBy(items, "source_stage"),
        subject_refs: items.map((item) => item.subject_ref),
        recommended_actions: unique(items.flatMap((item) => item.recommended_actions)),
        next_commands: unique(items.flatMap((item) => item.next_commands)),
        checklist: packetChecklist(items),
        packet_hash: hashValue({
          requiredActor,
          gateType,
          itemIds: items.map((item) => item.gate_item_id),
          receiptIds: items.map((item) => item.receipt_id),
        }),
      };
    })
    .sort(comparePackets);
}

function packetChecklist(items) {
  const checklist = [
    "Resolve items from highest priority to lowest priority.",
    "Record decisions in the generated receipt input before applying any receipt.",
  ];
  if (items.some((item) => item.protected_action)) checklist.push("Protected actions remain manual and receipt-gated.");
  if (items.some((item) => item.gate_type === "evidence_decision")) checklist.push("Evidence decisions must preserve matter boundary and source citation context.");
  if (items.some((item) => item.next_commands.length > 0)) checklist.push("Re-run listed commands only after the corresponding human receipt is ready.");
  return checklist;
}

function validateHumanReviewPacketLedger({ humanGatesResult, receiptDraftsResult, reviewItems }) {
  const errors = [];
  if (!humanGatesResult.ok) {
    errors.push({ path: "sources.control_plane_human_gates", message: `Control plane human gates unavailable: ${humanGatesResult.error}` });
  }
  if (!receiptDraftsResult.ok) {
    errors.push({ path: "sources.control_plane_human_gate_receipts", message: `Control plane human gate receipts unavailable: ${receiptDraftsResult.error}` });
  }
  for (const item of reviewItems) {
    if (item.safe_handling.auto_execute_allowed) {
      errors.push({ path: `review_items.${item.review_item_id}.safe_handling.auto_execute_allowed`, message: "Human review packets must not allow auto execution" });
    }
    if (!item.receipt_id) {
      errors.push({ path: `review_items.${item.review_item_id}.receipt_id`, message: "Review item is missing a receipt draft" });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeReviewPackets(reviewPackets, reviewItems, validation) {
  return {
    review_packet_count: reviewPackets.length,
    review_item_count: reviewItems.length,
    pending_packet_count: reviewPackets.filter((packet) => packet.packet_status === "pending_human_review").length,
    blocked_packet_count: reviewPackets.filter((packet) => packet.packet_status === "blocked_missing_receipt").length,
    clear_packet_count: reviewPackets.filter((packet) => packet.packet_status === "clear").length,
    protected_packet_count: reviewPackets.filter((packet) => packet.protected_action_count > 0).length,
    human_required_packet_count: reviewPackets.filter((packet) => packet.human_required_count > 0).length,
    evidence_decision_packet_count: reviewPackets.filter((packet) => packet.packet_type === "evidence_decision").length,
    command_packet_count: reviewPackets.filter((packet) => packet.command_count > 0).length,
    pending_receipt_count: reviewItems.filter((item) => item.receipt_status === "pending").length,
    missing_receipt_count: reviewItems.filter((item) => item.receipt_status === "missing").length,
    protected_action_count: reviewItems.filter((item) => item.protected_action).length,
    validation_error_count: validation.errors.length,
    highest_priority: highestPriority(reviewItems),
    by_packet_type: countBy(reviewPackets, "packet_type"),
    by_required_actor: countBy(reviewPackets, "required_actor"),
    by_priority: countBy(reviewPackets, "priority"),
    by_packet_status: countBy(reviewPackets, "packet_status"),
  };
}

function renderHumanReviewPacketLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Human Review Packet Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Review status: ${ledger.review_status}`);
  lines.push("");
  lines.push(`- Review packets: ${ledger.summary.review_packet_count}`);
  lines.push(`- Review items: ${ledger.summary.review_item_count}`);
  lines.push(`- Pending packets: ${ledger.summary.pending_packet_count}`);
  lines.push(`- Protected packets: ${ledger.summary.protected_packet_count}`);
  lines.push(`- Pending receipts: ${ledger.summary.pending_receipt_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Packets");
  lines.push("");
  for (const packet of ledger.review_packets) {
    lines.push(`- [${packet.priority}] ${packet.review_packet_id}: ${packet.item_count} item(s), ${packet.packet_status}`);
  }
  if (ledger.review_packets.length === 0) lines.push("- No human review packets.");
  if (ledger.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of ledger.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
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

function groupBy(items, keyOrFn) {
  return items.reduce((groups, item) => {
    const value = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    groups[value ?? "unknown"] = groups[value ?? "unknown"] ?? [];
    groups[value ?? "unknown"].push(item);
    return groups;
  }, {});
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function highestPriority(items) {
  const order = ["critical", "high", "medium", "low"];
  return order.find((priority) => items.some((item) => item.priority === priority)) ?? "low";
}

function comparePackets(a, b) {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return (
    priorityOrder[a.priority] - priorityOrder[b.priority]
    || b.item_count - a.item_count
    || a.review_packet_id.localeCompare(b.review_packet_id)
  );
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_HUMAN_REVIEW_PACKET_LEDGER_OUT_DIR,
    humanGatesPath: DEFAULT_HUMAN_REVIEW_PACKET_GATES_PATH,
    humanGateReceiptsPath: DEFAULT_HUMAN_REVIEW_PACKET_RECEIPTS_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--human-gates") parsed.humanGatesPath = argv[++index];
    else if (arg === "--human-gate-receipts") parsed.humanGateReceiptsPath = argv[++index];
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
  console.log(`Usage: node scripts/human-review-packet-ledger.mjs [options]

Options:
  --human-gates <path>          control-plane-human-gates.json path.
  --human-gate-receipts <path>  control-plane-human-gate-receipt-drafts.json path.
  --out-dir <folder>            Output directory.
  --run-at <iso>                Deterministic generated_at timestamp.
  --check                       Exit non-zero when the ledger is invalid.
  -h, --help                    Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
