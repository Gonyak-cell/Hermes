import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildGlobalUiContract } from "./global-ui-contract.mjs";

export const DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_OUT_DIR = "artifacts/global-ui-design-foundation/latest";
export const DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS = {
  schemaPath: "schemas/global-ui-design-foundation.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p11201-p11400.md",
  architectureDocPath: "docs/architecture.md",
  sourceGlobalUiContractPath: "artifacts/global-ui-contract/latest/global-ui-contract.json",
};

const COMMAND_NAME = "platform:global-ui-design-foundation";
const SOURCE_COMMAND_NAME = "platform:global-ui-contract";
const SCHEMA_VERSION = "global-ui-design-foundation.v1";
const CAPABILITY_ID = "platform.global_ui_design_foundation";
const PROGRAM_RANGE = "P11201-P11400";
const SOURCE_PROGRAM_RANGE = "P11001-P11200";
const DESIGN_SYSTEM_RANGE = "P10801-P11800";
const SOURCE_READY_STATUS = "ready_for_global_ui_contract";
const READY_STATUS = "ready_for_global_ui_design_foundation";
const BLOCKED_STATUS = "blocked_global_ui_design_foundation";

const PHASE_SPECS = [
  ["P11201-P11220", "Design Token Registry", "design_token_rows"],
  ["P11221-P11240", "Table/List Primitive", "table_list_primitive_rows"],
  ["P11241-P11260", "Detail/Inspector Primitive", "detail_inspector_primitive_rows"],
  ["P11261-P11280", "Timeline Primitive", "timeline_primitive_rows"],
  ["P11281-P11300", "Boundary Notice And Receipt Rows", "boundary_notice_receipt_rows"],
  ["P11301-P11320", "Readiness Rule Matrix Primitive", "readiness_rule_matrix_rows"],
  ["P11321-P11340", "Review Evidence Trace Primitive", "review_evidence_trace_rows"],
  ["P11341-P11360", "Component State Matrix", "component_state_matrix_rows"],
  ["P11361-P11380", "UI Smoke Fixture Plan", "ui_smoke_fixture_plan_rows"],
  ["P11381-P11400", "Token/Component Foundation Freeze", "p11400_freeze_rows"],
];

const TOKEN_SPECS = [
  ["token.color.neutral", "color.neutral", ["background", "surface", "border", "text", "muted text"]],
  ["token.color.accent", "color.accent", ["restrained blue", "selected", "focus", "link"]],
  ["token.color.semantic", "color.semantic", ["amber", "red", "green", "status semantics"]],
  ["token.typography", "typography", ["fixed scale", "no viewport-width font scaling", "no negative letter spacing"]],
  ["token.spacing", "spacing", ["dense table", "detail rhythm", "readable"]],
  ["token.radius", "radius", ["4px", "8px"]],
  ["token.shadow", "shadow", ["low elevation only"]],
  ["token.motion", "motion", ["minimal", "non-authority state transition"]],
];

const TABLE_LIST_SPECS = [
  ["table.columns", "stable columns"],
  ["table.sort", "sorting"],
  ["table.density", "density"],
  ["table.overflow", "overflow handling"],
  ["table.selection", "selected row"],
  ["table.keyboard_focus", "keyboard focus"],
  ["table.no_layout_shift", "no layout shift"],
  ["table.scan_friendly", "scan-friendly rows"],
];

const DETAIL_INSPECTOR_SPECS = [
  ["detail.object_summary", "object summary"],
  ["detail.source_refs", "source refs"],
  ["detail.requirement_trace", "requirement trace"],
  ["detail.evidence_chain", "evidence chain"],
  ["detail.gate_state", "gate state"],
  ["detail.reviewer_authority", "reviewer authority"],
  ["detail.blocked_reason", "blocked reason"],
  ["detail.next_action", "next action"],
  ["detail.forbidden_actions", "forbidden actions"],
];

const TIMELINE_SPECS = [
  ["timeline.timestamp", "timestamp"],
  ["timeline.actor", "actor"],
  ["timeline.source", "source"],
  ["timeline.event_type", "event type"],
  ["timeline.artifact_ref", "artifact ref"],
  ["timeline.review_status", "review status"],
  ["timeline.linked_gate", "linked gate"],
];

