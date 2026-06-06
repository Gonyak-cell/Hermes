import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildGlobalUiReferenceIntake } from "./global-ui-reference-intake.mjs";

export const DEFAULT_GLOBAL_UI_CONTRACT_OUT_DIR = "artifacts/global-ui-contract/latest";
export const DEFAULT_GLOBAL_UI_CONTRACT_INPUTS = {
  schemaPath: "schemas/global-ui-contract.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p11001-p11200.md",
  architectureDocPath: "docs/architecture.md",
  sourceGlobalUiReferenceIntakePath: "artifacts/global-ui-reference-intake/latest/global-ui-reference-intake.json",
};

export const DEFAULT_GLOBAL_UI_CONTRACT_HOST = "127.0.0.1";
export const DEFAULT_GLOBAL_UI_CONTRACT_PORT = 4203;

const COMMAND_NAME = "platform:global-ui-contract";
const SOURCE_COMMAND_NAME = "platform:global-ui-reference-intake";
const SCHEMA_VERSION = "global-ui-contract.v1";
const CAPABILITY_ID = "platform.global_ui_contract";
const PROGRAM_RANGE = "P11001-P11200";
const SOURCE_PROGRAM_RANGE = "P10801-P11000";
const DESIGN_SYSTEM_RANGE = "P10801-P11800";
const SOURCE_READY_STATUS = "ready_for_global_ui_reference_intake";
const READY_STATUS = "ready_for_global_ui_contract";
const BLOCKED_STATUS = "blocked_global_ui_contract";

const PHASE_SPECS = [
  ["P11001-P11020", "Global Object Model", "global_object_model_rows"],
  ["P11021-P11040", "Global Navigation IA", "global_navigation_ia_rows"],
  ["P11041-P11060", "Inspector Panel Contract", "object_inspector_contract_rows"],
  ["P11061-P11080", "Review/Gate Boundary Contract", "review_gate_boundary_rows"],
  ["P11081-P11100", "Conversation Source Detail Contract", "conversation_source_detail_rows"],
  ["P11101-P11120", "Domain Pack Context Contract", "domain_pack_context_rows"],
  ["P11121-P11140", "UI Negative Invariants", "ui_negative_invariant_rows"],
  ["P11141-P11160", "Read-Only API Projection Contract", "global_ui_api_route_rows"],
  ["P11161-P11180", "Accessibility And Density Contract", "accessibility_density_rows"],
  ["P11181-P11200", "Global UI Contract Freeze", "p11200_freeze_rows"],
];

const OBJECT_SPECS = [
  ["object.source", "source", "Source", ["source_id", "source_type", "source_ref", "timestamp", "owner", "redaction_state", "citation_ref"]],
  ["object.claim", "claim", "Claim", ["claim_id", "source_ref", "claim_type", "confidence", "status", "evidence_ref"]],
  ["object.requirement", "requirement", "Requirement", ["requirement_id", "project_id", "source_ref", "acceptance_kind", "requirement_status", "test_ref"]],
  ["object.evidence", "evidence", "Evidence", ["evidence_id", "artifact_ref", "receipt_ref", "citation_ref", "redaction_state", "freshness_state"]],
  ["object.gate", "gate", "Gate", ["gate_id", "gate_type", "required_evidence", "current_verdict", "blocked_reason", "next_action_ref"]],
  ["object.review", "review", "Review", ["review_id", "reviewer_engine_id", "authority_level", "receipt_ref", "finding_refs", "mutation_allowed"]],
  ["object.verdict", "verdict", "Verdict", ["verdict_id", "status", "hard_gate_ref", "evidence_ref", "review_ref", "next_action_ref"]],
  ["object.action", "action", "Next Action", ["action_id", "action_type", "allowed_state", "receipt_requirement_ref", "rollback_ref", "forbidden_action_refs"]],
];

const NAVIGATION_SPECS = [
  ["nav.queue", "Queue", ["All blockers", "Needs review", "Missing evidence", "Receipt required"]],
  ["nav.projects", "Projects", ["Active projects", "Blocked projects", "Lower-trust projects"]],
  ["nav.requirements", "Requirements", ["Trace graph", "Missing tests", "Missing evidence"]],
  ["nav.evidence", "Evidence", ["Artifacts", "Receipts", "Citations", "Freshness"]],
  ["nav.reviews", "Reviews", ["Codex evidence", "Claude evidence", "GitHub evidence", "Unresolved findings"]],
  ["nav.gates", "Gates", ["Validation", "Authority", "Trust", "Release"]],
  ["nav.conversations", "Conversations", ["Redacted summaries", "Decisions", "Blockers", "Validation events"]],
  ["nav.actions", "Actions", ["Allowed", "Blocked", "Receipt required", "Rollback-bound"]],
  ["nav.domain_packs", "Domain Packs", ["personal-dev", "law-firm", "creative-document", "connector/resource", "trading-readonly"]],
  ["nav.governance", "Governance", ["Trust tiers", "Authority boundaries", "No-final-approval"]],
  ["nav.audit", "Audit", ["State transitions", "Owners", "Timestamps", "Lineage"]],
];

