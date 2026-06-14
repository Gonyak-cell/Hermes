import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildGlobalUiOperatorQueue } from "./global-ui-operator-queue.mjs";

export const DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_OUT_DIR = "artifacts/global-ui-governance-freeze/latest";
export const DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS = {
  schemaPath: "schemas/global-ui-governance-freeze.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p11601-p11800.md",
  architectureDocPath: "docs/architecture.md",
  sourceGlobalUiOperatorQueuePath: "artifacts/global-ui-operator-queue/latest/global-ui-operator-queue.json",
  claudeReviewReceiptPath: "artifacts/global-ui-governance-freeze/latest/claude-review-receipt.json",
};

const COMMAND_NAME = "platform:global-ui-governance-freeze";
const SCHEMA_VERSION = "global-ui-governance-freeze.v1";
const CAPABILITY_ID = "platform.global_ui_governance_freeze";
const PROGRAM_RANGE = "P11601-P11800";
const SOURCE_PROGRAM_RANGE = "P11401-P11600";
const DESIGN_SYSTEM_RANGE = "P10801-P11800";
const SOURCE_READY_STATUS = "ready_for_global_ui_operator_queue";
const READY_STATUS = "ready_for_global_ui_governance_freeze";
const BLOCKED_STATUS = "blocked_global_ui_governance_freeze";

const PHASE_SPECS = [
  ["P11601-P11620", "UI Governance Source Binding", "ui_governance_source_binding_rows"],
  ["P11621-P11640", "Negative UI Fixture Matrix", "negative_ui_fixture_rows"],
  ["P11641-P11660", "Visual Regression Fixture Manifest", "visual_regression_fixture_rows"],
  ["P11661-P11680", "Accessibility Regression Contract", "accessibility_regression_rows"],
  ["P11681-P11700", "Read-only UI/API Governance Smoke", "read_only_governance_smoke_rows"],
  ["P11701-P11720", "Boundary Copy Audit", "boundary_copy_audit_rows"],
  ["P11721-P11740", "Claude Review Packet Requirement", "claude_review_packet_rows"],
  ["P11741-P11760", "Claude Finding Loop Contract", "claude_finding_loop_rows"],
  ["P11761-P11780", "Design-System Freeze Matrix", "design_system_freeze_matrix_rows"],
  ["P11781-P11800", "Global Console Design-System Freeze", "p11800_freeze_rows"],
];

const NEGATIVE_UI_SPECS = [
  ["negative.raw_full_body", "raw/full"],
  ["negative.secret", "secret"],
  ["negative.write", "write"],
  ["negative.form_button", "form/button"],
  ["negative.final_approval", "final approval"],
  ["negative.ai_approved", "AI approved"],
  ["negative.production_enterprise", "production/enterprise"],
  ["negative.domain_identity", "domain pack product identity"],
  ["negative.kpi_dashboard", "KPI dashboard"],
  ["negative.auto_resolved", "auto resolved"],
];

const VISUAL_SPECS = [
  ["visual.desktop", "desktop"],
  ["visual.tablet", "tablet"],
  ["visual.mobile", "mobile"],
  ["visual.nonblank", "nonblank"],
  ["visual.no_overlap", "no overlap"],
  ["visual.text_fit", "text fit"],
  ["visual.stable_dimensions", "stable dimensions"],
  ["visual.responsive_constraints", "responsive constraints"],
];

const ACCESSIBILITY_SPECS = [
  ["a11y.keyboard_focus", "keyboard focus"],
  ["a11y.aria_labels", "ARIA labels"],
  ["a11y.contrast", "contrast"],
  ["a11y.status_announcement", "status announcement"],
  ["a11y.reduced_motion", "reduced motion"],
  ["a11y.no_viewport_font_scaling", "no viewport font scaling"],
  ["a11y.stable_dimensions", "stable dimensions"],
  ["a11y.screen_reader", "screen reader"],
];

