import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PROTECTED_DELIVERY_QUEUE_OUT_DIR = "artifacts/delivery-queue/latest";
export const DEFAULT_OUTPUT_CATALOG_PATH = "artifacts/output-catalog/latest/output-catalog.json";
export const DEFAULT_OBSERVABILITY_CATALOG_PATH = "artifacts/observability/latest/observability-catalog.json";

export async function runProtectedDeliveryQueue(options = {}) {
  const result = await buildProtectedDeliveryQueue(options);
  if (options.write !== false) await writeProtectedDeliveryQueue(result, result.output_dir);
  return result;
}

export async function buildProtectedDeliveryQueue(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PROTECTED_DELIVERY_QUEUE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputCatalogPath = path.resolve(options.outputCatalogPath ?? DEFAULT_OUTPUT_CATALOG_PATH);
  const observabilityCatalogPath = options.observabilityCatalogPath === false
    ? null
    : path.resolve(options.observabilityCatalogPath ?? DEFAULT_OBSERVABILITY_CATALOG_PATH);
  const outputCatalogResult = await readJsonOrError(outputCatalogPath);
  const observabilityCatalogResult = observabilityCatalogPath ? await readJsonOrError(observabilityCatalogPath) : { ok: false, value: null, error: "disabled" };
  const outputCatalog = outputCatalogResult.value;
  const observabilityCatalog = observabilityCatalogResult.value;
  const runRecords = new Map((observabilityCatalog?.run_records ?? []).map((run) => [run.workflow_run_id, run]));
  const deliveryActions = (outputCatalog?.artifacts ?? []).map((artifact) => buildDeliveryAction(artifact, runRecords.get(artifact.workflow_run_id)));
  const queue = {
    schema_version: "protected-delivery-queue.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary: summarizeDeliveryQueue(outputCatalogResult, observabilityCatalogResult, deliveryActions),
    sources: [
      buildSource("output_artifact_catalog", "Output Artifact Catalog", outputCatalogPath, outputCatalogResult),
      buildSource("observability_catalog", "Observability Catalog", observabilityCatalogPath, observabilityCatalogResult),
    ],
    delivery_actions: deliveryActions,
  };

  return {
    ...queue,
    markdown: renderProtectedDeliveryQueueMarkdown(queue),
  };
}

export async function writeProtectedDeliveryQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "protected-delivery-queue.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    delivery_actions: result.delivery_actions,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runProtectedDeliveryQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runProtectedDeliveryQueue(args);
  console.log(`Protected delivery queue written to ${result.output_dir}`);
  console.log(`Delivery actions: ${result.summary.delivery_action_count}`);
  console.log(`Blocked actions: ${result.summary.blocked_action_count}`);
  console.log(`Ready actions: ${result.summary.ready_action_count}`);
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

function buildDeliveryAction(artifact, runRecord) {
  const deliveryProfile = deriveDeliveryProfile(artifact);
  const deliveryStatus = deriveDeliveryStatus(artifact);
  const blockedReasons = deriveBlockedReasons(artifact);
  return {
    delivery_action_id: `delivery.${slugify(artifact.artifact_id)}`,
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    artifact_uri: artifact.artifact_uri,
    domain_pack: artifact.domain_pack,
    capability_id: artifact.capability_id,
    workflow_run_id: artifact.workflow_run_id,
    tenant_id: artifact.tenant_id,
    matter_id: artifact.matter_id,
    delivery_target: deliveryProfile.delivery_target,
    delivery_channel: deliveryProfile.delivery_channel,
    delivery_status: deliveryStatus,
    priority: derivePriority(artifact, deliveryStatus),
    protected_action: deliveryStatus !== "delivered",
    required_approval_id: artifact.approval_id,
    approval_status: artifact.approval_status,
    blocking_gate_ids: artifact.blocking_gate_ids ?? [],
    blocked_reasons: blockedReasons,
    recommended_actions: deriveRecommendedActions(artifact, deliveryStatus),
    run_status: runRecord?.status ?? null,
    runtime_seconds: runRecord?.runtime_seconds ?? 0,
    source_id: artifact.source_id,
    source_label: artifact.source_label,
    created_at: artifact.created_at,
    metadata: {
      content_hash: artifact.content_hash,
      citation_count: artifact.citation_count,
      output_status: artifact.status,
      original_delivery_state: artifact.delivery_state,
    },
  };
}

function deriveDeliveryProfile(artifact) {
  if (artifact.artifact_type === "pr_draft") {
    return {
      delivery_target: "github_pr_or_merge",
      delivery_channel: "github",
    };
  }
  if (artifact.domain_pack === "law-firm") {
    return {
      delivery_target: artifact.artifact_type === "markdown" ? "attorney_review_packet" : "matter_output",
      delivery_channel: "manual_export",
    };
  }
  if (artifact.domain_pack === "creative-document") {
    return {
      delivery_target: artifact.artifact_type === "pptx" ? "deck_review_packet" : "supporting_document",
      delivery_channel: "manual_export",
    };
  }
  return {
    delivery_target: "manual_review_packet",
    delivery_channel: "manual_export",
  };
}