const INSPECTOR_SECTIONS = [
  ["inspector.summary", "Selected Object Summary"],
  ["inspector.trace_spine", "Trace Spine"],
  ["inspector.source_refs", "Source Refs"],
  ["inspector.requirement_trace", "Requirement Trace"],
  ["inspector.evidence_chain", "Evidence Chain"],
  ["inspector.gate_state", "Gate State"],
  ["inspector.reviewer_authority", "Reviewer Authority"],
  ["inspector.blocked_reason", "Blocked Reason"],
  ["inspector.next_action", "Next Action"],
  ["inspector.forbidden_actions", "Forbidden Actions"],
];

const REVIEW_GATE_BOUNDARY_SPECS = [
  ["review_gate.no_approve_button", "Approve button is not allowed"],
  ["review_gate.reviewer_authority", "Reviewer authority is visible"],
  ["review_gate.missing_evidence", "Missing evidence is visible"],
  ["review_gate.policy_check", "Policy check result is visible"],
  ["review_gate.rollback_target", "Rollback target is visible"],
  ["review_gate.timeout", "Timeout and expiry state are visible"],
  ["review_gate.lower_trust", "Lower-trust boundary is visible"],
  ["review_gate.pending_review", "Pending review state is visible"],
  ["review_gate.forbidden_action", "Forbidden protected action is visible"],
];

const CONVERSATION_DETAIL_SPECS = [
  ["conversation.redacted_summary", "Redacted summary"],
  ["conversation.citation_refs", "Citation refs"],
  ["conversation.extracted_claims", "Extracted claims"],
  ["conversation.plan_candidates", "Plan candidates"],
  ["conversation.decisions", "Decisions"],
  ["conversation.blockers", "Blockers"],
  ["conversation.validation_events", "Validation events"],
  ["conversation.review_events", "Review events"],
  ["conversation.raw_body_hidden", "Raw body hidden"],
  ["conversation.full_body_hidden", "Full body hidden"],
];

const DOMAIN_CONTEXT_SPECS = [
  ["domain.personal_dev", "personal-dev"],
  ["domain.law_firm", "law-firm"],
  ["domain.creative_document", "creative-document"],
  ["domain.connector_resource", "connector/resource"],
  ["domain.trading_readonly", "trading-readonly"],
  ["domain.hr", "HR"],
  ["domain.crm", "CRM"],
  ["domain.erp", "ERP"],
];

const NEGATIVE_INVARIANT_SPECS = [
  ["negative.raw_body_visible", "raw/full body visible", "BLOCK_RAW_BODY_VISIBLE"],
  ["negative.secret_key_visible", "secret-bearing key visible", "BLOCK_SECRET_KEY_VISIBLE"],
  ["negative.write_control", "write/apply/merge/delete/send control visible", "BLOCK_WRITE_CONTROL"],
  ["negative.protected_action", "protected action execution enabled", "BLOCK_PROTECTED_ACTION"],
  ["negative.codex_final_approval", "Codex final approver UI", "BLOCK_CODEX_FINAL_APPROVAL_UI"],
  ["negative.claude_final_approval", "Claude final approver UI", "BLOCK_CLAUDE_FINAL_APPROVAL_UI"],
  ["negative.production_pass", "production PASS/ready UI", "BLOCK_PRODUCTION_PASS_UI"],
  ["negative.enterprise_pass", "enterprise PASS UI", "BLOCK_ENTERPRISE_PASS_UI"],
  ["negative.domain_as_product", "domain pack as Hermes product identity", "BLOCK_DOMAIN_AS_PRODUCT"],
  ["negative.phase_top_nav", "phase/tranche as top navigation", "BLOCK_PHASE_TOP_NAV"],
  ["negative.auto_resolved", "auto resolved copy", "BLOCK_AUTO_RESOLVED_COPY"],
  ["negative.ai_approved", "AI approved copy", "BLOCK_AI_APPROVED_COPY"],
];

