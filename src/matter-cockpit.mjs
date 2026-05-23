import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_COCKPIT_OUT_DIR = "artifacts/matter-cockpit/latest";
export const DEFAULT_RESOURCE_EVIDENCE_PATH = "artifacts/resource-ingest/latest/resource-evidence.json";
export const DEFAULT_OUTPUT_CATALOG_PATH = "artifacts/output-catalog/latest/output-catalog.json";
export const DEFAULT_OBSERVABILITY_CATALOG_PATH = "artifacts/observability/latest/observability-catalog.json";
export const DEFAULT_DELIVERY_QUEUE_PATH = "artifacts/delivery-queue/latest/protected-delivery-queue.json";

export async function runMatterCockpit(options = {}) {
  const result = await buildMatterCockpit(options);
  if (options.write !== false) await writeMatterCockpit(result, result.output_dir);
  return result;
}

export async function buildMatterCockpit(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_COCKPIT_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceDefinitions = [
    ["resource_evidence", "Resource Evidence", options.resourceEvidencePath ?? DEFAULT_RESOURCE_EVIDENCE_PATH],
    ["output_artifact_catalog", "Output Artifact Catalog", options.outputCatalogPath ?? DEFAULT_OUTPUT_CATALOG_PATH],
    ["observability_catalog", "Observability Catalog", options.observabilityCatalogPath ?? DEFAULT_OBSERVABILITY_CATALOG_PATH],
    ["protected_delivery_queue", "Protected Delivery Queue", options.deliveryQueuePath ?? DEFAULT_DELIVERY_QUEUE_PATH],
  ];
  const sourceResults = await readSources(sourceDefinitions);
  const sourceMap = Object.fromEntries(sourceResults.filter((source) => source.available).map((source) => [source.source_id, source.data]));
  const matterMap = new Map();

  addResourceEvidence(matterMap, sourceMap.resource_evidence);
  addOutputArtifacts(matterMap, sourceMap.output_artifact_catalog);
  addRunRecords(matterMap, sourceMap.observability_catalog);
  addDeliveryActions(matterMap, sourceMap.protected_delivery_queue);

  const matters = [...matterMap.values()]
    .map(finalizeMatterRecord)
    .sort((left, right) => left.matter_id.localeCompare(right.matter_id) || left.tenant_id.localeCompare(right.tenant_id));
  const cockpit = {
    schema_version: "matter-cockpit.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary: summarizeMatters(sourceResults, matters),
    sources: sourceResults.map(({ data, ...source }) => source),
    matters,
  };

  return {
    ...cockpit,
    markdown: renderMatterCockpitMarkdown(cockpit),
  };
}

export async function writeMatterCockpit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "matter-cockpit.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    matters: result.matters,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterCockpitCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runMatterCockpit(args);
  console.log(`Matter cockpit written to ${result.output_dir}`);
  console.log(`Matters: ${result.summary.matter_count}`);
  console.log(`Blocked matters: ${result.summary.blocked_matter_count}`);
  console.log(`Pending approvals: ${result.summary.pending_approval_count}`);
}

async function readSources(definitions) {
  const sources = [];
  for (const [sourceId, label, configuredPath] of definitions) {
    const sourcePath = configuredPath === false ? null : path.resolve(configuredPath);
    if (!sourcePath) {
      sources.push(buildSource(sourceId, label, null, false, null, "disabled"));
      continue;
    }
    try {
      const data = JSON.parse(await readFile(sourcePath, "utf8"));
      sources.push(buildSource(sourceId, label, sourcePath, true, data, null));
    } catch (error) {
      sources.push(buildSource(sourceId, label, sourcePath, false, null, error.code === "ENOENT" ? "not_found" : error.message));
    }
  }
  return sources;
}

function buildSource(sourceId, label, sourcePath, available, data, error) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    available,
    schema_version: data?.schema_version ?? null,
    generated_at: data?.generated_at ?? null,
    summary: summarizeSource(sourceId, data),
    error,
    data,
  };
}

function summarizeSource(sourceId, data) {
  if (!data) return null;
  if (sourceId === "resource_evidence") {
    return {
      resource_count: data.resources?.length ?? 0,
      evidence_count: data.evidence_items?.length ?? 0,
    };
  }
  return data.summary ?? {};
}

function addResourceEvidence(matterMap, resourceEvidence) {
  if (!resourceEvidence) return;
  for (const resource of resourceEvidence.resources ?? []) {
    const record = ensureMatter(matterMap, resource.tenant_id, resource.matter_id);
    record.resource_ids.add(resource.id);
    record.classifications.add(resource.classification);
    record.domain_packs.add(inferDomainPack(resource.metadata?.candidate_domain));
    pushActivity(record, resource.created_at);
  }
  for (const evidence of resourceEvidence.evidence_items ?? []) {
    const tenantId = findTenantForEvidence(resourceEvidence, evidence) ?? "tenant.unknown";
    const record = ensureMatter(matterMap, tenantId, evidence.matter_id);
    record.evidence_ids.add(evidence.id);
    if (evidence.review_status === "needs_review") record.evidence_needs_review_count += 1;
  }
}

