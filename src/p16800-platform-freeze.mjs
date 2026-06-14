import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildProductionGovernanceHardening } from "./production-governance-hardening.mjs";

export const DEFAULT_P16800_PLATFORM_FREEZE_OUT_DIR = "artifacts/p16800-platform-freeze/latest";
export const DEFAULT_P16800_PLATFORM_FREEZE_INPUTS = {
  schemaPath: "schemas/p16800-platform-freeze.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p16601-p16800.md",
  architectureDocPath: "docs/architecture.md",
  sourceProductionGovernancePath: "artifacts/production-governance-hardening/latest/production-governance-hardening.json",
  claudePlatformFreezeReviewReceiptPath: "artifacts/p16800-platform-freeze/review/claude-platform-freeze-review-receipt.json",
};

const COMMAND_NAME = "platform:p16800-platform-freeze";
const SCHEMA_VERSION = "p16800-platform-freeze.v1";
const CAPABILITY_ID = "platform.p16800_platform_freeze";
const PROGRAM_RANGE = "P16601-P16800";
const SOURCE_PROGRAM_RANGE = "P16201-P16600";
const READY_STATUS = "ready_for_p16800_platform_freeze";
const BLOCKED_STATUS = "blocked_p16800_platform_freeze";

const PHASE_SPECS = [
  ["P16601-P16620", "P16600 Source Chain Binding", "platform_freeze_source_binding_rows"],
  ["P16621-P16640", "Roadmap Ledger Freeze", "roadmap_ledger_freeze_rows"],
  ["P16641-P16660", "Validation Matrix Freeze", "validation_matrix_freeze_rows"],
  ["P16661-P16680", "Review Cadence Freeze", "review_cadence_freeze_rows"],
  ["P16681-P16700", "Authority Boundary Freeze", "authority_boundary_freeze_rows"],
  ["P16701-P16720", "SaaS Factory Handoff Freeze", "saas_factory_handoff_freeze_rows"],
  ["P16721-P16740", "Operator Evidence Projection", "operator_evidence_projection_rows"],
  ["P16741-P16760", "Claude Platform Freeze Review Gate", "claude_platform_freeze_review_rows"],
  ["P16761-P16780", "Closeout Packet Projection", "closeout_packet_projection_rows"],
  ["P16781-P16800", "P16800 Platform Freeze", "p16800_freeze_rows"],
];