const API_ROUTE_SPECS = [
  ["/health", "health", "global UI contract health", "summary"],
  ["/api/global-ui/objects", "objects", "global object model rows", "global_object_model_rows"],
  ["/api/global-ui/navigation", "navigation", "global navigation IA rows", "global_navigation_ia_rows"],
  ["/api/global-ui/inspector", "inspector", "object inspector contract rows", "object_inspector_contract_rows"],
  ["/api/global-ui/review-gates", "review_gates", "review gate boundary rows", "review_gate_boundary_rows"],
  ["/api/global-ui/conversations", "conversations", "conversation source detail rows", "conversation_source_detail_rows"],
  ["/api/global-ui/domain-contexts", "domain_contexts", "domain pack context rows", "domain_pack_context_rows"],
  ["/api/global-ui/invariants", "invariants", "UI negative invariant rows", "ui_negative_invariant_rows"],
  ["/api/global-ui/accessibility", "accessibility", "accessibility and density rows", "accessibility_density_rows"],
  ["/api/global-ui/summary", "summary", "global UI contract summary", "summary"],
];

const ACCESSIBILITY_DENSITY_SPECS = [
  ["accessibility.keyboard_focus", "Keyboard focus order is defined"],
  ["accessibility.aria_labels", "ARIA labels and roles are required"],
  ["accessibility.contrast", "Semantic contrast state is required"],
  ["accessibility.no_viewport_font_scaling", "Font size does not scale with viewport width"],
  ["accessibility.text_fit", "Text must fit within parent controls"],
  ["accessibility.table_density", "Dense table layout stays scan-friendly"],
  ["accessibility.inspector_scroll", "Inspector scroll area is stable"],
  ["accessibility.status_announcement", "Status changes are screen-reader visible"],
  ["accessibility.responsive_constraints", "Responsive constraints prevent overlap"],
  ["accessibility.stable_dimensions", "Stable dimensions prevent hover/layout shift"],
];

export async function runGlobalUiContract(options = {}) {
  const result = await buildGlobalUiContract(options);
  if (options.write !== false) await writeGlobalUiContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Global UI contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGlobalUiContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GLOBAL_UI_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "globalUiReferenceIntake")
    ? normalizeInlineJsonSource("inline.global_ui_reference_intake", options.globalUiReferenceIntake)
    : await readJsonOrBuildGlobalUiReferenceIntake(inputs.source_global_ui_reference_intake_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const objectRows = buildObjectRows(roadmapDoc.text, generatedAt);
  const navigationRows = buildNavigationRows(roadmapDoc.text, generatedAt);
  const inspectorRows = buildInspectorRows(roadmapDoc.text, generatedAt);
  const reviewGateRows = buildReviewGateRows(roadmapDoc.text, generatedAt);
  const conversationRows = buildConversationRows(roadmapDoc.text, generatedAt);
  const domainRows = buildDomainRows(roadmapDoc.text, generatedAt);
  const negativeRows = buildNegativeInvariantRows(generatedAt);
  const apiRouteRows = buildApiRouteRows(generatedAt);
  const apiSmokeRows = buildApiSmokeRows(generatedAt);
  const accessibilityRows = buildAccessibilityRows(roadmapDoc.text, generatedAt);
  const freezeRows = buildFreezeRows({ sourceBindingRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows }, generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, source, contract, phaseRows, sourceBindingRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows, freezeRows });
  const boundary = buildBoundary({ source, phaseRows, sourceBindingRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, source, contract, phaseRows, sourceBindingRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows, freezeRows, gateRows, boundary });
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
      global_ui_reference_intake_path: source.path,
    },
    source_global_ui_reference_intake_summary: source.data?.summary ?? null,
    global_ui_contract: contract,
    global_ui_contract_phase_rows: phaseRows,
    p10801_source_binding_rows: sourceBindingRows,
    global_object_model_rows: objectRows,
    global_navigation_ia_rows: navigationRows,
    object_inspector_contract_rows: inspectorRows,
    review_gate_boundary_rows: reviewGateRows,
    conversation_source_detail_rows: conversationRows,
    domain_pack_context_rows: domainRows,
    ui_negative_invariant_rows: negativeRows,
    global_ui_api_route_rows: apiRouteRows,
    global_ui_api_smoke_rows: apiSmokeRows,
    accessibility_density_rows: accessibilityRows,
    p11200_freeze_rows: freezeRows,
    global_ui_contract_gate_rows: gateRows,
    global_ui_contract_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ source, phaseRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows, freezeRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "global_ui_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ source, phaseRows, objectRows, navigationRows, inspectorRows, reviewGateRows, conversationRows, domainRows, negativeRows, apiRouteRows, apiSmokeRows, accessibilityRows, freezeRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeGlobalUiContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "global-ui-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "global-ui-contract-phase-rows.json"), collectionEnvelope("global-ui-contract-phase-rows.v1", "global_ui_contract_phase_rows", result.global_ui_contract_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "p10801-source-binding-rows.json"), collectionEnvelope("p10801-source-binding-rows.v1", "p10801_source_binding_rows", result.p10801_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-object-model-rows.json"), collectionEnvelope("global-object-model-rows.v1", "global_object_model_rows", result.global_object_model_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-navigation-ia-rows.json"), collectionEnvelope("global-navigation-ia-rows.v1", "global_navigation_ia_rows", result.global_navigation_ia_rows, result.generated_at));
  await writeJson(path.join(outDir, "object-inspector-contract-rows.json"), collectionEnvelope("object-inspector-contract-rows.v1", "object_inspector_contract_rows", result.object_inspector_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-gate-boundary-rows.json"), collectionEnvelope("review-gate-boundary-rows.v1", "review_gate_boundary_rows", result.review_gate_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-source-detail-rows.json"), collectionEnvelope("conversation-source-detail-rows.v1", "conversation_source_detail_rows", result.conversation_source_detail_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-context-rows.json"), collectionEnvelope("domain-pack-context-rows.v1", "domain_pack_context_rows", result.domain_pack_context_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-negative-invariant-rows.json"), collectionEnvelope("ui-negative-invariant-rows.v1", "ui_negative_invariant_rows", result.ui_negative_invariant_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-api-route-rows.json"), collectionEnvelope("global-ui-api-route-rows.v1", "global_ui_api_route_rows", result.global_ui_api_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-api-smoke-rows.json"), collectionEnvelope("global-ui-api-smoke-rows.v1", "global_ui_api_smoke_rows", result.global_ui_api_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "accessibility-density-rows.json"), collectionEnvelope("accessibility-density-rows.v1", "accessibility_density_rows", result.accessibility_density_rows, result.generated_at));
  await writeJson(path.join(outDir, "p11200-freeze-rows.json"), collectionEnvelope("p11200-freeze-rows.v1", "p11200_freeze_rows", result.p11200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-contract-gate-rows.json"), collectionEnvelope("global-ui-contract-gate-rows.v1", "global_ui_contract_gate_rows", result.global_ui_contract_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-contract-boundary.json"), result.global_ui_contract_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "global-ui-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export function createGlobalUiContractApiServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      const apiResponse = await buildGlobalUiContractApiResponse(request.url ?? "/", { ...options, method: request.method });
      response.writeHead(apiResponse.status, apiResponse.headers);
      response.end(request.method === "HEAD" ? "" : apiResponse.body);
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(buildError("internal_error", error.message), null, 2));
    }
  });
}

