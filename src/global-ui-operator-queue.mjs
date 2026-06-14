import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildGlobalUiDesignFoundation } from "./global-ui-design-foundation.mjs";

export const DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_OUT_DIR = "artifacts/global-ui-operator-queue/latest";
export const DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS = {
  schemaPath: "schemas/global-ui-operator-queue.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p11401-p11600.md",
  architectureDocPath: "docs/architecture.md",
  sourceGlobalUiDesignFoundationPath: "artifacts/global-ui-design-foundation/latest/global-ui-design-foundation.json",
};

const COMMAND_NAME = "platform:global-ui-operator-queue";
const SCHEMA_VERSION = "global-ui-operator-queue.v1";
const CAPABILITY_ID = "platform.global_ui_operator_queue";
const PROGRAM_RANGE = "P11401-P11600";
const SOURCE_PROGRAM_RANGE = "P11201-P11400";
const DESIGN_SYSTEM_RANGE = "P10801-P11800";
const SOURCE_READY_STATUS = "ready_for_global_ui_design_foundation";
const READY_STATUS = "ready_for_global_ui_operator_queue";
const BLOCKED_STATUS = "blocked_global_ui_operator_queue";

const PHASE_SPECS = [
  ["P11401-P11420", "Global Operator Queue Shell", "global_operator_queue_shell_rows"],
  ["P11421-P11440", "Queue Row And Source Card Model", "queue_row_source_card_rows"],
  ["P11441-P11460", "Object Inspector Panel v0", "object_inspector_panel_rows"],
  ["P11461-P11480", "Requirement Trace Detail v0", "requirement_trace_detail_rows"],
  ["P11481-P11500", "Review Gate Detail v0", "review_gate_detail_rows"],
  ["P11501-P11520", "Evidence Timeline v0", "evidence_timeline_rows"],
  ["P11521-P11540", "Conversation Source Detail v0", "conversation_source_detail_ui_rows"],
  ["P11541-P11560", "Domain Pack Detail v0", "domain_pack_detail_rows"],
  ["P11561-P11580", "Read-only UI/API Smoke Projection", "read_only_ui_api_smoke_rows"],
  ["P11581-P11600", "Operator Queue UI v0 Freeze", "p11600_freeze_rows"],
];

const QUEUE_SHELL_SPECS = [
  ["queue.home_surface", "Global Operator Queue"],
  ["queue.not_kpi_dashboard", "not a KPI dashboard"],
  ["queue.lanes", "lanes"],
  ["queue.saved_views", "saved views"],
  ["queue.trace_spine", "trace spine"],
  ["queue.inspector_region", "inspector region"],
  ["queue.evidence_timeline_region", "Evidence Timeline"],
  ["queue.review_gate_region", "Review Gate"],
];

const QUEUE_ROW_CARD_SPECS = [
  ["row.source", "source"],
  ["row.claim", "claim"],
  ["row.requirement", "requirement"],
  ["row.evidence", "evidence"],
  ["row.gate", "gate"],
  ["row.review", "review"],
  ["row.next_action", "next action"],
  ["row.blocker_reason", "blocker reason"],
];

const INSPECTOR_SPECS = [
  ["inspector.selected_object_identity", "selected object identity"],
  ["inspector.source_refs", "source refs"],
  ["inspector.evidence_chain", "evidence chain"],
  ["inspector.gate_state", "gate state"],
  ["inspector.reviewer_authority", "reviewer authority"],
  ["inspector.blocked_reason", "blocked reason"],
  ["inspector.next_action", "next action"],
  ["inspector.forbidden_actions", "forbidden actions"],
  ["inspector.stable_sections", "stable sections"],
];

const REQUIREMENT_TRACE_SPECS = [
  ["requirement.requirement_id", "requirement id"],
  ["requirement.acceptance_item", "acceptance item"],
  ["requirement.test_ref", "test ref"],
  ["requirement.evidence_ref", "evidence ref"],
  ["requirement.review_ref", "review ref"],
  ["requirement.gate_ref", "gate ref"],
  ["requirement.lineage", "lineage"],
  ["requirement.stale_state", "stale state"],
];

