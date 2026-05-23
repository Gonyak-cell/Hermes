import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DELIVERY_EXECUTION_DRAFT_OUT_DIR = "artifacts/delivery-execution/latest";
export const DEFAULT_DELIVERY_EXECUTION_QUEUE_PATH = "artifacts/approval-inbox-decisions/latest/patched-delivery-queue.json";
export const DEFAULT_DELIVERY_EXECUTION_OUTPUT_CATALOG_PATH = "artifacts/approval-inbox-decisions/latest/patched-output-catalog.json";

export async function runDeliveryExecutionDraft(options = {}) {
  const result = await buildDeliveryExecutionDraft(options);
  if (options.write !== false) await writeDeliveryExecutionDraft(result, result.output_dir);
  return result;
}

export async function buildDeliveryExecutionDraft(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DELIVERY_EXECUTION_DRAFT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const deliveryQueuePath = path.resolve(options.deliveryQueuePath ?? DEFAULT_DELIVERY_EXECUTION_QUEUE_PATH);
  const outputCatalogPath = options.outputCatalogPath === false
    ? null
    : path.resolve(options.outputCatalogPath ?? DEFAULT_DELIVERY_EXECUTION_OUTPUT_CATALOG_PATH);
  const deliveryQueueResult = await readJsonOrError(deliveryQueuePath);
  const outputCatalogResult = outputCatalogPath ? await readJsonOrError(outputCatalogPath) : { ok: false, value: null, error: "disabled" };
  const artifactById = new Map((outputCatalogResult.value?.artifacts ?? []).map((artifact) => [artifact.artifact_id, artifact]));
  const candidates = (deliveryQueueResult.value?.delivery_actions ?? [])
    .filter((action) => action.delivery_status === "ready_for_delivery")
    .map((action) => buildExecutionCandidate(action, artifactById.get(action.artifact_id)))
    .sort(compareExecutionCandidates);
  const blockedCandidates = (deliveryQueueResult.value?.delivery_actions ?? [])
    .filter((action) => action.delivery_status !== "ready_for_delivery" && action.delivery_status !== "delivered")
    .map((action) => buildBlockedCandidate(action));
  const packets = buildExecutionPackets(candidates);
  const draft = {
    schema_version: "delivery-execution-draft.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    execution_plan_id: `delivery-execution.${dateStamp(generatedAt)}`,
    execution_mode: "draft_only",
    summary: summarizeExecutionDraft(deliveryQueueResult, outputCatalogResult, candidates, blockedCandidates, packets),
    sources: [
      buildSource("delivery_queue", "Patched Delivery Queue", deliveryQueuePath, deliveryQueueResult),
      buildSource("output_catalog", "Patched Output Catalog", outputCatalogPath, outputCatalogResult),
    ],
    execution_candidates: candidates,
    blocked_candidates: blockedCandidates,
    execution_packets: packets,
  };

  return {
    ...draft,
    markdown: renderDeliveryExecutionDraftMarkdown(draft),
  };
}

