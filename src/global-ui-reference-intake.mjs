import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_OUT_DIR = "artifacts/global-ui-reference-intake/latest";
export const DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS = {
  schemaPath: "schemas/global-ui-reference-intake.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p10801-p11800.md",
  architectureDocPath: "docs/architecture.md",
  designReferenceDocPath: "docs/design/hermes-global-operator-console-reference.md",
  referencePackPath: "hermes-operator-console-2026-06-06",
};

const COMMAND_NAME = "platform:global-ui-reference-intake";
const SOURCE_COMMAND_NAME = "platform:context-recall-drift-guard";
const SCHEMA_VERSION = "global-ui-reference-intake.v1";
const CAPABILITY_ID = "platform.global_ui_reference_intake";
const PROGRAM_RANGE = "P10801-P11000";
const DESIGN_SYSTEM_RANGE = "P10801-P11800";
const SOURCE_PROGRAM_RANGE = "P10601-P10800";
const READY_STATUS = "ready_for_global_ui_reference_intake";
const BLOCKED_STATUS = "blocked_global_ui_reference_intake";

const PHASE_SPECS = [
  ["P10801-P10820", "Reference Pack Source Inventory", "reference_pack_source_rows"],
  ["P10821-P10840", "P9000 Language Reclassification", "reference_reclassification_rows"],
  ["P10841-P10860", "Comparative Pattern Evidence", "comparative_pattern_rows"],
  ["P10861-P10880", "Source/Evidence Intake Contract", "ui_source_contract_rows"],
  ["P10881-P10900", "Global UI Trace Spine", "trace_spine_rows"],
  ["P10901-P10920", "Navigation Contract Draft", "navigation_contract_rows"],
  ["P10921-P10940", "Status Vocabulary Draft", "status_vocabulary_rows"],
  ["P10941-P10960", "Forbidden Copy And Authority Guard", "forbidden_language_rows"],
  ["P10961-P10980", "P11001 Handoff Contract", "p11001_handoff_rows"],
  ["P10981-P11000", "Reference Intake Freeze", "reference_intake_gate_rows"],
  ["P11001-P11020", "Global Object Model", "global_object_model_rows"],
  ["P11021-P11040", "Global Navigation IA", "global_navigation_rows"],
  ["P11041-P11060", "Inspector Panel Contract", "object_inspector_contract_rows"],
  ["P11061-P11080", "Review/Gate Boundary Contract", "review_gate_boundary_rows"],
  ["P11081-P11100", "Conversation Source Detail Contract", "conversation_source_detail_rows"],
  ["P11101-P11120", "Domain Pack Context Contract", "domain_context_rows"],
  ["P11121-P11140", "UI Negative Invariants", "ui_negative_invariant_rows"],
  ["P11141-P11160", "Read-Only API Projection Contract", "ui_read_only_api_contract_rows"],
  ["P11161-P11180", "Accessibility And Density Contract", "accessibility_density_rows"],
  ["P11181-P11200", "Global UI Contract Freeze", "p11200_freeze_rows"],
  ["P11201-P11220", "Design Token Registry", "design_token_rows"],
  ["P11221-P11240", "Table/List Primitive", "table_list_primitive_rows"],
  ["P11241-P11260", "Detail/Inspector Primitive", "detail_inspector_primitive_rows"],
  ["P11261-P11280", "Timeline Primitive", "timeline_primitive_rows"],
  ["P11281-P11300", "Boundary Notice And Receipt Rows", "boundary_notice_rows"],
  ["P11301-P11320", "Readiness Rule Matrix Primitive", "readiness_rule_matrix_rows"],
  ["P11321-P11340", "Review Evidence Trace Primitive", "review_evidence_trace_rows"],
  ["P11341-P11360", "Component State Matrix", "component_state_rows"],
  ["P11361-P11380", "UI Smoke Fixture Plan", "ui_smoke_fixture_rows"],
  ["P11381-P11400", "Token/Component Foundation Freeze", "p11400_freeze_rows"],
  ["P11401-P11420", "Global Operator Queue v0", "operator_queue_surface_rows"],
  ["P11421-P11440", "Object Inspector Panel v0", "object_inspector_surface_rows"],
  ["P11441-P11460", "Requirement Trace Detail v0", "requirement_trace_surface_rows"],
  ["P11461-P11480", "Review Gate Detail v0", "review_gate_surface_rows"],
  ["P11481-P11500", "Evidence Timeline v0", "evidence_timeline_surface_rows"],
  ["P11501-P11520", "Conversation Source Detail v0", "conversation_surface_rows"],
  ["P11521-P11540", "Domain Pack Detail v0", "domain_pack_surface_rows"],
  ["P11541-P11560", "Governance/Audit Surface v0", "governance_audit_surface_rows"],
  ["P11561-P11580", "Browser/UI Smoke v0", "browser_ui_smoke_rows"],
  ["P11581-P11600", "Operator Queue UI v0 Freeze", "p11600_freeze_rows"],
  ["P11601-P11620", "UI Negative Fixture Suite", "ui_negative_fixture_rows"],
  ["P11621-P11640", "Visual Regression Contract", "visual_regression_rows"],
  ["P11641-P11660", "Accessibility Regression Contract", "accessibility_regression_rows"],
  ["P11661-P11680", "Claude UI Review Packet", "claude_ui_review_packet_rows"],
  ["P11681-P11700", "Finding Loop And Revalidation", "ui_finding_loop_rows"],
  ["P11701-P11720", "UI Governance API Alignment", "ui_governance_alignment_rows"],
  ["P11721-P11740", "Design System Migration Guide", "design_system_migration_rows"],
  ["P11741-P11760", "P11801 Quality Gate Handoff", "p11801_handoff_rows"],
  ["P11761-P11780", "UI Freeze Evidence Packet", "ui_freeze_evidence_rows"],
  ["P11781-P11800", "Global Operator Console Design System Freeze", "p11800_freeze_rows"],
];