const ROADMAP_TERMS = ["phase range ledger", "tranche source map", "milestone status", "blocked reason", "next tranche pointer", "no static P9000 lock"];
const VALIDATION_TERMS = ["changed test ref", "adjacent regression ref", "check command ref", "full test rationale", "negative fixture", "validation blocker"];
const REVIEW_TERMS = ["Claude review cadence", "high-risk tranche", "routine review skip", "finding loop", "review receipt ref", "no final approval"];
const AUTHORITY_TERMS = ["protected output boundary", "single-owner boundary", "independent review boundary", "human gate boundary", "production PASS boundary", "enterprise trust boundary"];
const SAAS_HANDOFF_TERMS = ["project template ref", "requirement matrix ref", "validation plan ref", "review lane ref", "connector governance ref", "execution/write policy ref"];
const PROJECTION_TERMS = ["read-only freeze dashboard row", "phase status rollup", "blocker rollup", "review rollup", "validation rollup", "no mutation"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max platform freeze review receipt schema"],
  ["model_effort", "model effort"],
  ["platform_freeze_scope", "platform freeze scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const CLOSEOUT_TERMS = ["closeout packet id", "committed tranche list", "validation evidence list", "blocked item list", "handoff note", "no protected closeout"];

export async function runP16800PlatformFreeze(options = {}) {
  const result = await buildP16800PlatformFreeze(options);
  if (options.write !== false) await writeP16800PlatformFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`P16800 Platform Freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildP16800PlatformFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_P16800_PLATFORM_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "productionGovernanceHardening")
    ? normalizeInlineJsonSource("inline.production_governance_hardening", options.productionGovernanceHardening)
    : await readJsonOrBuildProductionGovernance(inputs.source_production_governance_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudePlatformFreezeReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_platform_freeze_review_receipt", options.claudePlatformFreezeReviewReceipt)
    : await readJsonSource(inputs.claude_platform_freeze_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const roadmapRows = buildTermRows("roadmap_ledger_freeze", "Roadmap ledger", ROADMAP_TERMS, roadmapDoc.text, "roadmap_ledger_freeze_rows", generatedAt, roadmapExtras);
  const validationRows = buildTermRows("validation_matrix_freeze", "Validation matrix", VALIDATION_TERMS, roadmapDoc.text, "validation_matrix_freeze_rows", generatedAt, validationExtras);
  const reviewRows = buildTermRows("review_cadence_freeze", "Review cadence", REVIEW_TERMS, roadmapDoc.text, "review_cadence_freeze_rows", generatedAt, reviewExtras);
  const authorityRows = buildTermRows("authority_boundary_freeze", "Authority boundary", AUTHORITY_TERMS, roadmapDoc.text, "authority_boundary_freeze_rows", generatedAt, authorityExtras);
  const handoffRows = buildTermRows("saas_factory_handoff_freeze", "SaaS factory handoff", SAAS_HANDOFF_TERMS, roadmapDoc.text, "saas_factory_handoff_freeze_rows", generatedAt, handoffExtras);
  const projectionRows = buildTermRows("operator_evidence_projection", "Operator projection", PROJECTION_TERMS, roadmapDoc.text, "operator_evidence_projection_rows", generatedAt, projectionExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const closeoutRows = buildTermRows("closeout_packet_projection", "Closeout packet", CLOSEOUT_TERMS, roadmapDoc.text, "closeout_packet_projection_rows", generatedAt, closeoutExtras);
  const freezeRows = buildFreezeRows({ sourceRows, roadmapRows, validationRows, reviewRows, authorityRows, handoffRows, projectionRows, claudeRows, closeoutRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, roadmapRows, validationRows, reviewRows, authorityRows, handoffRows, projectionRows, claudeRows, closeoutRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, roadmapRows, validationRows, reviewRows, authorityRows, handoffRows, projectionRows, claudeRows, closeoutRows, freezeRows, boundary });
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
      production_governance_hardening_path: source.path,
      claude_platform_freeze_review_receipt_path: claudeReview.path,
    },
    source_production_governance_summary: source.data?.summary ?? null,
    observed_claude_platform_freeze_review_summary: claudeReview.data?.summary ?? null,
    platform_freeze_contract: buildContract(generatedAt),
    platform_freeze_phase_rows: phaseRows,
    platform_freeze_source_binding_rows: sourceRows,
    roadmap_ledger_freeze_rows: roadmapRows,
    validation_matrix_freeze_rows: validationRows,
    review_cadence_freeze_rows: reviewRows,
    authority_boundary_freeze_rows: authorityRows,
    saas_factory_handoff_freeze_rows: handoffRows,
    operator_evidence_projection_rows: projectionRows,
    claude_platform_freeze_review_rows: claudeRows,
    closeout_packet_projection_rows: closeoutRows,
    p16800_freeze_rows: freezeRows,
    platform_freeze_boundary: boundary,
    platform_freeze_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, roadmapRows, validationRows, reviewRows, authorityRows, handoffRows, projectionRows, claudeRows, closeoutRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "p16800_platform_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.platform_freeze_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.platform_freeze_validation_items);
  result.summary = buildSummary({ boundary, roadmapRows, validationRows, reviewRows, authorityRows, handoffRows, projectionRows, claudeRows, closeoutRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeP16800PlatformFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "p16800-platform-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "platform-freeze-phase-rows.json"), collectionEnvelope("platform-freeze-phase-rows.v1", "platform_freeze_phase_rows", result.platform_freeze_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "platform-freeze-source-binding-rows.json"), collectionEnvelope("platform-freeze-source-binding-rows.v1", "platform_freeze_source_binding_rows", result.platform_freeze_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "roadmap-ledger-freeze-rows.json"), collectionEnvelope("roadmap-ledger-freeze-rows.v1", "roadmap_ledger_freeze_rows", result.roadmap_ledger_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-matrix-freeze-rows.json"), collectionEnvelope("validation-matrix-freeze-rows.v1", "validation_matrix_freeze_rows", result.validation_matrix_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-cadence-freeze-rows.json"), collectionEnvelope("review-cadence-freeze-rows.v1", "review_cadence_freeze_rows", result.review_cadence_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-freeze-rows.json"), collectionEnvelope("authority-boundary-freeze-rows.v1", "authority_boundary_freeze_rows", result.authority_boundary_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "saas-factory-handoff-freeze-rows.json"), collectionEnvelope("saas-factory-handoff-freeze-rows.v1", "saas_factory_handoff_freeze_rows", result.saas_factory_handoff_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-evidence-projection-rows.json"), collectionEnvelope("operator-evidence-projection-rows.v1", "operator_evidence_projection_rows", result.operator_evidence_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-platform-freeze-review-rows.json"), collectionEnvelope("claude-platform-freeze-review-rows.v1", "claude_platform_freeze_review_rows", result.claude_platform_freeze_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "closeout-packet-projection-rows.json"), collectionEnvelope("closeout-packet-projection-rows.v1", "closeout_packet_projection_rows", result.closeout_packet_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "p16800-freeze-rows.json"), collectionEnvelope("p16800-freeze-rows.v1", "p16800_freeze_rows", result.p16800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "platform-freeze-boundary.json"), result.platform_freeze_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "p16800-platform-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.platform_freeze_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runP16800PlatformFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runP16800PlatformFreeze(args);
    console.log(`P16800 Platform Freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_freeze_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P16601: ${result.summary.source_ready_for_p16601_handoff}`);
    console.log(`Claude platform freeze review receipt: ${result.summary.claude_platform_freeze_review_receipt_present_now}`);
    console.log(`Ready for post-P16800 handoff: ${result.summary.ready_for_post_p16800_handoff}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
    console.log(`Enterprise trust claim allowed: ${result.summary.enterprise_trust_claim_allowed_now}`);
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
    contract_id: "p16800-platform-freeze.contract.v1",
    generated_at: generatedAt,
    source_production_governance_required: true,
    roadmap_ledger_freeze_required: true,
    validation_matrix_freeze_required: true,
    review_cadence_freeze_required: true,
    authority_boundary_freeze_required: true,
    saas_factory_handoff_freeze_required: true,
    operator_evidence_projection_required: true,
    claude_platform_freeze_review_required: true,
    closeout_packet_projection_required: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p16601-p16800.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.production_governance_boundary ?? {};
  const sourceStatus = summary.production_governance_hardening_status ?? "missing";
  const sourceReady = summary.ready_for_p16601_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P16201-P16600 source artifact available", source.available],
    ["source.range", "P16201-P16600 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P16600 source status visible", sourceStatus === "ready_for_production_governance_hardening" || sourceStatus === "blocked_production_governance_hardening"],
    ["source.handoff", "P16600 ready_for_p16601_handoff", sourceReady],
    ["source.block_visible", "P16600 blocker visible", sourceReady || sourceBlocked],
    ["source.production_rows", "P16600 release evidence environment incident backup SLO projection and authority rows available", Number(summary.release_candidate_governance_row_count ?? 0) >= 6 && Number(summary.production_evidence_bundle_row_count ?? 0) >= 6 && Number(summary.environment_config_boundary_row_count ?? 0) >= 6 && Number(summary.incident_runbook_readiness_row_count ?? 0) >= 6 && Number(summary.backup_restore_readiness_row_count ?? 0) >= 6 && Number(summary.slo_observability_readiness_row_count ?? 0) >= 6 && Number(summary.production_read_only_projection_row_count ?? 0) >= 6 && Number(summary.production_authority_guard_row_count ?? 0) >= 8],
    ["source.no_production_side_effects", "P16600 source did not open deployment release production enterprise trust or protected closeout", boundary.deployment_allowed_now === false && boundary.release_approval_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false && boundary.enterprise_trust_claim_allowed_now === false && boundary.protected_closeout_enabled === false],
    ["source.no_execution_write", "P16600 source did not open config write migration rollback runtime write protected action connector write or external mutation", boundary.environment_config_write_allowed_now === false && boundary.migration_execution_allowed_now === false && boundary.rollback_execution_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false && boundary.protected_action_allowed_now === false && boundary.connector_write_enabled === false && boundary.external_service_mutation_allowed_now === false],
    ["source.no_raw_secret_final", "P16600 source did not open raw source exposure secret read Codex final approval or Claude final approval", boundary.raw_source_exposure_allowed === false && boundary.secret_read_allowed_now === false && boundary.codex_final_approval_ui_enabled === false && boundary.claude_final_approval_ui_enabled === false && boundary.final_approval_ui_enabled === false],
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
    evidence_ref: "docs/hermes-roadmap-p16601-p16800.md#platform-freeze-contract",
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
    && claudeReview.data?.scope_p16800_platform_freeze === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_platform_freeze_review.${reviewId}`,
    category: "claude_platform_freeze_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p16601-p16800.md#P16741-P16760",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_platform_freeze_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_platform_freeze_review_receipt_present_now === true);
  return [
    ["freeze.source", "P16600 source ready for P16601", sourceReady],
    ["freeze.source_block_visible", "P16600 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.roadmap", "roadmap ledger freeze ready", allPass(context.roadmapRows)],
    ["freeze.validation", "validation matrix freeze ready", allPass(context.validationRows)],
    ["freeze.review_cadence", "review cadence freeze ready", allPass(context.reviewRows)],
    ["freeze.authority", "authority boundary freeze ready", allPass(context.authorityRows)],
    ["freeze.saas_handoff", "SaaS factory handoff freeze ready", allPass(context.handoffRows)],
    ["freeze.operator_projection", "operator evidence projection ready", allPass(context.projectionRows)],
    ["freeze.claude_platform_freeze_review", "Claude platform freeze review receipt ready", claudeReady],
    ["freeze.closeout_packet", "closeout packet projection ready", allPass(context.closeoutRows)],
    ["freeze.no_production_side_effects", "no deployment release approval production PASS enterprise PASS trust protected closeout or single-owner enterprise trust opened", true],
    ["freeze.no_execution_raw_secret", "no config write migration rollback runtime write connector external mutation raw exposure or secret read opened", true],
    ["freeze.no_final_or_bypass", "no Codex or Claude final approval human gate bypass independent review bypass or reviewer mutation opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p16800_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p16800-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceAvailable = context.source.available === true;
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const roadmapReady = allPass(context.roadmapRows);
  const validationReady = allPass(context.validationRows);
  const reviewReady = allPass(context.reviewRows);
  const authorityReady = allPass(context.authorityRows);
  const handoffReady = allPass(context.handoffRows);
  const projectionReady = allPass(context.projectionRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_platform_freeze_review_receipt_present_now === true);
  const closeoutReady = allPass(context.closeoutRows);
  const contractReady = roadmapReady && validationReady && reviewReady && authorityReady && handoffReady && projectionReady && allPass(context.claudeRows) && closeoutReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_production_governance_available: sourceAvailable,
    source_ready_for_p16601_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    roadmap_ledger_freeze_ready: roadmapReady,
    validation_matrix_freeze_ready: validationReady,
    review_cadence_freeze_ready: reviewReady,
    authority_boundary_freeze_ready: authorityReady,
    saas_factory_handoff_freeze_ready: handoffReady,
    operator_evidence_projection_ready: projectionReady,
    claude_platform_freeze_review_receipt_present_now: claudeObserved,
    claude_platform_freeze_review_block_visible_now: claudeObserved === false,
    closeout_packet_projection_ready: closeoutReady,
    p16800_platform_freeze_ready: freezeReady,
    ready_for_post_p16800_handoff: freezeReady,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P16601-P16800 phase rows incomplete", "docs/hermes-roadmap-p16601-p16800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P16601-P16800"), "Architecture doc missing P16601-P16800 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 9 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P16600 source state must be available and blocker-visible", "platform_freeze_source_binding_rows");
  add("roadmap.ready", "roadmap", context.roadmapRows.length === ROADMAP_TERMS.length && allPass(context.roadmapRows), "Roadmap ledger freeze rows incomplete", "roadmap_ledger_freeze_rows");
  add("validation.ready", "validation", context.validationRows.length === VALIDATION_TERMS.length && allPass(context.validationRows), "Validation matrix freeze rows incomplete", "validation_matrix_freeze_rows");
  add("review.ready", "review", context.reviewRows.length === REVIEW_TERMS.length && allPass(context.reviewRows), "Review cadence freeze rows incomplete", "review_cadence_freeze_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority boundary freeze rows incomplete", "authority_boundary_freeze_rows");
  add("handoff.ready", "handoff", context.handoffRows.length === SAAS_HANDOFF_TERMS.length && allPass(context.handoffRows), "SaaS factory handoff freeze rows incomplete", "saas_factory_handoff_freeze_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Operator evidence projection rows incomplete", "operator_evidence_projection_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_platform_freeze_review_block_visible_now === true || context.boundary.claude_platform_freeze_review_receipt_present_now === true), "Claude platform freeze review missing without visible blocker", "claude_platform_freeze_review_rows");
  add("closeout.ready", "closeout", context.closeoutRows.length === CLOSEOUT_TERMS.length && allPass(context.closeoutRows), "Closeout packet projection rows incomplete", "closeout_packet_projection_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P16800 freeze rows missing", "p16800_freeze_rows");
  add("boundary.no.production.claim", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false && context.boundary.single_owner_enterprise_trust_allowed_now === false, "Platform freeze opened deployment release production enterprise trust protected closeout or single-owner enterprise trust", "platform_freeze_boundary");
  add("boundary.no.execution.raw.secret", "boundary", context.boundary.environment_config_write_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Platform freeze opened config migration rollback runtime write connector mutation secret or raw exposure", "platform_freeze_boundary");
  add("boundary.no.final.or.bypass", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false && context.boundary.human_gate_bypass_allowed_now === false && context.boundary.independent_review_bypass_allowed_now === false && context.boundary.reviewer_mutation_allowed_now === false, "Platform freeze opened final approval or review/human bypass", "platform_freeze_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_post_p16800_handoff === context.boundary.p16800_platform_freeze_ready, "post-P16800 handoff state must match P16800 freeze state", "platform_freeze_boundary");
  return items;
}

function buildSummary(context) {
  return {
    platform_freeze_status: context.boundary.ready_for_post_p16800_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p16601_handoff: context.boundary.source_ready_for_p16601_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    roadmap_ledger_freeze_row_count: context.roadmapRows.length,
    validation_matrix_freeze_row_count: context.validationRows.length,
    review_cadence_freeze_row_count: context.reviewRows.length,
    authority_boundary_freeze_row_count: context.authorityRows.length,
    saas_factory_handoff_freeze_row_count: context.handoffRows.length,
    operator_evidence_projection_row_count: context.projectionRows.length,
    claude_platform_freeze_review_row_count: context.claudeRows.length,
    claude_platform_freeze_review_receipt_present_now: context.boundary.claude_platform_freeze_review_receipt_present_now,
    claude_platform_freeze_review_block_visible_now: context.boundary.claude_platform_freeze_review_block_visible_now,
    closeout_packet_projection_row_count: context.closeoutRows.length,
    p16800_platform_freeze_ready: context.boundary.p16800_platform_freeze_ready,
    ready_for_post_p16800_handoff: context.boundary.ready_for_post_p16800_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_enabled: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# P16800 Platform Freeze",
    "",
    `Status: ${result.summary.platform_freeze_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P16601: ${result.summary.source_ready_for_p16601_handoff}`,
    `Roadmap rows: ${result.summary.roadmap_ledger_freeze_row_count}`,
    `Validation rows: ${result.summary.validation_matrix_freeze_row_count}`,
    `Review cadence rows: ${result.summary.review_cadence_freeze_row_count}`,
    `Claude platform freeze review receipt present: ${result.summary.claude_platform_freeze_review_receipt_present_now}`,
    `Ready for post-P16800 handoff: ${result.summary.ready_for_post_p16800_handoff}`,
    `Deployment allowed: ${result.summary.deployment_allowed_now}`,
    `Enterprise trust claim allowed: ${result.summary.enterprise_trust_claim_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.authority_boundary_freeze_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.enterprise_trust_claim_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes P16800 Platform Freeze</title>
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
    <h1>Hermes P16800 Platform Freeze</h1>
    <p class="notice">This plane records source chain, roadmap, validation, review cadence, authority, SaaS handoff, operator projection, and closeout evidence. Shipment, approvals, environment mutation, execution, writes, review bypass, raw access, and finalization stay closed.</p>
    <table><thead><tr><th>Authority Boundary</th><th>Verdict</th><th>Enterprise Trust Claim</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildProductionGovernance(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildProductionGovernanceHardening({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.production_governance_hardening", built);
}

function roadmapExtras() {
  return { phase_range_based: true, p9000_locked_copy_allowed: false };
}

function validationExtras() {
  return { diff_first_validation_required: true, full_npm_default_allowed: false };
}

function reviewExtras() {
  return { claude_review_required_for_high_risk: true, routine_review_required: false, final_approval_allowed_now: false };
}

function authorityExtras() {
  return {
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function handoffExtras() {
  return { project_creation_allowed_now: false, repo_write_allowed_now: false, connector_provisioning_allowed_now: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, api_write_allowed_now: false, dashboard_mutation_allowed_now: false };
}

function closeoutExtras() {
  return { closeout_packet_required: true, protected_closeout_enabled: false, production_pass_enabled: false };
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
    schema_path: options.schemaPath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.architectureDocPath,
    source_production_governance_path: options.sourceProductionGovernancePath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.sourceProductionGovernancePath,
    claude_platform_freeze_review_receipt_path: options.claudePlatformFreezeReviewReceiptPath ?? DEFAULT_P16800_PLATFORM_FREEZE_INPUTS.claudePlatformFreezeReviewReceiptPath,
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
    else if (value === "--source-production-governance-path") args.sourceProductionGovernancePath = argv[++index];
    else if (value === "--claude-platform-freeze-review-receipt-path") args.claudePlatformFreezeReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P16601-P16800 Platform Freeze artifacts.");
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