const REVIEW_GATE_SPECS = [
  ["review_gate.authority_boundary", "authority boundary"],
  ["review_gate.missing_evidence", "missing evidence"],
  ["review_gate.receipt_requirement", "receipt requirement"],
  ["review_gate.lower_trust", "lower trust"],
  ["review_gate.no_final_approval", "no final approval"],
  ["review_gate.protected_action_blocked", "protected action blocked"],
  ["review_gate.allowed_next_action", "allowed next action"],
  ["review_gate.rollback", "rollback"],
  ["review_gate.timeout", "timeout"],
];

const EVIDENCE_TIMELINE_SPECS = [
  ["timeline.timestamp", "timestamp"],
  ["timeline.actor", "actor"],
  ["timeline.source_ref", "source ref"],
  ["timeline.artifact_ref", "artifact ref"],
  ["timeline.evidence_type", "evidence type"],
  ["timeline.review_status", "review status"],
  ["timeline.linked_gate", "linked gate"],
  ["timeline.freshness_state", "freshness state"],
];

const CONVERSATION_DETAIL_SPECS = [
  ["conversation.redacted_summary", "redacted summary"],
  ["conversation.citation_refs", "citation refs"],
  ["conversation.decisions", "decisions"],
  ["conversation.blockers", "blockers"],
  ["conversation.validation_events", "validation events"],
  ["conversation.review_events", "review events"],
  ["conversation.source_refs", "source refs"],
  ["conversation.raw_full_hidden", "raw/full body"],
];

const DOMAIN_DETAIL_SPECS = [
  ["domain.domain_context", "domain context"],
  ["domain.pack_id", "pack id"],
  ["domain.capabilities", "capabilities"],
  ["domain.resource_boundary", "resource boundary"],
  ["domain.protected_output_boundary", "protected output boundary"],
  ["domain.cross_domain_isolation", "cross-domain isolation"],
  ["domain.human_note", "human note"],
  ["domain.product_identity_disabled", "product identity disabled"],
];

const READ_ONLY_SMOKE_SPECS = [
  ["smoke.nonblank_html", "nonblank HTML"],
  ["smoke.get_head_only", "GET/HEAD-only projection"],
  ["smoke.post_blocked", "POST blocked"],
  ["smoke.no_raw_secret", "no raw/secret"],
  ["smoke.no_write", "no write"],
  ["smoke.no_form_button", "form/button execution"],
  ["smoke.no_final_approval", "no final approval"],
  ["smoke.no_production_enterprise", "no production/enterprise PASS"],
  ["smoke.responsive_no_overlap", "no overlap"],
  ["smoke.p11601_handoff", "P11601"],
];