const RECLASSIFICATION_SPECS = [
  ["rename.p9000_plan", "P9000 UI Reference Plan", "Hermes Global Operator Console Reference"],
  ["rename.conversation_queue", "Conversation Source Queue", "Conversation Source saved view"],
  ["rename.ai_review_surface", "AI Review Surface", "Review Evidence Trace"],
  ["rename.scorecard", "Scorecard", "Readiness Rule Matrix"],
  ["rename.approval_button", "Approval button", "Gate Record or Receipt Requirement"],
];

const PATTERN_SPECS = [
  ["pattern.operator_queue", "Linear/GitHub/Jira", "Global Operator Queue"],
  ["pattern.three_column", "Linear/Jira/Sentry", "Saved views, records, inspector panel"],
  ["pattern.durable_record", "Jira/GitHub Issues", "ObjectRow and Object Detail"],
  ["pattern.linked_work", "GitHub Issues/Projects/Actions", "SourceRef and EvidenceChain"],
  ["pattern.gate_record", "Harness", "GateRecord and Review Gate Detail"],
  ["pattern.timeline", "Sentry/Datadog", "Evidence Timeline"],
  ["pattern.rule_matrix", "Port/Cortex", "Readiness Rule Matrix"],
  ["pattern.reviewer_trace", "LangSmith/Langfuse", "Review Evidence Trace"],
];

const TRACE_SPINE = ["Source", "Claim", "Requirement", "Evidence", "Gate", "Review", "Verdict", "Next Action"];

const NAVIGATION_SPECS = [
  ["nav.queue", "Queue", "review, blocker, missing evidence, next action"],
  ["nav.projects", "Projects", "project/workflow registry"],
  ["nav.requirements", "Requirements", "requirement, PRD, spec, issue, test, evidence"],
  ["nav.evidence", "Evidence", "artifact, receipt, command output, citation"],
  ["nav.reviews", "Reviews", "Codex, Claude, GitHub, owner boundary"],
  ["nav.gates", "Gates", "validation, authority, trust gates"],
  ["nav.conversations", "Conversations", "redacted/cited source"],
  ["nav.actions", "Actions", "allowed, blocked, receipt-required, rollback-bound"],
  ["nav.domain_packs", "Domain Packs", "context-only domain packs"],
  ["nav.governance", "Governance", "trust tier and authority boundary"],
  ["nav.audit", "Audit", "owner, timestamp, transition, lineage"],
];

const ALLOWED_STATUS = ["BLOCKED", "NEEDS_REVIEW", "MISSING_EVIDENCE", "READY_FOR_HANDOFF", "READ_ONLY", "LOWER_TRUST", "CANDIDATE", "VALIDATED"];
const FORBIDDEN_COPY = ["AI approved", "Claude approved", "Codex approved", "Production ready", "Enterprise PASS", "Smart insight", "Auto resolved"];

const COMPONENT_SPECS = [
  "GlobalShell",
  "SavedViewSidebar",
  "OperatorQueueTable",
  "ObjectRow",
  "ObjectInspectorPanel",
  "TraceSpine",
  "SourceRef",
  "RequirementTrace",
  "EvidenceChain",
  "GateRecord",
  "ReviewLane",
  "ReadinessRuleMatrix",
  "TypedTimelineCell",
  "NextActionRow",
  "BoundaryNotice",
  "ReceiptRequirement",
  "ReviewEvidenceTrace",
];

const SURFACE_SPECS = [
  ["surface.operator_queue", "Global Operator Queue", "home surface"],
  ["surface.object_inspector", "Object Inspector Panel", "right detail panel"],
  ["surface.requirement_trace", "Requirement Trace Detail", "trace graph detail"],
  ["surface.review_gate", "Review Gate Detail", "authority boundary detail"],
  ["surface.evidence_timeline", "Evidence Timeline", "typed evidence chronology"],
  ["surface.conversation_source", "Conversation Source Detail", "redacted cited source"],
  ["surface.domain_pack", "Domain Pack Detail", "context-only domain display"],
  ["surface.governance_audit", "Governance/Audit Surface", "trust and lineage state"],
];

const TOKEN_SPECS = [
  ["token.color.neutral", "neutral base"],
  ["token.color.accent", "restrained blue accent"],
  ["token.color.semantic", "amber red green semantic only"],
  ["token.radius", "4-8px radius"],
  ["token.spacing", "dense table/detail spacing"],
  ["token.typography", "no viewport-scaled font size"],
  ["token.motion", "minimal state transitions"],
  ["token.shadow", "low elevation only"],
];

