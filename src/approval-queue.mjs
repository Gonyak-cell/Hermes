import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_APPROVAL_QUEUE_INPUT = "artifacts/evidence-viewer/latest/evidence-viewer.json";
export const DEFAULT_APPROVAL_QUEUE_OUT_DIR = "artifacts/approval-queue/latest";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runApprovalQueue(options = {}) {
  const result = await buildApprovalQueue(options);
  if (options.write !== false) await writeApprovalQueue(result, result.output_dir);
  return result;
}

export async function buildApprovalQueue(options = {}) {
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_APPROVAL_QUEUE_INPUT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_APPROVAL_QUEUE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const packet = input.review_packet ?? input;
  if (!packet.evidence_cards && !packet.gate_results && !packet.blocked_items) {
    throw new Error("Input must be evidence-viewer.v1 or a review packet");
  }

  const queueItems = [
    ...buildGateReviewItems(packet, generatedAt),
    ...buildBlockedResourceItems(packet, generatedAt),
    ...buildEvidenceReviewItems(packet, generatedAt),
  ].sort(compareQueueItems);

  const queueId = `approval-queue.${shortHash(`${inputPath}:${generatedAt}`)}`;
  const result = {
    schema_version: "approval-queue.v1",
    generated_at: generatedAt,
    queue_id: queueId,
    source_viewer: inputPath,
    output_dir: outputDir,
    summary: summarizeQueue(queueItems),
    items: queueItems.map((item, index) => ({
      ...item,
      sort_order: index + 1,
    })),
  };

  return {
    ...result,
    decision_template: buildDecisionTemplate(result),
    markdown: renderApprovalQueueMarkdown(result),
  };
}

export async function writeApprovalQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "approval-queue.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    queue_id: result.queue_id,
    source_viewer: result.source_viewer,
    summary: result.summary,
    items: result.items,
  });
  await writeJson(path.join(outDir, "decision-template.json"), result.decision_template);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runApprovalQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runApprovalQueue(args);
  console.log(`Approval queue written to ${result.output_dir}`);
  console.log(`Queue: ${result.queue_id}`);
  console.log(`Items: ${result.summary.total_items}`);
  console.log(`Critical: ${result.summary.by_priority.critical ?? 0}`);
  console.log(`High: ${result.summary.by_priority.high ?? 0}`);
  console.log(`Medium: ${result.summary.by_priority.medium ?? 0}`);
}

function buildGateReviewItems(packet, generatedAt) {
  return (packet.gate_results ?? [])
    .filter((gate) => gate.blocking || gate.status !== "passed")
    .map((gate) => {
      const priority = gate.blocking ? "critical" : "medium";
      return {
        queue_item_id: `approval-item.gate.${shortHash(gate.gate_id)}`,
        item_type: "blocking_gate_review",
        priority,
        status: "pending",
        title: `Resolve gate: ${gate.gate_id}`,
        subject_ref: {
          subject_type: "gate",
          subject_id: gate.gate_id,
        },
        matter_id: null,
        classification: null,
        source_uri: packet.input_path ?? null,
        reason: gate.message,
        recommended_actions: gate.blocking
          ? ["resolve_blocker", "waive_with_reason", "rerun_source_step"]
          : ["acknowledge_warning", "waive_with_reason"],
        required_decision: "resolve_or_waive",
        created_at: generatedAt,
        metadata: {
          gate_status: gate.status,
          blocking: Boolean(gate.blocking),
        },
      };
    });
}

function buildBlockedResourceItems(packet, generatedAt) {
  return (packet.blocked_items ?? []).map((item) => {
    const reason = item.quarantine_reason ?? item.status ?? "blocked";
    return {
      queue_item_id: `approval-item.blocked_resource.${shortHash(item.item_id ?? item.source_path)}`,
      item_type: "blocked_resource_review",
      priority: blockedItemPriority(item),
      status: "pending",
      title: `Review blocked resource: ${item.relative_path ?? path.basename(item.source_path ?? "resource")}`,
      subject_ref: {
        subject_type: "resource_expansion_item",
        subject_id: item.item_id ?? item.source_path,
      },
      matter_id: null,
      classification: item.data_classification ?? null,
      source_uri: item.source_path ?? null,
      reason,
      recommended_actions: blockedItemActions(reason),
      required_decision: "promote_retry_or_waive",
      created_at: generatedAt,
      metadata: {
        error: item.error ?? null,
      },
    };
  });
}