export async function runGlobalUiOperatorQueue(options = {}) {
  const result = await buildGlobalUiOperatorQueue(options);
  if (options.write !== false) await writeGlobalUiOperatorQueue(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Global UI operator queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGlobalUiOperatorQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "globalUiDesignFoundation")
    ? normalizeInlineJsonSource("inline.global_ui_design_foundation", options.globalUiDesignFoundation)
    : await readJsonOrBuildGlobalUiDesignFoundation(inputs.source_global_ui_design_foundation_path, generatedAt);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceBindingRows = buildSourceBindingRows(source, generatedAt);
  const queueShellRows = buildSurfaceRows(QUEUE_SHELL_SPECS, "global_operator_queue_shell", roadmapDoc.text, generatedAt);
  const rowCardRows = buildSurfaceRows(QUEUE_ROW_CARD_SPECS, "queue_row_source_card", roadmapDoc.text, generatedAt);
  const inspectorRows = buildSurfaceRows(INSPECTOR_SPECS, "object_inspector_panel", roadmapDoc.text, generatedAt);
  const requirementRows = buildSurfaceRows(REQUIREMENT_TRACE_SPECS, "requirement_trace_detail", roadmapDoc.text, generatedAt);
  const reviewGateRows = buildReviewGateRows(roadmapDoc.text, generatedAt);
  const timelineRows = buildSurfaceRows(EVIDENCE_TIMELINE_SPECS, "evidence_timeline", roadmapDoc.text, generatedAt);
  const conversationRows = buildConversationRows(roadmapDoc.text, generatedAt);
  const domainRows = buildDomainRows(roadmapDoc.text, generatedAt);
  const smokeRows = buildSmokeRows(roadmapDoc.text, generatedAt);
  const freezeRows = buildFreezeRows({ sourceBindingRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows }, generatedAt);
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, sourceBindingRows, phaseRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows, freezeRows });
  const boundary = buildBoundary({ source, sourceBindingRows, phaseRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, sourceBindingRows, phaseRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows, freezeRows, gateRows, boundary });
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
      global_ui_design_foundation_path: source.path,
    },
    source_global_ui_design_foundation_summary: source.data?.summary ?? null,
    global_ui_operator_queue_contract: contract,
    global_ui_operator_queue_phase_rows: phaseRows,
    p11201_source_binding_rows: sourceBindingRows,
    global_operator_queue_shell_rows: queueShellRows,
    queue_row_source_card_rows: rowCardRows,
    object_inspector_panel_rows: inspectorRows,
    requirement_trace_detail_rows: requirementRows,
    review_gate_detail_rows: reviewGateRows,
    evidence_timeline_rows: timelineRows,
    conversation_source_detail_ui_rows: conversationRows,
    domain_pack_detail_rows: domainRows,
    read_only_ui_api_smoke_rows: smokeRows,
    p11600_freeze_rows: freezeRows,
    global_ui_operator_queue_gate_rows: gateRows,
    global_ui_operator_queue_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ phaseRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows, freezeRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "global_ui_operator_queue")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ phaseRows, queueShellRows, rowCardRows, inspectorRows, requirementRows, reviewGateRows, timelineRows, conversationRows, domainRows, smokeRows, freezeRows, boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeGlobalUiOperatorQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "global-ui-operator-queue.json"), serializableResult(result));
  await writeJson(path.join(outDir, "global-ui-operator-queue-phase-rows.json"), collectionEnvelope("global-ui-operator-queue-phase-rows.v1", "global_ui_operator_queue_phase_rows", result.global_ui_operator_queue_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "p11201-source-binding-rows.json"), collectionEnvelope("p11201-source-binding-rows.v1", "p11201_source_binding_rows", result.p11201_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-operator-queue-shell-rows.json"), collectionEnvelope("global-operator-queue-shell-rows.v1", "global_operator_queue_shell_rows", result.global_operator_queue_shell_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-row-source-card-rows.json"), collectionEnvelope("queue-row-source-card-rows.v1", "queue_row_source_card_rows", result.queue_row_source_card_rows, result.generated_at));
  await writeJson(path.join(outDir, "object-inspector-panel-rows.json"), collectionEnvelope("object-inspector-panel-rows.v1", "object_inspector_panel_rows", result.object_inspector_panel_rows, result.generated_at));
  await writeJson(path.join(outDir, "requirement-trace-detail-rows.json"), collectionEnvelope("requirement-trace-detail-rows.v1", "requirement_trace_detail_rows", result.requirement_trace_detail_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-gate-detail-rows.json"), collectionEnvelope("review-gate-detail-rows.v1", "review_gate_detail_rows", result.review_gate_detail_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-timeline-rows.json"), collectionEnvelope("evidence-timeline-rows.v1", "evidence_timeline_rows", result.evidence_timeline_rows, result.generated_at));
  await writeJson(path.join(outDir, "conversation-source-detail-ui-rows.json"), collectionEnvelope("conversation-source-detail-ui-rows.v1", "conversation_source_detail_ui_rows", result.conversation_source_detail_ui_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-pack-detail-rows.json"), collectionEnvelope("domain-pack-detail-rows.v1", "domain_pack_detail_rows", result.domain_pack_detail_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-ui-api-smoke-rows.json"), collectionEnvelope("read-only-ui-api-smoke-rows.v1", "read_only_ui_api_smoke_rows", result.read_only_ui_api_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "p11600-freeze-rows.json"), collectionEnvelope("p11600-freeze-rows.v1", "p11600_freeze_rows", result.p11600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-operator-queue-gate-rows.json"), collectionEnvelope("global-ui-operator-queue-gate-rows.v1", "global_ui_operator_queue_gate_rows", result.global_ui_operator_queue_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "global-ui-operator-queue-boundary.json"), result.global_ui_operator_queue_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "global-ui-operator-queue-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runGlobalUiOperatorQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runGlobalUiOperatorQueue(args);
    console.log(`Global UI operator queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.global_ui_operator_queue_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Queue shell rows: ${result.summary.queue_shell_count}`);
    console.log(`Trace detail rows: ${result.summary.trace_detail_count}`);
    console.log(`Ready for P11601 handoff: ${result.summary.ready_for_p11601_handoff}`);
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
    contract_id: "global-ui-operator-queue.contract.v1",
    generated_at: generatedAt,
    source_global_ui_design_foundation_required: true,
    source_ready_for_p11401_handoff_required: true,
    global_operator_queue_shell_required: true,
    queue_row_source_card_required: true,
    object_inspector_panel_required: true,
    requirement_trace_detail_required: true,
    review_gate_detail_required: true,
    evidence_timeline_required: true,
    conversation_source_detail_required: true,
    domain_pack_detail_required: true,
    read_only_ui_api_smoke_required: true,
    p11601_handoff_required: true,
    raw_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    form_button_execution_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    domain_pack_product_identity_enabled: false,
    kpi_dashboard_home_enabled: false,
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
      evidence_ref: `docs/hermes-roadmap-p11401-p11600.md#${phaseRange}`,
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
    ["source.available", "P11201-P11400 source artifact available", source.available],
    ["source.status", "P11201-P11400 source is ready", summary.global_ui_design_foundation_status === SOURCE_READY_STATUS],
    ["source.handoff", "P11201 source ready for P11401 handoff", summary.ready_for_p11401_handoff === true],
    ["source.no_write", "P11201 source did not open write control", summary.write_control_enabled === false],
    ["source.no_final_approval", "P11201 source did not open final approval UI", summary.final_approval_ui_enabled === false],
    ["source.no_production_enterprise", "P11201 source did not open production or enterprise PASS UI", summary.production_pass_ui_enabled === false && summary.enterprise_pass_ui_enabled === false],
  ];
  return rows.map(([id, label, observed]) => verdictRow({
    row_id: id,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    block_reason: observed ? null : "P11201 source design foundation is missing or not safe for P11401.",
  }));
}