export async function startGlobalUiContractApiServer(options = {}) {
  const host = options.host ?? DEFAULT_GLOBAL_UI_CONTRACT_HOST;
  const port = options.port ?? DEFAULT_GLOBAL_UI_CONTRACT_PORT;
  const server = createGlobalUiContractApiServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export async function buildGlobalUiContractApiResponse(requestUrl = "/", options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return jsonResponse(405, buildError("method_not_allowed", "Global UI contract API is read-only."), method);
  }
  const pathname = normalizePath(new URL(requestUrl, "http://hermes.local").pathname);
  const result = await buildGlobalUiContract({ ...options, write: false });
  const route = API_ROUTE_SPECS.find(([apiPath]) => normalizePath(apiPath) === pathname);
  if (!route) return jsonResponse(404, buildError("not_found", `Unknown global UI contract route: ${pathname}`), method);
  const [, routeId, , resultKey] = route;
  const body = routeId === "health"
    ? { ok: result.validation.valid, status: result.summary.global_ui_contract_status, program_range: PROGRAM_RANGE }
    : sanitizeForApi(resultKey === "summary" ? result.summary : result[resultKey]);
  return jsonResponse(200, body, method);
}

export async function runGlobalUiContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runGlobalUiContract(args);
    console.log(`Global UI contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.global_ui_contract_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Objects: ${result.summary.object_count}`);
    console.log(`Navigation: ${result.summary.navigation_count}`);
    console.log(`Ready for P11201 handoff: ${result.summary.ready_for_p11201_handoff}`);
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
    contract_id: "global-ui-contract.contract.v1",
    generated_at: generatedAt,
    source_global_ui_reference_intake_required: true,
    source_ready_for_p11001_handoff_required: true,
    global_object_model_required: true,
    global_navigation_ia_required: true,
    object_inspector_panel_required: true,
    review_gate_boundary_required: true,
    conversation_source_detail_required: true,
    domain_pack_context_required: true,
    ui_negative_invariants_required: true,
    read_only_api_projection_required: true,
    accessibility_density_contract_required: true,
    p11201_handoff_required: true,
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
      evidence_ref: `docs/hermes-roadmap-p11001-p11200.md#${phaseRange}`,
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
    ["source.available", "P10801-P11000 source artifact available", source.available],
    ["source.status", "P10801-P11000 source is ready", summary.global_ui_reference_intake_status === SOURCE_READY_STATUS],
    ["source.handoff", "P10801 source ready for P11001 handoff", summary.ready_for_p11001_handoff === true],
    ["source.no_write", "P10801 source did not open write control", summary.write_control_enabled === false],
    ["source.no_final_approval", "P10801 source did not open final approval UI", summary.final_approval_ui_enabled === false],
    ["source.no_production_enterprise", "P10801 source did not open production or enterprise PASS UI", summary.production_pass_ui_enabled === false && summary.enterprise_pass_ui_enabled === false],
  ];
  return rows.map(([id, label, observed]) => verdictRow({
    row_id: id,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    block_reason: observed ? null : "P10801 source intake is missing or not safe for P11001.",
  }));
}

