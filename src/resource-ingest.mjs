import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_RESOURCE_EXPANSION_JOB = "audits/resource-expansion/latest/resource-expansion-job.json";
export const DEFAULT_RESOURCE_INGEST_OUT_DIR = "artifacts/resource-ingest/latest";

const DEFAULT_IDS = {
  tenantId: "tenant.personal.jws",
  matterId: "matter.unassigned.resource_expansion",
};

export async function runResourceIngest(options = {}) {
  const result = await buildResourceIngest(options);
  if (options.write !== false) await writeResourceIngest(result, result.output_dir);
  return result;
}

export async function buildResourceIngest(options = {}) {
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_RESOURCE_EXPANSION_JOB);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_INGEST_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const expansionJob = JSON.parse(await readFile(inputPath, "utf8"));
  const ids = { ...DEFAULT_IDS, ...options.ids };
  const extractedItems = expansionJob.items.filter((item) => item.status === "extracted");
  const duplicateItems = expansionJob.items.filter((item) => item.status === "skipped_duplicate");
  const blockedItems = expansionJob.items.filter((item) => ["quarantined", "failed"].includes(item.status));
  const resourceEvidence = buildResourceEvidenceSection(extractedItems, {
    generatedAt,
    ids,
    sourceSystem: options.sourceSystem ?? "local_filesystem",
  });
  const gateResults = buildIngestGateResults({ extractedItems, duplicateItems, blockedItems });

  return {
    schema_version: "resource-ingest.v1",
    generated_at: generatedAt,
    source_expansion_job: inputPath,
    source_job_id: expansionJob.job_id,
    output_dir: outputDir,
    summary: {
      source_item_count: expansionJob.items.length,
      promoted_resource_count: resourceEvidence.resources.length,
      promoted_evidence_count: resourceEvidence.evidence_items.length,
      duplicate_count: duplicateItems.length,
      blocked_count: blockedItems.length,
      gate_status: gateResults.some((gate) => gate.blocking) ? "blocked" : "passed",
    },
    gate_results: gateResults,
    blocked_items: blockedItems.map(toBlockedItem),
    duplicate_items: duplicateItems.map(toDuplicateItem),
    resource_evidence: resourceEvidence,
  };
}

export async function writeResourceIngest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "resource-ingest.json"), result);
  await writeJson(path.join(outDir, "resource-evidence.json"), result.resource_evidence);
  await writeJson(path.join(outDir, "blocked-items.json"), {
    generated_at: result.generated_at,
    count: result.blocked_items.length,
    items: result.blocked_items,
  });
  await writeFile(path.join(outDir, "summary.md"), renderResourceIngestSummary(result), "utf8");
}

export async function runResourceIngestCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runResourceIngest(args);
  console.log(`Resource ingest written to ${result.output_dir}`);
  console.log(`Source job: ${result.source_job_id}`);
  console.log(`Promoted resources: ${result.summary.promoted_resource_count}`);
  console.log(`Evidence candidates: ${result.summary.promoted_evidence_count}`);
  console.log(`Blocked items: ${result.summary.blocked_count}`);
  console.log(`Gate status: ${result.summary.gate_status}`);
}

