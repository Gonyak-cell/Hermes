import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopRuntimeToolGovernance } from "./hermes-loop-runtime-tool-governance.mjs";

export const DEFAULT_HERMES_LOOP_REVIEW_GATE_OUT_DIR = "artifacts/hermes-loop-review-gate-integration/latest";
export const DEFAULT_HERMES_LOOP_REVIEW_GATE_INPUTS = {
  schemaPath: "schemas/hermes-loop-review-gate-integration.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p63201-p63600.md",
  architectureDocPath: "docs/architecture.md",
  sourceRuntimeToolPath: "artifacts/hermes-loop-runtime-tool-governance/latest/hermes-loop-runtime-tool-governance.json",
};

const COMMAND_NAME = "platform:hermes-loop-review-gate-integration";
const SCHEMA_VERSION = "hermes-loop-review-gate-integration.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_review_gate_integration";
const PROGRAM_RANGE = "P63201-P63600";
const SOURCE_PROGRAM_RANGE = "P62801-P63200";
const NEXT_PROGRAM_RANGE = "P63601-P64000";

const REVIEW_PACKET_FIELDS = [
  "scope",
  "source refs",
  "diff or output refs",
  "validation result",
  "risk flags",
  "DAG node scope",
  "worker output refs",
  "verifier finding refs",
  "model route and budget status",
  "evidence refs",
  "known blockers",
  "requested verdict",
  "authority boundary",
  "no-mutation instruction",
];

const REVIEW_RECEIPT_FIELDS = [
  "reviewer engine",
  "model id or human actor",
  "reviewed scope",
  "reviewed source refs",
  "reviewed worker output refs",
  "reviewed verifier finding refs",
  "findings",
  "severity",
  "blocking status",
  "raw receipt object ref if available",
  "normalized finding refs",
  "revalidation requirement",
];

const NORMALIZED_FINDING_LOOP_ROWS = [
  "normalized finding loop",
  "finding disposition",
  "correction receipt",
  "manual revalidation receipt",
  "reviewed verifier finding refs",
  "blocking status",
  "revalidation requirement",
  "no unresolved blocking finding",
  "unresolved blocking finding",
];

const HUMAN_GATE_ROWS = [
  "Human Gate는 사람이 검토, 승인, 반려, 수정, 보류, 조건부 허용을 기록하는 receipt-backed gate이다",
  "owner receipt",
  "protected approval receipt",
  "human owner receipt template",
  "protected closeout input mapping",
  "protected closeout",
  "external communication",
  "client-facing output",
  "legal-domain final work product",
  "release approval",
  "deployment",
  "connector write",
];

const PROTECTED_OUTPUT_GUARDS = [
  ["human_receipt_not_magic_pass", "Human receipt는 protected action 또는 closeout의 중요한 입력이지만, 그것만으로 enterprise independent trust나 production approval을 만들지 않는다"],
  ["claude_no_source_mutation_or_final", "Claude review는 source mutation이나 final approval을 만들 수 없다"],
  ["claude_cannot_final_approve", "Claude cannot final approve"],
  ["codex_cannot_self_approve", "Codex cannot self-approve"],
  ["human_not_enterprise_trust_alone", "human receipt does not create enterprise trust alone"],
  ["no_final_approval_by_agent", "no final approval by agent"],
  ["worker_self_approval_blocked", "worker self-approval"],
  ["codex_self_approval_blocked", "Codex self-approval"],
  ["claude_final_approval_blocked", "Claude final approval"],
  ["protected_action_requires_review_human", "review and human receipt required for protected action"],
];

