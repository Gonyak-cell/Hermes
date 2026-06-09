import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopRunLedgerProjection } from "./hermes-loop-run-ledger-projection.mjs";

export const DEFAULT_HERMES_LOOP_CONTEXT_MEMORY_OUT_DIR = "artifacts/hermes-loop-context-memory-grounding/latest";
export const DEFAULT_HERMES_LOOP_CONTEXT_MEMORY_INPUTS = {
  schemaPath: "schemas/hermes-loop-context-memory-grounding.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p61601-p62000.md",
  architectureDocPath: "docs/architecture.md",
  sourceRunLedgerPath: "artifacts/hermes-loop-run-ledger-projection/latest/hermes-loop-run-ledger-projection.json",
};

const COMMAND_NAME = "platform:hermes-loop-context-memory-grounding";
const SCHEMA_VERSION = "hermes-loop-context-memory-grounding.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_context_memory_grounding";
const PROGRAM_RANGE = "P61601-P62000";
const SOURCE_PROGRAM_RANGE = "P61201-P61600";
const NEXT_PROGRAM_RANGE = "P62001-P62400";

const CONTEXT_FIELDS = [
  "source inventory",
  "source classification",
  "boundary filter",
  "redaction marker",
  "citation map",
  "source span map",
  "conflict detector",
  "stale source marker",
  "privilege/confidentiality marker",
  "prompt injection marker",
  "context size and cost estimate",
  "model routing hint",
];

const CITATION_BINDINGS = [
  "grounded evidence",
  "citation",
  "source status",
  "domain boundary",
  "freshness policy",
  "context_bundle_ref",
  "source span",
];

const MEMORY_OPERATIONS = [
  "Archive",
  "Sync",
  "Index",
  "Search",
  "Extract",
  "Consolidate",
  "Relate",
  "Recall",
];

const GUARD_ROWS = [
  ["stale_source_marker", "stale source marker"],
  ["source_conflict_marker", "conflict detector"],
  ["domain_boundary_guard", "domain boundary"],
  ["cross_domain_recall_block", "cross-domain recall blocked"],
  ["uncited_recall_block", "uncited recall blocked"],
  ["prompt_injection_boundary", "prompt injection boundary"],
  ["privilege_marker", "privilege/confidentiality marker"],
];

const RAW_EXPOSURE_ROWS = [
  ["raw_full_source_body_false", "raw/full source body 노출은 기본 false다"],
  ["raw_full_transcript_body_non_exposure", "raw/full transcript body non-exposure"],
  ["redacted_summary_only", "redacted summary only by default"],
  ["secret_bearing_response_block", "secret-bearing key response block"],
  ["auto_context_mutation_false", "Context Builder는 source material을 임의로 요약해 truth로 승격하지 않는다"],
];

