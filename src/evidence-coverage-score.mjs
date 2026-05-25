import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_COVERAGE_OUT_DIR = "artifacts/evidence-coverage/latest";
export const DEFAULT_EVIDENCE_COVERAGE_INPUTS = {
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_COVERAGE_CONTRACT_ID = "evidence-coverage-score.v1";
const COVERAGE_SCORE_SCHEMA_VERSION = "coverage-score.v1";
const COVERAGE_DIMENSION_SCHEMA_VERSION = "coverage-dimension.v1";
const COVERAGE_DIMENSIONS = ["claim", "date", "party", "amount", "legal_basis"];

export async function runEvidenceCoverageScore(options = {}) {
  const result = await buildEvidenceCoverageScore(options);
  if (options.write !== false) await writeEvidenceCoverageScore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence coverage score failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceCoverageScore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_COVERAGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const lineageGraph = await readJson(inputs.lineage_graph_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const catalogs = buildCatalogLookups({
    lineageGraph,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
  });
  const coverageScores = catalogs.lineagePaths.map((lineagePath, index) => buildCoverageScore(lineagePath, catalogs, index, generatedAt));
  const coverageDimensions = coverageScores.flatMap((score) => score.coverage_dimensions);
  const coverageIndexes = buildCoverageIndexes(coverageScores, coverageDimensions, generatedAt);
  const validationItems = validateEvidenceCoverageScore({
    packageText,
    roadmapText,
    lineageGraph,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    catalogs,
    coverageScores,
    coverageDimensions,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeCoverage({
    lineageGraph,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    coverageScores,
    coverageDimensions,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "evidence-coverage-score.v1",
    generated_at: generatedAt,
    evidence_coverage_score_id: `evidence-coverage-score.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("lineage_graph_builder", lineageGraph),
      summarizeSource("source_span_store", sourceSpanStore),
      summarizeSource("evidence_item_store", evidenceItemStore),
      summarizeSource("fact_claim_store", factClaimStore),
      summarizeSource("issue_graph_store", issueGraphStore),
      summarizeSource("citation_object_store", citationObjectStore),
    ],
    evidence_coverage_contract: buildCoverageContract(generatedAt),
    evidence_coverage_catalog: {
      schema_version: "evidence-coverage-catalog.v1",
      generated_at: generatedAt,
      coverage_scores: coverageScores,
      coverage_dimensions: coverageDimensions,
      coverage_indexes: coverageIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceCoverageMarkdown(result),
  };
}

export async function writeEvidenceCoverageScore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCoverage(result);
  await writeJson(path.join(outDir, "evidence-coverage-score.json"), serializable);
  await writeJson(path.join(outDir, "coverage-scores.json"), {
    schema_version: "coverage-scores.v1",
    generated_at: result.generated_at,
    coverage_score_count: result.evidence_coverage_catalog.coverage_scores.length,
    coverage_scores: result.evidence_coverage_catalog.coverage_scores,
  });
  await writeJson(path.join(outDir, "coverage-dimensions.json"), {
    schema_version: "coverage-dimensions.v1",
    generated_at: result.generated_at,
    coverage_dimension_count: result.evidence_coverage_catalog.coverage_dimensions.length,
    coverage_dimensions: result.evidence_coverage_catalog.coverage_dimensions,
  });
  await writeJson(path.join(outDir, "coverage-indexes.json"), {
    schema_version: "coverage-indexes.v1",
    generated_at: result.generated_at,
    coverage_indexes: result.evidence_coverage_catalog.coverage_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_coverage_score_id: result.evidence_coverage_score_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceCoverageScoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceCoverageScore(args);
    console.log(`Evidence coverage score written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_coverage_status}`);
    console.log(`Coverage scores: ${result.summary.coverage_score_count}`);
    console.log(`Dimensions: ${result.summary.coverage_dimension_count}`);
    console.log(`Average score: ${result.summary.average_coverage_score}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCoverageContract(generatedAt) {
  return {
    schema_version: "evidence-coverage-contract.v1",
    evidence_coverage_contract_id: EVIDENCE_COVERAGE_CONTRACT_ID,
    generated_at: generatedAt,
    coverage_score_schema_version: COVERAGE_SCORE_SCHEMA_VERSION,
    coverage_dimension_schema_version: COVERAGE_DIMENSION_SCHEMA_VERSION,
    required_dimensions: COVERAGE_DIMENSIONS,
    source_inputs: [
      "lineage-graph-builder.v1",
      "source-span-store.v1",
      "evidence-item-store.v1",
      "fact-claim-store.v1",
      "issue-graph-store.v1",
      "citation-object-store.v1",
    ],
    scoring_rule: "claim_and_legal_basis_are_always_required_while_date_party_and_amount_are_required_when_signals_exist",
    output_rule: "coverage_scores_are_review_pending_and_not_client_facing_until_human_approval",
  };
}

function buildCatalogLookups({ lineageGraph, sourceSpanStore, evidenceItemStore, factClaimStore, issueGraphStore, citationObjectStore }) {
  const lineagePaths = lineageGraph.lineage_graph_catalog?.lineage_paths ?? [];
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const issues = issueGraphStore.issue_graph_catalog?.issues ?? [];
  const legalRules = issueGraphStore.issue_graph_catalog?.legal_rules ?? [];
  const legalRuleBindings = issueGraphStore.issue_graph_catalog?.legal_rule_bindings ?? [];
  const outputParagraphs = citationObjectStore.citation_catalog?.output_paragraphs ?? [];
  const citations = citationObjectStore.citation_catalog?.citations ?? [];
  return {
    lineagePaths,
    sourceSpans,
    evidenceItems,
    factClaims,
    issues,
    legalRules,
    legalRuleBindings,
    outputParagraphs,
    citations,
    lineagePathById: indexBy(lineagePaths, "lineage_path_id"),
    sourceSpanById: indexBy(sourceSpans, "source_span_id"),
    evidenceById: indexBy(evidenceItems, "evidence_id"),
    factById: indexBy(factClaims, "fact_id"),
    issueById: indexBy(issues, "issue_id"),
    legalRuleById: indexBy(legalRules, "legal_rule_id"),
    legalRuleBindingsByIssueId: groupBy(legalRuleBindings, "issue_id"),
    outputById: indexBy(outputParagraphs, "output_paragraph_id"),
    citationById: indexBy(citations, "citation_id"),
  };
}

function buildCoverageScore(lineagePath, catalogs, index, generatedAt) {
  const source = catalogs.sourceSpanById.get(lineagePath.source_span_id);
  const evidence = catalogs.evidenceById.get(lineagePath.evidence_item_id);
  const fact = catalogs.factById.get(lineagePath.fact_id);
  const issue = catalogs.issueById.get(lineagePath.issue_id);
  const output = catalogs.outputById.get(lineagePath.output_paragraph_id);
  const citation = catalogs.citationById.get(lineagePath.citation_id);
  const legalRuleBindings = catalogs.legalRuleBindingsByIssueId.get(lineagePath.issue_id) ?? [];
  const legalRules = legalRuleBindings.map((binding) => catalogs.legalRuleById.get(binding.legal_rule_id)).filter(Boolean);
  const coverageScoreId = `coverage-score.${slugify(lineagePath.lineage_path_id)}`;
  const signalBundle = buildSignalBundle({ source, evidence, fact, issue, output, legalRules });
  const dimensions = buildCoverageDimensions({
    coverageScoreId,
    lineagePath,
    source,
    evidence,
    fact,
    issue,
    output,
    citation,
    legalRuleBindings,
    legalRules,
    signalBundle,
    generatedAt,
  });
  const requiredDimensions = dimensions.filter((dimension) => dimension.required);
  const coveredRequiredDimensions = requiredDimensions.filter((dimension) => dimension.covered);
  const missingRequiredDimensions = requiredDimensions.filter((dimension) => !dimension.covered);
  const coverageScore = requiredDimensions.length === 0
    ? 1
    : round(coveredRequiredDimensions.length / requiredDimensions.length);
  const coverageStatus = missingRequiredDimensions.length === 0 ? "complete" : "partial";
  return {
    schema_version: COVERAGE_SCORE_SCHEMA_VERSION,
    coverage_score_id: coverageScoreId,
    lineage_path_id: lineagePath.lineage_path_id,
    coverage_subject_type: "output_paragraph",
    coverage_subject_id: lineagePath.output_paragraph_id,
    output_paragraph_id: lineagePath.output_paragraph_id,
    citation_id: lineagePath.citation_id,
    issue_id: lineagePath.issue_id,
    fact_id: lineagePath.fact_id,
    evidence_item_id: lineagePath.evidence_item_id,
    source_span_id: lineagePath.source_span_id,
    tenant_id: lineagePath.tenant_id,
    matter_id: lineagePath.matter_id,
    classification: lineagePath.classification,
    policy_snapshot_id: lineagePath.policy_snapshot_id,
    coverage_status: coverageStatus,
    coverage_score: coverageScore,
    required_dimension_count: requiredDimensions.length,
    covered_required_dimension_count: coveredRequiredDimensions.length,
    missing_required_dimension_count: missingRequiredDimensions.length,
    not_applicable_dimension_count: dimensions.filter((dimension) => dimension.coverage_status === "not_applicable").length,
    dimension_count: dimensions.length,
    review_status: "needs_review",
    human_review_required: true,
    output_client_facing_status: output?.client_facing_status ?? null,
    client_facing_ready: false,
    matter_preserved: lineagePath.matter_preserved === true,
    classification_preserved: lineagePath.classification_preserved === true,
    policy_snapshot_preserved: lineagePath.policy_snapshot_preserved === true,
    source_binding_status: lineagePath.metadata?.source_binding_status ?? "unknown",
    paragraph_binding_status: lineagePath.metadata?.paragraph_binding_status ?? "unknown",
    legal_basis_status: legalRuleBindings.length > 0 ? "placeholder_requires_attorney_confirmation" : "missing",
    dimension_ids: dimensions.map((dimension) => dimension.coverage_dimension_id),
    coverage_dimensions: dimensions,
    created_at: generatedAt,
    metadata: {
      sequence: index + 1,
      issue_type: issue?.issue_type ?? lineagePath.metadata?.issue_type ?? null,
      risk_severity: issue?.risk_severity ?? lineagePath.metadata?.risk_severity ?? null,
      signal_counts: Object.fromEntries(Object.entries(signalBundle).map(([key, value]) => [key, value.length])),
    },
  };
}

function buildCoverageDimensions({ coverageScoreId, lineagePath, source, evidence, fact, issue, output, citation, legalRuleBindings, legalRules, signalBundle, generatedAt }) {
  const refs = {
    claim: evidenceRefs([
      ref("source_span", source?.source_span_id),
      ref("evidence_item", evidence?.evidence_id),
      ref("fact_claim", fact?.fact_id),
      ref("issue", issue?.issue_id),
      ref("output_paragraph", output?.output_paragraph_id),
      ref("citation", citation?.citation_id),
    ]),
    date: signalRefs(signalBundle.date, source, evidence, fact, output),
    party: signalRefs(signalBundle.party, source, evidence, fact, output),
    amount: signalRefs(signalBundle.amount, source, evidence, fact, output),
    legal_basis: evidenceRefs([
      ...legalRuleBindings.map((binding) => ref("issue_legal_rule_binding", binding.issue_legal_rule_binding_id)),
      ...legalRules.map((rule) => ref("legal_rule", rule.legal_rule_id)),
      ref("issue", issue?.issue_id),
    ]),
  };
  const requiredMap = {
    claim: true,
    date: signalBundle.date.length > 0 || issue?.issue_type === "deadline_or_chronology",
    party: signalBundle.party.length > 0,
    amount: signalBundle.amount.length > 0,
    legal_basis: true,
  };
  const coveredMap = {
    claim: lineagePath.path_status === "complete" && Boolean(source && evidence && fact && issue && output && citation),
    date: signalBundle.date.length > 0 && Boolean(source && evidence),
    party: signalBundle.party.length > 0 && Boolean(source && evidence),
    amount: signalBundle.amount.length > 0 && Boolean(source && evidence),
    legal_basis: legalRuleBindings.some((binding) => binding.binding_status === "bound") && legalRules.length > 0,
  };
  return COVERAGE_DIMENSIONS.map((dimension) => {
    const required = requiredMap[dimension];
    const covered = coveredMap[dimension];
    const coverageStatus = covered ? "covered" : required ? "missing" : "not_applicable";
    return {
      schema_version: COVERAGE_DIMENSION_SCHEMA_VERSION,
      coverage_dimension_id: `coverage-dimension.${slugify(coverageScoreId)}.${dimension}`,
      coverage_score_id: coverageScoreId,
      lineage_path_id: lineagePath.lineage_path_id,
      output_paragraph_id: lineagePath.output_paragraph_id,
      dimension,
      required,
      covered,
      coverage_status: coverageStatus,
      signal_count: signalBundle[dimension]?.length ?? (dimension === "claim" || dimension === "legal_basis" ? refs[dimension].length : 0),
      signals: signalBundle[dimension] ?? [],
      evidence_refs: refs[dimension],
      review_status: "needs_review",
      human_review_required: true,
      created_at: generatedAt,
      rationale: rationaleForDimension(dimension, required, covered, signalBundle, legalRuleBindings),
    };
  });
}

function buildSignalBundle({ source, evidence, fact, issue, output, legalRules }) {
  const text = [
    source?.content_preview,
    evidence?.summary,
    evidence?.metadata?.content_preview,
    fact?.statement,
    issue?.title,
    issue?.metadata?.fact_statement,
    output?.paragraph_text,
    ...legalRules.map((rule) => rule.rule_label),
  ].filter(Boolean).join("\n");
  return {
    claim: [],
    date: extractSignals(text, [
      /\b(?:19|20)\d{2}[-./](?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\d|3[01])\b/g,
      /\b(?:19|20)\d{2}\s*년\s*(?:0?[1-9]|1[0-2])\s*월\s*(?:0?[1-9]|[12]\d|3[01])\s*일\b/g,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
    ]),
    party: extractSignals(text, [
      /\b(?:counterparty|seller|buyer|shareholder|director|officer|party|parties)\b/gi,
      /(?:당사자|상대방|매도인|매수인|주주|이사|임원|회사|법인|계약상대방)/g,
    ]),
    amount: extractSignals(text, [
      /(?:KRW|USD|EUR|JPY|₩|\$|€|¥)\s?[\d,]+(?:\.\d+)?/gi,
      /[\d,]+(?:\.\d+)?\s?(?:원|달러|억원|만원|billion|million|thousand)\b/gi,
    ]),
    legal_basis: [],
  };
}

function extractSignals(text, regexes) {
  const signals = [];
  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      const value = match[0].trim();
      if (value && !signals.includes(value)) signals.push(value);
      if (signals.length >= 8) return signals;
    }
  }
  return signals;
}

function signalRefs(signals, source, evidence, fact, output) {
  if (signals.length === 0) return [];
  return evidenceRefs([
    ref("source_span", source?.source_span_id),
    ref("evidence_item", evidence?.evidence_id),
    ref("fact_claim", fact?.fact_id),
    ref("output_paragraph", output?.output_paragraph_id),
  ]);
}

function evidenceRefs(refs) {
  return refs.filter((item) => item.ref_id);
}

function ref(refType, refId) {
  return { ref_type: refType, ref_id: refId ?? null };
}

function rationaleForDimension(dimension, required, covered, signalBundle, legalRuleBindings) {
  if (dimension === "claim") return covered ? "Complete lineage path binds claim to source, evidence, fact, issue, output, and citation." : "Claim lineage is incomplete.";
  if (dimension === "legal_basis") return covered ? "Issue is bound to a legal rule placeholder that requires attorney confirmation." : "No legal rule binding is available.";
  if (!required) return `${dimension} signal not detected; dimension is scored as not applicable.`;
  return covered
    ? `${dimension} signal detected and tied to the source/evidence path.`
    : `${dimension} signal is required but not tied to source evidence.`;
}

function buildCoverageIndexes(coverageScores, coverageDimensions, generatedAt) {
  return {
    schema_version: "coverage-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(coverageScores, "matter_id"),
    by_classification: countBy(coverageScores, "classification"),
    by_coverage_status: countBy(coverageScores, "coverage_status"),
    by_review_status: countBy(coverageScores, "review_status"),
    by_output_client_facing_status: countBy(coverageScores, "output_client_facing_status"),
    by_dimension: countBy(coverageDimensions, "dimension"),
    by_dimension_status: countBy(coverageDimensions, "coverage_status"),
  };
}

function validateEvidenceCoverageScore({
  packageText,
  roadmapText,
  lineageGraph,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  issueGraphStore,
  citationObjectStore,
  catalogs,
  coverageScores,
  coverageDimensions,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const scoresByPathId = new Map(coverageScores.map((score) => [score.lineage_path_id, score]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:evidence-coverage"]), "package.json must expose resource:evidence-coverage.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 144: Evidence Coverage Scoring"), "Implementation roadmap must document Phase 144.");
  pushCheck(validationItems, "source", "lineage_graph_complete", lineageGraph.summary?.lineage_graph_status === "complete", "Lineage Graph Builder must be complete.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "source", "fact_claim_store_complete", factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store must be complete.");
  pushCheck(validationItems, "source", "issue_graph_store_complete", issueGraphStore.summary?.issue_graph_store_status === "complete", "Issue Graph Store must be complete.");
  pushCheck(validationItems, "source", "citation_object_store_complete", citationObjectStore.summary?.citation_object_store_status === "complete", "Citation Object Store must be complete.");
  pushCheck(validationItems, "catalog", "lineage_paths_present", catalogs.lineagePaths.length > 0, "Lineage paths are required.");
  pushCheck(validationItems, "catalog", "coverage_scores_match_paths", coverageScores.length === catalogs.lineagePaths.length, "Every lineage path must produce one coverage score.");
  pushCheck(validationItems, "catalog", "coverage_dimensions_match_scores", coverageDimensions.length === coverageScores.length * COVERAGE_DIMENSIONS.length, "Every coverage score must have every coverage dimension.");

  for (const lineagePath of catalogs.lineagePaths) {
    pushCheck(validationItems, `paths.${lineagePath.lineage_path_id}`, "coverage_score_present", scoresByPathId.has(lineagePath.lineage_path_id), "Every lineage path must have a coverage score.");
  }

  for (const score of coverageScores) {
    const prefix = `coverage_scores.${score.coverage_score_id}`;
    const dimensions = score.coverage_dimensions ?? [];
    const dimensionNames = new Set(dimensions.map((dimension) => dimension.dimension));
    pushCheck(validationItems, prefix, "schema_version_canonical", score.schema_version === COVERAGE_SCORE_SCHEMA_VERSION, "Coverage score must use coverage-score.v1.");
    pushCheck(validationItems, prefix, "score_range", score.coverage_score >= 0 && score.coverage_score <= 1, "Coverage score must be between 0 and 1.");
    pushCheck(validationItems, prefix, "dimensions_complete", COVERAGE_DIMENSIONS.every((dimension) => dimensionNames.has(dimension)), "Coverage score must calculate claim, date, party, amount, and legal basis dimensions.");
    pushCheck(validationItems, prefix, "claim_dimension_covered", dimensions.some((dimension) => dimension.dimension === "claim" && dimension.covered), "Claim coverage must be covered.");
    pushCheck(validationItems, prefix, "legal_basis_dimension_covered", dimensions.some((dimension) => dimension.dimension === "legal_basis" && dimension.covered), "Legal basis coverage must be covered.");
    pushCheck(validationItems, prefix, "lineage_path_resolves", catalogs.lineagePathById.has(score.lineage_path_id), "Coverage score lineage path must resolve.");
    pushCheck(validationItems, prefix, "issue_resolves", catalogs.issueById.has(score.issue_id), "Coverage score issue must resolve.");
    pushCheck(validationItems, prefix, "fact_resolves", catalogs.factById.has(score.fact_id), "Coverage score fact must resolve.");
    pushCheck(validationItems, prefix, "evidence_resolves", catalogs.evidenceById.has(score.evidence_item_id), "Coverage score evidence item must resolve.");
    pushCheck(validationItems, prefix, "source_span_resolves", catalogs.sourceSpanById.has(score.source_span_id), "Coverage score source span must resolve.");
    pushCheck(validationItems, prefix, "citation_resolves", catalogs.citationById.has(score.citation_id), "Coverage score citation must resolve.");
    pushCheck(validationItems, prefix, "matter_preserved", score.matter_preserved === true, "Coverage score must preserve matter_id.");
    pushCheck(validationItems, prefix, "classification_preserved", score.classification_preserved === true, "Coverage score must preserve classification.");
    pushCheck(validationItems, prefix, "policy_snapshot_preserved", score.policy_snapshot_preserved === true, "Coverage score must preserve policy snapshot.");
    pushCheck(validationItems, prefix, "not_client_facing", score.output_client_facing_status === "not_client_facing" && score.client_facing_ready === false, "Coverage score must stay not client-facing.");
    pushCheck(validationItems, prefix, "review_pending", score.review_status === "needs_review" && score.human_review_required === true, "Coverage score must remain pending human review.");
  }

  for (const dimension of coverageDimensions) {
    pushCheck(validationItems, `dimensions.${dimension.coverage_dimension_id}`, "schema_version_canonical", dimension.schema_version === COVERAGE_DIMENSION_SCHEMA_VERSION, "Coverage dimension must use coverage-dimension.v1.");
    pushCheck(validationItems, `dimensions.${dimension.coverage_dimension_id}`, "status_canonical", ["covered", "missing", "not_applicable"].includes(dimension.coverage_status), "Coverage dimension status must be canonical.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `evidence-coverage-validation.${slugify(pathLabel)}.${checkId}`,
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

function summarizeCoverage({
  lineageGraph,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  issueGraphStore,
  citationObjectStore,
  coverageScores,
  coverageDimensions,
  validationItems,
  validation,
}) {
  const dimensionsByName = groupBy(coverageDimensions, "dimension");
  const requiredDimensions = coverageDimensions.filter((dimension) => dimension.required);
  const coveredRequiredDimensions = requiredDimensions.filter((dimension) => dimension.covered);
  return {
    evidence_coverage_status: validation.valid ? "complete" : "blocked",
    evidence_coverage_contract_id: EVIDENCE_COVERAGE_CONTRACT_ID,
    coverage_score_schema_version: COVERAGE_SCORE_SCHEMA_VERSION,
    coverage_dimension_schema_version: COVERAGE_DIMENSION_SCHEMA_VERSION,
    lineage_graph_status: lineageGraph.summary?.lineage_graph_status ?? "unknown",
    source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    fact_claim_store_status: factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_status: issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    citation_object_store_status: citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    lineage_path_count: lineageGraph.summary?.lineage_path_count ?? 0,
    output_paragraph_count: citationObjectStore.summary?.output_paragraph_count ?? 0,
    coverage_score_count: coverageScores.length,
    coverage_dimension_count: coverageDimensions.length,
    required_dimension_count: requiredDimensions.length,
    covered_required_dimension_count: coveredRequiredDimensions.length,
    missing_required_dimension_count: requiredDimensions.length - coveredRequiredDimensions.length,
    not_applicable_dimension_count: coverageDimensions.filter((dimension) => dimension.coverage_status === "not_applicable").length,
    full_coverage_score_count: coverageScores.filter((score) => score.coverage_status === "complete").length,
    partial_coverage_score_count: coverageScores.filter((score) => score.coverage_status === "partial").length,
    average_coverage_score: average(coverageScores.map((score) => score.coverage_score)),
    claim_dimension_count: dimensionsByName.get("claim")?.length ?? 0,
    claim_covered_count: countCovered(dimensionsByName.get("claim") ?? []),
    date_dimension_count: dimensionsByName.get("date")?.length ?? 0,
    date_required_count: countRequired(dimensionsByName.get("date") ?? []),
    date_covered_count: countCovered(dimensionsByName.get("date") ?? []),
    party_dimension_count: dimensionsByName.get("party")?.length ?? 0,
    party_required_count: countRequired(dimensionsByName.get("party") ?? []),
    party_covered_count: countCovered(dimensionsByName.get("party") ?? []),
    amount_dimension_count: dimensionsByName.get("amount")?.length ?? 0,
    amount_required_count: countRequired(dimensionsByName.get("amount") ?? []),
    amount_covered_count: countCovered(dimensionsByName.get("amount") ?? []),
    legal_basis_dimension_count: dimensionsByName.get("legal_basis")?.length ?? 0,
    legal_basis_covered_count: countCovered(dimensionsByName.get("legal_basis") ?? []),
    matter_preserved_score_count: coverageScores.filter((score) => score.matter_preserved).length,
    classification_preserved_score_count: coverageScores.filter((score) => score.classification_preserved).length,
    policy_snapshot_preserved_score_count: coverageScores.filter((score) => score.policy_snapshot_preserved).length,
    needs_review_score_count: coverageScores.filter((score) => score.review_status === "needs_review").length,
    not_client_facing_output_score_count: coverageScores.filter((score) => score.output_client_facing_status === "not_client_facing").length,
    client_facing_ready_score_count: coverageScores.filter((score) => score.client_facing_ready === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(coverageScores, "matter_id"),
    by_classification: countBy(coverageScores, "classification"),
    by_coverage_status: countBy(coverageScores, "coverage_status"),
    by_dimension: countBy(coverageDimensions, "dimension"),
    by_dimension_status: countBy(coverageDimensions, "coverage_status"),
  };
}

function renderEvidenceCoverageMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Coverage Score");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.evidence_coverage_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.evidence_coverage_contract_id}`);
  lines.push(`- Coverage scores: ${result.summary.coverage_score_count}`);
  lines.push(`- Coverage dimensions: ${result.summary.coverage_dimension_count}`);
  lines.push(`- Required dimensions: ${result.summary.required_dimension_count}`);
  lines.push(`- Covered required dimensions: ${result.summary.covered_required_dimension_count}`);
  lines.push(`- Missing required dimensions: ${result.summary.missing_required_dimension_count}`);
  lines.push(`- Average score: ${result.summary.average_coverage_score}`);
  lines.push(`- Claim covered: ${result.summary.claim_covered_count}/${result.summary.claim_dimension_count}`);
  lines.push(`- Date covered: ${result.summary.date_covered_count}/${result.summary.date_required_count}`);
  lines.push(`- Party covered: ${result.summary.party_covered_count}/${result.summary.party_required_count}`);
  lines.push(`- Amount covered: ${result.summary.amount_covered_count}/${result.summary.amount_required_count}`);
  lines.push(`- Legal basis covered: ${result.summary.legal_basis_covered_count}/${result.summary.legal_basis_dimension_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function countRequired(dimensions) {
  return dimensions.filter((dimension) => dimension.required).length;
}

function countCovered(dimensions) {
  return dimensions.filter((dimension) => dimension.covered).length;
}

function average(values) {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function normalizeInputs(options) {
  return {
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.lineageGraphPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.issueGraphStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.citationObjectStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_COVERAGE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-coverage-score.mjs [options]

Options:
  --lineage-graph <path>             lineage-graph.json path.
  --source-span-store <path>         source-span-store.json path.
  --evidence-item-store <path>       evidence-item-store.json path.
  --fact-claim-store <path>          fact-claim-store.json path.
  --issue-graph-store <path>         issue-graph-store.json path.
  --citation-object-store <path>     citation-object-store.json path.
  --out-dir <path>                   Output directory.
  --run-at <iso>                     Deterministic generated_at timestamp.
  --check                            Exit non-zero when validation fails.
  --no-write                         Build without writing artifacts.
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

function serializableCoverage(result) {
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

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
    return groups;
  }, new Map());
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
