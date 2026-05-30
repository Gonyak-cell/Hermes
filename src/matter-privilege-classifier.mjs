import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_OUT_DIR = "artifacts/matter-privilege-classifier/latest";
export const DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS = {
  matterKnowledgeGraphPath: "artifacts/matter-knowledge-graph/latest/matter-knowledge-graph.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterTaskBoardPath: "artifacts/matter-task-board/latest/matter-task-board.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-privilege-classifier.v1";
const SOURCE_OF_TRUTH = "matter_knowledge_graph_document_index_task_board_and_matter_files";
const FLAG_TYPES = ["privilege", "work_product", "confidentiality", "external_transfer"];

export async function runMatterPrivilegeClassifier(options = {}) {
  const result = await buildMatterPrivilegeClassifier(options);
  if (options.write !== false) await writeMatterPrivilegeClassifier(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter privilege classifier validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterPrivilegeClassifier(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterKnowledgeGraph = sourceById.matter_knowledge_graph;
  const matterDocumentIndex = sourceById.matter_document_index;
  const matterTaskBoard = sourceById.matter_task_board;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;
  const matterContextById = buildMatterContextById(matterFileReads);
  const documentById = new Map((matterDocumentIndex?.document_records ?? []).map((record) => [record.document_id, record]));
  const classificationRecords = buildClassificationRecords({
    generatedAt,
    matterKnowledgeGraph,
    documentById,
    matterContextById,
  });
  const evidenceFlags = classificationRecords.flatMap((record) => record.privilege_evidence_flags);
  const matterSummaries = buildMatterSummaries({
    generatedAt,
    matterContextById,
    classificationRecords,
  });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterKnowledgeGraph,
    matterDocumentIndex,
    matterTaskBoard,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    classificationRecords,
    evidenceFlags,
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
  const summary = summarizeMatterPrivilegeClassifier({
    matterKnowledgeGraph,
    matterDocumentIndex,
    matterTaskBoard,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    classificationRecords,
    evidenceFlags,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_privilege_classifier_id: `matter-privilege-classifier.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_privilege_classifier_status: summary.matter_privilege_classifier_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_privilege_classifier_contract: buildContract(generatedAt),
    privilege_classification_records: classificationRecords.map(stripEmbeddedFlags),
    privilege_evidence_flags: evidenceFlags,
    matter_privilege_summaries: matterSummaries,
    matter_privilege_classifier_desktop_boundary: desktopBoundary,
    matter_privilege_classifier_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterPrivilegeClassifierMarkdown(result),
  };
}

export async function writeMatterPrivilegeClassifier(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterPrivilegeClassifier(result);
  await writeJson(path.join(outDir, "matter-privilege-classifier.json"), serializable);
  await writeJson(path.join(outDir, "privilege-classification-records.json"), {
    schema_version: "privilege-classification-records.v1",
    generated_at: result.generated_at,
    classification_record_count: result.privilege_classification_records.length,
    privilege_classification_records: result.privilege_classification_records,
  });
  await writeJson(path.join(outDir, "privilege-evidence-flags.json"), {
    schema_version: "privilege-evidence-flags.v1",
    generated_at: result.generated_at,
    evidence_flag_count: result.privilege_evidence_flags.length,
    privilege_evidence_flags: result.privilege_evidence_flags,
  });
  await writeJson(path.join(outDir, "matter-privilege-summaries.json"), {
    schema_version: "matter-privilege-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.matter_privilege_summaries.length,
    matter_privilege_summaries: result.matter_privilege_summaries,
  });
  await writeJson(path.join(outDir, "matter-privilege-classifier-boundary.json"), {
    schema_version: "matter-privilege-classifier-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_privilege_classifier_desktop_boundary: result.matter_privilege_classifier_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-privilege-classifier-validation-report.v1",
    generated_at: result.generated_at,
    matter_privilege_classifier_id: result.matter_privilege_classifier_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterPrivilegeClassifierCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterPrivilegeClassifier(args);
    console.log(`Matter privilege classifier ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_privilege_classifier_status}`);
    console.log(`Evidence records: ${result.summary.classification_record_count}`);
    console.log(`Flags: ${result.summary.evidence_flag_count}`);
    console.log(`Privilege/work-product/confidential: ${result.summary.privileged_review_required_count}/${result.summary.work_product_review_required_count}/${result.summary.confidential_flagged_evidence_count}`);
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
    schema_version: "matter-privilege-classifier-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    classifier_rule: "privilege_work_product_and_confidentiality_are_candidate_flags_applied_to_matter_scoped_evidence_rows",
    evidence_rule: "each_evidence_node_from_the_matter_knowledge_graph_receives_privilege_work_product_confidentiality_and_external_transfer_flags",
    privilege_rule: "flags_are_review_candidates_only_and_never_final_privilege_determinations",
    matter_boundary_rule: "every_classification_record_and_flag_carries_one_matter_id_and_never_merges_confidential_context_across_matters",
    attorney_review_rule: "all_privilege_classification_rows_require_attorney_and_human_review_before_client_facing_or_external_use",
    desktop_companion_rule: "desktop_companion_reads_candidate_flags_summaries_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_change_task_state_transition_workflows_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildClassificationRecords({ generatedAt, matterKnowledgeGraph, documentById, matterContextById }) {
  const evidenceNodes = (matterKnowledgeGraph?.graph_nodes ?? []).filter((node) => node.node_type === "evidence");
  return evidenceNodes.map((node, index) => {
    const context = matterContextById.get(node.matter_id) ?? {};
    const documentRecord = documentById.get(node.metadata?.document_record_id) ?? null;
    const signals = deriveSignals({ node, documentRecord, context });
    const classificationRecordId = `matter-privilege-classification.${slugify(node.matter_id)}.${slugify(node.source_record_id)}`;
    const record = {
      schema_version: "matter-privilege-classification-record.v1",
      classification_record_id: classificationRecordId,
      matter_id: node.matter_id,
      evidence_node_id: node.node_id,
      evidence_label: node.label,
      evidence_status: node.node_status,
      source_kind: node.source_kind,
      source_id: node.source_id,
      source_path: node.source_path ?? null,
      source_record_id: node.source_record_id,
      source_label: node.metadata?.source_label ?? null,
      document_record_id: documentRecord?.document_id ?? node.metadata?.document_record_id ?? null,
      document_role: documentRecord?.document_role ?? null,
      document_type: documentRecord?.document_type ?? node.metadata?.document_type ?? null,
      issue_key: node.metadata?.issue_key ?? null,
      confidentiality_level: context.confidentiality_level ?? "unknown",
      access_tier: context.access_tier ?? "unknown",
      privilege_flag: signals.privilege_flag,
      work_product_flag: signals.work_product_flag,
      confidentiality_flag: signals.confidentiality_flag,
      external_transfer_flag: signals.external_transfer_flag,
      classification_status: "candidate_review_required",
      review_status: "attorney_review_required",
      attorney_review_required: true,
      human_review_required: true,
      privilege_determination_final: false,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      source_confidence: signals.source_confidence,
      rationale: signals.rationale,
      created_at: generatedAt,
      sequence_number: index + 1,
      metadata: {
        matter_title: context.matter_title ?? null,
        practice_area: context.practice_area ?? null,
        export_allowed: context.export_allowed ?? false,
        legal_theory_placeholder_source: false,
      },
    };
    return {
      ...record,
      privilege_evidence_flags: buildEvidenceFlagsForRecord(record, generatedAt),
    };
  }).sort(compareClassificationRecords);
}

function deriveSignals({ node, documentRecord, context }) {
  const text = [
    node.label,
    node.node_status,
    node.source_record_id,
    node.metadata?.source_label,
    node.metadata?.issue_key,
    node.metadata?.document_type,
    documentRecord?.document_title,
    documentRecord?.document_type,
    documentRecord?.document_role,
    context.confidentiality_level,
    context.practice_area,
  ].filter(Boolean).join(" ").toLowerCase();
  const rationale = [];
  const privilegedMatter = context.confidentiality_level === "privileged";
  const internalOrAttorneySignal = /client-interview|internal|memo|tax team|strategy|pleading|litigation|attorney|lawyer|legal|claim|court|board minutes|travel/.test(text);
  const draftOrWorkSignal = /draft|markup|memo|strategy|claim|pleading|missing evidence|chronology|investigation|review/.test(text);
  const restrictedSignal = context.access_tier === "restricted" || context.confidentiality_level === "privileged";

  const privilegeFlag = privilegedMatter || internalOrAttorneySignal
    ? "privileged_review_required"
    : "client_confidential_review_required";
  if (privilegedMatter) rationale.push("matter_confidentiality_level_privileged");
  if (internalOrAttorneySignal) rationale.push("attorney_or_legal_context_signal");
  if (!privilegedMatter && !internalOrAttorneySignal) rationale.push("client_confidential_matter_context");

  const workProductFlag = draftOrWorkSignal || privilegedMatter
    ? "work_product_review_required"
    : "no_work_product_signal_detected";
  if (draftOrWorkSignal) rationale.push("draft_strategy_review_or_investigation_signal");

  const confidentialityFlag = privilegedMatter
    ? "privileged_confidential"
    : restrictedSignal
      ? "restricted_confidential"
      : "client_confidential";
  rationale.push(`confidentiality_level_${slugify(context.confidentiality_level ?? "unknown")}`);

  const externalTransferFlag = context.export_allowed === true && privilegeFlag !== "privileged_review_required"
    ? "external_transfer_requires_approval"
    : "external_transfer_blocked";
  if (externalTransferFlag === "external_transfer_blocked") rationale.push("external_transfer_blocked_pending_attorney_review");

  return {
    privilege_flag: privilegeFlag,
    work_product_flag: workProductFlag,
    confidentiality_flag: confidentialityFlag,
    external_transfer_flag: externalTransferFlag,
    source_confidence: documentRecord ? "knowledge_graph_and_document_index" : "knowledge_graph_and_matter_file",
    rationale: [...new Set(rationale)],
  };
}

function buildEvidenceFlagsForRecord(record, generatedAt) {
  return FLAG_TYPES.map((flagType, index) => {
    const flagValue = record[`${flagType}_flag`];
    return {
      schema_version: "matter-privilege-evidence-flag.v1",
      evidence_flag_id: `matter-privilege-flag.${slugify(record.classification_record_id)}.${flagType}`,
      classification_record_id: record.classification_record_id,
      matter_id: record.matter_id,
      evidence_node_id: record.evidence_node_id,
      flag_type: flagType,
      flag_value: flagValue,
      flag_status: "candidate_review_required",
      review_status: "attorney_review_required",
      attorney_review_required: true,
      human_review_required: true,
      privilege_determination_final: false,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      external_transfer_allowed: false,
      created_at: generatedAt,
      sequence_number: index + 1,
    };
  });
}

function buildMatterSummaries({ generatedAt, matterContextById, classificationRecords }) {
  const byMatter = groupBy(classificationRecords, "matter_id");
  return [...byMatter.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([matterId, records]) => {
    const context = matterContextById.get(matterId) ?? {};
    return {
      schema_version: "matter-privilege-summary.v1",
      matter_id: matterId,
      matter_title: context.matter_title ?? matterId,
      matter_privilege_status: "complete",
      classification_record_count: records.length,
      privileged_review_required_count: records.filter((record) => record.privilege_flag === "privileged_review_required").length,
      work_product_review_required_count: records.filter((record) => record.work_product_flag === "work_product_review_required").length,
      confidential_flagged_evidence_count: records.filter((record) => record.confidentiality_flag.endsWith("_confidential") || record.confidentiality_flag === "client_confidential").length,
      external_transfer_blocked_count: records.filter((record) => record.external_transfer_flag === "external_transfer_blocked").length,
      attorney_review_required_count: records.filter((record) => record.attorney_review_required === true).length,
      human_review_required_count: records.filter((record) => record.human_review_required === true).length,
      final_privilege_determination_count: records.filter((record) => record.privilege_determination_final === true).length,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      created_at: generatedAt,
    };
  });
}

function buildMatterContextById(matterFileReads) {
  const contexts = new Map();
  for (const source of matterFileReads) {
    const matter = source.value;
    if (!matter?.matter_id) continue;
    const sourceRegister = matter.source_register ?? [];
    const accessTier = sourceRegister.some((entry) => entry.access_tier === "restricted")
      ? "restricted"
      : sourceRegister.some((entry) => entry.access_tier === "privileged")
        ? "privileged"
        : matter.confidentiality?.level ?? "unknown";
    contexts.set(matter.matter_id, {
      matter_id: matter.matter_id,
      matter_title: matter.title ?? matter.matter_id,
      practice_area: matter.practice_area ?? null,
      confidentiality_level: matter.confidentiality?.level ?? "unknown",
      human_approval_required: matter.confidentiality?.human_approval_required === true,
      export_allowed: matter.confidentiality?.export_allowed === true,
      access_tier: accessTier,
      source_id: source.source_id,
      source_path: source.path,
    });
  }
  return contexts;
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterKnowledgeGraph,
  matterDocumentIndex,
  matterTaskBoard,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  classificationRecords,
  evidenceFlags,
  matterSummaries,
  desktopBoundary,
}) {
  const recordCount = classificationRecords.length;
  const flagCount = evidenceFlags.length;
  const packageHasScript = Boolean(packageJson?.scripts?.["matter:privilege-classifier"]);
  const roadmapMentionsP237 = typeof roadmapText === "string" && roadmapText.includes("P237");
  return [
    checkpoint("source_matter_knowledge_graph_complete", matterKnowledgeGraph?.summary?.matter_knowledge_graph_status === "complete", "Matter Knowledge Graph source is complete."),
    checkpoint("source_matter_document_index_complete", matterDocumentIndex?.summary?.matter_document_index_status === "complete", "Matter Document Index source is complete."),
    checkpoint("source_matter_task_board_complete", matterTaskBoard?.summary?.matter_task_board_status === "complete", "Matter Task Board source is complete."),
    checkpoint("source_output_catalog_available", outputCatalog?.schema_version === "output-artifact-catalog.v1", "Output Catalog source is available."),
    checkpoint("source_delivery_queue_available", deliveryQueue?.schema_version === "protected-delivery-queue.v1", "Protected Delivery Queue source is available."),
    checkpoint("matter_files_available", matterFileReads.length > 0 && matterFileReads.every((source) => source.available && source.value?.matter_id), "Matter files are available and matter-scoped."),
    checkpoint("source_files_available", sourceReads.every((source) => source.available), "All source artifacts and files are available."),
    checkpoint("classification_records_created", recordCount > 0, "Privilege classification records are created."),
    checkpoint("classification_matches_evidence_nodes", recordCount === (matterKnowledgeGraph?.summary?.evidence_node_count ?? 0), "Each evidence node has one classification record."),
    checkpoint("evidence_flags_created", flagCount === recordCount * FLAG_TYPES.length, "Each classification record has privilege, work product, confidentiality, and external transfer flags."),
    checkpoint("records_have_required_flags", classificationRecords.every((record) => FLAG_TYPES.every((flagType) => Boolean(record[`${flagType}_flag`]))), "Every classification record has required flag values."),
    checkpoint("privilege_candidates_present", classificationRecords.some((record) => record.privilege_flag === "privileged_review_required"), "At least one privilege review candidate is present."),
    checkpoint("work_product_candidates_present", classificationRecords.some((record) => record.work_product_flag === "work_product_review_required"), "At least one work-product review candidate is present."),
    checkpoint("confidential_flags_present", classificationRecords.every((record) => record.confidentiality_flag.endsWith("_confidential") || record.confidentiality_flag === "client_confidential"), "Every evidence record has a confidentiality flag."),
    checkpoint("external_transfer_blocked", classificationRecords.every((record) => record.external_transfer_flag === "external_transfer_blocked" || record.external_transfer_flag === "external_transfer_requires_approval"), "External transfer is blocked or requires approval."),
    checkpoint("document_bindings_present", classificationRecords.some((record) => Boolean(record.document_record_id)), "At least one evidence classification is bound to the document index."),
    checkpoint("knowledge_graph_bindings_present", classificationRecords.every((record) => Boolean(record.evidence_node_id)), "Every classification record is bound to a knowledge graph evidence node."),
    checkpoint("matter_summaries_created", matterSummaries.length > 0 && matterSummaries.every((summary) => summary.classification_record_count > 0), "Matter privilege summaries are created."),
    checkpoint("records_matter_id_scoped", classificationRecords.every((record) => Boolean(record.matter_id)), "Every classification record carries a matter_id."),
    checkpoint("flags_matter_id_scoped", evidenceFlags.every((flag) => Boolean(flag.matter_id)), "Every evidence flag carries a matter_id."),
    checkpoint("attorney_review_preserved", classificationRecords.every((record) => record.attorney_review_required === true) && evidenceFlags.every((flag) => flag.attorney_review_required === true), "Attorney review is required for all classification rows."),
    checkpoint("human_review_preserved", classificationRecords.every((record) => record.human_review_required === true) && evidenceFlags.every((flag) => flag.human_review_required === true), "Human review is required for all classification rows."),
    checkpoint("no_final_privilege_determination", classificationRecords.every((record) => record.privilege_determination_final === false) && evidenceFlags.every((flag) => flag.privilege_determination_final === false), "No final privilege determination is made."),
    checkpoint("no_legal_or_client_output", classificationRecords.every((record) => record.legal_advice_provided === false && record.client_facing_output_generated === false) && evidenceFlags.every((flag) => flag.legal_advice_provided === false && flag.client_facing_output_generated === false), "No legal advice or client-facing output is generated."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false, "Desktop boundary is read-only."),
    checkpoint("no_mutating_actions_allowed", desktopBoundary.matter_data_write_allowed === false && desktopBoundary.task_state_write_allowed === false && desktopBoundary.workflow_transition_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.delivery_execution_allowed === false && desktopBoundary.protected_action_allowed === false, "Matter data writes, task writes, workflow transitions, runtime, delivery, and protected actions are disallowed."),
    checkpoint("package_script_registered", packageHasScript, "matter:privilege-classifier package script is registered."),
    checkpoint("roadmap_slot_present", roadmapMentionsP237, "Roadmap ledger still tracks P237 until promotion."),
  ];
}

function summarizeMatterPrivilegeClassifier({
  matterKnowledgeGraph,
  matterDocumentIndex,
  matterTaskBoard,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  classificationRecords,
  evidenceFlags,
  matterSummaries,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const recordCount = classificationRecords.length;
  const flagCount = evidenceFlags.length;
  const failedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length;
  const privilegedReviewCount = classificationRecords.filter((record) => record.privilege_flag === "privileged_review_required").length;
  const workProductReviewCount = classificationRecords.filter((record) => record.work_product_flag === "work_product_review_required").length;
  const confidentialCount = classificationRecords.filter((record) => record.confidentiality_flag.endsWith("_confidential") || record.confidentiality_flag === "client_confidential").length;
  const finalDeterminationCount = classificationRecords.filter((record) => record.privilege_determination_final === true).length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && recordCount > 0
    && flagCount === recordCount * FLAG_TYPES.length
    && privilegedReviewCount > 0
    && workProductReviewCount > 0
    && confidentialCount === recordCount
    && finalDeterminationCount === 0
    && classificationRecords.every((record) => record.matter_id && record.evidence_node_id && record.attorney_review_required === true && record.human_review_required === true)
    && evidenceFlags.every((flag) => flag.matter_id && flag.attorney_review_required === true && flag.human_review_required === true);
  return {
    matter_privilege_classifier_status: complete ? "complete" : "blocked",
    matter_privilege_classifier_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_knowledge_graph_status: matterKnowledgeGraph?.summary?.matter_knowledge_graph_status ?? "unknown",
    source_matter_document_index_status: matterDocumentIndex?.summary?.matter_document_index_status ?? "unknown",
    source_matter_task_board_status: matterTaskBoard?.summary?.matter_task_board_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    matter_count: matterSummaries.length,
    classification_record_count: recordCount,
    evidence_flag_count: flagCount,
    expected_evidence_node_count: matterKnowledgeGraph?.summary?.evidence_node_count ?? 0,
    knowledge_graph_bound_classification_count: classificationRecords.filter((record) => Boolean(record.evidence_node_id)).length,
    document_bound_classification_count: classificationRecords.filter((record) => Boolean(record.document_record_id)).length,
    privileged_review_required_count: privilegedReviewCount,
    client_confidential_review_required_count: classificationRecords.filter((record) => record.privilege_flag === "client_confidential_review_required").length,
    work_product_review_required_count: workProductReviewCount,
    no_work_product_signal_count: classificationRecords.filter((record) => record.work_product_flag === "no_work_product_signal_detected").length,
    confidential_flagged_evidence_count: confidentialCount,
    privileged_confidential_count: classificationRecords.filter((record) => record.confidentiality_flag === "privileged_confidential").length,
    restricted_confidential_count: classificationRecords.filter((record) => record.confidentiality_flag === "restricted_confidential").length,
    client_confidential_count: classificationRecords.filter((record) => record.confidentiality_flag === "client_confidential").length,
    external_transfer_blocked_count: classificationRecords.filter((record) => record.external_transfer_flag === "external_transfer_blocked").length,
    external_transfer_requires_approval_count: classificationRecords.filter((record) => record.external_transfer_flag === "external_transfer_requires_approval").length,
    candidate_review_required_count: classificationRecords.filter((record) => record.classification_status === "candidate_review_required").length,
    attorney_review_required_classification_count: classificationRecords.filter((record) => record.attorney_review_required === true).length,
    attorney_review_required_flag_count: evidenceFlags.filter((flag) => flag.attorney_review_required === true).length,
    human_review_required_classification_count: classificationRecords.filter((record) => record.human_review_required === true).length,
    human_review_required_flag_count: evidenceFlags.filter((flag) => flag.human_review_required === true).length,
    matter_id_scoped_classification_count: classificationRecords.filter((record) => Boolean(record.matter_id)).length,
    matter_id_scoped_flag_count: evidenceFlags.filter((flag) => Boolean(flag.matter_id)).length,
    final_privilege_determination_count: finalDeterminationCount,
    legal_advice_provided: classificationRecords.some((record) => record.legal_advice_provided === true) || evidenceFlags.some((flag) => flag.legal_advice_provided === true),
    client_facing_output_generated: classificationRecords.some((record) => record.client_facing_output_generated === true) || evidenceFlags.some((flag) => flag.client_facing_output_generated === true),
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    final_privilege_determination_made: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
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
    schema_version: "matter-privilege-classifier-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    mutation_allowed: false,
    source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_allowed: false,
    final_privilege_determination_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    allowed_operations: [
      "read_candidate_privilege_flags",
      "read_evidence_classification_records",
      "read_matter_privilege_summaries",
      "read_boundary_status",
    ],
    blocked_operations: [
      "make_final_privilege_determination",
      "write_matter_data",
      "mutate_task_state",
      "transition_workflow_state",
      "execute_runtime_action",
      "deliver_output",
      "provide_legal_advice",
      "generate_client_facing_output_without_attorney_review",
    ],
    created_at: generatedAt,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  const contracts = {};
  for (const source of sourceReads) {
    contracts[source.source_id] = {
      schema_version: source.value?.schema_version ?? null,
      source_kind: source.source_kind,
      path: source.path,
      available: source.available,
      content_hash: source.content_hash,
      error: source.error,
    };
  }
  contracts.package_json = {
    schema_version: null,
    path: packageJson.path,
    available: packageJson.available,
    content_hash: packageJson.content_hash,
    error: packageJson.error,
  };
  contracts.roadmap = {
    schema_version: null,
    path: roadmapText.path,
    available: roadmapText.available,
    content_hash: roadmapText.content_hash,
    error: roadmapText.error,
  };
  return contracts;
}

async function readSourceArtifacts(inputs) {
  const sources = [
    { source_id: "matter_knowledge_graph", source_kind: "artifact", path: inputs.matter_knowledge_graph_path },
    { source_id: "matter_document_index", source_kind: "artifact", path: inputs.matter_document_index_path },
    { source_id: "matter_task_board", source_kind: "artifact", path: inputs.matter_task_board_path },
    { source_id: "output_catalog", source_kind: "artifact", path: inputs.output_catalog_path },
    { source_id: "delivery_queue", source_kind: "artifact", path: inputs.delivery_queue_path },
    ...inputs.matter_files.map((matterPath, index) => ({
      source_id: `matter_file_${index + 1}`,
      source_kind: "matter_file",
      path: matterPath,
    })),
  ];
  return Promise.all(sources.map(readSource));
}

async function readSource(source) {
  const result = await readJsonOrError(source.path);
  return {
    ...source,
    available: result.available,
    value: result.value,
    error: result.error,
    content_hash: result.content_hash,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: JSON.parse(raw),
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: raw,
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

function normalizeInputs(options) {
  return {
    matter_knowledge_graph_path: path.resolve(options.matterKnowledgeGraphPath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.matterKnowledgeGraphPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.matterDocumentIndexPath),
    matter_task_board_path: path.resolve(options.matterTaskBoardPath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.matterTaskBoardPath),
    matter_files: (options.matterFiles ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.matterFiles).map((matterPath) => path.resolve(matterPath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_PRIVILEGE_CLASSIFIER_INPUTS.roadmapPath),
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
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-knowledge-graph") parsed.matterKnowledgeGraphPath = argv[++index];
    else if (arg === "--matter-document-index") parsed.matterDocumentIndexPath = argv[++index];
    else if (arg === "--matter-task-board") parsed.matterTaskBoardPath = argv[++index];
    else if (arg === "--matter-file") {
      parsed.matterFiles = parsed.matterFiles ?? [];
      parsed.matterFiles.push(argv[++index]);
    } else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-privilege-classifier.mjs [options]

Options:
  --check                         Fail if validation does not pass
  --out-dir <path>                Output directory
  --matter-knowledge-graph <path> Matter Knowledge Graph artifact
  --matter-document-index <path>  Matter Document Index artifact
  --matter-task-board <path>      Matter Task Board artifact
  --matter-file <path>            Matter file; may be repeated
  --output-catalog <path>         Output catalog artifact
  --delivery-queue <path>         Protected delivery queue artifact
  --package <path>                package.json path
  --roadmap <path>                roadmap/ledger path
  --run-at <iso>                  Deterministic generated_at timestamp
`);
}

function renderMatterPrivilegeClassifierMarkdown(result) {
  const lines = [];
  lines.push("# Matter Privilege Classifier");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_privilege_classifier_status}`);
  lines.push(`Evidence classifications: ${result.summary.classification_record_count}`);
  lines.push(`Evidence flags: ${result.summary.evidence_flag_count}`);
  lines.push(`Privilege review required: ${result.summary.privileged_review_required_count}`);
  lines.push(`Work product review required: ${result.summary.work_product_review_required_count}`);
  lines.push(`Confidential flagged evidence: ${result.summary.confidential_flagged_evidence_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Matter | Evidence | Privilege | Work product | Confidentiality | External transfer |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const record of result.privilege_classification_records) {
    lines.push(`| ${record.matter_id} | ${record.evidence_label} | ${record.privilege_flag} | ${record.work_product_flag} | ${record.confidentiality_flag} | ${record.external_transfer_flag} |`);
  }
  lines.push("");
  lines.push("Human review note: These are candidate privilege, work-product, confidentiality, and transfer flags for attorney review. They are not final privilege determinations, legal advice, or client-facing output, and they do not write matter data or execute/deliver anything.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterPrivilegeClassifier(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function stripEmbeddedFlags(record) {
  const { privilege_evidence_flags: _flags, ...rest } = record;
  return rest;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    checkpoint_status: passed ? "passed" : "failed",
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!value) continue;
    const list = grouped.get(value) ?? [];
    list.push(item);
    grouped.set(value, list);
  }
  return grouped;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareClassificationRecords(left, right) {
  return String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.evidence_label).localeCompare(String(right.evidence_label))
    || String(left.classification_record_id).localeCompare(String(right.classification_record_id));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