function buildEvidenceReviewItems(packet, generatedAt) {
  return (packet.evidence_cards ?? [])
    .filter((card) => card.review_status === "needs_review" || card.review_status === "unreviewed")
    .map((card) => ({
      queue_item_id: `approval-item.evidence.${shortHash(card.evidence_id)}`,
      item_type: "evidence_review",
      priority: evidencePriority(card),
      status: "pending",
      title: `Review evidence: ${truncate(card.summary, 90)}`,
      subject_ref: {
        subject_type: "evidence_item",
        subject_id: card.evidence_id,
      },
      matter_id: card.matter_id ?? null,
      classification: card.source?.classification ?? null,
      source_uri: card.source?.source_uri ?? null,
      reason: "Machine-extracted evidence requires human review before downstream use.",
      recommended_actions: ["approve_evidence", "reject_evidence", "request_reextract", "assign_matter"],
      required_decision: "approve_reject_or_request_changes",
      created_at: generatedAt,
      metadata: {
        reliability: card.reliability,
        evidence_type: card.evidence_type,
        capability_ids: card.capability_ids ?? [],
        resource_id: card.source?.resource_id ?? null,
      },
    }));
}

function buildDecisionTemplate(queue) {
  return {
    schema_version: "approval-decisions.v1",
    generated_at: queue.generated_at,
    source_queue_id: queue.queue_id,
    decisions: queue.items.map((item) => ({
      queue_item_id: item.queue_item_id,
      decision: "pending",
      decided_by: null,
      decided_at: null,
      comment: "",
      follow_up_action: "",
    })),
  };
}

function renderApprovalQueueMarkdown(queue) {
  const lines = [];
  lines.push("# Approval Queue");
  lines.push("");
  lines.push(`Generated: ${queue.generated_at}`);
  lines.push(`Queue: ${queue.queue_id}`);
  lines.push(`Source: ${queue.source_viewer}`);
  lines.push("");
  lines.push(`- Total items: ${queue.summary.total_items}`);
  lines.push(`- Critical: ${queue.summary.by_priority.critical ?? 0}`);
  lines.push(`- High: ${queue.summary.by_priority.high ?? 0}`);
  lines.push(`- Medium: ${queue.summary.by_priority.medium ?? 0}`);
  lines.push(`- Low: ${queue.summary.by_priority.low ?? 0}`);
  lines.push("");
  lines.push("## Items");
  lines.push("");
  for (const item of queue.items) {
    lines.push(`### ${item.sort_order}. ${item.title}`);
    lines.push("");
    lines.push(`- Type: ${item.item_type}`);
    lines.push(`- Priority: ${item.priority}`);
    lines.push(`- Subject: ${item.subject_ref.subject_type}:${item.subject_ref.subject_id}`);
    lines.push(`- Matter: ${item.matter_id ?? "n/a"}`);
    lines.push(`- Classification: ${item.classification ?? "n/a"}`);
    lines.push(`- Source: ${item.source_uri ?? "n/a"}`);
    lines.push(`- Reason: ${item.reason}`);
    lines.push(`- Required decision: ${item.required_decision}`);
    lines.push("");
  }
  if (queue.items.length === 0) lines.push("- No pending review items.");
  return `${lines.join("\n")}\n`;
}

function summarizeQueue(items) {
  return {
    total_items: items.length,
    by_type: countBy(items, "item_type"),
    by_priority: countBy(items, "priority"),
    by_status: countBy(items, "status"),
    critical_or_high_count: items.filter((item) => ["critical", "high"].includes(item.priority)).length,
  };
}

function blockedItemPriority(item) {
  const reason = item.quarantine_reason ?? "";
  if (item.data_classification === "P5_SECRET" || /secret|credential|token|password/i.test(reason)) return "critical";
  if (/failed|materialization|required|unsupported/i.test(reason)) return "high";
  return "medium";
}

function blockedItemActions(reason) {
  if (/materialization/i.test(reason)) return ["materialize_file", "rerun_expansion", "waive_with_reason"];
  if (/unsupported/i.test(reason)) return ["assign_extractor", "convert_source", "waive_with_reason"];
  if (/secret|credential|token|password/i.test(reason)) return ["keep_quarantined", "move_to_secret_store", "redact_and_retry"];
  return ["retry", "waive_with_reason"];
}

function evidencePriority(card) {
  const classification = card.source?.classification;
  if (["P4_HIGHLY_RESTRICTED", "P5_SECRET"].includes(classification)) return "critical";
  if (["P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED"].includes(classification)) return "high";
  return "medium";
}

function compareQueueItems(a, b) {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.item_type.localeCompare(b.item_type) ||
    a.title.localeCompare(b.title)
  );
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_APPROVAL_QUEUE_INPUT,
    outDir: DEFAULT_APPROVAL_QUEUE_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--input") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/approval-queue.mjs [options]

Options:
  --input <path>        evidence-viewer.json or review packet JSON.
  --out-dir <folder>   Output directory.
  --run-at <iso>       Deterministic generated_at timestamp.
  -h, --help           Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function truncate(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function shortHash(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}