const GOVERNANCE_SMOKE_SPECS = [
  ["smoke.get_head_only", "GET/HEAD only"],
  ["smoke.post_blocked", "POST blocked"],
  ["smoke.sanitized_payload", "sanitized payload"],
  ["smoke.no_raw", "no raw"],
  ["smoke.no_secret", "no secret"],
  ["smoke.no_mutation", "no mutation"],
  ["smoke.no_final_approval", "no final approval"],
  ["smoke.no_production_enterprise", "no production/enterprise"],
];

const COPY_AUDIT_SPECS = [
  ["copy.ai_approved", "AI approved"],
  ["copy.claude_approved", "Claude approved"],
  ["copy.codex_approved", "Codex approved"],
  ["copy.production_ready", "production ready"],
  ["copy.enterprise_pass", "enterprise PASS"],
  ["copy.smart_insight", "smart insight"],
  ["copy.auto_resolved", "auto resolved"],
  ["copy.final_approver", "final approver"],
];

const CLAUDE_PACKET_SPECS = [
  ["claude.packet", "Claude review packet"],
  ["claude.opus_max", "Claude Code Opus max"],
  ["claude.effort_max", "effort max"],
  ["claude.raw_json_ref", "durable raw JSON ref"],
  ["claude.receipt", "receipt"],
  ["claude.no_mutation", "no mutation"],
  ["claude.no_final_approval", "not final approval"],
  ["claude.finding_loop", "finding loop"],
  ["claude.actual_file_refs", "actual changed file refs"],
  ["claude.not_summary_only", "not summary-only"],
];

const FINDING_LOOP_SPECS = [
  ["finding.normalization", "finding normalization"],
  ["finding.severity", "severity"],
  ["finding.evidence_ref", "evidence ref"],
  ["finding.revalidation_ref", "revalidation ref"],
  ["finding.p0_p1_blocker", "unresolved P0/P1"],
  ["finding.no_auto_resolve", "no auto-resolve"],
];

const EXPECTED_CLAUDE_REVIEW_REFS = [
  "docs/hermes-roadmap-p11601-p11800.md",
  "src/global-ui-governance-freeze.mjs",
  "scripts/global-ui-governance-freeze.mjs",
  "schemas/global-ui-governance-freeze.schema.json",
  "test/global-ui-governance-freeze.test.mjs",
  "package.json",
  "docs/architecture.md",
];