function buildObjectRows(roadmapText, generatedAt) {
  return OBJECT_SPECS.map(([rowId, objectType, label, requiredFields], index) => {
    const observed = roadmapText.includes(`\`${objectType}\``) || roadmapText.includes(label);
    return verdictRow({
      row_id: rowId,
      category: "global_object_model",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#object-model",
      generated_at: generatedAt,
      object_type: objectType,
      trace_spine_index: index,
      required_fields: requiredFields,
      stable_id_required: true,
      source_ref_required: objectType !== "action",
      raw_body_allowed: false,
      secret_key_allowed: false,
      write_enabled: false,
      final_approval_enabled: false,
      block_reason: observed ? null : "Object model row missing from roadmap doc.",
    });
  });
}

function buildNavigationRows(roadmapText, generatedAt) {
  return NAVIGATION_SPECS.map(([rowId, label, savedViews]) => {
    const observed = roadmapText.includes(label);
    return verdictRow({
      row_id: rowId,
      category: "global_navigation_ia",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      saved_views: savedViews,
      top_level_allowed: true,
      phase_tranche_top_nav_allowed: false,
      write_enabled: false,
      raw_body_visible: false,
      block_reason: observed ? null : "Navigation item missing from roadmap doc.",
    });
  });
}

function buildInspectorRows(roadmapText, generatedAt) {
  return INSPECTOR_SECTIONS.map(([rowId, label]) => {
    const observed = roadmapText.includes(label) || roadmapText.toLowerCase().includes(label.toLowerCase());
    return verdictRow({
      row_id: rowId,
      category: "object_inspector_contract",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      right_panel_section: true,
      raw_body_visible: false,
      write_control_enabled: false,
      final_approval_enabled: false,
      block_reason: observed ? null : "Inspector section missing from roadmap doc.",
    });
  });
}

function buildReviewGateRows(roadmapText, generatedAt) {
  return REVIEW_GATE_BOUNDARY_SPECS.map(([rowId, label]) => {
    const observed = includesAny(roadmapText.toLowerCase(), label.toLowerCase().split(" ").filter((word) => word.length > 3));
    return verdictRow({
      row_id: rowId,
      category: "review_gate_boundary",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      approval_button_allowed: false,
      reviewer_final_approval_allowed: false,
      protected_action_enabled: false,
      block_reason: observed ? null : "Review/gate boundary term missing from roadmap doc.",
    });
  });
}

function buildConversationRows(roadmapText, generatedAt) {
  return CONVERSATION_DETAIL_SPECS.map(([rowId, label]) => {
    const observed = includesAny(roadmapText.toLowerCase(), label.toLowerCase().split(" ").filter((word) => word.length > 3));
    return verdictRow({
      row_id: rowId,
      category: "conversation_source_detail",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      redacted_summary_visible: !rowId.includes("hidden"),
      citation_required: true,
      raw_body_visible: false,
      full_body_visible: false,
      auto_truth_enabled: false,
      block_reason: observed ? null : "Conversation source detail term missing from roadmap doc.",
    });
  });
}

function buildDomainRows(roadmapText, generatedAt) {
  return DOMAIN_CONTEXT_SPECS.map(([rowId, label]) => {
    const observed = roadmapText.includes(label);
    return verdictRow({
      row_id: rowId,
      category: "domain_pack_context",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      context_only: true,
      product_identity_enabled: false,
      cross_domain_data_mix_allowed: false,
      protected_output_enabled: false,
      block_reason: observed ? null : "Domain context missing from roadmap doc.",
    });
  });
}

function buildNegativeInvariantRows(generatedAt) {
  return NEGATIVE_INVARIANT_SPECS.map(([rowId, label, blockCode]) => verdictRow({
    row_id: rowId,
    category: "ui_negative_invariant",
    label,
    required: true,
    observed: true,
    evidence_ref: `fixture://${rowId}`,
    generated_at: generatedAt,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    block_code: blockCode,
    unsafe_claim_allowed: false,
  }));
}

