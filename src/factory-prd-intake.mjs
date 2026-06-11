import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FACTORY_PRD_INTAKE_OUT_DIR = "artifacts/factory-prd-intake/latest";
export const DEFAULT_FACTORY_PRD_INTAKE_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
  prdPath: "docs/hermes-enterprise-saas-specification.md",
};

const COMMAND_NAME = "factory:prd-intake";
const SCHEMA_VERSION = "factory-prd-intake.v1";
const CAPABILITY_ID = "factory.prd_intake";
const PROGRAM_RANGE = "FCORE-FE.1";
const SOURCE_PROGRAM_RANGE = "FCORE-FD.5";
const READY_STATUS = "ready_factory_prd_intake";
const BLOCKED_STATUS = "blocked_factory_prd_intake";
const HASH_RE = /^[a-f0-9]{64}$/;

const REQUIRED_H2_NUMBERS = ["1", "3", "4", "7", "9", "14", "18"];
const REQUIRED_FUNCTIONAL_SECTION_PREFIXES = Array.from({ length: 15 }, (_item, index) => `4.${index + 1}`);
const AUTHORITY_FALSE_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "command_execution_enabled",
  "command_execution_allowed_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "gate_opening_allowed_now",
  "g1a_project_creation_gate_open_now",
  "g1b_repo_write_gate_open_now",
  "g2_command_execution_gate_open_now",
  "g3_deployment_gate_open_now",
];

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryPrdIntake(options = {}) {
  const result = await buildFactoryPrdIntake(options);
  if (!options.check && options.write !== false) await writeFactoryPrdIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory PRD Intake failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_prd_intake_status !== READY_STATUS) {
    const error = new Error("Factory PRD Intake is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryPrdIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_PRD_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const prdSource = await readTextSource(inputs.prd_path);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const sourceModel = buildSourceModel({ prdSource, expectedSourceSha256: options.expectedSourceSha256 });
  const sourceSpanRows = buildSourceSpanRows(sourceModel, generatedAt);
  const requirementRows = buildRequirementRows(sourceModel, sourceSpanRows, generatedAt);
  const tuwSeedRows = buildTuwSeedRows(requirementRows, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows({ sourceModel, generatedAt });
  const boundary = buildBoundary({ sourceModel, sourceSpanRows, requirementRows, tuwSeedRows, negativeFixtureRows, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    sourceModel,
    sourceSpanRows,
    requirementRows,
    tuwSeedRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceModel, sourceSpanRows, requirementRows, tuwSeedRows, negativeFixtureRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      package_path: packageJson.path,
      structured_summary_path: structuredSummary.path,
      prd_path: prdSource.path,
      prd_sha256: sourceModel.sha256,
    },
    source_summaries: {
      fd5_status: structuredSummary.data?.fd5_status ?? null,
      fd5_command_status: structuredSummary.data?.fd5_command_status ?? null,
      structured_summary_package_version: structuredSummary.data?.package_version ?? null,
    },
    factory_prd_source: sourceModel.public_source,
    factory_prd_source_span_rows: sourceSpanRows,
    factory_prd_requirement_rows: requirementRows,
    factory_prd_tuw_seed_rows: tuwSeedRows,
    factory_prd_negative_fixture_rows: negativeFixtureRows,
    factory_prd_intake_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryPrdIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-prd-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-span-rows.json"), collectionEnvelope("factory-prd-source-span-rows.v1", "factory_prd_source_span_rows", result.factory_prd_source_span_rows, result.generated_at));
  await writeJson(path.join(outDir, "requirement-rows.json"), collectionEnvelope("factory-prd-requirement-rows.v1", "factory_prd_requirement_rows", result.factory_prd_requirement_rows, result.generated_at));
  await writeJson(path.join(outDir, "tuw-seed-rows.json"), collectionEnvelope("factory-prd-tuw-seed-rows.v1", "factory_prd_tuw_seed_rows", result.factory_prd_tuw_seed_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-prd-negative-fixture-rows.v1", "factory_prd_negative_fixture_rows", result.factory_prd_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_prd_intake_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-prd-intake-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryPrdIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryPrdIntake(args);
    console.log(`Factory PRD Intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_prd_intake_status}`);
    console.log(`Source spans: ${result.summary.source_span_count}`);
    console.log(`Requirement rows: ${result.summary.requirement_row_count}`);
    console.log(`TUW seed rows: ${result.summary.tuw_seed_row_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Command execution enabled: ${result.summary.command_execution_enabled}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSourceModel({ prdSource, expectedSourceSha256 }) {
  const text = prdSource.text ?? "";
  const lines = text.length > 0 ? text.split(/\r?\n/) : [];
  const sha256 = prdSource.available ? hashString(text) : null;
  const headings = prdSource.available ? parseHeadings(lines) : [];
  const h2Headings = headings.filter((heading) => heading.level === 2);
  const h3Headings = headings.filter((heading) => heading.level === 3);
  const functionalSections = h3Headings.filter((heading) => heading.number?.startsWith("4."));
  const sourceStatus = buildSourceStatus({ prdSource, text, headings, functionalSections, expectedSourceSha256, sha256 });
  return {
    available: prdSource.available,
    path: prdSource.path,
    error: prdSource.error ?? null,
    text,
    lines,
    sha256,
    line_count: lines.length,
    heading_count: headings.length,
    h2_heading_count: h2Headings.length,
    h3_heading_count: h3Headings.length,
    functional_section_count: functionalSections.length,
    expected_source_sha256: expectedSourceSha256 ?? null,
    source_status: sourceStatus.status,
    status_reasons: sourceStatus.reasons,
    headings,
    public_source: {
      schema_version: "factory-prd-source.v1",
      source_path: prdSource.path,
      source_available: prdSource.available,
      source_sha256: sha256,
      line_count: lines.length,
      heading_count: headings.length,
      h2_heading_count: h2Headings.length,
      h3_heading_count: h3Headings.length,
      functional_section_count: functionalSections.length,
      expected_source_sha256: expectedSourceSha256 ?? null,
      source_status: sourceStatus.status,
      status_reasons: sourceStatus.reasons,
      raw_prd_text_persisted_in_artifact: false,
    },
  };
}

function parseHeadings(lines) {
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].trim();
    const number = extractHeadingNumber(title);
    headings.push({
      level,
      title,
      number,
      line_number: index + 1,
      heading_key: normalizeKey(number ? `${number}-${title.replace(number, "")}` : title),
    });
  }
  return headings.map((heading, index) => {
    const nextPeer = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    return {
      ...heading,
      end_line: nextPeer ? nextPeer.line_number - 1 : lines.length,
    };
  });
}

function buildSourceSpanRows(sourceModel, generatedAt) {
  if (!sourceModel.available) return [];
  return sourceModel.headings
    .filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading, index) => {
      const spanText = sourceModel.lines.slice(heading.line_number - 1, heading.end_line).join("\n");
      const spanSha256 = hashString(spanText);
      return {
        schema_version: "factory-prd-source-span-row.v1",
        source_span_id: `source-span.hermes-enterprise-saas.${String(index + 1).padStart(3, "0")}`,
        source_path: sourceModel.path,
        source_sha256: sourceModel.sha256,
        heading_level: heading.level,
        heading_number: heading.number,
        heading_title: heading.title,
        heading_key: heading.heading_key,
        start_line: heading.line_number,
        end_line: heading.end_line,
        line_count: heading.end_line - heading.line_number + 1,
        source_span_sha256: spanSha256,
        source_span_status: HASH_RE.test(spanSha256) ? "ready_source_span_bound" : "blocked_source_span_hash",
        raw_text_included: false,
        generated_at: generatedAt,
      };
    });
}

function buildRequirementRows(sourceModel, sourceSpanRows, generatedAt) {
  const spanByHeadingKey = new Map(sourceSpanRows.map((row) => [row.heading_key, row]));
  const functionalHeadings = sourceModel.headings.filter((heading) => heading.level === 3 && heading.number?.startsWith("4."));
  return functionalHeadings.map((heading, index) => {
    const span = spanByHeadingKey.get(heading.heading_key);
    const spanLines = sourceModel.lines.slice(heading.line_number - 1, heading.end_line);
    const bulletCount = spanLines.filter((line) => /^\s*-\s+/.test(line)).length;
    const tableRowCount = spanLines.filter((line) => /^\|.*\|$/.test(line.trim())).length;
    const titleWithoutNumber = stripHeadingNumber(heading.title);
    const requirementKind = inferRequirementKind(titleWithoutNumber);
    const sourceReady = Boolean(span) && span.source_span_status === "ready_source_span_bound" && bulletCount > 0;
    return {
      schema_version: "factory-prd-requirement-row.v1",
      requirement_row_id: `factory-prd-req.${normalizeKey(heading.number ?? String(index + 1))}.${normalizeKey(titleWithoutNumber)}`,
      product_id: "project.hermes_harness",
      prd_id: "prd.hermes_enterprise_saas_specification",
      requirement_group: "functional_requirements",
      requirement_kind: requirementKind,
      source_span_id: span?.source_span_id ?? null,
      source_path: sourceModel.path,
      source_sha256: sourceModel.sha256,
      source_span_sha256: span?.source_span_sha256 ?? null,
      heading_number: heading.number,
      heading_title: heading.title,
      title: titleWithoutNumber,
      start_line: heading.line_number,
      end_line: heading.end_line,
      requirement_signal_count: bulletCount,
      table_signal_count: tableRowCount,
      intake_status: sourceReady ? "ready_for_tuw_decomposition" : "blocked_missing_requirement_signals",
      source_binding_status: sourceReady ? "ready_source_bound" : "blocked_source_binding",
      tuw_decomposition_seed_status: sourceReady ? "queued_for_fe2_decomposition" : "blocked_before_fe2_decomposition",
      next_allowed_action: sourceReady ? "decompose_into_fe2_work_packets_without_execution" : "repair_prd_source_binding_before_decomposition",
      allowed_affordances: ["view_source_span", "view_requirement_summary", "queue_for_fe2_decomposition"],
      forbidden_affordances: buildForbiddenAffordances(),
      raw_prd_text_visible: false,
      command_execution_enabled: false,
      source_file_write_allowed_now: false,
      ledger_append_allowed_now: false,
      repo_write_allowed_now: false,
      connector_write_allowed_now: false,
      deployment_allowed_now: false,
      protected_action_allowed_now: false,
      generated_at: generatedAt,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildTuwSeedRows(requirementRows, generatedAt) {
  return requirementRows.map((row, index) => {
    const ready = row.intake_status === "ready_for_tuw_decomposition" && HASH_RE.test(row.source_span_sha256 ?? "");
    return {
      schema_version: "factory-prd-tuw-seed-row.v1",
      tuw_seed_id: `factory-prd-tuw-seed.${String(index + 1).padStart(3, "0")}.${normalizeKey(row.title)}`,
      product_id: row.product_id,
      source_requirement_row_id: row.requirement_row_id,
      source_span_id: row.source_span_id,
      source_sha256: row.source_sha256,
      source_span_sha256: row.source_span_sha256,
      work_packet_candidate_kind: "fe2_decomposition_candidate",
      work_packet_candidate_title: `Decompose ${row.title}`,
      requirement_kind: row.requirement_kind,
      decomposition_scope: "bounded_to_single_prd_source_span",
      decomposition_status: ready ? "ready_for_fe2_work_packet_breakdown" : "blocked_before_fe2_work_packet_breakdown",
      acceptance_basis: [
        "source span hash remains unchanged",
        "generated work packets keep one source span binding",
        "no command execution or repo write authority is inferred from intake",
      ],
      blocked_reason_ids: ready ? [] : ["source_requirement_not_ready"],
      command_execution_enabled: false,
      work_packet_execution_allowed_now: false,
      source_file_write_allowed_now: false,
      repo_write_allowed_now: false,
      generated_at: generatedAt,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildNegativeFixtureRows({ sourceModel, generatedAt }) {
  const baselineReady = sourceModel.source_status === "ready_source_bound";
  const missingSource = buildSourceModel({
    prdSource: {
      available: false,
      path: sourceModel.path,
      text: "",
      error: "SIMULATED_MISSING_SOURCE",
    },
  });
  const emptySource = buildSourceModel({
    prdSource: {
      available: true,
      path: sourceModel.path,
      text: "",
    },
  });
  const mismatchSource = buildSourceModel({
    prdSource: {
      available: true,
      path: sourceModel.path,
      text: sourceModel.text,
    },
    expectedSourceSha256: "0".repeat(64),
  });
  const missingFunctionalSource = buildSourceModel({
    prdSource: {
      available: true,
      path: sourceModel.path,
      text: [
        "# Hermes Enterprise SaaS 사양명세서",
        "",
        "## 1. 제품 정의",
        "",
        "### 1.1 제품명",
        "",
        "- Hermes",
        "",
        "## 2. 대상 사용자와 시장",
        "",
        "### 2.1 핵심 사용자",
        "",
        "- Founder",
        "",
      ].join("\n"),
    },
  });
  const openedCommandBoundary = {
    ...AUTHORITY_CLOSED,
    command_execution_enabled: true,
    command_execution_allowed_now: true,
    g2_command_execution_gate_open_now: true,
  };
  const fixtures = [
    {
      fixture_key: "missing_prd_source",
      simulated_condition: "prd source file missing",
      observed_blocked_checks: ["source.available"],
      blocked: missingSource.available === false && missingSource.source_status === "blocked_source_intake",
    },
    {
      fixture_key: "empty_prd_source",
      simulated_condition: "prd source exists but has no requirement headings",
      observed_blocked_checks: ["source.non_empty", "headings.present", "requirements.functional_sections_present"],
      blocked: emptySource.text.trim().length === 0 && emptySource.source_status === "blocked_source_intake",
    },
    {
      fixture_key: "source_sha_mismatch",
      simulated_condition: "expected source sha256 does not match PRD content",
      observed_blocked_checks: ["source.expected_sha_match"],
      blocked: mismatchSource.status_reasons.includes("source_sha_mismatch") && mismatchSource.source_status === "blocked_source_intake",
    },
    {
      fixture_key: "functional_requirements_missing",
      simulated_condition: "PRD has no section 4 functional requirement rows",
      observed_blocked_checks: ["requirements.required_functional_sections_present"],
      blocked: missingFunctionalSource.functional_section_count === 0 && missingFunctionalSource.source_status === "blocked_source_intake",
    },
    {
      fixture_key: "g2_command_execution_attempt",
      simulated_condition: "FE.1 intake row tries to execute commands before G2 gate opening",
      observed_blocked_checks: ["boundary.command_execution_closed", "boundary.gate_opening_closed"],
      blocked: !allAuthorityClosed(openedCommandBoundary),
    },
  ];
  return fixtures.map((fixture) => ({
    schema_version: "factory-prd-negative-fixture-row.v1",
    fixture_id: `factory-prd-negative.${fixture.fixture_key}`,
    fixture_key: fixture.fixture_key,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    simulated_condition: fixture.simulated_condition,
    baseline_source_ready: baselineReady,
    expected_result: "blocked",
    actual_result: fixture.blocked ? "blocked" : "not_blocked",
    fixture_status: fixture.blocked ? "blocked_as_expected" : "fixture_failed_open",
    observed_blocked_checks: fixture.observed_blocked_checks,
    authority_opened_by_fixture: false,
    command_execution_enabled: false,
    source_file_write_allowed_now: false,
    repo_write_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildBoundary({ sourceModel, sourceSpanRows, requirementRows, tuwSeedRows, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-prd-intake-boundary.v1",
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    read_only_intake: true,
    source_status: sourceModel.source_status,
    source_span_count: sourceSpanRows.length,
    requirement_row_count: requirementRows.length,
    tuw_seed_row_count: tuwSeedRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    method_allowlist: ["GET", "HEAD", "READ_FILE"],
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    tuw_decomposition_allowed_next: sourceModel.source_status === "ready_source_bound",
    fe2_work_packet_generation_allowed_next: sourceModel.source_status === "ready_source_bound",
    fe2_work_packet_execution_allowed_now: false,
    ...AUTHORITY_CLOSED,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ packageJson, structuredSummary, sourceModel, sourceSpanRows, requirementRows, tuwSeedRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const h2Numbers = new Set(sourceModel.headings.filter((heading) => heading.level === 2).map((heading) => heading.number));
  const requirementNumbers = new Set(requirementRows.map((row) => row.heading_number));
  return [
    validationItem("package.script", "wiring", scripts[COMMAND_NAME] === "node scripts/factory-prd-intake.mjs", `${COMMAND_NAME} package script must be registered`),
    validationItem("structured_summary.fd5_ready", "source_chain", structuredSummary.data?.fd5_status === "ready_factory_closed_apply_cycle_freeze_lawos_style_claude_reviewed", "FD.5 must be ready before FE.1 intake"),
    validationItem("source.available", "source", sourceModel.available === true, "PRD source file must be available"),
    validationItem("source.non_empty", "source", sourceModel.text.trim().length > 0, "PRD source must be non-empty"),
    validationItem("source.sha256", "source", HASH_RE.test(sourceModel.sha256 ?? ""), "PRD source must have a SHA-256 hash"),
    validationItem("source.expected_sha_match", "source", !sourceModel.expected_source_sha256 || sourceModel.expected_source_sha256 === sourceModel.sha256, "Expected source SHA-256 must match when provided"),
    validationItem("headings.present", "source", sourceModel.heading_count >= 50, "PRD source must expose enough headings for deterministic intake"),
    validationItem("headings.required_h2_present", "source", REQUIRED_H2_NUMBERS.every((number) => h2Numbers.has(number)), "Required PRD top-level sections must be present"),
    validationItem("spans.present", "source_span", sourceSpanRows.length >= 50, "Source span rows must be generated from H2/H3 headings"),
    validationItem("spans.hash_bound", "source_span", sourceSpanRows.every((row) => HASH_RE.test(row.source_span_sha256) && row.start_line > 0 && row.end_line >= row.start_line), "Every source span row must be line and hash bound"),
    validationItem("requirements.functional_sections_present", "requirement", requirementRows.length >= REQUIRED_FUNCTIONAL_SECTION_PREFIXES.length, "Functional requirement rows must be present"),
    validationItem("requirements.required_functional_sections_present", "requirement", REQUIRED_FUNCTIONAL_SECTION_PREFIXES.every((number) => requirementNumbers.has(number)), "Sections 4.1 through 4.15 must be represented"),
    validationItem("requirements.source_bound", "requirement", requirementRows.every((row) => row.intake_status === "ready_for_tuw_decomposition" && HASH_RE.test(row.source_span_sha256 ?? "")), "Requirement rows must be ready and source-span bound"),
    validationItem("tuw.seed_rows_present", "tuw_seed", tuwSeedRows.length === requirementRows.length && tuwSeedRows.length >= 15, "Each requirement row must produce one TUW seed row"),
    validationItem("tuw.seed_rows_source_bound", "tuw_seed", tuwSeedRows.every((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown" && HASH_RE.test(row.source_span_sha256 ?? "")), "TUW seed rows must remain source-span bound"),
    validationItem("negative_fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 5 && negativeFixtureRows.every((row) => row.fixture_status === "blocked_as_expected"), "All negative fixtures must remain blocked"),
    validationItem("boundary.no_raw_prd_text", "authority", boundary.raw_prd_text_persisted_in_artifact === false, "PRD intake artifact must not persist raw PRD text"),
    validationItem("boundary.command_execution_closed", "authority", boundary.command_execution_enabled === false && boundary.command_execution_allowed_now === false && boundary.g2_command_execution_gate_open_now === false, "FE.1 must not open command execution"),
    validationItem("boundary.write_apply_closed", "authority", boundary.source_file_write_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.apply_allowed_now === false, "FE.1 must not open write or apply authority"),
    validationItem("boundary.gate_opening_closed", "authority", boundary.gate_opening_allowed_now === false && boundary.g1a_project_creation_gate_open_now === false && boundary.g1b_repo_write_gate_open_now === false, "FE.1 must not open G-series gates"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All factory authority flags must remain false"),
  ];
}

function buildSummary({ sourceModel, sourceSpanRows, requirementRows, tuwSeedRows, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid
    && sourceModel.source_status === "ready_source_bound"
    && requirementRows.every((row) => row.intake_status === "ready_for_tuw_decomposition")
    && tuwSeedRows.every((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown")
    && allAuthorityClosed(boundary);
  return {
    factory_prd_intake_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    prd_source_path: sourceModel.path,
    prd_source_status: sourceModel.source_status,
    prd_source_sha256: sourceModel.sha256,
    prd_line_count: sourceModel.line_count,
    heading_count: sourceModel.heading_count,
    source_span_count: sourceSpanRows.length,
    requirement_row_count: requirementRows.length,
    requirement_ready_count: requirementRows.filter((row) => row.intake_status === "ready_for_tuw_decomposition").length,
    tuw_seed_row_count: tuwSeedRows.length,
    tuw_seed_ready_count: tuwSeedRows.filter((row) => row.decomposition_status === "ready_for_fe2_work_packet_breakdown").length,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeFixtureRows.filter((row) => row.fixture_status === "blocked_as_expected").length,
    raw_prd_text_persisted_in_artifact: false,
    source_span_hash_binding_required: true,
    fe2_work_packet_generation_allowed_next: boundary.fe2_work_packet_generation_allowed_next,
    fe2_work_packet_execution_allowed_now: false,
    validation_errors: validation.errors.length,
    ...AUTHORITY_CLOSED,
  };
}

function buildSourceStatus({ prdSource, text, headings, functionalSections, expectedSourceSha256, sha256 }) {
  const reasons = [];
  if (!prdSource.available) reasons.push("source_unavailable");
  if (text.trim().length === 0) reasons.push("source_empty");
  if (!HASH_RE.test(sha256 ?? "")) reasons.push("source_hash_missing");
  if (expectedSourceSha256 && expectedSourceSha256 !== sha256) reasons.push("source_sha_mismatch");
  if (headings.length < 50) reasons.push("insufficient_heading_coverage");
  if (functionalSections.length < REQUIRED_FUNCTIONAL_SECTION_PREFIXES.length) reasons.push("functional_requirements_missing");
  return {
    status: reasons.length === 0 ? "ready_source_bound" : "blocked_source_intake",
    reasons,
  };
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-prd-intake-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function renderMarkdown(result) {
  return [
    "# Factory PRD Intake",
    "",
    `Status: ${result.summary.factory_prd_intake_status}`,
    `Program: ${result.summary.program_range}`,
    `Source: ${result.summary.prd_source_path}`,
    `Source SHA-256: ${result.summary.prd_source_sha256}`,
    `Source spans: ${result.summary.source_span_count}`,
    `Requirement rows: ${result.summary.requirement_row_count}`,
    `TUW seed rows: ${result.summary.tuw_seed_row_count}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Command execution enabled: ${result.summary.command_execution_enabled}`,
    `Gate opening allowed: ${result.summary.gate_opening_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function inferRequirementKind(title) {
  const key = title.toLowerCase();
  if (key.includes("tenant") || key.includes("workspace")) return "workspace_tenant_os";
  if (key.includes("domain pack") || key.includes("registry")) return "domain_pack_registry";
  if (key.includes("goal") || key.includes("plan") || key.includes("work packet")) return "goal_plan_work_packet";
  if (key.includes("workflow")) return "workflow_loop";
  if (key.includes("evidence")) return "evidence_os";
  if (key.includes("connector") || key.includes("resource")) return "connector_resource_governance";
  if (key.includes("context") || key.includes("memory")) return "context_memory_grounding";
  if (key.includes("review") || key.includes("gate")) return "review_gate_plane";
  if (key.includes("agent") || key.includes("tool")) return "agent_runtime_governance";
  if (key.includes("console") || key.includes("ui")) return "operator_console_ui";
  if (key.includes("collaboration") || key.includes("notification")) return "collaboration_notification";
  if (key.includes("reporting") || key.includes("analytics") || key.includes("trust ledger")) return "reporting_analytics_trust";
  if (key.includes("admin") || key.includes("security") || key.includes("billing")) return "admin_security_billing";
  if (key.includes("developer") || key.includes("sdk") || key.includes("marketplace")) return "developer_platform_marketplace";
  if (key.includes("deployment") || key.includes("release")) return "deployment_release_governance";
  return "functional_requirement";
}

function buildForbiddenAffordances() {
  return [
    "create_project",
    "append_ledger",
    "advance_ps3",
    "open_gate",
    "write_candidate_manifest",
    "execute_command",
    "apply_candidate",
    "merge_branch",
    "call_connector",
    "deploy",
    "grant_production_pass",
    "grant_enterprise_pass",
  ];
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((key) => value[key] === false);
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const { markdown: _markdown, ...rest } = result;
  return rest;
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, text: await readFile(resolved, "utf8") };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.code ?? error.message };
  }
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return { path: resolved, available: true, data: JSON.parse(await readFile(resolved, "utf8")) };
  } catch (error) {
    return { path: resolved, available: false, data: null, error: error.code ?? error.message };
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? DEFAULT_FACTORY_PRD_INTAKE_INPUTS.packagePath),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? DEFAULT_FACTORY_PRD_INTAKE_INPUTS.structuredSummaryPath),
    prd_path: path.resolve(repoRoot, options.prdPath ?? DEFAULT_FACTORY_PRD_INTAKE_INPUTS.prdPath),
  };
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function hashString(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function extractHeadingNumber(title) {
  return /^(\d+(?:\.\d+)*)\b/.exec(title)?.[1] ?? null;
}

function stripHeadingNumber(title) {
  return title.replace(/^\d+(?:\.\d+)*\s+/, "").trim();
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--prd-path") parsed.prdPath = argv[++index];
    else if (arg === "--package-path") parsed.packagePath = argv[++index];
    else if (arg === "--structured-summary-path") parsed.structuredSummaryPath = argv[++index];
    else if (arg === "--expected-source-sha256") parsed.expectedSourceSha256 = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--commit-ref") parsed.commitRef = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:prd-intake -- [--check] [--require-pass] [--out-dir DIR]

Builds the FE.1 PRD intake source-binding read model from the Hermes Enterprise
SaaS specification. This command does not open G-series gates, execute commands,
write repositories, or apply candidates.

Options:
  --check                         Validate without writing artifacts.
  --require-pass                  Require ready_factory_prd_intake status.
  --no-write                      Build in memory only.
  --out-dir DIR                   Output directory.
  --prd-path FILE                 PRD markdown source path.
  --expected-source-sha256 HASH   Optional source hash guard.
  --run-at ISO_DATE               Deterministic timestamp for tests.
  --commit-ref REF                Deterministic commit ref for tests.
`);
}
