import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildObservabilityCostPlane } from "./observability-cost-plane.mjs";

export const DEFAULT_PRODUCT_OPS_AUTOMATION_OUT_DIR = "artifacts/product-ops-automation/latest";
export const DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS = {
  schemaPath: "schemas/product-ops-automation.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p13801-p14200.md",
  architectureDocPath: "docs/architecture.md",
  sourceObservabilityCostPath: "artifacts/observability-cost-plane/latest/observability-cost-plane.json",
};

const COMMAND_NAME = "platform:product-ops-automation";
const SCHEMA_VERSION = "product-ops-automation.v1";
const CAPABILITY_ID = "platform.product_ops_automation";
const PROGRAM_RANGE = "P13801-P14200";
const SOURCE_PROGRAM_RANGE = "P13401-P13800";
const READY_STATUS = "ready_for_product_ops_automation";
const BLOCKED_STATUS = "blocked_product_ops_automation";

const PHASE_SPECS = [
  ["P13801-P13840", "P13800 Source Binding", "product_ops_source_binding_rows"],
  ["P13841-P13880", "Roadmap Signal", "roadmap_signal_rows"],
  ["P13881-P13920", "Sprint Signal", "sprint_signal_rows"],
  ["P13921-P13960", "Issue Signal", "issue_signal_rows"],
  ["P13961-P14000", "Changelog Signal", "changelog_signal_rows"],
  ["P14001-P14040", "Support Feedback Signal", "support_feedback_signal_rows"],
  ["P14041-P14080", "Customer Request Signal", "customer_request_signal_rows"],
  ["P14081-P14120", "Harness State Link", "harness_state_link_rows"],
  ["P14121-P14160", "Product Ops Projection", "product_ops_projection_rows"],
  ["P14161-P14200", "Product Ops Freeze", "p14200_freeze_rows"],
];

const ROADMAP_TERMS = ["roadmap item id", "initiative id", "phase range", "owner engine", "evidence ref", "stale roadmap blocker"];
const SPRINT_TERMS = ["sprint id", "planned scope", "in-progress scope", "blocked scope", "validation due", "carryover blocker"];
const ISSUE_TERMS = ["issue id", "source system", "linked requirement", "linked evidence", "severity", "owner route"];
const CHANGELOG_TERMS = ["changelog entry id", "commit ref", "validation ref", "review ref", "publish state", "publish blocker"];
const SUPPORT_TERMS = ["feedback id", "source channel", "product area", "evidence ref", "escalation route", "raw contact guard"];
const CUSTOMER_TERMS = ["request id", "account ref", "requested outcome", "linked roadmap item", "confidence", "contact guard"];
const STATE_LINK_TERMS = ["claim ref", "evidence ref", "gate ref", "validation ref", "review ref", "blocker ref"];
const PROJECTION_TERMS = ["read-only product ops API row", "dashboard row", "backlog rollup", "blocker rollup", "customer signal rollup", "no external write"];
const AUTHORITY_TERMS = [
  "no roadmap write",
  "no sprint mutation",
  "no issue write",
  "no changelog publish",
  "no support reply",
  "no customer contact",
  "no external project write",
  "no production PASS",
  "no enterprise trust claim",
  "no final automated approval",
];