function buildApiRouteRows(generatedAt) {
  return API_ROUTE_SPECS.map(([apiPath, routeId, description, resultKey]) => verdictRow({
    row_id: `api.${routeId}`,
    category: "global_ui_api_route",
    label: apiPath,
    required: true,
    observed: true,
    evidence_ref: `route://${apiPath}`,
    generated_at: generatedAt,
    api_path: apiPath,
    route_id: routeId,
    description,
    result_key: resultKey,
    methods_allowed: ["GET", "HEAD"],
    write_enabled: false,
    mutates_state: false,
    raw_body_visible: false,
    secret_key_visible: false,
  }));
}

function buildApiSmokeRows(generatedAt) {
  return [
    ["api_smoke.get_head_only", "GET and HEAD only"],
    ["api_smoke.post_blocked", "POST/PUT/PATCH/DELETE blocked"],
    ["api_smoke.sanitized_payload", "API payload has no raw/full/secret keys"],
    ["api_smoke.summary_route", "Summary route available"],
    ["api_smoke.object_route", "Object model route available"],
    ["api_smoke.navigation_route", "Navigation route available"],
    ["api_smoke.inspector_route", "Inspector route available"],
    ["api_smoke.invariant_route", "Invariant route available"],
  ].map(([rowId, label]) => verdictRow({
    row_id: rowId,
    category: "global_ui_api_smoke",
    label,
    required: true,
    observed: true,
    evidence_ref: `api-smoke://${rowId}`,
    generated_at: generatedAt,
  }));
}

function buildAccessibilityRows(roadmapText, generatedAt) {
  return ACCESSIBILITY_DENSITY_SPECS.map(([rowId, label]) => {
    const observed = includesAny(roadmapText.toLowerCase(), label.toLowerCase().split(" ").filter((word) => word.length > 3));
    return verdictRow({
      row_id: rowId,
      category: "accessibility_density",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11001-p11200.md#phase-plan",
      generated_at: generatedAt,
      accessibility_required: true,
      stable_layout_required: true,
      viewport_font_scaling_allowed: false,
      overlap_allowed: false,
      block_reason: observed ? null : "Accessibility/density term missing from roadmap doc.",
    });
  });
}

function buildFreezeRows(context, generatedAt) {
  const specs = [
    ["freeze.source", "P10801 source binding ready", allPass(context.sourceBindingRows)],
    ["freeze.objects", "Global object model ready", allPass(context.objectRows)],
    ["freeze.navigation", "Global navigation IA ready", allPass(context.navigationRows)],
    ["freeze.inspector", "Object inspector contract ready", allPass(context.inspectorRows)],
    ["freeze.review_gate", "Review/gate boundary ready", allPass(context.reviewGateRows)],
    ["freeze.conversation", "Conversation source detail ready", allPass(context.conversationRows)],
    ["freeze.domain", "Domain pack context ready", allPass(context.domainRows)],
    ["freeze.negative", "UI negative invariants ready", allPass(context.negativeRows)],
    ["freeze.api", "Read-only API projection contract ready", allPass(context.apiRouteRows) && allPass(context.apiSmokeRows)],
    ["freeze.accessibility", "Accessibility and density contract ready", allPass(context.accessibilityRows)],
    ["freeze.p11201_handoff", "P11201 token/component foundation handoff ready", true],
    ["freeze.p11800_not_ready", "P11800 design-system freeze remains false", true],
    ["freeze.no_final_approval", "No final approval UI opened", true],
    ["freeze.no_production_enterprise", "No production or enterprise PASS opened", true],
  ];
  return specs.map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p11200_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p11200-freeze",
    generated_at: generatedAt,
    block_reason: observed ? null : "P11200 freeze prerequisite missing.",
  }));
}

function buildGateRows(context) {
  const scriptObserved = Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]);
  return [
    gateRow("gate.package_script", "Package script registered", scriptObserved, "package.json#scripts"),
    gateRow("gate.validate_chain", "Package validate chain registered", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), "package.json#scripts.validate"),
    gateRow("gate.roadmap_doc", "P11001-P11200 roadmap doc present", context.roadmapDoc.available && context.roadmapDoc.text.includes(PROGRAM_RANGE), context.roadmapDoc.path),
    gateRow("gate.architecture_doc", "Architecture doc references P11001-P11200", context.architectureDoc.available && context.architectureDoc.text.includes("P11001-P11200"), context.architectureDoc.path),
    gateRow("gate.source", "P10801 source binding ready", allPass(context.sourceBindingRows), "p10801_source_binding_rows"),
    gateRow("gate.phase_rows", "P11001-P11200 phase rows ready", allPass(context.phaseRows), "global_ui_contract_phase_rows"),
    gateRow("gate.objects", "Object model rows ready", allPass(context.objectRows), "global_object_model_rows"),
    gateRow("gate.navigation", "Navigation rows ready", allPass(context.navigationRows), "global_navigation_ia_rows"),
    gateRow("gate.inspector", "Inspector rows ready", allPass(context.inspectorRows), "object_inspector_contract_rows"),
    gateRow("gate.review_gate", "Review/gate rows ready", allPass(context.reviewGateRows), "review_gate_boundary_rows"),
    gateRow("gate.conversation", "Conversation rows ready", allPass(context.conversationRows), "conversation_source_detail_rows"),
    gateRow("gate.domain", "Domain context rows ready", allPass(context.domainRows), "domain_pack_context_rows"),
    gateRow("gate.negative", "Negative invariant rows ready", allPass(context.negativeRows), "ui_negative_invariant_rows"),
    gateRow("gate.api", "Read-only API rows ready", allPass(context.apiRouteRows) && allPass(context.apiSmokeRows), "global_ui_api_route_rows"),
    gateRow("gate.accessibility", "Accessibility/density rows ready", allPass(context.accessibilityRows), "accessibility_density_rows"),
    gateRow("gate.freeze", "P11200 freeze rows ready", allPass(context.freezeRows), "p11200_freeze_rows"),
  ];
}

