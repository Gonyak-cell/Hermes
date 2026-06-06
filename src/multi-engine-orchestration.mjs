import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildSecurityComplianceMaturity } from "./security-compliance-maturity.mjs";

export const DEFAULT_MULTI_ENGINE_ORCHESTRATION_OUT_DIR = "artifacts/multi-engine-orchestration/latest";
export const DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS = {
  schemaPath: "schemas/multi-engine-orchestration.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p14601-p15000.md",
  architectureDocPath: "docs/architecture.md",
  sourceSecurityCompliancePath: "artifacts/security-compliance-maturity/latest/security-compliance-maturity.json",
  claudeOrchestrationReviewReceiptPath: "artifacts/multi-engine-orchestration/review/claude-multi-engine-orchestration-review-receipt.json",
};

const COMMAND_NAME = "platform:multi-engine-orchestration";
const SCHEMA_VERSION = "multi-engine-orchestration.v1";
const CAPABILITY_ID = "platform.multi_engine_orchestration";
const PROGRAM_RANGE = "P14601-P15000";
const SOURCE_PROGRAM_RANGE = "P14201-P14600";
const READY_STATUS = "ready_for_multi_engine_orchestration";
const BLOCKED_STATUS = "blocked_multi_engine_orchestration";

const PHASE_SPECS = [
  ["P14601-P14640", "P14600 Source Binding", "multi_engine_source_binding_rows"],
  ["P14641-P14680", "Engine Registry", "engine_registry_rows"],
  ["P14681-P14720", "Role Authority Matrix", "role_authority_matrix_rows"],
  ["P14721-P14760", "Routing Decision Contract", "routing_decision_contract_rows"],
  ["P14761-P14800", "Evidence Class Mapping", "evidence_class_mapping_rows"],
  ["P14801-P14840", "Cross-Engine Conflict Guard", "cross_engine_conflict_guard_rows"],
  ["P14841-P14880", "Claude Orchestration Review Gate", "claude_orchestration_review_rows"],
  ["P14881-P14920", "Multi-Engine Projection", "multi_engine_projection_rows"],
  ["P14921-P14960", "Orchestration Authority Guard", "orchestration_authority_guard_rows"],
  ["P14961-P15000", "Multi-Engine Freeze", "p15000_freeze_rows"],
];