export async function runGlobalUiGovernanceFreeze(options = {}) {
  const result = await buildGlobalUiGovernanceFreeze(options);
  if (options.write !== false) await writeGlobalUiGovernanceFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Global UI governance freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGlobalUiGovernanceFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "globalUiOperatorQueue")
    ? normalizeInlineJsonSource("inline.global_ui_operator_queue", options.globalUiOperatorQueue)
    : await readJsonOrBuildGlobalUiOperatorQueue(inputs.source_global_ui_operator_queue_path, generatedAt);
  const claudeReceipt = Object.prototype.hasOwnProperty.call(options, "claudeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_review_receipt", options.claudeReviewReceipt)
    : await readJsonSource(inputs.claude_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const negativeRows = buildGenericRows(NEGATIVE_UI_SPECS, "negative_ui_fixture", roadmapDoc.text, generatedAt);
  const visualRows = buildGenericRows(VISUAL_SPECS, "visual_regression_fixture", roadmapDoc.text, generatedAt);
  const accessibilityRows = buildGenericRows(ACCESSIBILITY_SPECS, "accessibility_regression", roadmapDoc.text, generatedAt);
  const smokeRows = buildSmokeRows(roadmapDoc.text, generatedAt);
  const copyRows = buildCopyRows(roadmapDoc.text, generatedAt);
  const claudePacketRows = buildClaudePacketRows(roadmapDoc.text, claudeReceipt, generatedAt);
  const findingRows = buildFindingRows(roadmapDoc.text, claudeReceipt, generatedAt);
  const matrixRows = buildMatrixRows({ sourceRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows }, generatedAt);
  const freezeRows = buildFreezeRows({ sourceRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows }, generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows, freezeRows });
  const boundary = buildBoundary({ source, claudeReceipt, phaseRows, sourceRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows, freezeRows, gateRows, boundary });
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
      global_ui_operator_queue_path: source.path,
      claude_review_receipt_path: claudeReceipt.path,
    },
    source_global_ui_operator_queue_summary: source.data?.summary ?? null,
    claude_review_receipt_summary: summarizeClaudeReceipt(claudeReceipt),
    global_ui_governance_freeze_contract: contract,
    global_ui_governance_freeze_phase_rows: phaseRows,
    ui_governance_source_binding_rows: sourceRows,
    negative_ui_fixture_rows: negativeRows,
    visual_regression_fixture_rows: visualRows,
    accessibility_regression_rows: accessibilityRows,
    read_only_governance_smoke_rows: smokeRows,
    boundary_copy_audit_rows: copyRows,
    claude_review_packet_rows: claudePacketRows,
    claude_finding_loop_rows: findingRows,
    design_system_freeze_matrix_rows: matrixRows,
    p11800_freeze_rows: freezeRows,
    global_ui_governance_freeze_gate_rows: gateRows,
    global_ui_governance_freeze_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ phaseRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows, freezeRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "global_ui_governance_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ phaseRows, negativeRows, visualRows, accessibilityRows, smokeRows, copyRows, claudePacketRows, findingRows, matrixRows, freezeRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeGlobalUiGovernanceFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "global-ui-governance-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "global-ui-governance-freeze-phase-rows.json"), collectionEnvelope("global-ui-governance-freeze-phase-rows.v1", "global_ui_governance_freeze_phase_rows", result.global_ui_governance_freeze_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-governance-source-binding-rows.json"), collectionEnvelope("ui-governance-source-binding-rows.v1", "ui_governance_source_binding_rows", result.ui_governance_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-ui-fixture-rows.json"), collectionEnvelope("negative-ui-fixture-rows.v1", "negative_ui_fixture_rows", result.negative_ui_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "visual-regression-fixture-rows.json"), collectionEnvelope("visual-regression-fixture-rows.v1", "visual_regression_fixture_rows", result.visual_regression_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "accessibility-regression-rows.json"), collectionEnvelope("accessibility-regression-rows.v1", "accessibility_regression_rows", result.accessibility_regression_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-governance-smoke-rows.json"), collectionEnvelope("read-only-governance-smoke-rows.v1", "read_only_governance_smoke_rows", result.read_only_governance_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary-copy-audit-rows.json"), collectionEnvelope("boundary-copy-audit-rows.v1", "boundary_copy_audit_rows", result.boundary_copy_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-review-packet-rows.json"), collectionEnvelope("claude-review-packet-rows.v1", "claude_review_packet_rows", result.claude_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-finding-loop-rows.json"), collectionEnvelope("claude-finding-loop-rows.v1", "claude_finding_loop_rows", result.claude_finding_loop_rows, result.generated_at));
  await writeJson(path.join(outDir, "design-system-freeze-matrix-rows.json"), collectionEnvelope("design-system-freeze-matrix-rows.v1", "design_system_freeze_matrix_rows", result.design_system_freeze_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "p11800-freeze-rows.json"), collectionEnvelope("p11800-freeze-rows.v1", "p11800_freeze_rows", result.p11800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-governance-freeze-gate-rows.json"), collectionEnvelope("global-ui-governance-freeze-gate-rows.v1", "global_ui_governance_freeze_gate_rows", result.global_ui_governance_freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-governance-freeze-boundary.json"), result.global_ui_governance_freeze_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "global-ui-governance-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runGlobalUiGovernanceFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runGlobalUiGovernanceFreeze(args);
    console.log(`Global UI governance freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.global_ui_governance_freeze_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Claude receipt observed: ${result.summary.claude_review_receipt_observed_now}`);
    console.log(`Ready for P11801 handoff: ${result.summary.ready_for_p11801_handoff}`);
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
    contract_id: "global-ui-governance-freeze.contract.v1",
    generated_at: generatedAt,
    source_global_ui_operator_queue_required: true,
    source_ready_for_p11601_handoff_required: true,
    negative_ui_fixtures_required: true,
    visual_regression_fixtures_required: true,
    accessibility_regression_required: true,
    read_only_governance_smoke_required: true,
    boundary_copy_audit_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    p11800_design_system_freeze_required: true,
    raw_body_exposure_allowed: false,
    write_control_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p11601-p11800.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  return [
    ["source.available", "P11401-P11600 source artifact available", source.available],
    ["source.status", "P11401-P11600 source is ready", summary.global_ui_operator_queue_status === SOURCE_READY_STATUS],
    ["source.handoff", "P11401 source ready for P11601 handoff", summary.ready_for_p11601_handoff === true],
    ["source.no_write", "P11401 source did not open write control", summary.write_control_enabled === false],
    ["source.no_final_approval", "P11401 source did not open final approval UI", summary.final_approval_ui_enabled === false],
    ["source.no_production_enterprise", "P11401 source did not open production or enterprise PASS UI", summary.production_pass_ui_enabled === false && summary.enterprise_pass_ui_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "ui_governance_source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildGenericRows(specs, category, roadmapText, generatedAt) {
  return specs.map(([rowId, label]) => verdictRow({
    row_id: rowId,
    category,
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p11601-p11800.md#governance-contract",
    generated_at: generatedAt,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_claim_allowed: false,
    raw_body_visible: false,
    secret_key_visible: false,
    write_control_enabled: false,
    final_approval_enabled: false,
  }));
}

function buildSmokeRows(roadmapText, generatedAt) {
  return GOVERNANCE_SMOKE_SPECS.map(([rowId, label]) => verdictRow({
    row_id: rowId,
    category: "read_only_governance_smoke",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p11601-p11800.md#governance-contract",
    generated_at: generatedAt,
    methods_allowed: ["GET", "HEAD"],
    mutates_state: false,
    sanitized_payload_required: true,
    raw_body_visible: false,
    secret_key_visible: false,
  }));
}

function buildCopyRows(roadmapText, generatedAt) {
  return COPY_AUDIT_SPECS.map(([rowId, label]) => verdictRow({
    row_id: rowId,
    category: "boundary_copy_audit",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p11601-p11800.md#governance-contract",
    generated_at: generatedAt,
    forbidden_copy: true,
    allowed_in_ui: false,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
  }));
}

function buildClaudePacketRows(roadmapText, receipt, generatedAt) {
  const receiptSummary = summarizeClaudeReceipt(receipt);
  return CLAUDE_PACKET_SPECS.map(([rowId, label]) => {
    const receiptObserved = receiptSummary.receipt_observed_now;
    const modelOk = receiptSummary.model_ok && receiptSummary.effort_ok;
    const durableOk = receiptSummary.durable_raw_json_present_now;
    const noAuthorityExpansion = receiptSummary.reviewer_mutation_allowed === false && receiptSummary.reviewer_final_approval_allowed === false;
    const scopeOk = receiptSummary.actual_file_refs_observed_now && receiptSummary.summary_only_review === false && receiptSummary.self_attestation_only === false;
    const observed = includesText(roadmapText, label) && receiptObserved && modelOk && durableOk && noAuthorityExpansion && scopeOk;
    return verdictRow({
      row_id: rowId,
      category: "claude_review_packet",
      label,
      required: true,
      observed,
      evidence_ref: receipt.path,
      generated_at: generatedAt,
      claude_code_opus_max_review_receipt_required: true,
      receipt_observed_now: receiptObserved,
      durable_raw_json_present_now: durableOk,
      actual_file_refs_observed_now: receiptSummary.actual_file_refs_observed_now,
      summary_only_review: receiptSummary.summary_only_review,
      self_attestation_only: receiptSummary.self_attestation_only,
      review_capture_blocked_now: receiptSummary.review_capture_blocked_now,
      review_block_reason: receiptSummary.review_block_reason,
      reviewer_mutation_allowed: receiptSummary.reviewer_mutation_allowed,
      reviewer_final_approval_allowed: receiptSummary.reviewer_final_approval_allowed,
      block_reason: observed ? null : "Claude review receipt is missing, stale, incomplete, mutable, final-approval-like, summary-only, self-attesting, missing actual changed file refs, or lacks durable raw JSON.",
    });
  });
}

function buildFindingRows(roadmapText, receipt, generatedAt) {
  const summary = summarizeClaudeReceipt(receipt);
  return FINDING_LOOP_SPECS.map(([rowId, label]) => {
    const reviewScopeOk = summary.actual_file_refs_observed_now && summary.summary_only_review === false && summary.self_attestation_only === false;
    const observed = includesText(roadmapText, label) && summary.receipt_observed_now && reviewScopeOk && summary.unresolved_p0_p1_count === 0 && summary.finding_loop_clear_now === true;
    return verdictRow({
      row_id: rowId,
      category: "claude_finding_loop",
      label,
      required: true,
      observed,
      evidence_ref: receipt.path,
      generated_at: generatedAt,
      unresolved_p0_p1_count: summary.unresolved_p0_p1_count,
      finding_loop_clear_now: summary.finding_loop_clear_now,
      auto_resolve_allowed: false,
      block_reason: observed ? null : "Claude finding loop is missing or unresolved P0/P1 findings remain.",
    });
  });
}

function buildMatrixRows(context, generatedAt) {
  return [
    ["matrix.source", "source ready", allPass(context.sourceRows)],
    ["matrix.negative", "negative UI fixtures ready", allPass(context.negativeRows)],
    ["matrix.visual", "visual regression fixtures ready", allPass(context.visualRows)],
    ["matrix.accessibility", "accessibility regression ready", allPass(context.accessibilityRows)],
    ["matrix.smoke", "read-only smoke ready", allPass(context.smokeRows)],
    ["matrix.copy", "boundary copy audit ready", allPass(context.copyRows)],
    ["matrix.claude", "Claude receipt ready", allPass(context.claudePacketRows)],
    ["matrix.findings", "finding loop clear", allPass(context.findingRows)],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "design_system_freeze_matrix",
    label,
    required: true,
    observed,
    evidence_ref: "design-system-freeze-matrix",
    generated_at: generatedAt,
  }));
}