const BOUNDARY_RECEIPT_SPECS = [
  ["boundary.blocked_reason", "blocked reason"],
  ["boundary.missing_evidence", "missing evidence"],
  ["boundary.receipt_required", "receipt required"],
  ["boundary.allowed_next_action", "allowed next action"],
  ["boundary.forbidden_action", "forbidden action"],
  ["boundary.rollback_target", "rollback target"],
  ["boundary.timeout", "timeout"],
  ["boundary.lower_trust_notice", "lower-trust notice"],
];

const READINESS_RULE_SPECS = [
  ["rule.pass", "PASS"],
  ["rule.block", "BLOCK"],
  ["rule.degraded", "degraded"],
  ["rule.missing_evidence", "missing evidence"],
  ["rule.review_pending", "review pending"],
  ["rule.lower_trust", "lower trust"],
  ["rule.not_kpi", "not a KPI scorecard"],
  ["rule.evidence_required", "evidence required"],
];

const REVIEW_TRACE_SPECS = [
  ["review_trace.reviewer_engine", "reviewer engine"],
  ["review_trace.receipt_ref", "receipt ref"],
  ["review_trace.finding", "finding"],
  ["review_trace.revalidation", "revalidation"],
  ["review_trace.authority_boundary", "authority boundary"],
  ["review_trace.no_final_approval", "not final approval"],
  ["review_trace.model_effort", "model and effort"],
  ["review_trace.raw_ref_only", "raw reference only"],
];

const COMPONENT_STATE_SPECS = [
  ["state.default", "default"],
  ["state.hover", "hover"],
  ["state.focus", "focus"],
  ["state.selected", "selected"],
  ["state.disabled", "disabled"],
  ["state.loading", "loading"],
  ["state.stale", "stale"],
  ["state.blocked", "blocked"],
  ["state.missing_evidence", "missing evidence"],
  ["state.review_pending", "review pending"],
];

const UI_SMOKE_SPECS = [
  ["smoke.nonblank_shell", "nonblank shell"],
  ["smoke.no_raw_secret", "no raw/secret"],
  ["smoke.no_write", "no write"],
  ["smoke.no_final_approval", "no final approval"],
  ["smoke.no_production_enterprise", "no production/enterprise PASS"],
  ["smoke.no_overlap", "no overlap"],
  ["smoke.text_fit", "text fit"],
  ["smoke.stable_dimensions", "stable dimensions"],
  ["smoke.no_hero_dashboard", "no hero/dashboard home"],
  ["smoke.read_only_state", "read-only state"],
];

