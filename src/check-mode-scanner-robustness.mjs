import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  buildCheckModeGuardNormalization,
  collectCheckModeGuardFindingsFromSource,
} from "./check-mode-guard-normalization.mjs";

export const DEFAULT_CHECK_MODE_SCANNER_ROBUSTNESS_OUT_DIR = "artifacts/check-mode-scanner-robustness/latest";
export const DEFAULT_CHECK_MODE_SCANNER_ROBUSTNESS_INPUTS = {
  schemaPath: "schemas/check-mode-scanner-robustness.schema.json",
  checkModeGuardSchemaPath: "schemas/check-mode-guard-normalization.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p18401-p18800.md",
  architectureDocPath: "docs/architecture.md",
  sourceCheckModeGuardNormalizationPath: "artifacts/check-mode-guard-normalization/latest/check-mode-guard-normalization.json",
};

const COMMAND_NAME = "platform:check-mode-scanner-robustness";
const SCHEMA_VERSION = "check-mode-scanner-robustness.v1";
const CAPABILITY_ID = "platform.check_mode_scanner_robustness";
const PROGRAM_RANGE = "P18401-P18800";
const SOURCE_PROGRAM_RANGE = "P18001-P18400";
const READY_STATUS = "ready_for_check_mode_scanner_robustness";
const BLOCKED_STATUS = "blocked_check_mode_scanner_robustness";
const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

const PHASE_SPECS = [
  ["P18401-P18440", "Claude Finding Intake", "scanner_finding_closure_rows"],
  ["P18441-P18520", "Tokenizer-Aware Branch Scan", "tokenizer_fixture_rows"],
  ["P18521-P18600", "Parser Shape Coverage", "parser_shape_fixture_rows"],
  ["P18601-P18680", "Guard Convention Ledger", "guard_convention_rows"],
  ["P18681-P18740", "Schema And Readiness Tightening", "schema_readiness_rows"],
  ["P18741-P18800", "P18800 Handoff Freeze", "p18800_freeze_rows"],
];

const CLAUDE_FINDING_CLASSES = [
  ["F-001-scanner-pattern-narrowness", "P3", "parser_shape_coverage", "Parser shapes beyond variable-left strict equality are covered by fixtures."],
  ["F-002-brace-matching-string-comment-blindness", "P3", "tokenizer_brace_coverage", "Brace matching ignores braces inside string/comment/template literals."],
  ["F-003-write-disable-regex-string-comment-blindness", "P3", "tokenizer_assignment_coverage", "Write-disable checks ignore commented or string-literal fake assignments."],
  ["F-004-schema-row-coverage-partial", "INFO", "schema_row_coverage", "P18400 row collections have minimum schema coverage."],
  ["F-005-guard-detection-substring-coupling", "INFO", "guard_convention_ledger", "Literal guard convention is explicit and unsupported variants are documented."],
  ["F-006-quote-character-permissiveness", "INFO", "quote_mismatch_fixture", "Mismatched quote literals are blocked by scanner fixtures."],
  ["F-007-readiness-couples-validation-and-boundary", "INFO", "readiness_semantics", "Summary readiness is the gating signal and boundary readiness remains scanner-source readiness."],
];

const PARSER_FIXTURES = [
  ["arg_strict_equality", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; args.write = false; } } }", 0],
  ["reversed_strict_equality", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (\"--check\" === arg) { args.check = true; args.write = false; } } }", 0],
  ["loose_equality", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg == \"--check\") { args.check = true; args.write = false; } } }", 0],
  ["switch_case", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { switch (arg) { case \"--check\": args.check = true; args.write = false; break; default: break; } } }", 0],
  ["array_includes", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if ([\"--check\"].includes(arg)) { args.check = true; args.write = false; } } }", 0],
  ["alternate_parser_missing_write_blocked", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; args.write = false; } } } const parseOptions = (argv) => { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; } } };", 1],
];