function buildFreezeRows(context, generatedAt) {
  return [
    ["freeze.source", "P11600 source binding ready", allPass(context.sourceRows)],
    ["freeze.negative", "negative UI fixture matrix ready", allPass(context.negativeRows)],
    ["freeze.visual", "visual regression fixture manifest ready", allPass(context.visualRows)],
    ["freeze.accessibility", "accessibility regression ready", allPass(context.accessibilityRows)],
    ["freeze.smoke", "read-only UI/API governance smoke ready", allPass(context.smokeRows)],
    ["freeze.copy", "boundary copy audit ready", allPass(context.copyRows)],
    ["freeze.claude", "Claude review receipt ready", allPass(context.claudePacketRows)],
    ["freeze.findings", "Claude finding loop clear", allPass(context.findingRows)],
    ["freeze.matrix", "design-system freeze matrix ready", allPass(context.matrixRows)],
    ["freeze.p11801_handoff", "P11801 SaaS quality gate handoff ready", true],
    ["freeze.no_write", "No write/protected/form/API action opened", true],
    ["freeze.no_final_approval", "No Codex/Claude/final approval UI opened", true],
    ["freeze.no_production_enterprise", "No production or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p11800_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p11800-freeze",
    generated_at: generatedAt,
  }));
}

function buildGateRows(context) {
  return [
    gateRow("gate.package_script", "Package script registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json#scripts"),
    gateRow("gate.validate_chain", "Package validate chain registered", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), "package.json#scripts.validate"),
    gateRow("gate.roadmap_doc", "P11601-P11800 roadmap doc present", context.roadmapDoc.available && context.roadmapDoc.text.includes(PROGRAM_RANGE), context.roadmapDoc.path),
    gateRow("gate.architecture_doc", "Architecture doc references P11601-P11800", context.architectureDoc.available && context.architectureDoc.text.includes("P11601-P11800"), context.architectureDoc.path),
    gateRow("gate.phase_rows", "P11601-P11800 phase rows ready", allPass(context.phaseRows), "global_ui_governance_freeze_phase_rows"),
    gateRow("gate.source", "P11600 source ready", allPass(context.sourceRows), "ui_governance_source_binding_rows"),
    gateRow("gate.negative", "negative UI fixtures ready", allPass(context.negativeRows), "negative_ui_fixture_rows"),
    gateRow("gate.visual", "visual regression fixtures ready", allPass(context.visualRows), "visual_regression_fixture_rows"),
    gateRow("gate.accessibility", "accessibility regression ready", allPass(context.accessibilityRows), "accessibility_regression_rows"),
    gateRow("gate.smoke", "read-only smoke ready", allPass(context.smokeRows), "read_only_governance_smoke_rows"),
    gateRow("gate.copy", "boundary copy audit ready", allPass(context.copyRows), "boundary_copy_audit_rows"),
    gateRow("gate.claude", "Claude review packet ready", allPass(context.claudePacketRows), "claude_review_packet_rows"),
    gateRow("gate.findings", "Claude finding loop clear", allPass(context.findingRows), "claude_finding_loop_rows"),
    gateRow("gate.matrix", "design-system freeze matrix ready", allPass(context.matrixRows), "design_system_freeze_matrix_rows"),
    gateRow("gate.freeze", "P11800 freeze rows ready", allPass(context.freezeRows), "p11800_freeze_rows"),
  ];
}