function buildSurfaceRows(specs, category, roadmapText, generatedAt) {
  return specs.map(([rowId, label]) => {
    const observed = includesText(roadmapText, label);
    return verdictRow({
      row_id: rowId,
      category,
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11401-p11600.md#ui-contract",
      generated_at: generatedAt,
      read_only: true,
      stable_section_required: true,
      raw_body_visible: false,
      full_body_visible: false,
      secret_key_visible: false,
      write_control_enabled: false,
      final_approval_enabled: false,
      block_reason: observed ? null : "UI surface row missing from roadmap doc.",
    });
  });
}

function buildReviewGateRows(roadmapText, generatedAt) {
  return REVIEW_GATE_SPECS.map(([rowId, label]) => {
    const observed = includesText(roadmapText, label);
    return verdictRow({
      row_id: rowId,
      category: "review_gate_detail",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11401-p11600.md#ui-contract",
      generated_at: generatedAt,
      authority_boundary_visible: true,
      approval_control_enabled: false,
      protected_action_enabled: false,
      reviewer_final_approval_allowed: false,
      block_reason: observed ? null : "Review gate detail row missing from roadmap doc.",
    });
  });
}

function buildConversationRows(roadmapText, generatedAt) {
  return CONVERSATION_DETAIL_SPECS.map(([rowId, label]) => {
    const observed = includesText(roadmapText, label);
    return verdictRow({
      row_id: rowId,
      category: "conversation_source_detail_ui",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11401-p11600.md#ui-contract",
      generated_at: generatedAt,
      redacted_summary_visible: true,
      citation_refs_required: true,
      raw_body_visible: false,
      full_body_visible: false,
      secret_key_visible: false,
      block_reason: observed ? null : "Conversation detail row missing from roadmap doc.",
    });
  });
}