export async function runGlobalUiDesignFoundation(options = {}) {
  const result = await buildGlobalUiDesignFoundation(options);
  if (options.write !== false) await writeGlobalUiDesignFoundation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Global UI design foundation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGlobalUiDesignFoundation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "globalUiContract")
    ? normalizeInlineJsonSource("inline.global_ui_contract", options.globalUiContract)
    : await readJsonOrBuildGlobalUiContract(inputs.source_global_ui_contract_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const tokenRows = buildDesignTokenRows(roadmapDoc.text, generatedAt);
  const tableListRows = buildPrimitiveRows(TABLE_LIST_SPECS, "table_list_primitive", "docs/hermes-roadmap-p11201-p11400.md#primitive-contract", roadmapDoc.text, generatedAt);
  const detailRows = buildPrimitiveRows(DETAIL_INSPECTOR_SPECS, "detail_inspector_primitive", "docs/hermes-roadmap-p11201-p11400.md#primitive-contract", roadmapDoc.text, generatedAt);
  const timelineRows = buildPrimitiveRows(TIMELINE_SPECS, "timeline_primitive", "docs/hermes-roadmap-p11201-p11400.md#primitive-contract", roadmapDoc.text, generatedAt);
  const boundaryRows = buildBoundaryReceiptRows(roadmapDoc.text, generatedAt);
  const ruleMatrixRows = buildReadinessRuleRows(roadmapDoc.text, generatedAt);
  const reviewTraceRows = buildReviewTraceRows(roadmapDoc.text, generatedAt);
  const stateRows = buildPrimitiveRows(COMPONENT_STATE_SPECS, "component_state_matrix", "docs/hermes-roadmap-p11201-p11400.md#phase-plan", roadmapDoc.text, generatedAt);
  const smokeRows = buildSmokeRows(roadmapDoc.text, generatedAt);
  const freezeRows = buildFreezeRows({ sourceBindingRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows }, generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, sourceBindingRows, phaseRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows, freezeRows });
  const boundary = buildBoundary({ source, sourceBindingRows, phaseRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, sourceBindingRows, phaseRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      global_ui_contract_path: source.path,
    },
    source_global_ui_contract_summary: source.data?.summary ?? null,
    global_ui_design_foundation_contract: contract,
    global_ui_design_foundation_phase_rows: phaseRows,
    p11001_source_binding_rows: sourceBindingRows,
    design_token_rows: tokenRows,
    table_list_primitive_rows: tableListRows,
    detail_inspector_primitive_rows: detailRows,
    timeline_primitive_rows: timelineRows,
    boundary_notice_receipt_rows: boundaryRows,
    readiness_rule_matrix_rows: ruleMatrixRows,
    review_evidence_trace_rows: reviewTraceRows,
    component_state_matrix_rows: stateRows,
    ui_smoke_fixture_plan_rows: smokeRows,
    p11400_freeze_rows: freezeRows,
    global_ui_design_foundation_gate_rows: gateRows,
    global_ui_design_foundation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ source, phaseRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows, freezeRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "global_ui_design_foundation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ source, phaseRows, tokenRows, tableListRows, detailRows, timelineRows, boundaryRows, ruleMatrixRows, reviewTraceRows, stateRows, smokeRows, freezeRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeGlobalUiDesignFoundation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "global-ui-design-foundation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "design-token-rows.json"), collectionEnvelope("design-token-rows.v1", "design_token_rows", result.design_token_rows, result.generated_at));
  await writeJson(path.join(outDir, "table-list-primitive-rows.json"), collectionEnvelope("table-list-primitive-rows.v1", "table_list_primitive_rows", result.table_list_primitive_rows, result.generated_at));
  await writeJson(path.join(outDir, "detail-inspector-primitive-rows.json"), collectionEnvelope("detail-inspector-primitive-rows.v1", "detail_inspector_primitive_rows", result.detail_inspector_primitive_rows, result.generated_at));
  await writeJson(path.join(outDir, "timeline-primitive-rows.json"), collectionEnvelope("timeline-primitive-rows.v1", "timeline_primitive_rows", result.timeline_primitive_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary-notice-receipt-rows.json"), collectionEnvelope("boundary-notice-receipt-rows.v1", "boundary_notice_receipt_rows", result.boundary_notice_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "readiness-rule-matrix-rows.json"), collectionEnvelope("readiness-rule-matrix-rows.v1", "readiness_rule_matrix_rows", result.readiness_rule_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-evidence-trace-rows.json"), collectionEnvelope("review-evidence-trace-rows.v1", "review_evidence_trace_rows", result.review_evidence_trace_rows, result.generated_at));
  await writeJson(path.join(outDir, "component-state-matrix-rows.json"), collectionEnvelope("component-state-matrix-rows.v1", "component_state_matrix_rows", result.component_state_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-smoke-fixture-plan-rows.json"), collectionEnvelope("ui-smoke-fixture-plan-rows.v1", "ui_smoke_fixture_plan_rows", result.ui_smoke_fixture_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "p11400-freeze-rows.json"), collectionEnvelope("p11400-freeze-rows.v1", "p11400_freeze_rows", result.p11400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-design-foundation-gate-rows.json"), collectionEnvelope("global-ui-design-foundation-gate-rows.v1", "global_ui_design_foundation_gate_rows", result.global_ui_design_foundation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-design-foundation-boundary.json"), result.global_ui_design_foundation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "global-ui-design-foundation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runGlobalUiDesignFoundationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runGlobalUiDesignFoundation(args);
    console.log(`Global UI design foundation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.global_ui_design_foundation_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Tokens: ${result.summary.token_count}`);
    console.log(`Component states: ${result.summary.component_state_count}`);
    console.log(`Ready for P11401 handoff: ${result.summary.ready_for_p11401_handoff}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const item of error.validation.errors) console.error(`- ${item.item_id}: ${item.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    contract_id: "global-ui-design-foundation.contract.v1",
    generated_at: generatedAt,
    source_global_ui_contract_required: true,
    source_ready_for_p11201_handoff_required: true,
    design_tokens_required: true,
    table_list_primitive_required: true,
    detail_inspector_primitive_required: true,
    timeline_primitive_required: true,
    boundary_notice_receipt_required: true,
    readiness_rule_matrix_required: true,
    review_evidence_trace_required: true,
    component_state_matrix_required: true,
    ui_smoke_fixture_plan_required: true,
    p11401_handoff_required: true,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    p11800_design_system_freeze_ready: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => {
    const observed = includesAll(roadmapText, [phaseRange, name, output]);
    return verdictRow({
      row_id: `phase.${phaseRange.toLowerCase()}`,
      category: "phase_plan",
      label: `${phaseRange} ${name}`,
      required: true,
      observed,
      evidence_ref: `docs/hermes-roadmap-p11201-p11400.md#${phaseRange}`,
      phase_range: phaseRange,
      output_ref: output,
      generated_at: generatedAt,
      block_reason: observed ? null : "Phase row missing from roadmap doc.",
    });
  });
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const rows = [
    ["source.available", "P11001-P11200 source artifact available", source.available],
    ["source.status", "P11001-P11200 source is ready", summary.global_ui_contract_status === SOURCE_READY_STATUS],
    ["source.handoff", "P11001 source ready for P11201 handoff", summary.ready_for_p11201_handoff === true],
    ["source.no_write", "P11001 source did not open write control", summary.write_control_enabled === false],
    ["source.no_final_approval", "P11001 source did not open final approval UI", summary.final_approval_ui_enabled === false],
    ["source.no_production_enterprise", "P11001 source did not open production or enterprise PASS UI", summary.production_pass_ui_enabled === false && summary.enterprise_pass_ui_enabled === false],
  ];
  return rows.map(([id, label, observed]) => verdictRow({
    row_id: id,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    block_reason: observed ? null : "P11001 source contract is missing or not safe for P11201.",
  }));
}

function buildDesignTokenRows(roadmapText, generatedAt) {
  return TOKEN_SPECS.map(([rowId, tokenName, uses]) => {
    const observed = roadmapText.includes(tokenName);
    return verdictRow({
      row_id: rowId,
      category: "design_token",
      label: tokenName,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11201-p11400.md#token-contract",
      generated_at: generatedAt,
      uses,
      hardcoded_value_allowed: false,
      viewport_font_scaling_allowed: false,
      negative_letter_spacing_allowed: false,
      authority_semantics_allowed: false,
      block_reason: observed ? null : "Design token missing from roadmap doc.",
    });
  });
}

function buildPrimitiveRows(specs, category, evidenceRef, roadmapText, generatedAt) {
  return specs.map(([rowId, label]) => {
    const observed = roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category,
      label,
      required: true,
      observed,
      evidence_ref: evidenceRef,
      generated_at: generatedAt,
      stable_dimensions_required: true,
      write_control_enabled: false,
      final_approval_enabled: false,
      raw_body_visible: false,
      block_reason: observed ? null : "Primitive row missing from roadmap doc.",
    });
  });
}