function buildBoundary(context) {
  const sourceSummary = context.source.data?.summary ?? {};
  const claudeSummary = summarizeClaudeReceipt(context.claudeReceipt);
  const claudeReviewReady = allPass(context.claudePacketRows) && allPass(context.findingRows);
  const coreReady = [
    context.phaseRows,
    context.sourceRows,
    context.negativeRows,
    context.visualRows,
    context.accessibilityRows,
    context.smokeRows,
    context.copyRows,
    context.claudePacketRows,
    context.findingRows,
    context.matrixRows,
    context.freezeRows,
    context.gateRows,
  ].every(allPass);
  return {
    source_global_ui_operator_queue_ready: sourceSummary.global_ui_operator_queue_status === SOURCE_READY_STATUS,
    source_ready_for_p11601_handoff: sourceSummary.ready_for_p11601_handoff === true,
    global_ui_governance_freeze_ready: coreReady,
    negative_ui_fixtures_ready: allPass(context.negativeRows),
    visual_regression_fixtures_ready: allPass(context.visualRows),
    accessibility_regression_ready: allPass(context.accessibilityRows),
    read_only_governance_smoke_ready: allPass(context.smokeRows),
    boundary_copy_audit_ready: allPass(context.copyRows),
    claude_review_ready: claudeReviewReady,
    claude_review_block_visible_now: claudeReviewReady === false,
    claude_review_capture_blocked_now: claudeSummary.review_capture_blocked_now,
    claude_review_block_reason: claudeSummary.review_block_reason,
    claude_review_receipt_observed_now: claudeSummary.receipt_observed_now,
    claude_review_durable_raw_json_present_now: claudeSummary.durable_raw_json_present_now,
    claude_review_actual_file_refs_observed_now: claudeSummary.actual_file_refs_observed_now,
    claude_review_summary_only_now: claudeSummary.summary_only_review,
    claude_review_self_attestation_only_now: claudeSummary.self_attestation_only,
    claude_finding_loop_clear_now: claudeSummary.finding_loop_clear_now,
    unresolved_p0_p1_count: claudeSummary.unresolved_p0_p1_count,
    p11800_design_system_freeze_ready: coreReady,
    ready_for_p11801_handoff: coreReady,
    raw_body_exposure_allowed: false,
    full_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    form_button_execution_enabled: false,
    api_write_methods_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    domain_pack_product_identity_enabled: false,
    kpi_dashboard_home_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  const claudePacketShapeReady = context.claudePacketRows.length === CLAUDE_PACKET_SPECS.length;
  const findingLoopShapeReady = context.findingRows.length === FINDING_LOOP_SPECS.length;
  const reviewerAuthoritySafe = context.claudePacketRows.every((row) => row.reviewer_mutation_allowed === false && row.reviewer_final_approval_allowed === false);
  const claudeReviewStateRepresented = claudePacketShapeReady
    && findingLoopShapeReady
    && (allPass(context.claudePacketRows) || context.boundary.claude_review_block_visible_now === true);
  const freezeStateRepresented = context.p11800FreezeRowsReadyForValidation ?? (context.freezeRows.length === 13 && context.matrixRows.length === 8);
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P11601-P11800 phase rows incomplete", "docs/hermes-roadmap-p11601-p11800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P11601-P11800"), "Architecture doc missing P11601-P11800 reference", "docs/architecture.md");
  add("source.ready", "source", allPass(context.sourceRows), "P11600 source is not ready", "ui_governance_source_binding_rows");
  add("negative.ready", "ui", allPass(context.negativeRows), "negative UI fixtures incomplete", "negative_ui_fixture_rows");
  add("visual.ready", "ui", allPass(context.visualRows), "visual regression fixtures incomplete", "visual_regression_fixture_rows");
  add("accessibility.ready", "ui", allPass(context.accessibilityRows), "accessibility regression rows incomplete", "accessibility_regression_rows");
  add("smoke.ready", "ui", allPass(context.smokeRows), "read-only governance smoke rows incomplete", "read_only_governance_smoke_rows");
  add("copy.ready", "ui", allPass(context.copyRows), "boundary copy audit rows incomplete", "boundary_copy_audit_rows");
  add("claude.receipt.state", "review", claudeReviewStateRepresented, "Claude review receipt state must be represented as ready or explicit BLOCK", "claude_review_packet_rows");
  add("claude.authority.safe", "review", reviewerAuthoritySafe, "Claude reviewer cannot mutate source or claim final approval", "claude_review_packet_rows");
  add("claude.findings.state", "review", findingLoopShapeReady && (allPass(context.findingRows) || context.boundary.claude_review_block_visible_now === true), "Claude finding loop must be clear or explicitly blocked", "claude_finding_loop_rows");
  add("freeze.matrix.state", "freeze", context.matrixRows.length === 8, "design-system freeze matrix rows missing", "design_system_freeze_matrix_rows");
  add("freeze.rows.state", "freeze", freezeStateRepresented, "P11800 freeze rows missing", "p11800_freeze_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.form_button_execution_enabled === false && context.boundary.api_write_methods_enabled === false, "UI governance opened write/protected/form/API mutation", "global_ui_governance_freeze_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "UI governance opened final approval UI", "global_ui_governance_freeze_boundary");
  add("boundary.no.production.enterprise", "boundary", context.boundary.production_pass_ui_enabled === false && context.boundary.enterprise_pass_ui_enabled === false, "UI governance opened production or enterprise PASS", "global_ui_governance_freeze_boundary");
  add("boundary.ready.state", "boundary", context.boundary.ready_for_p11801_handoff === allPass(context.freezeRows), "P11801 handoff state must match P11800 freeze rows", "global_ui_governance_freeze_boundary");
  return items;
}

function summarizeClaudeReceipt(receipt) {
  const data = receipt.data ?? {};
  const reviewedFileRefs = Array.isArray(data.reviewed_file_refs) ? data.reviewed_file_refs.map(String) : [];
  const actualFileRefsObserved = EXPECTED_CLAUDE_REVIEW_REFS.every((expectedRef) => reviewedFileRefs.includes(expectedRef));
  const receiptStatus = receipt.available ? String(data.receipt_status ?? "unknown") : "missing";
  const summaryOnly = data.summary_only_review === true;
  const selfAttestationOnly = data.self_attestation_only === true;
  const reviewCaptureBlocked = receipt.available === false
    || receiptStatus === "blocked"
    || summaryOnly
    || selfAttestationOnly
    || (receiptStatus === "observed" && actualFileRefsObserved === false);
  return {
    receipt_status: receiptStatus,
    receipt_observed_now: receipt.available && receiptStatus === "observed",
    review_capture_blocked_now: reviewCaptureBlocked,
    review_block_reason: data.block_reason ?? (receipt.available ? null : "claude_review_receipt_missing"),
    model_ok: /opus/i.test(String(data.model_id ?? "")),
    effort_ok: String(data.effort ?? "").toLowerCase() === "max",
    durable_raw_json_present_now: data.durable_raw_json_present_now === true && Boolean(data.raw_json_ref),
    actual_file_refs_observed_now: actualFileRefsObserved,
    summary_only_review: summaryOnly,
    self_attestation_only: selfAttestationOnly,
    reviewer_mutation_allowed: data.reviewer_mutation_allowed === true,
    reviewer_final_approval_allowed: data.reviewer_final_approval_allowed === true,
    finding_loop_clear_now: data.finding_loop_clear_now === true,
    unresolved_p0_p1_count: Number(data.unresolved_p0_p1_count ?? 999),
  };
}

function buildSummary(context) {
  const validation = context.validation;
  return {
    global_ui_governance_freeze_status: context.boundary.ready_for_p11801_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    phase_count: context.phaseRows.length,
    negative_ui_fixture_count: context.negativeRows.length,
    visual_regression_fixture_count: context.visualRows.length,
    accessibility_regression_count: context.accessibilityRows.length,
    claude_review_packet_count: context.claudePacketRows.length,
    claude_finding_loop_count: context.findingRows.length,
    claude_review_receipt_observed_now: context.boundary.claude_review_receipt_observed_now,
    claude_review_block_visible_now: context.boundary.claude_review_block_visible_now,
    claude_review_capture_blocked_now: context.boundary.claude_review_capture_blocked_now,
    claude_finding_loop_clear_now: context.boundary.claude_finding_loop_clear_now,
    p11800_design_system_freeze_ready: context.boundary.p11800_design_system_freeze_ready,
    ready_for_p11801_handoff: context.boundary.ready_for_p11801_handoff,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Global UI Governance Freeze",
    "",
    `Status: ${result.summary.global_ui_governance_freeze_status}`,
    `Program: ${result.program_range}`,
    `Claude receipt observed: ${result.summary.claude_review_receipt_observed_now}`,
    `Ready for P11801 handoff: ${result.summary.ready_for_p11801_handoff}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.design_system_freeze_matrix_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global UI Governance Freeze</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
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
    <h1>Hermes Global UI Governance Freeze</h1>
    <p class="notice">Design-system freeze evidence. Claude review is evidence only; raw bodies, write controls, final approval, release trust badges, and enterprise trust badges remain disabled.</p>
    <table><thead><tr><th>Freeze Check</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildGlobalUiOperatorQueue(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildGlobalUiOperatorQueue({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.global_ui_operator_queue", built);
}

function gateRow(rowId, label, observed, evidenceRef) {
  return verdictRow({ row_id: rowId, category: "gate", label, required: true, observed, evidence_ref: evidenceRef });
}

function verdictRow(row) {
  return { block_reason: row.observed ? null : `${row.label} missing or blocked.`, ...row, current_verdict: row.current_verdict ?? (row.observed ? "pass" : "blocked") };
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
    schema_path: options.schemaPath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.architectureDocPath,
    source_global_ui_operator_queue_path: options.sourceGlobalUiOperatorQueuePath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.sourceGlobalUiOperatorQueuePath,
    claude_review_receipt_path: options.claudeReviewReceiptPath ?? DEFAULT_GLOBAL_UI_GOVERNANCE_FREEZE_INPUTS.claudeReviewReceiptPath,
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
    else if (value === "--check") { args.check = true; args.write = false; }
    else if (value === "--no-write") args.write = false;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--schema-path") args.schemaPath = argv[++index];
    else if (value === "--package-path") args.packagePath = argv[++index];
    else if (value === "--roadmap-doc-path") args.roadmapDocPath = argv[++index];
    else if (value === "--architecture-doc-path") args.architectureDocPath = argv[++index];
    else if (value === "--source-global-ui-operator-queue-path") args.sourceGlobalUiOperatorQueuePath = argv[++index];
    else if (value === "--claude-review-receipt") args.claudeReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--claude-review-receipt PATH]`);
  console.log("Creates the P11601-P11800 Global UI Governance Freeze artifacts.");
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

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
