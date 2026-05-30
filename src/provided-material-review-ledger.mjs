import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PROVIDED_MATERIAL_REVIEW_OUT_DIR = "artifacts/provided-material-review/latest";
export const DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS = {
  lddVdrInventoryPath: "artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  lddDocumentClassificationPath: "artifacts/ldd-document-classification/latest/ldd-document-classification.json",
  contractDraftWorkflowPath: "artifacts/contract-draft-workflow/latest/contract-draft-workflow.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "provided-material-review-ledger.v1";
const SOURCE_OF_TRUTH = "ldd_vdr_inventory_matter_document_index_classification_and_contract_draft_context";
const REVIEW_RULES = [
  reviewRule("source_capture", "Source capture", "VDR inventory, matter document index, document classification, and contract draft context remain read-only inputs."),
  reviewRule("material_inventory_review", "Material inventory review", "Every classified VDR file or requested/missing material receives a review row."),
  reviewRule("index_status_binding", "Index status binding", "Every reviewed material is bound to the matter document index status for the same source record."),
  reviewRule("classification_review", "Classification review", "Each material keeps its deterministic classification as review metadata, not legal analysis."),
  reviewRule("gap_review_link", "Gap review link", "Requested or missing materials receive follow-up links while preserving that absence is not factual non-existence."),
  reviewRule("attorney_review_gate", "Attorney review gate", "Every material row remains attorney/human-review gated and not client-facing-ready."),
];

export async function runProvidedMaterialReview(options = {}) {
  const result = await buildProvidedMaterialReview(options);
  if (options.write !== false) await writeProvidedMaterialReview(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Provided material review validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProvidedMaterialReview(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddVdrInventory = sourceById.ldd_vdr_inventory;
  const matterDocumentIndex = sourceById.matter_document_index;
  const lddDocumentClassification = sourceById.ldd_document_classification;
  const contractDraftWorkflow = sourceById.contract_draft_workflow;

  const rules = buildReviewRules(generatedAt);
  const indexStatuses = buildIndexStatuses({ lddDocumentClassification, matterDocumentIndex, generatedAt });
  const materialReviewItems = buildMaterialReviewItems({ lddDocumentClassification, indexStatuses, generatedAt });
  const gapLinks = buildGapLinks({ lddVdrInventory, materialReviewItems, indexStatuses, generatedAt });
  const reviewGates = buildReviewGates({ materialReviewItems, generatedAt });
  attachReviewLinks(materialReviewItems, { indexStatuses, gapLinks, reviewGates });
  const matterSummaries = buildMatterSummaries({ materialReviewItems, indexStatuses, gapLinks, reviewGates, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.text,
    lddVdrInventory,
    matterDocumentIndex,
    lddDocumentClassification,
    contractDraftWorkflow,
    rules,
    materialReviewItems,
    indexStatuses,
    gapLinks,
    reviewGates,
    matterSummaries,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeProvidedMaterialReview({
    sourceReads,
    lddVdrInventory,
    matterDocumentIndex,
    lddDocumentClassification,
    contractDraftWorkflow,
    rules,
    materialReviewItems,
    indexStatuses,
    gapLinks,
    reviewGates,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    provided_material_review_ledger_id: `provided-material-review.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    provided_material_review_status: summary.provided_material_review_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    provided_material_review_contract: buildContract(generatedAt),
    provided_material_review_rules: rules,
    provided_material_review_items: materialReviewItems,
    provided_material_index_statuses: indexStatuses,
    provided_material_gap_links: gapLinks,
    provided_material_review_gates: reviewGates,
    provided_material_matter_summaries: matterSummaries,
    provided_material_review_desktop_boundary: desktopBoundary,
    provided_material_review_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderProvidedMaterialReviewMarkdown(result),
  };
}

export async function writeProvidedMaterialReview(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableProvidedMaterialReview(result);
  await writeJson(path.join(outDir, "provided-material-review-ledger.json"), serializable);
  await writeJson(path.join(outDir, "provided-material-review-rules.json"), {
    schema_version: "provided-material-review-rules.v1",
    generated_at: result.generated_at,
    provided_material_review_rule_count: result.provided_material_review_rules.length,
    provided_material_review_rules: result.provided_material_review_rules,
  });
  await writeJson(path.join(outDir, "provided-material-review-items.json"), {
    schema_version: "provided-material-review-items.v1",
    generated_at: result.generated_at,
    material_review_item_count: result.provided_material_review_items.length,
    provided_material_review_items: result.provided_material_review_items,
  });
  await writeJson(path.join(outDir, "provided-material-index-statuses.json"), {
    schema_version: "provided-material-index-statuses.v1",
    generated_at: result.generated_at,
    index_status_count: result.provided_material_index_statuses.length,
    provided_material_index_statuses: result.provided_material_index_statuses,
  });
  await writeJson(path.join(outDir, "provided-material-gap-links.json"), {
    schema_version: "provided-material-gap-links.v1",
    generated_at: result.generated_at,
    gap_link_count: result.provided_material_gap_links.length,
    provided_material_gap_links: result.provided_material_gap_links,
  });
  await writeJson(path.join(outDir, "provided-material-review-gates.json"), {
    schema_version: "provided-material-review-gates.v1",
    generated_at: result.generated_at,
    review_gate_count: result.provided_material_review_gates.length,
    provided_material_review_gates: result.provided_material_review_gates,
  });
  await writeJson(path.join(outDir, "provided-material-matter-summaries.json"), {
    schema_version: "provided-material-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.provided_material_matter_summaries.length,
    provided_material_matter_summaries: result.provided_material_matter_summaries,
  });
  await writeJson(path.join(outDir, "provided-material-review-boundary.json"), {
    schema_version: "provided-material-review-boundary-artifact.v1",
    generated_at: result.generated_at,
    provided_material_review_desktop_boundary: result.provided_material_review_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "provided-material-review-validation-report.v1",
    generated_at: result.generated_at,
    provided_material_review_ledger_id: result.provided_material_review_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runProvidedMaterialReviewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runProvidedMaterialReview(args);
    console.log(`Provided material review ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.provided_material_review_status}`);
    console.log(`Materials/index statuses: ${result.summary.material_review_item_count}/${result.summary.index_status_count}`);
    console.log(`Gaps/review gates: ${result.summary.gap_link_count}/${result.summary.review_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "provided-material-review-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    material_rule: "every classified VDR file or requested/missing material receives one read-only review row",
    index_rule: "review rows bind to matter document index records by source record id and do not rewrite index state",
    gap_rule: "missing/requested rows are follow-up cues only and do not assert factual non-existence",
    classification_rule: "document class is routing metadata only and not legal analysis",
    attorney_review_rule: "every generated row remains attorney/human-review gated",
    client_output_rule: "provided material review outputs are not client-facing-ready and cannot be delivered without attorney review and partner approval",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, legal conclusion, final review decision, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildReviewRules(generatedAt) {
  return REVIEW_RULES.map((rule, index) => ({
    schema_version: "provided-material-review-rule.v1",
    provided_material_review_rule_id: `provided-material-review-rule.${rule.rule_type}`,
    provided_material_review_rule_type: rule.rule_type,
    rule_label: rule.label,
    rule_description: rule.description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildIndexStatuses({ lddDocumentClassification, matterDocumentIndex, generatedAt }) {
  const documentBySourceRecord = buildDocumentIndexBySourceRecord(matterDocumentIndex);
  return (lddDocumentClassification?.ldd_document_classification_records ?? []).map((record, index) => {
    const documentRecord = documentBySourceRecord.get(record.source_record_id) ?? null;
    return {
      schema_version: "provided-material-index-status.v1",
      provided_material_index_status_id: `provided-material-index-status.${slugify(record.source_document_id ?? index + 1)}`,
      matter_id: record.matter_id,
      source_document_id: record.source_document_id,
      source_record_id: record.source_record_id,
      source_row_kind: record.source_row_kind,
      document_title: record.document_title,
      document_status: record.document_status,
      document_class: record.primary_document_class,
      index_binding_status: documentRecord ? "indexed_in_matter_document_index" : "not_found_in_matter_document_index",
      matter_document_record_id: documentRecord?.document_id ?? null,
      matter_document_family_id: documentRecord?.document_family_id ?? null,
      index_document_role: documentRecord?.document_role ?? null,
      index_document_status: documentRecord?.document_status ?? null,
      index_review_status: documentRecord?.review_status ?? null,
      index_is_latest: Boolean(documentRecord?.is_latest),
      index_status: documentRecord ? deriveIndexStatus(documentRecord) : "index_gap_pending_review",
      source_refs: [
        sourceRef("ldd_document_classification_record", record.ldd_document_classification_record_id, "classification_status"),
        sourceRef("matter_document_record", documentRecord?.document_id, "document_status"),
      ],
      source_ref_count: 2,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      created_at: generatedAt,
    };
  });
}

function buildMaterialReviewItems({ lddDocumentClassification, indexStatuses, generatedAt }) {
  const statusBySourceDocument = new Map(indexStatuses.map((status) => [status.source_document_id, status]));
  return (lddDocumentClassification?.ldd_document_classification_records ?? []).map((record, index) => {
    const indexStatus = statusBySourceDocument.get(record.source_document_id) ?? null;
    const missingOrRequested = record.source_row_kind === "missing_data" || ["missing", "requested"].includes(record.document_status);
    return {
      schema_version: "provided-material-review-item.v1",
      provided_material_review_item_id: `provided-material-review-item.${slugify(record.source_document_id ?? index + 1)}`,
      matter_id: record.matter_id,
      source_document_id: record.source_document_id,
      source_record_id: record.source_record_id,
      source_row_kind: record.source_row_kind,
      source_collection: record.source_collection,
      document_title: record.document_title,
      document_type: record.document_type,
      document_status: record.document_status,
      document_class: record.primary_document_class,
      classification_status: record.classification_status,
      missing_data_status: record.missing_data_status,
      material_review_status: missingOrRequested ? "gap_pending_follow_up_review" : "indexed_pending_attorney_review",
      provided_material_index_status_id: indexStatus?.provided_material_index_status_id ?? null,
      provided_material_review_gate_id: null,
      gap_link_ids: [],
      gap_link_count: 0,
      index_binding_status: indexStatus?.index_binding_status ?? "not_found_in_matter_document_index",
      index_status: indexStatus?.index_status ?? "index_gap_pending_review",
      classification_bound: Boolean(record.classification_status),
      missing_or_requested_material: missingOrRequested,
      source_refs: [
        sourceRef("ldd_document_classification_record", record.ldd_document_classification_record_id, "document_title"),
        sourceRef("provided_material_index_status", indexStatus?.provided_material_index_status_id, "index_status"),
      ],
      source_ref_count: 2,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required_before_client_use: true,
      client_facing_ready: false,
      client_facing_output_generated: false,
      final_review_decision_recorded: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      created_at: generatedAt,
      sequence_number: index + 1,
    };
  });
}

function buildGapLinks({ lddVdrInventory, materialReviewItems, indexStatuses, generatedAt }) {
  const missingBySourceDocument = new Map((lddVdrInventory?.ldd_vdr_missing_data_records ?? []).map((record) => [record.ldd_vdr_missing_data_record_id, record]));
  const statusBySourceDocument = new Map(indexStatuses.map((status) => [status.source_document_id, status]));
  return materialReviewItems
    .filter((item) => item.missing_or_requested_material)
    .map((item, index) => {
      const missingRecord = missingBySourceDocument.get(item.source_document_id) ?? null;
      const indexStatus = statusBySourceDocument.get(item.source_document_id) ?? null;
      return {
        schema_version: "provided-material-gap-link.v1",
        provided_material_gap_link_id: `provided-material-gap-link.${slugify(item.source_document_id ?? index + 1)}`,
        matter_id: item.matter_id,
        provided_material_review_item_id: item.provided_material_review_item_id,
        provided_material_index_status_id: indexStatus?.provided_material_index_status_id ?? null,
        source_document_id: item.source_document_id,
        source_record_id: item.source_record_id,
        missing_title: missingRecord?.missing_title ?? item.document_title,
        missing_data_status: missingRecord?.missing_data_status ?? item.missing_data_status ?? "follow_up_required",
        missing_status: missingRecord?.missing_status ?? item.document_status,
        owner: missingRecord?.owner ?? null,
        due: missingRecord?.due ?? null,
        issue: missingRecord?.issue ?? null,
        gap_link_status: "follow_up_required_pending_attorney_review",
        absence_not_factual_nonexistence: true,
        rfi_candidate: Boolean(missingRecord?.rfi_candidate ?? true),
        source_refs: [
          sourceRef("ldd_vdr_missing_data_record", missingRecord?.ldd_vdr_missing_data_record_id ?? item.source_document_id, "missing_data_status"),
          sourceRef("provided_material_review_item", item.provided_material_review_item_id, "material_review_status"),
          sourceRef("provided_material_index_status", indexStatus?.provided_material_index_status_id, "index_status"),
        ],
        source_ref_count: 3,
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        legal_conclusion_asserted: false,
        legal_advice_provided: false,
        created_at: generatedAt,
      };
    });
}

function buildReviewGates({ materialReviewItems, generatedAt }) {
  return materialReviewItems.map((item, index) => ({
    schema_version: "provided-material-review-gate.v1",
    provided_material_review_gate_id: `provided-material-review-gate.${slugify(item.source_document_id ?? index + 1)}`,
    matter_id: item.matter_id,
    provided_material_review_item_id: item.provided_material_review_item_id,
    source_document_id: item.source_document_id,
    review_gate_status: "pending_attorney_review",
    review_reason: item.missing_or_requested_material
      ? "Requested or missing material requires attorney review before relying on the review ledger."
      : "Indexed material requires attorney review before being used in a client-facing or final work product.",
    partner_approval_required_before_client_use: true,
    source_refs: [
      sourceRef("provided_material_review_item", item.provided_material_review_item_id, "material_review_status"),
      sourceRef("provided_material_index_status", item.provided_material_index_status_id, "index_status"),
    ],
    source_ref_count: 2,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    final_review_decision_recorded: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    created_at: generatedAt,
  }));
}

function buildMatterSummaries({ materialReviewItems, indexStatuses, gapLinks, reviewGates, generatedAt }) {
  const byMatter = groupBy(materialReviewItems, (item) => item.matter_id);
  return [...byMatter.entries()].map(([matterId, items]) => ({
    schema_version: "provided-material-matter-summary.v1",
    provided_material_matter_summary_id: `provided-material-summary.${slugify(matterId)}`,
    matter_id: matterId,
    provided_material_matter_status: "pending_attorney_review",
    material_review_item_count: items.length,
    available_material_count: items.filter((item) => !item.missing_or_requested_material).length,
    missing_or_requested_material_count: items.filter((item) => item.missing_or_requested_material).length,
    index_status_count: indexStatuses.filter((status) => status.matter_id === matterId).length,
    gap_link_count: gapLinks.filter((link) => link.matter_id === matterId).length,
    review_gate_count: reviewGates.filter((gate) => gate.matter_id === matterId).length,
    client_facing_ready_count: 0,
    final_review_decision_count: 0,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    final_review_decision_recorded: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    source_refs: [
      sourceRef("provided_material_review_item", items[0]?.provided_material_review_item_id, "material_review_status"),
      sourceRef("provided_material_index_status", indexStatuses.find((status) => status.matter_id === matterId)?.provided_material_index_status_id, "index_status"),
    ],
    source_ref_count: 2,
    created_at: generatedAt,
  }));
}

function attachReviewLinks(materialReviewItems, { indexStatuses, gapLinks, reviewGates }) {
  const indexBySourceDocument = new Map(indexStatuses.map((status) => [status.source_document_id, status]));
  const gateByItem = new Map(reviewGates.map((gate) => [gate.provided_material_review_item_id, gate]));
  const gapsByItem = groupBy(gapLinks, (link) => link.provided_material_review_item_id);
  for (const item of materialReviewItems) {
    item.provided_material_index_status_id = indexBySourceDocument.get(item.source_document_id)?.provided_material_index_status_id ?? null;
    item.provided_material_review_gate_id = gateByItem.get(item.provided_material_review_item_id)?.provided_material_review_gate_id ?? null;
    item.gap_link_ids = (gapsByItem.get(item.provided_material_review_item_id) ?? []).map((link) => link.provided_material_gap_link_id);
    item.gap_link_count = item.gap_link_ids.length;
  }
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "provided-material-review-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints(context) {
  const {
    sourceReads,
    packageJson,
    roadmapText,
    lddVdrInventory,
    matterDocumentIndex,
    lddDocumentClassification,
    contractDraftWorkflow,
    rules,
    materialReviewItems,
    indexStatuses,
    gapLinks,
    reviewGates,
    matterSummaries,
    desktopBoundary,
  } = context;
  const sourceStatus = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.status]));
  const materialIds = new Set(materialReviewItems.map((item) => item.provided_material_review_item_id));
  const materialsWithIndex = new Set(materialReviewItems.filter((item) => item.provided_material_index_status_id).map((item) => item.provided_material_review_item_id));
  const materialsWithGate = new Set(materialReviewItems.filter((item) => item.provided_material_review_gate_id).map((item) => item.provided_material_review_item_id));
  const missingItems = materialReviewItems.filter((item) => item.missing_or_requested_material);
  const missingItemsWithGap = new Set(gapLinks.map((link) => link.provided_material_review_item_id));
  return [
    checkpoint("source.ldd_vdr_inventory", sourceStatus.ldd_vdr_inventory === "complete" && lddVdrInventory?.summary?.ldd_vdr_inventory_status === "complete", "LDD VDR Inventory source loaded."),
    checkpoint("source.matter_document_index", sourceStatus.matter_document_index === "complete" && matterDocumentIndex?.summary?.matter_document_index_status === "complete", "Matter Document Index source loaded."),
    checkpoint("source.ldd_document_classification", sourceStatus.ldd_document_classification === "complete" && lddDocumentClassification?.summary?.ldd_document_classification_status === "complete", "LDD Document Classification source loaded."),
    checkpoint("source.contract_draft_workflow", sourceStatus.contract_draft_workflow === "complete" && contractDraftWorkflow?.summary?.contract_draft_workflow_status === "complete", "Contract Draft Workflow source loaded."),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:provided-materials-review"]), "Package script law-firm:provided-materials-review is registered."),
    checkpoint("roadmap.p250", /P250|Phase 250/i.test(roadmapText ?? ""), "Roadmap or ledger tracks P250."),
    checkpoint("rules.minimum", rules.length >= 6, "Provided material review rules are present."),
    checkpoint("material.count", materialReviewItems.length === (lddDocumentClassification?.summary?.classification_record_count ?? 0) && materialReviewItems.length > 0, "One material review row is generated per classification record."),
    checkpoint("index.status.count", indexStatuses.length === materialReviewItems.length && materialIds.size === materialsWithIndex.size, "Every material review row is bound to an index status row."),
    checkpoint("review.gate.count", reviewGates.length === materialReviewItems.length && materialIds.size === materialsWithGate.size, "Every material review row is bound to an attorney review gate."),
    checkpoint("gap.link.count", gapLinks.length === missingItems.length && missingItems.every((item) => missingItemsWithGap.has(item.provided_material_review_item_id)), "Every missing/requested material has a gap follow-up link."),
    checkpoint("classification.bound", materialReviewItems.every((item) => item.classification_bound), "Every material row is classification-bound."),
    checkpoint("source.refs", [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].every((row) => (row.source_ref_count ?? 0) > 0), "Every generated row has source refs."),
    checkpoint("matter.summary.present", matterSummaries.length === 1 && matterSummaries[0]?.matter_id === "MNA-2026-ALPHA", "One Project Alpha matter summary is generated within one matter boundary."),
    checkpoint("review.gates", [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All rows remain attorney/human-review gated and not client-facing-ready."),
    checkpoint("no.final.review", materialReviewItems.every((row) => row.final_review_decision_recorded === false) && reviewGates.every((row) => row.final_review_decision_recorded === false), "No final material review decision is recorded."),
    checkpoint("no.legal.output", [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].every((row) => row.legal_conclusion_asserted === false && row.legal_advice_provided === false), "No legal advice or legal conclusion is produced."),
    checkpoint("no.mutation", materialReviewItems.every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false) && desktopBoundary.matter_data_write_allowed === false && desktopBoundary.protected_action_allowed === false, "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_source_of_truth === false, "Desktop boundary is read-only and not source-of-truth."),
  ];
}

function summarizeProvidedMaterialReview(context) {
  const {
    sourceReads,
    lddVdrInventory,
    matterDocumentIndex,
    lddDocumentClassification,
    contractDraftWorkflow,
    rules,
    materialReviewItems,
    indexStatuses,
    gapLinks,
    reviewGates,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  } = context;
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceById = Object.fromEntries(sourceReads.map((source) => [source.source_id, source]));
  return {
    provided_material_review_status: validation.valid ? "complete" : "attention",
    provided_material_review_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_vdr_inventory_status: sourceById.ldd_vdr_inventory?.status ?? "missing",
    source_ldd_vdr_inventory_phase_status: lddVdrInventory?.summary?.ldd_vdr_inventory_status ?? "unknown",
    source_ldd_vdr_file_record_count: lddVdrInventory?.summary?.file_record_count ?? 0,
    source_ldd_vdr_missing_data_record_count: lddVdrInventory?.summary?.missing_data_record_count ?? 0,
    source_matter_document_index_status: sourceById.matter_document_index?.status ?? "missing",
    source_matter_document_index_phase_status: matterDocumentIndex?.summary?.matter_document_index_status ?? "unknown",
    source_matter_document_record_count: matterDocumentIndex?.summary?.document_record_count ?? 0,
    source_ldd_document_classification_status: sourceById.ldd_document_classification?.status ?? "missing",
    source_ldd_document_classification_phase_status: lddDocumentClassification?.summary?.ldd_document_classification_status ?? "unknown",
    source_classification_record_count: lddDocumentClassification?.summary?.classification_record_count ?? 0,
    source_contract_draft_workflow_status: sourceById.contract_draft_workflow?.status ?? "missing",
    source_contract_draft_workflow_phase_status: contractDraftWorkflow?.summary?.contract_draft_workflow_status ?? "unknown",
    provided_material_review_rule_count: rules.length,
    material_review_item_count: materialReviewItems.length,
    available_material_count: materialReviewItems.filter((item) => !item.missing_or_requested_material).length,
    missing_or_requested_material_count: materialReviewItems.filter((item) => item.missing_or_requested_material).length,
    index_status_count: indexStatuses.length,
    indexed_material_count: indexStatuses.filter((item) => item.index_binding_status === "indexed_in_matter_document_index").length,
    material_with_index_status_count: materialReviewItems.filter((item) => item.provided_material_index_status_id).length,
    classification_bound_material_count: materialReviewItems.filter((item) => item.classification_bound).length,
    gap_link_count: gapLinks.length,
    missing_material_follow_up_count: gapLinks.filter((link) => link.gap_link_status === "follow_up_required_pending_attorney_review").length,
    review_gate_count: reviewGates.length,
    material_with_review_gate_count: materialReviewItems.filter((item) => item.provided_material_review_gate_id).length,
    matter_count: matterSummaries.length,
    attorney_review_required_material_count: materialReviewItems.filter((item) => item.attorney_review_required).length,
    human_review_required_material_count: materialReviewItems.filter((item) => item.human_review_required).length,
    client_facing_ready_count: [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].filter((row) => row.client_facing_ready).length,
    final_review_decision_count: [...materialReviewItems, ...reviewGates, ...matterSummaries].filter((row) => row.final_review_decision_recorded).length,
    legal_conclusion_asserted_count: [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: [...materialReviewItems, ...indexStatuses, ...gapLinks, ...reviewGates, ...matterSummaries].some((row) => row.legal_advice_provided),
    client_facing_output_generated: materialReviewItems.some((row) => row.client_facing_output_generated),
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed || materialReviewItems.some((row) => row.matter_data_write_allowed),
    task_state_write_allowed: desktopBoundary.task_state_write_allowed || materialReviewItems.some((row) => row.task_state_write_allowed),
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed || materialReviewItems.some((row) => row.workflow_transition_allowed),
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed || materialReviewItems.some((row) => row.runtime_execution_allowed),
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed || materialReviewItems.some((row) => row.delivery_execution_allowed),
    protected_action_allowed: desktopBoundary.protected_action_allowed || materialReviewItems.some((row) => row.protected_action_allowed),
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    validation_item_count: checkpoints.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    draft_only: true,
    deterministic_material_review_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    final_review_decision_recorded: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map(({ value, ...source }) => ({
      ...source,
      schema_version: value?.schema_version ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:provided-materials-review"]),
    roadmap_p250_present: /P250|Phase 250/i.test(roadmapText.text ?? ""),
  };
}

function renderProvidedMaterialReviewMarkdown(result) {
  const lines = [];
  lines.push("# Provided Material Review Ledger");
  lines.push("");
  lines.push(`Status: ${result.summary.provided_material_review_status}`);
  lines.push(`Material review items: ${result.summary.material_review_item_count}`);
  lines.push(`Index statuses: ${result.summary.index_status_count}`);
  lines.push(`Gap links: ${result.summary.gap_link_count}`);
  lines.push(`Review gates: ${result.summary.review_gate_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: provided material review rows are internal operational scaffolds only. Attorney review, source verification, and partner approval are required before client-facing use.");
  lines.push("No legal advice, legal conclusion, final material-review decision, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, or client-facing output is performed.");
  return `${lines.join("\n")}\n`;
}

function serializableProvidedMaterialReview(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readSourceArtifacts(inputs) {
  const lddVdrInventory = await readJsonOrError(inputs.ldd_vdr_inventory_path);
  const matterDocumentIndex = await readJsonOrError(inputs.matter_document_index_path);
  const lddDocumentClassification = await readJsonOrError(inputs.ldd_document_classification_path);
  const contractDraftWorkflow = await readJsonOrError(inputs.contract_draft_workflow_path);
  return [
    sourceRead("ldd_vdr_inventory", "artifact", inputs.ldd_vdr_inventory_path, lddVdrInventory),
    sourceRead("matter_document_index", "artifact", inputs.matter_document_index_path, matterDocumentIndex),
    sourceRead("ldd_document_classification", "artifact", inputs.ldd_document_classification_path, lddDocumentClassification),
    sourceRead("contract_draft_workflow", "artifact", inputs.contract_draft_workflow_path, contractDraftWorkflow),
  ];
}

function sourceRead(sourceId, sourceKind, sourcePath, result) {
  return {
    source_id: sourceId,
    source_kind: sourceKind,
    path: path.resolve(sourcePath),
    status: result.status,
    error: result.error,
    value: result.value,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", value: JSON.parse(raw), error: null };
  } catch (error) {
    return { status: "missing", value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", text, value: null, error: null };
  } catch (error) {
    return { status: "missing", text: "", value: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    ldd_vdr_inventory_path: path.resolve(options.lddVdrInventoryPath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.lddVdrInventoryPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.matterDocumentIndexPath),
    ldd_document_classification_path: path.resolve(options.lddDocumentClassificationPath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.lddDocumentClassificationPath),
    contract_draft_workflow_path: path.resolve(options.contractDraftWorkflowPath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.contractDraftWorkflowPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_PROVIDED_MATERIAL_REVIEW_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--ldd-vdr-inventory") parsed.lddVdrInventoryPath = argv[++index];
    else if (arg === "--matter-document-index") parsed.matterDocumentIndexPath = argv[++index];
    else if (arg === "--ldd-document-classification") parsed.lddDocumentClassificationPath = argv[++index];
    else if (arg === "--contract-draft-workflow") parsed.contractDraftWorkflowPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/provided-material-review-ledger.mjs [options]

Options:
  --check                            fail when validation has errors
  --no-write                         build without writing files
  --out-dir <path>                   output directory
  --ldd-vdr-inventory <path>         LDD VDR inventory artifact path
  --matter-document-index <path>     matter document index artifact path
  --ldd-document-classification <path> LDD document classification artifact path
  --contract-draft-workflow <path>   contract draft workflow artifact path
  --package <path>                   package.json path
  --roadmap <path>                   roadmap or ledger path
  --run-at <iso>                     generated_at override
  --help                             show this help`);
}

function buildDocumentIndexBySourceRecord(matterDocumentIndex) {
  const index = new Map();
  for (const record of matterDocumentIndex?.document_records ?? []) {
    if (record.matter_id !== "MNA-2026-ALPHA") continue;
    if (!record.source_record_id) continue;
    if (!index.has(record.source_record_id)) index.set(record.source_record_id, record);
  }
  return index;
}

function deriveIndexStatus(documentRecord) {
  if (!documentRecord) return "index_gap_pending_review";
  if (["missing", "requested", "blocked"].includes(documentRecord.document_status)) return "indexed_gap_pending_review";
  return "indexed_pending_attorney_review";
}

function reviewRule(ruleType, label, description) {
  return { rule_type: ruleType, label, description };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return {
    source_kind: sourceKind,
    source_id: sourceId ?? "unknown",
    source_field: sourceField,
  };
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function slugify(value) {
  return String(value ?? "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "item";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "T");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