function buildBoundaryReceiptRows(roadmapText, generatedAt) {
  return BOUNDARY_RECEIPT_SPECS.map(([rowId, label]) => {
    const observed = roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category: "boundary_notice_receipt",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11201-p11400.md#primitive-contract",
      generated_at: generatedAt,
      display_as_notice: true,
      display_as_execution_button: false,
      receipt_input_enabled: false,
      protected_action_enabled: false,
      block_reason: observed ? null : "Boundary/receipt row missing from roadmap doc.",
    });
  });
}

function buildReadinessRuleRows(roadmapText, generatedAt) {
  return READINESS_RULE_SPECS.map(([rowId, label]) => {
    const observed = roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category: "readiness_rule_matrix",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11201-p11400.md#primitive-contract",
      generated_at: generatedAt,
      scorecard_kpi_allowed: false,
      evidence_required: true,
      production_claim_allowed: false,
      enterprise_claim_allowed: false,
      block_reason: observed ? null : "Readiness rule matrix row missing from roadmap doc.",
    });
  });
}

function buildReviewTraceRows(roadmapText, generatedAt) {
  return REVIEW_TRACE_SPECS.map(([rowId, label]) => {
    const observed = roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category: "review_evidence_trace",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11201-p11400.md#primitive-contract",
      generated_at: generatedAt,
      reviewer_final_approval_allowed: false,
      source_mutation_allowed: false,
      raw_review_body_visible: false,
      authority_boundary_visible: true,
      block_reason: observed ? null : "Review evidence trace row missing from roadmap doc.",
    });
  });
}

