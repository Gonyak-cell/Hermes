import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopReviewGateIntegration } from "./hermes-loop-review-gate-integration.mjs";

export const DEFAULT_HERMES_LOOP_FINAL_FREEZE_OUT_DIR = "artifacts/hermes-loop-final-freeze/latest";
export const DEFAULT_HERMES_LOOP_FINAL_FREEZE_INPUTS = {
  schemaPath: "schemas/hermes-loop-final-freeze.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p63601-p64000.md",
  architectureDocPath: "docs/architecture.md",
  sourceReviewGatePath: "artifacts/hermes-loop-review-gate-integration/latest/hermes-loop-review-gate-integration.json",
};

const COMMAND_NAME = "platform:hermes-loop-final-freeze";
const SCHEMA_VERSION = "hermes-loop-final-freeze.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_final_freeze";
const PROGRAM_RANGE = "P63601-P64000";
const SOURCE_PROGRAM_RANGE = "P63201-P63600";
const NEXT_PROGRAM_RANGE = "POST-P64000";

const READ_ONLY_PROJECTION_ROWS = [
  "current goal",
  "phase status",
  "workflow run status",
  "evidence readiness",
  "review state",
  "gate state",
  "receipt state",
  "worker/verifier state",
  "DAG node state",
  "model route status",
  "budget status",
  "blocker",
  "next allowed action",
  "authority boundary",
  "cost/token/latency summary",
  "GET/HEAD-only",
];

const DASHBOARD_STATUS_ROWS = [
  "project",
  "domain pack",
  "loop name",
  "workflow run",
  "current DSL state",
  "DAG state",
  "worker output state",
  "verifier steering state",
  "source freshness",
  "evidence readiness",
  "model route readiness",
  "budget margin",
  "review readiness",
  "human gate readiness",
  "blocker",
  "next allowed action",
  "authority flags",
  "cost/token/latency",
  "last updated",
  "no protected UI action",
];

const CONTROLLED_EXECUTION_CANDIDATE_ROWS = [
  "action class registry",
  "receipt-gated candidate lane",
  "command allowlist",
  "write scope policy",
  "rollback/recovery binding",
  "post-action validation",
  "candidate exists",
  "no automatic apply",
  "review and human receipt required for protected action",
];

const FREEZE_MATRIX_ROWS = [
  "Existing workflow, runtime, evidence, review, gate, receipt contracts are reused rather than replaced.",
  "Every Loop Run exposes source refs, evidence refs, review refs, gate refs, receipt refs, blocker, next allowed action.",
  "Every high-risk Worker output has a Verifier run or an explicit block reason.",
  "Every Loop Run has a bounded DAG or a reason it is single-step.",
  "Every model route has policy, redaction, and cost gates.",
  "Every repeated verifier correction consumes retry and budget allowance.",
  "All authority flags are explicit.",
  "Missing evidence blocks PASS.",
  "Missing review receipt blocks high-risk closeout.",
  "Missing human receipt blocks protected action.",
  "Memory recall requires citation and source status.",
  "Connector write remains false by default.",
  "API projection remains read-only by default.",
  "Dashboard makes blocked state visible instead of hiding it.",
  "no production PASS claim",
];

const NEGATIVE_FIXTURES = [
  "missing_p63600_review_gate_source",
  "p63600_validation_invalid",
  "missing_read_only_projection_row",
  "missing_dashboard_blocker_row",
  "missing_authority_flags_visible",
  "protected_ui_action_enabled",
  "api_mutation_enabled",
  "automatic_apply_enabled",
  "candidate_execution_enabled",
  "missing_evidence_pass",
  "production_pass_claim",
  "enterprise_pass_claim",
  "authority_carryover_true",
];