function addOutputArtifacts(matterMap, outputCatalog) {
  if (!outputCatalog) return;
  for (const artifact of outputCatalog.artifacts ?? []) {
    const record = ensureMatter(matterMap, artifact.tenant_id, artifact.matter_id);
    record.domain_packs.add(artifact.domain_pack);
    record.output_artifact_ids.add(artifact.artifact_id);
    record.pending_approval_count += artifact.approval_status === "pending" ? 1 : 0;
    record.output_blocked_delivery_count += artifact.delivery_state?.startsWith("blocked_") ? 1 : 0;
    record.output_ready_delivery_count += artifact.delivery_state === "ready_for_delivery" ? 1 : 0;
    record.output_blocking_gate_count += artifact.blocking_gate_count ?? 0;
    pushActivity(record, artifact.created_at);
  }
}

function addRunRecords(matterMap, observabilityCatalog) {
  if (!observabilityCatalog) return;
  for (const run of observabilityCatalog.run_records ?? []) {
    const record = ensureMatter(matterMap, run.tenant_id, run.matter_id);
    record.domain_packs.add(run.domain_pack);
    record.workflow_run_ids.add(run.workflow_run_id);
    record.runtime_ids = new Set([...record.runtime_ids, ...(run.runtime_ids ?? [])]);
    record.runtime_seconds += run.runtime_seconds ?? 0;
    record.run_blocking_gate_count += run.blocking_gate_count ?? 0;
    record.error_count += run.error_count ?? 0;
    pushActivity(record, run.updated_at);
  }
}

function addDeliveryActions(matterMap, deliveryQueue) {
  if (!deliveryQueue) return;
  for (const action of deliveryQueue.delivery_actions ?? []) {
    const record = ensureMatter(matterMap, action.tenant_id, action.matter_id);
    record.domain_packs.add(action.domain_pack);
    record.delivery_action_ids.add(action.delivery_action_id);
    record.high_priority_action_count += ["critical", "high"].includes(action.priority) ? 1 : 0;
    record.delivery_ready_action_count += action.delivery_status === "ready_for_delivery" ? 1 : 0;
    record.delivery_blocked_action_count += action.delivery_status?.startsWith("blocked_") || action.delivery_status === "draft_only" ? 1 : 0;
    record.delivery_channels.add(action.delivery_channel);
    pushActivity(record, action.created_at);
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
      classifications: new Set(),
      runtime_ids: new Set(),
      delivery_channels: new Set(),
      resource_ids: new Set(),
      evidence_ids: new Set(),
      output_artifact_ids: new Set(),
      workflow_run_ids: new Set(),
      delivery_action_ids: new Set(),
      evidence_needs_review_count: 0,
      pending_approval_count: 0,
      output_blocked_delivery_count: 0,
      output_ready_delivery_count: 0,
      delivery_blocked_action_count: 0,
      delivery_ready_action_count: 0,
      output_blocking_gate_count: 0,
      run_blocking_gate_count: 0,
      high_priority_action_count: 0,
      runtime_seconds: 0,
      error_count: 0,
      latest_activity_at: null,
    });
  }
  return matterMap.get(matterKey);
}

function finalizeMatterRecord(record) {
  const status = deriveMatterStatus(record);
  const hasDeliveryQueue = record.delivery_action_ids.size > 0;
  const blockedDeliveryCount = hasDeliveryQueue ? record.delivery_blocked_action_count : record.output_blocked_delivery_count;
  const readyDeliveryCount = hasDeliveryQueue ? record.delivery_ready_action_count : record.output_ready_delivery_count;
  const blockingGateCount = record.output_artifact_ids.size > 0 ? record.output_blocking_gate_count : record.run_blocking_gate_count;
  return {
    matter_key: record.matter_key,
    tenant_id: record.tenant_id,
    matter_id: record.matter_id,
    matter_label: record.matter_id.split(".").slice(-2).join(" "),
    status,
    domain_packs: [...record.domain_packs].filter(Boolean).sort(),
    classifications: [...record.classifications].filter(Boolean).sort(),
    resource_count: record.resource_ids.size,
    evidence_count: record.evidence_ids.size,
    evidence_needs_review_count: record.evidence_needs_review_count,
    output_artifact_count: record.output_artifact_ids.size,
    workflow_run_count: record.workflow_run_ids.size,
    delivery_action_count: record.delivery_action_ids.size,
    pending_approval_count: record.pending_approval_count,
    blocked_delivery_count: blockedDeliveryCount,
    ready_delivery_count: readyDeliveryCount,
    blocking_gate_count: blockingGateCount,
    high_priority_action_count: record.high_priority_action_count,
    runtime_seconds: record.runtime_seconds,
    error_count: record.error_count,
    runtime_ids: [...record.runtime_ids].sort(),
    delivery_channels: [...record.delivery_channels].sort(),
    latest_activity_at: record.latest_activity_at,
    resource_ids: [...record.resource_ids].sort(),
    evidence_ids: [...record.evidence_ids].sort(),
    output_artifact_ids: [...record.output_artifact_ids].sort(),
    workflow_run_ids: [...record.workflow_run_ids].sort(),
    delivery_action_ids: [...record.delivery_action_ids].sort(),
  };
}

