import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_DOCUMENT_CLASSIFICATION_OUT_DIR = "artifacts/ldd-document-classification/latest";
export const DEFAULT_LDD_DOCUMENT_CLASSIFICATION_INPUTS = {
  lddVdrInventoryPath: "artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-document-classification.v1";
const SOURCE_OF_TRUTH = "ldd_vdr_inventory_and_matter_document_index";
const DOCUMENT_CLASS_RULES = [
  classRule("contract", "Contract", ["contract", "agreement", "spa", "share purchase", "markup", "indemnity", "clause"]),
  classRule("registry", "Registry/filing", ["registry", "register", "filing", "등기", "registration"]),
  classRule("license_permit", "License/permit", ["license", "permit", "authorization", "approval", "regulatory", "인허가"]),
  classRule("litigation", "Litigation", ["litigation", "complaint", "pleading", "court", "claim", "lawsuit", "소송"]),
  classRule("labor_employment", "Labor/employment", ["labor", "employment", "employee", "payroll", "hr", "노동", "근로"]),
  classRule("tax", "Tax", ["tax", "vat", "withholding", "related-party", "related party", "ledger", "세무", "조세"]),
  classRule("corporate_governance", "Corporate governance", ["board", "shareholder", "director", "officer", "certificate", "resolution"]),
  classRule("closing_deliverable", "Closing deliverable", ["closing", "cp", "condition precedent", "officer certificate", "bring-down", "disclosure schedule"]),
  classRule("other", "Other diligence material", []),
];

export async function runLddDocumentClassification(options = {}) {
  const result = await buildLddDocumentClassification(options);
  if (options.write !== false) await writeLddDocumentClassification(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD document classification validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddDocumentClassification(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_DOCUMENT_CLASSIFICATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddVdrInventory = sourceById.ldd_vdr_inventory;
  const matterDocumentIndex = sourceById.matter_document_index;
  const sourceDocuments = buildSourceDocuments(lddVdrInventory);
  const classificationRules = buildClassificationRules(generatedAt);
  const classificationRecords = buildClassificationRecords(sourceDocuments, classificationRules, generatedAt);
  const classSummaries = buildClassSummaries(classificationRecords, classificationRules, generatedAt);
  const matterSummaries = buildMatterSummaries(classificationRecords, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddVdrInventory,
    matterDocumentIndex,
    sourceDocuments,
    classificationRules,
    classificationRecords,
    classSummaries,
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
  const summary = summarizeLddDocumentClassification({
    sourceReads,
    lddVdrInventory,
    sourceDocuments,
    classificationRules,
    classificationRecords,
    classSummaries,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_document_classification_id: `ldd-document-classification.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_document_classification_status: summary.ldd_document_classification_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_document_classification_contract: buildContract(generatedAt),
    ldd_document_classification_rules: classificationRules,
    ldd_document_classification_records: classificationRecords,
    ldd_document_class_summaries: classSummaries,
    ldd_document_matter_class_summaries: matterSummaries,
    ldd_document_classification_desktop_boundary: desktopBoundary,
    ldd_document_classification_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddDocumentClassificationMarkdown(result),
  };
}

export async function writeLddDocumentClassification(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddDocumentClassification(result);
  await writeJson(path.join(outDir, "ldd-document-classification.json"), serializable);
  await writeJson(path.join(outDir, "ldd-document-classification-rules.json"), {
    schema_version: "ldd-document-classification-rules.v1",
    generated_at: result.generated_at,
    classification_rule_count: result.ldd_document_classification_rules.length,
    ldd_document_classification_rules: result.ldd_document_classification_rules,
  });
  await writeJson(path.join(outDir, "ldd-document-classification-records.json"), {
    schema_version: "ldd-document-classification-records.v1",
    generated_at: result.generated_at,
    classification_record_count: result.ldd_document_classification_records.length,
    ldd_document_classification_records: result.ldd_document_classification_records,
  });
  await writeJson(path.join(outDir, "ldd-document-class-summaries.json"), {
    schema_version: "ldd-document-class-summaries.v1",
    generated_at: result.generated_at,
    class_summary_count: result.ldd_document_class_summaries.length,
    ldd_document_class_summaries: result.ldd_document_class_summaries,
  });
  await writeJson(path.join(outDir, "ldd-document-matter-class-summaries.json"), {
    schema_version: "ldd-document-matter-class-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_document_matter_class_summaries.length,
    ldd_document_matter_class_summaries: result.ldd_document_matter_class_summaries,
  });
  await writeJson(path.join(outDir, "ldd-document-classification-boundary.json"), {
    schema_version: "ldd-document-classification-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_document_classification_desktop_boundary: result.ldd_document_classification_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-document-classification-validation-report.v1",
    generated_at: result.generated_at,
    ldd_document_classification_id: result.ldd_document_classification_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddDocumentClassificationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddDocumentClassification(args);
    console.log(`LDD document classification ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_document_classification_status}`);
    console.log(`Documents/classes: ${result.summary.classification_record_count}/${result.summary.class_summary_count}`);
    console.log(`File/missing rows: ${result.summary.file_classification_count}/${result.summary.missing_data_classification_count}`);
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
    schema_version: "ldd-document-classification-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    classification_rule: "VDR file and missing-data rows receive deterministic operational document classes using source metadata only",
    supported_class_rule: "contract, registry, license_permit, litigation, labor_employment, tax, corporate_governance, closing_deliverable, and other are supported classes",
    no_legal_conclusion_rule: "document class labels are routing metadata and do not create legal conclusions, legal advice, or client-facing outputs",
    missing_data_rule: "missing/requested documents are classified as follow-up candidates and not factual non-existence findings",
    attorney_review_rule: "all document class records require attorney or human review before downstream legal or client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildSourceDocuments(lddVdrInventory) {
  const fileRows = (lddVdrInventory?.ldd_vdr_file_records ?? []).map((row) => ({
    source_document_id: row.ldd_vdr_file_record_id,
    source_row_kind: "vdr_file",
    ldd_vdr_batch_id: row.ldd_vdr_batch_id,
    matter_id: row.matter_id,
    folder_key: row.folder_key,
    folder_path: row.folder_path,
    source_record_id: row.source_record_id,
    source_collection: row.source_collection,
    title: row.file_title,
    document_type: row.document_type,
    document_status: row.document_status,
    issue: row.issue,
    classification: row.classification,
    missing_data_status: null,
    content_hash: row.content_hash,
  }));
  const missingRows = (lddVdrInventory?.ldd_vdr_missing_data_records ?? []).map((row) => ({
    source_document_id: row.ldd_vdr_missing_data_record_id,
    source_row_kind: "missing_data",
    ldd_vdr_batch_id: row.ldd_vdr_batch_id,
    matter_id: row.matter_id,
    folder_key: row.folder_key,
    folder_path: row.folder_path,
    source_record_id: row.source_record_id,
    source_collection: row.source_collection,
    title: row.missing_title,
    document_type: "missing_or_requested_material",
    document_status: row.missing_status,
    issue: row.issue,
    classification: row.classification,
    missing_data_status: row.missing_data_status,
    content_hash: null,
  }));
  return [...fileRows, ...missingRows].sort((a, b) => a.source_document_id.localeCompare(b.source_document_id));
}

function buildClassificationRules(generatedAt) {
  return DOCUMENT_CLASS_RULES.map((rule, index) => ({
    schema_version: "ldd-document-classification-rule.v1",
    ldd_document_classification_rule_id: `ldd-document-classification-rule.${rule.document_class}`,
    document_class: rule.document_class,
    class_label: rule.class_label,
    keyword_count: rule.keywords.length,
    keywords: rule.keywords,
    rule_priority: index + 1,
    rule_status: "active",
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildClassificationRecords(sourceDocuments, rules, generatedAt) {
  return sourceDocuments.map((document, index) => {
    const classification = classifyDocument(document, rules);
    return {
      schema_version: "ldd-document-classification-record.v1",
      ldd_document_classification_record_id: `ldd-document-classification.${slug(document.source_document_id)}`,
      matter_id: document.matter_id,
      ldd_vdr_batch_id: document.ldd_vdr_batch_id,
      source_document_id: document.source_document_id,
      source_row_kind: document.source_row_kind,
      source_record_id: document.source_record_id,
      source_collection: document.source_collection,
      folder_key: document.folder_key,
      folder_path: document.folder_path,
      document_title: document.title,
      document_type: document.document_type,
      document_status: document.document_status,
      missing_data_status: document.missing_data_status,
      primary_document_class: classification.primary_document_class,
      secondary_document_classes: classification.secondary_document_classes,
      classification_status: "classified_pending_attorney_review",
      classification_confidence: classification.classification_confidence,
      classification_basis: classification.classification_basis,
      matched_keywords: classification.matched_keywords,
      classification_rule_ids: classification.classification_rule_ids,
      issue: document.issue,
      classification: document.classification,
      content_hash: document.content_hash,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_advice_provided: false,
      client_facing_output_generated: false,
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

function classifyDocument(document, rules) {
  const haystack = [
    document.title,
    document.document_type,
    document.issue,
    document.folder_key,
    document.source_collection,
  ].filter(Boolean).join(" ").toLowerCase();
  const matches = rules
    .filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
    .map((rule) => ({
      document_class: rule.document_class,
      rule_id: rule.ldd_document_classification_rule_id,
      matched_keywords: rule.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())),
    }));
  const prioritized = prioritizeMatches(matches, document);
  const primary = prioritized[0]?.document_class ?? "other";
  const secondary = prioritized.slice(1).map((match) => match.document_class);
  const matchedKeywords = [...new Set(prioritized.flatMap((match) => match.matched_keywords))].sort();
  return {
    primary_document_class: primary,
    secondary_document_classes: secondary,
    classification_confidence: matchedKeywords.length > 0 ? "rule_match" : "fallback_review_required",
    classification_basis: matchedKeywords.length > 0 ? "metadata_keyword_rule" : "fallback_other_class_requires_review",
    matched_keywords: matchedKeywords,
    classification_rule_ids: prioritized.map((match) => match.rule_id).length > 0
      ? prioritized.map((match) => match.rule_id)
      : ["ldd-document-classification-rule.other"],
  };
}

function prioritizeMatches(matches, document) {
  const preferred = [];
  const haystack = `${document.title ?? ""} ${document.document_type ?? ""} ${document.issue ?? ""}`.toLowerCase();
  const push = (documentClass) => {
    const match = matches.find((item) => item.document_class === documentClass);
    if (match && !preferred.some((item) => item.document_class === documentClass)) preferred.push(match);
  };
  if (haystack.includes("tax") || haystack.includes("related-party") || haystack.includes("related party")) push("tax");
  if (haystack.includes("spa") || haystack.includes("contract") || haystack.includes("agreement")) push("contract");
  if (haystack.includes("closing") || haystack.includes("officer certificate") || haystack.includes("disclosure schedule")) push("closing_deliverable");
  for (const match of matches) {
    if (!preferred.some((item) => item.document_class === match.document_class)) preferred.push(match);
  }
  return preferred;
}

function buildClassSummaries(records, rules, generatedAt) {
  const rows = [];
  for (const rule of rules) {
    const classRecords = records.filter((record) => record.primary_document_class === rule.document_class);
    if (classRecords.length === 0 && rule.document_class !== "other") continue;
    rows.push({
      schema_version: "ldd-document-class-summary.v1",
      ldd_document_class_summary_id: `ldd-document-class-summary.${rule.document_class}`,
      document_class: rule.document_class,
      class_label: rule.class_label,
      classification_record_count: classRecords.length,
      file_classification_count: classRecords.filter((record) => record.source_row_kind === "vdr_file").length,
      missing_data_classification_count: classRecords.filter((record) => record.source_row_kind === "missing_data").length,
      attorney_review_required_count: classRecords.filter((record) => record.attorney_review_required).length,
      human_review_required_count: classRecords.filter((record) => record.human_review_required).length,
      client_facing_ready_count: classRecords.filter((record) => record.client_facing_ready).length,
      created_at: generatedAt,
    });
  }
  return rows.sort((a, b) => a.document_class.localeCompare(b.document_class));
}

function buildMatterSummaries(records, generatedAt) {
  const matterIds = [...new Set(records.map((record) => record.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterRecords = records.filter((record) => record.matter_id === matterId);
    const classCounts = {};
    for (const record of matterRecords) classCounts[record.primary_document_class] = (classCounts[record.primary_document_class] ?? 0) + 1;
    return {
      schema_version: "ldd-document-matter-class-summary.v1",
      ldd_document_matter_class_summary_id: `ldd-document-matter-class-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_document_matter_classification_status: "classified_pending_attorney_review",
      classification_record_count: matterRecords.length,
      file_classification_count: matterRecords.filter((record) => record.source_row_kind === "vdr_file").length,
      missing_data_classification_count: matterRecords.filter((record) => record.source_row_kind === "missing_data").length,
      distinct_document_class_count: Object.keys(classCounts).length,
      class_counts: classCounts,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, sourceDocuments, classificationRules, classificationRecords, classSummaries, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:document-classification"]), "package.json exposes law-firm:document-classification."),
    checkpoint("roadmap.p241", String(roadmapText ?? "").includes("P241"), "roadmap/ledger keeps P241 visible."),
    checkpoint("source.documents", sourceDocuments.length > 0, `${sourceDocuments.length} VDR document candidate(s) loaded.`),
    checkpoint("rule.count", classificationRules.length >= 8, `${classificationRules.length} document class rule(s) loaded.`),
    checkpoint("classification.coverage", classificationRecords.length === sourceDocuments.length && classificationRecords.length > 0, `${classificationRecords.length}/${sourceDocuments.length} document candidate(s) classified.`),
    checkpoint("class.summary.count", classSummaries.length > 0, `${classSummaries.length} class summary row(s) built.`),
    checkpoint("matter.summary.count", matterSummaries.length > 0, `${matterSummaries.length} matter summary row(s) built.`),
    checkpoint("matter.boundary", everyMatterScoped([...classificationRecords, ...matterSummaries]), "Every classification row is matter_id scoped."),
    checkpoint("review.gate", classificationRecords.every((record) => record.attorney_review_required === true && record.human_review_required === true), "Every classification row remains attorney/human-review gated."),
    checkpoint("no.client.output", classificationRecords.every((record) => record.client_facing_ready === false && record.client_facing_output_generated === false), "No client-facing document classification output is generated."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddDocumentClassification({ sourceReads, sourceDocuments, classificationRules, classificationRecords, classSummaries, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    ldd_document_classification_status: validation.valid ? "complete" : "blocked",
    ldd_document_classification_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_vdr_inventory_status: sourceStatus("ldd_vdr_inventory"),
    source_matter_document_index_status: sourceStatus("matter_document_index"),
    source_document_count: sourceDocuments.length,
    classification_rule_count: classificationRules.length,
    classification_record_count: classificationRecords.length,
    classified_document_count: classificationRecords.filter((record) => record.classification_status === "classified_pending_attorney_review").length,
    class_summary_count: classSummaries.length,
    matter_count: matterSummaries.length,
    file_classification_count: classificationRecords.filter((record) => record.source_row_kind === "vdr_file").length,
    missing_data_classification_count: classificationRecords.filter((record) => record.source_row_kind === "missing_data").length,
    contract_classification_count: classificationRecords.filter((record) => record.primary_document_class === "contract").length,
    tax_classification_count: classificationRecords.filter((record) => record.primary_document_class === "tax").length,
    closing_deliverable_classification_count: classificationRecords.filter((record) => record.primary_document_class === "closing_deliverable").length,
    attorney_review_required_classification_count: classificationRecords.filter((record) => record.attorney_review_required).length,
    human_review_required_classification_count: classificationRecords.filter((record) => record.human_review_required).length,
    client_facing_ready_count: classificationRecords.filter((record) => record.client_facing_ready).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: false,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    final_legal_classification_asserted: false,
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

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "ldd-document-classification-desktop-boundary.v1",
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

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map((source) => ({
      source_id: source.source_id,
      source_kind: source.source_kind,
      path: source.path,
      status: source.status,
      schema_version: source.value?.schema_version ?? null,
      error: source.error ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:document-classification"]),
    roadmap_p241_present: String(roadmapText.value ?? "").includes("P241"),
  };
}

function renderLddDocumentClassificationMarkdown(result) {
  const lines = [
    "# LDD Document Classification",
    "",
    `- Status: ${result.summary.ldd_document_classification_status}`,
    `- Document candidates: ${result.summary.source_document_count}`,
    `- Classified records: ${result.summary.classification_record_count}`,
    `- Class summaries: ${result.summary.class_summary_count}`,
    `- File/missing rows: ${result.summary.file_classification_count}/${result.summary.missing_data_classification_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing output generated: ${result.safe_handling.client_facing_output_generated}`,
    "",
    "## Classes",
    "",
  ];
  for (const summary of result.ldd_document_class_summaries) {
    lines.push(`- ${summary.document_class}: ${summary.classification_record_count} record(s).`);
  }
  lines.push("", "These classes are deterministic routing metadata only. Attorney review remains required before downstream legal or client-facing use.");
  return `${lines.join("\n")}\n`;
}

function serializableLddDocumentClassification(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_DOCUMENT_CLASSIFICATION_INPUTS;
  return {
    ldd_vdr_inventory_path: path.resolve(options.lddVdrInventoryPath ?? defaults.lddVdrInventoryPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? defaults.matterDocumentIndexPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_vdr_inventory", "artifact", inputs.ldd_vdr_inventory_path],
    ["matter_document_index", "artifact", inputs.matter_document_index_path],
  ];
  return Promise.all(artifactInputs.map(async ([sourceId, sourceKind, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      status: read.value ? "complete" : "missing",
      value: read.value,
      error: read.error,
    };
  }));
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function classRule(documentClass, classLabel, keywords) {
  return { document_class: documentClass, class_label: classLabel, keywords };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    items,
    errors,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function everyMatterScoped(items) {
  return items.every((item) => typeof item.matter_id === "string" && item.matter_id.length > 0);
}

function slug(value) {
  return String(value ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "");
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--ldd-vdr-inventory") args.lddVdrInventoryPath = argv[++index];
    else if (arg === "--matter-document-index") args.matterDocumentIndexPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap") args.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-document-classification.mjs [options]

Options:
  --check                         Fail when validation has errors.
  --no-write                      Build without writing artifacts.
  --out-dir <path>                Output directory.
  --ldd-vdr-inventory <path>      ldd-vdr-inventory.json path.
  --matter-document-index <path>  matter-document-index.json path.
  --package <path>                package.json path.
  --roadmap <path>                roadmap or ledger path.
`);
}