const EXTRA_FALSE_FLAGS = [
  "ui_protected_action_allowed_now",
  "api_mutation_allowed_now",
  "automatic_apply_allowed_now",
  "candidate_execution_allowed_now",
  "p64000_production_pass_claim_allowed_now",
  "p64000_enterprise_pass_claim_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-final-freeze.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-final-freeze.mjs"],
  ["unit.test", "node --test test/hermes-loop-final-freeze.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-final-freeze -- --check"],
  ["loop.regression", "node --test test/hermes-loop-source-binding.test.mjs test/hermes-loop-overlay-contract.test.mjs test/hermes-loop-agent-control-contract.test.mjs test/hermes-loop-run-ledger-projection.test.mjs test/hermes-loop-context-memory-grounding.test.mjs test/hermes-loop-dag-topology.test.mjs test/hermes-loop-model-budget-control.test.mjs test/hermes-loop-runtime-tool-governance.test.mjs test/hermes-loop-review-gate-integration.test.mjs test/hermes-loop-final-freeze.test.mjs"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-final-freeze.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopFinalFreeze(options = {}) {
  const result = await buildHermesLoopFinalFreeze(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop final freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopFinalFreeze(result, result.output_dir);
  return result;
}

export async function buildHermesLoopFinalFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_FINAL_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceReviewGate = Object.prototype.hasOwnProperty.call(options, "sourceReviewGate")
    ? normalizeInlineJsonSource("inline.hermes_loop_review_gate_integration", options.sourceReviewGate)
    : await readSourceReviewGate(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP63600SourceRows({ sourceReviewGate, generatedAt });
  const projectionRows = buildMarkerRows("read_only_projection_contract", READ_ONLY_PROJECTION_ROWS, sourceSpec, options.omitProjectionRow, generatedAt);
  const dashboardRows = buildMarkerRows("dashboard_status_projection", DASHBOARD_STATUS_ROWS, sourceSpec, options.omitDashboardRow, generatedAt);
  const candidateRows = buildMarkerRows("controlled_execution_candidate_boundary", CONTROLLED_EXECUTION_CANDIDATE_ROWS, sourceSpec, options.omitCandidateBoundaryRow, generatedAt);
  const freezeRows = buildMarkerRows("p64000_freeze_matrix", FREEZE_MATRIX_ROWS, sourceSpec, options.omitFreezeMatrixRow, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceReviewGate, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p63600_review_gate_source_path: sourceReviewGate.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_final_freeze_contract: {
      contract_id: "hermes_loop_system_v1_1_final_freeze",
      roadmap_phase: "Phase H/I: Read-Only UI/API Projection and Controlled Execution Candidate Boundary",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p63600_review_gate_source_rows: sourceRows,
    read_only_projection_contract_rows: projectionRows,
    dashboard_status_projection_rows: dashboardRows,
    controlled_execution_candidate_boundary_rows: candidateRows,
    p64000_freeze_matrix_rows: freezeRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_final_freeze_wiring_rows: wiringRows,
    p64000_closeout_rows: closeoutRows,
    post_p64000_handoff_rows: handoffRows,
    hermes_loop_final_freeze_boundary: boundary,
    hermes_loop_final_freeze_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_final_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_final_freeze_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_final_freeze_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopFinalFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-final-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "read-only-projection-contract-rows.json"), collectionEnvelope("read-only-projection-contract-rows.v1", "read_only_projection_contract_rows", result.read_only_projection_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-status-projection-rows.json"), collectionEnvelope("dashboard-status-projection-rows.v1", "dashboard_status_projection_rows", result.dashboard_status_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-candidate-boundary-rows.json"), collectionEnvelope("controlled-execution-candidate-boundary-rows.v1", "controlled_execution_candidate_boundary_rows", result.controlled_execution_candidate_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p64000-freeze-matrix-rows.json"), collectionEnvelope("p64000-freeze-matrix-rows.v1", "p64000_freeze_matrix_rows", result.p64000_freeze_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "p64000-closeout-rows.json"), collectionEnvelope("p64000-closeout-rows.v1", "p64000_closeout_rows", result.p64000_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-p64000-handoff-rows.json"), collectionEnvelope("post-p64000-handoff-rows.v1", "post_p64000_handoff_rows", result.post_p64000_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopFinalFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopFinalFreeze(args);
  console.log(`Hermes Loop final freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_final_freeze_status}`);
  console.log(`P63600 source ready: ${result.summary.p63600_source_ready_now}`);
  console.log(`P64000 final freeze ready: ${result.summary.p64000_final_freeze_ready}`);
  console.log(`Post-P64000 handoff ready: ${result.summary.ready_for_post_p64000_handoff}`);
  console.log(`API mutation allowed: ${result.summary.api_mutation_allowed_now}`);
  console.log(`Automatic apply allowed: ${result.summary.automatic_apply_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP63600SourceRows({ sourceReviewGate, generatedAt }) {
  const summary = sourceReviewGate.data?.summary ?? {};
  const boundary = sourceReviewGate.data?.hermes_loop_review_gate_boundary ?? {};
  return [
    row("source.p63600_available", "p63600_review_gate_source", "P63600 review gate source available or rebuilt", sourceReviewGate.available === true, sourceReviewGate.path, generatedAt),
    row("source.p63600_program", "p63600_review_gate_source", "P63600 source program range matches", sourceReviewGate.data?.program_range === SOURCE_PROGRAM_RANGE, sourceReviewGate.path, generatedAt),
    row("source.p63600_validation", "p63600_review_gate_source", "P63600 source validation is valid", sourceReviewGate.data?.validation?.valid === true, sourceReviewGate.path, generatedAt),
    row("source.p63600_handoff", "p63600_review_gate_source", "P63600 is ready for P63601 handoff", summary.ready_for_p63601_handoff === true, sourceReviewGate.path, generatedAt),
    row("source.p63600_authority_closed", "p63600_review_gate_source", "P63600 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceReviewGate.path, generatedAt),
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

function buildAuthorityRows({ sourceReviewGate, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceReviewGate.data?.hermes_loop_review_gate_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceReviewGate.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P64000 closeout`,
    true,
    "docs/hermes-roadmap-p63601-p64000.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-final-freeze.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P63601-P64000 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P63601-P64000") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p63601-p64000.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P63601-P64000 final freeze", architectureDoc.available && architectureDoc.text.includes("P63601-P64000"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p64000.p63600_source_ready", "P63600 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p64000.read_only_projection", "Read-only projection rows pass", projectionRows.every(pass), generatedAt),
    closeoutRow("p64000.dashboard_status", "Dashboard status projection rows pass", dashboardRows.every(pass), generatedAt),
    closeoutRow("p64000.candidate_boundary", "Controlled execution candidate boundary rows pass", candidateRows.every(pass), generatedAt),
    closeoutRow("p64000.freeze_matrix", "P64000 freeze matrix rows pass", freezeRows.every(pass), generatedAt),
    closeoutRow("p64000.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p64000.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p64000.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p64000.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
    closeoutRow("p64000.no_production_enterprise_claim", "No production or enterprise PASS claim is opened", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.post_p64000_source", "post_p64000_handoff", "Post-P64000 work consumes final freeze evidence", ready, "artifacts/hermes-loop-final-freeze/latest/hermes-loop-final-freeze.json", generatedAt, {
      next_allowed_action: ready ? "plan_post_p64000_surface_or_production_readiness_without_claiming_current_production_pass" : "resolve_p64000_closeout_blockers",
    }),
    row("handoff.no_production_enterprise_claim", "post_p64000_handoff", "P64000 closeout is control-plane freeze only", true, "docs/hermes-loop-system-specification.md#acceptance-criteria", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p64000_final_freeze_ready: closeoutRows.every(pass),
    p63600_source_ready_now: sourceRows.every(pass),
    read_only_projection_ready_now: projectionRows.every(pass),
    dashboard_status_projection_ready_now: dashboardRows.every(pass),
    controlled_execution_candidate_boundary_ready_now: candidateRows.every(pass),
    p64000_freeze_matrix_ready_now: freezeRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_post_p64000_handoff: handoffRows.every(pass),
    read_only_projection_row_count: projectionRows.length,
    dashboard_status_row_count: dashboardRows.length,
    controlled_execution_candidate_row_count: candidateRows.length,
    freeze_matrix_row_count: freezeRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now || boundary.p64000_production_pass_claim_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now || boundary.p64000_enterprise_pass_claim_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, projectionRows, dashboardRows, candidateRows, freezeRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p63600", "source_binding", sourceRows.every(pass), "P63600 source must be valid and ready"),
    validationItem("rows.projection", "projection", projectionRows.length === READ_ONLY_PROJECTION_ROWS.length && projectionRows.every(pass), "Read-only projection rows must pass"),
    validationItem("rows.dashboard", "dashboard", dashboardRows.length === DASHBOARD_STATUS_ROWS.length && dashboardRows.every(pass), "Dashboard rows must pass"),
    validationItem("rows.candidate_boundary", "candidate_boundary", candidateRows.length === CONTROLLED_EXECUTION_CANDIDATE_ROWS.length && candidateRows.every(pass), "Controlled execution candidate boundary rows must pass"),
    validationItem("rows.freeze_matrix", "freeze_matrix", freezeRows.length === FREEZE_MATRIX_ROWS.length && freezeRows.every(pass), "P64000 freeze matrix rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P64000 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "Post-P64000 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p64000_final_freeze_ready === true, "P64000 final freeze must be ready"),
    validationItem("boundary.api_mutation_false", "authority_boundary", boundary.api_mutation_allowed_now === false, "API mutation must remain false"),
    validationItem("boundary.automatic_apply_false", "authority_boundary", boundary.automatic_apply_allowed_now === false, "Automatic apply must remain false"),
    validationItem("boundary.candidate_execution_false", "authority_boundary", boundary.candidate_execution_allowed_now === false, "Candidate execution must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_post_p64000_handoff
    ? "p64000_final_freeze_ready"
    : validation.valid
      ? "valid_block_post_p64000_handoff_pending"
      : "blocked_hermes_loop_final_freeze";
  return {
    hermes_loop_final_freeze_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p63600_source_ready_now: boundary.p63600_source_ready_now,
    p64000_final_freeze_ready: boundary.p64000_final_freeze_ready,
    ready_for_post_p64000_handoff: boundary.ready_for_post_p64000_handoff,
    read_only_projection_row_count: boundary.read_only_projection_row_count,
    dashboard_status_row_count: boundary.dashboard_status_row_count,
    controlled_execution_candidate_row_count: boundary.controlled_execution_candidate_row_count,
    freeze_matrix_row_count: boundary.freeze_matrix_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceReviewGate(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_review_gate_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopReviewGateIntegration({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_review_gate_integration", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Final Freeze ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_final_freeze_status}`,
    `- p63600_source_ready_now: ${result.summary.p63600_source_ready_now}`,
    `- p64000_final_freeze_ready: ${result.summary.p64000_final_freeze_ready}`,
    `- ready_for_post_p64000_handoff: ${result.summary.ready_for_post_p64000_handoff}`,
    `- api_mutation_allowed_now: ${result.summary.api_mutation_allowed_now}`,
    `- automatic_apply_allowed_now: ${result.summary.automatic_apply_allowed_now}`,
    `- candidate_execution_allowed_now: ${result.summary.candidate_execution_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_post_p64000_handoff
      ? "Plan post-P64000 work using this freeze evidence. Do not claim production or enterprise PASS from this control-plane freeze."
      : "Resolve P64000 source, projection, dashboard, candidate boundary, freeze matrix, authority, wiring, or handoff blockers.",
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
  return row(rowId, "p64000_closeout", label, observed, "artifacts/hermes-loop-final-freeze/latest/hermes-loop-final-freeze.json", generatedAt);
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
  const defaults = DEFAULT_HERMES_LOOP_FINAL_FREEZE_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_review_gate_path: path.resolve(repoRoot, options.sourceReviewGatePath ?? defaults.sourceReviewGatePath),
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
    else if (arg === "--source-review-gate") args.sourceReviewGatePath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-review-gate PATH]`);
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