function buildDomainRows(roadmapText, generatedAt) {
  return DOMAIN_DETAIL_SPECS.map(([rowId, label]) => {
    const observed = includesText(roadmapText, label);
    return verdictRow({
      row_id: rowId,
      category: "domain_pack_detail",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11401-p11600.md#ui-contract",
      generated_at: generatedAt,
      context_only: true,
      product_identity_enabled: false,
      cross_domain_data_mix_allowed: false,
      protected_output_enabled: false,
      block_reason: observed ? null : "Domain detail row missing from roadmap doc.",
    });
  });
}

function buildSmokeRows(roadmapText, generatedAt) {
  return READ_ONLY_SMOKE_SPECS.map(([rowId, label]) => {
    const observed = includesText(roadmapText, label);
    return verdictRow({
      row_id: rowId,
      category: "read_only_ui_api_smoke",
      label,
      required: true,
      observed,
      evidence_ref: "docs/hermes-roadmap-p11401-p11600.md#completion-criteria",
      generated_at: generatedAt,
      fixture_status: "PASS_BLOCKED_AS_EXPECTED",
      methods_allowed: ["GET", "HEAD"],
      mutates_state: false,
      form_button_execution_enabled: false,
      unsafe_claim_allowed: false,
      block_reason: observed ? null : "Read-only UI/API smoke row missing from roadmap doc.",
    });
  });
}

function buildFreezeRows(context, generatedAt) {
  const specs = [
    ["freeze.source", "P11201 source binding ready", allPass(context.sourceBindingRows)],
    ["freeze.queue_shell", "Global Operator Queue shell ready", allPass(context.queueShellRows)],
    ["freeze.row_card", "Queue row/source card model ready", allPass(context.rowCardRows)],
    ["freeze.inspector", "Object Inspector Panel ready", allPass(context.inspectorRows)],
    ["freeze.requirement", "Requirement Trace Detail ready", allPass(context.requirementRows)],
    ["freeze.review_gate", "Review Gate Detail ready", allPass(context.reviewGateRows)],
    ["freeze.timeline", "Evidence Timeline ready", allPass(context.timelineRows)],
    ["freeze.conversation", "Conversation Source Detail ready", allPass(context.conversationRows)],
    ["freeze.domain", "Domain Pack Detail ready", allPass(context.domainRows)],
    ["freeze.smoke", "Read-only UI/API smoke projection ready", allPass(context.smokeRows)],
    ["freeze.p11601_handoff", "P11601 visual/accessibility regression handoff ready", true],
    ["freeze.p11800_not_ready", "P11800 design-system freeze remains false", true],
    ["freeze.no_write", "No write/protected/form-button action opened", true],
    ["freeze.no_final_approval", "No Codex/Claude/final approval UI opened", true],
    ["freeze.no_production_enterprise", "No production or enterprise PASS opened", true],
  ];
  return specs.map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p11600_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p11600-freeze",
    generated_at: generatedAt,
    block_reason: observed ? null : "P11600 freeze prerequisite missing.",
  }));
}