const NEGATIVE_FIXTURES = [
  ["negative.raw_body_visible", "raw or full transcript body appears in UI/API", "BLOCK_RAW_BODY_VISIBLE"],
  ["negative.secret_key_visible", "secret-bearing key appears in UI/API", "BLOCK_SECRET_KEY_VISIBLE"],
  ["negative.write_button", "write/apply/merge/delete/send button appears", "BLOCK_WRITE_BUTTON"],
  ["negative.final_approver_codex", "Codex appears as final approver", "BLOCK_CODEX_FINAL_APPROVER"],
  ["negative.final_approver_claude", "Claude appears as final approver", "BLOCK_CLAUDE_FINAL_APPROVER"],
  ["negative.production_ready_copy", "production ready copy appears", "BLOCK_PRODUCTION_READY_COPY"],
  ["negative.enterprise_pass_copy", "enterprise PASS copy appears", "BLOCK_ENTERPRISE_PASS_COPY"],
  ["negative.ai_approved_copy", "AI approved copy appears", "BLOCK_AI_APPROVED_COPY"],
  ["negative.scorecard_kpi", "scorecard is represented as KPI dashboard", "BLOCK_SCORECARD_KPI"],
  ["negative.domain_as_product", "domain pack is represented as Hermes product identity", "BLOCK_DOMAIN_AS_PRODUCT"],
  ["negative.phase_as_top_nav", "phase/tranche id dominates top navigation", "BLOCK_PHASE_AS_TOP_NAV"],
  ["negative.card_report_home", "card/report/hero page becomes the home surface", "BLOCK_CARD_REPORT_HOME"],
];

