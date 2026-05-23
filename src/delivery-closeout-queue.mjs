import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DELIVERY_CLOSEOUT_OUT_DIR = "artifacts/delivery-closeout/latest";
export const DEFAULT_POST_DELIVERY_RECONCILIATION_PATH = "artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json";
export const DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH = "artifacts/delivery-execution/latest/delivery-execution-draft.json";
export const DEFAULT_RECEIPT_TEMPLATE_PATH = "artifacts/delivery-receipts/latest/receipt-template.json";
export const DEFAULT_CLOSEOUT_OUTPUT_CATALOG_PATH = "artifacts/delivery-receipts/latest/patched-output-catalog.json";

export async function runDeliveryCloseoutQueue(options = {}) {
  const result = await buildDeliveryCloseoutQueue(options);
  if (options.write !== false) await writeDeliveryCloseoutQueue(result, result.output_dir);
  return result;
}

export async function buildDeliveryCloseoutQueue(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DELIVERY_CLOSEOUT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const postDeliveryPath = path.resolve(options.postDeliveryPath ?? DEFAULT_POST_DELIVERY_RECONCILIATION_PATH);
  const executionDraftPath = path.resolve(options.executionDraftPath ?? DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH);
  const receiptTemplatePath = options.receiptTemplatePath === false
    ? null
    : path.resolve(options.receiptTemplatePath ?? DEFAULT_RECEIPT_TEMPLATE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_CLOSEOUT_OUTPUT_CATALOG_PATH);
  const postDeliveryResult = await readJsonOrError(postDeliveryPath);
  const executionDraftResult = await readJsonOrError(executionDraftPath);
  const receiptTemplateResult = receiptTemplatePath ? await readJsonOrError(receiptTemplatePath) : { ok: false, value: null, error: "disabled" };
  const outputCatalogResult = outputCatalogPath ? await readJsonOrError(outputCatalogPath) : { ok: false, value: null, error: "disabled" };
  const executionPacketById = new Map((executionDraftResult.value?.execution_packets ?? []).map((packet) => [packet.packet_id, packet]));
  const executionCandidateById = new Map((executionDraftResult.value?.execution_candidates ?? []).map((candidate) => [candidate.execution_candidate_id, candidate]));
  const receiptDraftByPacketId = new Map((receiptTemplateResult.value?.receipts ?? []).map((receipt) => [receipt.packet_id, receipt]));
  const artifactById = new Map((outputCatalogResult.value?.artifacts ?? []).map((artifact) => [artifact.artifact_id, artifact]));
  const closeoutItems = (postDeliveryResult.value?.outstanding_receipts ?? [])
    .map((outstanding) => buildCloseoutItem({
      outstanding,
      packet: executionPacketById.get(outstanding.packet_id),
      receiptDraft: receiptDraftByPacketId.get(outstanding.packet_id),
      artifactById,
      executionCandidateById,
      generatedAt,
    }))
    .sort(compareCloseoutItems);
  const receiptInputDraft = buildReceiptInputDraft(generatedAt, executionDraftResult.value, closeoutItems);
  const queue = {
    schema_version: "delivery-closeout-queue.v1",
    generated_at: generatedAt,
    closeout_queue_id: `delivery-closeout.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    summary: summarizeCloseoutQueue(postDeliveryResult, executionDraftResult, receiptTemplateResult, outputCatalogResult, closeoutItems),
    sources: [
      buildSource("post_delivery_reconciliation", "Post-Delivery Reconciliation", postDeliveryPath, postDeliveryResult),
      buildSource("delivery_execution_draft", "Delivery Execution Draft", executionDraftPath, executionDraftResult),
      buildSource("receipt_template", "Delivery Receipt Template", receiptTemplatePath, receiptTemplateResult),
      buildSource("output_catalog", "Receipt-Patched Output Catalog", outputCatalogPath, outputCatalogResult),
    ],
    closeout_items: closeoutItems,
    receipt_input_draft: receiptInputDraft,
  };

  return {
    ...queue,
    markdown: renderDeliveryCloseoutQueueMarkdown(queue),
  };
}

export async function writeDeliveryCloseoutQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "delivery-closeout-queue.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    closeout_queue_id: result.closeout_queue_id,
    summary: result.summary,
    sources: result.sources,
    closeout_items: result.closeout_items,
    receipt_input_draft: result.receipt_input_draft,
  });
  await writeJson(path.join(outDir, "receipt-input-draft.json"), result.receipt_input_draft);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeliveryCloseoutQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runDeliveryCloseoutQueue(args);
  console.log(`Delivery closeout queue written to ${result.output_dir}`);
  console.log(`Closeout items: ${result.summary.closeout_item_count}`);
  console.log(`Awaiting execution: ${result.summary.awaiting_execution_count}`);
  console.log(`Blocked closeouts: ${result.summary.blocked_closeout_count}`);
}

function buildCloseoutItem(context) {
  const { outstanding, packet, receiptDraft, artifactById, executionCandidateById, generatedAt } = context;
  const artifactIds = outstanding.artifact_ids ?? packet?.artifact_ids ?? [];
  const artifacts = artifactIds.map((artifactId) => summarizeArtifact(artifactId, artifactById.get(artifactId)));
  const executionCandidates = (packet?.execution_candidate_ids ?? [])
    .map((candidateId) => summarizeExecutionCandidate(candidateId, executionCandidateById.get(candidateId)))
    .filter(Boolean);
  const status = deriveCloseoutStatus(outstanding, packet, receiptDraft);
  const receiptForm = buildReceiptFormDraft(outstanding, packet, receiptDraft);
  const domainPacks = [...new Set(artifacts.map((artifact) => artifact.domain_pack).filter(Boolean))].sort();
  return {
    closeout_item_id: `closeout.${slugify(outstanding.packet_id)}`,
    packet_id: outstanding.packet_id,
    tenant_id: outstanding.tenant_id ?? packet?.tenant_id ?? "tenant.unknown",
    matter_id: outstanding.matter_id ?? packet?.matter_id ?? "matter.unknown",
    delivery_channel: outstanding.delivery_channel ?? packet?.delivery_channel ?? "unknown",
    delivery_target: outstanding.delivery_target ?? packet?.delivery_target ?? "unknown",
    priority: packet?.priority ?? "high",
    status,
    reason: outstanding.reason ?? "receipt_outstanding",
    protected_action: true,
    requires_manual_execution: true,
    auto_execute: false,
    candidate_count: packet?.candidate_count ?? artifactIds.length,
    artifact_count: artifactIds.length,
    artifact_ids: artifactIds,
    domain_packs: domainPacks,
    primary_domain_pack: domainPacks[0] ?? "unknown",
    execution_candidate_ids: packet?.execution_candidate_ids ?? [],
    final_check_required: packet?.final_check_required ?? true,
    receipt_template_available: Boolean(receiptDraft),
    execution_packet_available: Boolean(packet),
    artifacts,
    execution_candidates: executionCandidates,
    closeout_checklist: buildCloseoutChecklist(packet, artifacts),
    receipt_form_draft: receiptForm,
    next_commands: ["npm run delivery:closeout:validate", "npm run delivery:closeout:apply", "npm run delivery:reconcile", "npm run dashboard:build"],
    created_at: generatedAt,
  };
}

function summarizeArtifact(artifactId, artifact) {
  return {
    artifact_id: artifactId,
    artifact_type: artifact?.artifact_type ?? "unknown",
    artifact_uri: artifact?.artifact_uri ?? null,
    tenant_id: artifact?.tenant_id ?? null,
    matter_id: artifact?.matter_id ?? null,
    domain_pack: artifact?.domain_pack ?? null,
    status: artifact?.status ?? "unknown",
    approval_status: artifact?.approval_status ?? null,
    delivery_state: artifact?.delivery_state ?? "unknown",
    citation_count: artifact?.citation_count ?? 0,
    content_hash: artifact?.content_hash ?? null,
  };
}

function summarizeExecutionCandidate(candidateId, candidate) {
  if (!candidate) {
    return {
      execution_candidate_id: candidateId,
      available: false,
    };
  }
  return {
    execution_candidate_id: candidate.execution_candidate_id,
    available: true,
    delivery_action_id: candidate.delivery_action_id,
    artifact_id: candidate.artifact_id,
    execution_status: candidate.execution_status,
    execution_command: candidate.execution_command,
    checklist: candidate.checklist ?? [],
    artifact_context: candidate.artifact_context ?? {},
  };
}

function deriveCloseoutStatus(outstanding, packet, receiptDraft) {
  if (outstanding.reason === "receipt_error") return "blocked_receipt_error";
  if (!packet) return "blocked_missing_execution_packet";
  if (!receiptDraft) return "blocked_missing_receipt_template";
  return "awaiting_manual_execution";
}

function buildReceiptFormDraft(outstanding, packet, receiptDraft) {
  const packetId = outstanding.packet_id ?? packet?.packet_id;
  return {
    receipt_id: receiptDraft?.receipt_id ?? `receipt.${packetId}`,
    packet_id: packetId,
    receipt_status: "pending",
    executed_by: receiptDraft?.executed_by ?? "",
    executed_at: receiptDraft?.executed_at ?? "",
    delivery_reference: receiptDraft?.delivery_reference ?? "",
    notes: receiptDraft?.notes ?? "",
    delivered_artifact_ids: receiptDraft?.delivered_artifact_ids ?? outstanding.artifact_ids ?? packet?.artifact_ids ?? [],
  };
}

function buildCloseoutChecklist(packet, artifacts) {
  const checklist = [
    ...(packet?.checklist ?? []),
    "perform_manual_delivery_or_merge",
    "record_delivery_reference",
    "set_receipt_status_to_delivered_failed_or_cancelled",
  ];
  if (artifacts.some((artifact) => artifact.domain_pack === "law-firm")) {
    checklist.push("confirm_attorney_delivery_approval");
  }
  if (artifacts.some((artifact) => Number(artifact.citation_count ?? 0) > 0)) {
    checklist.push("confirm_citation_spot_check_completed");
  }
  checklist.push("rerun_delivery_closeout_validate", "rerun_delivery_closeout_apply", "rerun_post_delivery_reconciliation", "rebuild_dashboard");
  return [...new Set(checklist)];
}

function buildReceiptInputDraft(generatedAt, executionDraft, closeoutItems) {
  return {
    schema_version: "delivery-receipts-input.v1",
    generated_at: generatedAt,
    execution_plan_id: executionDraft?.execution_plan_id ?? "delivery-execution.unknown",
    instructions: "Fill receipt_status, executed_by, executed_at, delivery_reference, and notes after manual closeout. Pending receipts do not patch delivered state.",
    receipts: closeoutItems.map((item) => item.receipt_form_draft),
  };
}

function summarizeCloseoutQueue(postDeliveryResult, executionDraftResult, receiptTemplateResult, outputCatalogResult, closeoutItems) {
  return {
    post_delivery_available: postDeliveryResult.ok,
    execution_draft_available: executionDraftResult.ok,
    receipt_template_available: receiptTemplateResult.ok,
    output_catalog_available: outputCatalogResult.ok,
    closeout_item_count: closeoutItems.length,
    awaiting_execution_count: closeoutItems.filter((item) => item.status === "awaiting_manual_execution").length,
    blocked_closeout_count: closeoutItems.filter((item) => item.status.startsWith("blocked_")).length,
    high_priority_count: closeoutItems.filter((item) => ["critical", "high"].includes(item.priority)).length,
    artifact_count: closeoutItems.reduce((sum, item) => sum + item.artifact_count, 0),
    receipt_form_count: closeoutItems.length,
    law_firm_count: closeoutItems.filter((item) => item.domain_packs.includes("law-firm")).length,
    personal_dev_count: closeoutItems.filter((item) => item.domain_packs.includes("personal-dev")).length,
    creative_document_count: closeoutItems.filter((item) => item.domain_packs.includes("creative-document")).length,
    by_status: countBy(closeoutItems, "status"),
    by_delivery_channel: countBy(closeoutItems, "delivery_channel"),
    by_delivery_target: countBy(closeoutItems, "delivery_target"),
    by_primary_domain_pack: countBy(closeoutItems, "primary_domain_pack"),
  };
}

function renderDeliveryCloseoutQueueMarkdown(queue) {
  const lines = [];
  lines.push("# Delivery Closeout Queue");
  lines.push("");
  lines.push(`Generated: ${queue.generated_at}`);
  lines.push("");
  lines.push(`- Closeout items: ${queue.summary.closeout_item_count}`);
  lines.push(`- Awaiting execution: ${queue.summary.awaiting_execution_count}`);
  lines.push(`- Blocked closeouts: ${queue.summary.blocked_closeout_count}`);
  lines.push(`- Receipt forms: ${queue.summary.receipt_form_count}`);
  lines.push("");
  lines.push("## Closeout Items");
  lines.push("");
  for (const item of queue.closeout_items) {
    lines.push(`- [${item.priority}] ${item.packet_id}: ${item.status} -> ${item.delivery_target} (${item.artifact_count} artifact(s))`);
  }
  if (queue.closeout_items.length === 0) lines.push("- No outstanding delivery closeout items.");
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

function compareCloseoutItems(left, right) {
  return (
    rankPriority(left.priority) - rankPriority(right.priority) ||
    left.matter_id.localeCompare(right.matter_id) ||
    left.delivery_target.localeCompare(right.delivery_target) ||
    left.packet_id.localeCompare(right.packet_id)
  );
}

function rankPriority(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
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
    postDeliveryPath: DEFAULT_POST_DELIVERY_RECONCILIATION_PATH,
    executionDraftPath: DEFAULT_DELIVERY_EXECUTION_DRAFT_PATH,
    receiptTemplatePath: DEFAULT_RECEIPT_TEMPLATE_PATH,
    outputCatalogPath: DEFAULT_CLOSEOUT_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_DELIVERY_CLOSEOUT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--post-delivery") parsed.postDeliveryPath = argv[++index];
    else if (arg === "--execution-draft") parsed.executionDraftPath = argv[++index];
    else if (arg === "--receipt-template") parsed.receiptTemplatePath = argv[++index];
    else if (arg === "--no-receipt-template") parsed.receiptTemplatePath = false;
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputCatalogPath = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/delivery-closeout-queue.mjs [options]

Options:
  --post-delivery <path>      post-delivery-reconciliation.json path.
  --execution-draft <path>    delivery-execution-draft.json path.
  --receipt-template <path>   receipt-template.json path.
  --no-receipt-template       Build closeout queue without receipt form drafts.
  --output-catalog <path>     receipt-patched output catalog path.
  --no-output-catalog         Do not include artifact detail context.
  --out-dir <folder>          Output directory.
  --run-at <iso>              Deterministic generated_at timestamp.
  -h, --help                  Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