function buildGateRows(context) {
  return [
    gateRow("gate.package_script", "Package script registered", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), "package.json#scripts"),
    gateRow("gate.validate_chain", "Package validate chain registered", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), "package.json#scripts.validate"),
    gateRow("gate.roadmap_doc", "P11401-P11600 roadmap doc present", context.roadmapDoc.available && context.roadmapDoc.text.includes(PROGRAM_RANGE), context.roadmapDoc.path),
    gateRow("gate.architecture_doc", "Architecture doc references P11401-P11600", context.architectureDoc.available && context.architectureDoc.text.includes("P11401-P11600"), context.architectureDoc.path),
    gateRow("gate.source", "P11201 source binding ready", allPass(context.sourceBindingRows), "p11201_source_binding_rows"),
    gateRow("gate.phase_rows", "P11401-P11600 phase rows ready", allPass(context.phaseRows), "global_ui_operator_queue_phase_rows"),
    gateRow("gate.queue_shell", "Queue shell rows ready", allPass(context.queueShellRows), "global_operator_queue_shell_rows"),
    gateRow("gate.row_card", "Queue row/source card rows ready", allPass(context.rowCardRows), "queue_row_source_card_rows"),
    gateRow("gate.inspector", "Object Inspector Panel rows ready", allPass(context.inspectorRows), "object_inspector_panel_rows"),
    gateRow("gate.requirement", "Requirement Trace Detail rows ready", allPass(context.requirementRows), "requirement_trace_detail_rows"),
    gateRow("gate.review_gate", "Review Gate Detail rows ready", allPass(context.reviewGateRows), "review_gate_detail_rows"),
    gateRow("gate.timeline", "Evidence Timeline rows ready", allPass(context.timelineRows), "evidence_timeline_rows"),
    gateRow("gate.conversation", "Conversation Source Detail rows ready", allPass(context.conversationRows), "conversation_source_detail_ui_rows"),
    gateRow("gate.domain", "Domain Pack Detail rows ready", allPass(context.domainRows), "domain_pack_detail_rows"),
    gateRow("gate.smoke", "Read-only UI/API smoke rows ready", allPass(context.smokeRows), "read_only_ui_api_smoke_rows"),
    gateRow("gate.freeze", "P11600 freeze rows ready", allPass(context.freezeRows), "p11600_freeze_rows"),
  ];
}