const NEGATIVE_FIXTURES = [
  "missing_p63200_runtime_tool_source",
  "p63200_validation_invalid",
  "missing_review_packet_field",
  "missing_review_receipt_field",
  "unresolved_blocking_finding_accepted",
  "missing_human_receipt_for_protected_action",
  "human_receipt_treated_as_enterprise_trust",
  "claude_final_approval",
  "codex_self_approval",
  "protected_output_completion_without_human_gate",
  "authority_carryover_true",
  "missing_p63601_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "review_final_approval_allowed_now",
  "human_receipt_enterprise_trust_allowed_now",
  "protected_closeout_allowed_now",
  "protected_action_execution_allowed_now",
  "reviewer_source_mutation_allowed_now",
  "codex_self_approval_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-review-gate-integration.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-review-gate-integration.mjs"],
  ["unit.test", "node --test test/hermes-loop-review-gate-integration.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-review-gate-integration -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-review-gate-integration.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopReviewGateIntegration(options = {}) {
  const result = await buildHermesLoopReviewGateIntegration(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop review gate integration failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopReviewGateIntegration(result, result.output_dir);
  return result;
}

export async function buildHermesLoopReviewGateIntegration(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_REVIEW_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceRuntimeTool = Object.prototype.hasOwnProperty.call(options, "sourceRuntimeTool")
    ? normalizeInlineJsonSource("inline.hermes_loop_runtime_tool_governance", options.sourceRuntimeTool)
    : await readSourceRuntimeTool(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP63200SourceRows({ sourceRuntimeTool, generatedAt });
  const reviewPacketRows = buildMarkerRows("review_packet_contract", REVIEW_PACKET_FIELDS, sourceSpec, options.omitReviewPacketField, generatedAt);
  const reviewReceiptRows = buildMarkerRows("review_receipt_contract", REVIEW_RECEIPT_FIELDS, sourceSpec, options.omitReviewReceiptField, generatedAt);
  const findingRows = buildMarkerRows("normalized_finding_loop", NORMALIZED_FINDING_LOOP_ROWS, sourceSpec, options.omitFindingLoopRow, generatedAt);
  const humanGateRows = buildMarkerRows("human_gate_candidate", HUMAN_GATE_ROWS, sourceSpec, options.omitHumanGateRow, generatedAt);
  const protectedRows = buildTupleMarkerRows("protected_output_guard", PROTECTED_OUTPUT_GUARDS, sourceSpec, options.omitProtectedGuard, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceRuntimeTool, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p63200_runtime_tool_source_path: sourceRuntimeTool.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_review_gate_contract: {
      contract_id: "hermes_loop_system_v1_1_review_gate_integration",
      roadmap_phase: "Phase G: Review and Human Gate Integration",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p63200_runtime_tool_source_rows: sourceRows,
    review_packet_contract_rows: reviewPacketRows,
    review_receipt_contract_rows: reviewReceiptRows,
    normalized_finding_loop_rows: findingRows,
    human_gate_candidate_rows: humanGateRows,
    protected_output_guard_rows: protectedRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_review_gate_wiring_rows: wiringRows,
    p63600_closeout_rows: closeoutRows,
    p63601_next_phase_handoff_rows: handoffRows,
    hermes_loop_review_gate_boundary: boundary,
    hermes_loop_review_gate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_review_gate_integration")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_review_gate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_review_gate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopReviewGateIntegration(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-review-gate-integration.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-packet-contract-rows.json"), collectionEnvelope("review-packet-contract-rows.v1", "review_packet_contract_rows", result.review_packet_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-receipt-contract-rows.json"), collectionEnvelope("review-receipt-contract-rows.v1", "review_receipt_contract_rows", result.review_receipt_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "normalized-finding-loop-rows.json"), collectionEnvelope("normalized-finding-loop-rows.v1", "normalized_finding_loop_rows", result.normalized_finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "human-gate-candidate-rows.json"), collectionEnvelope("human-gate-candidate-rows.v1", "human_gate_candidate_rows", result.human_gate_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-output-guard-rows.json"), collectionEnvelope("protected-output-guard-rows.v1", "protected_output_guard_rows", result.protected_output_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p63600-closeout-rows.json"), collectionEnvelope("p63600-closeout-rows.v1", "p63600_closeout_rows", result.p63600_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p63601-next-phase-handoff-rows.json"), collectionEnvelope("p63601-next-phase-handoff-rows.v1", "p63601_next_phase_handoff_rows", result.p63601_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopReviewGateIntegrationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopReviewGateIntegration(args);
  console.log(`Hermes Loop review gate integration ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_review_gate_status}`);
  console.log(`P63200 source ready: ${result.summary.p63200_source_ready_now}`);
  console.log(`Review gate ready: ${result.summary.p63600_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p63601_handoff}`);
  console.log(`Review final approval allowed: ${result.summary.review_final_approval_allowed_now}`);
  console.log(`Protected closeout allowed: ${result.summary.protected_closeout_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP63200SourceRows({ sourceRuntimeTool, generatedAt }) {
  const summary = sourceRuntimeTool.data?.summary ?? {};
  const boundary = sourceRuntimeTool.data?.hermes_loop_runtime_tool_boundary ?? {};
  return [
    row("source.p63200_available", "p63200_runtime_tool_source", "P63200 runtime tool source available or rebuilt", sourceRuntimeTool.available === true, sourceRuntimeTool.path, generatedAt),
    row("source.p63200_program", "p63200_runtime_tool_source", "P63200 source program range matches", sourceRuntimeTool.data?.program_range === SOURCE_PROGRAM_RANGE, sourceRuntimeTool.path, generatedAt),
    row("source.p63200_validation", "p63200_runtime_tool_source", "P63200 source validation is valid", sourceRuntimeTool.data?.validation?.valid === true, sourceRuntimeTool.path, generatedAt),
    row("source.p63200_handoff", "p63200_runtime_tool_source", "P63200 is ready for P63201 handoff", summary.ready_for_p63201_handoff === true, sourceRuntimeTool.path, generatedAt),
    row("source.p63200_authority_closed", "p63200_runtime_tool_source", "P63200 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceRuntimeTool.path, generatedAt),
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

function buildTupleMarkerRows(category, markers, sourceSpec, omitId, generatedAt) {
  const text = sourceSpec.text ?? "";
  return markers.filter(([rowId]) => rowId !== omitId).map(([rowId, marker]) => row(
    `${category}.${rowId}`,
    category,
    `${rowId} grounded`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { marker },
  ));
}

function buildAuthorityRows({ sourceRuntimeTool, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceRuntimeTool.data?.hermes_loop_runtime_tool_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceRuntimeTool.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P63600 closeout`,
    true,
    "docs/hermes-roadmap-p63201-p63600.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-review-gate-integration.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P63201-P63600 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P63201-P63600") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p63201-p63600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P63201-P63600 review gate integration", architectureDoc.available && architectureDoc.text.includes("P63201-P63600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p63600.p63200_source_ready", "P63200 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p63600.review_packet", "Review packet rows pass", reviewPacketRows.every(pass), generatedAt),
    closeoutRow("p63600.review_receipt", "Review receipt rows pass", reviewReceiptRows.every(pass), generatedAt),
    closeoutRow("p63600.finding_loop", "Normalized finding loop rows pass", findingRows.every(pass), generatedAt),
    closeoutRow("p63600.human_gate", "Human gate candidate rows pass", humanGateRows.every(pass), generatedAt),
    closeoutRow("p63600.protected_output_guard", "Protected output guard rows pass", protectedRows.every(pass), generatedAt),
    closeoutRow("p63600.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p63600.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p63600.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p63600.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p63601_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes review gate integration`, ready, "artifacts/hermes-loop-review-gate-integration/latest/hermes-loop-review-gate-integration.json", generatedAt, {
      next_allowed_action: ready ? "implement_read_only_projection_and_p64000_freeze" : "resolve_p63600_closeout_blockers",
    }),
    row("handoff.phase_h_boundary", "next_phase_handoff", "Next phase starts read-only projection and final P64000 freeze without granting production or enterprise pass", true, "docs/hermes-loop-system-specification.md#phase-h", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p63600_contract_ready: closeoutRows.every(pass),
    p63200_source_ready_now: sourceRows.every(pass),
    review_packet_contract_ready_now: reviewPacketRows.every(pass),
    review_receipt_contract_ready_now: reviewReceiptRows.every(pass),
    normalized_finding_loop_ready_now: findingRows.every(pass),
    human_gate_candidate_ready_now: humanGateRows.every(pass),
    protected_output_guard_ready_now: protectedRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p63601_handoff: handoffRows.every(pass),
    review_packet_row_count: reviewPacketRows.length,
    review_receipt_row_count: reviewReceiptRows.length,
    finding_loop_row_count: findingRows.length,
    human_gate_row_count: humanGateRows.length,
    protected_guard_row_count: protectedRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, reviewPacketRows, reviewReceiptRows, findingRows, humanGateRows, protectedRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p63200", "source_binding", sourceRows.every(pass), "P63200 source must be valid and ready"),
    validationItem("rows.review_packet", "review_packet", reviewPacketRows.length === REVIEW_PACKET_FIELDS.length && reviewPacketRows.every(pass), "Review packet rows must pass"),
    validationItem("rows.review_receipt", "review_receipt", reviewReceiptRows.length === REVIEW_RECEIPT_FIELDS.length && reviewReceiptRows.every(pass), "Review receipt rows must pass"),
    validationItem("rows.finding_loop", "finding_loop", findingRows.length === NORMALIZED_FINDING_LOOP_ROWS.length && findingRows.every(pass), "Finding loop rows must pass"),
    validationItem("rows.human_gate", "human_gate", humanGateRows.length === HUMAN_GATE_ROWS.length && humanGateRows.every(pass), "Human gate rows must pass"),
    validationItem("rows.protected_guard", "protected_guard", protectedRows.length === PROTECTED_OUTPUT_GUARDS.length && protectedRows.every(pass), "Protected output guard rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P63600 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P63601 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p63600_contract_ready === true, "P63600 contract must be ready"),
    validationItem("boundary.review_final_false", "authority_boundary", boundary.review_final_approval_allowed_now === false, "Review final approval must remain false"),
    validationItem("boundary.human_enterprise_false", "authority_boundary", boundary.human_receipt_enterprise_trust_allowed_now === false, "Human receipt enterprise trust must remain false"),
    validationItem("boundary.protected_closeout_false", "authority_boundary", boundary.protected_closeout_allowed_now === false, "Protected closeout must remain false"),
    validationItem("boundary.reviewer_mutation_false", "authority_boundary", boundary.reviewer_source_mutation_allowed_now === false, "Reviewer source mutation must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p63601_handoff
    ? "ready_for_p63601_handoff"
    : validation.valid
      ? "valid_block_p63601_handoff_pending"
      : "blocked_hermes_loop_review_gate_integration";
  return {
    hermes_loop_review_gate_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p63200_source_ready_now: boundary.p63200_source_ready_now,
    p63600_contract_ready: boundary.p63600_contract_ready,
    ready_for_p63601_handoff: boundary.ready_for_p63601_handoff,
    review_packet_row_count: boundary.review_packet_row_count,
    review_receipt_row_count: boundary.review_receipt_row_count,
    finding_loop_row_count: boundary.finding_loop_row_count,
    human_gate_row_count: boundary.human_gate_row_count,
    protected_guard_row_count: boundary.protected_guard_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceRuntimeTool(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_runtime_tool_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopRuntimeToolGovernance({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_runtime_tool_governance", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Review Gate Integration ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_review_gate_status}`,
    `- p63200_source_ready_now: ${result.summary.p63200_source_ready_now}`,
    `- p63600_contract_ready: ${result.summary.p63600_contract_ready}`,
    `- ready_for_p63601_handoff: ${result.summary.ready_for_p63601_handoff}`,
    `- review_final_approval_allowed_now: ${result.summary.review_final_approval_allowed_now}`,
    `- human_receipt_enterprise_trust_allowed_now: ${result.summary.human_receipt_enterprise_trust_allowed_now}`,
    `- protected_closeout_allowed_now: ${result.summary.protected_closeout_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p63601_handoff
      ? "Implement P63601-P64000 read-only UI/API projection and P64000 final freeze evidence without production or enterprise PASS."
      : "Resolve P63600 source, review packet, receipt, finding, human gate, protected output, authority, wiring, or handoff blockers before P63601.",
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
  return row(rowId, "p63600_closeout", label, observed, "artifacts/hermes-loop-review-gate-integration/latest/hermes-loop-review-gate-integration.json", generatedAt);
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
  const defaults = DEFAULT_HERMES_LOOP_REVIEW_GATE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_runtime_tool_path: path.resolve(repoRoot, options.sourceRuntimeToolPath ?? defaults.sourceRuntimeToolPath),
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
    else if (arg === "--source-runtime-tool") args.sourceRuntimeToolPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-runtime-tool PATH]`);
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