function buildSmokeRows(roadmapText, generatedAt) {
  return UI_SMOKE_SPECS.map(([rowId, label]) => {
    const observed = roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category: "ui_smoke_fixture_plan",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11201-p11400.md#phase-plan",
      generated_at: generatedAt,
      fixture_status: "PASS_BLOCKED_AS_EXPECTED",
      unsafe_claim_allowed: false,
      block_reason: observed ? null : "UI smoke fixture row missing from roadmap doc.",
    });
  });
}

function buildFreezeRows(context, generatedAt) {
  const specs = [
    ["freeze.source", "P11001 source binding ready", allPass(context.sourceBindingRows)],
    ["freeze.tokens", "Design token rows ready", allPass(context.tokenRows)],
    ["freeze.table_list", "Table/list primitive rows ready", allPass(context.tableListRows)],
    ["freeze.detail", "Detail/inspector primitive rows ready", allPass(context.detailRows)],
    ["freeze.timeline", "Timeline primitive rows ready", allPass(context.timelineRows)],
    ["freeze.boundary", "Boundary notice and receipt rows ready", allPass(context.boundaryRows)],
    ["freeze.rule_matrix", "Readiness Rule Matrix rows ready", allPass(context.ruleMatrixRows)],
    ["freeze.review_trace", "Review Evidence Trace rows ready", allPass(context.reviewTraceRows)],
    ["freeze.states", "Component State Matrix rows ready", allPass(context.stateRows)],
    ["freeze.smoke", "UI smoke fixture plan rows ready", allPass(context.smokeRows)],
    ["freeze.p11401_handoff", "P11401 Operator Queue UI v0 handoff ready", true],
    ["freeze.p11800_not_ready", "P11800 design-system freeze remains false", true],
    ["freeze.no_write", "No write/protected action opened", true],
    ["freeze.no_final_approval", "No final approval UI opened", true],
    ["freeze.no_production_enterprise", "No production or enterprise PASS opened", true],
  ];
  return specs.map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p11400_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p11400-freeze",
    generated_at: generatedAt,
    block_reason: observed ? null : "P11400 freeze prerequisite missing.",
  }));
}

function buildGateRows(context) {
  return [
    gateRow("gate.package_script", "Package script registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json#scripts"),
    gateRow("gate.validate_chain", "Package validate chain registered", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), "package.json#scripts.validate"),
    gateRow("gate.roadmap_doc", "P11201-P11400 roadmap doc present", context.roadmapDoc.available && context.roadmapDoc.text.includes(PROGRAM_RANGE), context.roadmapDoc.path),
    gateRow("gate.architecture_doc", "Architecture doc references P11201-P11400", context.architectureDoc.available && context.architectureDoc.text.includes("P11201-P11400"), context.architectureDoc.path),
    gateRow("gate.source", "P11001 source binding ready", allPass(context.sourceBindingRows), "p11001_source_binding_rows"),
    gateRow("gate.phase_rows", "P11201-P11400 phase rows ready", allPass(context.phaseRows), "global_ui_design_foundation_phase_rows"),
    gateRow("gate.tokens", "Design token rows ready", allPass(context.tokenRows), "design_token_rows"),
    gateRow("gate.table_list", "Table/list primitive rows ready", allPass(context.tableListRows), "table_list_primitive_rows"),
    gateRow("gate.detail", "Detail/inspector primitive rows ready", allPass(context.detailRows), "detail_inspector_primitive_rows"),
    gateRow("gate.timeline", "Timeline primitive rows ready", allPass(context.timelineRows), "timeline_primitive_rows"),
    gateRow("gate.boundary", "Boundary notice and receipt rows ready", allPass(context.boundaryRows), "boundary_notice_receipt_rows"),
    gateRow("gate.rule_matrix", "Readiness Rule Matrix rows ready", allPass(context.ruleMatrixRows), "readiness_rule_matrix_rows"),
    gateRow("gate.review_trace", "Review Evidence Trace rows ready", allPass(context.reviewTraceRows), "review_evidence_trace_rows"),
    gateRow("gate.states", "Component state rows ready", allPass(context.stateRows), "component_state_matrix_rows"),
    gateRow("gate.smoke", "UI smoke fixture plan rows ready", allPass(context.smokeRows), "ui_smoke_fixture_plan_rows"),
    gateRow("gate.freeze", "P11400 freeze rows ready", allPass(context.freezeRows), "p11400_freeze_rows"),
  ];
}

