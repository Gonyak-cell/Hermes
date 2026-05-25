import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_QUARANTINE_MODEL_OUT_DIR = "artifacts/resource-quarantine/latest";
export const DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS = {
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  resourceDedupHashLedgerPath: "artifacts/resource-dedup-hash/latest/resource-dedup-hash-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const QUARANTINE_MODEL_CONTRACT_ID = "resource-quarantine-model.v1";
const REQUIRED_CATEGORIES = [
  "sensitive_data",
  "extraction_error",
  "encrypted_or_materialization_required",
  "oversized_file",
  "ambiguous_matter_or_type",
  "duplicate_or_hash_hold",
];
const SENSITIVE_CLASSIFICATIONS = new Set(["P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET"]);

export async function runResourceQuarantineModel(options = {}) {
  const result = await buildResourceQuarantineModel(options);
  if (options.write !== false) await writeResourceQuarantineModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource quarantine model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceQuarantineModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    resourceExpansion,
    resourceIngest,
    resourceStoreInterface,
    resourceDedupHashLedger,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.resource_expansion_path),
    readJson(inputs.resource_ingest_path),
    readJson(inputs.resource_store_interface_path),
    readJson(inputs.resource_dedup_hash_ledger_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const expansionItems = resourceExpansion.items ?? [];
  const blockedItems = resourceIngest.blocked_items ?? [];
  const duplicateItems = resourceIngest.duplicate_items ?? [];
  const versionRecords = resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const dedupDecisions = resourceDedupHashLedger.dedup_hash_catalog?.dedup_decisions ?? [];
  const rules = buildQuarantineRules(generatedAt);
  const quarantineItems = buildQuarantineItems({
    expansionItems,
    blockedItems,
    duplicateItems,
    versionRecords,
    dedupDecisions,
    generatedAt,
  });
  const reviewQueue = buildReviewQueue(quarantineItems, generatedAt);
  const validationItems = validateResourceQuarantineModel({
    resourceExpansion,
    resourceIngest,
    resourceStoreInterface,
    resourceDedupHashLedger,
    packageText,
    roadmapText,
    rules,
    quarantineItems,
    reviewQueue,
    expansionItems,
    dedupDecisions,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeResourceQuarantineModel({
    validation,
    validationItems,
    rules,
    quarantineItems,
    reviewQueue,
    expansionItems,
    dedupDecisions,
  });

  const result = {
    schema_version: "resource-quarantine-model.v1",
    generated_at: generatedAt,
    resource_quarantine_model_id: `resource-quarantine-model.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("resource_expansion", resourceExpansion),
      summarizeSource("resource_ingest", resourceIngest),
      summarizeSource("resource_store_interface", resourceStoreInterface),
      summarizeSource("resource_dedup_hash_ledger", resourceDedupHashLedger),
    ],
    quarantine_contract: buildQuarantineContract(generatedAt),
    quarantine_catalog: {
      schema_version: "resource-quarantine-catalog.v1",
      generated_at: generatedAt,
      quarantine_rules: rules,
      quarantine_items: quarantineItems,
      quarantine_review_queue: reviewQueue,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderResourceQuarantineModelMarkdown(result),
  };
}

export async function writeResourceQuarantineModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableQuarantineModel(result);
  await writeJson(path.join(outDir, "resource-quarantine-model.json"), serializable);
  await writeJson(path.join(outDir, "quarantine-rules.json"), {
    schema_version: "resource-quarantine-rule-set.v1",
    generated_at: result.generated_at,
    quarantine_rule_count: result.quarantine_catalog.quarantine_rules.length,
    quarantine_rules: result.quarantine_catalog.quarantine_rules,
  });
  await writeJson(path.join(outDir, "quarantine-items.json"), {
    schema_version: "resource-quarantine-item-set.v1",
    generated_at: result.generated_at,
    quarantine_item_count: result.quarantine_catalog.quarantine_items.length,
    quarantine_items: result.quarantine_catalog.quarantine_items,
  });
  await writeJson(path.join(outDir, "quarantine-review-queue.json"), {
    schema_version: "resource-quarantine-review-queue-set.v1",
    generated_at: result.generated_at,
    review_queue_item_count: result.quarantine_catalog.quarantine_review_queue.length,
    quarantine_review_queue: result.quarantine_catalog.quarantine_review_queue,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    resource_quarantine_model_id: result.resource_quarantine_model_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceQuarantineModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceQuarantineModel(args);
    console.log(`Resource quarantine model written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_quarantine_status}`);
    console.log(`Rules: ${result.summary.quarantine_rule_count}`);
    console.log(`Held items: ${result.summary.quarantine_item_count}`);
    console.log(`Review queue: ${result.summary.review_queue_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildQuarantineContract(generatedAt) {
  return {
    schema_version: "resource-quarantine-contract.v1",
    quarantine_model_contract_id: QUARANTINE_MODEL_CONTRACT_ID,
    generated_at: generatedAt,
    required_categories: REQUIRED_CATEGORIES,
    hold_rule: "Sensitive, failed, encrypted/materialization-required, oversized, ambiguous, and duplicate/hash-held resources are held before retrieval, external transfer, or delivery.",
    release_rule: "A quarantine item can only move after explicit human review records a release, correction, or permanent exclusion decision.",
    mutation_rule: "Quarantine records are overlays; source files, object store paths, evidence, and outputs are never deleted or rewritten by this model.",
  };
}

function buildQuarantineRules(generatedAt) {
  return REQUIRED_CATEGORIES.map((category) => ({
    schema_version: "resource-quarantine-rule.v1",
    quarantine_rule_id: `resource-quarantine-rule.${category}`,
    category,
    trigger_statuses: triggerStatusesFor(category),
    trigger_reasons: triggerReasonsFor(category),
    default_hold_status: "held_for_human_review",
    retrieval_allowed: false,
    external_transfer_allowed: false,
    auto_release_allowed: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildQuarantineItems({ expansionItems, blockedItems, duplicateItems, versionRecords, dedupDecisions, generatedAt }) {
  const itemsByTarget = new Map();
  const versionRecordByVersionId = new Map(versionRecords.map((record) => [record.resource_version_id, record]));
  const expansionItemByVersionId = new Map(expansionItems.map((item) => [item.resource_version_id, item]));

  for (const item of expansionItems) {
    const reasons = classifyExpansionQuarantineReasons(item);
    if (reasons.length === 0) continue;
    upsertQuarantineItem(itemsByTarget, {
      targetKey: item.resource_version_id ?? item.resource_id ?? item.item_id,
      generatedAt,
      sourceKind: "resource_expansion_item",
      sourceRefs: {
        expansion_item_id: item.item_id,
        resource_id: item.resource_id ?? null,
        resource_version_id: item.resource_version_id ?? null,
        source_path: item.source_path ?? null,
        relative_path: item.relative_path ?? null,
      },
      item,
      versionRecord: versionRecordByVersionId.get(item.resource_version_id),
      reasons,
    });
  }

  for (const item of blockedItems) {
    upsertQuarantineItem(itemsByTarget, {
      targetKey: item.resource_version_id ?? item.resource_id ?? item.item_id ?? item.source_item_id,
      generatedAt,
      sourceKind: "resource_ingest_blocked_item",
      sourceRefs: {
        ingest_blocked_item_id: item.item_id ?? item.source_item_id ?? null,
        resource_id: item.resource_id ?? null,
        resource_version_id: item.resource_version_id ?? null,
      },
      item,
      versionRecord: versionRecordByVersionId.get(item.resource_version_id),
      reasons: [{
        category: item.status === "failed" ? "extraction_error" : "ambiguous_matter_or_type",
        reason_code: item.block_reason ?? item.reason ?? "ingest_blocked_item",
        severity: "high",
      }],
    });
  }

  for (const item of duplicateItems) {
    upsertQuarantineItem(itemsByTarget, {
      targetKey: item.resource_version_id ?? item.resource_id ?? item.item_id ?? item.source_item_id,
      generatedAt,
      sourceKind: "resource_ingest_duplicate_item",
      sourceRefs: {
        ingest_duplicate_item_id: item.item_id ?? item.source_item_id ?? null,
        resource_id: item.resource_id ?? null,
        resource_version_id: item.resource_version_id ?? null,
        duplicate_of: item.duplicate_of ?? null,
      },
      item,
      versionRecord: versionRecordByVersionId.get(item.resource_version_id),
      reasons: [{
        category: "duplicate_or_hash_hold",
        reason_code: "ingest_duplicate_item",
        severity: "medium",
      }],
    });
  }

  for (const decision of dedupDecisions.filter((item) => item.human_review_required === true)) {
    const item = expansionItemByVersionId.get(decision.resource_version_id) ?? {};
    upsertQuarantineItem(itemsByTarget, {
      targetKey: decision.resource_version_id ?? decision.dedup_decision_id,
      generatedAt,
      sourceKind: "resource_dedup_decision",
      sourceRefs: {
        dedup_decision_id: decision.dedup_decision_id,
        resource_id: decision.resource_id ?? null,
        resource_version_id: decision.resource_version_id ?? null,
        hash_group_id: decision.hash_group_id ?? null,
      },
      item: {
        ...item,
        resource_id: decision.resource_id ?? item.resource_id,
        resource_version_id: decision.resource_version_id ?? item.resource_version_id,
        raw_hash_sha256: decision.content_hash ?? item.raw_hash_sha256,
      },
      versionRecord: versionRecordByVersionId.get(decision.resource_version_id),
      reasons: [{
        category: "duplicate_or_hash_hold",
        reason_code: decision.dedup_status ?? "dedup_human_review_required",
        severity: "medium",
      }],
    });
  }

  return [...itemsByTarget.values()].map(finalizeQuarantineItem).sort(by("quarantine_item_id"));
}

function classifyExpansionQuarantineReasons(item) {
  const reasons = [];
  if (SENSITIVE_CLASSIFICATIONS.has(item.data_classification)) {
    reasons.push({
      category: "sensitive_data",
      reason_code: `classification:${item.data_classification}`,
      severity: item.data_classification === "P5_SECRET" ? "critical" : "high",
    });
  }
  if (item.status === "failed" || item.error) {
    reasons.push({ category: "extraction_error", reason_code: item.error?.name ?? "extraction_failed", severity: "high" });
  }
  if (item.status === "quarantined" && item.quarantine_reason) {
    reasons.push(reasonFromQuarantineReason(item.quarantine_reason));
  }
  if (item.status === "skipped_duplicate" || item.duplicate_of) {
    reasons.push({ category: "duplicate_or_hash_hold", reason_code: "skipped_duplicate", severity: "medium" });
  }
  if (!item.matter_id || item.candidate_domain === "unclassified" || ["unknown", "unsupported"].some((token) => String(item.resource_type ?? item.extractor_family ?? "").includes(token))) {
    reasons.push({
      category: "ambiguous_matter_or_type",
      reason_code: !item.matter_id ? "missing_matter_id" : "unknown_or_unsupported_type",
      severity: "medium",
    });
  }
  return dedupeReasons(reasons);
}

function reasonFromQuarantineReason(reason) {
  const value = String(reason ?? "");
  if (value.includes("materialization") || value.includes("encrypted") || value.includes("password")) {
    return { category: "encrypted_or_materialization_required", reason_code: value, severity: "high" };
  }
  if (value.includes("too_large")) {
    return { category: "oversized_file", reason_code: value, severity: "medium" };
  }
  if (value.includes("secret") || value.includes("credential")) {
    return { category: "sensitive_data", reason_code: value, severity: "critical" };
  }
  if (value.includes("unsupported") || value.includes("unknown")) {
    return { category: "ambiguous_matter_or_type", reason_code: value, severity: "medium" };
  }
  return { category: "ambiguous_matter_or_type", reason_code: value || "quarantine_reason", severity: "medium" };
}

function upsertQuarantineItem(itemsByTarget, input) {
  const targetKey = input.targetKey ?? input.sourceRefs?.dedup_decision_id ?? "unknown";
  const existing = itemsByTarget.get(targetKey);
  const reasons = dedupeReasons([...(existing?.hold_reasons ?? []), ...input.reasons]);
  const sourceRefs = {
    ...(existing?.source_refs ?? {}),
    ...removeUndefined(input.sourceRefs),
  };
  itemsByTarget.set(targetKey, {
    schema_version: "resource-quarantine-item.v1",
    quarantine_item_id: existing?.quarantine_item_id ?? `resource-quarantine-item.${slugify(targetKey)}`,
    resource_id: input.item.resource_id ?? input.versionRecord?.resource_id ?? existing?.resource_id ?? null,
    resource_version_id: input.item.resource_version_id ?? input.versionRecord?.resource_version_id ?? existing?.resource_version_id ?? null,
    source_kind: existing?.source_kind ? unique([existing.source_kind, input.sourceKind]).join("+") : input.sourceKind,
    source_refs: sourceRefs,
    hold_reasons: reasons,
    hold_categories: unique(reasons.map((reason) => reason.category)),
    data_classification: input.item.data_classification ?? input.item.classification ?? input.versionRecord?.classification ?? existing?.data_classification ?? "unknown",
    matter_id: input.item.matter_id ?? input.versionRecord?.matter_id ?? existing?.matter_id ?? null,
    tenant_id: input.versionRecord?.tenant_id ?? existing?.tenant_id ?? null,
    source_path: input.item.source_path ?? existing?.source_path ?? null,
    relative_path: input.item.relative_path ?? existing?.relative_path ?? null,
    size_bytes: input.item.size_bytes ?? existing?.size_bytes ?? null,
    content_hash: input.item.raw_hash_sha256 ?? input.versionRecord?.content_hash ?? existing?.content_hash ?? null,
    hold_status: "held_for_human_review",
    retrieval_allowed: false,
    external_transfer_allowed: false,
    output_delivery_allowed: false,
    auto_release_allowed: false,
    human_review_required: true,
    created_at: input.generatedAt,
  });
}

function finalizeQuarantineItem(item) {
  return {
    ...item,
    hold_severity: highestSeverity(item.hold_reasons.map((reason) => reason.severity)),
    release_requirements: releaseRequirements(item.hold_categories),
  };
}

function buildReviewQueue(quarantineItems, generatedAt) {
  return quarantineItems.map((item) => ({
    schema_version: "resource-quarantine-review-item.v1",
    review_item_id: `resource-quarantine-review.${slugify(item.quarantine_item_id)}`,
    quarantine_item_id: item.quarantine_item_id,
    resource_id: item.resource_id,
    resource_version_id: item.resource_version_id,
    review_status: "pending_human_review",
    required_reviewer_role: reviewerRoleFor(item.hold_categories),
    required_actions: item.release_requirements,
    blocked_actions: ["retrieval", "external_model_transfer", "output_delivery", "automatic_evidence_promotion"],
    human_review_required: true,
    auto_release_allowed: false,
    created_at: generatedAt,
  }));
}

function validateResourceQuarantineModel(context) {
  const items = [];
  const {
    resourceExpansion,
    resourceIngest,
    resourceStoreInterface,
    resourceDedupHashLedger,
    packageText,
    roadmapText,
    rules,
    quarantineItems,
    reviewQueue,
    expansionItems,
    dedupDecisions,
  } = context;
  const sensitiveExpansionCount = expansionItems.filter((item) => SENSITIVE_CLASSIFICATIONS.has(item.data_classification)).length;
  const ambiguousExpansionCount = expansionItems.filter((item) => !item.matter_id || item.candidate_domain === "unclassified").length;
  const sourceQuarantineOrFailureCount = expansionItems.filter((item) => ["quarantined", "failed"].includes(item.status)).length;
  const dedupHoldCount = dedupDecisions.filter((item) => item.human_review_required === true).length;
  const categories = new Set(rules.map((rule) => rule.category));
  const itemCategories = new Set(quarantineItems.flatMap((item) => item.hold_categories ?? []));

  pushCheck(items, "source.resource_expansion", "source_available", resourceExpansion?.schema_version === "resource-expansion-job.v1", "Resource expansion job must be readable.");
  pushCheck(items, "source.resource_ingest", "source_available", resourceIngest?.schema_version === "resource-ingest.v1", "Resource ingest source must be readable.");
  pushCheck(items, "source.resource_store_interface", "source_complete", resourceStoreInterface?.summary?.resource_store_interface_status === "complete", "Resource store interface must be complete.");
  pushCheck(items, "source.resource_dedup_hash_ledger", "source_complete", resourceDedupHashLedger?.summary?.resource_dedup_hash_status === "complete", "Resource dedup/hash ledger must be complete.");
  pushCheck(items, "package_json", "resource_quarantine_script_registered", String(packageText).includes("\"resource:quarantine\""), "package.json must expose npm run resource:quarantine.");
  pushCheck(items, "implementation_roadmap", "phase_153_recorded", String(roadmapText).includes("## Phase 153: Resource Quarantine Model"), "Roadmap must record Phase 153 completion.");
  pushCheck(items, "quarantine_rules", "required_categories_declared", REQUIRED_CATEGORIES.every((category) => categories.has(category)), "Quarantine rules must declare all required categories.");
  pushCheck(items, "quarantine_rules", "rules_hold_without_auto_release", rules.every((rule) => rule.default_hold_status === "held_for_human_review" && rule.auto_release_allowed === false && rule.retrieval_allowed === false && rule.external_transfer_allowed === false), "Every quarantine rule must hold resources without auto-release or retrieval/external-transfer permission.");
  pushCheck(items, "quarantine_items", "source_quarantine_and_failure_covered", quarantineItems.length >= sourceQuarantineOrFailureCount, "Expansion quarantines and failures must be represented in the quarantine model.");
  pushCheck(items, "quarantine_items", "sensitive_resources_held", quarantineItems.filter((item) => item.hold_categories.includes("sensitive_data")).length === sensitiveExpansionCount, "Every sensitive expansion item must be held.");
  pushCheck(items, "quarantine_items", "ambiguous_resources_held", ambiguousExpansionCount === 0 || quarantineItems.filter((item) => item.hold_categories.includes("ambiguous_matter_or_type")).length >= ambiguousExpansionCount, "Ambiguous matter or type resources must be held.");
  pushCheck(items, "quarantine_items", "dedup_holds_covered", quarantineItems.filter((item) => item.hold_categories.includes("duplicate_or_hash_hold")).length >= dedupHoldCount, "Dedup decisions requiring review must be represented in quarantine.");
  pushCheck(items, "quarantine_items", "all_required_item_categories_supported", [...itemCategories].every((category) => categories.has(category)), "Every item category must be backed by a quarantine rule.");
  pushCheck(items, "quarantine_items", "no_retrieval_or_external_transfer", quarantineItems.every((item) => item.retrieval_allowed === false && item.external_transfer_allowed === false && item.output_delivery_allowed === false), "Held resources must not be retrievable, externally transferable, or deliverable.");
  pushCheck(items, "quarantine_items", "manual_review_required", quarantineItems.every((item) => item.human_review_required === true && item.auto_release_allowed === false && item.release_requirements?.includes("manual_release_receipt")), "Every quarantine item must require a manual release receipt.");
  pushCheck(items, "quarantine_review_queue", "queue_covers_items", reviewQueue.length === quarantineItems.length, "Review queue must have one pending row per quarantine item.");
  pushCheck(items, "quarantine_review_queue", "queue_pending_human_review", reviewQueue.every((item) => item.review_status === "pending_human_review" && item.human_review_required === true && item.auto_release_allowed === false), "Review queue items must remain pending human review.");

  return items.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeResourceQuarantineModel(context) {
  const {
    validation,
    validationItems,
    rules,
    quarantineItems,
    reviewQueue,
    expansionItems,
    dedupDecisions,
  } = context;
  const failedValidationItemCount = validationItems.filter((item) => item.status === "failed").length;
  const categoryCounts = countCategories(quarantineItems);
  return {
    resource_quarantine_status: validation.valid ? "complete" : "blocked",
    quarantine_contract_id: QUARANTINE_MODEL_CONTRACT_ID,
    source_expansion_item_count: expansionItems.length,
    source_sensitive_item_count: expansionItems.filter((item) => SENSITIVE_CLASSIFICATIONS.has(item.data_classification)).length,
    source_failed_item_count: expansionItems.filter((item) => item.status === "failed").length,
    source_quarantined_item_count: expansionItems.filter((item) => item.status === "quarantined").length,
    source_ambiguous_item_count: expansionItems.filter((item) => !item.matter_id || item.candidate_domain === "unclassified").length,
    source_dedup_review_decision_count: dedupDecisions.filter((item) => item.human_review_required === true).length,
    quarantine_rule_count: rules.length,
    required_quarantine_category_count: REQUIRED_CATEGORIES.length,
    quarantine_item_count: quarantineItems.length,
    sensitive_hold_count: categoryCounts.sensitive_data ?? 0,
    extraction_error_hold_count: categoryCounts.extraction_error ?? 0,
    encrypted_or_materialization_hold_count: categoryCounts.encrypted_or_materialization_required ?? 0,
    oversized_hold_count: categoryCounts.oversized_file ?? 0,
    ambiguous_hold_count: categoryCounts.ambiguous_matter_or_type ?? 0,
    duplicate_or_hash_hold_count: categoryCounts.duplicate_or_hash_hold ?? 0,
    critical_hold_count: quarantineItems.filter((item) => item.hold_severity === "critical").length,
    high_hold_count: quarantineItems.filter((item) => item.hold_severity === "high").length,
    medium_hold_count: quarantineItems.filter((item) => item.hold_severity === "medium").length,
    retrieval_blocked_count: quarantineItems.filter((item) => item.retrieval_allowed === false).length,
    external_transfer_blocked_count: quarantineItems.filter((item) => item.external_transfer_allowed === false).length,
    output_delivery_blocked_count: quarantineItems.filter((item) => item.output_delivery_allowed === false).length,
    auto_release_allowed_count: quarantineItems.filter((item) => item.auto_release_allowed === true).length,
    review_queue_item_count: reviewQueue.length,
    pending_human_review_count: reviewQueue.filter((item) => item.review_status === "pending_human_review").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItemCount,
    validation_error_count: validation.errors.length,
  };
}

function releaseRequirements(categories) {
  const requirements = new Set(["manual_release_receipt"]);
  if (categories.includes("sensitive_data")) requirements.add("classification_owner_review");
  if (categories.includes("ambiguous_matter_or_type")) requirements.add("confirm_matter_and_resource_type");
  if (categories.includes("extraction_error")) requirements.add("repair_or_retry_extraction");
  if (categories.includes("encrypted_or_materialization_required")) requirements.add("materialize_or_decrypt_source");
  if (categories.includes("oversized_file")) requirements.add("approve_large_file_processing_budget");
  if (categories.includes("duplicate_or_hash_hold")) requirements.add("confirm_duplicate_resolution");
  return [...requirements].sort();
}

function reviewerRoleFor(categories) {
  if (categories.includes("sensitive_data")) return "matter_owner";
  if (categories.includes("encrypted_or_materialization_required")) return "data_steward";
  if (categories.includes("extraction_error")) return "operations_reviewer";
  return "human_reviewer";
}

function triggerStatusesFor(category) {
  if (category === "extraction_error") return ["failed"];
  if (category === "duplicate_or_hash_hold") return ["skipped_duplicate", "dedup_human_review_required"];
  if (category === "sensitive_data") return ["classified"];
  return ["discovered", "quarantined"];
}

function triggerReasonsFor(category) {
  if (category === "sensitive_data") return ["P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET", "secret_or_credential_path"];
  if (category === "extraction_error") return ["extractor_failed", "unsupported_parser_error", "ocr_failed"];
  if (category === "encrypted_or_materialization_required") return ["materialization_required", "encrypted", "password_required"];
  if (category === "oversized_file") return ["file_too_large_for_default_expansion", "cost_or_timeout_limit"];
  if (category === "ambiguous_matter_or_type") return ["missing_matter_id", "unclassified_domain", "unsupported_or_unknown_type"];
  return ["duplicate_content_hash", "duplicate_version", "skipped_duplicate_candidate"];
}

function highestSeverity(severities) {
  const order = ["low", "medium", "high", "critical"];
  return severities.reduce((highest, severity) => (order.indexOf(severity) > order.indexOf(highest) ? severity : highest), "medium");
}

function countCategories(quarantineItems) {
  const counts = {};
  for (const item of quarantineItems) {
    for (const category of item.hold_categories ?? []) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

function dedupeReasons(reasons) {
  const seen = new Set();
  const deduped = [];
  for (const reason of reasons) {
    if (!reason?.category) continue;
    const key = `${reason.category}:${reason.reason_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      schema_version: "resource-quarantine-hold-reason.v1",
      category: reason.category,
      reason_code: reason.reason_code ?? reason.category,
      severity: reason.severity ?? "medium",
    });
  }
  return deduped.sort((left, right) => left.category.localeCompare(right.category) || left.reason_code.localeCompare(right.reason_code));
}

function summarizeSource(sourceId, artifact) {
  return {
    source_id: sourceId,
    schema_version: artifact?.schema_version ?? null,
    generated_at: artifact?.generated_at ?? null,
    summary: artifact?.summary ?? null,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.validation_id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    validation_id: `resource-quarantine-model.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function renderResourceQuarantineModelMarkdown(result) {
  const lines = [];
  lines.push("# Resource Quarantine Model");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.resource_quarantine_status}`);
  lines.push(`Contract: ${result.summary.quarantine_contract_id}`);
  lines.push(`Rules: ${result.summary.quarantine_rule_count}`);
  lines.push(`Held items: ${result.summary.quarantine_item_count}`);
  lines.push(`Review queue: ${result.summary.review_queue_item_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Held Categories");
  lines.push("");
  lines.push(`- Sensitive: ${result.summary.sensitive_hold_count}`);
  lines.push(`- Extraction error: ${result.summary.extraction_error_hold_count}`);
  lines.push(`- Encrypted/materialization: ${result.summary.encrypted_or_materialization_hold_count}`);
  lines.push(`- Oversized: ${result.summary.oversized_hold_count}`);
  lines.push(`- Ambiguous matter/type: ${result.summary.ambiguous_hold_count}`);
  lines.push(`- Duplicate/hash: ${result.summary.duplicate_or_hash_hold_count}`);
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push("- Quarantine is an overlay ledger and never deletes or rewrites source records.");
  lines.push("- Held resources are not retrievable, externally transferable, deliverable, or auto-released.");
  lines.push("- Release requires a human review receipt and category-specific correction or approval.");
  return `${lines.join("\n")}\n`;
}

function serializableQuarantineModel(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function normalizeInputs(options = {}) {
  return {
    resource_expansion_path: path.resolve(options.resourceExpansionPath ?? options.resource_expansion_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.resourceExpansionPath),
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? options.resource_ingest_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.resourceIngestPath),
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? options.resource_store_interface_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.resourceStoreInterfacePath),
    resource_dedup_hash_ledger_path: path.resolve(options.resourceDedupHashLedgerPath ?? options.resource_dedup_hash_ledger_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.resourceDedupHashLedgerPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_RESOURCE_QUARANTINE_MODEL_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--resource-dedup-hash") parsed.resourceDedupHashLedgerPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/resource-quarantine-model.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --resource-expansion <path>     resource-expansion-job.json path.
  --resource-ingest <path>        resource-ingest.json path.
  --resource-store-interface <p>  resource-store-interface.json path.
  --resource-dedup-hash <path>    resource-dedup-hash-ledger.json path.
  --run-at <iso>                  Override generated_at.
  --help                          Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function removeUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
