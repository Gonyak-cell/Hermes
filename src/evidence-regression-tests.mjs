import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_REGRESSION_TESTS_OUT_DIR = "artifacts/evidence-regression-tests/latest";
export const DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS = {
  evidenceGoldenFixturesPath: "artifacts/evidence-golden-fixtures/latest/evidence-golden-fixtures.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  evidenceExportBundlePath: "artifacts/evidence-export-bundle/latest/evidence-export-bundle.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_REGRESSION_CONTRACT_ID = "evidence-regression-tests.v1";
const REGRESSION_CASE_SCHEMA_VERSION = "evidence-regression-test-case.v1";
const REGRESSION_HASH_SCHEMA_VERSION = "evidence-regression-hash.v1";

export async function runEvidenceRegressionTests(options = {}) {
  const result = await buildEvidenceRegressionTests(options);
  if (options.write !== false) await writeEvidenceRegressionTests(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence regression tests failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceRegressionTests(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    evidenceGoldenFixtures,
    extractorAdapterContract,
    lineageGraph,
    evidenceCoverage,
    evidenceExportBundle,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.evidence_golden_fixtures_path),
    readJson(inputs.extractor_adapter_contract_path),
    readJson(inputs.lineage_graph_path),
    readJson(inputs.evidence_coverage_path),
    readJson(inputs.evidence_export_bundle_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const extractorCases = buildExtractorRegressionCases(evidenceGoldenFixtures, extractorAdapterContract, generatedAt);
  const lineageCases = buildLineageRegressionCases(lineageGraph, generatedAt);
  const coverageCases = buildCoverageRegressionCases(evidenceCoverage, evidenceExportBundle, generatedAt);
  const regressionTestCases = [
    ...extractorCases,
    ...lineageCases,
    ...coverageCases,
  ];
  const regressionSuites = buildRegressionSuites({
    extractorCases,
    lineageCases,
    coverageCases,
    generatedAt,
  });
  const regressionHashes = regressionTestCases.map((testCase) => buildRegressionHash(testCase, generatedAt));
  const regressionIndexes = buildRegressionIndexes(regressionTestCases, generatedAt);
  const validationItems = validateEvidenceRegressionTests({
    packageText,
    roadmapText,
    evidenceGoldenFixtures,
    extractorAdapterContract,
    lineageGraph,
    evidenceCoverage,
    evidenceExportBundle,
    regressionSuites,
    regressionTestCases,
    regressionHashes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeEvidenceRegressionTests({
    evidenceGoldenFixtures,
    extractorAdapterContract,
    lineageGraph,
    evidenceCoverage,
    evidenceExportBundle,
    regressionSuites,
    regressionTestCases,
    regressionHashes,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "evidence-regression-tests.v1",
    generated_at: generatedAt,
    evidence_regression_test_suite_id: `evidence-regression-tests.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("evidence_golden_fixtures", evidenceGoldenFixtures),
      summarizeSource("extractor_adapter_contract", extractorAdapterContract),
      summarizeSource("lineage_graph_builder", lineageGraph),
      summarizeSource("evidence_coverage_score", evidenceCoverage),
      summarizeSource("evidence_export_bundle", evidenceExportBundle),
    ],
    evidence_regression_contract: buildEvidenceRegressionContract(generatedAt),
    evidence_regression_catalog: {
      schema_version: "evidence-regression-catalog.v1",
      generated_at: generatedAt,
      regression_suites: regressionSuites,
      regression_test_cases: regressionTestCases,
      regression_hashes: regressionHashes,
      regression_indexes: regressionIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceRegressionTestsMarkdown(result),
  };
}

export async function writeEvidenceRegressionTests(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableEvidenceRegressionTests(result);
  await writeJson(path.join(outDir, "evidence-regression-tests.json"), serializable);
  await writeJson(path.join(outDir, "regression-suites.json"), {
    schema_version: "evidence-regression-suites.v1",
    generated_at: result.generated_at,
    regression_suite_count: result.evidence_regression_catalog.regression_suites.length,
    regression_suites: result.evidence_regression_catalog.regression_suites,
  });
  await writeJson(path.join(outDir, "regression-test-cases.json"), {
    schema_version: "evidence-regression-test-cases.v1",
    generated_at: result.generated_at,
    regression_test_case_count: result.evidence_regression_catalog.regression_test_cases.length,
    regression_test_cases: result.evidence_regression_catalog.regression_test_cases,
  });
  await writeJson(path.join(outDir, "regression-hashes.json"), {
    schema_version: "evidence-regression-hashes.v1",
    generated_at: result.generated_at,
    regression_hash_count: result.evidence_regression_catalog.regression_hashes.length,
    regression_hashes: result.evidence_regression_catalog.regression_hashes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_regression_test_suite_id: result.evidence_regression_test_suite_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceRegressionTestsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceRegressionTests(args);
    console.log(`Evidence regression tests written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_regression_status}`);
    console.log(`Suites: ${result.summary.regression_suite_count}`);
    console.log(`Test cases: ${result.summary.regression_test_case_count}`);
    console.log(`Passed cases: ${result.summary.passed_regression_case_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildExtractorRegressionCases(evidenceGoldenFixtures, extractorAdapterContract, generatedAt) {
  const cases = evidenceGoldenFixtures.evidence_golden_fixture_catalog?.evidence_golden_cases ?? [];
  const storeMatches = new Map((evidenceGoldenFixtures.evidence_golden_fixture_catalog?.evidence_store_matches ?? [])
    .map((storeMatch) => [storeMatch.evidence_golden_case_id, storeMatch]));
  const adapterCount = extractorAdapterContract.summary?.extractor_adapter_count ?? 0;
  return cases.map((goldenCase, index) => {
    const storeMatch = storeMatches.get(goldenCase.evidence_golden_case_id) ?? goldenCase.store_match ?? {};
    const passed = goldenCase.case_status === "locked"
      && goldenCase.observed_extraction?.missing_terms?.length === 0
      && goldenCase.observed_extraction?.source_span_created === true
      && goldenCase.observed_extraction?.evidence_candidate_created === true
      && goldenCase.observed_extraction?.external_service_used === false
      && storeMatch.match_status === "matched"
      && storeMatch.source_span_bound === true
      && adapterCount > 0;
    return buildRegressionCase({
      generatedAt,
      suiteType: "extractor",
      sequence: index + 1,
      subjectId: goldenCase.evidence_golden_case_id,
      matterId: storeMatch.matter_id ?? goldenCase.matter_id ?? null,
      classification: goldenCase.expected_classification_floor,
      policySnapshotId: storeMatch.policy_snapshot_id ?? null,
      expected: {
        expected_terms: goldenCase.expected_terms ?? [],
        expected_evidence_type: goldenCase.expected_evidence_type,
        expected_claim_type: goldenCase.expected_claim_type,
        expected_classification_floor: goldenCase.expected_classification_floor,
        external_service_allowed: false,
      },
      observed: {
        case_status: goldenCase.case_status,
        matched_terms: goldenCase.observed_extraction?.matched_terms ?? [],
        missing_terms: goldenCase.observed_extraction?.missing_terms ?? [],
        source_span_created: goldenCase.observed_extraction?.source_span_created ?? false,
        evidence_candidate_created: goldenCase.observed_extraction?.evidence_candidate_created ?? false,
        external_service_used: goldenCase.observed_extraction?.external_service_used ?? null,
        store_match_status: storeMatch.match_status ?? "unknown",
        store_source_span_bound: storeMatch.source_span_bound ?? false,
        extractor_adapter_count: adapterCount,
      },
      passed,
      reviewRequired: true,
      clientFacingReady: false,
      failureReason: passed ? null : "Extractor golden case drifted from the locked fixture or store match.",
    });
  });
}

function buildLineageRegressionCases(lineageGraph, generatedAt) {
  const catalog = lineageGraph.lineage_graph_catalog ?? {};
  const paths = catalog.lineage_paths ?? [];
  const nodesById = new Map((catalog.lineage_nodes ?? []).map((node) => [node.lineage_node_id, node]));
  return paths.map((lineagePath, index) => {
    const nodes = (lineagePath.node_ids ?? []).map((nodeId) => nodesById.get(nodeId)).filter(Boolean);
    const nodeTypes = new Set(nodes.map((node) => node.node_type));
    const requiredTypes = ["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"];
    const missingNodeTypes = requiredTypes.filter((nodeType) => !nodeTypes.has(nodeType));
    const passed = lineagePath.path_status === "complete"
      && (lineagePath.edge_ids ?? []).length === 5
      && missingNodeTypes.length === 0
      && (lineagePath.citation_binding_status ?? lineagePath.metadata?.source_binding_status) === "bound"
      && Boolean(lineagePath.source_span_id)
      && Boolean(lineagePath.evidence_item_id)
      && Boolean(lineagePath.fact_id)
      && Boolean(lineagePath.issue_id)
      && Boolean(lineagePath.output_paragraph_id)
      && Boolean(lineagePath.matter_id)
      && Boolean(lineagePath.classification)
      && Boolean(lineagePath.policy_snapshot_id)
      && lineagePath.client_facing_ready === false;
    return buildRegressionCase({
      generatedAt,
      suiteType: "lineage",
      sequence: index + 1,
      subjectId: lineagePath.lineage_path_id,
      matterId: lineagePath.matter_id ?? null,
      classification: lineagePath.classification ?? null,
      policySnapshotId: lineagePath.policy_snapshot_id ?? null,
      expected: {
        path_status: "complete",
        edge_count: 5,
        required_node_types: requiredTypes,
        citation_binding_status: "bound",
        client_facing_ready: false,
      },
      observed: {
        path_status: lineagePath.path_status ?? "unknown",
        edge_count: (lineagePath.edge_ids ?? []).length,
        node_count: (lineagePath.node_ids ?? []).length,
        observed_node_types: [...nodeTypes].sort(),
        missing_node_types: missingNodeTypes,
        citation_binding_status: lineagePath.citation_binding_status ?? lineagePath.metadata?.source_binding_status ?? "unknown",
        source_span_id: lineagePath.source_span_id ?? null,
        evidence_id: lineagePath.evidence_item_id ?? null,
        fact_id: lineagePath.fact_id ?? null,
        issue_id: lineagePath.issue_id ?? null,
        output_paragraph_id: lineagePath.output_paragraph_id ?? null,
        client_facing_ready: lineagePath.client_facing_ready ?? null,
      },
      passed,
      reviewRequired: true,
      clientFacingReady: false,
      failureReason: passed ? null : "Lineage path no longer preserves the source-to-output chain.",
    });
  });
}

function buildCoverageRegressionCases(evidenceCoverage, evidenceExportBundle, generatedAt) {
  const coverageScores = evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? [];
  const bundlesByCoverageId = new Map((evidenceExportBundle.evidence_export_catalog?.export_bundles ?? [])
    .map((bundle) => [bundle.coverage_score_id, bundle]));
  return coverageScores.map((coverageScore, index) => {
    const dimensions = coverageScore.coverage_dimensions ?? [];
    const dimensionsByName = new Map(dimensions.map((dimension) => [dimension.dimension, dimension]));
    const claimDimension = dimensionsByName.get("claim");
    const legalBasisDimension = dimensionsByName.get("legal_basis");
    const bundle = bundlesByCoverageId.get(coverageScore.coverage_score_id) ?? null;
    const passed = dimensions.length === 5
      && coverageScore.covered_required_dimension_count >= 2
      && claimDimension?.covered === true
      && legalBasisDimension?.covered === true
      && coverageScore.review_status === "needs_review"
      && coverageScore.client_facing_ready === false
      && Boolean(coverageScore.matter_id)
      && Boolean(coverageScore.classification)
      && Boolean(coverageScore.policy_snapshot_id)
      && bundle?.coverage_package?.package_status === "bound"
      && bundle?.bundle_actions?.output_delivery_allowed === false;
    return buildRegressionCase({
      generatedAt,
      suiteType: "coverage",
      sequence: index + 1,
      subjectId: coverageScore.coverage_score_id,
      matterId: coverageScore.matter_id ?? null,
      classification: coverageScore.classification ?? null,
      policySnapshotId: coverageScore.policy_snapshot_id ?? null,
      expected: {
        minimum_covered_required_dimension_count: 2,
        claim_covered: true,
        legal_basis_covered: true,
        review_status: "needs_review",
        client_facing_ready: false,
        export_bundle_required: true,
      },
      observed: {
        coverage_status: coverageScore.coverage_status ?? "unknown",
        coverage_score: coverageScore.coverage_score ?? null,
        dimension_count: dimensions.length,
        required_dimension_count: coverageScore.required_dimension_count ?? 0,
        covered_required_dimension_count: coverageScore.covered_required_dimension_count ?? 0,
        claim_covered: claimDimension?.covered ?? false,
        legal_basis_covered: legalBasisDimension?.covered ?? false,
        review_status: coverageScore.review_status ?? "unknown",
        client_facing_ready: coverageScore.client_facing_ready ?? null,
        export_bundle_id: bundle?.export_bundle_id ?? null,
        export_bundle_status: bundle?.bundle_status ?? "missing",
        output_delivery_allowed: bundle?.bundle_actions?.output_delivery_allowed ?? null,
      },
      passed,
      reviewRequired: true,
      clientFacingReady: false,
      failureReason: passed ? null : "Coverage score no longer satisfies the required dimension or export-bundle regression guard.",
    });
  });
}

function buildRegressionCase({
  generatedAt,
  suiteType,
  sequence,
  subjectId,
  matterId,
  classification,
  policySnapshotId,
  expected,
  observed,
  passed,
  reviewRequired,
  clientFacingReady,
  failureReason,
}) {
  const testCase = {
    schema_version: REGRESSION_CASE_SCHEMA_VERSION,
    regression_test_case_id: `evidence-regression-case.${suiteType}.${String(sequence).padStart(4, "0")}.${slugify(subjectId)}`,
    suite_id: `evidence-regression-suite.${suiteType}`,
    suite_type: suiteType,
    subject_id: subjectId,
    matter_id: matterId ?? null,
    classification: classification ?? null,
    policy_snapshot_id: policySnapshotId ?? null,
    expected,
    observed,
    status: passed ? "passed" : "failed",
    failure_reason: failureReason,
    human_review_required: reviewRequired,
    client_facing_ready: clientFacingReady,
    external_service_used: Boolean(observed.external_service_used),
    generated_at: generatedAt,
  };
  return {
    ...testCase,
    regression_hash: sha256({
      suite_type: testCase.suite_type,
      subject_id: testCase.subject_id,
      expected: testCase.expected,
      observed: testCase.observed,
      status: testCase.status,
    }),
  };
}

function buildRegressionSuites({ extractorCases, lineageCases, coverageCases, generatedAt }) {
  return [
    suite("extractor", "Extractor Golden Fixture Regression", extractorCases, generatedAt),
    suite("lineage", "Lineage Graph Regression", lineageCases, generatedAt),
    suite("coverage", "Evidence Coverage Regression", coverageCases, generatedAt),
  ];
}

function suite(suiteType, label, cases, generatedAt) {
  return {
    schema_version: "evidence-regression-suite.v1",
    regression_suite_id: `evidence-regression-suite.${suiteType}`,
    suite_type: suiteType,
    label,
    generated_at: generatedAt,
    suite_status: cases.length > 0 && cases.every((testCase) => testCase.status === "passed") ? "passed" : "failed",
    test_case_count: cases.length,
    passed_case_count: cases.filter((testCase) => testCase.status === "passed").length,
    failed_case_count: cases.filter((testCase) => testCase.status !== "passed").length,
    regression_hash_count: cases.filter((testCase) => testCase.regression_hash).length,
  };
}

function buildRegressionHash(testCase, generatedAt) {
  return {
    schema_version: REGRESSION_HASH_SCHEMA_VERSION,
    regression_hash_id: `evidence-regression-hash.${slugify(testCase.regression_test_case_id)}`,
    regression_test_case_id: testCase.regression_test_case_id,
    suite_id: testCase.suite_id,
    suite_type: testCase.suite_type,
    subject_id: testCase.subject_id,
    regression_hash: testCase.regression_hash,
    hash_algorithm: "sha256",
    locked: testCase.status === "passed",
    generated_at: generatedAt,
  };
}

function buildRegressionIndexes(testCases, generatedAt) {
  return {
    schema_version: "evidence-regression-indexes.v1",
    generated_at: generatedAt,
    by_suite_type: countBy(testCases, "suite_type"),
    by_status: countBy(testCases, "status"),
    by_matter_id: countBy(testCases, "matter_id"),
    by_classification: countBy(testCases, "classification"),
  };
}

function buildEvidenceRegressionContract(generatedAt) {
  return {
    schema_version: "evidence-regression-contract.v1",
    evidence_regression_contract_id: EVIDENCE_REGRESSION_CONTRACT_ID,
    generated_at: generatedAt,
    regression_case_schema_version: REGRESSION_CASE_SCHEMA_VERSION,
    regression_hash_schema_version: REGRESSION_HASH_SCHEMA_VERSION,
    source_inputs: [
      "evidence-golden-fixtures.v1",
      "extractor-adapter-contract.v1",
      "lineage-graph-builder.v1",
      "evidence-coverage-score.v1",
      "evidence-export-bundle.v1",
    ],
    required_suites: ["extractor", "lineage", "coverage"],
    gate_rule: "all extractor, lineage, and coverage regression cases must pass before the Evidence Plane can freeze.",
    safety_rule: "regression tests are deterministic, local, read-only, and do not authorize client-facing output.",
    api_routes: [
      "/api/evidence-regression-tests",
      "/api/evidence-regression-suites",
      "/api/evidence-regression-test-cases",
      "/api/evidence-regression-hashes",
      "/api/evidence-regression-validations",
    ],
  };
}

function validateEvidenceRegressionTests({
  packageText,
  roadmapText,
  evidenceGoldenFixtures,
  extractorAdapterContract,
  lineageGraph,
  evidenceCoverage,
  evidenceExportBundle,
  regressionSuites,
  regressionTestCases,
  regressionHashes,
}) {
  const items = [];
  const extractorCount = evidenceGoldenFixtures.summary?.evidence_golden_case_count ?? 0;
  const lineageCount = lineageGraph.summary?.lineage_path_count ?? 0;
  const coverageCount = evidenceCoverage.summary?.coverage_score_count ?? 0;
  const exportBundleCount = evidenceExportBundle.summary?.export_bundle_count ?? 0;
  const expectedCaseCount = extractorCount + lineageCount + coverageCount;
  pushCheck(items, "package_json", "evidence_regression_script_registered", String(packageText).includes("\"evidence:regression-tests\""), "package.json must expose npm run evidence:regression-tests.");
  pushCheck(items, "roadmap", "phase_156_documented", String(roadmapText).includes("## Phase 156: Evidence Regression Tests"), "Roadmap must document Phase 156.");
  pushCheck(items, "evidence_golden_fixtures", "golden_fixtures_complete", evidenceGoldenFixtures.summary?.evidence_golden_fixture_status === "complete", "Evidence golden fixtures must be complete.");
  pushCheck(items, "extractor_adapter_contract", "extractor_contract_complete", extractorAdapterContract.summary?.extractor_adapter_contract_status === "complete", "Extractor Adapter Contract must be complete.");
  pushCheck(items, "lineage_graph_builder", "lineage_graph_complete", lineageGraph.summary?.lineage_graph_status === "complete", "Lineage Graph Builder must be complete.");
  pushCheck(items, "evidence_coverage_score", "coverage_complete", evidenceCoverage.summary?.evidence_coverage_status === "complete", "Evidence Coverage Score must be complete.");
  pushCheck(items, "evidence_export_bundle", "export_bundle_complete", evidenceExportBundle.summary?.evidence_export_bundle_status === "complete", "Evidence Export Bundle must be complete.");
  pushCheck(items, "regression_suites", "required_suites_present", regressionSuites.length === 3 && ["extractor", "lineage", "coverage"].every((suiteType) => regressionSuites.some((suiteItem) => suiteItem.suite_type === suiteType)), "Extractor, lineage, and coverage regression suites must be present.");
  pushCheck(items, "regression_test_cases", "test_cases_cover_inputs", regressionTestCases.length === expectedCaseCount && expectedCaseCount > 0, "Regression cases must cover golden extractor cases, lineage paths, and coverage scores.");
  pushCheck(items, "regression_test_cases", "all_cases_passed", regressionTestCases.every((testCase) => testCase.status === "passed"), "Every evidence regression test case must pass.");
  pushCheck(items, "regression_hashes", "hashes_cover_cases", regressionHashes.length === regressionTestCases.length && regressionHashes.every((hash) => hash.regression_hash?.startsWith("sha256:")), "Every regression case must have a locked sha256 hash.");
  pushCheck(items, "extractor_suite", "extractor_cases_cover_golden_fixtures", countBy(regressionTestCases, "suite_type").extractor === extractorCount, "Extractor suite must cover every golden fixture.");
  pushCheck(items, "lineage_suite", "lineage_cases_cover_lineage_paths", countBy(regressionTestCases, "suite_type").lineage === lineageCount, "Lineage suite must cover every lineage path.");
  pushCheck(items, "coverage_suite", "coverage_cases_cover_scores", countBy(regressionTestCases, "suite_type").coverage === coverageCount, "Coverage suite must cover every coverage score.");
  pushCheck(items, "coverage_suite", "coverage_cases_export_backed", exportBundleCount === coverageCount && regressionTestCases.filter((testCase) => testCase.suite_type === "coverage").every((testCase) => testCase.observed.export_bundle_id), "Coverage regression cases must be backed by export bundles.");
  pushCheck(items, "regression_test_cases", "identity_preserved", regressionTestCases.filter((testCase) => testCase.suite_type !== "extractor").every((testCase) => testCase.matter_id && testCase.classification && testCase.policy_snapshot_id), "Lineage and coverage regression cases must preserve matter, classification, and policy snapshot.");
  pushCheck(items, "regression_test_cases", "no_external_service_used", regressionTestCases.every((testCase) => testCase.external_service_used === false), "Evidence regression tests must not depend on external services.");
  pushCheck(items, "regression_test_cases", "client_facing_blocked", regressionTestCases.every((testCase) => testCase.client_facing_ready === false), "Regression fixtures must not become client-facing output.");
  return items;
}

function summarizeEvidenceRegressionTests({
  evidenceGoldenFixtures,
  extractorAdapterContract,
  lineageGraph,
  evidenceCoverage,
  evidenceExportBundle,
  regressionSuites,
  regressionTestCases,
  regressionHashes,
  validationItems,
  validation,
}) {
  return {
    evidence_regression_status: validation.valid ? "complete" : "blocked",
    evidence_regression_contract_id: EVIDENCE_REGRESSION_CONTRACT_ID,
    evidence_golden_fixture_status: evidenceGoldenFixtures.summary?.evidence_golden_fixture_status ?? "unknown",
    extractor_adapter_contract_status: extractorAdapterContract.summary?.extractor_adapter_contract_status ?? "unknown",
    lineage_graph_status: lineageGraph.summary?.lineage_graph_status ?? "unknown",
    evidence_coverage_status: evidenceCoverage.summary?.evidence_coverage_status ?? "unknown",
    evidence_export_bundle_status: evidenceExportBundle.summary?.evidence_export_bundle_status ?? "unknown",
    regression_suite_count: regressionSuites.length,
    passed_regression_suite_count: regressionSuites.filter((suiteItem) => suiteItem.suite_status === "passed").length,
    failed_regression_suite_count: regressionSuites.filter((suiteItem) => suiteItem.suite_status !== "passed").length,
    regression_test_case_count: regressionTestCases.length,
    passed_regression_case_count: regressionTestCases.filter((testCase) => testCase.status === "passed").length,
    failed_regression_case_count: regressionTestCases.filter((testCase) => testCase.status !== "passed").length,
    extractor_regression_case_count: regressionTestCases.filter((testCase) => testCase.suite_type === "extractor").length,
    lineage_regression_case_count: regressionTestCases.filter((testCase) => testCase.suite_type === "lineage").length,
    coverage_regression_case_count: regressionTestCases.filter((testCase) => testCase.suite_type === "coverage").length,
    expected_extractor_case_count: evidenceGoldenFixtures.summary?.evidence_golden_case_count ?? 0,
    expected_lineage_case_count: lineageGraph.summary?.lineage_path_count ?? 0,
    expected_coverage_case_count: evidenceCoverage.summary?.coverage_score_count ?? 0,
    export_backed_coverage_case_count: regressionTestCases.filter((testCase) => testCase.suite_type === "coverage" && testCase.observed.export_bundle_id).length,
    identity_preserved_case_count: regressionTestCases.filter((testCase) => testCase.suite_type === "extractor" || (testCase.matter_id && testCase.classification && testCase.policy_snapshot_id)).length,
    human_review_required_case_count: regressionTestCases.filter((testCase) => testCase.human_review_required === true).length,
    client_facing_ready_case_count: regressionTestCases.filter((testCase) => testCase.client_facing_ready === true).length,
    external_service_used_case_count: regressionTestCases.filter((testCase) => testCase.external_service_used === true).length,
    regression_hash_count: regressionHashes.length,
    locked_regression_hash_count: regressionHashes.filter((hash) => hash.locked === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_suite_type: countBy(regressionTestCases, "suite_type"),
    by_status: countBy(regressionTestCases, "status"),
    by_matter_id: countBy(regressionTestCases, "matter_id"),
    by_classification: countBy(regressionTestCases, "classification"),
  };
}

function summarizeSource(sourceId, artifact) {
  return {
    source_id: sourceId,
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    summary: artifact.summary ?? null,
  };
}

function serializableEvidenceRegressionTests(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderEvidenceRegressionTestsMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Regression Tests");
  lines.push("");
  lines.push(`Status: ${result.summary.evidence_regression_status}`);
  lines.push(`Contract: ${result.summary.evidence_regression_contract_id}`);
  lines.push(`Suites: ${result.summary.regression_suite_count}`);
  lines.push(`Test cases: ${result.summary.regression_test_case_count}`);
  lines.push(`Passed cases: ${result.summary.passed_regression_case_count}`);
  lines.push(`Regression hashes: ${result.summary.regression_hash_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Suites");
  for (const suiteItem of result.evidence_regression_catalog.regression_suites) {
    lines.push(`- ${suiteItem.label}: ${suiteItem.suite_status} (${suiteItem.passed_case_count}/${suiteItem.test_case_count})`);
  }
  lines.push("");
  lines.push("## Routes");
  for (const route of result.evidence_regression_contract.api_routes) {
    lines.push(`- ${route}`);
  }
  return `${lines.join("\n")}\n`;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.subject_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    schema_version: "validation-item.v1",
    validation_id: `evidence-regression-tests.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--evidence-golden-fixtures") parsed.evidenceGoldenFixturesPath = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
    else if (arg === "--evidence-export-bundle") parsed.evidenceExportBundlePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/evidence-regression-tests.mjs [options]

Options:
  --check                              Exit non-zero when validation fails.
  --out-dir <path>                     Output directory.
  --evidence-golden-fixtures <path>    evidence-golden-fixtures.json path.
  --extractor-adapter-contract <path>  extractor-adapter-contract.json path.
  --lineage-graph <path>               lineage-graph.json path.
  --evidence-coverage <path>           evidence-coverage-score.json path.
  --evidence-export-bundle <path>      evidence-export-bundle.json path.
  --run-at <iso>                       Override generated_at.
  --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    evidence_golden_fixtures_path: path.resolve(options.evidenceGoldenFixturesPath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.evidenceGoldenFixturesPath),
    extractor_adapter_contract_path: path.resolve(options.extractorAdapterContractPath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.extractorAdapterContractPath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.lineageGraphPath),
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.evidenceCoveragePath),
    evidence_export_bundle_path: path.resolve(options.evidenceExportBundlePath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.evidenceExportBundlePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_REGRESSION_TESTS_INPUTS.roadmapPath),
  };
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

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
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