function summarizeMatters(sources, matters) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    matter_count: matters.length,
    blocked_matter_count: matters.filter((matter) => matter.status === "blocked").length,
    pending_review_matter_count: matters.filter((matter) => matter.status === "pending_review").length,
    ready_matter_count: matters.filter((matter) => matter.status === "ready").length,
    resource_count: sumBy(matters, "resource_count"),
    evidence_count: sumBy(matters, "evidence_count"),
    output_artifact_count: sumBy(matters, "output_artifact_count"),
    workflow_run_count: sumBy(matters, "workflow_run_count"),
    delivery_action_count: sumBy(matters, "delivery_action_count"),
    pending_approval_count: sumBy(matters, "pending_approval_count"),
    blocked_delivery_count: sumBy(matters, "blocked_delivery_count"),
    blocking_gate_count: sumBy(matters, "blocking_gate_count"),
    runtime_seconds: sumBy(matters, "runtime_seconds"),
    by_status: countBy(matters, "status"),
    by_tenant_id: countBy(matters, "tenant_id"),
    by_primary_domain_pack: countPrimaryDomainPacks(matters),
  };
}

function renderMatterCockpitMarkdown(cockpit) {
  const lines = [];
  lines.push("# Matter Cockpit");
  lines.push("");
  lines.push(`Generated: ${cockpit.generated_at}`);
  lines.push("");
  lines.push(`- Matters: ${cockpit.summary.matter_count}`);
  lines.push(`- Blocked matters: ${cockpit.summary.blocked_matter_count}`);
  lines.push(`- Pending approvals: ${cockpit.summary.pending_approval_count}`);
  lines.push(`- Delivery actions: ${cockpit.summary.delivery_action_count}`);
  lines.push("");
  lines.push("## Matters");
  lines.push("");
  for (const matter of cockpit.matters) {
    lines.push(`- ${matter.matter_id} (${matter.status}) - ${matter.output_artifact_count} output(s), ${matter.delivery_action_count} delivery action(s)`);
  }
  if (cockpit.matters.length === 0) lines.push("- No matter records found.");
  return `${lines.join("\n")}\n`;
}

function deriveMatterStatus(record) {
  const hasDeliveryQueue = record.delivery_action_ids.size > 0;
  const blockedDeliveryCount = hasDeliveryQueue ? record.delivery_blocked_action_count : record.output_blocked_delivery_count;
  const readyDeliveryCount = hasDeliveryQueue ? record.delivery_ready_action_count : record.output_ready_delivery_count;
  const blockingGateCount = record.output_artifact_ids.size > 0 ? record.output_blocking_gate_count : record.run_blocking_gate_count;
  if (record.error_count > 0 || blockedDeliveryCount > 0 || blockingGateCount > 0) return "blocked";
  if (record.pending_approval_count > 0 || record.evidence_needs_review_count > 0) return "pending_review";
  if (readyDeliveryCount > 0) return "ready";
  return "active";
}

function findTenantForEvidence(resourceEvidence, evidence) {
  const spanId = evidence.source_span_ids?.[0];
  const span = (resourceEvidence.source_spans ?? []).find((candidate) => candidate.id === spanId);
  const resourceVersion = (resourceEvidence.resource_versions ?? []).find((candidate) => candidate.id === span?.resource_version_id);
  const resource = (resourceEvidence.resources ?? []).find((candidate) => candidate.id === resourceVersion?.resource_id);
  return resource?.tenant_id;
}

function inferDomainPack(candidateDomain) {
  if (candidateDomain === "law-firm") return "law-firm";
  if (candidateDomain === "personal-dev") return "personal-dev";
  if (candidateDomain === "creative-document") return "creative-document";
  return null;
}

function pushActivity(record, timestamp) {
  if (!timestamp) return;
  if (!record.latest_activity_at || timestamp > record.latest_activity_at) record.latest_activity_at = timestamp;
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
    outDir: DEFAULT_MATTER_COCKPIT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-evidence") parsed.resourceEvidencePath = argv[++index];
    else if (arg === "--no-resource-evidence") parsed.resourceEvidencePath = false;
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--no-output-catalog") parsed.outputCatalogPath = false;
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--no-observability-catalog") parsed.observabilityCatalogPath = false;
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--no-delivery-queue") parsed.deliveryQueuePath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-cockpit.mjs [options]

Options:
  --resource-evidence <path>      resource-evidence.json path.
  --no-resource-evidence          Do not include Resource/Evidence counts.
  --output-catalog <path>         output-catalog.json path.
  --no-output-catalog             Do not include Output Artifact Catalog.
  --observability-catalog <path>  observability-catalog.json path.
  --no-observability-catalog      Do not include Observability Catalog.
  --delivery-queue <path>         protected-delivery-queue.json path.
  --no-delivery-queue             Do not include Protected Delivery Queue.
  --out-dir <folder>              Output directory.
  --run-at <iso>                  Deterministic generated_at timestamp.
  -h, --help                      Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
