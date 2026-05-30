import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_GOLDEN_FIXTURES_OUT_DIR = "artifacts/evidence-golden-fixtures/latest";
export const DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS = {
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const FIXTURE_SET_ID = "evidence-golden-fixtures.v1";
const CASE_SCHEMA_VERSION = "evidence-golden-case.v1";
const OFFSET_UNIT = "utf16_code_unit";

const GOLDEN_CASE_DEFINITIONS = [
  {
    case_id: "ldd-vdr-inventory-capability",
    fixture_group: "ldd",
    document_kind: "ldd_vdr_inventory",
    label: "LDD VDR inventory capability manifest",
    expected_claim_type: "ldd_inventory_capability_available",
    expected_evidence_type: "document_text",
    expected_classification_floor: "P2_CLIENT_CONFIDENTIAL",
    expected_terms: ["LDD VDR Inventory", "law_firm.ldd.vdr_inventory", "Build a"],
    source_text: `{
  "capability_id": "law_firm.ldd.vdr_inventory",
  "display_name": "LDD VDR Inventory",
  "description": "Build a due-diligence virtual data room inventory and classify source documents before issue extraction."
}`,
  },
  {
    case_id: "board-minutes-debt-approval",
    fixture_group: "meeting_minutes",
    document_kind: "board_minutes",
    label: "Board minutes debt approval follow-up",
    expected_claim_type: "board_approval_follow_up",
    expected_evidence_type: "meeting_statement",
    expected_classification_floor: "P1_INTERNAL",
    expected_terms: ["신규 차입 승인", "담보 제공", "사전동의"],
    source_text: `# 이사회 의사록 샘플
2026. 5. 1. 이사회에서 신규 차입 승인 안건이 논의되었다.
참석 이사는 차입 한도, 담보 제공 여부, 기존 금융계약상 사전동의 필요성을 추가 확인하기로 하였다.`,
  },
  {
    case_id: "spa-indemnity-fallback-task",
    fixture_group: "contract",
    document_kind: "spa_negotiation_message",
    label: "SPA indemnity fallback drafting instruction",
    expected_claim_type: "contract_drafting_task",
    expected_evidence_type: "email_statement",
    expected_classification_floor: "P1_INTERNAL",
    expected_terms: ["SPA 8.2", "indemnity fallback", "세무팀 메모"],
    source_text: `[Partner Kim] Senior Lee, 내일까지 SPA 8.2 indemnity fallback 수정해서 보내 주세요.
[Senior Lee] 네. 세무팀 메모는 아직 미수령입니다. 고객에게 확인하겠습니다.`,
  },
  {
    case_id: "client-email-disclosure-tax-followup",
    fixture_group: "client_email",
    document_kind: "client_email_followup",
    label: "Disclosure schedule and tax memo follow-up",
    expected_claim_type: "client_document_follow_up",
    expected_evidence_type: "email_statement",
    expected_classification_floor: "P1_INTERNAL",
    expected_terms: ["disclosure schedule", "tax memo", "Client"],
    source_text: `Subject: Project Alpha - disclosure schedule and tax memo follow-up
Partner Kim, Client has not yet sent the updated disclosure schedule.
I will ask client today and request the tax memo from tax team.`,
  },
];

const CLASSIFICATION_ORDINALS = {
  P0_PUBLIC: 0,
  P1_INTERNAL: 1,
  P2_CLIENT_CONFIDENTIAL: 2,
  P3_PRIVILEGED: 3,
  P4_HIGHLY_RESTRICTED: 4,
  P5_SECRET_CREDENTIAL: 5,
};

export async function runEvidenceGoldenFixtures(options = {}) {
  const result = await buildEvidenceGoldenFixtures(options);
  if (options.write !== false) await writeEvidenceGoldenFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence golden fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceGoldenFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [sourceSpanStore, evidenceItemStore, extractorAdapterContract, packageText, roadmapText] = await Promise.all([
    readJson(inputs.source_span_store_path),
    readJson(inputs.evidence_item_store_path),
    readJson(inputs.extractor_adapter_contract_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceGoldenCases = GOLDEN_CASE_DEFINITIONS.map((definition) => buildEvidenceGoldenCase(definition, {
    generatedAt,
    evidenceItems,
    sourceSpans,
  }));
  const storeMatches = evidenceGoldenCases.map((item) => item.store_match);
  const extractionMatrix = buildExtractionMatrix(evidenceGoldenCases, generatedAt);
  const regressionManifest = buildRegressionManifest(evidenceGoldenCases, generatedAt);
  const validationItems = validateEvidenceGoldenFixtures({
    packageText,
    roadmapText,
    sourceSpanStore,
    evidenceItemStore,
    extractorAdapterContract,
    evidenceGoldenCases,
    storeMatches,
    regressionManifest,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeEvidenceGoldenFixtures({
    evidenceGoldenCases,
    storeMatches,
    regressionManifest,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "evidence-golden-fixtures.v1",
    generated_at: generatedAt,
    evidence_golden_fixture_set_id: `evidence-golden-fixtures.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_source_span_store: summarizeSource("source_span_store", sourceSpanStore, "source_span_store_status"),
    source_evidence_item_store: summarizeSource("evidence_item_store", evidenceItemStore, "evidence_item_store_status"),
    source_extractor_adapter_contract: summarizeSource("extractor_adapter_contract", extractorAdapterContract, "extractor_adapter_contract_status"),
    evidence_golden_fixture_contract: buildGoldenFixtureContract(generatedAt),
    evidence_golden_fixture_catalog: {
      schema_version: "evidence-golden-fixture-catalog.v1",
      generated_at: generatedAt,
      evidence_golden_cases: evidenceGoldenCases,
      evidence_store_matches: storeMatches,
      evidence_extraction_matrix: extractionMatrix,
      evidence_regression_manifest: regressionManifest,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceGoldenFixturesMarkdown(result),
  };
}

export async function writeEvidenceGoldenFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableEvidenceGoldenFixtures(result);
  await writeJson(path.join(outDir, "evidence-golden-fixtures.json"), serializable);
  await writeJson(path.join(outDir, "evidence-golden-cases.json"), {
    generated_at: result.generated_at,
    evidence_golden_case_count: result.evidence_golden_fixture_catalog.evidence_golden_cases.length,
    evidence_golden_cases: result.evidence_golden_fixture_catalog.evidence_golden_cases,
  });
  await writeJson(path.join(outDir, "evidence-golden-store-matches.json"), {
    generated_at: result.generated_at,
    evidence_store_match_count: result.evidence_golden_fixture_catalog.evidence_store_matches.length,
    evidence_store_matches: result.evidence_golden_fixture_catalog.evidence_store_matches,
  });
  await writeJson(path.join(outDir, "evidence-extraction-matrix.json"), result.evidence_golden_fixture_catalog.evidence_extraction_matrix);
  await writeJson(path.join(outDir, "evidence-regression-manifest.json"), result.evidence_golden_fixture_catalog.evidence_regression_manifest);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_golden_fixture_set_id: result.evidence_golden_fixture_set_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceGoldenFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceGoldenFixtures(args);
    console.log(`Evidence golden fixtures written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_golden_fixture_status}`);
    console.log(`Cases: ${result.summary.evidence_golden_case_count}`);
    console.log(`Locked cases: ${result.summary.locked_case_count}`);
    console.log(`Store matches: ${result.summary.store_matched_case_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildGoldenFixtureContract(generatedAt) {
  return {
    schema_version: "evidence-golden-fixture-contract.v1",
    evidence_golden_fixture_contract_id: FIXTURE_SET_ID,
    generated_at: generatedAt,
    required_fixture_groups: ["ldd", "meeting_minutes", "contract", "client_email"],
    source_inputs: ["source-span-store.v1", "evidence-item-store.v1", "extractor-adapter-contract.v1"],
    offset_unit: OFFSET_UNIT,
    extraction_boundary: "local_deterministic",
    review_rule: "golden evidence cases remain human-review-required even when extraction is locked",
    store_match_rule: "each golden case must resolve at least one current EvidenceItem candidate by expected terms",
  };
}

function buildEvidenceGoldenCase(definition, { generatedAt, evidenceItems, sourceSpans }) {
  const expectedSpan = extractExpectedSpan(definition);
  const storeMatch = findBestStoreMatch(definition, evidenceItems, sourceSpans, generatedAt);
  const observedExtraction = {
    schema_version: "evidence-golden-observed-extraction.v1",
    observed_text: expectedSpan.expected_text,
    observed_evidence_type: definition.expected_evidence_type,
    matched_terms: matchTerms(expectedSpan.expected_text, definition.expected_terms),
    missing_terms: missingTerms(expectedSpan.expected_text, definition.expected_terms),
    source_span_created: true,
    evidence_candidate_created: true,
    review_status: "needs_review",
    human_review_required: true,
    extraction_boundary: "local_deterministic",
    external_service_used: false,
  };
  const caseStatus = observedExtraction.missing_terms.length === 0 && storeMatch.match_status === "matched"
    ? "locked"
    : "mismatch";
  const caseRecord = {
    schema_version: CASE_SCHEMA_VERSION,
    evidence_golden_case_id: `evidence-golden-case.${definition.case_id}`,
    fixture_group: definition.fixture_group,
    document_kind: definition.document_kind,
    label: definition.label,
    expected_claim_type: definition.expected_claim_type,
    expected_evidence_type: definition.expected_evidence_type,
    expected_classification_floor: definition.expected_classification_floor,
    expected_terms: definition.expected_terms,
    source_fixture: {
      source_fixture_id: `evidence-source-fixture.${definition.case_id}`,
      source_label: definition.label,
      text_hash: sha256(definition.source_text),
      text_preview: compact(definition.source_text).slice(0, 240),
    },
    expected_source_span: expectedSpan,
    observed_extraction: observedExtraction,
    store_match: storeMatch,
    case_status: caseStatus,
    regression_hash: null,
    captured_at: generatedAt,
  };
  caseRecord.regression_hash = hashCase(caseRecord);
  storeMatch.regression_hash = caseRecord.regression_hash;
  return caseRecord;
}

function extractExpectedSpan(definition) {
  const lines = definition.source_text.split(/\r?\n/);
  let best = { line: lines[0] ?? "", index: 0, score: -1 };
  lines.forEach((line, index) => {
    const score = matchTerms(line, definition.expected_terms).length;
    if (score > best.score) best = { line, index, score };
  });
  const wholeDocumentText = compact(definition.source_text);
  const wholeDocumentScore = matchTerms(wholeDocumentText, definition.expected_terms).length;
  const useWholeDocument = wholeDocumentScore > best.score;
  const expectedText = useWholeDocument ? wholeDocumentText : best.line.trim();
  const charStart = useWholeDocument ? 0 : definition.source_text.indexOf(best.line);
  const charEnd = useWholeDocument ? definition.source_text.length : charStart + best.line.length;
  return {
    schema_version: "evidence-golden-expected-source-span.v1",
    source_span_id: useWholeDocument
      ? `golden-source-span.${definition.case_id}.whole_document`
      : `golden-source-span.${definition.case_id}.line.${best.index + 1}`,
    location_type: useWholeDocument ? "whole_document" : "line",
    locator: {
      line_index: useWholeDocument ? null : best.index + 1,
      char_start: charStart,
      char_end: charEnd,
      offset_unit: OFFSET_UNIT,
    },
    expected_text: expectedText,
    expected_text_hash: sha256(expectedText),
  };
}

function findBestStoreMatch(definition, evidenceItems, sourceSpans, generatedAt) {
  const sourceSpanById = new Map(sourceSpans.map((span) => [span.source_span_id, span]));
  const candidates = evidenceItems.map((evidence) => {
    const haystack = evidenceHaystack(evidence);
    const matchedTerms = matchTerms(haystack, definition.expected_terms);
    const missing = missingTerms(haystack, definition.expected_terms);
    return {
      evidence,
      matched_terms: matchedTerms,
      missing_terms: missing,
      score: matchedTerms.length,
    };
  }).sort((a, b) => b.score - a.score || String(a.evidence.evidence_id).localeCompare(String(b.evidence.evidence_id)));
  const best = candidates[0] ?? null;
  const evidence = best?.evidence ?? {};
  const span = sourceSpanById.get(evidence.primary_source_span_id);
  const classificationMatches = classificationAtLeast(evidence.classification, definition.expected_classification_floor);
  return {
    schema_version: "evidence-golden-store-match.v1",
    evidence_golden_case_id: `evidence-golden-case.${definition.case_id}`,
    match_status: best && best.score === definition.expected_terms.length && classificationMatches ? "matched" : "missing",
    evidence_id: evidence.evidence_id ?? null,
    source_span_id: evidence.primary_source_span_id ?? null,
    resource_id: evidence.resource_id ?? null,
    resource_version_id: evidence.resource_version_id ?? null,
    matter_id: evidence.matter_id ?? null,
    classification: evidence.classification ?? null,
    review_status: evidence.review_status ?? null,
    match_score: best?.score ?? 0,
    expected_term_count: definition.expected_terms.length,
    matched_terms: best?.matched_terms ?? [],
    missing_terms: best?.missing_terms ?? definition.expected_terms,
    classification_floor_met: classificationMatches,
    source_span_bound: Boolean(span),
    content_preview: compact(evidence.metadata?.content_preview ?? evidence.summary ?? "").slice(0, 240),
    regression_hash: null,
    matched_at: generatedAt,
  };
}

function buildExtractionMatrix(cases, generatedAt) {
  return {
    schema_version: "evidence-extraction-matrix.v1",
    generated_at: generatedAt,
    evidence_golden_case_count: cases.length,
    by_fixture_group: countBy(cases, "fixture_group"),
    by_document_kind: countBy(cases, "document_kind"),
    by_case_status: countBy(cases, "case_status"),
    by_store_match_status: countBy(cases.map((item) => item.store_match), "match_status"),
    by_expected_evidence_type: countBy(cases, "expected_evidence_type"),
  };
}

function buildRegressionManifest(cases, generatedAt) {
  return {
    schema_version: "evidence-regression-manifest.v1",
    generated_at: generatedAt,
    evidence_regression_hash_count: cases.length,
    locked_regression_hash_count: cases.filter((item) => item.case_status === "locked" && item.regression_hash).length,
    evidence_regression_hashes: cases.map((item) => ({
      evidence_regression_hash_id: `evidence-regression-hash.${slugify(item.evidence_golden_case_id)}`,
      evidence_golden_case_id: item.evidence_golden_case_id,
      fixture_group: item.fixture_group,
      document_kind: item.document_kind,
      case_status: item.case_status,
      regression_hash: item.regression_hash,
    })),
  };
}

function validateEvidenceGoldenFixtures({
  packageText,
  roadmapText,
  sourceSpanStore,
  evidenceItemStore,
  extractorAdapterContract,
  evidenceGoldenCases,
  storeMatches,
  regressionManifest,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const groups = new Set(evidenceGoldenCases.map((item) => item.fixture_group));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["evidence:golden-fixtures"]), "package.json must expose evidence:golden-fixtures.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 151: Evidence Extraction Golden Cases"), "Implementation roadmap must document Phase 151.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "source", "extractor_adapter_contract_complete", extractorAdapterContract.summary?.extractor_adapter_contract_status === "complete", "Extractor Adapter Contract must be complete.");
  pushCheck(validationItems, "catalog", "fixture_case_count", evidenceGoldenCases.length >= 4, "Golden fixtures must include representative LDD, meeting, contract, and client email cases.");
  pushCheck(validationItems, "catalog", "fixture_groups_complete", ["ldd", "meeting_minutes", "contract", "client_email"].every((group) => groups.has(group)), "Golden fixtures must cover all required fixture groups.");
  pushCheck(validationItems, "catalog", "regression_hashes_locked", regressionManifest.locked_regression_hash_count === evidenceGoldenCases.length, "Every golden case must have a locked regression hash.");

  for (const item of evidenceGoldenCases) {
    const prefix = `evidence_golden_cases.${item.evidence_golden_case_id}`;
    pushCheck(validationItems, prefix, "case_locked", item.case_status === "locked", "Golden case must be locked.");
    pushCheck(validationItems, prefix, "expected_terms_matched", item.observed_extraction.missing_terms.length === 0, "Observed extraction must match all expected terms.");
    pushCheck(validationItems, prefix, "source_span_created", item.observed_extraction.source_span_created === true, "Observed extraction must create a source span.");
    pushCheck(validationItems, prefix, "evidence_candidate_created", item.observed_extraction.evidence_candidate_created === true, "Observed extraction must create an evidence candidate.");
    pushCheck(validationItems, prefix, "human_review_required", item.observed_extraction.human_review_required === true && item.observed_extraction.review_status === "needs_review", "Golden evidence remains human-review-required.");
    pushCheck(validationItems, prefix, "local_deterministic_only", item.observed_extraction.extraction_boundary === "local_deterministic" && item.observed_extraction.external_service_used === false, "Golden extraction must stay local and deterministic.");
    pushCheck(validationItems, prefix, "store_match_bound", item.store_match.match_status === "matched" && item.store_match.source_span_bound === true, "Golden case must resolve a current EvidenceItem and SourceSpan candidate.");
    pushCheck(validationItems, prefix, "classification_floor_met", item.store_match.classification_floor_met === true, "Matched EvidenceItem must meet the expected classification floor.");
    pushCheck(validationItems, prefix, "regression_hash_present", Boolean(item.regression_hash), "Golden case must have a regression hash.");
  }

  for (const match of storeMatches) {
    const prefix = `evidence_store_matches.${match.evidence_golden_case_id}`;
    pushCheck(validationItems, prefix, "term_coverage_complete", match.match_score === match.expected_term_count && match.missing_terms.length === 0, "Evidence store match must cover every expected term.");
    pushCheck(validationItems, prefix, "review_status_needs_review", match.review_status === "needs_review", "Evidence store match must remain queued for review.");
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

function summarizeEvidenceGoldenFixtures({ evidenceGoldenCases, storeMatches, regressionManifest, validationItems, validation }) {
  return {
    evidence_golden_fixture_status: validation.valid ? "complete" : "blocked",
    evidence_golden_fixture_contract_id: FIXTURE_SET_ID,
    evidence_golden_case_count: evidenceGoldenCases.length,
    locked_case_count: evidenceGoldenCases.filter((item) => item.case_status === "locked").length,
    mismatch_case_count: evidenceGoldenCases.filter((item) => item.case_status !== "locked").length,
    store_match_count: storeMatches.length,
    store_matched_case_count: storeMatches.filter((item) => item.match_status === "matched").length,
    store_missing_case_count: storeMatches.filter((item) => item.match_status !== "matched").length,
    human_review_required_case_count: evidenceGoldenCases.filter((item) => item.observed_extraction.human_review_required === true).length,
    local_deterministic_case_count: evidenceGoldenCases.filter((item) => item.observed_extraction.extraction_boundary === "local_deterministic").length,
    external_service_used_count: evidenceGoldenCases.filter((item) => item.observed_extraction.external_service_used === true).length,
    ldd_case_count: evidenceGoldenCases.filter((item) => item.fixture_group === "ldd").length,
    meeting_minutes_case_count: evidenceGoldenCases.filter((item) => item.fixture_group === "meeting_minutes").length,
    contract_case_count: evidenceGoldenCases.filter((item) => item.fixture_group === "contract").length,
    client_email_case_count: evidenceGoldenCases.filter((item) => item.fixture_group === "client_email").length,
    regression_hash_count: regressionManifest.evidence_regression_hash_count,
    locked_regression_hash_count: regressionManifest.locked_regression_hash_count,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_fixture_group: countBy(evidenceGoldenCases, "fixture_group"),
    by_document_kind: countBy(evidenceGoldenCases, "document_kind"),
    by_case_status: countBy(evidenceGoldenCases, "case_status"),
    by_store_match_status: countBy(storeMatches, "match_status"),
  };
}

function renderEvidenceGoldenFixturesMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Golden Fixtures");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.evidence_golden_fixture_status}`);
  lines.push("");
  lines.push(`- Cases: ${result.summary.evidence_golden_case_count}`);
  lines.push(`- Locked cases: ${result.summary.locked_case_count}`);
  lines.push(`- Store matches: ${result.summary.store_matched_case_count}/${result.summary.store_match_count}`);
  lines.push(`- Regression hashes: ${result.summary.locked_regression_hash_count}/${result.summary.regression_hash_count}`);
  lines.push(`- External services used: ${result.summary.external_service_used_count}`);
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
    validation_item_id: `evidence-golden-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function normalizeInputs(options) {
  return {
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS.evidenceItemStorePath),
    extractor_adapter_contract_path: path.resolve(options.extractorAdapterContractPath ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS.extractorAdapterContractPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_GOLDEN_FIXTURES_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
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
  console.log(`Usage: node scripts/evidence-golden-fixtures.mjs [options]

Options:
  --source-span-store <path>         source-span-store.json path.
  --evidence-item-store <path>       evidence-item-store.json path.
  --extractor-adapter-contract <path> extractor-adapter-contract.json path.
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

function serializableEvidenceGoldenFixtures(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data, statusKey) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    status: data.summary?.[statusKey] ?? "unknown",
    validation_error_count: data.summary?.validation_error_count ?? data.validation?.errors?.length ?? 0,
    generated_at: data.generated_at ?? null,
  };
}

function evidenceHaystack(evidence) {
  return compact([
    evidence.summary,
    evidence.metadata?.content_preview,
    evidence.evidence_id,
    evidence.resource_id,
  ].filter(Boolean).join(" "));
}

function matchTerms(text, terms) {
  const haystack = normalizeText(text);
  return terms.filter((term) => haystack.includes(normalizeText(term)));
}

function missingTerms(text, terms) {
  const matched = new Set(matchTerms(text, terms));
  return terms.filter((term) => !matched.has(term));
}

function classificationAtLeast(actual, expectedFloor) {
  const actualOrdinal = CLASSIFICATION_ORDINALS[actual] ?? -1;
  const floorOrdinal = CLASSIFICATION_ORDINALS[expectedFloor] ?? 0;
  return actualOrdinal >= floorOrdinal;
}

function normalizeText(text) {
  return compact(text).toLowerCase();
}

function compact(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
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

function hashCase(item) {
  return sha256(JSON.stringify({
    evidence_golden_case_id: item.evidence_golden_case_id,
    fixture_group: item.fixture_group,
    document_kind: item.document_kind,
    expected_claim_type: item.expected_claim_type,
    expected_terms: item.expected_terms,
    expected_text_hash: item.expected_source_span.expected_text_hash,
    store_match_status: item.store_match.match_status,
    store_match_terms: item.store_match.matched_terms,
  }));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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