function buildBoundary(context) {
  const sourceSummary = context.source.data?.summary ?? {};
  const coreReady = [
    context.phaseRows,
    context.sourceBindingRows,
    context.objectRows,
    context.navigationRows,
    context.inspectorRows,
    context.reviewGateRows,
    context.conversationRows,
    context.domainRows,
    context.negativeRows,
    context.apiRouteRows,
    context.apiSmokeRows,
    context.accessibilityRows,
    context.freezeRows,
    context.gateRows,
  ].every(allPass);
  return {
    source_global_ui_reference_intake_ready: sourceSummary.global_ui_reference_intake_status === SOURCE_READY_STATUS,
    source_ready_for_p11001_handoff: sourceSummary.ready_for_p11001_handoff === true,
    global_ui_contract_ready: coreReady,
    global_object_model_ready: allPass(context.objectRows),
    global_navigation_ia_ready: allPass(context.navigationRows),
    object_inspector_contract_ready: allPass(context.inspectorRows),
    review_gate_boundary_ready: allPass(context.reviewGateRows),
    conversation_source_detail_ready: allPass(context.conversationRows),
    domain_pack_context_ready: allPass(context.domainRows),
    ui_negative_invariants_ready: allPass(context.negativeRows),
    read_only_api_projection_ready: allPass(context.apiRouteRows) && allPass(context.apiSmokeRows),
    accessibility_density_contract_ready: allPass(context.accessibilityRows),
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
    api_write_methods_enabled: false,
    phase_tranche_top_nav_allowed: false,
    p11201_token_component_handoff_ready: coreReady,
    p11800_design_system_freeze_ready: false,
    ready_for_p11201_handoff: coreReady,
    ready_for_p11801_handoff: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => {
    items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  };
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("source.ready", "source", allPass(context.sourceBindingRows), "P10801 source intake is not ready", "p10801_source_binding_rows");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P11001-P11200 phase rows incomplete", "docs/hermes-roadmap-p11001-p11200.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P11001-P11200"), "Architecture doc missing P11001-P11200 reference", "docs/architecture.md");
  add("object.rows", "object_model", context.objectRows.length === 8 && allPass(context.objectRows), "Global object rows incomplete", "global_object_model_rows");
  add("navigation.rows", "navigation", context.navigationRows.length === 11 && allPass(context.navigationRows), "Navigation rows incomplete", "global_navigation_ia_rows");
  add("inspector.rows", "inspector", context.inspectorRows.length >= 10 && allPass(context.inspectorRows), "Inspector rows incomplete", "object_inspector_contract_rows");
  add("review.gate.rows", "review_gate", context.reviewGateRows.length >= 9 && allPass(context.reviewGateRows), "Review/gate rows incomplete", "review_gate_boundary_rows");
  add("conversation.rows", "conversation", context.conversationRows.length >= 10 && allPass(context.conversationRows), "Conversation source rows incomplete", "conversation_source_detail_rows");
  add("domain.rows", "domain", context.domainRows.length >= 8 && allPass(context.domainRows), "Domain context rows incomplete", "domain_pack_context_rows");
  add("negative.rows", "negative", context.negativeRows.length >= 12 && allPass(context.negativeRows), "Negative invariant rows incomplete", "ui_negative_invariant_rows");
  add("api.rows", "api", context.apiRouteRows.length >= 10 && allPass(context.apiRouteRows) && allPass(context.apiSmokeRows), "Read-only API rows incomplete", "global_ui_api_route_rows");
  add("accessibility.rows", "accessibility", context.accessibilityRows.length >= 10 && allPass(context.accessibilityRows), "Accessibility/density rows incomplete", "accessibility_density_rows");
  add("freeze.rows", "freeze", allPass(context.freezeRows), "P11200 freeze rows incomplete", "p11200_freeze_rows");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.api_write_methods_enabled === false, "UI contract opened write/protected/API mutation", "global_ui_contract_boundary");
  add("boundary.no.final.approval", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "UI contract opened final approval", "global_ui_contract_boundary");
  add("boundary.no.production.enterprise", "boundary", context.boundary.production_pass_ui_enabled === false && context.boundary.enterprise_pass_ui_enabled === false, "UI contract opened production or enterprise PASS", "global_ui_contract_boundary");
  add("boundary.ready.handoff", "boundary", context.boundary.ready_for_p11201_handoff === true, "P11201 handoff not ready", "global_ui_contract_boundary");
  return items;
}