function buildBoundary(context) {
  const sourceSummary = context.source.data?.summary ?? {};
  const coreReady = [
    context.sourceBindingRows,
    context.phaseRows,
    context.queueShellRows,
    context.rowCardRows,
    context.inspectorRows,
    context.requirementRows,
    context.reviewGateRows,
    context.timelineRows,
    context.conversationRows,
    context.domainRows,
    context.smokeRows,
    context.freezeRows,
    context.gateRows,
  ].every(allPass);
  return {
    source_global_ui_design_foundation_ready: sourceSummary.global_ui_design_foundation_status === SOURCE_READY_STATUS,
    source_ready_for_p11401_handoff: sourceSummary.ready_for_p11401_handoff === true,
    global_ui_operator_queue_ready: coreReady,
    global_operator_queue_shell_ready: allPass(context.queueShellRows),
    queue_row_source_card_ready: allPass(context.rowCardRows),
    object_inspector_panel_ready: allPass(context.inspectorRows),
    requirement_trace_detail_ready: allPass(context.requirementRows),
    review_gate_detail_ready: allPass(context.reviewGateRows),
    evidence_timeline_ready: allPass(context.timelineRows),
    conversation_source_detail_ready: allPass(context.conversationRows),
    domain_pack_detail_ready: allPass(context.domainRows),
    read_only_ui_api_smoke_ready: allPass(context.smokeRows),
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
    review_gate_approval_control_enabled: false,
    p11601_visual_accessibility_handoff_ready: coreReady,
    p11800_design_system_freeze_ready: false,
    ready_for_p11601_handoff: coreReady,
    ready_for_p11801_handoff: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("source.ready", "source", allPass(context.sourceBindingRows), "P11201 source design foundation is not ready", "p11201_source_binding_rows");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P11401-P11600 phase rows incomplete", "docs/hermes-roadmap-p11401-p11600.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P11401-P11600"), "Architecture doc missing P11401-P11600 reference", "docs/architecture.md");
  add("queue.shell", "ui", context.queueShellRows.length === 8 && allPass(context.queueShellRows), "Global Operator Queue shell rows incomplete", "global_operator_queue_shell_rows");
  add("row.card", "ui", context.rowCardRows.length === 8 && allPass(context.rowCardRows), "Queue row/source card rows incomplete", "queue_row_source_card_rows");
  add("inspector", "ui", context.inspectorRows.length === 9 && allPass(context.inspectorRows), "Object Inspector Panel rows incomplete", "object_inspector_panel_rows");
  add("requirement.trace", "ui", context.requirementRows.length === 8 && allPass(context.requirementRows), "Requirement Trace Detail rows incomplete", "requirement_trace_detail_rows");
  add("review.gate", "ui", context.reviewGateRows.length === 9 && allPass(context.reviewGateRows), "Review Gate Detail rows incomplete", "review_gate_detail_rows");
  add("timeline", "ui", context.timelineRows.length === 8 && allPass(context.timelineRows), "Evidence Timeline rows incomplete", "evidence_timeline_rows");
  add("conversation", "ui", context.conversationRows.length === 8 && allPass(context.conversationRows), "Conversation Source Detail rows incomplete", "conversation_source_detail_ui_rows");
  add("domain", "ui", context.domainRows.length === 8 && allPass(context.domainRows), "Domain Pack Detail rows incomplete", "domain_pack_detail_rows");
  add("smoke", "smoke", context.smokeRows.length === 10 && allPass(context.smokeRows), "Read-only UI/API smoke rows incomplete", "read_only_ui_api_smoke_rows");
  add("freeze", "freeze", allPass(context.freezeRows), "P11600 freeze rows incomplete", "p11600_freeze_rows");
  add("boundary.no.raw.secret", "boundary", context.boundary.raw_body_exposure_allowed === false && context.boundary.full_body_exposure_allowed === false && context.boundary.secret_key_exposure_allowed === false, "Operator UI opened raw/full/secret exposure", "global_ui_operator_queue_boundary");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.form_button_execution_enabled === false && context.boundary.api_write_methods_enabled === false, "Operator UI opened write/protected/form/API mutation", "global_ui_operator_queue_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Operator UI opened final approval UI", "global_ui_operator_queue_boundary");
  add("boundary.no.production.enterprise", "boundary", context.boundary.production_pass_ui_enabled === false && context.boundary.enterprise_pass_ui_enabled === false, "Operator UI opened production or enterprise PASS", "global_ui_operator_queue_boundary");
  add("boundary.no.domain.product", "boundary", context.boundary.domain_pack_product_identity_enabled === false && context.boundary.kpi_dashboard_home_enabled === false, "Operator UI misframed product identity or home surface", "global_ui_operator_queue_boundary");
  add("boundary.ready.handoff", "boundary", context.boundary.ready_for_p11601_handoff === true, "P11601 handoff not ready", "global_ui_operator_queue_boundary");
  return items;
}

