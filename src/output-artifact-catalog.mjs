import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OUTPUT_ARTIFACT_CATALOG_OUT_DIR = "artifacts/output-catalog/latest";

export const DEFAULT_OUTPUT_ARTIFACT_SOURCES = [
  {
    source_id: "vertical_slice",
    label: "First Vertical Slice",
    path: "artifacts/vertical-slice/latest/vertical-slice.json",
  },
  {
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    path: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  },
  {
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    path: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  },
  {
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
    path: "artifacts/creative-document-slice/latest/creative-document-slice.json",
  },
];

export async function runOutputArtifactCatalog(options = {}) {
  const result = await buildOutputArtifactCatalog(options);
  if (options.write !== false) await writeOutputArtifactCatalog(result, result.output_dir);
  return result;
}

export async function buildOutputArtifactCatalog(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OUTPUT_ARTIFACT_CATALOG_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const sourceDefinitions = normalizeSourceDefinitions(options.sources ?? buildSourceDefinitionsFromOptions(options));
  const sourceResults = await readSliceSources(sourceDefinitions);
  const artifacts = sourceResults.flatMap((source) => source.available ? extractOutputArtifacts(source) : []);
  const catalog = {
    schema_version: "output-artifact-catalog.v1",
    generated_at: generatedAt,
    output_dir: outputDir,
    summary: summarizeArtifacts(sourceResults, artifacts),
    sources: sourceResults.map(({ data, ...source }) => source),
    artifacts,
  };

  return {
    ...catalog,
    markdown: renderOutputArtifactCatalogMarkdown(catalog),
  };
}

export async function writeOutputArtifactCatalog(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "output-catalog.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    summary: result.summary,
    sources: result.sources,
    artifacts: result.artifacts,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOutputArtifactCatalogCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runOutputArtifactCatalog(args);
  console.log(`Output artifact catalog written to ${result.output_dir}`);
  console.log(`Artifacts: ${result.summary.artifact_count}`);
  console.log(`Pending approvals: ${result.summary.approval_pending_count}`);
  console.log(`Blocked delivery: ${result.summary.blocked_delivery_count}`);
}

function normalizeSourceDefinitions(sources) {
  return sources.map((source) => ({
    source_id: source.source_id,
    label: source.label,
    path: path.resolve(source.path),
  }));
}

function buildSourceDefinitionsFromOptions(options) {
  const overrides = new Map();
  if (options.verticalSlicePath !== undefined) overrides.set("vertical_slice", options.verticalSlicePath);
  if (options.lawFirmSlicePath !== undefined) overrides.set("law_firm_ldd_slice", options.lawFirmSlicePath);
  if (options.personalDevSlicePath !== undefined) overrides.set("personal_dev_slice", options.personalDevSlicePath);
  if (options.creativeDocumentSlicePath !== undefined) overrides.set("creative_document_slice", options.creativeDocumentSlicePath);

  return DEFAULT_OUTPUT_ARTIFACT_SOURCES
    .filter((source) => overrides.get(source.source_id) !== false)
    .map((source) => ({
      ...source,
      path: overrides.has(source.source_id) ? overrides.get(source.source_id) : source.path,
    }));
}

async function readSliceSources(sourceDefinitions) {
  const results = [];
  for (const source of sourceDefinitions) {
    try {
      const data = JSON.parse(await readFile(source.path, "utf8"));
      const outputArtifacts = data.governance_output?.output_artifacts ?? [];
      results.push({
        source_id: source.source_id,
        label: source.label,
        path: source.path,
        available: true,
        schema_version: data.schema_version ?? null,
        generated_at: data.generated_at ?? null,
        artifact_count: outputArtifacts.length,
        error: null,
        data,
      });
    } catch (error) {
      results.push({
        source_id: source.source_id,
        label: source.label,
        path: source.path,
        available: false,
        schema_version: null,
        generated_at: null,
        artifact_count: 0,
        error: error.code === "ENOENT" ? "not_found" : error.message,
        data: null,
      });
    }
  }
  return results;
}

