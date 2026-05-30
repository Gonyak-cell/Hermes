import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FACT_CLAIM_STORE_OUT_DIR = "artifacts/fact-claim-store/latest";
export const DEFAULT_FACT_CLAIM_STORE_INPUTS = {
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const FACT_CLAIM_STORE_CONTRACT_ID = "fact-claim-store.v1";
const FACT_CLAIM_SCHEMA_VERSION = "fact-claim.v2";
const EVIDENCE_ITEM_SCHEMA_VERSION = "evidence-item.v2";
const FACT_TYPES = new Set(["party", "date", "amount", "obligation", "approval", "risk_signal", "missing_document", "procedural_event", "general"]);
const RELIABILITY_LEVELS = new Set(["unknown", "client_provided", "counterparty_provided", "public_record", "attorney_verified", "machine_extracted"]);
const REVIEW_STATUSES = new Set(["needs_review", "approved", "rejected", "changes_requested", "waived"]);

export async function runFactClaimStore(options = {}) {
  const result = await buildFactClaimStore(options);
  if (options.write !== false) await writeFactClaimStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Fact claim store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactClaimStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACT_CLAIM_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = evidenceItems.map((evidence) => buildFactClaim(evidence, generatedAt));
  const evidenceBindings = factClaims.map((fact) => buildEvidenceBinding(fact, evidenceItems));
  const reviewQueueItems = factClaims.map((fact) => buildReviewQueueItem(fact, generatedAt));
  const factClaimIndexes = buildFactClaimIndexes(factClaims, evidenceBindings, generatedAt);
  const validationItems = validateFactClaimStore({
    packageText,
    roadmapText,
    evidenceItemStore,
    evidenceItems,
    factClaims,
    evidenceBindings,
    reviewQueueItems,
    factClaimIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStore({
    evidenceItemStore,
    evidenceItems,
    factClaims,
    evidenceBindings,
    reviewQueueItems,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "fact-claim-store.v1",
    generated_at: generatedAt,
    fact_claim_store_id: `fact-claim-store.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_evidence_item_store: summarizeSource("evidence_item_store", evidenceItemStore),
    fact_claim_store_contract: buildStoreContract(generatedAt),
    fact_claim_catalog: {
      schema_version: "fact-claim-catalog.v1",
      generated_at: generatedAt,
      fact_claims: factClaims,
      evidence_bindings: evidenceBindings,
      review_queue_items: reviewQueueItems,
      fact_claim_indexes: factClaimIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderFactClaimStoreMarkdown(result),
  };
}

export async function writeFactClaimStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStore(result);
  await writeJson(path.join(outDir, "fact-claim-store.json"), serializable);
  await writeJson(path.join(outDir, "fact-claims.json"), {
    generated_at: result.generated_at,
    fact_claim_count: result.fact_claim_catalog.fact_claims.length,
    fact_claims: result.fact_claim_catalog.fact_claims,
  });
  await writeJson(path.join(outDir, "fact-evidence-bindings.json"), {
    generated_at: result.generated_at,
    fact_evidence_binding_count: result.fact_claim_catalog.evidence_bindings.length,
    evidence_bindings: result.fact_claim_catalog.evidence_bindings,
  });
  await writeJson(path.join(outDir, "fact-review-queue.json"), {
    generated_at: result.generated_at,
    review_queue_item_count: result.fact_claim_catalog.review_queue_items.length,
    review_queue_items: result.fact_claim_catalog.review_queue_items,
  });
  await writeJson(path.join(outDir, "fact-claim-indexes.json"), {
    generated_at: result.generated_at,
    fact_claim_indexes: result.fact_claim_catalog.fact_claim_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    fact_claim_store_id: result.fact_claim_store_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactClaimStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runFactClaimStore(args);
    console.log(`Fact claim store written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.fact_claim_store_status}`);
    console.log(`Evidence items: ${result.summary.evidence_item_count}`);
    console.log(`Fact claims: ${result.summary.fact_claim_count}`);
    console.log(`Evidence bindings: ${result.summary.fact_evidence_binding_count}`);
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
    schema_version: "fact-claim-store-contract.v1",
    fact_claim_store_contract_id: FACT_CLAIM_STORE_CONTRACT_ID,
    generated_at: generatedAt,
    evidence_item_schema_version: EVIDENCE_ITEM_SCHEMA_VERSION,
    fact_claim_schema_version: FACT_CLAIM_SCHEMA_VERSION,
    source_inputs: ["evidence-item-store.v1", "evidence-item.v2"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "policy_snapshot_id"],
    required_lineage_links: ["evidence_item_ids", "source_span_ids", "lineage_id"],
    reliability_rule: "fact_claim_inherits_reliability_from_supporting_evidence_item",
    review_rule: "machine_extracted_fact_claims_are_needs_review_until_human_approval",
    classification_rule: "fact_claim_inherits_classification_from_primary_evidence_item",
    matter_boundary_rule: "fact_claim_inherits_matter_boundary_from_primary_evidence_item",
  };
}

function buildFactClaim(evidence, generatedAt) {
  const factId = `fact-claim.${slugify(evidence.evidence_id)}`;
  const statement = buildStatement(evidence);
  return {
    schema_version: FACT_CLAIM_SCHEMA_VERSION,
    fact_id: factId,
    fact_store_record_id: `fact-store-record.${slugify(evidence.evidence_id)}`,
    tenant_id: evidence.tenant_id ?? null,
    matter_id: evidence.matter_id ?? null,
    classification: evidence.classification ?? null,
    policy_snapshot_id: evidence.policy_snapshot_id ?? null,
    evidence_item_ids: [evidence.evidence_id],
    evidence_item_count: 1,
    primary_evidence_item_id: evidence.evidence_id,
    source_span_ids: evidence.source_span_ids ?? [],
    source_span_count: evidence.source_span_count ?? evidence.source_span_ids?.length ?? 0,
    statement,
    fact_type: inferFactType(statement),
    confidence: reliabilityConfidence(evidence.reliability),
    reliability: evidence.reliability ?? "unknown",
    evidence_reliability: evidence.reliability ?? "unknown",
    review_status: "needs_review",
    verification_state: "machine_extracted_pending_review",
    lineage_id: `lineage.fact.${slugify(factId)}`,
    created_at: generatedAt,
    metadata: {
      source_schema_version: evidence.schema_version ?? null,
      evidence_store_record_id: evidence.evidence_store_record_id ?? null,
      evidence_type: evidence.evidence_type ?? null,
      evidence_review_status: evidence.review_status ?? null,
      evidence_verification_state: evidence.verification_state ?? null,
      evidence_lineage_id: evidence.lineage_id ?? null,
      primary_source_span_id: evidence.primary_source_span_id ?? null,
      resource_id: evidence.resource_id ?? null,
      resource_version_id: evidence.resource_version_id ?? null,
      normalized_text_id: evidence.normalized_text_id ?? null,
      location_type: evidence.location_type ?? null,
      evidence_summary: evidence.summary ?? "",
      content_preview: evidence.metadata?.content_preview ?? evidence.summary ?? "",
    },
  };
}

function buildEvidenceBinding(fact, evidenceItems) {
  const evidenceById = new Map(evidenceItems.map((evidence) => [evidence.evidence_id, evidence]));
  const evidence = evidenceById.get(fact.primary_evidence_item_id);
  return {
    schema_version: "fact-evidence-binding.v1",
    fact_evidence_binding_id: `fact-evidence-binding.${slugify(fact.fact_id)}.${slugify(fact.primary_evidence_item_id)}`,
    fact_id: fact.fact_id,
    evidence_id: fact.primary_evidence_item_id,
    binding_status: evidence ? "bound" : "broken",
    tenant_id: fact.tenant_id,
    matter_id: fact.matter_id,
    classification: fact.classification,
    reliability: fact.reliability,
    reliability_preserved: Boolean(evidence && evidence.reliability === fact.reliability),
    matter_preserved: Boolean(evidence && evidence.matter_id === fact.matter_id),
    classification_preserved: Boolean(evidence && evidence.classification === fact.classification),
    policy_snapshot_preserved: Boolean(evidence && evidence.policy_snapshot_id === fact.policy_snapshot_id),
    created_at: fact.created_at,
  };
}

function buildReviewQueueItem(fact, generatedAt) {
  return {
    schema_version: "fact-review-queue-item.v1",
    review_queue_item_id: `fact-review-queue-item.${slugify(fact.fact_id)}`,
    fact_id: fact.fact_id,
    subject_type: "fact_claim",
    subject_id: fact.fact_id,
    matter_id: fact.matter_id,
    classification: fact.classification,
    review_status: fact.review_status,
    review_required: fact.review_status === "needs_review",
    approval_required_before_output: true,
    queue_reason: "machine_extracted_fact_claim",
    assigned_role: "attorney_reviewer",
    created_at: generatedAt,
  };
}

function buildFactClaimIndexes(factClaims, evidenceBindings, generatedAt) {
  return {
    schema_version: "fact-claim-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(factClaims, "matter_id"),
    by_classification: countBy(factClaims, "classification"),
    by_review_status: countBy(factClaims, "review_status"),
    by_fact_type: countBy(factClaims, "fact_type"),
    by_reliability: countBy(factClaims, "reliability"),
    by_binding_status: countBy(evidenceBindings, "binding_status"),
  };
}

function validateFactClaimStore({
  packageText,
  roadmapText,
  evidenceItemStore,
  evidenceItems,
  factClaims,
  evidenceBindings,
  reviewQueueItems,
  factClaimIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const evidenceById = new Map(evidenceItems.map((evidence) => [evidence.evidence_id, evidence]));
  const bindingByFactId = new Map(evidenceBindings.map((binding) => [binding.fact_id, binding]));
  const reviewByFactId = new Map(reviewQueueItems.map((item) => [item.fact_id, item]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:fact-claims"]), "package.json must expose resource:fact-claims.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 140: Fact Claim Store"), "Implementation roadmap must document Phase 140.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "catalog", "evidence_items_present", evidenceItems.length > 0, "At least one evidence item is required.");
  pushCheck(validationItems, "catalog", "fact_claims_present", factClaims.length > 0, "At least one fact claim must be materialized.");
  pushCheck(validationItems, "catalog", "fact_count_matches_evidence", factClaims.length === evidenceItems.length, "Every evidence item must produce one fact claim candidate.");
  pushCheck(validationItems, "catalog", "binding_count_matches_fact", evidenceBindings.length === factClaims.length, "Every fact claim must have one evidence binding.");
  pushCheck(validationItems, "catalog", "review_queue_count_matches_fact", reviewQueueItems.length === factClaims.length, "Every fact claim must have one review queue item.");
  pushCheck(validationItems, "catalog", "binding_index_present", Boolean(factClaimIndexes.by_binding_status), "Binding status index must be present.");

  for (const fact of factClaims) {
    const evidenceId = fact.primary_evidence_item_id;
    const evidence = evidenceById.get(evidenceId);
    const binding = bindingByFactId.get(fact.fact_id);
    const review = reviewByFactId.get(fact.fact_id);
    const pathPrefix = `fact_claims.${fact.fact_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", fact.schema_version === FACT_CLAIM_SCHEMA_VERSION, "Fact claim must use fact-claim.v2.");
    pushCheck(validationItems, pathPrefix, "evidence_link_resolves", Boolean(evidence), "Fact claim must link to an evidence item.");
    pushCheck(validationItems, pathPrefix, "evidence_count_canonical", fact.evidence_item_count === 1 && fact.evidence_item_ids.length === 1, "P140 fact claim must bind one primary evidence item.");
    pushCheck(validationItems, pathPrefix, "evidence_id_referenced", fact.evidence_item_ids.includes(evidenceId), "Fact claim must reference its primary evidence id.");
    pushCheck(validationItems, pathPrefix, "reliability_canonical", RELIABILITY_LEVELS.has(fact.reliability), "Fact claim reliability must be canonical.");
    pushCheck(validationItems, pathPrefix, "evidence_reliability_preserved", Boolean(evidence && evidence.reliability === fact.reliability && fact.evidence_reliability === evidence.reliability), "Fact claim must preserve reliability from evidence.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", Boolean(evidence && evidence.matter_id === fact.matter_id), "Fact claim must preserve matter_id from evidence.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", Boolean(evidence && evidence.classification === fact.classification), "Fact claim must preserve classification from evidence.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", Boolean(evidence && evidence.policy_snapshot_id === fact.policy_snapshot_id), "Fact claim must preserve policy snapshot from evidence.");
    pushCheck(validationItems, pathPrefix, "source_span_links_preserved", Boolean(evidence && fact.source_span_count === evidence.source_span_count && fact.source_span_ids.every((spanId) => evidence.source_span_ids.includes(spanId))), "Fact claim must preserve source span links from evidence.");
    pushCheck(validationItems, pathPrefix, "fact_type_canonical", FACT_TYPES.has(fact.fact_type), "Fact claim fact_type must be canonical.");
    pushCheck(validationItems, pathPrefix, "confidence_range", typeof fact.confidence === "number" && fact.confidence >= 0 && fact.confidence <= 1, "Fact claim confidence must be between 0 and 1.");
    pushCheck(validationItems, pathPrefix, "review_status_canonical", REVIEW_STATUSES.has(fact.review_status), "Fact claim review_status must be canonical.");
    pushCheck(validationItems, pathPrefix, "machine_review_pending", fact.review_status === "needs_review" && fact.verification_state === "machine_extracted_pending_review", "Machine extracted fact claims must remain pending human review.");
    pushCheck(validationItems, pathPrefix, "binding_row_present", binding?.binding_status === "bound", "Fact claim must have a bound evidence binding.");
    pushCheck(validationItems, pathPrefix, "review_queue_present", review?.review_required === true, "Fact claim must have a review queue item.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `fact-claim-store-validation.${slugify(pathLabel)}.${checkId}`,
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

function summarizeStore({ evidenceItemStore, evidenceItems, factClaims, evidenceBindings, reviewQueueItems, validationItems, validation }) {
  const averageConfidence = factClaims.length === 0
    ? 0
    : Number((factClaims.reduce((sum, fact) => sum + fact.confidence, 0) / factClaims.length).toFixed(3));
  return {
    fact_claim_store_status: validation.valid ? "complete" : "blocked",
    fact_claim_store_contract_id: FACT_CLAIM_STORE_CONTRACT_ID,
    fact_claim_schema_version: FACT_CLAIM_SCHEMA_VERSION,
    evidence_item_store_status: evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    evidence_item_count: evidenceItems.length,
    fact_claim_count: factClaims.length,
    fact_evidence_binding_count: evidenceBindings.length,
    review_queue_item_count: reviewQueueItems.length,
    evidence_linked_fact_count: factClaims.filter((fact) => fact.evidence_item_ids.length > 0).length,
    reliability_preserved_fact_count: evidenceBindings.filter((binding) => binding.reliability_preserved).length,
    matter_preserved_fact_count: evidenceBindings.filter((binding) => binding.matter_preserved).length,
    classification_preserved_fact_count: evidenceBindings.filter((binding) => binding.classification_preserved).length,
    policy_snapshot_preserved_fact_count: evidenceBindings.filter((binding) => binding.policy_snapshot_preserved).length,
    machine_extracted_fact_count: factClaims.filter((fact) => fact.reliability === "machine_extracted").length,
    needs_review_count: factClaims.filter((fact) => fact.review_status === "needs_review").length,
    approved_count: factClaims.filter((fact) => fact.review_status === "approved").length,
    average_confidence: averageConfidence,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(factClaims, "matter_id"),
    by_classification: countBy(factClaims, "classification"),
    by_review_status: countBy(factClaims, "review_status"),
    by_fact_type: countBy(factClaims, "fact_type"),
    by_reliability: countBy(factClaims, "reliability"),
  };
}

function renderFactClaimStoreMarkdown(result) {
  const lines = [];
  lines.push("# Fact Claim Store");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.fact_claim_store_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.fact_claim_store_contract_id}`);
  lines.push(`- Evidence items: ${result.summary.evidence_item_count}`);
  lines.push(`- Fact claims: ${result.summary.fact_claim_count}`);
  lines.push(`- Evidence bindings: ${result.summary.fact_evidence_binding_count}`);
  lines.push(`- Review queue items: ${result.summary.review_queue_item_count}`);
  lines.push(`- Reliability preserved: ${result.summary.reliability_preserved_fact_count}`);
  lines.push(`- Matter preserved: ${result.summary.matter_preserved_fact_count}`);
  lines.push(`- Classification preserved: ${result.summary.classification_preserved_fact_count}`);
  lines.push(`- Policy snapshot preserved: ${result.summary.policy_snapshot_preserved_fact_count}`);
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

function buildStatement(evidence) {
  const raw = String(evidence.summary ?? evidence.metadata?.content_preview ?? "").replace(/\s+/g, " ").trim();
  const clipped = raw.length > 180 ? `${raw.slice(0, 179)}...` : raw;
  return clipped ? `Evidence supports candidate fact: ${clipped}` : `Evidence ${evidence.evidence_id} supports a candidate fact.`;
}

function inferFactType(statement) {
  if (/\b(19|20)\d{2}[./-]\s?\d{1,2}[./-]\s?\d{1,2}\b|\b(19|20)\d{2}\b/.test(statement)) return "date";
  if (/[₩$€£]|\bKRW\b|\bUSD\b|\bwon\b|\d+\s?(원|만원|억원|shares|주)\b/i.test(statement)) return "amount";
  if (/(approve|approval|approved|consent|board|resolution|승인|결의|동의)/i.test(statement)) return "approval";
  if (/(must|shall|required|obligation|covenant|의무|해야|하여야)/i.test(statement)) return "obligation";
  if (/(risk|missing|breach|default|위험|누락|위반|해지)/i.test(statement)) return "risk_signal";
  return "general";
}

function reliabilityConfidence(reliability) {
  if (reliability === "attorney_verified") return 0.92;
  if (reliability === "public_record") return 0.84;
  if (reliability === "client_provided") return 0.76;
  if (reliability === "counterparty_provided") return 0.7;
  if (reliability === "machine_extracted") return 0.62;
  return 0.5;
}

function normalizeInputs(options) {
  return {
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_FACT_CLAIM_STORE_INPUTS.evidenceItemStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_FACT_CLAIM_STORE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_FACT_CLAIM_STORE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
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
  console.log(`Usage: node scripts/fact-claim-store.mjs [options]

Options:
  --evidence-item-store <path>          evidence-item-store.json path.
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
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