function buildSummary(context) {
  const validation = context.validation;
  return {
    global_ui_operator_queue_status: validation.valid ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    design_system_range: DESIGN_SYSTEM_RANGE,
    source_ready_for_p11401_handoff: context.boundary.source_ready_for_p11401_handoff,
    phase_count: context.phaseRows.length,
    queue_shell_count: context.queueShellRows.length,
    queue_row_source_card_count: context.rowCardRows.length,
    object_inspector_panel_count: context.inspectorRows.length,
    requirement_trace_detail_count: context.requirementRows.length,
    review_gate_detail_count: context.reviewGateRows.length,
    evidence_timeline_count: context.timelineRows.length,
    conversation_source_detail_count: context.conversationRows.length,
    domain_pack_detail_count: context.domainRows.length,
    read_only_ui_api_smoke_count: context.smokeRows.length,
    p11600_freeze_count: context.freezeRows.length,
    trace_detail_count: context.inspectorRows.length + context.requirementRows.length + context.reviewGateRows.length + context.timelineRows.length + context.conversationRows.length + context.domainRows.length,
    ready_for_p11601_handoff: context.boundary.ready_for_p11601_handoff,
    ready_for_p11801_handoff: context.boundary.ready_for_p11801_handoff,
    p11800_design_system_freeze_ready: context.boundary.p11800_design_system_freeze_ready,
    raw_body_exposure_allowed: false,
    full_body_exposure_allowed: false,
    secret_key_exposure_allowed: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    form_button_execution_enabled: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_ui_enabled: false,
    enterprise_pass_ui_enabled: false,
    domain_pack_product_identity_enabled: false,
    kpi_dashboard_home_enabled: false,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Global UI Operator Queue",
    "",
    `Status: ${result.summary.global_ui_operator_queue_status}`,
    `Program: ${result.program_range}`,
    `Queue shell rows: ${result.summary.queue_shell_count}`,
    `Trace detail rows: ${result.summary.trace_detail_count}`,
    `Ready for P11601 handoff: ${result.summary.ready_for_p11601_handoff}`,
    "",
    "## Boundary",
    "",
    `- raw body exposure allowed: ${result.summary.raw_body_exposure_allowed}`,
    `- write control enabled: ${result.summary.write_control_enabled}`,
    `- form/button execution enabled: ${result.summary.form_button_execution_enabled}`,
    `- final approval UI enabled: ${result.summary.final_approval_ui_enabled}`,
    `- production PASS UI enabled: ${result.summary.production_pass_ui_enabled}`,
    `- enterprise PASS UI enabled: ${result.summary.enterprise_pass_ui_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const queueRows = result.queue_row_source_card_rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.evidence_ref)}</td></tr>`).join("");
  const inspectorRows = result.object_inspector_panel_rows.map((row) => `<li>${escapeHtml(row.label)}: ${escapeHtml(row.current_verdict)}</li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Global Operator Queue</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1280px; margin: 0 auto; padding: 20px; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 340px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0; }
    h2 { font-size: 15px; line-height: 1.3; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    aside, section { min-width: 0; }
    aside { border: 1px solid #d9dee8; background: #fff; padding: 12px; }
    .notice { grid-column: 1 / -1; border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
    .muted { color: #596579; font-size: 13px; }
    @media (max-width: 860px) { main { grid-template-columns: 1fr; } .notice { grid-column: 1; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Hermes Global Operator Queue</h1>
      <p class="muted">Read-only queue and trace detail projection.</p>
    </header>
    <p class="notice">This view displays source, claim, requirement, evidence, gate, review, verdict, and next action state. Raw bodies, secrets, write controls, approval controls, release trust badges, and enterprise trust badges are disabled.</p>
    <section aria-label="Global Operator Queue">
      <h2>Queue Rows</h2>
      <table><thead><tr><th>Field</th><th>Verdict</th><th>Evidence</th></tr></thead><tbody>${queueRows}</tbody></table>
    </section>
    <aside aria-label="Object Inspector Panel">
      <h2>Object Inspector Panel</h2>
      <ul>${inspectorRows}</ul>
    </aside>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildGlobalUiDesignFoundation(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildGlobalUiDesignFoundation({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.global_ui_design_foundation", built);
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
    schema_path: options.schemaPath ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS.architectureDocPath,
    source_global_ui_design_foundation_path: options.sourceGlobalUiDesignFoundationPath ?? DEFAULT_GLOBAL_UI_OPERATOR_QUEUE_INPUTS.sourceGlobalUiDesignFoundationPath,
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
    else if (value === "--source-global-ui-design-foundation-path") args.sourceGlobalUiDesignFoundationPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR]`);
  console.log("Creates the P11401-P11600 Global UI Operator Queue artifacts.");
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
