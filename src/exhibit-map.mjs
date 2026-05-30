import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXHIBIT_MAP_OUT_DIR = "artifacts/exhibit-map/latest";
export const DEFAULT_EXHIBIT_MAP_INPUTS = {
  evidenceFlagsPath: "artifacts/evidence-flags/latest/evidence-flags.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EXHIBIT_MAP_CONTRACT_ID = "exhibit-map.v1";
const EXHIBIT_RECORD_SCHEMA_VERSION = "exhibit-record.v1";
const EXHIBIT_BINDING_SCHEMA_VERSION = "exhibit-binding.v1";
const EXHIBIT_BINDING_TYPES = ["exhibit_to_evidence", "exhibit_to_citation", "exhibit_to_output_paragraph", "exhibit_to_lineage_path"];

export async function runExhibitMap(options = {}) {
  const result = await buildExhibitMap(options);
  if (options.write !== false) await writeExhibitMap(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Exhibit map failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExhibitMap(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXHIBIT_MAP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceFlags = await readJson(inputs.evidence_flags_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const lineageGraph = await readJson(inputs.lineage_graph_path);
  const evidenceCoverage = await readJson(inputs.evidence_coverage_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const catalogs = buildCatalogLookups({ evidenceFlags, citationObjectStore, lineageGraph, evidenceCoverage });
  const exhibitRecords = catalogs.evidenceFlagRecords.map((flagRecord, index) => buildExhibitRecord(flagRecord, catalogs, index, generatedAt));
  const exhibitBindings = exhibitRecords.flatMap((record) => record.exhibit_bindings);
  const exhibitIndexes = buildExhibitIndexes(exhibitRecords, exhibitBindings, generatedAt);
  const validationItems = validateExhibitMap({
    packageText,
    roadmapText,
    evidenceFlags,
    citationObjectStore,
    lineageGraph,
    evidenceCoverage,
    catalogs,
    exhibitRecords,
    exhibitBindings,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeExhibitMap({
    evidenceFlags,
    citationObjectStore,
    lineageGraph,
    evidenceCoverage,
    exhibitRecords,
    exhibitBindings,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "exhibit-map.v1",
    generated_at: generatedAt,
    exhibit_map_id: `exhibit-map.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("evidence_flags", evidenceFlags),
      summarizeSource("citation_object_store", citationObjectStore),
      summarizeSource("lineage_graph_builder", lineageGraph),
      summarizeSource("evidence_coverage_score", evidenceCoverage),
    ],
    exhibit_map_contract: buildExhibitMapContract(generatedAt),
    exhibit_catalog: {
      schema_version: "exhibit-catalog.v1",
      generated_at: generatedAt,
      exhibit_records: exhibitRecords,
      exhibit_bindings: exhibitBindings,
      exhibit_indexes: exhibitIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExhibitMapMarkdown(result),
  };
}

export async function writeExhibitMap(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableExhibitMap(result);
  await writeJson(path.join(outDir, "exhibit-map.json"), serializable);
  await writeJson(path.join(outDir, "exhibit-records.json"), {
    schema_version: "exhibit-records.v1",
    generated_at: result.generated_at,
    exhibit_record_count: result.exhibit_catalog.exhibit_records.length,
    exhibit_records: result.exhibit_catalog.exhibit_records,
  });
  await writeJson(path.join(outDir, "exhibit-bindings.json"), {
    schema_version: "exhibit-bindings.v1",
    generated_at: result.generated_at,
    exhibit_binding_count: result.exhibit_catalog.exhibit_bindings.length,
    exhibit_bindings: result.exhibit_catalog.exhibit_bindings,
  });
  await writeJson(path.join(outDir, "exhibit-indexes.json"), {
    schema_version: "exhibit-indexes.v1",
    generated_at: result.generated_at,
    exhibit_indexes: result.exhibit_catalog.exhibit_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    exhibit_map_id: result.exhibit_map_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExhibitMapCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runExhibitMap(args);
    console.log(`Exhibit map written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.exhibit_map_status}`);
    console.log(`Exhibits: ${result.summary.exhibit_record_count}`);
    console.log(`Bindings: ${result.summary.exhibit_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildExhibitMapContract(generatedAt) {
  return {
    schema_version: "exhibit-map-contract.v1",
    exhibit_map_contract_id: EXHIBIT_MAP_CONTRACT_ID,
    generated_at: generatedAt,
    exhibit_record_schema_version: EXHIBIT_RECORD_SCHEMA_VERSION,
    exhibit_binding_schema_version: EXHIBIT_BINDING_SCHEMA_VERSION,
    binding_types: EXHIBIT_BINDING_TYPES,
    source_inputs: [
      "evidence-flags.v1",
      "citation-object-store.v1",
      "lineage-graph-builder.v1",
      "evidence-coverage-score.v1",
    ],
    numbering_rule: "stable_matter_sequence_with_korean_exhibit_reference",
    binding_rule: "each_exhibit_binds_evidence_citation_output_paragraph_and_lineage_path",
    output_rule: "exhibits_are_draft_only_until_attorney_review_and_client_delivery_approval",
  };
}

function buildCatalogLookups({ evidenceFlags, citationObjectStore, lineageGraph, evidenceCoverage }) {
  const evidenceFlagRecords = evidenceFlags.evidence_flag_catalog?.evidence_flag_records ?? [];
  const citations = citationObjectStore.citation_catalog?.citations ?? [];
  const outputParagraphs = citationObjectStore.citation_catalog?.output_paragraphs ?? [];
  const lineagePaths = lineageGraph.lineage_graph_catalog?.lineage_paths ?? [];
  const coverageScores = evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? [];
  return {
    evidenceFlagRecords,
    citations,
    outputParagraphs,
    lineagePaths,
    coverageScores,
    flagRecordById: indexBy(evidenceFlagRecords, "evidence_flag_record_id"),
    citationById: indexBy(citations, "citation_id"),
    outputById: indexBy(outputParagraphs, "output_paragraph_id"),
    lineagePathById: indexBy(lineagePaths, "lineage_path_id"),
    coverageScoreById: indexBy(coverageScores, "coverage_score_id"),
  };
}

function buildExhibitRecord(flagRecord, catalogs, index, generatedAt) {
  const citation = catalogs.citationById.get(flagRecord.citation_id);
  const outputParagraph = catalogs.outputById.get(flagRecord.output_paragraph_id);
  const lineagePath = catalogs.lineagePathById.get(flagRecord.lineage_path_id);
  const coverageScore = catalogs.coverageScoreById.get(flagRecord.coverage_score_id);
  const sequence = index + 1;
  const exhibitLabel = `EX-${String(sequence).padStart(4, "0")}`;
  const exhibitReference = `별첨 ${sequence}`;
  const exhibitId = `exhibit.${slugify(flagRecord.matter_id)}.${String(sequence).padStart(4, "0")}`;
  const bindings = [
    buildExhibitBinding({ exhibitId, exhibitNumber: sequence, bindingType: "exhibit_to_evidence", targetType: "evidence_item", targetId: flagRecord.evidence_item_id, flagRecord, generatedAt }),
    buildExhibitBinding({ exhibitId, exhibitNumber: sequence, bindingType: "exhibit_to_citation", targetType: "citation", targetId: flagRecord.citation_id, flagRecord, generatedAt }),
    buildExhibitBinding({ exhibitId, exhibitNumber: sequence, bindingType: "exhibit_to_output_paragraph", targetType: "output_paragraph", targetId: flagRecord.output_paragraph_id, flagRecord, generatedAt }),
    buildExhibitBinding({ exhibitId, exhibitNumber: sequence, bindingType: "exhibit_to_lineage_path", targetType: "lineage_path", targetId: flagRecord.lineage_path_id, flagRecord, generatedAt }),
  ];
  return {
    schema_version: EXHIBIT_RECORD_SCHEMA_VERSION,
    exhibit_id: exhibitId,
    exhibit_number: sequence,
    exhibit_sequence: sequence,
    exhibit_label: exhibitLabel,
    exhibit_reference: exhibitReference,
    korean_reference: exhibitReference,
    exhibit_title: buildExhibitTitle(outputParagraph, flagRecord, sequence),
    exhibit_status: "draft_needs_review",
    artifact_targets: ["report", "litigation_brief"],
    target_document_types: ["report", "litigation_brief"],
    evidence_flag_record_id: flagRecord.evidence_flag_record_id,
    coverage_score_id: flagRecord.coverage_score_id,
    lineage_path_id: flagRecord.lineage_path_id,
    output_paragraph_id: flagRecord.output_paragraph_id,
    citation_id: flagRecord.citation_id,
    issue_id: flagRecord.issue_id,
    fact_id: flagRecord.fact_id,
    evidence_item_id: flagRecord.evidence_item_id,
    source_span_id: flagRecord.source_span_id,
    tenant_id: flagRecord.tenant_id,
    matter_id: flagRecord.matter_id,
    classification: flagRecord.classification,
    policy_snapshot_id: flagRecord.policy_snapshot_id,
    extraction_flag: flagRecord.extraction_flag,
    human_confirmation_flag: flagRecord.human_confirmation_flag,
    privilege_flag: flagRecord.privilege_flag,
    redaction_flag: flagRecord.redaction_flag,
    external_transfer_flag: flagRecord.external_transfer_flag,
    source_binding_status: citation?.source_binding_status ?? flagRecord.source_binding_status ?? "unknown",
    citation_status: citation?.citation_status ?? "unknown",
    lineage_path_status: lineagePath?.path_status ?? "unknown",
    coverage_status: coverageScore?.coverage_status ?? flagRecord.coverage_status ?? "unknown",
    coverage_score: coverageScore?.coverage_score ?? flagRecord.coverage_score ?? 0,
    missing_required_dimension_count: coverageScore?.missing_required_dimension_count ?? flagRecord.missing_required_dimension_count ?? 0,
    exhibit_binding_ids: bindings.map((binding) => binding.exhibit_binding_id),
    exhibit_bindings: bindings,
    matter_preserved: flagRecord.matter_preserved === true,
    classification_preserved: flagRecord.classification_preserved === true,
    policy_snapshot_preserved: flagRecord.policy_snapshot_preserved === true,
    review_status: "needs_review",
    human_review_required: true,
    attorney_review_required: true,
    output_client_facing_status: flagRecord.output_client_facing_status ?? outputParagraph?.client_facing_status ?? "not_client_facing",
    client_facing_ready: false,
    created_at: generatedAt,
    metadata: {
      sequence,
      paragraph_type: outputParagraph?.paragraph_type ?? null,
      paragraph_text_preview: truncate(outputParagraph?.paragraph_text ?? "", 220),
      citation_verification_status: citation?.verification_status ?? null,
      source_binding_status: citation?.source_binding_status ?? null,
      issue_type: citation?.metadata?.issue_type ?? flagRecord.metadata?.issue_type ?? null,
      risk_severity: citation?.metadata?.risk_severity ?? flagRecord.metadata?.issue_risk_severity ?? null,
      output_rule: "draft_exhibit_reference_until_human_approval",
    },
  };
}

function buildExhibitBinding({ exhibitId, exhibitNumber, bindingType, targetType, targetId, flagRecord, generatedAt }) {
  return {
    schema_version: EXHIBIT_BINDING_SCHEMA_VERSION,
    exhibit_binding_id: `exhibit-binding.${slugify(exhibitId)}.${bindingType}`,
    exhibit_id: exhibitId,
    exhibit_number: exhibitNumber,
    binding_type: bindingType,
    target_type: targetType,
    target_id: targetId,
    binding_status: targetId ? "bound" : "missing_target",
    tenant_id: flagRecord.tenant_id,
    matter_id: flagRecord.matter_id,
    classification: flagRecord.classification,
    policy_snapshot_id: flagRecord.policy_snapshot_id,
    human_review_required: true,
    created_at: generatedAt,
  };
}

function buildExhibitTitle(outputParagraph, flagRecord, sequence) {
  const preview = truncate(outputParagraph?.paragraph_text ?? flagRecord.issue_id ?? flagRecord.evidence_item_id, 96);
  return `Exhibit ${sequence}: ${preview}`;
}

function buildExhibitIndexes(records, bindings, generatedAt) {
  return {
    schema_version: "exhibit-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(records, "matter_id"),
    by_classification: countBy(records, "classification"),
    by_exhibit_status: countBy(records, "exhibit_status"),
    by_review_status: countBy(records, "review_status"),
    by_citation_status: countBy(records, "citation_status"),
    by_source_binding_status: countBy(records, "source_binding_status"),
    by_external_transfer_flag: countBy(records, "external_transfer_flag"),
    by_binding_type: countBy(bindings, "binding_type"),
    by_binding_status: countBy(bindings, "binding_status"),
  };
}

function validateExhibitMap({
  packageText,
  roadmapText,
  evidenceFlags,
  citationObjectStore,
  lineageGraph,
  evidenceCoverage,
  catalogs,
  exhibitRecords,
  exhibitBindings,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const exhibitNumbers = new Set(exhibitRecords.map((record) => record.exhibit_number));
  const recordsByFlagId = new Map(exhibitRecords.map((record) => [record.evidence_flag_record_id, record]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:exhibit-map"]), "package.json must expose resource:exhibit-map.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 146: Exhibit Mapping"), "Implementation roadmap must document Phase 146.");
  pushCheck(validationItems, "source", "evidence_flags_complete", evidenceFlags.summary?.evidence_flags_status === "complete", "Evidence Flags must be complete.");
  pushCheck(validationItems, "source", "citation_object_store_complete", citationObjectStore.summary?.citation_object_store_status === "complete", "Citation Object Store must be complete.");
  pushCheck(validationItems, "source", "lineage_graph_complete", lineageGraph.summary?.lineage_graph_status === "complete", "Lineage Graph Builder must be complete.");
  pushCheck(validationItems, "source", "evidence_coverage_complete", evidenceCoverage.summary?.evidence_coverage_status === "complete", "Evidence Coverage Score must be complete.");
  pushCheck(validationItems, "catalog", "evidence_flags_present", catalogs.evidenceFlagRecords.length > 0, "Evidence flag records are required.");
  pushCheck(validationItems, "catalog", "exhibit_records_match_flags", exhibitRecords.length === catalogs.evidenceFlagRecords.length, "Every evidence flag record must produce one exhibit record.");
  pushCheck(validationItems, "catalog", "exhibit_records_match_citations", exhibitRecords.length === catalogs.citations.length, "Every citation must be represented by one exhibit record.");
  pushCheck(validationItems, "catalog", "exhibit_bindings_match_records", exhibitBindings.length === exhibitRecords.length * EXHIBIT_BINDING_TYPES.length, "Every exhibit must bind evidence, citation, output paragraph, and lineage path.");
  pushCheck(validationItems, "catalog", "exhibit_numbers_unique", exhibitNumbers.size === exhibitRecords.length, "Exhibit numbers must be unique.");

  for (const flagRecord of catalogs.evidenceFlagRecords) {
    pushCheck(validationItems, `evidence_flags.${flagRecord.evidence_flag_record_id}`, "exhibit_record_present", recordsByFlagId.has(flagRecord.evidence_flag_record_id), "Every evidence flag record must have an exhibit.");
  }

  for (const record of exhibitRecords) {
    const prefix = `exhibits.${record.exhibit_id}`;
    const bindingTypes = new Set(record.exhibit_bindings.map((binding) => binding.binding_type));
    pushCheck(validationItems, prefix, "schema_version_canonical", record.schema_version === EXHIBIT_RECORD_SCHEMA_VERSION, "Exhibit record must use exhibit-record.v1.");
    pushCheck(validationItems, prefix, "reference_present", Boolean(record.exhibit_number && record.exhibit_reference && record.korean_reference), "Exhibit must have stable number and Korean reference.");
    pushCheck(validationItems, prefix, "flag_record_resolves", catalogs.flagRecordById.has(record.evidence_flag_record_id), "Exhibit must resolve evidence flag record.");
    pushCheck(validationItems, prefix, "citation_resolves", catalogs.citationById.has(record.citation_id), "Exhibit must resolve citation.");
    pushCheck(validationItems, prefix, "output_paragraph_resolves", catalogs.outputById.has(record.output_paragraph_id), "Exhibit must resolve output paragraph.");
    pushCheck(validationItems, prefix, "lineage_path_resolves", catalogs.lineagePathById.has(record.lineage_path_id), "Exhibit must resolve lineage path.");
    pushCheck(validationItems, prefix, "coverage_score_resolves", catalogs.coverageScoreById.has(record.coverage_score_id), "Exhibit must resolve coverage score.");
    pushCheck(validationItems, prefix, "binding_types_complete", EXHIBIT_BINDING_TYPES.every((type) => bindingTypes.has(type)), "Exhibit must bind evidence, citation, output paragraph, and lineage path.");
    pushCheck(validationItems, prefix, "bindings_bound", record.exhibit_bindings.every((binding) => binding.binding_status === "bound"), "Every exhibit binding must be bound.");
    pushCheck(validationItems, prefix, "matter_preserved", record.matter_preserved === true, "Exhibit must preserve matter_id.");
    pushCheck(validationItems, prefix, "classification_preserved", record.classification_preserved === true, "Exhibit must preserve classification.");
    pushCheck(validationItems, prefix, "policy_snapshot_preserved", record.policy_snapshot_preserved === true, "Exhibit must preserve policy snapshot.");
    pushCheck(validationItems, prefix, "review_pending", record.review_status === "needs_review" && record.human_review_required === true && record.attorney_review_required === true, "Exhibit must remain pending attorney review.");
    pushCheck(validationItems, prefix, "not_client_facing", record.output_client_facing_status === "not_client_facing" && record.client_facing_ready === false, "Exhibit must stay not client-facing.");
  }

  for (const binding of exhibitBindings) {
    const prefix = `bindings.${binding.exhibit_binding_id}`;
    pushCheck(validationItems, prefix, "schema_version_canonical", binding.schema_version === EXHIBIT_BINDING_SCHEMA_VERSION, "Exhibit binding must use exhibit-binding.v1.");
    pushCheck(validationItems, prefix, "binding_type_canonical", EXHIBIT_BINDING_TYPES.includes(binding.binding_type), "Exhibit binding type must be canonical.");
    pushCheck(validationItems, prefix, "binding_status_bound", binding.binding_status === "bound", "Exhibit binding must resolve to a target.");
    pushCheck(validationItems, prefix, "human_review_required", binding.human_review_required === true, "Exhibit binding must require human review.");
  }

  return validationItems;
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

function summarizeExhibitMap({
  evidenceFlags,
  citationObjectStore,
  lineageGraph,
  evidenceCoverage,
  exhibitRecords,
  exhibitBindings,
  validationItems,
  validation,
}) {
  return {
    exhibit_map_status: validation.valid ? "complete" : "blocked",
    exhibit_map_contract_id: EXHIBIT_MAP_CONTRACT_ID,
    exhibit_record_schema_version: EXHIBIT_RECORD_SCHEMA_VERSION,
    exhibit_binding_schema_version: EXHIBIT_BINDING_SCHEMA_VERSION,
    evidence_flags_status: evidenceFlags.summary?.evidence_flags_status ?? "unknown",
    citation_object_store_status: citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    lineage_graph_status: lineageGraph.summary?.lineage_graph_status ?? "unknown",
    evidence_coverage_status: evidenceCoverage.summary?.evidence_coverage_status ?? "unknown",
    evidence_flag_record_count: evidenceFlags.summary?.evidence_flag_record_count ?? 0,
    citation_count: citationObjectStore.summary?.citation_count ?? 0,
    output_paragraph_count: citationObjectStore.summary?.output_paragraph_count ?? 0,
    lineage_path_count: lineageGraph.summary?.lineage_path_count ?? 0,
    coverage_score_count: evidenceCoverage.summary?.coverage_score_count ?? 0,
    exhibit_record_count: exhibitRecords.length,
    exhibit_binding_count: exhibitBindings.length,
    expected_exhibit_binding_count: exhibitRecords.length * EXHIBIT_BINDING_TYPES.length,
    unique_exhibit_number_count: new Set(exhibitRecords.map((record) => record.exhibit_number)).size,
    evidence_linked_exhibit_count: exhibitRecords.filter((record) => Boolean(record.evidence_item_id)).length,
    citation_linked_exhibit_count: exhibitRecords.filter((record) => Boolean(record.citation_id)).length,
    output_paragraph_linked_exhibit_count: exhibitRecords.filter((record) => Boolean(record.output_paragraph_id)).length,
    lineage_path_linked_exhibit_count: exhibitRecords.filter((record) => Boolean(record.lineage_path_id)).length,
    bound_exhibit_binding_count: exhibitBindings.filter((binding) => binding.binding_status === "bound").length,
    matter_preserved_exhibit_count: exhibitRecords.filter((record) => record.matter_preserved).length,
    classification_preserved_exhibit_count: exhibitRecords.filter((record) => record.classification_preserved).length,
    policy_snapshot_preserved_exhibit_count: exhibitRecords.filter((record) => record.policy_snapshot_preserved).length,
    needs_review_exhibit_count: exhibitRecords.filter((record) => record.review_status === "needs_review").length,
    attorney_review_required_exhibit_count: exhibitRecords.filter((record) => record.attorney_review_required === true).length,
    attorney_review_required_count: exhibitRecords.filter((record) => record.attorney_review_required === true).length,
    not_client_facing_exhibit_count: exhibitRecords.filter((record) => record.output_client_facing_status === "not_client_facing").length,
    client_facing_ready_exhibit_count: exhibitRecords.filter((record) => record.client_facing_ready === true).length,
    external_transfer_requires_approval_count: exhibitRecords.filter((record) => record.external_transfer_flag === "external_transfer_requires_approval").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(exhibitRecords, "matter_id"),
    by_classification: countBy(exhibitRecords, "classification"),
    by_exhibit_status: countBy(exhibitRecords, "exhibit_status"),
    by_review_status: countBy(exhibitRecords, "review_status"),
    by_external_transfer_flag: countBy(exhibitRecords, "external_transfer_flag"),
    by_binding_type: countBy(exhibitBindings, "binding_type"),
    by_binding_status: countBy(exhibitBindings, "binding_status"),
  };
}

function renderExhibitMapMarkdown(result) {
  const lines = [];
  lines.push("# Exhibit Map");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.exhibit_map_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.exhibit_map_contract_id}`);
  lines.push(`- Exhibits: ${result.summary.exhibit_record_count}`);
  lines.push(`- Bindings: ${result.summary.exhibit_binding_count}`);
  lines.push(`- Evidence linked: ${result.summary.evidence_linked_exhibit_count}`);
  lines.push(`- Citation linked: ${result.summary.citation_linked_exhibit_count}`);
  lines.push(`- Output paragraph linked: ${result.summary.output_paragraph_linked_exhibit_count}`);
  lines.push(`- Lineage path linked: ${result.summary.lineage_path_linked_exhibit_count}`);
  lines.push(`- Pending attorney review: ${result.summary.attorney_review_required_exhibit_count}`);
  lines.push(`- Client-facing ready: ${result.summary.client_facing_ready_exhibit_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `exhibit-map-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    evidence_flags_path: path.resolve(options.evidenceFlagsPath ?? DEFAULT_EXHIBIT_MAP_INPUTS.evidenceFlagsPath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_EXHIBIT_MAP_INPUTS.citationObjectStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_EXHIBIT_MAP_INPUTS.lineageGraphPath),
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_EXHIBIT_MAP_INPUTS.evidenceCoveragePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EXHIBIT_MAP_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EXHIBIT_MAP_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence-flags") parsed.evidenceFlagsPath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
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
  console.log(`Usage: node scripts/exhibit-map.mjs [options]

Options:
  --evidence-flags <path>           evidence-flags.json path.
  --citation-object-store <path>    citation-object-store.json path.
  --lineage-graph <path>            lineage-graph.json path.
  --evidence-coverage <path>        evidence-coverage-score.json path.
  --out-dir <path>                  Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Exit non-zero when validation fails.
  --no-write                        Build without writing artifacts.
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

function serializableExhibitMap(result) {
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

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
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

function truncate(value, length) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
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