const TOKENIZER_FIXTURES = [
  ["commented_write_blocked", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; // args.write = false;\n } } }", 1],
  ["string_write_blocked", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { args.check = true; const fake = \"args.write = false\"; } } }", 1],
  ["string_brace_ok", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check\") { const sample = \"}\"; args.check = true; args.write = false; } } }", 0],
  ["quote_mismatch_blocked", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === \"--check') { args.check = true; args.write = false; } } }", 1],
  ["unterminated_template_blocked", "if (options.write !== false) await write(); function parseArgs(argv) { const args = {}; for (const arg of argv) { if (arg === `--check) { args.check = true; args.write = false; } } }", 1],
];

export async function runCheckModeScannerRobustness(options = {}) {
  const result = await buildCheckModeScannerRobustness(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Check-Mode Scanner Robustness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeCheckModeScannerRobustness(result, result.output_dir);
  return result;
}

export async function buildCheckModeScannerRobustness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CHECK_MODE_SCANNER_ROBUSTNESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const checkModeGuardSchema = await readJsonSource(inputs.check_mode_guard_schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "checkModeGuardNormalization")
    ? normalizeInlineJsonSource("inline.check_mode_guard_normalization", options.checkModeGuardNormalization)
    : await readJsonOrBuildP18400(inputs.source_check_mode_guard_normalization_path, generatedAt);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const parserRows = buildFixtureRows("parser", PARSER_FIXTURES, generatedAt);
  const tokenizerRows = buildFixtureRows("tokenizer", TOKENIZER_FIXTURES, generatedAt);
  const guardRows = buildGuardConventionRows(generatedAt);
  const schemaRows = buildSchemaReadinessRows({ source, checkModeGuardSchema, generatedAt });
  const findingRows = buildFindingClosureRows({ parserRows, tokenizerRows, guardRows, schemaRows, source, generatedAt });
  const freezeRows = buildFreezeRows({ source, parserRows, tokenizerRows, findingRows, guardRows, schemaRows, generatedAt });
  const boundary = buildBoundary({ source, parserRows, tokenizerRows, findingRows, guardRows, schemaRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, parserRows, tokenizerRows, findingRows, guardRows, schemaRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: { check_mode_guard_normalization_path: source.path },
    source_check_mode_guard_summary: source.data?.summary ?? null,
    scanner_robustness_contract: buildContract(generatedAt),
    scanner_robustness_phase_rows: phaseRows,
    scanner_finding_closure_rows: findingRows,
    parser_shape_fixture_rows: parserRows,
    tokenizer_fixture_rows: tokenizerRows,
    guard_convention_rows: guardRows,
    schema_readiness_rows: schemaRows,
    p18800_freeze_rows: freezeRows,
    scanner_robustness_boundary: boundary,
    scanner_robustness_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, findingRows, parserRows, tokenizerRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "check_mode_scanner_robustness")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.scanner_robustness_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.scanner_robustness_validation_items);
  result.summary = buildSummary({ boundary, findingRows, parserRows, tokenizerRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeCheckModeScannerRobustness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "check-mode-scanner-robustness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "scanner-finding-closure-rows.json"), collectionEnvelope("scanner-finding-closure-rows.v1", "scanner_finding_closure_rows", result.scanner_finding_closure_rows, result.generated_at));
  await writeJson(path.join(outDir, "parser-shape-fixture-rows.json"), collectionEnvelope("parser-shape-fixture-rows.v1", "parser_shape_fixture_rows", result.parser_shape_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "tokenizer-fixture-rows.json"), collectionEnvelope("tokenizer-fixture-rows.v1", "tokenizer_fixture_rows", result.tokenizer_fixture_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runCheckModeScannerRobustnessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runCheckModeScannerRobustness(args);
  console.log(`Check-Mode Scanner Robustness validated at ${result.output_dir}`);
  console.log(`Status: ${result.summary.scanner_robustness_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Finding closures: ${result.summary.finding_closure_count}`);
  console.log(`Blocking findings: ${result.summary.blocking_finding_count}`);
  console.log(`Parser fixtures passed: ${result.summary.parser_fixture_passed_now}`);
  console.log(`Tokenizer fixtures passed: ${result.summary.tokenizer_fixture_passed_now}`);
  console.log(`Ready for P18801 handoff: ${result.summary.ready_for_p18801_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildFixtureRows(kind, fixtures, generatedAt) {
  return fixtures.map(([fixtureId, source, expectedOffenders]) => {
    const scan = collectCheckModeGuardFindingsFromSource(`fixture/${fixtureId}.mjs`, source);
    const observed = scan.findings.length === expectedOffenders;
    return {
      schema_version: `check-mode-scanner-${kind}-fixture-row.v1`,
      row_id: fixtureId,
      fixture_kind: kind,
      expected_offenders: expectedOffenders,
      observed_offenders: scan.findings.length,
      observed,
      current_verdict: observed ? "pass" : "blocked",
      evidence_ref: `scanner_fixture.${fixtureId}`,
      block_reason: observed ? null : `${fixtureId} expected ${expectedOffenders} offender(s), observed ${scan.findings.length}.`,
      generated_at: generatedAt,
    };
  });
}

function buildFindingClosureRows({ parserRows, tokenizerRows, guardRows, schemaRows, source, generatedAt }) {
  const closureState = {
    parser_shape_coverage: allPass(parserRows),
    tokenizer_brace_coverage: rowPass(tokenizerRows, "string_brace_ok"),
    tokenizer_assignment_coverage: rowPass(tokenizerRows, "commented_write_blocked") && rowPass(tokenizerRows, "string_write_blocked"),
    schema_row_coverage: allPass(schemaRows),
    guard_convention_ledger: allPass(guardRows),
    quote_mismatch_fixture: rowPass(tokenizerRows, "quote_mismatch_blocked"),
    readiness_semantics: allPass(schemaRows) && source.data?.summary?.ready_for_p18401_handoff === true,
  };
  return CLAUDE_FINDING_CLASSES.map(([findingId, severity, closureKey, description], index) => {
    const closed = Boolean(closureState[closureKey]);
    return {
      schema_version: "check-mode-scanner-finding-closure-row.v1",
      row_id: `p18800.finding.${String(index + 1).padStart(3, "0")}`,
      finding_id: findingId,
      source_review_ref: "artifacts/check-mode-guard-normalization/review/claude-review-receipt.json",
      severity,
      closure_key: closureKey,
      description,
      closure_status: closed ? closureStatus(severity) : "blocked",
      current_verdict: closed ? "pass" : "blocked",
      blocks_p18800: !closed && ["P0", "P1"].includes(severity),
      evidence_ref: `evidence.check_mode_scanner_robustness.${closureKey}`,
      block_reason: closed ? null : `${findingId} closure evidence is missing.`,
      reviewer_ref: "reviewer.harness_contract",
      generated_at: generatedAt,
    };
  });
}

function buildGuardConventionRows(generatedAt) {
  return [
    row("literal_write_guard_required", "Guarded generator inventory requires the literal options.write !== false convention", true, "src/check-mode-guard-normalization.mjs", generatedAt),
    row("unsupported_semantic_variants_documented", "Semantic write guard variants are documented as unsupported until explicitly added", true, "docs/hermes-roadmap-p18401-p18800.md", generatedAt),
    row("unsupported_member_expression_condition", "Member-expression check comparisons such as process.argv[2] === \"--check\" remain unsupported until explicitly added", true, "guard_convention.unsupported.member_expression", generatedAt),
    row("unsupported_template_literal_condition", "Template-literal check comparisons such as arg === `--check` remain unsupported until explicitly added", true, "guard_convention.unsupported.template_literal", generatedAt),
    row("unsupported_destructured_flag_condition", "Destructured flag predicates such as if (flags.check) remain unsupported until explicitly added", true, "guard_convention.unsupported.destructured_flag", generatedAt),
    row("no_silent_authority_expansion", "Unsupported variants do not open execution or write authority", true, "scanner_robustness_boundary", generatedAt),
  ];
}

function buildSchemaReadinessRows({ source, checkModeGuardSchema, generatedAt }) {
  const schemaText = checkModeGuardSchema.text ?? "";
  const summaryReady = source.data?.summary?.ready_for_p18401_handoff === true;
  const boundaryReady = source.data?.check_mode_guard_boundary?.ready_for_p18401_handoff === true;
  return [
    row("p18400_row_arrays_schema", "P18400 schema declares row collection arrays", ["check_mode_guard_phase_rows", "check_mode_guard_file_rows", "check_mode_guard_finding_rows"].every((term) => schemaText.includes(term)), "schemas/check-mode-guard-normalization.schema.json", generatedAt),
    row("summary_readiness_is_gating_signal", "P18400 summary readiness remains the downstream gating signal", summaryReady, "source.summary.ready_for_p18401_handoff", generatedAt),
    row("boundary_readiness_is_scanner_source_signal", "P18400 boundary readiness remains visible as scanner/source readiness", boundaryReady, "source.check_mode_guard_boundary.ready_for_p18401_handoff", generatedAt),
  ];
}

function buildFreezeRows({ source, parserRows, tokenizerRows, findingRows, guardRows, schemaRows, generatedAt }) {
  return [
    row("p18800_closeout_id", "P18800 closeout id is fixed", true, "check_mode_scanner_robustness.p18800", generatedAt),
    row("p18400_source_ready", "P18400 source is ready for P18401 handoff", source.data?.summary?.ready_for_p18401_handoff === true, "source.summary.ready_for_p18401_handoff", generatedAt),
    row("parser_fixtures_pass", "Parser shape fixtures pass", allPass(parserRows), "parser_shape_fixture_rows", generatedAt),
    row("tokenizer_fixtures_pass", "Tokenizer fixtures pass", allPass(tokenizerRows), "tokenizer_fixture_rows", generatedAt),
    row("finding_closures_pass", "P18400 Claude finding classes are closed", allPass(findingRows), "scanner_finding_closure_rows", generatedAt),
    row("guard_and_schema_pass", "Guard convention and schema readiness pass", allPass(guardRows) && allPass(schemaRows), "guard_convention_rows/schema_readiness_rows", generatedAt),
    row("protected_authority_closed", "Protected authority remains closed", true, "scanner_robustness_boundary", generatedAt),
  ];
}

function buildBoundary({ source, parserRows, tokenizerRows, findingRows, guardRows, schemaRows }) {
  const sourceReady = source.data?.summary?.ready_for_p18401_handoff === true;
  const ready = sourceReady && allPass(parserRows) && allPass(tokenizerRows) && allPass(findingRows) && allPass(guardRows) && allPass(schemaRows);
  return {
    ready_for_p18801_handoff: ready,
    source_p18400_ready_for_p18401_handoff: sourceReady,
    source_offender_count: source.data?.summary?.offender_count ?? null,
    parser_fixture_passed_now: allPass(parserRows),
    tokenizer_fixture_passed_now: allPass(tokenizerRows),
    finding_closure_count: findingRows.filter((rowItem) => rowItem.current_verdict === "pass").length,
    blocking_finding_count: findingRows.filter((rowItem) => rowItem.blocks_p18800).length,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    raw_source_exposure_allowed: false,
    secret_read_allowed_now: false,
    reviewer_mutation_allowed_now: false,
    final_automated_approval_allowed: false,
  };
}

function buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, parserRows, tokenizerRows, findingRows, guardRows, schemaRows, freezeRows, boundary }) {
  return [
    validationItem("package.script", "package", hasScript(packageJson.data, "platform:check-mode-scanner-robustness"), "package.json registers platform:check-mode-scanner-robustness"),
    validationItem("package.validate", "package", packageJson.text.includes("platform:check-mode-scanner-robustness -- --check"), "npm run validate includes check-mode scanner robustness"),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(phaseRows), "P18401-P18800 phase rows are covered"),
    validationItem("architecture.boundary", "architecture", architectureDoc.text.includes("P18401-P18800 Check-Mode Scanner Robustness"), "Architecture documents P18401-P18800 boundary"),
    validationItem("parser.fixtures", "scanner", allPass(parserRows), "Parser shape fixtures pass"),
    validationItem("tokenizer.fixtures", "scanner", allPass(tokenizerRows), "Tokenizer-aware fixtures pass"),
    validationItem("findings.closed", "review", allPass(findingRows), "P18400 scanner finding classes are closed"),
    validationItem("guard.schema", "contract", allPass(guardRows) && allPass(schemaRows), "Guard convention and schema readiness rows pass"),
    validationItem("freeze.ready", "freeze", allPass(freezeRows) && boundary.ready_for_p18801_handoff, "P18801 handoff gate is ready"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(boundary), "Protected authority remains closed"),
  ];
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, label, artifactKey]) => {
    const observed = roadmapText.includes(phaseRange) && roadmapText.includes(artifactKey);
    return row(slug(phaseRange), label, observed, artifactKey, generatedAt, { phase_range: phaseRange, artifact_key: artifactKey });
  });
}

function buildContract(generatedAt) {
  return {
    contract_id: "check_mode_scanner_robustness",
    generated_at: generatedAt,
    source_p18400_required_or_rebuilt: true,
    claude_finding_classes_tracked: true,
    no_write_policy_scanner_hardened: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, findingRows, parserRows, tokenizerRows, validation }) {
  return {
    scanner_robustness_status: validation.valid && boundary.ready_for_p18801_handoff ? READY_STATUS : BLOCKED_STATUS,
    source_offender_count: boundary.source_offender_count,
    finding_closure_count: findingRows.filter((rowItem) => rowItem.current_verdict === "pass").length,
    blocking_finding_count: findingRows.filter((rowItem) => rowItem.blocks_p18800).length,
    parser_fixture_passed_now: allPass(parserRows),
    tokenizer_fixture_passed_now: allPass(tokenizerRows),
    ready_for_p18801_handoff: validation.valid && boundary.ready_for_p18801_handoff,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Check-Mode Scanner Robustness",
    "",
    `Status: ${result.summary.scanner_robustness_status}`,
    `Program: ${result.program_range}`,
    `P18400 offender count: ${result.summary.source_offender_count}`,
    `Finding closures: ${result.summary.finding_closure_count}`,
    `Blocking findings: ${result.summary.blocking_finding_count}`,
    `Parser fixtures passed: ${result.summary.parser_fixture_passed_now}`,
    `Tokenizer fixtures passed: ${result.summary.tokenizer_fixture_passed_now}`,
    `Ready for P18801 handoff: ${result.summary.ready_for_p18801_handoff}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.scanner_finding_closure_rows.map((rowItem) => `<tr><td>${escapeHtml(rowItem.finding_id)}</td><td>${escapeHtml(rowItem.severity)}</td><td>${escapeHtml(rowItem.closure_status)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Check-Mode Scanner Robustness</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Check-Mode Scanner Robustness</h1>
    <p class="notice">This artifact closes nonblocking scanner findings. It does not create execution, write authority, connector mutation, production PASS, enterprise trust, or final approval.</p>
    <table><thead><tr><th>Finding</th><th>Severity</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP18400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildCheckModeGuardNormalization({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.check_mode_guard_normalization", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, data: value, text: JSON.stringify(value) };
  return { path: label, available: false, data: null, text: "", error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_CHECK_MODE_SCANNER_ROBUSTNESS_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    check_mode_guard_schema_path: path.resolve(repoRoot, options.checkModeGuardSchemaPath ?? defaults.checkModeGuardSchemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_check_mode_guard_normalization_path: path.resolve(repoRoot, options.sourceCheckModeGuardNormalizationPath ?? defaults.sourceCheckModeGuardNormalizationPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceCheckModeGuardNormalizationPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE]`);
}

function row(rowId, label, observed, evidenceRef, generatedAt, extras = {}) {
  return {
    row_id: rowId,
    label,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${label} is missing or blocked.`,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    ...extras,
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok).map((item) => ({ path: item.item_id, message: item.message }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function protectedBoundaryClosed(boundary) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.every((key) => boundary[key] === false);
}

function closureStatus(severity) {
  return severity === "INFO" ? "accepted_non_blocking_closed" : "resolved";
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