export async function writeDeliveryExecutionDraft(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "delivery-execution-draft.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    execution_plan_id: result.execution_plan_id,
    execution_mode: result.execution_mode,
    summary: result.summary,
    sources: result.sources,
    execution_candidates: result.execution_candidates,
    blocked_candidates: result.blocked_candidates,
    execution_packets: result.execution_packets,
  });
  await writeJson(path.join(outDir, "execution-packets.json"), {
    schema_version: "delivery-execution-packets.v1",
    generated_at: result.generated_at,
    execution_plan_id: result.execution_plan_id,
    execution_mode: result.execution_mode,
    packets: result.execution_packets,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeliveryExecutionDraftCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runDeliveryExecutionDraft(args);
  console.log(`Delivery execution draft written to ${result.output_dir}`);
  console.log(`Ready candidates: ${result.summary.ready_candidate_count}`);
  console.log(`Execution packets: ${result.summary.execution_packet_count}`);
  console.log(`Execution mode: ${result.execution_mode}`);
}

function buildExecutionCandidate(action, artifact) {
  return {
    execution_candidate_id: `execution.${slugify(action.delivery_action_id)}`,
    delivery_action_id: action.delivery_action_id,
    artifact_id: action.artifact_id,
    artifact_type: action.artifact_type,
    artifact_uri: action.artifact_uri,
    domain_pack: action.domain_pack,
    capability_id: action.capability_id,
    workflow_run_id: action.workflow_run_id,
    tenant_id: action.tenant_id,
    matter_id: action.matter_id,
    delivery_target: action.delivery_target,
    delivery_channel: action.delivery_channel,
    priority: action.priority,
    execution_status: "draft_not_executed",
    protected_action: true,
    requires_manual_execution: true,
    final_check_required: true,
    execution_command: buildExecutionCommand(action),
    checklist: buildExecutionChecklist(action, artifact),
    artifact_context: {
      approval_status: action.approval_status ?? artifact?.approval_status ?? null,
      delivery_state: artifact?.delivery_state ?? action.delivery_status,
      output_status: artifact?.status ?? action.metadata?.output_status ?? null,
      citation_count: artifact?.citation_count ?? action.metadata?.citation_count ?? 0,
      content_hash: action.metadata?.content_hash ?? artifact?.content_hash ?? null,
    },
    metadata: {
      source_label: action.source_label,
      source_id: action.source_id,
      runtime_seconds: action.runtime_seconds ?? 0,
      created_at: action.created_at,
    },
  };
}

function buildBlockedCandidate(action) {
  return {
    delivery_action_id: action.delivery_action_id,
    artifact_id: action.artifact_id,
    domain_pack: action.domain_pack,
    matter_id: action.matter_id,
    delivery_target: action.delivery_target,
    delivery_channel: action.delivery_channel,
    delivery_status: action.delivery_status,
    priority: action.priority,
    blocked_reasons: action.blocked_reasons ?? [],
    recommended_actions: action.recommended_actions ?? [],
  };
}

function buildExecutionCommand(action) {
  if (action.delivery_channel === "github") {
    return {
      command_type: "manual_github_review",
      label: "Open PR draft or merge review manually",
      target: action.delivery_target,
      action: "review_then_create_or_merge_pr",
    };
  }
  if (action.delivery_target === "attorney_review_packet") {
    return {
      command_type: "manual_legal_delivery",
      label: "Package for attorney review manually",
      target: action.delivery_target,
      action: "prepare_attorney_review_packet",
    };
  }
  if (action.delivery_target === "deck_review_packet") {
    return {
      command_type: "manual_document_delivery",
      label: "Package deck for human review manually",
      target: action.delivery_target,
      action: "prepare_deck_review_packet",
    };
  }
  return {
    command_type: "manual_export",
    label: "Export reviewed artifact manually",
    target: action.delivery_target,
    action: "manual_export_after_final_check",
  };
}

function buildExecutionChecklist(action, artifact) {
  const checklist = [
    "confirm_destination",
    "confirm_latest_artifact",
    "confirm_human_approval_record",
    "confirm_no_blocking_gates",
  ];
  if (action.domain_pack === "law-firm") checklist.push("confirm_attorney_review", "confirm_confidentiality_scope");
  if (action.delivery_channel === "github") checklist.push("rerun_canonical_tests", "review_diff_before_merge");
  if ((artifact?.citation_count ?? action.metadata?.citation_count ?? 0) > 0) checklist.push("spot_check_citations");
  checklist.push("execute_manually_and_record_delivery_event");
  return [...new Set(checklist)];
}

function buildExecutionPackets(candidates) {
  const packetMap = new Map();
  for (const candidate of candidates) {
    const packetKey = `${candidate.tenant_id}:${candidate.matter_id}:${candidate.delivery_channel}:${candidate.delivery_target}`;
    if (!packetMap.has(packetKey)) {
      packetMap.set(packetKey, {
        packet_id: `delivery-packet.${shortHash(packetKey)}`,
        packet_key: packetKey,
        tenant_id: candidate.tenant_id,
        matter_id: candidate.matter_id,
        delivery_channel: candidate.delivery_channel,
        delivery_target: candidate.delivery_target,
        priority: candidate.priority,
        execution_status: "draft_not_executed",
        candidate_count: 0,
        artifact_ids: [],
        execution_candidate_ids: [],
        final_check_required: true,
        requires_manual_execution: true,
        checklist: [],
      });
    }
    const packet = packetMap.get(packetKey);
    packet.candidate_count += 1;
    packet.artifact_ids.push(candidate.artifact_id);
    packet.execution_candidate_ids.push(candidate.execution_candidate_id);
    packet.priority = rankPriority(candidate.priority) < rankPriority(packet.priority) ? candidate.priority : packet.priority;
    packet.checklist = [...new Set([...packet.checklist, ...candidate.checklist])];
  }
  return [...packetMap.values()].sort(compareExecutionPackets);
}

function summarizeExecutionDraft(deliveryQueueResult, outputCatalogResult, candidates, blockedCandidates, packets) {
  return {
    delivery_queue_available: deliveryQueueResult.ok,
    output_catalog_available: outputCatalogResult.ok,
    ready_candidate_count: candidates.length,
    blocked_candidate_count: blockedCandidates.length,
    execution_packet_count: packets.length,
    manual_execution_required_count: candidates.filter((candidate) => candidate.requires_manual_execution).length,
    final_check_required_count: candidates.filter((candidate) => candidate.final_check_required).length,
    high_priority_count: candidates.filter((candidate) => ["critical", "high"].includes(candidate.priority)).length,
    law_firm_count: candidates.filter((candidate) => candidate.domain_pack === "law-firm").length,
    personal_dev_count: candidates.filter((candidate) => candidate.domain_pack === "personal-dev").length,
    creative_document_count: candidates.filter((candidate) => candidate.domain_pack === "creative-document").length,
    by_delivery_channel: countBy(candidates, "delivery_channel"),
    by_delivery_target: countBy(candidates, "delivery_target"),
    by_domain_pack: countBy(candidates, "domain_pack"),
  };
}

function renderDeliveryExecutionDraftMarkdown(draft) {
  const lines = [];
  lines.push("# Delivery Execution Draft");
  lines.push("");
  lines.push(`Generated: ${draft.generated_at}`);
  lines.push(`Execution mode: ${draft.execution_mode}`);
  lines.push("");
  lines.push(`- Ready candidates: ${draft.summary.ready_candidate_count}`);
  lines.push(`- Execution packets: ${draft.summary.execution_packet_count}`);
  lines.push(`- Blocked candidates: ${draft.summary.blocked_candidate_count}`);
  lines.push(`- Manual execution required: ${draft.summary.manual_execution_required_count}`);
  lines.push("");
  lines.push("## Packets");
  lines.push("");
  for (const packet of draft.execution_packets) {
    lines.push(`- [${packet.priority}] ${packet.packet_id}: ${packet.candidate_count} item(s) -> ${packet.delivery_target} (${packet.delivery_channel})`);
  }
  if (draft.execution_packets.length === 0) lines.push("- No execution packets are ready.");
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
    error: result.ok ? null : result.error,
  };
}

function compareExecutionCandidates(left, right) {
  return (
    rankPriority(left.priority) - rankPriority(right.priority) ||
    left.matter_id.localeCompare(right.matter_id) ||
    left.artifact_id.localeCompare(right.artifact_id)
  );
}

function compareExecutionPackets(left, right) {
  return (
    rankPriority(left.priority) - rankPriority(right.priority) ||
    left.matter_id.localeCompare(right.matter_id) ||
    left.delivery_target.localeCompare(right.delivery_target)
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

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    deliveryQueuePath: DEFAULT_DELIVERY_EXECUTION_QUEUE_PATH,
    outputCatalogPath: DEFAULT_DELIVERY_EXECUTION_OUTPUT_CATALOG_PATH,
    outDir: DEFAULT_DELIVERY_EXECUTION_DRAFT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputCatalogPath = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/delivery-execution-draft.mjs [options]

Options:
  --delivery-queue <path>   patched-delivery-queue.json path.
  --output-catalog <path>   patched-output-catalog.json path.
  --no-output-catalog       Do not enrich candidates with output catalog context.
  --out-dir <folder>        Output directory.
  --run-at <iso>            Deterministic generated_at timestamp.
  -h, --help                Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