const ENGINE_TERMS = ["engine id", "engine class", "allowed role", "evidence class", "authority tier", "fallback blocker"];
const ROLE_TERMS = ["developer lane", "reviewer lane", "validator lane", "advisory lane", "final adjudication boundary", "conflict guard"];
const ROUTING_TERMS = ["routing id", "input classification", "permitted engine", "prohibited authority", "evidence ref", "fallback route"];
const EVIDENCE_TERMS = ["transcript ref", "review receipt ref", "validation log ref", "attestation ref", "advisory note ref", "raw exposure guard"];
const CONFLICT_TERMS = ["self review blocker", "engine collusion blocker", "stale model policy", "role confusion blocker", "policy priority", "reviewer independence"];
const PROJECTION_TERMS = ["read-only engine registry API row", "dashboard row", "route preview row", "authority matrix rollup", "blocker rollup", "no engine execution"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max multi-engine orchestration review receipt schema"],
  ["model_effort", "model effort"],
  ["orchestration_scope", "orchestration scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const AUTHORITY_TERMS = [
  "no cross-engine final approval",
  "no self-review approval",
  "no reviewer mutation",
  "no CI authority escalation",
  "no local advisory final approval",
  "no protected action routing",
  "no deployment",
  "no production PASS",
  "no enterprise trust claim",
  "no final automated approval",
];

export async function runMultiEngineOrchestration(options = {}) {
  const result = await buildMultiEngineOrchestration(options);
  if (options.write !== false) await writeMultiEngineOrchestration(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Multi-Engine Orchestration failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMultiEngineOrchestration(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "securityComplianceMaturity")
    ? normalizeInlineJsonSource("inline.security_compliance_maturity", options.securityComplianceMaturity)
    : await readJsonOrBuildSecurityCompliance(inputs.source_security_compliance_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeOrchestrationReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_orchestration_review_receipt", options.claudeOrchestrationReviewReceipt)
    : await readJsonSource(inputs.claude_orchestration_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const engineRows = buildTermRows("engine_registry", "Engine registry", ENGINE_TERMS, roadmapDoc.text, "engine_registry_rows", generatedAt, engineExtras);
  const roleRows = buildTermRows("role_authority_matrix", "Role authority", ROLE_TERMS, roadmapDoc.text, "role_authority_matrix_rows", generatedAt, roleExtras);
  const routingRows = buildTermRows("routing_decision_contract", "Routing decision", ROUTING_TERMS, roadmapDoc.text, "routing_decision_contract_rows", generatedAt, routingExtras);
  const evidenceRows = buildTermRows("evidence_class_mapping", "Evidence class", EVIDENCE_TERMS, roadmapDoc.text, "evidence_class_mapping_rows", generatedAt, evidenceExtras);
  const conflictRows = buildTermRows("cross_engine_conflict_guard", "Cross-engine conflict", CONFLICT_TERMS, roadmapDoc.text, "cross_engine_conflict_guard_rows", generatedAt, conflictExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const projectionRows = buildTermRows("multi_engine_projection", "Multi-engine projection", PROJECTION_TERMS, roadmapDoc.text, "multi_engine_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("orchestration_authority_guard", "Orchestration authority guard", AUTHORITY_TERMS, roadmapDoc.text, "orchestration_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, engineRows, roleRows, routingRows, evidenceRows, conflictRows, claudeRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, engineRows, roleRows, routingRows, evidenceRows, conflictRows, claudeRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, engineRows, roleRows, routingRows, evidenceRows, conflictRows, claudeRows, projectionRows, authorityRows, freezeRows, boundary });
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
      security_compliance_maturity_path: source.path,
      claude_orchestration_review_receipt_path: claudeReview.path,
    },
    source_security_compliance_summary: source.data?.summary ?? null,
    observed_claude_orchestration_review_summary: claudeReview.data?.summary ?? null,
    multi_engine_contract: buildContract(generatedAt),
    multi_engine_phase_rows: phaseRows,
    multi_engine_source_binding_rows: sourceRows,
    engine_registry_rows: engineRows,
    role_authority_matrix_rows: roleRows,
    routing_decision_contract_rows: routingRows,
    evidence_class_mapping_rows: evidenceRows,
    cross_engine_conflict_guard_rows: conflictRows,
    claude_orchestration_review_rows: claudeRows,
    multi_engine_projection_rows: projectionRows,
    orchestration_authority_guard_rows: authorityRows,
    p15000_freeze_rows: freezeRows,
    multi_engine_boundary: boundary,
    multi_engine_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, engineRows, roleRows, routingRows, evidenceRows, conflictRows, claudeRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "multi_engine_orchestration")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.multi_engine_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.multi_engine_validation_items);
  result.summary = buildSummary({ boundary, engineRows, roleRows, routingRows, evidenceRows, conflictRows, claudeRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeMultiEngineOrchestration(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "multi-engine-orchestration.json"), serializableResult(result));
  await writeJson(path.join(outDir, "multi-engine-phase-rows.json"), collectionEnvelope("multi-engine-phase-rows.v1", "multi_engine_phase_rows", result.multi_engine_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-source-binding-rows.json"), collectionEnvelope("multi-engine-source-binding-rows.v1", "multi_engine_source_binding_rows", result.multi_engine_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "engine-registry-rows.json"), collectionEnvelope("engine-registry-rows.v1", "engine_registry_rows", result.engine_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "role-authority-matrix-rows.json"), collectionEnvelope("role-authority-matrix-rows.v1", "role_authority_matrix_rows", result.role_authority_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "routing-decision-contract-rows.json"), collectionEnvelope("routing-decision-contract-rows.v1", "routing_decision_contract_rows", result.routing_decision_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-class-mapping-rows.json"), collectionEnvelope("evidence-class-mapping-rows.v1", "evidence_class_mapping_rows", result.evidence_class_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-engine-conflict-guard-rows.json"), collectionEnvelope("cross-engine-conflict-guard-rows.v1", "cross_engine_conflict_guard_rows", result.cross_engine_conflict_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-orchestration-review-rows.json"), collectionEnvelope("claude-orchestration-review-rows.v1", "claude_orchestration_review_rows", result.claude_orchestration_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-projection-rows.json"), collectionEnvelope("multi-engine-projection-rows.v1", "multi_engine_projection_rows", result.multi_engine_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "orchestration-authority-guard-rows.json"), collectionEnvelope("orchestration-authority-guard-rows.v1", "orchestration_authority_guard_rows", result.orchestration_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p15000-freeze-rows.json"), collectionEnvelope("p15000-freeze-rows.v1", "p15000_freeze_rows", result.p15000_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "multi-engine-boundary.json"), result.multi_engine_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "multi-engine-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.multi_engine_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runMultiEngineOrchestrationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runMultiEngineOrchestration(args);
    console.log(`Multi-Engine Orchestration ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.multi_engine_orchestration_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P14601: ${result.summary.source_ready_for_p14601_handoff}`);
    console.log(`Claude orchestration review receipt: ${result.summary.claude_orchestration_review_receipt_present_now}`);
    console.log(`Ready for P15001 handoff: ${result.summary.ready_for_p15001_handoff}`);
    console.log(`Cross-engine final approval allowed: ${result.summary.cross_engine_final_approval_allowed_now}`);
    console.log(`Engine execution allowed: ${result.summary.engine_execution_allowed_now}`);
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
    contract_id: "multi-engine-orchestration.contract.v1",
    generated_at: generatedAt,
    source_security_compliance_required: true,
    claude_orchestration_review_required: true,
    engine_registry_required: true,
    role_authority_matrix_required: true,
    routing_decision_contract_required: true,
    evidence_class_mapping_required: true,
    cross_engine_conflict_guard_required: true,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    engine_execution_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p14601-p15000.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.security_compliance_boundary ?? {};
  const sourceStatus = summary.security_compliance_maturity_status ?? "missing";
  const sourceReady = summary.ready_for_p14601_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P14201-P14600 source artifact available", source.available],
    ["source.range", "P14201-P14600 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P14600 source status visible", sourceStatus === "ready_for_security_compliance_maturity" || sourceStatus === "blocked_security_compliance_maturity"],
    ["source.handoff", "P14600 ready_for_p14601_handoff", sourceReady],
    ["source.block_visible", "P14600 blocker visible", sourceReady || sourceBlocked],
    ["source.security_contract", "P14600 security compliance rows available", Number(summary.soc2_control_signal_row_count ?? 0) >= 6 && Number(summary.secret_scanning_signal_row_count ?? 0) >= 6 && Number(summary.compliance_evidence_link_row_count ?? 0) >= 6],
    ["source.no_security_action", "P14600 source did not open secret read compliance PASS connector write or destructive action", boundary.secret_read_allowed_now === false && boundary.raw_secret_exposure_allowed === false && boundary.destructive_delete_allowed_now === false && boundary.compliance_pass_enabled === false && boundary.connector_write_enabled === false],
    ["source.no_trust_write_final", "P14600 source did not open trust production deployment write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.deployment_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
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
    evidence_ref: "docs/hermes-roadmap-p14601-p15000.md#multi-engine-orchestration-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = claudeReview.available === true
    && claudeReview.data?.review_engine === "claude_code_opus_max"
    && claudeReview.data?.receipt_status === "complete"
    && claudeReview.data?.scope_multi_engine_orchestration === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_orchestration_review.${reviewId}`,
    category: "claude_orchestration_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p14601-p15000.md#P14841-P14880",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_orchestration_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_orchestration_review_receipt_present_now === true);
  return [
    ["freeze.source", "P14600 source ready for P14601", sourceReady],
    ["freeze.source_block_visible", "P14600 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.engine_registry", "engine registry ready", allPass(context.engineRows)],
    ["freeze.role_authority", "role authority matrix ready", allPass(context.roleRows)],
    ["freeze.routing", "routing decision contract ready", allPass(context.routingRows)],
    ["freeze.evidence_class", "evidence class mapping ready", allPass(context.evidenceRows)],
    ["freeze.conflict_guard", "cross-engine conflict guard ready", allPass(context.conflictRows)],
    ["freeze.claude_orchestration_review", "Claude orchestration review receipt ready", claudeReady],
    ["freeze.projection", "multi-engine projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "orchestration authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_engine_final_approval", "no cross-engine final approval self-review approval reviewer mutation CI escalation advisory final approval protected routing or engine execution opened", true],
    ["freeze.no_release_trust_write", "no production PASS enterprise trust deployment connector write runtime or final approval opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p15000_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p15000-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const engineReady = allPass(context.engineRows);
  const roleReady = allPass(context.roleRows);
  const routingReady = allPass(context.routingRows);
  const evidenceReady = allPass(context.evidenceRows);
  const conflictReady = allPass(context.conflictRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_orchestration_review_receipt_present_now === true);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = engineReady && roleReady && routingReady && evidenceReady && conflictReady && allPass(context.claudeRows) && projectionReady && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_security_compliance_available: sourceAvailable,
    source_ready_for_p14601_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    engine_registry_ready: engineReady,
    role_authority_matrix_ready: roleReady,
    routing_decision_contract_ready: routingReady,
    evidence_class_mapping_ready: evidenceReady,
    cross_engine_conflict_guard_ready: conflictReady,
    claude_orchestration_review_receipt_present_now: claudeObserved,
    claude_orchestration_review_block_visible_now: claudeObserved === false,
    multi_engine_projection_ready: projectionReady,
    orchestration_authority_guard_ready: authorityReady,
    p15000_multi_engine_freeze_ready: freezeReady,
    ready_for_p15001_handoff: freezeReady,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    reviewer_mutation_allowed_now: false,
    ci_authority_escalation_allowed_now: false,
    local_advisory_final_approval_allowed_now: false,
    protected_action_routing_allowed_now: false,
    engine_execution_allowed_now: false,
    raw_transcript_exposure_allowed: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P14601-P15000 phase rows incomplete", "docs/hermes-roadmap-p14601-p15000.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P14601-P15000"), "Architecture doc missing P14601-P15000 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P14600 source state must be available and blocker-visible", "multi_engine_source_binding_rows");
  add("engine.ready", "engine", context.engineRows.length === ENGINE_TERMS.length && allPass(context.engineRows), "Engine registry rows incomplete", "engine_registry_rows");
  add("role.ready", "authority", context.roleRows.length === ROLE_TERMS.length && allPass(context.roleRows), "Role authority rows incomplete", "role_authority_matrix_rows");
  add("routing.ready", "routing", context.routingRows.length === ROUTING_TERMS.length && allPass(context.routingRows), "Routing decision rows incomplete", "routing_decision_contract_rows");
  add("evidence.ready", "evidence", context.evidenceRows.length === EVIDENCE_TERMS.length && allPass(context.evidenceRows), "Evidence class rows incomplete", "evidence_class_mapping_rows");
  add("conflict.ready", "authority", context.conflictRows.length === CONFLICT_TERMS.length && allPass(context.conflictRows), "Cross-engine conflict rows incomplete", "cross_engine_conflict_guard_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_orchestration_review_block_visible_now === true || context.boundary.claude_orchestration_review_receipt_present_now === true), "Claude orchestration review missing without visible blocker", "claude_orchestration_review_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Projection rows incomplete", "multi_engine_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "orchestration_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P15000 freeze rows missing", "p15000_freeze_rows");
  add("boundary.no.engine.authority", "boundary", context.boundary.cross_engine_final_approval_allowed_now === false && context.boundary.self_review_approval_allowed_now === false && context.boundary.reviewer_mutation_allowed_now === false && context.boundary.ci_authority_escalation_allowed_now === false && context.boundary.local_advisory_final_approval_allowed_now === false && context.boundary.protected_action_routing_allowed_now === false && context.boundary.engine_execution_allowed_now === false, "Multi-engine orchestration opened engine authority or execution", "multi_engine_boundary");
  add("boundary.no.raw.trust.release", "boundary", context.boundary.raw_transcript_exposure_allowed === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Multi-engine orchestration opened raw exposure trust production release or deployment", "multi_engine_boundary");
  add("boundary.no.write.final", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Multi-engine orchestration opened write runtime connector or final approval", "multi_engine_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p15001_handoff === context.boundary.p15000_multi_engine_freeze_ready, "P15001 handoff state must match P15000 freeze state", "multi_engine_boundary");
  return items;
}

function buildSummary(context) {
  return {
    multi_engine_orchestration_status: context.boundary.ready_for_p15001_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p14601_handoff: context.boundary.source_ready_for_p14601_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    engine_registry_row_count: context.engineRows.length,
    role_authority_matrix_row_count: context.roleRows.length,
    routing_decision_contract_row_count: context.routingRows.length,
    evidence_class_mapping_row_count: context.evidenceRows.length,
    cross_engine_conflict_guard_row_count: context.conflictRows.length,
    claude_orchestration_review_row_count: context.claudeRows.length,
    claude_orchestration_review_receipt_present_now: context.boundary.claude_orchestration_review_receipt_present_now,
    claude_orchestration_review_block_visible_now: context.boundary.claude_orchestration_review_block_visible_now,
    multi_engine_projection_row_count: context.projectionRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p15000_multi_engine_freeze_ready: context.boundary.p15000_multi_engine_freeze_ready,
    ready_for_p15001_handoff: context.boundary.ready_for_p15001_handoff,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    reviewer_mutation_allowed_now: false,
    ci_authority_escalation_allowed_now: false,
    local_advisory_final_approval_allowed_now: false,
    protected_action_routing_allowed_now: false,
    engine_execution_allowed_now: false,
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
    "# Multi-Engine Orchestration",
    "",
    `Status: ${result.summary.multi_engine_orchestration_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P14601: ${result.summary.source_ready_for_p14601_handoff}`,
    `Engine registry rows: ${result.summary.engine_registry_row_count}`,
    `Role authority rows: ${result.summary.role_authority_matrix_row_count}`,
    `Routing rows: ${result.summary.routing_decision_contract_row_count}`,
    `Evidence class rows: ${result.summary.evidence_class_mapping_row_count}`,
    `Claude orchestration review receipt present: ${result.summary.claude_orchestration_review_receipt_present_now}`,
    `Ready for P15001 handoff: ${result.summary.ready_for_p15001_handoff}`,
    `Cross-engine final approval allowed: ${result.summary.cross_engine_final_approval_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.orchestration_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.cross_engine_final_approval_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Multi-Engine Orchestration</title>
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
    <h1>Hermes Multi-Engine Orchestration</h1>
    <p class="notice">This plane separates Codex, Claude, CI, local validators, and advisory models by role and evidence class. Engine execution, self-review approval, reviewer mutation, protected routing, production approval, deployment, and protected finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Cross-Engine Final Approval</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildSecurityCompliance(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildSecurityComplianceMaturity({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.security_compliance_maturity", built);
}

function engineExtras() {
  return { engine_registry_required: true, authority_tier_required: true, engine_execution_allowed_now: false };
}

function roleExtras() {
  return { role_authority_required: true, final_adjudication_boundary_required: true, cross_engine_final_approval_allowed_now: false };
}

function routingExtras() {
  return { routing_contract_required: true, protected_action_routing_allowed_now: false, fallback_route_required: true };
}

function evidenceExtras() {
  return { evidence_class_required: true, raw_transcript_exposure_allowed: false, raw_source_exposure_allowed: false };
}

function conflictExtras() {
  return { conflict_guard_required: true, self_review_approval_allowed_now: false, reviewer_independence_required: true };
}

function projectionExtras() {
  return { read_only_projection_required: true, engine_execution_allowed_now: false, route_mutation_allowed_now: false };
}

function authorityExtras() {
  return {
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    reviewer_mutation_allowed_now: false,
    ci_authority_escalation_allowed_now: false,
    local_advisory_final_approval_allowed_now: false,
    protected_action_routing_allowed_now: false,
    deployment_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.architectureDocPath,
    source_security_compliance_path: options.sourceSecurityCompliancePath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.sourceSecurityCompliancePath,
    claude_orchestration_review_receipt_path: options.claudeOrchestrationReviewReceiptPath ?? DEFAULT_MULTI_ENGINE_ORCHESTRATION_INPUTS.claudeOrchestrationReviewReceiptPath,
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
    else if (value === "--source-security-compliance-path") args.sourceSecurityCompliancePath = argv[++index];
    else if (value === "--claude-orchestration-review-receipt-path") args.claudeOrchestrationReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P14601-P15000 Multi-Engine Orchestration artifacts.");
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
