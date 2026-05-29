import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_FACT_EXTRACTION_OUT_DIR = "artifacts/ldd-fact-extraction/latest";
export const DEFAULT_LDD_FACT_EXTRACTION_INPUTS = {
  lddExtractorSelectionPath: "artifacts/ldd-extractor-selection/latest/ldd-extractor-selection.json",
  matterPath: "examples/project-alpha-matter.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-fact-extraction.v1";
const SOURCE_OF_TRUTH = "ldd_extractor_selection_and_demo_matter_metadata";
const FACT_RULES = [
  factRule("party", "Party facts", "client, counsel role, and named actor facts from matter metadata"),
  factRule("date", "Date facts", "signing, closing, due date, and fiscal period facts from matter metadata and source titles"),
  factRule("obligation", "Obligation facts", "task, VDR request, CP checklist, and document follow-up obligations"),
  factRule("termination", "Termination facts", "termination term extraction or source-gap review marker for contract documents"),
  factRule("change_of_control", "Change-of-control facts", "transaction structure candidates from matter title and deal metadata"),
];

export async function runLddFactExtraction(options = {}) {
  const result = await buildLddFactExtraction(options);
  if (options.write !== false) await writeLddFactExtraction(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD fact extraction validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddFactExtraction(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_FACT_EXTRACTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddExtractorSelection = sourceById.ldd_extractor_selection;
  const matter = sourceById.matter;
  const rules = buildFactRules(generatedAt);
  const factRecords = buildFactRecords(lddExtractorSelection, matter, generatedAt);
  const sourceBindings = buildSourceBindings(factRecords, generatedAt);
  const typeSummaries = buildTypeSummaries(factRecords, rules, generatedAt);
  const matterSummaries = buildMatterSummaries(factRecords, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddExtractorSelection,
    matter,
    rules,
    factRecords,
    sourceBindings,
    typeSummaries,
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
  const summary = summarizeLddFactExtraction({
    sourceReads,
    lddExtractorSelection,
    matter,
    rules,
    factRecords,
    sourceBindings,
    typeSummaries,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_fact_extraction_id: `ldd-fact-extraction.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_fact_extraction_status: summary.ldd_fact_extraction_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_fact_extraction_contract: buildContract(generatedAt),
    ldd_fact_extraction_rules: rules,
    ldd_fact_records: factRecords,
    ldd_fact_source_bindings: sourceBindings,
    ldd_fact_type_summaries: typeSummaries,
    ldd_fact_matter_summaries: matterSummaries,
    ldd_fact_extraction_desktop_boundary: desktopBoundary,
    ldd_fact_extraction_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddFactExtractionMarkdown(result),
  };
}

export async function writeLddFactExtraction(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddFactExtraction(result);
  await writeJson(path.join(outDir, "ldd-fact-extraction.json"), serializable);
  await writeJson(path.join(outDir, "ldd-fact-extraction-rules.json"), {
    schema_version: "ldd-fact-extraction-rules.v1",
    generated_at: result.generated_at,
    fact_rule_count: result.ldd_fact_extraction_rules.length,
    ldd_fact_extraction_rules: result.ldd_fact_extraction_rules,
  });
  await writeJson(path.join(outDir, "ldd-fact-records.json"), {
    schema_version: "ldd-fact-records.v1",
    generated_at: result.generated_at,
    fact_record_count: result.ldd_fact_records.length,
    ldd_fact_records: result.ldd_fact_records,
  });
  await writeJson(path.join(outDir, "ldd-fact-source-bindings.json"), {
    schema_version: "ldd-fact-source-bindings.v1",
    generated_at: result.generated_at,
    source_binding_count: result.ldd_fact_source_bindings.length,
    ldd_fact_source_bindings: result.ldd_fact_source_bindings,
  });
  await writeJson(path.join(outDir, "ldd-fact-type-summaries.json"), {
    schema_version: "ldd-fact-type-summaries.v1",
    generated_at: result.generated_at,
    type_summary_count: result.ldd_fact_type_summaries.length,
    ldd_fact_type_summaries: result.ldd_fact_type_summaries,
  });
  await writeJson(path.join(outDir, "ldd-fact-matter-summaries.json"), {
    schema_version: "ldd-fact-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_fact_matter_summaries.length,
    ldd_fact_matter_summaries: result.ldd_fact_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-fact-extraction-boundary.json"), {
    schema_version: "ldd-fact-extraction-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_fact_extraction_desktop_boundary: result.ldd_fact_extraction_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-fact-extraction-validation-report.v1",
    generated_at: result.generated_at,
    ldd_fact_extraction_id: result.ldd_fact_extraction_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddFactExtractionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddFactExtraction(args);
    console.log(`LDD fact extraction ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_fact_extraction_status}`);
    console.log(`Facts/types: ${result.summary.fact_record_count}/${result.summary.fact_type_count}`);
    console.log(`Source gaps: ${result.summary.source_gap_fact_count}`);
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
    schema_version: "ldd-fact-extraction-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    extraction_rule: "LDD facts are deterministic candidate facts or source-gap rows generated from P242 extractor selections and demo matter metadata",
    no_legal_conclusion_rule: "candidate facts, termination gaps, and change-of-control markers are not legal conclusions and require attorney/human review",
    missing_data_rule: "missing/requested documents can produce follow-up fact candidates or source gaps but not factual non-existence findings",
    external_extractor_rule: "no external extractor, model, network, or client-facing generation is performed by this phase",
    attorney_review_rule: "every fact record and source binding remains attorney/human-review gated before downstream legal or client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildFactRules(generatedAt) {
  return FACT_RULES.map((rule, index) => ({
    schema_version: "ldd-fact-extraction-rule.v1",
    ldd_fact_extraction_rule_id: `ldd-fact-extraction-rule.${rule.fact_type}`,
    fact_type: rule.fact_type,
    fact_label: rule.fact_label,
    rule_description: rule.rule_description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    external_extractor_execution_performed: false,
    legal_conclusion_allowed: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildFactRecords(lddExtractorSelection, matter, generatedAt) {
  const records = [];
  const selections = lddExtractorSelection?.ldd_extractor_selection_records ?? [];
  const pushFact = (selection, fact) => {
    records.push(buildFactRecord(selection, fact, generatedAt, records.length + 1));
  };

  for (const selection of selections) {
    if (selection.primary_document_class === "contract") {
      pushFact(selection, partyFact("client_name", matter.client, sourceRef("matter", matter.matter_id, "client"), "metadata_exact", "matter.client"));
      pushFact(selection, partyFact("counsel_role", matter.deal_control?.role, sourceRef("matter.deal_control", matter.matter_id, "deal_control.role"), "metadata_exact", "deal_control.role"));
      pushFact(selection, dateFact("signing_target", matter.deal_control?.signing_target, sourceRef("matter.deal_control", matter.matter_id, "deal_control.signing_target"), "metadata_exact", "deal_control.signing_target"));
      pushFact(selection, dateFact("closing_target", matter.deal_control?.closing_target, sourceRef("matter.deal_control", matter.matter_id, "deal_control.closing_target"), "metadata_exact", "deal_control.closing_target"));
      const spaTask = findByText(matter.tasks, ["spa", "8.2"]) ?? findByText(matter.tasks, ["spa"]);
      pushFact(selection, obligationFact("spa_fallback_language_update", spaTask?.title ?? "Update SPA fallback language", sourceRef("matter.tasks", spaTask?.id ?? "T-001", "tasks.title"), "metadata_exact", spaTask?.id ?? "T-001"));
      pushFact(selection, changeOfControlFact("transaction_structure", matter.title, sourceRef("matter", matter.matter_id, "title"), "metadata_inferred", "matter title contains Share Purchase"));
      pushFact(selection, sourceGapFact("termination", "termination_terms", "No termination clause source text is present in the P243 deterministic source set; attorney source review is required.", sourceRef("ldd_extractor_selection", selection.ldd_extractor_selection_record_id, "document_title")));
    } else if (selection.primary_document_class === "tax") {
      const vdrRequest = findRequestForSelection(selection, matter);
      const cp = findByText(matter.deal_control?.cp_checklist, ["tax"]);
      const task = findByText(matter.tasks, ["tax"]) ?? findByText(matter.tasks, ["related-party"]);
      const fiscalPeriod = extractFiscalPeriod(selection.document_title);
      if (fiscalPeriod) {
        pushFact(selection, dateFact("fiscal_period", fiscalPeriod, sourceRef(selection.source_collection, selection.source_record_id, "document_title"), "metadata_exact", "document title fiscal year range"));
      }
      pushFact(selection, obligationFact(
        selection.source_record_id === "DOC-003" ? "tax_team_signoff" : "related_party_ledger_delivery",
        selection.source_record_id === "DOC-003" ? (cp?.title ?? task?.title ?? selection.document_title) : (vdrRequest?.title ?? selection.document_title),
        sourceRef(selection.source_record_id === "DOC-003" ? "matter.deal_control.cp_checklist" : selection.source_collection, selection.source_record_id === "DOC-003" ? (cp?.id ?? "CP-002") : (vdrRequest?.id ?? selection.source_record_id), selection.source_record_id === "DOC-003" ? "cp_checklist.title" : "vdr_requests.title"),
        "metadata_exact",
        selection.source_record_id === "DOC-003" ? (cp?.id ?? task?.id ?? selection.source_record_id) : (vdrRequest?.id ?? selection.source_record_id),
      ));
      const due = selection.source_record_id === "DOC-003" ? (cp?.due ?? task?.due) : vdrRequest?.due;
      if (due) pushFact(selection, dateFact("follow_up_due_date", due, sourceRef(selection.source_record_id === "DOC-003" ? "matter.deal_control.cp_checklist" : selection.source_collection, selection.source_record_id === "DOC-003" ? (cp?.id ?? "CP-002") : (vdrRequest?.id ?? selection.source_record_id), "due"), "metadata_exact", "source due date"));
    } else if (selection.primary_document_class === "closing_deliverable") {
      const vdrRequest = findRequestForSelection(selection, matter);
      const cp = findCpForSelection(selection, matter);
      const task = findByText(matter.tasks, [selection.document_title]) ?? findByText(matter.tasks, ["closing"]);
      pushFact(selection, obligationFact(
        selection.source_record_id === "DOC-002" ? "disclosure_schedule_update" : "closing_deliverable_delivery",
        cp?.title ?? vdrRequest?.title ?? task?.title ?? selection.document_title,
        sourceRef(cp ? "matter.deal_control.cp_checklist" : vdrRequest ? selection.source_collection : "matter.tasks", cp?.id ?? vdrRequest?.id ?? task?.id ?? selection.source_record_id, cp ? "cp_checklist.title" : vdrRequest ? "vdr_requests.title" : "tasks.title"),
        "metadata_exact",
        cp?.id ?? vdrRequest?.id ?? task?.id ?? selection.source_record_id,
      ));
      const due = cp?.due ?? vdrRequest?.due ?? task?.due;
      if (due) {
        pushFact(selection, dateFact("closing_deliverable_due_date", due, sourceRef(cp ? "matter.deal_control.cp_checklist" : vdrRequest ? selection.source_collection : "matter.tasks", cp?.id ?? vdrRequest?.id ?? task?.id ?? selection.source_record_id, "due"), "metadata_exact", "source due date"));
      }
    } else {
      pushFact(selection, sourceGapFact("obligation", "general_diligence_follow_up", "No deterministic fact rule matched this document class; attorney source review is required.", sourceRef("ldd_extractor_selection", selection.ldd_extractor_selection_record_id, "primary_document_class")));
    }
  }

  return records;
}

function buildFactRecord(selection, fact, generatedAt, sequenceNumber) {
  const status = fact.source_gap ? "source_gap_review_required" : "candidate_extracted_pending_attorney_review";
  return {
    schema_version: "ldd-fact-record.v1",
    ldd_fact_record_id: `ldd-fact.${String(sequenceNumber).padStart(3, "0")}.${slug(selection.source_document_id)}.${slug(fact.fact_name)}`,
    matter_id: selection.matter_id,
    ldd_extractor_selection_record_id: selection.ldd_extractor_selection_record_id,
    source_document_id: selection.source_document_id,
    source_row_kind: selection.source_row_kind,
    source_record_id: selection.source_record_id,
    source_collection: selection.source_collection,
    document_title: selection.document_title,
    primary_document_class: selection.primary_document_class,
    selected_extractor_id: selection.selected_extractor_id,
    selected_extractor_name: selection.selected_extractor_name,
    extractor_kind: selection.extractor_kind,
    fact_type: fact.fact_type,
    fact_name: fact.fact_name,
    fact_value: fact.fact_value,
    fact_status: status,
    fact_confidence: fact.fact_confidence,
    extraction_basis: fact.extraction_basis,
    source_ref: fact.source_ref,
    source_gap: fact.source_gap,
    source_gap_reason: fact.source_gap ? fact.fact_value : null,
    deterministic_fact_extraction_performed: true,
    external_extractor_execution_performed: false,
    legal_conclusion_asserted: false,
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
    sequence_number: sequenceNumber,
  };
}

function buildSourceBindings(factRecords, generatedAt) {
  return factRecords.map((fact, index) => ({
    schema_version: "ldd-fact-source-binding.v1",
    ldd_fact_source_binding_id: `ldd-fact-source-binding.${String(index + 1).padStart(3, "0")}.${slug(fact.ldd_fact_record_id)}`,
    matter_id: fact.matter_id,
    ldd_fact_record_id: fact.ldd_fact_record_id,
    ldd_extractor_selection_record_id: fact.ldd_extractor_selection_record_id,
    source_document_id: fact.source_document_id,
    source_ref: fact.source_ref,
    binding_status: fact.source_gap ? "source_gap_recorded" : "bound_to_source_metadata",
    source_gap: fact.source_gap,
    deterministic_fact_extraction_performed: true,
    external_extractor_execution_performed: false,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    created_at: generatedAt,
  }));
}

function buildTypeSummaries(factRecords, rules, generatedAt) {
  return rules.map((rule) => {
    const typeRecords = factRecords.filter((record) => record.fact_type === rule.fact_type);
    return {
      schema_version: "ldd-fact-type-summary.v1",
      ldd_fact_type_summary_id: `ldd-fact-type-summary.${rule.fact_type}`,
      fact_type: rule.fact_type,
      fact_label: rule.fact_label,
      fact_record_count: typeRecords.length,
      candidate_fact_count: typeRecords.filter((record) => !record.source_gap).length,
      source_gap_fact_count: typeRecords.filter((record) => record.source_gap).length,
      attorney_review_required_count: typeRecords.filter((record) => record.attorney_review_required).length,
      human_review_required_count: typeRecords.filter((record) => record.human_review_required).length,
      client_facing_ready_count: typeRecords.filter((record) => record.client_facing_ready).length,
      created_at: generatedAt,
    };
  });
}

function buildMatterSummaries(factRecords, generatedAt) {
  const matterIds = [...new Set(factRecords.map((record) => record.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterRecords = factRecords.filter((record) => record.matter_id === matterId);
    const factTypeCounts = {};
    for (const record of matterRecords) factTypeCounts[record.fact_type] = (factTypeCounts[record.fact_type] ?? 0) + 1;
    return {
      schema_version: "ldd-fact-matter-summary.v1",
      ldd_fact_matter_summary_id: `ldd-fact-matter-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_fact_matter_status: "complete_pending_attorney_review",
      fact_record_count: matterRecords.length,
      candidate_fact_count: matterRecords.filter((record) => !record.source_gap).length,
      source_gap_fact_count: matterRecords.filter((record) => record.source_gap).length,
      distinct_fact_type_count: Object.keys(factTypeCounts).length,
      fact_type_counts: factTypeCounts,
      deterministic_fact_extraction_count: matterRecords.filter((record) => record.deterministic_fact_extraction_performed).length,
      external_extractor_execution_count: matterRecords.filter((record) => record.external_extractor_execution_performed).length,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, lddExtractorSelection, matter, rules, factRecords, sourceBindings, typeSummaries, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  const selectionRecordCount = lddExtractorSelection?.ldd_extractor_selection_records?.length ?? 0;
  const factTypes = new Set(factRecords.map((record) => record.fact_type));
  const requiredTypes = ["party", "date", "obligation", "termination", "change_of_control"];
  const selectionIdsWithFacts = new Set(factRecords.map((record) => record.ldd_extractor_selection_record_id));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:fact-extraction"]), "package.json exposes law-firm:fact-extraction."),
    checkpoint("roadmap.p243", String(roadmapText ?? "").includes("P243"), "roadmap/ledger keeps P243 visible."),
    checkpoint("source.selection.complete", lddExtractorSelection?.summary?.ldd_extractor_selection_status === "complete", "Source LDD extractor selection is complete."),
    checkpoint("source.matter.scoped", Boolean(matter?.matter_id), "Demo matter source has matter_id."),
    checkpoint("rule.count", rules.length >= requiredTypes.length, `${rules.length} fact extraction rule(s) loaded.`),
    checkpoint("selection.coverage", selectionRecordCount > 0 && selectionIdsWithFacts.size === selectionRecordCount, `${selectionIdsWithFacts.size}/${selectionRecordCount} selected document(s) have fact or source-gap records.`),
    checkpoint("fact.count", factRecords.length >= selectionRecordCount && factRecords.length > 0, `${factRecords.length} fact record(s) generated from ${selectionRecordCount} selection row(s).`),
    checkpoint("required.fact.types", requiredTypes.every((type) => factTypes.has(type)), `Required fact types present: ${[...factTypes].sort().join(", ")}.`),
    checkpoint("source.binding.coverage", sourceBindings.length === factRecords.length && sourceBindings.length > 0, `${sourceBindings.length}/${factRecords.length} fact source binding row(s) built.`),
    checkpoint("type.summary.count", typeSummaries.length >= requiredTypes.length, `${typeSummaries.length} fact type summary row(s) built.`),
    checkpoint("matter.summary.count", matterSummaries.length > 0, `${matterSummaries.length} matter summary row(s) built.`),
    checkpoint("matter.boundary", everyMatterScoped([...factRecords, ...sourceBindings, ...matterSummaries]), "Every fact extraction row is matter_id scoped."),
    checkpoint("review.gate", factRecords.every((record) => record.attorney_review_required === true && record.human_review_required === true), "Every fact record remains attorney/human-review gated."),
    checkpoint("source.gap.review", factRecords.filter((record) => record.source_gap).every((record) => record.fact_status === "source_gap_review_required" && record.legal_conclusion_asserted === false), "Source gaps are review-required and do not assert legal conclusions."),
    checkpoint("no.external.extractor", factRecords.every((record) => record.external_extractor_execution_performed === false), "No external extractor execution is recorded."),
    checkpoint("no.client.output", factRecords.every((record) => record.client_facing_ready === false && record.client_facing_output_generated === false), "No client-facing fact output is generated."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddFactExtraction({ sourceReads, lddExtractorSelection, matter, rules, factRecords, sourceBindings, typeSummaries, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  const countType = (factType) => factRecords.filter((record) => record.fact_type === factType).length;
  return {
    ldd_fact_extraction_status: validation.valid ? "complete" : "blocked",
    ldd_fact_extraction_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_extractor_selection_status: sourceStatus("ldd_extractor_selection"),
    source_ldd_extractor_selection_phase_status: lddExtractorSelection?.summary?.ldd_extractor_selection_status ?? "unknown",
    source_matter_status: sourceStatus("matter"),
    source_matter_id: matter?.matter_id ?? null,
    source_selection_record_count: lddExtractorSelection?.summary?.selection_record_count ?? lddExtractorSelection?.ldd_extractor_selection_records?.length ?? 0,
    fact_rule_count: rules.length,
    fact_type_count: typeSummaries.filter((summary) => summary.fact_record_count > 0).length,
    fact_record_count: factRecords.length,
    candidate_fact_count: factRecords.filter((record) => !record.source_gap).length,
    source_gap_fact_count: factRecords.filter((record) => record.source_gap).length,
    source_binding_count: sourceBindings.length,
    bound_source_metadata_count: sourceBindings.filter((binding) => binding.binding_status === "bound_to_source_metadata").length,
    source_gap_binding_count: sourceBindings.filter((binding) => binding.binding_status === "source_gap_recorded").length,
    type_summary_count: typeSummaries.length,
    matter_count: matterSummaries.length,
    selected_document_with_fact_count: new Set(factRecords.map((record) => record.ldd_extractor_selection_record_id)).size,
    party_fact_count: countType("party"),
    date_fact_count: countType("date"),
    obligation_fact_count: countType("obligation"),
    termination_fact_count: countType("termination"),
    change_of_control_fact_count: countType("change_of_control"),
    missing_data_fact_count: factRecords.filter((record) => record.source_row_kind === "missing_data").length,
    deterministic_fact_extraction_count: factRecords.filter((record) => record.deterministic_fact_extraction_performed).length,
    external_extractor_execution_count: factRecords.filter((record) => record.external_extractor_execution_performed).length,
    attorney_review_required_fact_count: factRecords.filter((record) => record.attorney_review_required).length,
    human_review_required_fact_count: factRecords.filter((record) => record.human_review_required).length,
    client_facing_ready_count: factRecords.filter((record) => record.client_facing_ready).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    legal_conclusion_asserted_count: factRecords.filter((record) => record.legal_conclusion_asserted).length,
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
    deterministic_fact_extraction_performed: true,
    external_extractor_execution_performed: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    legal_conclusion_asserted: false,
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
    schema_version: "ldd-fact-extraction-desktop-boundary.v1",
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
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:fact-extraction"]),
    roadmap_p243_present: String(roadmapText.value ?? "").includes("P243"),
  };
}

function renderLddFactExtractionMarkdown(result) {
  const lines = [
    "# LDD Fact Extraction",
    "",
    `- Status: ${result.summary.ldd_fact_extraction_status}`,
    `- Fact records: ${result.summary.fact_record_count}`,
    `- Candidate facts: ${result.summary.candidate_fact_count}`,
    `- Source gaps: ${result.summary.source_gap_fact_count}`,
    `- Fact types: ${result.summary.fact_type_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing output generated: ${result.safe_handling.client_facing_output_generated}`,
    "",
    "## Fact Types",
    "",
  ];
  for (const summary of result.ldd_fact_type_summaries) {
    lines.push(`- ${summary.fact_type}: ${summary.fact_record_count} record(s), ${summary.source_gap_fact_count} source gap(s).`);
  }
  lines.push("", "These rows are deterministic candidate facts and source-gap markers only. Attorney review remains required before downstream legal or client-facing use.");
  return `${lines.join("\n")}\n`;
}

function partyFact(factName, factValue, source, confidence, basis) {
  return fact("party", factName, factValue, source, confidence, basis);
}

function dateFact(factName, factValue, source, confidence, basis) {
  return fact("date", factName, factValue, source, confidence, basis);
}

function obligationFact(factName, factValue, source, confidence, basis) {
  return fact("obligation", factName, factValue, source, confidence, basis);
}

function changeOfControlFact(factName, factValue, source, confidence, basis) {
  return fact("change_of_control", factName, factValue, source, confidence, basis);
}

function sourceGapFact(factType, factName, gapReason, source) {
  return fact(factType, factName, gapReason, source, "source_gap", "source_gap_review_required", true);
}

function fact(factType, factName, factValue, source, confidence, basis, sourceGap = false) {
  return {
    fact_type: factType,
    fact_name: factName,
    fact_value: String(factValue ?? "source review required"),
    fact_confidence: confidence,
    extraction_basis: basis,
    source_ref: source,
    source_gap: sourceGap,
  };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return {
    source_kind: String(sourceKind ?? "unknown"),
    source_id: String(sourceId ?? "unknown"),
    source_field: String(sourceField ?? "unknown"),
  };
}

function factRule(factType, factLabel, ruleDescription) {
  return { fact_type: factType, fact_label: factLabel, rule_description: ruleDescription };
}

function findRequestForSelection(selection, matter) {
  return (matter.deal_control?.vdr_requests ?? []).find((request) => request.id === selection.source_record_id)
    ?? findByText(matter.deal_control?.vdr_requests, [selection.document_title]);
}

function findCpForSelection(selection, matter) {
  return findByText(matter.deal_control?.cp_checklist, [selection.document_title])
    ?? (selection.document_title.toLowerCase().includes("officer") ? findByText(matter.deal_control?.cp_checklist, ["officer certificate"]) : null)
    ?? (selection.document_title.toLowerCase().includes("tax") ? findByText(matter.deal_control?.cp_checklist, ["tax"]) : null);
}

function findByText(rows = [], tokens = []) {
  const normalizedTokens = tokens
    .filter(Boolean)
    .flatMap((token) => String(token).toLowerCase().split(/\s+/))
    .filter((token) => token.length >= 3);
  if (normalizedTokens.length === 0) return null;
  return rows.find((row) => {
    const haystack = [row.title, row.question, row.clause, row.open_issue, row.position, row.id].filter(Boolean).join(" ").toLowerCase();
    return normalizedTokens.some((token) => haystack.includes(token));
  }) ?? null;
}

function extractFiscalPeriod(value) {
  const match = String(value ?? "").match(/FY\d{4}(?:-FY\d{4})?/i);
  return match?.[0] ?? null;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_FACT_EXTRACTION_INPUTS;
  return {
    ldd_extractor_selection_path: path.resolve(options.lddExtractorSelectionPath ?? defaults.lddExtractorSelectionPath),
    matter_path: path.resolve(options.matterPath ?? defaults.matterPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_extractor_selection", "artifact", inputs.ldd_extractor_selection_path],
    ["matter", "matter_file", inputs.matter_path],
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

function serializableLddFactExtraction(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--ldd-extractor-selection") parsed.lddExtractorSelectionPath = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-fact-extraction.mjs [options]

Options:
  --out-dir <folder>                         Output directory.
  --ldd-extractor-selection <file>           LDD extractor selection artifact.
  --matter <file>                            Demo matter source file.
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
