import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_OUT_DIR = "artifacts/matter-personal-data-detector/latest";
export const DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS = {
  matterKnowledgeGraphPath: "artifacts/matter-knowledge-graph/latest/matter-knowledge-graph.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterPrivilegeClassifierPath: "artifacts/matter-privilege-classifier/latest/matter-privilege-classifier.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  resourceQuarantineModelPath: "artifacts/resource-quarantine/latest/resource-quarantine-model.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-personal-data-detector.v1";
const SOURCE_OF_TRUTH = "matter_knowledge_graph_document_index_privilege_classifier_policy_quarantine_and_matter_files";
const PERSONAL_DATA_CLASSIFICATION = "P4_HIGHLY_RESTRICTED";

export async function runMatterPersonalDataDetector(options = {}) {
  const result = await buildMatterPersonalDataDetector(options);
  if (options.write !== false) await writeMatterPersonalDataDetector(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter personal data detector validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterPersonalDataDetector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterKnowledgeGraph = sourceById.matter_knowledge_graph;
  const matterDocumentIndex = sourceById.matter_document_index;
  const matterPrivilegeClassifier = sourceById.matter_privilege_classifier;
  const dataClassificationRuleEngine = sourceById.data_classification_rule_engine;
  const resourceQuarantineModel = sourceById.resource_quarantine_model;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;
  const matterContextById = buildMatterContextById(matterFileReads);
  const documentById = new Map((matterDocumentIndex?.document_records ?? []).map((record) => [record.document_id, record]));
  const privilegeByEvidenceId = new Map((matterPrivilegeClassifier?.privilege_classification_records ?? []).map((record) => [record.evidence_node_id, record]));
  const policyContext = selectPersonalDataPolicy(dataClassificationRuleEngine);
  const quarantineContext = selectPersonalDataQuarantineRule(resourceQuarantineModel);
  const detectionRecords = buildDetectionRecords({
    generatedAt,
    matterKnowledgeGraph,
    documentById,
    privilegeByEvidenceId,
    matterContextById,
    policyContext,
    quarantineContext,
  });
  const policyLinks = buildPolicyLinks(detectionRecords, policyContext, generatedAt);
  const quarantineLinks = buildQuarantineLinks(detectionRecords, quarantineContext, generatedAt);
  const matterSummaries = buildMatterSummaries({
    generatedAt,
    matterContextById,
    detectionRecords,
    policyLinks,
    quarantineLinks,
  });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterKnowledgeGraph,
    matterDocumentIndex,
    matterPrivilegeClassifier,
    dataClassificationRuleEngine,
    resourceQuarantineModel,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    detectionRecords,
    policyLinks,
    quarantineLinks,
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
  const summary = summarizeMatterPersonalDataDetector({
    matterKnowledgeGraph,
    matterDocumentIndex,
    matterPrivilegeClassifier,
    dataClassificationRuleEngine,
    resourceQuarantineModel,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    detectionRecords,
    policyLinks,
    quarantineLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_personal_data_detector_id: `matter-personal-data-detector.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_personal_data_detector_status: summary.matter_personal_data_detector_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_personal_data_detector_contract: buildContract(generatedAt),
    personal_data_detection_records: detectionRecords,
    personal_data_policy_links: policyLinks,
    personal_data_quarantine_links: quarantineLinks,
    matter_personal_data_summaries: matterSummaries,
    matter_personal_data_detector_desktop_boundary: desktopBoundary,
    matter_personal_data_detector_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterPersonalDataDetectorMarkdown(result),
  };
}

export async function writeMatterPersonalDataDetector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterPersonalDataDetector(result);
  await writeJson(path.join(outDir, "matter-personal-data-detector.json"), serializable);
  await writeJson(path.join(outDir, "personal-data-detection-records.json"), {
    schema_version: "personal-data-detection-records.v1",
    generated_at: result.generated_at,
    detection_record_count: result.personal_data_detection_records.length,
    personal_data_detection_records: result.personal_data_detection_records,
  });
  await writeJson(path.join(outDir, "personal-data-policy-links.json"), {
    schema_version: "personal-data-policy-links.v1",
    generated_at: result.generated_at,
    policy_link_count: result.personal_data_policy_links.length,
    personal_data_policy_links: result.personal_data_policy_links,
  });
  await writeJson(path.join(outDir, "personal-data-quarantine-links.json"), {
    schema_version: "personal-data-quarantine-links.v1",
    generated_at: result.generated_at,
    quarantine_link_count: result.personal_data_quarantine_links.length,
    personal_data_quarantine_links: result.personal_data_quarantine_links,
  });
  await writeJson(path.join(outDir, "matter-personal-data-summaries.json"), {
    schema_version: "matter-personal-data-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.matter_personal_data_summaries.length,
    matter_personal_data_summaries: result.matter_personal_data_summaries,
  });
  await writeJson(path.join(outDir, "matter-personal-data-detector-boundary.json"), {
    schema_version: "matter-personal-data-detector-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_personal_data_detector_desktop_boundary: result.matter_personal_data_detector_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-personal-data-detector-validation-report.v1",
    generated_at: result.generated_at,
    matter_personal_data_detector_id: result.matter_personal_data_detector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterPersonalDataDetectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterPersonalDataDetector(args);
    console.log(`Matter personal data detector ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_personal_data_detector_status}`);
    console.log(`Detections: ${result.summary.detection_record_count}`);
    console.log(`Policy/quarantine links: ${result.summary.policy_link_count}/${result.summary.quarantine_link_count}`);
    console.log(`Sensitive review required: ${result.summary.sensitive_personal_data_flagged_count}`);
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
    schema_version: "matter-personal-data-detector-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    detector_rule: "personal_data_signals_are_candidate_review_rows_derived_from_matter_scoped_evidence_and_document_records",
    policy_binding_rule: "each_candidate_detection_links_to_the_personal_data_classification_policy_rule_without_mutating_policy_state",
    quarantine_binding_rule: "each_candidate_detection_links_to_the_sensitive_data_quarantine_rule_without_applying_quarantine_or_releasing_resources",
    matter_boundary_rule: "every_detection_policy_link_and_quarantine_link_carries_one_matter_id_and_never_mixes_context_across_matters",
    attorney_review_rule: "all_personal_data_candidate_rows_require_attorney_and_human_review_before_client_facing_or_external_use",
    desktop_companion_rule: "desktop_companion_reads_candidate_detection_summaries_policy_links_quarantine_links_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_change_task_state_transition_workflows_execute_runtime_actions_apply_quarantine_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildDetectionRecords({
  generatedAt,
  matterKnowledgeGraph,
  documentById,
  privilegeByEvidenceId,
  matterContextById,
  policyContext,
  quarantineContext,
}) {
  const evidenceNodes = (matterKnowledgeGraph?.graph_nodes ?? []).filter((node) => node.node_type === "evidence");
  return evidenceNodes.flatMap((node, index) => {
    const context = matterContextById.get(node.matter_id) ?? {};
    const documentRecord = documentById.get(node.metadata?.document_record_id) ?? null;
    const privilegeRecord = privilegeByEvidenceId.get(node.node_id) ?? null;
    const signals = derivePersonalDataSignals({ node, documentRecord, privilegeRecord, context });
    if (signals.length === 0) return [];
    const categories = unique(signals.flatMap((signal) => signal.categories));
    const sensitive = signals.some((signal) => signal.sensitive === true);
    const detectionRecordId = `matter-personal-data-detection.${slugify(node.matter_id)}.${slugify(node.source_record_id)}`;
    return [{
      schema_version: "matter-personal-data-detection-record.v1",
      personal_data_detection_record_id: detectionRecordId,
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
      document_title: documentRecord?.document_title ?? null,
      issue_key: node.metadata?.issue_key ?? null,
      detected_personal_data_categories: categories,
      primary_personal_data_category: categories[0] ?? "unknown",
      personal_data_flag: sensitive ? "sensitive_personal_data_review_required" : "personal_data_review_required",
      sensitive_personal_data: sensitive,
      personal_data_detection_status: "candidate_review_required",
      review_status: "attorney_review_required",
      attorney_review_required: true,
      human_review_required: true,
      policy_classification: policyContext.classification,
      policy_rule_id: policyContext.classification_rule_id,
      policy_reference_id: policyContext.classification_policy_binding_id,
      policy_binding_status: "bound",
      quarantine_rule_id: quarantineContext.quarantine_rule_id,
      quarantine_reference_id: quarantineContext.quarantine_rule_id,
      quarantine_binding_status: "bound",
      quarantine_action: "quarantine_review_required_not_applied",
      quarantine_applied: false,
      source_confidentiality_classification: privilegeRecord?.confidentiality_flag ?? context.confidentiality_level ?? "unknown",
      privilege_candidate_record_id: privilegeRecord?.classification_record_id ?? null,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      policy_enforcement_mutation_performed: false,
      quarantine_execution_performed: false,
      source_confidence: documentRecord && privilegeRecord
        ? "knowledge_graph_document_index_and_privilege_classifier"
        : privilegeRecord
          ? "knowledge_graph_and_privilege_classifier"
          : "knowledge_graph_and_matter_file",
      detection_signals: signals.map((signal) => ({
        signal_id: signal.signal_id,
        signal_type: signal.signal_type,
        categories: signal.categories,
        sensitive: signal.sensitive,
        rationale: signal.rationale,
      })),
      rationale: unique(signals.map((signal) => signal.rationale)),
      created_at: generatedAt,
      sequence_number: index + 1,
      metadata: {
        matter_title: context.matter_title ?? null,
        practice_area: context.practice_area ?? null,
        policy_required_gates: policyContext.required_gates,
        quarantine_hold_category: quarantineContext.category,
        export_allowed: context.export_allowed ?? false,
      },
    }];
  }).sort(compareDetectionRecords);
}

function derivePersonalDataSignals({ node, documentRecord, privilegeRecord, context }) {
  const text = [
    node.label,
    node.node_status,
    node.source_record_id,
    node.metadata?.source_label,
    node.metadata?.issue_key,
    node.metadata?.owner,
    node.metadata?.document_type,
    documentRecord?.document_title,
    documentRecord?.document_type,
    documentRecord?.owner,
    documentRecord?.issue,
    privilegeRecord?.privilege_flag,
    privilegeRecord?.confidentiality_flag,
    context.matter_title,
    context.practice_area,
    context.confidentiality_level,
    ...(context.person_names ?? []),
    ...(context.owner_names ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
  const signals = [];
  const personNamePattern = /(partner|senior|associate|paralegal|director|officer|client|counsel)\s+[a-z]|kim|lee|park|choi|director a|client side|team|owner/;
  if (personNamePattern.test(text)) {
    signals.push(signal("person_name_or_role", ["person_name_or_role"], false, "matter_team_owner_or_role_name_signal"));
  }
  if (/partner|senior|associate|paralegal|counsel|attorney|tax team/.test(text)) {
    signals.push(signal("attorney_or_staff_identifier", ["attorney_or_staff_identifier"], false, "attorney_staff_or_workstream_owner_signal"));
  }
  if (/client-interview|communication|teams|meeting|email|chat|call|pending question/.test(text)) {
    signals.push(signal("communication_participant", ["communication_participant"], false, "communication_or_client_interview_signal"));
  }
  if (/travel|itinerary|authorization/.test(text)) {
    signals.push(signal("travel_record", ["travel_or_location_record"], true, "travel_record_personal_data_signal"));
  }
  if (/attendance|board minutes|access log|video conference/.test(text)) {
    signals.push(signal("attendance_or_access_record", ["attendance_or_access_record"], true, "attendance_or_access_record_signal"));
  }
  if (/officer certificate|bring-down|certificate|signature/.test(text)) {
    signals.push(signal("certificate_or_signature_record", ["certificate_or_signature_record"], false, "certificate_or_signature_person_record_signal"));
  }
  if (/billing|timekeeper|owner/.test(text)) {
    signals.push(signal("ownership_or_billing_record", ["ownership_or_billing_record"], false, "owner_or_billing_person_signal"));
  }
  return dedupeSignals(signals);
}

function signal(signalType, categories, sensitive, rationale) {
  return {
    signal_id: `personal-data-signal.${signalType}`,
    signal_type: signalType,
    categories,
    sensitive,
    rationale,
  };
}

function buildPolicyLinks(detectionRecords, policyContext, generatedAt) {
  return detectionRecords.map((record) => ({
    schema_version: "personal-data-policy-link.v1",
    personal_data_policy_link_id: `personal-data-policy-link.${slugify(record.personal_data_detection_record_id)}`,
    personal_data_detection_record_id: record.personal_data_detection_record_id,
    matter_id: record.matter_id,
    evidence_node_id: record.evidence_node_id,
    policy_classification: policyContext.classification,
    classification_rule_id: policyContext.classification_rule_id,
    policy_decision_id: policyContext.policy_decision_id,
    classification_policy_binding_id: policyContext.classification_policy_binding_id,
    external_model_decision: policyContext.external_model_decision,
    default_policy_decision: policyContext.default_policy_decision,
    required_gates: policyContext.required_gates,
    policy_binding_status: "bound",
    policy_mutation_performed: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  })).sort(by("personal_data_policy_link_id"));
}

function buildQuarantineLinks(detectionRecords, quarantineContext, generatedAt) {
  return detectionRecords.map((record) => ({
    schema_version: "personal-data-quarantine-link.v1",
    personal_data_quarantine_link_id: `personal-data-quarantine-link.${slugify(record.personal_data_detection_record_id)}`,
    personal_data_detection_record_id: record.personal_data_detection_record_id,
    matter_id: record.matter_id,
    evidence_node_id: record.evidence_node_id,
    quarantine_rule_id: quarantineContext.quarantine_rule_id,
    quarantine_category: quarantineContext.category,
    quarantine_binding_status: "bound",
    quarantine_action: "quarantine_review_required_not_applied",
    quarantine_applied: false,
    retrieval_allowed: false,
    external_transfer_allowed: false,
    output_delivery_allowed: false,
    auto_release_allowed: false,
    human_review_required: true,
    attorney_review_required: true,
    release_required_before_use: true,
    release_requirements: ["manual_release_receipt", "classification_owner_review"],
    created_at: generatedAt,
  })).sort(by("personal_data_quarantine_link_id"));
}

function buildMatterSummaries({ generatedAt, matterContextById, detectionRecords, policyLinks, quarantineLinks }) {
  const byMatter = groupBy(detectionRecords, "matter_id");
  const policyLinksByMatter = groupBy(policyLinks, "matter_id");
  const quarantineLinksByMatter = groupBy(quarantineLinks, "matter_id");
  return [...byMatter.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([matterId, records]) => {
    const context = matterContextById.get(matterId) ?? {};
    const matterPolicyLinks = policyLinksByMatter.get(matterId) ?? [];
    const matterQuarantineLinks = quarantineLinksByMatter.get(matterId) ?? [];
    return {
      schema_version: "matter-personal-data-summary.v1",
      matter_id: matterId,
      matter_title: context.matter_title ?? matterId,
      matter_personal_data_status: "complete",
      detection_record_count: records.length,
      sensitive_personal_data_flagged_count: records.filter((record) => record.sensitive_personal_data === true).length,
      policy_link_count: matterPolicyLinks.length,
      quarantine_link_count: matterQuarantineLinks.length,
      policy_bound_detection_count: matterPolicyLinks.filter((link) => link.policy_binding_status === "bound").length,
      quarantine_bound_detection_count: matterQuarantineLinks.filter((link) => link.quarantine_binding_status === "bound").length,
      quarantine_applied_count: matterQuarantineLinks.filter((link) => link.quarantine_applied === true).length,
      attorney_review_required_count: records.filter((record) => record.attorney_review_required === true).length,
      human_review_required_count: records.filter((record) => record.human_review_required === true).length,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      created_at: generatedAt,
    };
  });
}

function selectPersonalDataPolicy(dataClassificationRuleEngine) {
  const rules = dataClassificationRuleEngine?.classification_rule_catalog?.classification_rules ?? [];
  const bindings = dataClassificationRuleEngine?.classification_rule_catalog?.classification_policy_bindings ?? [];
  const rule = rules.find((candidate) => candidate.classification === PERSONAL_DATA_CLASSIFICATION)
    ?? rules.find((candidate) => candidate.required_gates?.includes("personal_data_gate"))
    ?? rules.find((candidate) => candidate.classification === "P2_CLIENT_CONFIDENTIAL")
    ?? {};
  const binding = bindings.find((candidate) => candidate.classification === rule.classification) ?? {};
  return {
    classification: rule.classification ?? PERSONAL_DATA_CLASSIFICATION,
    classification_rule_id: rule.classification_rule_id ?? "data-classification-rule.p4-highly-restricted",
    policy_decision_id: rule.policy_decision_id ?? binding.policy_decision_id ?? null,
    classification_policy_binding_id: binding.classification_policy_binding_id ?? `classification-policy-binding.${slugify(rule.classification ?? PERSONAL_DATA_CLASSIFICATION)}`,
    external_model_decision: rule.external_model_decision ?? binding.external_model_decision ?? "review",
    default_policy_decision: rule.default_policy_decision ?? binding.default_policy_decision ?? "review",
    required_gates: unique([...(rule.required_gates ?? []), "personal_data_gate", "human_approval_gate"]),
  };
}

function selectPersonalDataQuarantineRule(resourceQuarantineModel) {
  const rules = resourceQuarantineModel?.quarantine_catalog?.quarantine_rules ?? [];
  const rule = rules.find((candidate) => candidate.category === "sensitive_data") ?? {};
  return {
    quarantine_rule_id: rule.quarantine_rule_id ?? "resource-quarantine-rule.sensitive_data",
    category: rule.category ?? "sensitive_data",
    default_hold_status: rule.default_hold_status ?? "held_for_human_review",
    human_review_required: rule.human_review_required ?? true,
  };
}

function buildMatterContextById(matterFileReads) {
  const contexts = new Map();
  for (const source of matterFileReads) {
    const matter = source.value;
    if (!matter?.matter_id) continue;
    const personNames = [
      ...(matter.team ?? []).map((member) => member.name),
      matter.client?.name,
    ].filter(Boolean);
    const ownerNames = collectOwners(matter);
    contexts.set(matter.matter_id, {
      matter_id: matter.matter_id,
      matter_title: matter.title ?? matter.matter_id,
      practice_area: matter.practice_area ?? null,
      confidentiality_level: matter.confidentiality?.level ?? "unknown",
      human_approval_required: matter.confidentiality?.human_approval_required === true,
      export_allowed: matter.confidentiality?.export_allowed === true,
      person_names: unique(personNames),
      owner_names: unique(ownerNames),
      source_id: source.source_id,
      source_path: source.path,
    });
  }
  return contexts;
}

function collectOwners(matter) {
  const owners = [];
  for (const key of ["tasks", "deadlines", "documents", "risks"]) {
    for (const item of matter[key] ?? []) {
      if (item.owner) owners.push(item.owner);
    }
  }
  for (const item of matter.litigation_control?.claim_evidence ?? []) {
    if (item.owner) owners.push(item.owner);
  }
  for (const item of matter.deal_control?.cp_checklist ?? []) {
    if (item.owner) owners.push(item.owner);
  }
  return owners;
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterKnowledgeGraph,
  matterDocumentIndex,
  matterPrivilegeClassifier,
  dataClassificationRuleEngine,
  resourceQuarantineModel,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  detectionRecords,
  policyLinks,
  quarantineLinks,
  matterSummaries,
  desktopBoundary,
}) {
  const recordCount = detectionRecords.length;
  const packageHasScript = Boolean(packageJson?.scripts?.["matter:personal-data-detector"]);
  const roadmapMentionsP238 = typeof roadmapText === "string" && roadmapText.includes("P238");
  return [
    checkpoint("source_matter_knowledge_graph_complete", matterKnowledgeGraph?.summary?.matter_knowledge_graph_status === "complete", "Matter Knowledge Graph source is complete."),
    checkpoint("source_matter_document_index_complete", matterDocumentIndex?.summary?.matter_document_index_status === "complete", "Matter Document Index source is complete."),
    checkpoint("source_matter_privilege_classifier_complete", matterPrivilegeClassifier?.summary?.matter_privilege_classifier_status === "complete", "Matter Privilege Classifier source is complete."),
    checkpoint("source_data_classification_rules_complete", dataClassificationRuleEngine?.summary?.classification_rule_engine_status === "complete", "Data Classification Rule Engine source is complete."),
    checkpoint("source_resource_quarantine_complete", resourceQuarantineModel?.summary?.resource_quarantine_status === "complete", "Resource Quarantine Model source is complete."),
    checkpoint("source_output_catalog_available", outputCatalog?.schema_version === "output-artifact-catalog.v1", "Output Catalog source is available."),
    checkpoint("source_delivery_queue_available", deliveryQueue?.schema_version === "protected-delivery-queue.v1", "Protected Delivery Queue source is available."),
    checkpoint("matter_files_available", matterFileReads.length > 0 && matterFileReads.every((source) => source.available), "Matter files are readable."),
    checkpoint("detections_present", recordCount > 0, "At least one personal data candidate detection exists."),
    checkpoint("all_detections_flagged", detectionRecords.every((record) => record.personal_data_flag === "personal_data_review_required" || record.personal_data_flag === "sensitive_personal_data_review_required"), "Every detection has a personal data review flag."),
    checkpoint("sensitive_detection_present", detectionRecords.some((record) => record.sensitive_personal_data === true), "At least one sensitive personal data candidate is present."),
    checkpoint("detections_matter_id_scoped", detectionRecords.every((record) => Boolean(record.matter_id)), "Every detection carries a matter_id."),
    checkpoint("detections_knowledge_graph_bound", detectionRecords.every((record) => Boolean(record.evidence_node_id)), "Every detection is bound to a knowledge graph evidence node."),
    checkpoint("detections_policy_bound", policyLinks.length === recordCount && policyLinks.every((link) => link.policy_binding_status === "bound" && link.required_gates.includes("personal_data_gate")), "Every detection is bound to a personal data policy rule."),
    checkpoint("detections_quarantine_bound", quarantineLinks.length === recordCount && quarantineLinks.every((link) => link.quarantine_binding_status === "bound" && link.quarantine_category === "sensitive_data"), "Every detection is bound to the sensitive data quarantine rule."),
    checkpoint("quarantine_not_applied", quarantineLinks.every((link) => link.quarantine_applied === false), "The detector does not apply quarantine; it only links candidate rows for review."),
    checkpoint("attorney_review_preserved", detectionRecords.every((record) => record.attorney_review_required === true) && policyLinks.every((link) => link.attorney_review_required === true) && quarantineLinks.every((link) => link.attorney_review_required === true), "Attorney review is required for all detection rows."),
    checkpoint("human_review_preserved", detectionRecords.every((record) => record.human_review_required === true) && policyLinks.every((link) => link.human_review_required === true) && quarantineLinks.every((link) => link.human_review_required === true), "Human review is required for all detection rows."),
    checkpoint("matter_summaries_present", matterSummaries.length > 0, "Matter personal data summaries are present."),
    checkpoint("no_legal_or_client_output", detectionRecords.every((record) => record.legal_advice_provided === false && record.client_facing_output_generated === false), "No legal advice or client-facing output is generated."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false, "Desktop boundary is read-only."),
    checkpoint("no_mutating_actions_allowed", desktopBoundary.matter_data_write_allowed === false && desktopBoundary.task_state_write_allowed === false && desktopBoundary.workflow_transition_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.delivery_execution_allowed === false && desktopBoundary.protected_action_allowed === false && desktopBoundary.quarantine_execution_allowed === false, "Matter data writes, task writes, workflow transitions, runtime, delivery, protected actions, and quarantine execution are disallowed."),
    checkpoint("package_script_registered", packageHasScript, "matter:personal-data-detector package script is registered."),
    checkpoint("roadmap_slot_present", roadmapMentionsP238, "Roadmap ledger still tracks P238 until promotion."),
  ];
}

function summarizeMatterPersonalDataDetector({
  matterKnowledgeGraph,
  matterDocumentIndex,
  matterPrivilegeClassifier,
  dataClassificationRuleEngine,
  resourceQuarantineModel,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  detectionRecords,
  policyLinks,
  quarantineLinks,
  matterSummaries,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const recordCount = detectionRecords.length;
  const failedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length;
  const sensitiveCount = detectionRecords.filter((record) => record.sensitive_personal_data === true).length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && recordCount > 0
    && detectionRecords.every((record) => record.matter_id && record.evidence_node_id && record.attorney_review_required === true && record.human_review_required === true)
    && sensitiveCount > 0
    && policyLinks.length === recordCount
    && quarantineLinks.length === recordCount
    && policyLinks.every((link) => link.policy_binding_status === "bound")
    && quarantineLinks.every((link) => link.quarantine_binding_status === "bound" && link.quarantine_applied === false);
  return {
    matter_personal_data_detector_status: complete ? "complete" : "blocked",
    matter_personal_data_detector_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_knowledge_graph_status: matterKnowledgeGraph?.summary?.matter_knowledge_graph_status ?? "unknown",
    source_matter_document_index_status: matterDocumentIndex?.summary?.matter_document_index_status ?? "unknown",
    source_matter_privilege_classifier_status: matterPrivilegeClassifier?.summary?.matter_privilege_classifier_status ?? "unknown",
    source_data_classification_rule_engine_status: dataClassificationRuleEngine?.summary?.classification_rule_engine_status ?? "unknown",
    source_resource_quarantine_status: resourceQuarantineModel?.summary?.resource_quarantine_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    matter_count: matterSummaries.length,
    detection_record_count: recordCount,
    personal_data_flagged_count: detectionRecords.filter((record) => record.personal_data_flag === "personal_data_review_required" || record.personal_data_flag === "sensitive_personal_data_review_required").length,
    sensitive_personal_data_flagged_count: sensitiveCount,
    policy_link_count: policyLinks.length,
    quarantine_link_count: quarantineLinks.length,
    policy_bound_detection_count: policyLinks.filter((link) => link.policy_binding_status === "bound").length,
    quarantine_bound_detection_count: quarantineLinks.filter((link) => link.quarantine_binding_status === "bound").length,
    matter_id_scoped_detection_count: detectionRecords.filter((record) => Boolean(record.matter_id)).length,
    knowledge_graph_bound_detection_count: detectionRecords.filter((record) => Boolean(record.evidence_node_id)).length,
    document_bound_detection_count: detectionRecords.filter((record) => Boolean(record.document_record_id)).length,
    attorney_review_required_detection_count: detectionRecords.filter((record) => record.attorney_review_required === true).length,
    attorney_review_required_policy_link_count: policyLinks.filter((link) => link.attorney_review_required === true).length,
    attorney_review_required_quarantine_link_count: quarantineLinks.filter((link) => link.attorney_review_required === true).length,
    human_review_required_detection_count: detectionRecords.filter((record) => record.human_review_required === true).length,
    human_review_required_policy_link_count: policyLinks.filter((link) => link.human_review_required === true).length,
    human_review_required_quarantine_link_count: quarantineLinks.filter((link) => link.human_review_required === true).length,
    quarantine_applied_count: quarantineLinks.filter((link) => link.quarantine_applied === true).length,
    legal_advice_provided: detectionRecords.some((record) => record.legal_advice_provided === true),
    client_facing_output_generated: detectionRecords.some((record) => record.client_facing_output_generated === true),
    policy_enforcement_mutation_performed: detectionRecords.some((record) => record.policy_enforcement_mutation_performed === true),
    quarantine_execution_performed: detectionRecords.some((record) => record.quarantine_execution_performed === true) || quarantineLinks.some((link) => link.quarantine_applied === true),
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
    quarantine_execution_allowed: desktopBoundary.quarantine_execution_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_personal_data_flag: countBy(detectionRecords, "personal_data_flag"),
    by_primary_personal_data_category: countBy(detectionRecords, "primary_personal_data_category"),
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    policy_enforcement_mutation_performed: false,
    quarantine_execution_performed: false,
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
    schema_version: "matter-personal-data-detector-desktop-boundary.v1",
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
    quarantine_execution_allowed: false,
    policy_enforcement_mutation_allowed: false,
    legal_advice_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    allowed_operations: [
      "read_candidate_personal_data_detections",
      "read_personal_data_policy_links",
      "read_personal_data_quarantine_links",
      "read_matter_personal_data_summaries",
      "read_boundary_status",
    ],
    blocked_operations: [
      "apply_quarantine",
      "release_quarantined_resource",
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
    { source_id: "matter_privilege_classifier", source_kind: "artifact", path: inputs.matter_privilege_classifier_path },
    { source_id: "data_classification_rule_engine", source_kind: "artifact", path: inputs.data_classification_rule_engine_path },
    { source_id: "resource_quarantine_model", source_kind: "artifact", path: inputs.resource_quarantine_model_path },
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
    matter_knowledge_graph_path: path.resolve(options.matterKnowledgeGraphPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.matterKnowledgeGraphPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.matterDocumentIndexPath),
    matter_privilege_classifier_path: path.resolve(options.matterPrivilegeClassifierPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.matterPrivilegeClassifierPath),
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.dataClassificationRuleEnginePath),
    resource_quarantine_model_path: path.resolve(options.resourceQuarantineModelPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.resourceQuarantineModelPath),
    matter_files: (options.matterFiles ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.matterFiles).map((matterPath) => path.resolve(matterPath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_PERSONAL_DATA_DETECTOR_INPUTS.roadmapPath),
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
    else if (arg === "--matter-privilege-classifier") parsed.matterPrivilegeClassifierPath = argv[++index];
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--resource-quarantine") parsed.resourceQuarantineModelPath = argv[++index];
    else if (arg === "--matter-file") {
      parsed.matterFiles = parsed.matterFiles ?? [];
      parsed.matterFiles.push(argv[++index]);
    } else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-personal-data-detector.mjs [options]

Options:
  --check                          Fail if validation does not pass
  --out-dir <path>                 Output directory
  --matter-knowledge-graph <path>  Matter Knowledge Graph artifact
  --matter-document-index <path>   Matter Document Index artifact
  --matter-privilege-classifier <p> Matter Privilege Classifier artifact
  --data-classification-rules <p>  Data Classification Rule Engine artifact
  --resource-quarantine <path>     Resource Quarantine Model artifact
  --matter-file <path>             Matter file; may be repeated
  --output-catalog <path>          Output catalog artifact
  --delivery-queue <path>          Protected delivery queue artifact
  --package <path>                 package.json path
  --roadmap <path>                 roadmap/ledger path
  --run-at <iso>                   Deterministic generated_at timestamp
`);
}

function renderMatterPersonalDataDetectorMarkdown(result) {
  const lines = [];
  lines.push("# Matter Personal Data Detector");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_personal_data_detector_status}`);
  lines.push(`Detections: ${result.summary.detection_record_count}`);
  lines.push(`Policy links: ${result.summary.policy_link_count}`);
  lines.push(`Quarantine links: ${result.summary.quarantine_link_count}`);
  lines.push(`Sensitive review required: ${result.summary.sensitive_personal_data_flagged_count}`);
  lines.push(`Quarantine applied: ${result.summary.quarantine_applied_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Matter | Evidence | Flag | Categories | Policy | Quarantine |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const record of result.personal_data_detection_records) {
    lines.push(`| ${record.matter_id} | ${record.evidence_label} | ${record.personal_data_flag} | ${record.detected_personal_data_categories.join(", ")} | ${record.policy_binding_status} | ${record.quarantine_binding_status} |`);
  }
  lines.push("");
  lines.push("Human review note: These are candidate personal data detections for attorney and human review. They link candidate rows to policy and quarantine controls, but do not apply quarantine, write matter data, provide legal advice, or generate client-facing output.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterPersonalDataDetector(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
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

function compareDetectionRecords(left, right) {
  return String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.evidence_label).localeCompare(String(right.evidence_label))
    || String(left.personal_data_detection_record_id).localeCompare(String(right.personal_data_detection_record_id));
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dedupeSignals(signals) {
  const seen = new Set();
  const deduped = [];
  for (const item of signals) {
    if (!item?.signal_type) continue;
    if (seen.has(item.signal_type)) continue;
    seen.add(item.signal_type);
    deduped.push(item);
  }
  return deduped.sort((left, right) => left.signal_type.localeCompare(right.signal_type));
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== undefined && value !== null && value !== ""))].sort();
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