function buildResourceEvidenceSection(items, context) {
  const resources = [];
  const resourceVersions = [];
  const normalizedTexts = [];
  const sourceSpans = [];
  const evidenceItems = [];

  for (const item of items) {
    const matterId = item.matter_id ?? context.ids.matterId;
    const resourceId = normalizeId(item.resource_id);
    const resourceVersionId = normalizeId(item.resource_version_id ?? `${resourceId}.v1`);
    const normalizedTextId = `normalized.${suffix(resourceId)}`;
    const sourceSpanId = `span.${suffix(resourceId)}.whole_document`;
    const evidenceId = `evidence.${suffix(resourceId)}.document_text`;
    const textPreview = item.extraction?.text_preview ?? "";
    const textHash = item.text_hash_sha256 ?? sha256(textPreview);
    const extractionMetadata = item.extraction?.metadata ?? {};
    const extractedSourceSpans = normalizeExtractionSourceSpans(extractionMetadata.source_spans, {
      resourceId,
      resourceVersionId,
      sourceExpansionItemId: item.item_id,
      relativePath: item.relative_path,
    });
    const sourceSpanIds = [sourceSpanId, ...extractedSourceSpans.map((span) => span.id)];

    resources.push({
      schema_version: "resource-core.v1",
      id: resourceId,
      tenant_id: context.ids.tenantId,
      source_system: context.sourceSystem,
      source_uri: item.source_path,
      resource_type: mapResourceType(item.resource_type),
      content_hash: item.raw_hash_sha256,
      classification: item.data_classification,
      matter_id: matterId,
      materialization_status: "readable",
      ingestion_status: "indexed",
      created_at: context.generatedAt,
      created_by: localFilesystemActor(),
      metadata: {
        source_expansion_item_id: item.item_id,
        relative_path: item.relative_path,
        extension: item.extension,
        candidate_domain: item.candidate_domain,
        extractor_family: item.extractor_family,
        source_url: extractionMetadata.source_url ?? item.source_url ?? null,
        canonical_url: extractionMetadata.canonical_url ?? null,
        adapter_chain: extractionMetadata.adapter_chain ?? null,
        parser_chain: extractionMetadata.parser_chain ?? null,
        human_review_required: extractionMetadata.human_review_required ?? null,
        output_status: extractionMetadata.output_status ?? null,
      },
    });

    resourceVersions.push({
      schema_version: "resource-version.v1",
      id: resourceVersionId,
      resource_id: resourceId,
      version_label: "v1",
      content_hash: item.raw_hash_sha256,
      created_at: context.generatedAt,
      metadata: {
        modified_at: item.modified_at,
        size_bytes: item.size_bytes,
        source_hash: item.raw_hash_sha256,
        source_url: extractionMetadata.source_url ?? item.source_url ?? null,
      },
    });

    normalizedTexts.push({
      schema_version: "normalized-text.v1",
      id: normalizedTextId,
      resource_id: resourceId,
      resource_version_id: resourceVersionId,
      text_hash: textHash,
      language: extractionMetadata.language ?? inferLanguage(textPreview),
      extractor_id: normalizeExtractorId(item.extraction?.extractor ?? item.extractor_family ?? "unknown"),
      quality: inferQuality(item),
      text_preview: textPreview,
      metadata: {
        text_length: item.extraction?.text_length ?? 0,
        text_truncated: Boolean(item.extraction?.text_truncated),
        headings: item.extraction?.headings ?? [],
        signals: item.extraction?.signals ?? {},
        adapter_chain: extractionMetadata.adapter_chain ?? null,
        parser_chain: extractionMetadata.parser_chain ?? null,
        page_count: extractionMetadata.page_count ?? null,
        bbox_count: extractionMetadata.bbox_count ?? null,
        mean_confidence: extractionMetadata.mean_confidence ?? null,
        source_span_count: extractedSourceSpans.length,
        human_review_required: extractionMetadata.human_review_required ?? null,
        output_status: extractionMetadata.output_status ?? null,
      },
    });

    sourceSpans.push({
      schema_version: "source-span.v1",
      id: sourceSpanId,
      resource_id: resourceId,
      resource_version_id: resourceVersionId,
      location_type: "whole_document",
      locator: {
        relative_path: item.relative_path,
        preview_only: true,
      },
      text: textPreview,
      hash: sha256(textPreview),
      metadata: {
        source_expansion_item_id: item.item_id,
        adapter_chain: extractionMetadata.adapter_chain ?? null,
      },
    });
    sourceSpans.push(...extractedSourceSpans);

    evidenceItems.push({
      schema_version: "evidence-item.v1",
      id: evidenceId,
      matter_id: matterId,
      source_span_ids: sourceSpanIds,
      evidence_type: "document_text",
      summary: summarizeEvidence(item, textPreview),
      reliability: "machine_extracted",
      review_status: "needs_review",
      metadata: {
        source_expansion_item_id: item.item_id,
        capability_ids: item.extraction?.signals?.capability_ids ?? [],
        source_url: extractionMetadata.source_url ?? item.source_url ?? null,
        adapter_chain: extractionMetadata.adapter_chain ?? null,
        human_review_required: extractionMetadata.human_review_required ?? true,
      },
    });
  }

  return {
    schema_version: "resource-evidence.v1",
    resources,
    resource_versions: resourceVersions,
    normalized_texts: normalizedTexts,
    source_spans: sourceSpans,
    evidence_items: evidenceItems,
    facts: [],
    issues: [],
    citations: [],
  };
}

function buildIngestGateResults({ extractedItems, duplicateItems, blockedItems }) {
  const gates = [
    {
      gate_id: "resource_expansion_terminal_gate",
      status: blockedItems.length > 0 ? "needs_review" : "passed",
      blocking: blockedItems.length > 0,
      message: blockedItems.length > 0
        ? `${blockedItems.length} item(s) remain quarantined or failed and require review.`
        : "No quarantined or failed items remain.",
    },
    {
      gate_id: "duplicate_resource_gate",
      status: duplicateItems.length > 0 ? "needs_review" : "passed",
      blocking: false,
      message: duplicateItems.length > 0
        ? `${duplicateItems.length} duplicate item(s) were skipped.`
        : "No duplicate items were skipped.",
    },
    {
      gate_id: "evidence_candidate_gate",
      status: extractedItems.length > 0 ? "passed" : "failed",
      blocking: extractedItems.length === 0,
      message: extractedItems.length > 0
        ? `${extractedItems.length} extracted item(s) promoted to evidence candidates.`
        : "No extracted items are available for promotion.",
    },
  ];
  return gates;
}

