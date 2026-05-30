import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_EXTRACTOR_SELECTION_OUT_DIR = "artifacts/ldd-extractor-selection/latest";
export const DEFAULT_LDD_EXTRACTOR_SELECTION_INPUTS = {
  lddDocumentClassificationPath: "artifacts/ldd-document-classification/latest/ldd-document-classification.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-extractor-selection.v1";
const SOURCE_OF_TRUTH = "ldd_document_classification_and_extractor_adapter_contract";
const EXTRACTOR_PROFILES = [
  extractorProfile("contract", "Contract Terms Extractor", "extractor.law_firm.contract_terms.v1", "contract_terms", ["contract_term_table", "party_clause_marker", "risk_marker"], "extractor.docx_word_xml_probe.v1"),
  extractorProfile("registry", "Registry Filing Extractor", "extractor.law_firm.registry_filing.v1", "registry_filing", ["registry_number", "filing_date", "corporate_registry_marker"], "extractor.pdf_pdftotext_probe.v1"),
  extractorProfile("license_permit", "License Permit Extractor", "extractor.law_firm.license_permit.v1", "license_permit", ["license_number", "permit_scope", "regulatory_authority"], "extractor.pdf_pdftotext_probe.v1"),
  extractorProfile("litigation", "Litigation Pleading Extractor", "extractor.law_firm.litigation_pleading.v1", "litigation_pleading", ["court_name", "claim_marker", "case_number"], "extractor.pdf_pdftotext_probe.v1"),
  extractorProfile("labor_employment", "Labor Employment Extractor", "extractor.law_firm.labor_employment.v1", "labor_employment", ["employee_count_marker", "payroll_marker", "hr_policy_marker"], "extractor.xlsx_open_xml_probe.v1"),
  extractorProfile("tax", "Tax Diligence Extractor", "extractor.law_firm.tax_diligence.v1", "tax_diligence", ["tax_period", "related_party_marker", "withholding_marker"], "extractor.xlsx_open_xml_probe.v1"),
  extractorProfile("corporate_governance", "Corporate Governance Extractor", "extractor.law_firm.corporate_governance.v1", "corporate_governance", ["board_resolution_marker", "director_marker", "shareholder_marker"], "extractor.docx_word_xml_probe.v1"),
  extractorProfile("closing_deliverable", "Closing Deliverable Extractor", "extractor.law_firm.closing_deliverable.v1", "closing_deliverable", ["cp_marker", "certificate_marker", "disclosure_schedule_marker"], "extractor.docx_word_xml_probe.v1"),
  extractorProfile("other", "General Diligence Extractor", "extractor.law_firm.general_diligence.v1", "general_diligence", ["general_metadata", "manual_review_marker"], "extractor.plain_text_probe.v1", { fallback: true }),
];

export async function runLddExtractorSelection(options = {}) {
  const result = await buildLddExtractorSelection(options);
  if (options.write !== false) await writeLddExtractorSelection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD extractor selection validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddExtractorSelection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_EXTRACTOR_SELECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddDocumentClassification = sourceById.ldd_document_classification;
  const extractorAdapterContract = sourceById.extractor_adapter_contract;
  const extractorRegistry = buildExtractorRegistry(generatedAt, extractorAdapterContract);
  const selectionRecords = buildSelectionRecords(lddDocumentClassification, extractorRegistry, generatedAt);
  const selectionRationales = buildSelectionRationales(selectionRecords, lddDocumentClassification, generatedAt);
  const matterSummaries = buildMatterSummaries(selectionRecords, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddDocumentClassification,
    extractorAdapterContract,
    extractorRegistry,
    selectionRecords,
    selectionRationales,
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
  const summary = summarizeLddExtractorSelection({
    sourceReads,
    lddDocumentClassification,
    extractorAdapterContract,
    extractorRegistry,
    selectionRecords,
    selectionRationales,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_extractor_selection_id: `ldd-extractor-selection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_extractor_selection_status: summary.ldd_extractor_selection_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_extractor_selection_contract: buildContract(generatedAt),
    ldd_extractor_registry: extractorRegistry,
    ldd_extractor_selection_records: selectionRecords,
    ldd_extractor_selection_rationales: selectionRationales,
    ldd_extractor_matter_summaries: matterSummaries,
    ldd_extractor_selection_desktop_boundary: desktopBoundary,
    ldd_extractor_selection_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddExtractorSelectionMarkdown(result),
  };
}

export async function writeLddExtractorSelection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddExtractorSelection(result);
  await writeJson(path.join(outDir, "ldd-extractor-selection.json"), serializable);
  await writeJson(path.join(outDir, "ldd-extractor-registry.json"), {
    schema_version: "ldd-extractor-registry-artifact.v1",
    generated_at: result.generated_at,
    extractor_registry_count: result.ldd_extractor_registry.length,
    ldd_extractor_registry: result.ldd_extractor_registry,
  });
  await writeJson(path.join(outDir, "ldd-extractor-selection-records.json"), {
    schema_version: "ldd-extractor-selection-records.v1",
    generated_at: result.generated_at,
    selection_record_count: result.ldd_extractor_selection_records.length,
    ldd_extractor_selection_records: result.ldd_extractor_selection_records,
  });
  await writeJson(path.join(outDir, "ldd-extractor-selection-rationales.json"), {
    schema_version: "ldd-extractor-selection-rationales.v1",
    generated_at: result.generated_at,
    selection_rationale_count: result.ldd_extractor_selection_rationales.length,
    ldd_extractor_selection_rationales: result.ldd_extractor_selection_rationales,
  });
  await writeJson(path.join(outDir, "ldd-extractor-matter-summaries.json"), {
    schema_version: "ldd-extractor-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_extractor_matter_summaries.length,
    ldd_extractor_matter_summaries: result.ldd_extractor_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-extractor-selection-boundary.json"), {
    schema_version: "ldd-extractor-selection-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_extractor_selection_desktop_boundary: result.ldd_extractor_selection_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-extractor-selection-validation-report.v1",
    generated_at: result.generated_at,
    ldd_extractor_selection_id: result.ldd_extractor_selection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddExtractorSelectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddExtractorSelection(args);
    console.log(`LDD extractor selection ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_extractor_selection_status}`);
    console.log(`Records/extractors: ${result.summary.selection_record_count}/${result.summary.distinct_selected_extractor_count}`);
    console.log(`Extractor executions: ${result.summary.extractor_execution_count}`);
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
    schema_version: "ldd-extractor-selection-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    selection_rule: "LDD document classes are deterministically routed to extractor profiles using classification metadata and the local adapter contract only",
    execution_rule: "this phase selects extractor profiles and does not execute extractors or generate extracted legal work product",
    missing_data_rule: "missing/requested material rows receive extractor selection for follow-up planning only and are not treated as extracted facts",
    attorney_review_rule: "every extractor selection and rationale remains attorney/human-review gated before downstream legal or client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildExtractorRegistry(generatedAt, extractorAdapterContract) {
  const adapterIds = new Set((extractorAdapterContract?.extractor_adapter_catalog?.extractor_adapters ?? []).map((adapter) => adapter.extractor_id));
  return EXTRACTOR_PROFILES.map((profile, index) => ({
    schema_version: "ldd-extractor-registry-entry.v1",
    ldd_extractor_registry_entry_id: `ldd-extractor-registry.${profile.document_class}`,
    document_class: profile.document_class,
    selected_extractor_id: profile.selected_extractor_id,
    selected_extractor_name: profile.selected_extractor_name,
    extractor_kind: profile.extractor_kind,
    selection_priority: index + 1,
    expected_signal_fields: profile.expected_signal_fields,
    binding_adapter_contract_extractor_id: profile.binding_adapter_contract_extractor_id,
    adapter_contract_binding_available: adapterIds.has(profile.binding_adapter_contract_extractor_id),
    fallback_profile: profile.fallback,
    local_only: true,
    external_service_allowed: false,
    network_access_allowed: false,
    extractor_execution_performed: false,
    extraction_result_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildSelectionRecords(lddDocumentClassification, extractorRegistry, generatedAt) {
  const registryByClass = new Map(extractorRegistry.map((entry) => [entry.document_class, entry]));
  const fallback = registryByClass.get("other");
  return (lddDocumentClassification?.ldd_document_classification_records ?? []).map((record, index) => {
    const registryEntry = registryByClass.get(record.primary_document_class) ?? fallback;
    const rationaleId = `ldd-extractor-selection-rationale.${slug(record.source_document_id)}`;
    return {
      schema_version: "ldd-extractor-selection-record.v1",
      ldd_extractor_selection_record_id: `ldd-extractor-selection.${slug(record.source_document_id)}`,
      matter_id: record.matter_id,
      ldd_document_classification_record_id: record.ldd_document_classification_record_id,
      source_document_id: record.source_document_id,
      source_row_kind: record.source_row_kind,
      source_record_id: record.source_record_id,
      source_collection: record.source_collection,
      document_title: record.document_title,
      document_type: record.document_type,
      document_status: record.document_status,
      missing_data_status: record.missing_data_status ?? null,
      primary_document_class: record.primary_document_class,
      classification_status: record.classification_status,
      classification_confidence: record.classification_confidence,
      classification_rule_ids: record.classification_rule_ids ?? [],
      matched_keywords: record.matched_keywords ?? [],
      selected_extractor_id: registryEntry.selected_extractor_id,
      selected_extractor_name: registryEntry.selected_extractor_name,
      extractor_kind: registryEntry.extractor_kind,
      binding_adapter_contract_extractor_id: registryEntry.binding_adapter_contract_extractor_id,
      adapter_contract_binding_available: registryEntry.adapter_contract_binding_available,
      selection_status: "selected_pending_attorney_review",
      selection_basis: record.source_row_kind === "missing_data" ? "classification_rule_and_missing_material_request" : "classification_rule_and_vdr_file_metadata",
      selection_rationale_id: rationaleId,
      supported_by_classification_rule_ids: record.classification_rule_ids ?? [],
      fallback_selection: registryEntry.fallback_profile === true,
      extractor_execution_performed: false,
      extraction_result_generated: false,
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

function buildSelectionRationales(selectionRecords, lddDocumentClassification, generatedAt) {
  const classificationById = new Map((lddDocumentClassification?.ldd_document_classification_records ?? []).map((record) => [record.ldd_document_classification_record_id, record]));
  return selectionRecords.map((selection, index) => {
    const classification = classificationById.get(selection.ldd_document_classification_record_id);
    return {
      schema_version: "ldd-extractor-selection-rationale.v1",
      ldd_extractor_selection_rationale_id: selection.selection_rationale_id,
      ldd_extractor_selection_record_id: selection.ldd_extractor_selection_record_id,
      ldd_document_classification_record_id: selection.ldd_document_classification_record_id,
      matter_id: selection.matter_id,
      source_document_id: selection.source_document_id,
      primary_document_class: selection.primary_document_class,
      selected_extractor_id: selection.selected_extractor_id,
      rationale_status: "document_class_rule_match",
      rationale_basis: selection.selection_basis,
      evidence_summary: {
        document_title: selection.document_title,
        source_row_kind: selection.source_row_kind,
        classification_confidence: classification?.classification_confidence ?? selection.classification_confidence,
        classification_basis: classification?.classification_basis ?? null,
        matched_keywords: classification?.matched_keywords ?? selection.matched_keywords,
        classification_rule_ids: classification?.classification_rule_ids ?? selection.classification_rule_ids,
      },
      attorney_review_note: "Extractor selection is operational routing metadata only and needs attorney/human review before downstream legal or client-facing use.",
      extractor_execution_performed: false,
      extraction_result_generated: false,
      attorney_review_required: true,
      human_review_required: true,
      created_at: generatedAt,
      sequence_number: index + 1,
    };
  });
}

function buildMatterSummaries(selectionRecords, generatedAt) {
  const matterIds = [...new Set(selectionRecords.map((record) => record.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterRecords = selectionRecords.filter((record) => record.matter_id === matterId);
    const extractorCounts = {};
    const classCounts = {};
    for (const record of matterRecords) {
      extractorCounts[record.selected_extractor_id] = (extractorCounts[record.selected_extractor_id] ?? 0) + 1;
      classCounts[record.primary_document_class] = (classCounts[record.primary_document_class] ?? 0) + 1;
    }
    return {
      schema_version: "ldd-extractor-matter-summary.v1",
      ldd_extractor_matter_summary_id: `ldd-extractor-matter-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_extractor_matter_status: "selected_pending_attorney_review",
      selection_record_count: matterRecords.length,
      distinct_selected_extractor_count: Object.keys(extractorCounts).length,
      distinct_document_class_count: Object.keys(classCounts).length,
      extractor_counts: extractorCounts,
      document_class_counts: classCounts,
      extractor_execution_count: matterRecords.filter((record) => record.extractor_execution_performed).length,
      extraction_result_generated_count: matterRecords.filter((record) => record.extraction_result_generated).length,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, lddDocumentClassification, extractorAdapterContract, extractorRegistry, selectionRecords, selectionRationales, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  const classificationRecordCount = lddDocumentClassification?.ldd_document_classification_records?.length ?? 0;
  const adapterSummary = extractorAdapterContract?.summary ?? {};
  const selectedExtractorIds = new Set(selectionRecords.map((record) => record.selected_extractor_id));
  const registryExtractorIds = new Set(extractorRegistry.map((entry) => entry.selected_extractor_id));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:extractor-selection"]), "package.json exposes law-firm:extractor-selection."),
    checkpoint("roadmap.p242", String(roadmapText ?? "").includes("P242"), "roadmap/ledger keeps P242 visible."),
    checkpoint("source.classification.complete", lddDocumentClassification?.summary?.ldd_document_classification_status === "complete", "Source LDD document classification is complete."),
    checkpoint("source.extractor_adapter_contract.complete", adapterSummary.extractor_adapter_contract_status === "complete", "Extractor adapter contract source is complete."),
    checkpoint("registry.count", extractorRegistry.length >= 9, `${extractorRegistry.length} extractor registry entry row(s) loaded.`),
    checkpoint("registry.local_only", extractorRegistry.every((entry) => entry.local_only && !entry.external_service_allowed && !entry.network_access_allowed), "Extractor registry remains local-only."),
    checkpoint("selection.coverage", selectionRecords.length === classificationRecordCount && selectionRecords.length > 0, `${selectionRecords.length}/${classificationRecordCount} classification record(s) received extractor selection.`),
    checkpoint("selection.registry_binding", [...selectedExtractorIds].every((extractorId) => registryExtractorIds.has(extractorId)), "Every selected extractor is present in the P242 registry."),
    checkpoint("rationale.coverage", selectionRationales.length === selectionRecords.length && selectionRationales.length > 0, `${selectionRationales.length}/${selectionRecords.length} selection rationale row(s) built.`),
    checkpoint("matter.summary.count", matterSummaries.length > 0, `${matterSummaries.length} matter summary row(s) built.`),
    checkpoint("matter.boundary", everyMatterScoped([...selectionRecords, ...selectionRationales, ...matterSummaries]), "Every extractor selection row is matter_id scoped."),
    checkpoint("review.gate", selectionRecords.every((record) => record.attorney_review_required === true && record.human_review_required === true), "Every extractor selection row remains attorney/human-review gated."),
    checkpoint("no.execution", selectionRecords.every((record) => record.extractor_execution_performed === false && record.extraction_result_generated === false), "No extractor execution or extracted result is generated."),
    checkpoint("no.client.output", selectionRecords.every((record) => record.client_facing_ready === false && record.client_facing_output_generated === false), "No client-facing extractor output is generated."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddExtractorSelection({ sourceReads, lddDocumentClassification, extractorAdapterContract, extractorRegistry, selectionRecords, selectionRationales, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  const selectedExtractorIds = [...new Set(selectionRecords.map((record) => record.selected_extractor_id))];
  return {
    ldd_extractor_selection_status: validation.valid ? "complete" : "blocked",
    ldd_extractor_selection_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_document_classification_status: sourceStatus("ldd_document_classification"),
    source_ldd_document_classification_phase_status: lddDocumentClassification?.summary?.ldd_document_classification_status ?? "unknown",
    source_extractor_adapter_contract_status: sourceStatus("extractor_adapter_contract"),
    source_extractor_adapter_contract_phase_status: extractorAdapterContract?.summary?.extractor_adapter_contract_status ?? "unknown",
    source_extractor_adapter_count: extractorAdapterContract?.summary?.extractor_adapter_count ?? 0,
    classification_record_count: lddDocumentClassification?.summary?.classification_record_count ?? lddDocumentClassification?.ldd_document_classification_records?.length ?? 0,
    extractor_registry_count: extractorRegistry.length,
    extractor_registry_local_only_count: extractorRegistry.filter((entry) => entry.local_only && !entry.external_service_allowed).length,
    selection_record_count: selectionRecords.length,
    selected_extractor_count: selectionRecords.filter((record) => record.selection_status === "selected_pending_attorney_review").length,
    distinct_selected_extractor_count: selectedExtractorIds.length,
    selection_rationale_count: selectionRationales.length,
    matter_count: matterSummaries.length,
    contract_extractor_selection_count: selectionRecords.filter((record) => record.primary_document_class === "contract").length,
    tax_extractor_selection_count: selectionRecords.filter((record) => record.primary_document_class === "tax").length,
    closing_deliverable_extractor_selection_count: selectionRecords.filter((record) => record.primary_document_class === "closing_deliverable").length,
    missing_data_extractor_selection_count: selectionRecords.filter((record) => record.source_row_kind === "missing_data").length,
    fallback_selection_count: selectionRecords.filter((record) => record.fallback_selection).length,
    adapter_contract_binding_available_count: selectionRecords.filter((record) => record.adapter_contract_binding_available).length,
    extractor_execution_count: selectionRecords.filter((record) => record.extractor_execution_performed).length,
    extraction_result_generated_count: selectionRecords.filter((record) => record.extraction_result_generated).length,
    attorney_review_required_selection_count: selectionRecords.filter((record) => record.attorney_review_required).length,
    human_review_required_selection_count: selectionRecords.filter((record) => record.human_review_required).length,
    client_facing_ready_count: selectionRecords.filter((record) => record.client_facing_ready).length,
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
    extractor_execution_performed: false,
    extraction_result_generated: false,
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
    schema_version: "ldd-extractor-selection-desktop-boundary.v1",
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
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:extractor-selection"]),
    roadmap_p242_present: String(roadmapText.value ?? "").includes("P242"),
  };
}

function renderLddExtractorSelectionMarkdown(result) {
  const lines = [
    "# LDD Extractor Selection",
    "",
    `- Status: ${result.summary.ldd_extractor_selection_status}`,
    `- Classification records: ${result.summary.classification_record_count}`,
    `- Selection records: ${result.summary.selection_record_count}`,
    `- Distinct selected extractors: ${result.summary.distinct_selected_extractor_count}`,
    `- Extractor executions: ${result.summary.extractor_execution_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing output generated: ${result.safe_handling.client_facing_output_generated}`,
    "",
    "## Selected Extractors",
    "",
  ];
  for (const summary of result.ldd_extractor_matter_summaries) {
    for (const [extractorId, count] of Object.entries(summary.extractor_counts)) {
      lines.push(`- ${summary.matter_id}: ${extractorId} (${count} selection record(s)).`);
    }
  }
  lines.push("", "These selections are deterministic routing metadata only. No extractor execution or client-facing output is produced in this phase.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_EXTRACTOR_SELECTION_INPUTS;
  return {
    ldd_document_classification_path: path.resolve(options.lddDocumentClassificationPath ?? defaults.lddDocumentClassificationPath),
    extractor_adapter_contract_path: path.resolve(options.extractorAdapterContractPath ?? defaults.extractorAdapterContractPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_document_classification", "artifact", inputs.ldd_document_classification_path],
    ["extractor_adapter_contract", "artifact", inputs.extractor_adapter_contract_path],
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

function extractorProfile(documentClass, selectedExtractorName, selectedExtractorId, extractorKind, expectedSignalFields, bindingAdapterContractExtractorId, options = {}) {
  return {
    document_class: documentClass,
    selected_extractor_name: selectedExtractorName,
    selected_extractor_id: selectedExtractorId,
    extractor_kind: extractorKind,
    expected_signal_fields: expectedSignalFields,
    binding_adapter_contract_extractor_id: bindingAdapterContractExtractorId,
    fallback: Boolean(options.fallback),
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function everyMatterScoped(rows) {
  return rows.every((row) => typeof row.matter_id === "string" && row.matter_id.length > 0);
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
    items: validationItems,
  };
}

function serializableLddExtractorSelection(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--ldd-document-classification") parsed.lddDocumentClassificationPath = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-extractor-selection.mjs [options]

Options:
  --out-dir <folder>                         Output directory.
  --ldd-document-classification <file>       LDD document classification artifact.
  --extractor-adapter-contract <file>        Extractor adapter contract artifact.
  --package <file>                           package.json path.
  --roadmap <file>                           Roadmap or phase ledger path.
  --run-at <iso>                             Deterministic generated_at timestamp.
  --check                                    Exit non-zero when validation fails.
  -h, --help                                 Show this help.
`);
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}