export async function runProductOpsAutomation(options = {}) {
  const result = await buildProductOpsAutomation(options);
  if (options.write !== false) await writeProductOpsAutomation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Product Ops Automation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProductOpsAutomation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PRODUCT_OPS_AUTOMATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "observabilityCostPlane")
    ? normalizeInlineJsonSource("inline.observability_cost_plane", options.observabilityCostPlane)
    : await readJsonOrBuildObservabilityCost(inputs.source_observability_cost_path, generatedAt);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const roadmapRows = buildTermRows("roadmap_signal", "Roadmap", ROADMAP_TERMS, roadmapDoc.text, "roadmap_signal_rows", generatedAt, roadmapExtras);
  const sprintRows = buildTermRows("sprint_signal", "Sprint", SPRINT_TERMS, roadmapDoc.text, "sprint_signal_rows", generatedAt, sprintExtras);
  const issueRows = buildTermRows("issue_signal", "Issue", ISSUE_TERMS, roadmapDoc.text, "issue_signal_rows", generatedAt, issueExtras);
  const changelogRows = buildTermRows("changelog_signal", "Changelog", CHANGELOG_TERMS, roadmapDoc.text, "changelog_signal_rows", generatedAt, changelogExtras);
  const supportRows = buildTermRows("support_feedback_signal", "Support feedback", SUPPORT_TERMS, roadmapDoc.text, "support_feedback_signal_rows", generatedAt, supportExtras);
  const customerRows = buildTermRows("customer_request_signal", "Customer request", CUSTOMER_TERMS, roadmapDoc.text, "customer_request_signal_rows", generatedAt, customerExtras);
  const stateLinkRows = buildTermRows("harness_state_link", "Harness state link", STATE_LINK_TERMS, roadmapDoc.text, "harness_state_link_rows", generatedAt, stateLinkExtras);
  const projectionRows = buildTermRows("product_ops_projection", "Product ops projection", PROJECTION_TERMS, roadmapDoc.text, "product_ops_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("product_ops_authority_guard", "Product ops authority guard", AUTHORITY_TERMS, roadmapDoc.text, "product_ops_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, roadmapRows, sprintRows, issueRows, changelogRows, supportRows, customerRows, stateLinkRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, roadmapRows, sprintRows, issueRows, changelogRows, supportRows, customerRows, stateLinkRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, roadmapRows, sprintRows, issueRows, changelogRows, supportRows, customerRows, stateLinkRows, projectionRows, authorityRows, freezeRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      observability_cost_plane_path: source.path,
    },
    source_observability_cost_summary: source.data?.summary ?? null,
    product_ops_contract: buildContract(generatedAt),
    product_ops_phase_rows: phaseRows,
    product_ops_source_binding_rows: sourceRows,
    roadmap_signal_rows: roadmapRows,
    sprint_signal_rows: sprintRows,
    issue_signal_rows: issueRows,
    changelog_signal_rows: changelogRows,
    support_feedback_signal_rows: supportRows,
    customer_request_signal_rows: customerRows,
    harness_state_link_rows: stateLinkRows,
    product_ops_projection_rows: projectionRows,
    product_ops_authority_guard_rows: authorityRows,
    p14200_freeze_rows: freezeRows,
    product_ops_boundary: boundary,
    product_ops_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, roadmapRows, sprintRows, issueRows, changelogRows, supportRows, customerRows, stateLinkRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "product_ops_automation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.product_ops_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.product_ops_validation_items);
  result.summary = buildSummary({ boundary, roadmapRows, sprintRows, issueRows, changelogRows, supportRows, customerRows, stateLinkRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeProductOpsAutomation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "product-ops-automation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "product-ops-phase-rows.json"), collectionEnvelope("product-ops-phase-rows.v1", "product_ops_phase_rows", result.product_ops_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-ops-source-binding-rows.json"), collectionEnvelope("product-ops-source-binding-rows.v1", "product_ops_source_binding_rows", result.product_ops_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-signal-rows.json"), collectionEnvelope("roadmap-signal-rows.v1", "roadmap_signal_rows", result.roadmap_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "sprint-signal-rows.json"), collectionEnvelope("sprint-signal-rows.v1", "sprint_signal_rows", result.sprint_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "issue-signal-rows.json"), collectionEnvelope("issue-signal-rows.v1", "issue_signal_rows", result.issue_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "changelog-signal-rows.json"), collectionEnvelope("changelog-signal-rows.v1", "changelog_signal_rows", result.changelog_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "support-feedback-signal-rows.json"), collectionEnvelope("support-feedback-signal-rows.v1", "support_feedback_signal_rows", result.support_feedback_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "customer-request-signal-rows.json"), collectionEnvelope("customer-request-signal-rows.v1", "customer_request_signal_rows", result.customer_request_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "harness-state-link-rows.json"), collectionEnvelope("harness-state-link-rows.v1", "harness_state_link_rows", result.harness_state_link_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-ops-projection-rows.json"), collectionEnvelope("product-ops-projection-rows.v1", "product_ops_projection_rows", result.product_ops_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-ops-authority-guard-rows.json"), collectionEnvelope("product-ops-authority-guard-rows.v1", "product_ops_authority_guard_rows", result.product_ops_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p14200-freeze-rows.json"), collectionEnvelope("p14200-freeze-rows.v1", "p14200_freeze_rows", result.p14200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "product-ops-boundary.json"), result.product_ops_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "product-ops-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.product_ops_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runProductOpsAutomationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runProductOpsAutomation(args);
    console.log(`Product Ops Automation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.product_ops_automation_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P13801: ${result.summary.source_ready_for_p13801_handoff}`);
    console.log(`Ready for P14201 handoff: ${result.summary.ready_for_p14201_handoff}`);
    console.log(`Roadmap write allowed: ${result.summary.roadmap_write_allowed_now}`);
    console.log(`Issue write allowed: ${result.summary.issue_write_allowed_now}`);
    console.log(`External project write allowed: ${result.summary.external_project_write_allowed_now}`);
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
    contract_id: "product-ops-automation.contract.v1",
    generated_at: generatedAt,
    source_observability_cost_required: true,
    roadmap_signal_required: true,
    sprint_signal_required: true,
    issue_signal_required: true,
    changelog_signal_required: true,
    support_feedback_signal_required: true,
    customer_request_signal_required: true,
    harness_state_link_required: true,
    read_only_projection_required: true,
    roadmap_write_allowed_now: false,
    issue_write_allowed_now: false,
    external_project_write_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p13801-p14200.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.observability_cost_boundary ?? {};
  const sourceStatus = summary.observability_cost_plane_status ?? "missing";
  const sourceReady = summary.ready_for_p13801_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P13401-P13800 source artifact available", source.available],
    ["source.range", "P13401-P13800 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P13800 source status visible", sourceStatus === "ready_for_observability_cost_plane" || sourceStatus === "blocked_observability_cost_plane"],
    ["source.handoff", "P13800 ready_for_p13801_handoff", sourceReady],
    ["source.block_visible", "P13800 blocker visible", sourceReady || sourceBlocked],
    ["source.observability_contract", "P13800 observability and cost signal rows available", Number(summary.test_duration_signal_row_count ?? 0) >= 6 && Number(summary.token_cost_signal_row_count ?? 0) >= 6 && Number(summary.validation_drift_signal_row_count ?? 0) >= 6],
    ["source.no_metric_write", "P13800 source did not open metric collector budget provider or raw exposure", boundary.metric_write_allowed_now === false && boundary.telemetry_collector_start_allowed_now === false && boundary.budget_mutation_allowed_now === false && boundary.external_provider_call_allowed_now === false && boundary.raw_source_exposure_allowed === false],
    ["source.no_trust_write_final", "P13800 source did not open trust production deployment write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.deployment_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "source_binding",
    label,
    required: true,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
    source_status: sourceStatus,
  }));
}