function deriveDeliveryStatus(artifact) {
  if (artifact.delivery_state === "ready_for_delivery") return "ready_for_delivery";
  if (artifact.delivery_state === "delivered") return "delivered";
  return artifact.delivery_state;
}

function deriveBlockedReasons(artifact) {
  const reasons = [];
  if (artifact.delivery_state === "draft_only") reasons.push("draft_only");
  if (artifact.delivery_state === "blocked_pending_approval") reasons.push("approval_pending");
  if (artifact.delivery_state === "blocked_by_gate") reasons.push("blocking_gate");
  if (artifact.delivery_state === "blocked_by_decision") reasons.push("approval_decision_blocked");
  for (const gateId of artifact.blocking_gate_ids ?? []) reasons.push(`gate:${gateId}`);
  return [...new Set(reasons)];
}

function deriveRecommendedActions(artifact, deliveryStatus) {
  if (deliveryStatus === "ready_for_delivery") return ["confirm_destination", "execute_delivery_after_final_check"];
  if (deliveryStatus === "delivered") return ["no_action"];
  if (deliveryStatus === "blocked_pending_approval") return ["review_output_artifact", "approve_or_request_changes", "rerun_delivery_queue"];
  if (deliveryStatus === "blocked_by_gate") return ["resolve_blocking_gate", "rerun_output_catalog", "rerun_delivery_queue"];
  if (deliveryStatus === "blocked_by_decision") return ["review_decision", "revise_output_artifact"];
  return ["complete_required_review", "rerun_delivery_queue"];
}

function derivePriority(artifact, deliveryStatus) {
  if (deliveryStatus === "ready_for_delivery") return "high";
  if (artifact.domain_pack === "law-firm" && deliveryStatus.startsWith("blocked_")) return "high";
  if (deliveryStatus === "blocked_pending_approval") return "medium";
  if (deliveryStatus === "blocked_by_gate") return "medium";
  return "low";
}

function summarizeDeliveryQueue(outputCatalogResult, observabilityCatalogResult, deliveryActions) {
  return {
    output_catalog_available: outputCatalogResult.ok,
    observability_catalog_available: observabilityCatalogResult.ok,
    delivery_action_count: deliveryActions.length,
    protected_action_count: deliveryActions.filter((action) => action.protected_action).length,
    blocked_action_count: deliveryActions.filter((action) => action.delivery_status.startsWith("blocked_") || action.delivery_status === "draft_only").length,
    pending_approval_count: deliveryActions.filter((action) => action.delivery_status === "blocked_pending_approval").length,
    blocked_by_gate_count: deliveryActions.filter((action) => action.delivery_status === "blocked_by_gate").length,
    ready_action_count: deliveryActions.filter((action) => action.delivery_status === "ready_for_delivery").length,
    delivered_action_count: deliveryActions.filter((action) => action.delivery_status === "delivered").length,
    law_firm_action_count: deliveryActions.filter((action) => action.domain_pack === "law-firm").length,
    personal_dev_action_count: deliveryActions.filter((action) => action.domain_pack === "personal-dev").length,
    creative_document_action_count: deliveryActions.filter((action) => action.domain_pack === "creative-document").length,
    total_runtime_seconds: sumBy(deliveryActions, "runtime_seconds"),
    by_delivery_status: countBy(deliveryActions, "delivery_status"),
    by_delivery_channel: countBy(deliveryActions, "delivery_channel"),
    by_delivery_target: countBy(deliveryActions, "delivery_target"),
    by_domain_pack: countBy(deliveryActions, "domain_pack"),
  };
}

function renderProtectedDeliveryQueueMarkdown(queue) {
  const lines = [];
  lines.push("# Protected Delivery Queue");
  lines.push("");
  lines.push(`Generated: ${queue.generated_at}`);
  lines.push("");
  lines.push(`- Delivery actions: ${queue.summary.delivery_action_count}`);
  lines.push(`- Protected actions: ${queue.summary.protected_action_count}`);
  lines.push(`- Blocked actions: ${queue.summary.blocked_action_count}`);
  lines.push(`- Pending approvals: ${queue.summary.pending_approval_count}`);
  lines.push(`- Ready actions: ${queue.summary.ready_action_count}`);
  lines.push("");
  lines.push("## Actions");
  lines.push("");
  for (const action of queue.delivery_actions) {
    lines.push(`- [${action.priority}] ${action.artifact_id} -> ${action.delivery_target} (${action.delivery_status})`);
  }
  if (queue.delivery_actions.length === 0) lines.push("- No delivery actions found.");
  return `${lines.join("\n")}\n`;
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

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_PROTECTED_DELIVERY_QUEUE_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--no-observability-catalog") parsed.observabilityCatalogPath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/protected-delivery-queue.mjs [options]

Options:
  --output-catalog <path>          output-catalog.json path.
  --observability-catalog <path>   observability-catalog.json path.
  --no-observability-catalog       Do not enrich delivery actions with run records.
  --out-dir <folder>               Output directory.
  --run-at <iso>                   Deterministic generated_at timestamp.
  -h, --help                       Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