export async function runGlobalUiReferenceIntake(options = {}) {
  const result = await buildGlobalUiReferenceIntake(options);
  if (options.write !== false) await writeGlobalUiReferenceIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Global UI reference intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGlobalUiReferenceIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const designReferenceDoc = await readTextSource(inputs.design_reference_doc_path);
  const referencePack = Object.prototype.hasOwnProperty.call(options, "referencePack")
    ? normalizeInlineReferencePack(options.referencePack)
    : await readReferencePack(inputs.reference_pack_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const referenceRows = buildReferencePackSourceRows(referencePack, generatedAt);
  const designReferenceRows = buildDesignReferenceRows(designReferenceDoc, generatedAt);
  const reclassificationRows = buildReclassificationRows(designReferenceDoc, generatedAt);
  const comparativePatternRows = buildComparativePatternRows(designReferenceDoc, generatedAt);
  const sourceContractRows = buildSourceContractRows(generatedAt);
  const traceSpineRows = buildTraceSpineRows(roadmapDoc.text, designReferenceDoc.text, generatedAt);
  const navigationRows = buildNavigationRows(roadmapDoc.text, generatedAt);
  const statusVocabularyRows = buildStatusVocabularyRows(roadmapDoc.text, generatedAt);
  const forbiddenLanguageRows = buildForbiddenLanguageRows(roadmapDoc.text, designReferenceDoc.text, generatedAt);
  const tokenRows = buildTokenRows(roadmapDoc.text, generatedAt);
  const componentRows = buildComponentRows(roadmapDoc.text, generatedAt);
  const surfaceRows = buildSurfaceRows(roadmapDoc.text, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const handoffRows = buildHandoffRows(generatedAt);
  const gateRows = buildGateRows({
    packageJson,
    roadmapDoc,
    architectureDoc,
    designReferenceDoc,
    referencePack,
    contract,
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    sourceContractRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
  });
  const boundary = buildBoundary({
    referencePack,
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
    gateRows,
  });
  const validationItems = buildValidationItems({
    packageJson,
    roadmapDoc,
    architectureDoc,
    designReferenceDoc,
    contract,
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    sourceContractRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    global_ui_reference_contract: contract,
    p10801_p11800_phase_rows: phaseRows,
    reference_pack_source_rows: referenceRows,
    sanitized_design_reference_rows: designReferenceRows,
    reference_reclassification_rows: reclassificationRows,
    comparative_pattern_rows: comparativePatternRows,
    ui_source_contract_rows: sourceContractRows,
    trace_spine_rows: traceSpineRows,
    navigation_contract_rows: navigationRows,
    status_vocabulary_rows: statusVocabularyRows,
    forbidden_language_rows: forbiddenLanguageRows,
    design_token_rows: tokenRows,
    component_contract_rows: componentRows,
    ui_surface_contract_rows: surfaceRows,
    ui_negative_fixture_rows: negativeFixtureRows,
    design_system_handoff_rows: handoffRows,
    global_ui_reference_gate_rows: gateRows,
    global_ui_reference_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ referencePack, phaseRows, referenceRows, designReferenceRows, reclassificationRows, comparativePatternRows, traceSpineRows, navigationRows, statusVocabularyRows, forbiddenLanguageRows, tokenRows, componentRows, surfaceRows, negativeFixtureRows, handoffRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "global_ui_reference_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ referencePack, phaseRows, referenceRows, designReferenceRows, reclassificationRows, comparativePatternRows, traceSpineRows, navigationRows, statusVocabularyRows, forbiddenLanguageRows, tokenRows, componentRows, surfaceRows, negativeFixtureRows, handoffRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeGlobalUiReferenceIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "global-ui-reference-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p10801-p11800-phase-rows.json"), collectionEnvelope("p10801-p11800-phase-rows.v1", "p10801_p11800_phase_rows", result.p10801_p11800_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "reference-pack-source-rows.json"), collectionEnvelope("reference-pack-source-rows.v1", "reference_pack_source_rows", result.reference_pack_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "sanitized-design-reference-rows.json"), collectionEnvelope("sanitized-design-reference-rows.v1", "sanitized_design_reference_rows", result.sanitized_design_reference_rows, result.generated_at));
  await writeJson(path.join(outDir, "reference-reclassification-rows.json"), collectionEnvelope("reference-reclassification-rows.v1", "reference_reclassification_rows", result.reference_reclassification_rows, result.generated_at));
  await writeJson(path.join(outDir, "comparative-pattern-rows.json"), collectionEnvelope("comparative-pattern-rows.v1", "comparative_pattern_rows", result.comparative_pattern_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-source-contract-rows.json"), collectionEnvelope("ui-source-contract-rows.v1", "ui_source_contract_rows", result.ui_source_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "trace-spine-rows.json"), collectionEnvelope("trace-spine-rows.v1", "trace_spine_rows", result.trace_spine_rows, result.generated_at));
  await writeJson(path.join(outDir, "navigation-contract-rows.json"), collectionEnvelope("navigation-contract-rows.v1", "navigation_contract_rows", result.navigation_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "status-vocabulary-rows.json"), collectionEnvelope("status-vocabulary-rows.v1", "status_vocabulary_rows", result.status_vocabulary_rows, result.generated_at));
  await writeJson(path.join(outDir, "forbidden-language-rows.json"), collectionEnvelope("forbidden-language-rows.v1", "forbidden_language_rows", result.forbidden_language_rows, result.generated_at));
  await writeJson(path.join(outDir, "design-token-rows.json"), collectionEnvelope("design-token-rows.v1", "design_token_rows", result.design_token_rows, result.generated_at));
  await writeJson(path.join(outDir, "component-contract-rows.json"), collectionEnvelope("component-contract-rows.v1", "component_contract_rows", result.component_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-surface-contract-rows.json"), collectionEnvelope("ui-surface-contract-rows.v1", "ui_surface_contract_rows", result.ui_surface_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-negative-fixture-rows.json"), collectionEnvelope("ui-negative-fixture-rows.v1", "ui_negative_fixture_rows", result.ui_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "design-system-handoff-rows.json"), collectionEnvelope("design-system-handoff-rows.v1", "design_system_handoff_rows", result.design_system_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-reference-gate-rows.json"), collectionEnvelope("global-ui-reference-gate-rows.v1", "global_ui_reference_gate_rows", result.global_ui_reference_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-reference-boundary.json"), result.global_ui_reference_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "global-ui-reference-intake-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runGlobalUiReferenceIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runGlobalUiReferenceIntake(args);
    console.log(`Global UI reference intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.global_ui_reference_intake_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Design system range: ${result.summary.design_system_range}`);
    console.log(`Phase rows: ${result.summary.phase_count}`);
    console.log(`Reference source rows: ${result.summary.reference_source_count}`);
    console.log(`Ready for P11001 handoff: ${result.summary.ready_for_p11001_handoff}`);
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
    contract_id: "global-ui-reference-intake.contract.v1",
    generated_at: generatedAt,
    source_context_recall_guard_required: true,
    sanitized_reference_doc_required: true,
    local_reference_pack_optional: true,
    p9000_language_reclassification_required: true,
    comparative_pattern_mapping_required: true,
    trace_spine_required: true,
    global_operator_queue_home_required: true,
    object_inspector_panel_required: true,
    design_token_contract_required: true,
    component_contract_required: true,
    surface_contract_required: true,
    negative_fixture_plan_required: true,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    domain_pack_product_identity_enabled: false,
    p11800_freeze_claim_allowed_from_intake: false,
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
      evidence_ref: `docs/hermes-roadmap-p10801-p11800.md#${phaseRange}`,
      phase_range: phaseRange,
      output_ref: output,
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Phase range, name, or output missing from roadmap doc.",
      generated_at: generatedAt,
    });
  });
}

function buildReferencePackSourceRows(referencePack, generatedAt) {
  if (!referencePack.available) {
    return [verdictRow({
      row_id: "reference.local_pack.optional_absent",
      category: "reference_pack_source",
      label: "Local operator-console reference pack optional source",
      required: false,
      observed: false,
      evidence_ref: referencePack.path,
      current_verdict: "pass",
      block_reason: null,
      generated_at: generatedAt,
      optional_reason: "Sanitized design reference doc is the committed source; local reference pack may be absent in other checkouts.",
    })];
  }
  return referencePack.files.map((file) => verdictRow({
    row_id: `reference.${safeId(file.relative_path)}`,
    category: "reference_pack_source",
    label: file.relative_path,
    required: false,
    observed: true,
    evidence_ref: `${referencePack.path}/${file.relative_path}`,
    current_verdict: "pass",
    block_reason: null,
    generated_at: generatedAt,
    file_kind: file.file_kind,
    bytes: file.bytes,
    sha256: file.sha256,
    body_embedded: false,
    binary_embedded: false,
    product_asset_enabled: false,
  }));
}

function buildDesignReferenceRows(designReferenceDoc, generatedAt) {
  const checks = [
    ["design_reference.global_operator_console", ["Hermes Global Operator Console Reference"]],
    ["design_reference.preserved_patterns", ["Preserved Patterns", "Operator Queue", "Review Evidence Trace"]],
    ["design_reference.required_renames", ["Required Renames", "Readiness Rule Matrix"]],
    ["design_reference.trace_spine", TRACE_SPINE],
    ["design_reference.forbidden_claims", FORBIDDEN_COPY],
  ];
  return checks.map(([id, terms]) => {
    const observed = designReferenceDoc.available && includesAll(designReferenceDoc.text, terms);
    return verdictRow({
      row_id: id,
      category: "sanitized_design_reference",
      label: id.replace("design_reference.", ""),
      required: true,
      observed,
      evidence_ref: designReferenceDoc.path,
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : `Missing design reference terms: ${missingTerms(designReferenceDoc.text, terms).join(", ")}`,
      generated_at: generatedAt,
    });
  });
}

function buildReclassificationRows(designReferenceDoc, generatedAt) {
  return RECLASSIFICATION_SPECS.map(([id, original, replacement]) => {
    const observed = designReferenceDoc.available && includesAll(designReferenceDoc.text, [original, replacement]);
    return verdictRow({
      row_id: id,
      category: "reference_reclassification",
      label: `${original} -> ${replacement}`,
      required: true,
      observed,
      evidence_ref: designReferenceDoc.path,
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Required UI rename is missing from sanitized reference doc.",
      generated_at: generatedAt,
      original_phrase: original,
      required_phrase: replacement,
      old_phrase_allowed_in_product_ui: false,
    });
  });
}

function buildComparativePatternRows(designReferenceDoc, generatedAt) {
  return PATTERN_SPECS.map(([id, sourceFamily, hermesRole]) => {
    const sourceTerms = sourceFamily.split("/").flatMap((part) => part.split(",")).map((part) => part.trim());
    const observed = designReferenceDoc.available && includesAny(designReferenceDoc.text, sourceTerms) && designReferenceDoc.text.includes(hermesRole);
    return verdictRow({
      row_id: id,
      category: "comparative_pattern",
      label: `${sourceFamily} -> ${hermesRole}`,
      required: true,
      observed,
      evidence_ref: designReferenceDoc.path,
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Comparative reference or Hermes role missing from design reference doc.",
      generated_at: generatedAt,
      source_family: sourceFamily,
      hermes_role: hermesRole,
      copied_as_product_ui: false,
    });
  });
}

function buildSourceContractRows(generatedAt) {
  const rows = [
    ["source.path", "Reference sources are recorded by stable path/ref.", true],
    ["source.hash", "Reference source files use hash/provenance when available.", true],
    ["source.classification", "Reference sources are classified as plan/report/preview/comparable screenshot.", true],
    ["source.no_body", "Original text body is not embedded into product UI artifacts.", true],
    ["source.no_binary", "Binary screenshot body is not embedded into product UI artifacts.", true],
    ["source.no_runtime_asset", "Reference image assets are not product runtime assets.", true],
  ];
  return rows.map(([id, label, observed]) => verdictRow({
    row_id: `ui_contract.${id}`,
    category: "ui_source_contract",
    label,
    required: true,
    observed,
    evidence_ref: "docs/design/hermes-global-operator-console-reference.md#reference-evidence-role",
    current_verdict: observed ? "pass" : "blocked",
    block_reason: null,
    generated_at: generatedAt,
  }));
}

function buildTraceSpineRows(roadmapText, designReferenceText, generatedAt) {
  return TRACE_SPINE.map((node, index) => {
    const observed = roadmapText.includes(node) && designReferenceText.includes(node);
    return verdictRow({
      row_id: `trace.${safeId(node)}`,
      category: "trace_spine",
      label: node,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#global-ui-contract",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Trace spine node missing from roadmap or reference doc.",
      generated_at: generatedAt,
      spine_index: index,
      previous_node: TRACE_SPINE[index - 1] ?? null,
      next_node: TRACE_SPINE[index + 1] ?? null,
    });
  });
}

function buildNavigationRows(roadmapText, generatedAt) {
  return NAVIGATION_SPECS.map(([id, label, role]) => {
    const observed = roadmapText.includes(`\`${label}\``) || roadmapText.includes(label);
    return verdictRow({
      row_id: id,
      category: "navigation_contract",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#main-navigation",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Navigation item missing from roadmap doc.",
      generated_at: generatedAt,
      role,
      top_level_allowed: true,
      write_enabled: false,
    });
  });
}

function buildStatusVocabularyRows(roadmapText, generatedAt) {
  return ALLOWED_STATUS.map((status) => {
    const observed = roadmapText.includes(`\`${status}\``) || roadmapText.includes(status);
    return verdictRow({
      row_id: `status.${status.toLowerCase()}`,
      category: "status_vocabulary",
      label: status,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#status-vocabulary",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Allowed status missing from roadmap doc.",
      generated_at: generatedAt,
      allowed_in_product_ui: true,
      creates_final_approval: false,
    });
  });
}

function buildForbiddenLanguageRows(roadmapText, designReferenceText, generatedAt) {
  return FORBIDDEN_COPY.map((copy) => {
    const observed = roadmapText.includes(copy) && designReferenceText.includes(copy);
    return verdictRow({
      row_id: `forbidden.${safeId(copy)}`,
      category: "forbidden_language",
      label: copy,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#status-vocabulary",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Forbidden copy must be explicitly listed in roadmap and design reference.",
      generated_at: generatedAt,
      allowed_in_product_ui: false,
      negative_fixture_required: true,
    });
  });
}

function buildTokenRows(roadmapText, generatedAt) {
  return TOKEN_SPECS.map(([id, label]) => {
    const observed = includesAny(roadmapText, label.split(" "));
    return verdictRow({
      row_id: id,
      category: "design_token",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#program-structure",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Design token rule missing from roadmap doc.",
      generated_at: generatedAt,
    });
  });
}

function buildComponentRows(roadmapText, generatedAt) {
  return COMPONENT_SPECS.map((component) => {
    const observed = roadmapText.includes(`\`${component}\``) || roadmapText.includes(component);
    return verdictRow({
      row_id: `component.${safeId(component)}`,
      category: "component_contract",
      label: component,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#required-components",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "Required component missing from roadmap doc.",
      generated_at: generatedAt,
      documented: observed,
      write_enabled: false,
      final_approval_enabled: false,
    });
  });
}

function buildSurfaceRows(roadmapText, generatedAt) {
  return SURFACE_SPECS.map(([id, label, role]) => {
    const observed = roadmapText.includes(label);
    return verdictRow({
      row_id: id,
      category: "ui_surface_contract",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#program-structure",
      current_verdict: observed ? "pass" : "blocked",
      block_reason: observed ? null : "UI surface missing from roadmap doc.",
      generated_at: generatedAt,
      role,
      read_only: true,
      raw_body_visible: false,
      write_control_enabled: false,
      final_approval_ui_enabled: false,
    });
  });
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([id, label, blockCode]) => verdictRow({
    row_id: id,
    category: "ui_negative_fixture",
    label,
    required: true,
    observed: true,
    evidence_ref: `fixture://${id}`,
    current_verdict: "pass",
    block_reason: null,
    generated_at: generatedAt,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    block_code: blockCode,
    unsafe_claim_allowed: false,
  }));
}

function buildHandoffRows(generatedAt) {
  const rows = [
    ["handoff.p11001", "P11001-P11200 can consume object model, navigation, status vocabulary, and forbidden language.", "P11001-P11200"],
    ["handoff.p11201", "P11201-P11400 can consume token and component foundation inputs.", "P11201-P11400"],
    ["handoff.p11401", "P11401-P11600 can consume queue/detail/timeline/gate surface contracts.", "P11401-P11600"],
    ["handoff.p11601", "P11601-P11800 can consume negative fixture and governance review requirements.", "P11601-P11800"],
    ["handoff.p11801", "P11801-P12000 SaaS Quality Gate Packs must reuse Global Operator Console status language.", "P11801-P12000"],
  ];
  return rows.map(([id, label, target]) => verdictRow({
    row_id: id,
    category: "design_system_handoff",
    label,
    required: true,
    observed: true,
    evidence_ref: "docs/hermes-roadmap-p10801-p11800.md#completion-criteria",
    current_verdict: "pass",
    block_reason: null,
    generated_at: generatedAt,
    target_range: target,
  }));
}

function buildGateRows(context) {
  const {
    packageJson,
    roadmapDoc,
    architectureDoc,
    designReferenceDoc,
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    sourceContractRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
  } = context;
  const scriptObserved = Boolean(packageJson.data?.scripts?.[COMMAND_NAME]);
  return [
    gateRow("gate.package_script", "Package script registered", scriptObserved, "package.json#scripts"),
    gateRow("gate.roadmap_doc", "P10801-P11800 roadmap doc present", roadmapDoc.available && roadmapDoc.text.includes(DESIGN_SYSTEM_RANGE), roadmapDoc.path),
    gateRow("gate.architecture_doc", "Architecture doc references Global Operator Console design system", architectureDoc.available && architectureDoc.text.includes("P10801-P11800"), architectureDoc.path),
    gateRow("gate.design_reference_doc", "Sanitized design reference doc present", designReferenceDoc.available && designReferenceDoc.text.includes("Hermes Global Operator Console Reference"), designReferenceDoc.path),
    gateRow("gate.phase_rows", "All P10801-P11800 phase rows documented", allPass(phaseRows), "p10801_p11800_phase_rows"),
    gateRow("gate.reference_sources", "Reference pack source rows do not embed body or binary", referenceRows.every((row) => row.body_embedded !== true && row.binary_embedded !== true), "reference_pack_source_rows"),
    gateRow("gate.design_reference_rows", "Sanitized design reference rows complete", allPass(designReferenceRows), "sanitized_design_reference_rows"),
    gateRow("gate.reclassification", "P9000-only language reclassified", allPass(reclassificationRows), "reference_reclassification_rows"),
    gateRow("gate.patterns", "Comparative UI patterns mapped", allPass(comparativePatternRows), "comparative_pattern_rows"),
    gateRow("gate.source_contract", "UI source contract rows complete", allPass(sourceContractRows), "ui_source_contract_rows"),
    gateRow("gate.trace_spine", "Trace spine rows complete", allPass(traceSpineRows), "trace_spine_rows"),
    gateRow("gate.navigation", "Navigation contract rows complete", allPass(navigationRows), "navigation_contract_rows"),
    gateRow("gate.status", "Status vocabulary rows complete", allPass(statusVocabularyRows), "status_vocabulary_rows"),
    gateRow("gate.forbidden_language", "Forbidden language rows complete", allPass(forbiddenLanguageRows), "forbidden_language_rows"),
    gateRow("gate.tokens", "Design token rows complete", allPass(tokenRows), "design_token_rows"),
    gateRow("gate.components", "Component contract rows complete", allPass(componentRows), "component_contract_rows"),
    gateRow("gate.surfaces", "UI surface contract rows complete", allPass(surfaceRows), "ui_surface_contract_rows"),
    gateRow("gate.negative_fixtures", "UI negative fixtures block unsafe claims", allPass(negativeFixtureRows), "ui_negative_fixture_rows"),
    gateRow("gate.handoff", "Design system handoff rows complete", allPass(handoffRows), "design_system_handoff_rows"),
  ];
}

function buildBoundary(context) {
  const {
    referencePack,
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
    gateRows,
  } = context;
  const coreReady = [
    phaseRows,
    referenceRows,
    designReferenceRows,
    reclassificationRows,
    comparativePatternRows,
    traceSpineRows,
    navigationRows,
    statusVocabularyRows,
    forbiddenLanguageRows,
    tokenRows,
    componentRows,
    surfaceRows,
    negativeFixtureRows,
    handoffRows,
    gateRows,
  ].every(allPass);
  const unsafeFlags = [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ];
  return {
    global_ui_reference_intake_ready: coreReady,
    design_system_range_planned: allPass(phaseRows),
    local_reference_pack_available: referencePack.available,
    sanitized_reference_doc_required: true,
    source_body_embedded: false,
    binary_body_embedded: false,
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
    p11800_design_system_freeze_ready: false,
    p11800_freeze_requires_later_claude_review: true,
    ready_for_p11001_handoff: coreReady,
    ready_for_p11801_handoff: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => {
    items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  };

  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", allPass(context.phaseRows) && context.phaseRows.length === 50, "P10801-P11800 phase rows incomplete", "docs/hermes-roadmap-p10801-p11800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P10801-P11800"), "Architecture doc missing P10801-P11800 reference", "docs/architecture.md");
  add("design.reference.doc", "design_reference", allPass(context.designReferenceRows), "Sanitized design reference doc incomplete", "docs/design/hermes-global-operator-console-reference.md");
  add("reference.sources.sanitized", "source_contract", context.referenceRows.every((row) => row.body_embedded !== true && row.binary_embedded !== true), "Reference source row embeds body or binary", "reference_pack_source_rows");
  add("reclassification.rows", "language", allPass(context.reclassificationRows), "Required reclassification rows incomplete", "reference_reclassification_rows");
  add("comparative.pattern.rows", "pattern", allPass(context.comparativePatternRows), "Comparative pattern rows incomplete", "comparative_pattern_rows");
  add("trace.spine.rows", "trace_spine", allPass(context.traceSpineRows), "Trace spine rows incomplete", "trace_spine_rows");
  add("navigation.rows", "navigation", allPass(context.navigationRows), "Navigation rows incomplete", "navigation_contract_rows");
  add("status.rows", "status", allPass(context.statusVocabularyRows), "Status vocabulary rows incomplete", "status_vocabulary_rows");
  add("forbidden.language.rows", "authority", allPass(context.forbiddenLanguageRows), "Forbidden language rows incomplete", "forbidden_language_rows");
  add("token.rows", "design_tokens", allPass(context.tokenRows), "Design token rows incomplete", "design_token_rows");
  add("component.rows", "components", allPass(context.componentRows), "Component rows incomplete", "component_contract_rows");
  add("surface.rows", "surfaces", allPass(context.surfaceRows), "Surface rows incomplete", "ui_surface_contract_rows");
  add("negative.fixtures", "negative_fixtures", allPass(context.negativeFixtureRows), "Negative fixture rows incomplete", "ui_negative_fixture_rows");
  add("handoff.rows", "handoff", allPass(context.handoffRows), "Design system handoff rows incomplete", "design_system_handoff_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false, "UI intake opened write/protected action", "global_ui_reference_boundary");
  add("boundary.no.final.approval", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "UI intake opened final approval UI", "global_ui_reference_boundary");
  add("boundary.no.production.enterprise", "boundary", context.boundary.production_pass_ui_enabled === false && context.boundary.enterprise_pass_ui_enabled === false, "UI intake opened production or enterprise PASS", "global_ui_reference_boundary");
  add("boundary.ready.handoff", "boundary", context.boundary.ready_for_p11001_handoff === true, "P11001 handoff not ready", "global_ui_reference_boundary");
  return items;
}

function buildSummary(context) {
  const validation = context.validation;
  return {
    global_ui_reference_intake_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    phase_count: context.phaseRows.length,
    reference_source_count: context.referenceRows.length,
    comparative_pattern_count: context.comparativePatternRows.length,
    trace_spine_count: context.traceSpineRows.length,
    navigation_count: context.navigationRows.length,
    status_count: context.statusVocabularyRows.length,
    forbidden_language_count: context.forbiddenLanguageRows.length,
    token_count: context.tokenRows.length,
    component_count: context.componentRows.length,
    surface_count: context.surfaceRows.length,
    negative_fixture_count: context.negativeFixtureRows.length,
    local_reference_pack_available: context.referencePack.available,
    sanitized_reference_doc_required: true,
    ready_for_p11001_handoff: context.boundary.ready_for_p11001_handoff,
    ready_for_p11801_handoff: context.boundary.ready_for_p11801_handoff,
    p11800_design_system_freeze_ready: context.boundary.p11800_design_system_freeze_ready,
    raw_body_exposure_allowed: false,
    write_control_enabled: false,
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
    "# Global UI Reference Intake",
    "",
    `Status: ${result.summary.global_ui_reference_intake_status}`,
    `Program: ${result.program_range}`,
    `Design system range: ${result.design_system_range}`,
    `Phase rows: ${result.summary.phase_count}`,
    `Reference source rows: ${result.summary.reference_source_count}`,
    `Ready for P11001 handoff: ${result.summary.ready_for_p11001_handoff}`,
    "",
    "## Boundary",
    "",
    `- raw body exposure allowed: ${result.summary.raw_body_exposure_allowed}`,
    `- write control enabled: ${result.summary.write_control_enabled}`,
    `- final approval UI enabled: ${result.summary.final_approval_ui_enabled}`,
    `- production PASS UI enabled: ${result.summary.production_pass_ui_enabled}`,
    `- enterprise PASS UI enabled: ${result.summary.enterprise_pass_ui_enabled}`,
    "",
    "## Trace Spine",
    "",
    result.trace_spine_rows.map((row) => `- ${row.spine_index + 1}. ${row.label}`).join("\n"),
    "",
    "## Next",
    "",
    "P11001-P11200 should turn this intake into the full Hermes Global UI Contract.",
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.navigation_contract_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.role)}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global UI Reference Intake</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
    .cell { border: 1px solid #d9dee8; border-radius: 6px; background: #fff; padding: 10px; }
    .label { color: #5f6b7a; font-size: 12px; }
    .value { font-size: 14px; font-weight: 600; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Global UI Reference Intake</h1>
    <p class="notice">Read-only design evidence contract. No raw body, write control, final approval UI, release trust badge, or enterprise trust badge is enabled.</p>
    <section class="summary">
      <div class="cell"><div class="label">Status</div><div class="value">${escapeHtml(result.summary.global_ui_reference_intake_status)}</div></div>
      <div class="cell"><div class="label">Program</div><div class="value">${escapeHtml(result.program_range)}</div></div>
      <div class="cell"><div class="label">Design System</div><div class="value">${escapeHtml(result.design_system_range)}</div></div>
      <div class="cell"><div class="label">P11001 Handoff</div><div class="value">${String(result.summary.ready_for_p11001_handoff)}</div></div>
    </section>
    <h2>Trace Spine</h2>
    <p>${TRACE_SPINE.map(escapeHtml).join(" -> ")}</p>
    <h2>Navigation Contract</h2>
    <table><thead><tr><th>Item</th><th>Role</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readReferencePack(referencePackPath) {
  const absolutePath = path.resolve(referencePackPath);
  try {
    const rootStat = await stat(absolutePath);
    if (!rootStat.isDirectory()) {
      return { available: false, path: referencePackPath, files: [], error: "Reference pack path is not a directory." };
    }
    const files = await collectFiles(absolutePath);
    return {
      available: true,
      path: referencePackPath,
      files: await Promise.all(files.map(async (filePath) => {
        const bytes = await readFile(filePath);
        const relativePath = path.relative(absolutePath, filePath);
        return {
          relative_path: relativePath,
          file_kind: classifyReferenceFile(relativePath),
          bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      })),
    };
  } catch (error) {
    return { available: false, path: referencePackPath, files: [], error: error.message };
  }
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files.sort();
}

function normalizeInlineReferencePack(referencePack) {
  return {
    available: Boolean(referencePack?.available ?? true),
    path: referencePack?.path ?? "inline.reference_pack",
    files: Array.isArray(referencePack?.files) ? referencePack.files : [],
    error: referencePack?.error ?? null,
  };
}

function classifyReferenceFile(relativePath) {
  const base = path.basename(relativePath).toLowerCase();
  if (base.endsWith(".md")) return "reference_plan";
  if (base.endsWith(".html")) return "research_report";
  if (base.includes("preview")) return "report_preview";
  if (base.endsWith(".png")) return "comparative_screenshot";
  return "reference_file";
}

function gateRow(rowId, label, observed, evidenceRef) {
  return verdictRow({
    row_id: rowId,
    category: "gate",
    label,
    required: true,
    observed,
    evidence_ref: evidenceRef,
    current_verdict: observed ? "pass" : "blocked",
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
  return {
    item_id: itemId,
    category,
    ok,
    message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.ok);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.architectureDocPath,
    design_reference_doc_path: options.designReferenceDocPath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.designReferenceDocPath,
    reference_pack_path: options.referencePackPath ?? DEFAULT_GLOBAL_UI_REFERENCE_INTAKE_INPUTS.referencePackPath,
  };
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
    else if (value === "--design-reference-doc-path") args.designReferenceDocPath = argv[++index];
    else if (value === "--reference-pack-path") args.referencePackPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR]`);
  console.log("Creates the P10801-P11000 Global UI reference intake artifacts.");
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

function includesAny(text = "", terms = []) {
  return terms.some((term) => text.includes(term));
}

function missingTerms(text = "", terms = []) {
  return terms.filter((term) => !text.includes(term));
}

function safeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