function toBlockedItem(item) {
  return {
    item_id: item.item_id,
    status: item.status,
    source_path: item.source_path,
    relative_path: item.relative_path,
    data_classification: item.data_classification,
    quarantine_reason: item.quarantine_reason,
    error: item.error,
  };
}

function toDuplicateItem(item) {
  return {
    item_id: item.item_id,
    source_path: item.source_path,
    relative_path: item.relative_path,
    raw_hash_sha256: item.raw_hash_sha256,
    duplicate_of: item.duplicate_of,
  };
}

function renderResourceIngestSummary(result) {
  const lines = [];
  lines.push("# Resource Ingest Summary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source job: ${result.source_job_id}`);
  lines.push(`Promoted resources: ${result.summary.promoted_resource_count}`);
  lines.push(`Evidence candidates: ${result.summary.promoted_evidence_count}`);
  lines.push(`Duplicates skipped: ${result.summary.duplicate_count}`);
  lines.push(`Blocked items: ${result.summary.blocked_count}`);
  lines.push(`Gate status: ${result.summary.gate_status}`);
  lines.push("");
  lines.push("## Gates");
  lines.push("");
  for (const gate of result.gate_results) {
    lines.push(`- ${gate.gate_id}: ${gate.status}${gate.blocking ? " (blocking)" : ""} - ${gate.message}`);
  }
  lines.push("");
  lines.push("## Next Gate");
  lines.push("");
  if (result.summary.blocked_count > 0) {
    lines.push("Review `blocked-items.json` before treating this ingest as complete.");
  } else {
    lines.push("Promoted resources can be used as Evidence OS lineage roots.");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function mapResourceType(resourceType) {
  if (resourceType === "document") return "document";
  if (resourceType === "archive" || resourceType === "plugin-package") return "archive";
  if (["email", "message", "meeting_note", "github_issue", "plane_issue", "output"].includes(resourceType)) return resourceType;
  return "file";
}

function inferQuality(item) {
  if (item.extraction?.text_truncated) return "medium";
  if ((item.extraction?.text_length ?? 0) === 0) return "low";
  return "high";
}

function inferLanguage(text) {
  return /[\uac00-\ud7a3]/u.test(text) ? "ko" : "unknown";
}

function normalizeExtractionSourceSpans(sourceSpans, context) {
  if (!Array.isArray(sourceSpans)) return [];
  return sourceSpans.slice(0, 200).map((span, index) => {
    const text = String(span.text ?? "");
    const id = `span.${suffix(context.resourceId)}.bbox.${index + 1}`;
    return {
      schema_version: "source-span.v1",
      id,
      resource_id: context.resourceId,
      resource_version_id: context.resourceVersionId,
      location_type: "bbox",
      locator: {
        relative_path: context.relativePath,
        page_number: span.page_number ?? null,
        bbox: Array.isArray(span.bbox) ? span.bbox : null,
        preview_only: true,
      },
      text,
      hash: sha256(`${id}:${text}:${JSON.stringify(span.bbox ?? null)}`),
      metadata: {
        source_expansion_item_id: context.sourceExpansionItemId,
        confidence: span.confidence ?? null,
        parser: span.parser ?? null,
      },
    };
  });
}

function normalizeExtractorId(extractor) {
  return `extractor.${String(extractor).replace(/[^a-zA-Z0-9_.:-]+/g, "_")}.v1`;
}

function summarizeEvidence(item, textPreview) {
  const firstHeading = item.extraction?.headings?.[0];
  if (firstHeading) return `${firstHeading}에서 추출된 문서 텍스트 후보`;
  if (textPreview) return `${path.basename(item.source_path)}에서 추출된 문서 텍스트 후보`;
  return `${path.basename(item.source_path)}의 빈 텍스트 추출 후보`;
}

function localFilesystemActor() {
  return {
    actor_type: "connector",
    actor_id: "connector.local_filesystem",
    display_name: "Local Filesystem",
  };
}

function normalizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}

function suffix(resourceId) {
  return normalizeId(resourceId.replace(/^resource[.:-]?/, ""));
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_RESOURCE_EXPANSION_JOB,
    outDir: DEFAULT_RESOURCE_INGEST_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--input" || arg === "--job") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--tenant-id") parsed.ids = { ...(parsed.ids ?? {}), tenantId: argv[++index] };
    else if (arg === "--matter-id") parsed.ids = { ...(parsed.ids ?? {}), matterId: argv[++index] };
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-ingest.mjs [options]

Options:
  --input, --job <path>       Resource expansion job JSON path.
  --out-dir <folder>          Output directory.
  --run-at <iso>              Deterministic generated_at timestamp.
  --tenant-id <id>            Tenant id for promoted resources.
  --matter-id <id>            Matter id for promoted resources without one.
  -h, --help                  Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