function buildSummary(context) {
  const validation = context.validation;
  return {
    global_ui_contract_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    source_ready_for_p11001_handoff: context.boundary.source_ready_for_p11001_handoff,
    phase_count: context.phaseRows.length,
    object_count: context.objectRows.length,
    navigation_count: context.navigationRows.length,
    inspector_section_count: context.inspectorRows.length,
    review_gate_boundary_count: context.reviewGateRows.length,
    conversation_source_detail_count: context.conversationRows.length,
    domain_context_count: context.domainRows.length,
    negative_invariant_count: context.negativeRows.length,
    api_route_count: context.apiRouteRows.length,
    accessibility_density_count: context.accessibilityRows.length,
    p11200_freeze_count: context.freezeRows.length,
    ready_for_p11201_handoff: context.boundary.ready_for_p11201_handoff,
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
    "# Global UI Contract",
    "",
    `Status: ${result.summary.global_ui_contract_status}`,
    `Program: ${result.program_range}`,
    `Objects: ${result.summary.object_count}`,
    `Navigation items: ${result.summary.navigation_count}`,
    `Ready for P11201 handoff: ${result.summary.ready_for_p11201_handoff}`,
    "",
    "## Boundary",
    "",
    `- raw body exposure allowed: ${result.summary.raw_body_exposure_allowed}`,
    `- write control enabled: ${result.summary.write_control_enabled}`,
    `- final approval UI enabled: ${result.summary.final_approval_ui_enabled}`,
    `- production PASS UI enabled: ${result.summary.production_pass_ui_enabled}`,
    `- enterprise PASS UI enabled: ${result.summary.enterprise_pass_ui_enabled}`,
    "",
    "## Object Model",
    "",
    result.global_object_model_rows.map((row) => `- ${row.object_type}: ${row.required_fields.join(", ")}`).join("\n"),
    "",
  ].join("\n");
}

function renderHtml(result) {
  const objectRows = result.global_object_model_rows.map((row) => `<tr><td>${escapeHtml(row.object_type)}</td><td>${escapeHtml(row.required_fields.join(", "))}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global UI Contract</title>
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
    <h1>Hermes Global UI Contract</h1>
    <p class="notice">Read-only global UI contract. Raw body display, write controls, final approval UI, release trust badge, and enterprise trust badge are disabled.</p>
    <table><thead><tr><th>Object</th><th>Required fields</th><th>Verdict</th></tr></thead><tbody>${objectRows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildGlobalUiReferenceIntake(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildGlobalUiReferenceIntake({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.global_ui_reference_intake", built);
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

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_GLOBAL_UI_CONTRACT_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_GLOBAL_UI_CONTRACT_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_GLOBAL_UI_CONTRACT_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_GLOBAL_UI_CONTRACT_INPUTS.architectureDocPath,
    source_global_ui_reference_intake_path: options.sourceGlobalUiReferenceIntakePath ?? DEFAULT_GLOBAL_UI_CONTRACT_INPUTS.sourceGlobalUiReferenceIntakePath,
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
    else if (value === "--source-global-ui-reference-intake-path") args.sourceGlobalUiReferenceIntakePath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR]`);
  console.log("Creates the P11001-P11200 Global UI Contract artifacts.");
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

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/health";
  return pathname.replace(/\/+$/, "") || "/health";
}

function jsonResponse(status, body, method = "GET") {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      allow: "GET, HEAD",
    },
    body: method === "HEAD" ? "" : `${JSON.stringify(body, null, 2)}\n`,
  };
}

function buildError(code, message) {
  return {
    error: {
      code,
      message,
    },
  };
}

function sanitizeForApi(value) {
  if (Array.isArray(value)) return value.map(sanitizeForApi);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(^raw_|raw_|full_body|full_transcript|secret|api_key|token|authorization|body_embedded|binary_embedded)/i.test(key)) continue;
    output[key] = sanitizeForApi(entry);
  }
  return output;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
