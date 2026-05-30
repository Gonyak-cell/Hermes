import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_ITEM_STORE_OUT_DIR = "artifacts/evidence-item-store/latest";
export const DEFAULT_EVIDENCE_ITEM_STORE_INPUTS = {
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_ITEM_STORE_CONTRACT_ID = "evidence-item-store.v1";
const EVIDENCE_ITEM_SCHEMA_VERSION = "evidence-item.v2";
const SOURCE_SPAN_SCHEMA_VERSION = "source-span.v2";
const EVIDENCE_TYPES = new Set(["document_text", "table", "email_statement", "meeting_statement", "metadata", "computed"]);
const RELIABILITY_LEVELS = new Set(["unknown", "client_provided", "counterparty_provided", "public_record", "attorney_verified", "machine_extracted"]);
const REVIEW_STATUSES = new Set(["needs_review", "approved", "rejected", "changes_requested", "waived"]);

export async function runEvidenceItemStore(options = {}) {
  const result = await buildEvidenceItemStore(options);
  if (options.write !== false) await writeEvidenceItemStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence item store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceItemStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_ITEM_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = sourceSpans.map((span) => buildEvidenceItem(span, generatedAt));
  const sourceSpanBindings = evidenceItems.map((evidence) => buildSourceSpanBinding(evidence, sourceSpans));
  const reviewQueueItems = evidenceItems.map((evidence) => buildReviewQueueItem(evidence, generatedAt));
  const evidenceItemIndexes = buildEvidenceItemIndexes(evidenceItems, sourceSpanBindings, generatedAt);
  const validationItems = validateEvidenceItemStore({
    packageText,
    roadmapText,
    sourceSpanStore,
    sourceSpans,
    evidenceItems,
    sourceSpanBindings,
    reviewQueueItems,
    evidenceItemIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStore({
    sourceSpanStore,
    sourceSpans,
    evidenceItems,
    sourceSpanBindings,
    reviewQueueItems,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "evidence-item-store.v1",
    generated_at: generatedAt,
    evidence_item_store_id: `evidence-item-store.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_source_span_store: summarizeSource("source_span_store", sourceSpanStore),
    evidence_item_store_contract: buildStoreContract(generatedAt),
    evidence_item_catalog: {
      schema_version: "evidence-item-catalog.v1",
      generated_at: generatedAt,
      evidence_items: evidenceItems,
      source_span_bindings: sourceSpanBindings,
      review_queue_items: reviewQueueItems,
      evidence_item_indexes: evidenceItemIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceItemStoreMarkdown(result),
  };
}

export async function writeEvidenceItemStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStore(result);
  await writeJson(path.join(outDir, "evidence-item-store.json"), serializable);
  await writeJson(path.join(outDir, "evidence-items.json"), {
    generated_at: result.generated_at,
    evidence_item_count: result.evidence_item_catalog.evidence_items.length,
    evidence_items: result.evidence_item_catalog.evidence_items,
  });
  await writeJson(path.join(outDir, "evidence-source-span-bindings.json"), {
    generated_at: result.generated_at,
    evidence_source_span_binding_count: result.evidence_item_catalog.source_span_bindings.length,
    source_span_bindings: result.evidence_item_catalog.source_span_bindings,
  });
  await writeJson(path.join(outDir, "evidence-review-queue.json"), {
    generated_at: result.generated_at,
    review_queue_item_count: result.evidence_item_catalog.review_queue_items.length,
    review_queue_items: result.evidence_item_catalog.review_queue_items,
  });
  await writeJson(path.join(outDir, "evidence-item-indexes.json"), {
    generated_at: result.generated_at,
    evidence_item_indexes: result.evidence_item_catalog.evidence_item_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_item_store_id: result.evidence_item_store_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceItemStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceItemStore(args);
    console.log(`Evidence item store written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_item_store_status}`);
    console.log(`Source spans: ${result.summary.source_span_count}`);
    console.log(`Evidence items: ${result.summary.evidence_item_count}`);
    console.log(`Source-span bindings: ${result.summary.evidence_source_span_binding_count}`);
    console.log(`Review queue items: ${result.summary.review_queue_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildStoreContract(generatedAt) {
  return {
    schema_version: "evidence-item-store-contract.v1",
    evidence_item_store_contract_id: EVIDENCE_ITEM_STORE_CONTRACT_ID,
    generated_at: generatedAt,
    source_span_schema_version: SOURCE_SPAN_SCHEMA_VERSION,
    evidence_item_schema_version: EVIDENCE_ITEM_SCHEMA_VERSION,
    source_inputs: ["source-span-store.v1", "source-span.v2"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "policy_snapshot_id", "resource_id", "resource_version_id"],
    required_lineage_links: ["source_span_id", "lineage_id"],
    review_rule: "machine_extracted_evidence_items_are_needs_review_until_human_approval",
    classification_rule: "evidence_item_inherits_classification_from_source_span",
    matter_boundary_rule: "evidence_item_inherits_matter_boundary_from_source_span",
  };
}

function buildEvidenceItem(span, generatedAt) {
  const evidenceId = `evidence-item.${slugify(span.source_span_id)}`;
  return {
    schema_version: EVIDENCE_ITEM_SCHEMA_VERSION,
    evidence_id: evidenceId,
    evidence_store_record_id: `evidence-store-record.${slugify(span.source_span_id)}`,
    tenant_id: span.tenant_id ?? null,
    matter_id: span.matter_id ?? null,
    classification: span.classification ?? null,
    policy_snapshot_id: span.policy_snapshot_id ?? null,
    evidence_type: inferEvidenceType(span),
    source_span_ids: [span.source_span_id],
    source_span_count: 1,
    primary_source_span_id: span.source_span_id,
    resource_id: span.resource_id ?? null,
    resource_version_id: span.resource_version_id ?? null,
    normalized_text_id: span.normalized_text_id ?? null,
    location_type: span.location_type ?? null,
    locator: span.locator ?? {},
    summary: summarizeEvidence(span),
    reliability: "machine_extracted",
    review_status: "needs_review",
    verification_state: "machine_extracted_pending_review",
    privilege_flag: span.classification === "P3_PRIVILEGED",
    redaction_state: "raw",
    lineage_id: `lineage.evidence.${slugify(evidenceId)}`,
    created_at: generatedAt,
    metadata: {
      source_schema_version: span.schema_version ?? null,
      source_span_store_contract_id: span.metadata?.source_span_store_contract_id ?? null,
      source_span_store_record_id: span.source_span_store_record_id ?? null,
      source_span_seed_id: span.source_span_seed_id ?? null,
      normalized_text_artifact_id: span.normalized_text_artifact_id ?? null,
      location_unit_id: span.location_unit_id ?? null,
      adapter_id: span.adapter_id ?? null,
      extractor_io_contract_id: span.extractor_io_contract_id ?? null,
      document_type_binding_id: span.document_type_binding_id ?? null,
      timestamp_status: span.timestamp_status ?? null,
      locator_status: span.locator_status ?? null,
      content_preview: span.content_preview ?? "",
    },
  };
}

function buildSourceSpanBinding(evidence, sourceSpans) {
  const spanById = new Map(sourceSpans.map((span) => [span.source_span_id, span]));
  const span = spanById.get(evidence.primary_source_span_id);
  return {
    schema_version: "evidence-source-span-binding.v1",
    evidence_source_span_binding_id: `evidence-source-span-binding.${slugify(evidence.evidence_id)}.${slugify(evidence.primary_source_span_id)}`,
    evidence_id: evidence.evidence_id,
    source_span_id: evidence.primary_source_span_id,
    binding_status: span ? "bound" : "broken",
    tenant_id: evidence.tenant_id,
    matter_id: evidence.matter_id,
    classification: evidence.classification,
    matter_preserved: Boolean(span && span.matter_id === evidence.matter_id),
    classification_preserved: Boolean(span && span.classification === evidence.classification),
    policy_snapshot_preserved: Boolean(span && span.policy_snapshot_id === evidence.policy_snapshot_id),
    created_at: evidence.created_at,
  };
}

function buildReviewQueueItem(evidence, generatedAt) {
  return {
    schema_version: "evidence-review-queue-item.v1",
    review_queue_item_id: `evidence-review-queue-item.${slugify(evidence.evidence_id)}`,
    evidence_id: evidence.evidence_id,
    subject_type: "evidence_item",
    subject_id: evidence.evidence_id,
    matter_id: evidence.matter_id,
    classification: evidence.classification,
    review_status: evidence.review_status,
    review_required: evidence.review_status === "needs_review",
    approval_required_before_output: true,
    queue_reason: "machine_extracted_evidence_item",
    assigned_role: "attorney_reviewer",
    created_at: generatedAt,
  };
}

function buildEvidenceItemIndexes(evidenceItems, sourceSpanBindings, generatedAt) {
  return {
    schema_version: "evidence-item-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(evidenceItems, "matter_id"),
    by_classification: countBy(evidenceItems, "classification"),
    by_review_status: countBy(evidenceItems, "review_status"),
    by_evidence_type: countBy(evidenceItems, "evidence_type"),
    by_location_type: countBy(evidenceItems, "location_type"),
    by_binding_status: countBy(sourceSpanBindings, "binding_status"),
  };
}

function validateEvidenceItemStore({
  packageText,
  roadmapText,
  sourceSpanStore,
  sourceSpans,
  evidenceItems,
  sourceSpanBindings,
  reviewQueueItems,
  evidenceItemIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const spanById = new Map(sourceSpans.map((span) => [span.source_span_id, span]));
  const bindingByEvidenceId = new Map(sourceSpanBindings.map((binding) => [binding.evidence_id, binding]));
  const reviewByEvidenceId = new Map(reviewQueueItems.map((item) => [item.evidence_id, item]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:evidence-items"]), "package.json must expose resource:evidence-items.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 139: Evidence Item Store"), "Implementation roadmap must document Phase 139.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "catalog", "source_spans_present", sourceSpans.length > 0, "At least one source span is required.");
  pushCheck(validationItems, "catalog", "evidence_items_present", evidenceItems.length > 0, "At least one evidence item must be materialized.");
  pushCheck(validationItems, "catalog", "evidence_count_matches_spans", evidenceItems.length === sourceSpans.length, "Every source span must produce one evidence item candidate.");
  pushCheck(validationItems, "catalog", "binding_count_matches_evidence", sourceSpanBindings.length === evidenceItems.length, "Every evidence item must have one source span binding.");
  pushCheck(validationItems, "catalog", "review_queue_count_matches_evidence", reviewQueueItems.length === evidenceItems.length, "Every evidence item must have one review queue item.");
  pushCheck(validationItems, "catalog", "binding_index_present", Boolean(evidenceItemIndexes.by_binding_status), "Binding status index must be present.");

  for (const evidence of evidenceItems) {
    const sourceSpanId = evidence.primary_source_span_id;
    const span = spanById.get(sourceSpanId);
    const binding = bindingByEvidenceId.get(evidence.evidence_id);
    const review = reviewByEvidenceId.get(evidence.evidence_id);
    const pathPrefix = `evidence_items.${evidence.evidence_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", evidence.schema_version === EVIDENCE_ITEM_SCHEMA_VERSION, "Evidence item must use evidence-item.v2.");
    pushCheck(validationItems, pathPrefix, "source_span_link_resolves", Boolean(span), "Evidence item must link to a source span.");
    pushCheck(validationItems, pathPrefix, "source_span_count_canonical", evidence.source_span_count === 1 && evidence.source_span_ids.length === 1, "P139 evidence item must bind one primary source span.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", Boolean(span && span.matter_id === evidence.matter_id), "Evidence item must preserve matter_id from source span.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", Boolean(span && span.classification === evidence.classification), "Evidence item must preserve classification from source span.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", Boolean(span && span.policy_snapshot_id === evidence.policy_snapshot_id), "Evidence item must preserve policy snapshot from source span.");
    pushCheck(validationItems, pathPrefix, "resource_identity_preserved", Boolean(span && span.resource_id === evidence.resource_id && span.resource_version_id === evidence.resource_version_id), "Evidence item must preserve resource identity.");
    pushCheck(validationItems, pathPrefix, "evidence_type_canonical", EVIDENCE_TYPES.has(evidence.evidence_type), "Evidence item evidence_type must be canonical.");
    pushCheck(validationItems, pathPrefix, "reliability_canonical", RELIABILITY_LEVELS.has(evidence.reliability), "Evidence item reliability must be canonical.");
    pushCheck(validationItems, pathPrefix, "review_status_canonical", REVIEW_STATUSES.has(evidence.review_status), "Evidence item review_status must be canonical.");
    pushCheck(validationItems, pathPrefix, "machine_review_pending", evidence.review_status === "needs_review" && evidence.verification_state === "machine_extracted_pending_review", "Machine extracted evidence must remain pending human review.");
    pushCheck(validationItems, pathPrefix, "binding_row_present", binding?.binding_status === "bound", "Evidence item must have a bound source span binding.");
    pushCheck(validationItems, pathPrefix, "review_queue_present", review?.review_required === true, "Evidence item must have a review queue item.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `evidence-item-store-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.path}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeStore({ sourceSpanStore, sourceSpans, evidenceItems, sourceSpanBindings, reviewQueueItems, validationItems, validation }) {
  return {
    evidence_item_store_status: validation.valid ? "complete" : "blocked",
    evidence_item_store_contract_id: EVIDENCE_ITEM_STORE_CONTRACT_ID,
    evidence_item_schema_version: EVIDENCE_ITEM_SCHEMA_VERSION,
    source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    source_span_count: sourceSpans.length,
    evidence_item_count: evidenceItems.length,
    evidence_source_span_binding_count: sourceSpanBindings.length,
    review_queue_item_count: reviewQueueItems.length,
    source_span_linked_evidence_count: evidenceItems.filter((item) => item.source_span_ids.length > 0).length,
    matter_preserved_evidence_count: sourceSpanBindings.filter((binding) => binding.matter_preserved).length,
    classification_preserved_evidence_count: sourceSpanBindings.filter((binding) => binding.classification_preserved).length,
    policy_snapshot_preserved_evidence_count: sourceSpanBindings.filter((binding) => binding.policy_snapshot_preserved).length,
    machine_extracted_evidence_count: evidenceItems.filter((item) => item.reliability === "machine_extracted").length,
    needs_review_count: evidenceItems.filter((item) => item.review_status === "needs_review").length,
    approved_count: evidenceItems.filter((item) => item.review_status === "approved").length,
    privilege_flag_count: evidenceItems.filter((item) => item.privilege_flag).length,
    redaction_raw_count: evidenceItems.filter((item) => item.redaction_state === "raw").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(evidenceItems, "matter_id"),
    by_classification: countBy(evidenceItems, "classification"),
    by_review_status: countBy(evidenceItems, "review_status"),
    by_evidence_type: countBy(evidenceItems, "evidence_type"),
    by_location_type: countBy(evidenceItems, "location_type"),
  };
}

function renderEvidenceItemStoreMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Item Store");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.evidence_item_store_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.evidence_item_store_contract_id}`);
  lines.push(`- Source spans: ${result.summary.source_span_count}`);
  lines.push(`- Evidence items: ${result.summary.evidence_item_count}`);
  lines.push(`- Source-span bindings: ${result.summary.evidence_source_span_binding_count}`);
  lines.push(`- Review queue items: ${result.summary.review_queue_item_count}`);
  lines.push(`- Matter preserved: ${result.summary.matter_preserved_evidence_count}`);
  lines.push(`- Classification preserved: ${result.summary.classification_preserved_evidence_count}`);
  lines.push(`- Policy snapshot preserved: ${result.summary.policy_snapshot_preserved_evidence_count}`);
  lines.push(`- Needs review: ${result.summary.needs_review_count}`);
  lines.push(`- Auto approved: ${result.summary.approved_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function inferEvidenceType(span) {
  if (span.location_type === "char_range" || span.location_type === "line" || span.location_type === "paragraph" || span.location_type === "page" || span.location_type === "whole_document") return "document_text";
  return "metadata";
}

function summarizeEvidence(span) {
  const locationLabel = span.location_type === "whole_document"
    ? "whole document"
    : String(span.location_type ?? "source span").replace(/_/g, " ");
  const preview = String(span.content_preview ?? "").replace(/\s+/g, " ").trim();
  const clipped = preview.length > 120 ? `${preview.slice(0, 119)}...` : preview;
  return `${locationLabel} evidence candidate from ${span.resource_id}: ${clipped}`;
}

function normalizeInputs(options) {
  return {
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_ITEM_STORE_INPUTS.sourceSpanStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_ITEM_STORE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_ITEM_STORE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-item-store.mjs [options]

Options:
  --source-span-store <path>            source-span-store.json path.
  --out-dir <path>                      Output directory.
  --run-at <iso>                        Deterministic generated_at timestamp.
  --check                               Exit non-zero when validation fails.
  --no-write                            Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableStore(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    generated_at: data.generated_at ?? null,
    summary: data.summary ?? null,
  };
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
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runEvidenceItemStoreCli();
}