function extractOutputArtifacts(source) {
  const slice = source.data;
  const workflowRuns = new Map((slice.workflow_runtime?.workflow_runs ?? []).map((run) => [run.id, run]));
  const capabilities = new Map((slice.workflow_runtime?.capabilities ?? []).map((capability) => [capability.id, capability]));
  const approvalsByArtifactId = groupBy(slice.governance_output?.approvals ?? [], "output_artifact_id");
  const gatesByWorkflowRunId = groupBy(slice.governance_output?.gate_results ?? [], "workflow_run_id");

  return (slice.governance_output?.output_artifacts ?? []).map((artifact) => {
    const workflowRun = workflowRuns.get(artifact.created_by_run_id)
      ?? workflowRuns.get(artifact.metadata?.workflow_run_id)
      ?? [...workflowRuns.values()].find((run) => (run.output_refs ?? []).includes(artifact.id))
      ?? null;
    const capability = workflowRun ? capabilities.get(workflowRun.capability_id) : null;
    const approvals = approvalsByArtifactId.get(artifact.id) ?? [];
    const approval = approvals[0] ?? null;
    const gates = workflowRun ? gatesByWorkflowRunId.get(workflowRun.id) ?? [] : [];
    const blockingGates = gates.filter((gate) => gate.blocking && gate.status !== "passed");
    const approvalStatus = approval?.approval_status ?? null;
    const deliveryState = deriveDeliveryState(artifact, approvalStatus, blockingGates);

    return {
      artifact_id: artifact.id,
      source_id: source.source_id,
      source_label: source.label,
      domain_pack: capability?.domain_pack ?? inferDomainPackFromSource(source.source_id),
      capability_id: workflowRun?.capability_id ?? null,
      workflow_run_id: workflowRun?.id ?? null,
      tenant_id: artifact.tenant_id,
      matter_id: artifact.matter_id,
      artifact_type: artifact.artifact_type,
      artifact_uri: artifact.artifact_uri,
      content_hash: artifact.content_hash,
      status: artifact.status,
      delivery_state: deliveryState,
      approval_id: approval?.id ?? null,
      approval_status: approvalStatus,
      blocking_gate_count: blockingGates.length,
      blocking_gate_ids: blockingGates.map((gate) => gate.gate_id),
      citation_count: artifact.citation_ids?.length ?? 0,
      created_by_run_id: artifact.created_by_run_id,
      created_at: artifact.created_at,
      metadata: artifact.metadata ?? {},
    };
  });
}

function summarizeArtifacts(sources, artifacts) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    artifact_count: artifacts.length,
    draft_count: artifacts.filter((artifact) => artifact.status === "draft").length,
    pending_review_count: artifacts.filter((artifact) => artifact.status === "pending_review").length,
    approved_count: artifacts.filter((artifact) => artifact.status === "approved").length,
    delivered_count: artifacts.filter((artifact) => artifact.status === "delivered").length,
    approval_pending_count: artifacts.filter((artifact) => artifact.approval_status === "pending").length,
    blocked_delivery_count: artifacts.filter((artifact) => artifact.delivery_state.startsWith("blocked_")).length,
    blocking_gate_count: artifacts.reduce((count, artifact) => count + artifact.blocking_gate_count, 0),
    by_artifact_type: countBy(artifacts, "artifact_type"),
    by_domain_pack: countBy(artifacts, "domain_pack"),
    by_delivery_state: countBy(artifacts, "delivery_state"),
  };
}

function deriveDeliveryState(artifact, approvalStatus, blockingGates) {
  if (artifact.status === "delivered") return "delivered";
  if (approvalStatus === "approved" && blockingGates.length === 0) return "ready_for_delivery";
  if (approvalStatus === "rejected" || approvalStatus === "changes_requested") return "blocked_by_decision";
  if (approvalStatus === "pending") return "blocked_pending_approval";
  if (blockingGates.length > 0) return "blocked_by_gate";
  return artifact.status === "approved" ? "ready_for_delivery" : "draft_only";
}

function renderOutputArtifactCatalogMarkdown(catalog) {
  const lines = [];
  lines.push("# Output Artifact Catalog");
  lines.push("");
  lines.push(`Generated: ${catalog.generated_at}`);
  lines.push("");
  lines.push(`- Artifacts: ${catalog.summary.artifact_count}`);
  lines.push(`- Pending approvals: ${catalog.summary.approval_pending_count}`);
  lines.push(`- Blocked delivery: ${catalog.summary.blocked_delivery_count}`);
  lines.push(`- Blocking gates: ${catalog.summary.blocking_gate_count}`);
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  for (const artifact of catalog.artifacts) {
    lines.push(`- ${artifact.artifact_id} (${artifact.artifact_type}, ${artifact.delivery_state})`);
  }
  if (catalog.artifacts.length === 0) lines.push("- No output artifacts found.");
  return `${lines.join("\n")}\n`;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
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

function inferDomainPackFromSource(sourceId) {
  if (sourceId === "law_firm_ldd_slice") return "law-firm";
  if (sourceId === "personal_dev_slice") return "personal-dev";
  if (sourceId === "creative_document_slice") return "creative-document";
  return "platform";
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_OUTPUT_ARTIFACT_CATALOG_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--no-vertical-slice") parsed.verticalSlicePath = false;
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--no-law-firm-slice") parsed.lawFirmSlicePath = false;
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--no-personal-dev-slice") parsed.personalDevSlicePath = false;
    else if (arg === "--creative-document-slice") parsed.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--no-creative-document-slice") parsed.creativeDocumentSlicePath = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/output-artifact-catalog.mjs [options]

Options:
  --vertical-slice <path>            vertical-slice.json path.
  --no-vertical-slice                Skip the first vertical slice source.
  --law-firm-slice <path>            law-firm-ldd-slice.json path.
  --no-law-firm-slice                Skip Law Firm LDD source.
  --personal-dev-slice <path>        personal-dev-slice.json path.
  --no-personal-dev-slice            Skip Personal Dev source.
  --creative-document-slice <path>   creative-document-slice.json path.
  --no-creative-document-slice       Skip Creative Document source.
  --out-dir <folder>                 Output directory.
  --run-at <iso>                     Deterministic generated_at timestamp.
  -h, --help                         Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