function buildBoundary(context) {
  const sourceSummary = context.source.data?.summary ?? {};
  const coreReady = [
    context.sourceBindingRows,
    context.phaseRows,
    context.tokenRows,
    context.tableListRows,
    context.detailRows,
    context.timelineRows,
    context.boundaryRows,
    context.ruleMatrixRows,
    context.reviewTraceRows,
    context.stateRows,
    context.smokeRows,
    context.freezeRows,
    context.gateRows,
  ].every(allPass);
  return {
    source_global_ui_contract_ready: sourceSummary.global_ui_contract_status === SOURCE_READY_STATUS,
    source_ready_for_p11201_handoff: sourceSummary.ready_for_p11201_handoff === true,
    global_ui_design_foundation_ready: coreReady,
    design_tokens_ready: allPass(context.tokenRows),
    table_list_primitives_ready: allPass(context.tableListRows),
    detail_inspector_primitives_ready: allPass(context.detailRows),
    timeline_primitives_ready: allPass(context.timelineRows),
    boundary_notice_receipt_ready: allPass(context.boundaryRows),
    readiness_rule_matrix_ready: allPass(context.ruleMatrixRows),
    review_evidence_trace_ready: allPass(context.reviewTraceRows),
    component_state_matrix_ready: allPass(context.stateRows),
    ui_smoke_fixture_plan_ready: allPass(context.smokeRows),
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    domain_pack_product_identity_enabled: false,
    scorecard_kpi_enabled: false,
    review_trace_final_approval_enabled: false,
    p11401_operator_queue_ui_handoff_ready: coreReady,
    p11800_design_system_freeze_ready: false,
    ready_for_p11401_handoff: coreReady,
    ready_for_p11801_handoff: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("source.ready", "source", allPass(context.sourceBindingRows), "P11001 source contract is not ready", "p11001_source_binding_rows");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P11201-P11400 phase rows incomplete", "docs/hermes-roadmap-p11201-p11400.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P11201-P11400"), "Architecture doc missing P11201-P11400 reference", "docs/architecture.md");
  add("tokens", "design_tokens", context.tokenRows.length === 8 && allPass(context.tokenRows), "Design token rows incomplete", "design_token_rows");
  add("table.list", "primitive", context.tableListRows.length === 8 && allPass(context.tableListRows), "Table/list primitive rows incomplete", "table_list_primitive_rows");
  add("detail.inspector", "primitive", context.detailRows.length === 9 && allPass(context.detailRows), "Detail/inspector primitive rows incomplete", "detail_inspector_primitive_rows");
  add("timeline", "primitive", context.timelineRows.length === 7 && allPass(context.timelineRows), "Timeline primitive rows incomplete", "timeline_primitive_rows");
  add("boundary.receipt", "boundary", context.boundaryRows.length === 8 && allPass(context.boundaryRows), "Boundary notice/receipt rows incomplete", "boundary_notice_receipt_rows");
  add("rule.matrix", "rule_matrix", context.ruleMatrixRows.length === 8 && allPass(context.ruleMatrixRows), "Readiness Rule Matrix rows incomplete", "readiness_rule_matrix_rows");
  add("review.trace", "review_trace", context.reviewTraceRows.length === 8 && allPass(context.reviewTraceRows), "Review Evidence Trace rows incomplete", "review_evidence_trace_rows");
  add("states", "states", context.stateRows.length === 10 && allPass(context.stateRows), "Component state matrix rows incomplete", "component_state_matrix_rows");
  add("smoke", "smoke", context.smokeRows.length === 10 && allPass(context.smokeRows), "UI smoke fixture plan rows incomplete", "ui_smoke_fixture_plan_rows");
  add("freeze", "freeze", allPass(context.freezeRows), "P11400 freeze rows incomplete", "p11400_freeze_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false, "Design foundation opened write/protected action", "global_ui_design_foundation_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Design foundation opened final approval UI", "global_ui_design_foundation_boundary");
  add("boundary.no.production.enterprise", "boundary", context.boundary.production_pass_ui_enabled === false && context.boundary.enterprise_pass_ui_enabled === false, "Design foundation opened production or enterprise PASS", "global_ui_design_foundation_boundary");
  add("boundary.ready.handoff", "boundary", context.boundary.ready_for_p11401_handoff === true, "P11401 handoff not ready", "global_ui_design_foundation_boundary");
  return items;
}

function buildSummary(context) {
  const validation = context.validation;
  return {
    global_ui_design_foundation_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    source_ready_for_p11201_handoff: context.boundary.source_ready_for_p11201_handoff,
    phase_count: context.phaseRows.length,
    token_count: context.tokenRows.length,
    table_list_primitive_count: context.tableListRows.length,
    detail_inspector_primitive_count: context.detailRows.length,
    timeline_primitive_count: context.timelineRows.length,
    boundary_notice_receipt_count: context.boundaryRows.length,
    readiness_rule_matrix_count: context.ruleMatrixRows.length,
    review_evidence_trace_count: context.reviewTraceRows.length,
    component_state_count: context.stateRows.length,
    ui_smoke_fixture_count: context.smokeRows.length,
    p11400_freeze_count: context.freezeRows.length,
    ready_for_p11401_handoff: context.boundary.ready_for_p11401_handoff,
    ready_for_p11801_handoff: context.boundary.ready_for_p11801_handoff,
    p11800_design_system_freeze_ready: context.boundary.p11800_design_system_freeze_ready,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Global UI Design Foundation",
    "",
    `Status: ${result.summary.global_ui_design_foundation_status}`,
    `Program: ${result.program_range}`,
    `Tokens: ${result.summary.token_count}`,
    `Component states: ${result.summary.component_state_count}`,
    `Ready for P11401 handoff: ${result.summary.ready_for_p11401_handoff}`,
    "",
    "## Boundary",
    "",
    `- write control enabled: ${result.summary.write_control_enabled}`,
    `- final approval UI enabled: ${result.summary.final_approval_ui_enabled}`,
    `- production PASS UI enabled: ${result.summary.production_pass_ui_enabled}`,
    `- enterprise PASS UI enabled: ${result.summary.enterprise_pass_ui_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const tokenRows = result.design_token_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.uses.join(", "))}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global UI Design Foundation</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Global UI Design Foundation</h1>
    <p class="notice">Read-only token and component foundation. Write controls, final approval UI, release trust badge, and enterprise trust badge are disabled.</p>
    <table><thead><tr><th>Token</th><th>Uses</th><th>Verdict</th></tr></thead><tbody>${tokenRows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildGlobalUiContract(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildGlobalUiContract({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.global_ui_contract", built);
}

function gateRow(rowId, label, observed, evidenceRef) {
  return verdictRow({
    row_id: rowId,
    category: "gate",
    label,
    required: true,
    observed,
    evidence_ref: evidenceRef,
    block_reason: observed ? null : `${label} missing.`,
  });
}

function verdictRow(row) {
  return {
    block_reason: null,
    ...row,
    current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked"),
  };
}

function validationItem(itemId, category, ok, message, evidenceRef = itemId) {
  return { item_id: itemId, category, ok, message, evidence_ref: evidenceRef };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS.architectureDocPath,
    source_global_ui_contract_path: options.sourceGlobalUiContractPath ?? DEFAULT_GLOBAL_UI_DESIGN_FOUNDATION_INPUTS.sourceGlobalUiContractPath,
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { available: Boolean(data), path: sourceId, text: "", data };
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-global-ui-contract-path") args.sourceGlobalUiContractPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR]`);
  console.log("Creates the P11201-P11400 Global UI Design Foundation artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