function buildTermRows(category, labelPrefix, terms, roadmapText, outputRef, generatedAt, extraBuilder) {
  return terms.map((term) => verdictRow({
    row_id: `${category}.${slug(term)}`,
    category,
    label: `${labelPrefix}: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: "docs/hermes-roadmap-p13801-p14200.md#product-ops-automation-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  return [
    ["freeze.source", "P13800 source ready for P13801", sourceReady],
    ["freeze.source_block_visible", "P13800 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.roadmap", "roadmap signal ready", allPass(context.roadmapRows)],
    ["freeze.sprint", "sprint signal ready", allPass(context.sprintRows)],
    ["freeze.issue", "issue signal ready", allPass(context.issueRows)],
    ["freeze.changelog", "changelog signal ready", allPass(context.changelogRows)],
    ["freeze.support", "support feedback signal ready", allPass(context.supportRows)],
    ["freeze.customer", "customer request signal ready", allPass(context.customerRows)],
    ["freeze.state_link", "harness state link ready", allPass(context.stateLinkRows)],
    ["freeze.projection", "read-only product ops projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "product ops authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_external_write_or_unsafe_action", "no roadmap sprint issue changelog support customer external project production trust deployment write or final approval opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p14200_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p14200-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const roadmapReady = allPass(context.roadmapRows);
  const sprintReady = allPass(context.sprintRows);
  const issueReady = allPass(context.issueRows);
  const changelogReady = allPass(context.changelogRows);
  const supportReady = allPass(context.supportRows);
  const customerReady = allPass(context.customerRows);
  const stateLinkReady = allPass(context.stateLinkRows);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = roadmapReady && sprintReady && issueReady && changelogReady && supportReady && customerReady && stateLinkReady && projectionReady && authorityReady;
  const freezeReady = sourceReady && contractReady && allPass(context.freezeRows);
  return {
    source_observability_cost_available: sourceAvailable,
    source_ready_for_p13801_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    roadmap_signal_ready: roadmapReady,
    sprint_signal_ready: sprintReady,
    issue_signal_ready: issueReady,
    changelog_signal_ready: changelogReady,
    support_feedback_signal_ready: supportReady,
    customer_request_signal_ready: customerReady,
    harness_state_link_ready: stateLinkReady,
    product_ops_projection_ready: projectionReady,
    product_ops_authority_guard_ready: authorityReady,
    p14200_product_ops_freeze_ready: freezeReady,
    ready_for_p14201_handoff: freezeReady,
    roadmap_write_allowed_now: false,
    sprint_mutation_allowed_now: false,
    issue_write_allowed_now: false,
    changelog_publish_allowed_now: false,
    support_reply_allowed_now: false,
    customer_contact_allowed_now: false,
    external_project_write_allowed_now: false,
    raw_contact_exposure_allowed: false,
    raw_source_exposure_allowed: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P13801-P14200 phase rows incomplete", "docs/hermes-roadmap-p13801-p14200.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P13801-P14200"), "Architecture doc missing P13801-P14200 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P13800 source state must be available and blocker-visible", "product_ops_source_binding_rows");
  add("roadmap.ready", "product_ops", context.roadmapRows.length === ROADMAP_TERMS.length && allPass(context.roadmapRows), "Roadmap signal rows incomplete", "roadmap_signal_rows");
  add("sprint.ready", "product_ops", context.sprintRows.length === SPRINT_TERMS.length && allPass(context.sprintRows), "Sprint signal rows incomplete", "sprint_signal_rows");
  add("issue.ready", "product_ops", context.issueRows.length === ISSUE_TERMS.length && allPass(context.issueRows), "Issue signal rows incomplete", "issue_signal_rows");
  add("changelog.ready", "product_ops", context.changelogRows.length === CHANGELOG_TERMS.length && allPass(context.changelogRows), "Changelog signal rows incomplete", "changelog_signal_rows");
  add("support.ready", "product_ops", context.supportRows.length === SUPPORT_TERMS.length && allPass(context.supportRows), "Support feedback signal rows incomplete", "support_feedback_signal_rows");
  add("customer.ready", "product_ops", context.customerRows.length === CUSTOMER_TERMS.length && allPass(context.customerRows), "Customer request signal rows incomplete", "customer_request_signal_rows");
  add("state_link.ready", "product_ops", context.stateLinkRows.length === STATE_LINK_TERMS.length && allPass(context.stateLinkRows), "Harness state link rows incomplete", "harness_state_link_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Product ops projection rows incomplete", "product_ops_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "product_ops_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P14200 freeze rows missing", "p14200_freeze_rows");
  add("boundary.no.product.write", "boundary", context.boundary.roadmap_write_allowed_now === false && context.boundary.sprint_mutation_allowed_now === false && context.boundary.issue_write_allowed_now === false && context.boundary.changelog_publish_allowed_now === false && context.boundary.support_reply_allowed_now === false && context.boundary.customer_contact_allowed_now === false && context.boundary.external_project_write_allowed_now === false, "Product ops opened product/project/customer write", "product_ops_boundary");
  add("boundary.no.raw.trust.release", "boundary", context.boundary.raw_contact_exposure_allowed === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Product ops opened raw exposure trust production release or deployment", "product_ops_boundary");
  add("boundary.no.write.final", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Product ops opened write runtime connector or final approval", "product_ops_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p14201_handoff === context.boundary.p14200_product_ops_freeze_ready, "P14201 handoff state must match P14200 freeze state", "product_ops_boundary");
  return items;
}

function buildSummary(context) {
  return {
    product_ops_automation_status: context.boundary.ready_for_p14201_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p13801_handoff: context.boundary.source_ready_for_p13801_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    roadmap_signal_row_count: context.roadmapRows.length,
    sprint_signal_row_count: context.sprintRows.length,
    issue_signal_row_count: context.issueRows.length,
    changelog_signal_row_count: context.changelogRows.length,
    support_feedback_signal_row_count: context.supportRows.length,
    customer_request_signal_row_count: context.customerRows.length,
    harness_state_link_row_count: context.stateLinkRows.length,
    product_ops_projection_row_count: context.projectionRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p14200_product_ops_freeze_ready: context.boundary.p14200_product_ops_freeze_ready,
    ready_for_p14201_handoff: context.boundary.ready_for_p14201_handoff,
    roadmap_write_allowed_now: false,
    sprint_mutation_allowed_now: false,
    issue_write_allowed_now: false,
    changelog_publish_allowed_now: false,
    support_reply_allowed_now: false,
    customer_contact_allowed_now: false,
    external_project_write_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Product Ops Automation",
    "",
    `Status: ${result.summary.product_ops_automation_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P13801: ${result.summary.source_ready_for_p13801_handoff}`,
    `Roadmap rows: ${result.summary.roadmap_signal_row_count}`,
    `Sprint rows: ${result.summary.sprint_signal_row_count}`,
    `Issue rows: ${result.summary.issue_signal_row_count}`,
    `Changelog rows: ${result.summary.changelog_signal_row_count}`,
    `Support feedback rows: ${result.summary.support_feedback_signal_row_count}`,
    `Customer request rows: ${result.summary.customer_request_signal_row_count}`,
    `Ready for P14201 handoff: ${result.summary.ready_for_p14201_handoff}`,
    `External project write allowed: ${result.summary.external_project_write_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.product_ops_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.external_project_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Product Ops Automation</title>
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
    <h1>Hermes Product Ops Automation</h1>
    <p class="notice">This plane links roadmap, sprint, issue, changelog, support, and customer request signals to Harness evidence as read-only state. External project writes, customer contact, publishing, production approval, deployment, and protected finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>External Project Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildObservabilityCost(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildObservabilityCostPlane({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.observability_cost_plane", built);
}

function roadmapExtras() {
  return { roadmap_signal_required: true, roadmap_write_allowed_now: false, stale_roadmap_blocker_required: true };
}

function sprintExtras() {
  return { sprint_signal_required: true, sprint_mutation_allowed_now: false, carryover_blocker_required: true };
}

function issueExtras() {
  return { issue_signal_required: true, issue_write_allowed_now: false, owner_route_required: true };
}

function changelogExtras() {
  return { changelog_signal_required: true, changelog_publish_allowed_now: false, publish_blocker_required: true };
}

function supportExtras() {
  return { support_feedback_signal_required: true, support_reply_allowed_now: false, raw_contact_exposure_allowed: false };
}

function customerExtras() {
  return { customer_request_signal_required: true, customer_contact_allowed_now: false, raw_contact_exposure_allowed: false };
}

function stateLinkExtras() {
  return { harness_state_link_required: true, evidence_binding_required: true, uncited_state_allowed: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, dashboard_projection_required: true, external_project_write_allowed_now: false };
}

function authorityExtras() {
  return {
    roadmap_write_allowed_now: false,
    sprint_mutation_allowed_now: false,
    issue_write_allowed_now: false,
    changelog_publish_allowed_now: false,
    support_reply_allowed_now: false,
    customer_contact_allowed_now: false,
    external_project_write_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    final_automated_approval_allowed: false,
  };
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
    schema_path: options.schemaPath ?? DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS.architectureDocPath,
    source_observability_cost_path: options.sourceObservabilityCostPath ?? DEFAULT_PRODUCT_OPS_AUTOMATION_INPUTS.sourceObservabilityCostPath,
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
    else if (value === "--source-observability-cost-path") args.sourceObservabilityCostPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P13801-P14200 Product Ops Automation artifacts.");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => row.current_verdict === "pass");
}

function rowPass(rows, rowId) {
  return rows.find((row) => row.row_id === rowId)?.current_verdict === "pass";
}

function includesAll(text = "", terms = []) {
  return terms.every((term) => text.includes(term));
}

function includesText(text = "", term = "") {
  return text.toLowerCase().includes(term.toLowerCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