const NEGATIVE_FIXTURES = [
  "missing_p61600_run_ledger_source",
  "p61600_validation_invalid",
  "missing_context_bundle_field",
  "missing_citation_or_source_span",
  "uncited_recall",
  "stale_source_as_current",
  "cross_domain_recall",
  "raw_full_body_exposure",
  "prompt_injection_marker_missing",
  "source_conflict_unresolved",
  "authority_carryover_true",
  "missing_p62001_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "raw_full_body_exposure_allowed_now",
  "runtime_recall_truth_allowed_now",
  "auto_context_mutation_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-context-memory-grounding.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-context-memory-grounding.mjs"],
  ["unit.test", "node --test test/hermes-loop-context-memory-grounding.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-context-memory-grounding -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-context-memory-grounding.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopContextMemoryGrounding(options = {}) {
  const result = await buildHermesLoopContextMemoryGrounding(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop context memory grounding failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopContextMemoryGrounding(result, result.output_dir);
  return result;
}

export async function buildHermesLoopContextMemoryGrounding(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_CONTEXT_MEMORY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceRunLedger = Object.prototype.hasOwnProperty.call(options, "sourceRunLedger")
    ? normalizeInlineJsonSource("inline.hermes_loop_run_ledger_projection", options.sourceRunLedger)
    : await readSourceRunLedger(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP61600SourceRows({ sourceRunLedger, generatedAt });
  const contextRows = buildMarkerRows("context_bundle_contract", CONTEXT_FIELDS, sourceSpec, options.omitContextField, generatedAt);
  const citationRows = buildMarkerRows("citation_source_span_binding", CITATION_BINDINGS, sourceSpec, options.omitCitationBinding, generatedAt);
  const memoryRows = buildMarkerRows("memory_operation_candidate", MEMORY_OPERATIONS, sourceSpec, options.omitMemoryOperation, generatedAt);
  const guardRows = buildGuardRows({ sourceSpec, omitId: options.omitGuard, generatedAt });
  const rawRows = buildRawExposureRows({ sourceSpec, omitId: options.omitRawExposureRow, generatedAt });
  const authorityRows = buildAuthorityRows({ sourceRunLedger, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      hermes_loop_system_specification_path: sourceSpec.path,
      p61600_run_ledger_source_path: sourceRunLedger.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_context_memory_contract: {
      contract_id: "hermes_loop_system_v1_1_context_memory_grounding",
      roadmap_phase: "Phase C: Context and Memory Grounding",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p61600_run_ledger_source_rows: sourceRows,
    context_bundle_contract_rows: contextRows,
    citation_source_span_binding_rows: citationRows,
    memory_operation_candidate_rows: memoryRows,
    stale_conflict_domain_guard_rows: guardRows,
    raw_body_non_exposure_rows: rawRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_context_memory_wiring_rows: wiringRows,
    p62000_closeout_rows: closeoutRows,
    p62001_next_phase_handoff_rows: handoffRows,
    hermes_loop_context_memory_boundary: boundary,
    hermes_loop_context_memory_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_context_memory_grounding")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_context_memory_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_context_memory_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopContextMemoryGrounding(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-context-memory-grounding.json"), serializableResult(result));
  await writeJson(path.join(outDir, "context-bundle-contract-rows.json"), collectionEnvelope("context-bundle-contract-rows.v1", "context_bundle_contract_rows", result.context_bundle_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "citation-source-span-binding-rows.json"), collectionEnvelope("citation-source-span-binding-rows.v1", "citation_source_span_binding_rows", result.citation_source_span_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "memory-operation-candidate-rows.json"), collectionEnvelope("memory-operation-candidate-rows.v1", "memory_operation_candidate_rows", result.memory_operation_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "raw-body-non-exposure-rows.json"), collectionEnvelope("raw-body-non-exposure-rows.v1", "raw_body_non_exposure_rows", result.raw_body_non_exposure_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62000-closeout-rows.json"), collectionEnvelope("p62000-closeout-rows.v1", "p62000_closeout_rows", result.p62000_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62001-next-phase-handoff-rows.json"), collectionEnvelope("p62001-next-phase-handoff-rows.v1", "p62001_next_phase_handoff_rows", result.p62001_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopContextMemoryGroundingCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopContextMemoryGrounding(args);
  console.log(`Hermes Loop context memory grounding ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_context_memory_status}`);
  console.log(`P61600 source ready: ${result.summary.p61600_source_ready_now}`);
  console.log(`Context memory ready: ${result.summary.p62000_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p62001_handoff}`);
  console.log(`Raw/full body exposure allowed: ${result.summary.raw_full_body_exposure_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP61600SourceRows({ sourceRunLedger, generatedAt }) {
  const summary = sourceRunLedger.data?.summary ?? {};
  const boundary = sourceRunLedger.data?.hermes_loop_run_ledger_boundary ?? {};
  return [
    row("source.p61600_available", "p61600_run_ledger_source", "P61600 run ledger source available or rebuilt", sourceRunLedger.available === true, sourceRunLedger.path, generatedAt),
    row("source.p61600_program", "p61600_run_ledger_source", "P61600 source program range matches", sourceRunLedger.data?.program_range === SOURCE_PROGRAM_RANGE, sourceRunLedger.path, generatedAt),
    row("source.p61600_validation", "p61600_run_ledger_source", "P61600 source validation is valid", sourceRunLedger.data?.validation?.valid === true, sourceRunLedger.path, generatedAt),
    row("source.p61600_handoff", "p61600_run_ledger_source", "P61600 is ready for P61601 handoff", summary.ready_for_p61601_handoff === true, sourceRunLedger.path, generatedAt),
    row("source.p61600_authority_closed", "p61600_run_ledger_source", "P61600 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceRunLedger.path, generatedAt),
  ];
}

function buildMarkerRows(category, markers, sourceSpec, omitId, generatedAt) {
  const text = sourceSpec.text ?? "";
  return markers.filter((marker) => marker !== omitId).map((marker) => row(
    `${category}.${normalizeId(marker)}`,
    category,
    `${marker} grounded`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { marker },
  ));
}

function buildGuardRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return GUARD_ROWS.filter(([guardId]) => guardId !== omitId).map(([guardId, marker]) => row(
    `guard.${guardId}`,
    "stale_conflict_domain_guard",
    `${guardId} guard visible`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { guard_id: guardId },
  ));
}

function buildRawExposureRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return RAW_EXPOSURE_ROWS.filter(([rowId]) => rowId !== omitId).map(([rowId, marker]) => row(
    `raw_exposure.${rowId}`,
    "raw_body_non_exposure",
    `${rowId} remains blocked`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { raw_exposure_allowed_now: false },
  ));
}

function buildAuthorityRows({ sourceRunLedger, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceRunLedger.data?.hermes_loop_run_ledger_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceRunLedger.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P62000 closeout`,
    true,
    "docs/hermes-roadmap-p61601-p62000.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-context-memory-grounding.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P61601-P62000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P61601-P62000") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p61601-p62000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P61601-P62000 context memory grounding", architectureDoc.available && architectureDoc.text.includes("P61601-P62000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p62000.p61600_source_ready", "P61600 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p62000.context_bundle", "Context bundle contract rows pass", contextRows.every(pass), generatedAt),
    closeoutRow("p62000.citation_source_span", "Citation/source span rows pass", citationRows.every(pass), generatedAt),
    closeoutRow("p62000.memory_operations", "Memory operation candidate rows pass", memoryRows.every(pass), generatedAt),
    closeoutRow("p62000.guards", "Stale/conflict/domain guard rows pass", guardRows.every(pass), generatedAt),
    closeoutRow("p62000.raw_body_non_exposure", "Raw/full body non-exposure rows pass", rawRows.every(pass), generatedAt),
    closeoutRow("p62000.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p62000.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p62000.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p62000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p62001_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes context and memory grounding`, ready, "artifacts/hermes-loop-context-memory-grounding/latest/hermes-loop-context-memory-grounding.json", generatedAt, {
      next_allowed_action: ready ? "implement_bounded_dag_topology" : "resolve_p62000_closeout_blockers",
    }),
    row("handoff.phase_d_boundary", "next_phase_handoff", "Next phase starts DAG topology without unbounded cycles", true, "docs/hermes-loop-system-specification.md#phase-d", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p62000_contract_ready: closeoutRows.every(pass),
    p61600_source_ready_now: sourceRows.every(pass),
    context_bundle_contract_ready_now: contextRows.every(pass),
    citation_source_span_binding_ready_now: citationRows.every(pass),
    memory_operation_candidate_ready_now: memoryRows.every(pass),
    stale_conflict_domain_guard_ready_now: guardRows.every(pass),
    raw_body_non_exposure_ready_now: rawRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p62001_handoff: handoffRows.every(pass),
    context_bundle_row_count: contextRows.length,
    citation_source_span_row_count: citationRows.length,
    memory_operation_row_count: memoryRows.length,
    guard_row_count: guardRows.length,
    raw_body_non_exposure_row_count: rawRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, contextRows, citationRows, memoryRows, guardRows, rawRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p61600", "source_binding", sourceRows.every(pass), "P61600 source must be valid and ready"),
    validationItem("rows.context", "context", contextRows.length === CONTEXT_FIELDS.length && contextRows.every(pass), "Context bundle rows must pass"),
    validationItem("rows.citation", "citation", citationRows.length === CITATION_BINDINGS.length && citationRows.every(pass), "Citation/source span rows must pass"),
    validationItem("rows.memory", "memory", memoryRows.length === MEMORY_OPERATIONS.length && memoryRows.every(pass), "Memory operation rows must pass"),
    validationItem("rows.guards", "guard", guardRows.length === GUARD_ROWS.length && guardRows.every(pass), "Guard rows must pass"),
    validationItem("rows.raw_exposure", "raw_exposure", rawRows.length === RAW_EXPOSURE_ROWS.length && rawRows.every(pass), "Raw body non-exposure rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P62000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P62001 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p62000_contract_ready === true, "P62000 contract must be ready"),
    validationItem("boundary.raw_false", "authority_boundary", boundary.raw_full_body_exposure_allowed_now === false, "Raw/full body exposure must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p62001_handoff
    ? "ready_for_p62001_handoff"
    : validation.valid
      ? "valid_block_p62001_handoff_pending"
      : "blocked_hermes_loop_context_memory_grounding";
  return {
    hermes_loop_context_memory_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p61600_source_ready_now: boundary.p61600_source_ready_now,
    p62000_contract_ready: boundary.p62000_contract_ready,
    ready_for_p62001_handoff: boundary.ready_for_p62001_handoff,
    context_bundle_row_count: boundary.context_bundle_row_count,
    memory_operation_row_count: boundary.memory_operation_row_count,
    guard_row_count: boundary.guard_row_count,
    raw_body_non_exposure_row_count: boundary.raw_body_non_exposure_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceRunLedger(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_run_ledger_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopRunLedgerProjection({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_run_ledger_projection", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Context Memory Grounding ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_context_memory_status}`,
    `- p61600_source_ready_now: ${result.summary.p61600_source_ready_now}`,
    `- p62000_contract_ready: ${result.summary.p62000_contract_ready}`,
    `- ready_for_p62001_handoff: ${result.summary.ready_for_p62001_handoff}`,
    `- raw_full_body_exposure_allowed_now: ${result.summary.raw_full_body_exposure_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p62001_handoff
      ? "Implement P62001-P62400 DAG and Worker/Verifier Topology with bounded correction edges and stop nodes."
      : "Resolve P62000 source, context, citation, memory, guard, raw exposure, authority, wiring, or handoff blockers before P62001.",
    "",
  ].join("\n");
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_contract_buildout" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined({
      marker: extra.marker,
      guard_id: extra.guard_id,
      raw_exposure_allowed_now: extra.raw_exposure_allowed_now,
      authority_flag: extra.authority_flag,
      allowed_now: extra.allowed_now,
      fixture_id: extra.fixture_id,
      expected_verdict: extra.expected_verdict,
      command_id: extra.command_id,
      mutating: extra.mutating,
    }),
  };
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p62000_closeout", label, observed, "artifacts/hermes-loop-context-memory-grounding/latest/hermes-loop-context-memory-grounding.json", generatedAt);
}

function pass(item) {
  return item.current_verdict === "pass";
}

function validationItem(id, category, passed, message) {
  return { validation_id: id, category, passed: passed === true, severity: passed === true ? "info" : "error", message: passed === true ? `${id} passed` : message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return { valid: errors.length === 0, error_count: errors.length, errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })) };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_HERMES_LOOP_CONTEXT_MEMORY_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_run_ledger_path: path.resolve(repoRoot, options.sourceRunLedgerPath ?? defaults.sourceRunLedgerPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { path: sourceId, available: true, data, text: JSON.stringify(data) };
}

function normalizeInlineTextSource(sourceId, text) {
  return { path: sourceId, available: true, text: String(text ?? "") };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--source-run-ledger") args.sourceRunLedgerPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-run-ledger PATH]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
