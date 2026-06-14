import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildExecutionWriteAuthorityMaturity } from "./execution-write-authority-maturity.mjs";

export const DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_OUT_DIR = "artifacts/production-governance-hardening/latest";
export const DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS = {
  schemaPath: "schemas/production-governance-hardening.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p16201-p16600.md",
  architectureDocPath: "docs/architecture.md",
  sourceExecutionWriteAuthorityPath: "artifacts/execution-write-authority-maturity/latest/execution-write-authority-maturity.json",
  claudeProductionGovernanceReviewReceiptPath: "artifacts/production-governance-hardening/review/claude-production-governance-review-receipt.json",
};

const COMMAND_NAME = "platform:production-governance-hardening";
const SCHEMA_VERSION = "production-governance-hardening.v1";
const CAPABILITY_ID = "platform.production_governance_hardening";
const PROGRAM_RANGE = "P16201-P16600";
const SOURCE_PROGRAM_RANGE = "P15801-P16200";
const READY_STATUS = "ready_for_production_governance_hardening";
const BLOCKED_STATUS = "blocked_production_governance_hardening";

const PHASE_SPECS = [
  ["P16201-P16240", "P16200 Source Binding", "production_governance_source_binding_rows"],
  ["P16241-P16280", "Release Candidate Governance", "release_candidate_governance_rows"],
  ["P16281-P16320", "Production Evidence Bundle", "production_evidence_bundle_rows"],
  ["P16321-P16360", "Environment Config Boundary", "environment_config_boundary_rows"],
  ["P16361-P16400", "Incident Runbook Readiness", "incident_runbook_readiness_rows"],
  ["P16401-P16440", "Backup Restore Readiness", "backup_restore_readiness_rows"],
  ["P16441-P16480", "SLO Observability Readiness", "slo_observability_readiness_rows"],
  ["P16481-P16520", "Claude Production Governance Review Gate", "claude_production_governance_review_rows"],
  ["P16521-P16560", "Read-Only Production Projection", "production_read_only_projection_rows"],
  ["P16561-P16600", "Production Governance Freeze", "p16600_freeze_rows"],
];

const RELEASE_TERMS = ["release candidate id", "scope ref", "build artifact ref", "change freeze", "promotion blocker", "no release approval"];
const EVIDENCE_TERMS = ["evidence bundle id", "CI ref", "attestation ref", "review receipt ref", "risk register ref", "evidence blocker"];
const ENVIRONMENT_TERMS = ["environment id", "config ref", "secret handle", "migration policy", "no config write", "environment blocker"];
const INCIDENT_TERMS = ["runbook id", "severity tier", "on-call owner", "escalation path", "recovery target", "incident blocker"];
const BACKUP_TERMS = ["backup id", "restore point", "restore test ref", "data boundary", "retention policy", "restore blocker"];
const SLO_TERMS = ["slo id", "metric ref", "alert policy", "error budget", "cost signal", "observability blocker"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max production governance review receipt schema"],
  ["model_effort", "model effort"],
  ["production_scope", "production scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const PROJECTION_TERMS = ["read-only production registry API row", "dashboard row", "release preview", "incident rollup", "readiness rollup", "no deployment"];
const AUTHORITY_TERMS = [
  "no deployment",
  "no release approval",
  "no production PASS",
  "no enterprise PASS",
  "no enterprise trust claim",
  "no protected closeout",
  "no config write",
  "no final automated approval",
];

export async function runProductionGovernanceHardening(options = {}) {
  const result = await buildProductionGovernanceHardening(options);
  if (options.write !== false) await writeProductionGovernanceHardening(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Production Governance Hardening failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProductionGovernanceHardening(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "executionWriteAuthorityMaturity")
    ? normalizeInlineJsonSource("inline.execution_write_authority_maturity", options.executionWriteAuthorityMaturity)
    : await readJsonOrBuildExecutionWriteAuthority(inputs.source_execution_write_authority_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeProductionGovernanceReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_production_governance_review_receipt", options.claudeProductionGovernanceReviewReceipt)
    : await readJsonSource(inputs.claude_production_governance_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const releaseRows = buildTermRows("release_candidate_governance", "Release candidate", RELEASE_TERMS, roadmapDoc.text, "release_candidate_governance_rows", generatedAt, releaseExtras);
  const evidenceRows = buildTermRows("production_evidence_bundle", "Production evidence", EVIDENCE_TERMS, roadmapDoc.text, "production_evidence_bundle_rows", generatedAt, evidenceExtras);
  const environmentRows = buildTermRows("environment_config_boundary", "Environment config", ENVIRONMENT_TERMS, roadmapDoc.text, "environment_config_boundary_rows", generatedAt, environmentExtras);
  const incidentRows = buildTermRows("incident_runbook_readiness", "Incident runbook", INCIDENT_TERMS, roadmapDoc.text, "incident_runbook_readiness_rows", generatedAt, incidentExtras);
  const backupRows = buildTermRows("backup_restore_readiness", "Backup restore", BACKUP_TERMS, roadmapDoc.text, "backup_restore_readiness_rows", generatedAt, backupExtras);
  const sloRows = buildTermRows("slo_observability_readiness", "SLO observability", SLO_TERMS, roadmapDoc.text, "slo_observability_readiness_rows", generatedAt, sloExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const projectionRows = buildTermRows("production_read_only_projection", "Production projection", PROJECTION_TERMS, roadmapDoc.text, "production_read_only_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("production_authority_guard", "Production authority guard", AUTHORITY_TERMS, roadmapDoc.text, "production_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, releaseRows, evidenceRows, environmentRows, incidentRows, backupRows, sloRows, claudeRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, releaseRows, evidenceRows, environmentRows, incidentRows, backupRows, sloRows, claudeRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, releaseRows, evidenceRows, environmentRows, incidentRows, backupRows, sloRows, claudeRows, projectionRows, authorityRows, freezeRows, boundary });
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
      execution_write_authority_maturity_path: source.path,
      claude_production_governance_review_receipt_path: claudeReview.path,
    },
    source_execution_write_authority_summary: source.data?.summary ?? null,
    observed_claude_production_governance_review_summary: claudeReview.data?.summary ?? null,
    production_governance_contract: buildContract(generatedAt),
    production_governance_phase_rows: phaseRows,
    production_governance_source_binding_rows: sourceRows,
    release_candidate_governance_rows: releaseRows,
    production_evidence_bundle_rows: evidenceRows,
    environment_config_boundary_rows: environmentRows,
    incident_runbook_readiness_rows: incidentRows,
    backup_restore_readiness_rows: backupRows,
    slo_observability_readiness_rows: sloRows,
    claude_production_governance_review_rows: claudeRows,
    production_read_only_projection_rows: projectionRows,
    production_authority_guard_rows: authorityRows,
    p16600_freeze_rows: freezeRows,
    production_governance_boundary: boundary,
    production_governance_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, releaseRows, evidenceRows, environmentRows, incidentRows, backupRows, sloRows, claudeRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "production_governance_hardening")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.production_governance_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.production_governance_validation_items);
  result.summary = buildSummary({ boundary, releaseRows, evidenceRows, environmentRows, incidentRows, backupRows, sloRows, claudeRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeProductionGovernanceHardening(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "production-governance-hardening.json"), serializableResult(result));
  await writeJson(path.join(outDir, "production-governance-phase-rows.json"), collectionEnvelope("production-governance-phase-rows.v1", "production_governance_phase_rows", result.production_governance_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-governance-source-binding-rows.json"), collectionEnvelope("production-governance-source-binding-rows.v1", "production_governance_source_binding_rows", result.production_governance_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-governance-rows.json"), collectionEnvelope("release-candidate-governance-rows.v1", "release_candidate_governance_rows", result.release_candidate_governance_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-evidence-bundle-rows.json"), collectionEnvelope("production-evidence-bundle-rows.v1", "production_evidence_bundle_rows", result.production_evidence_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "environment-config-boundary-rows.json"), collectionEnvelope("environment-config-boundary-rows.v1", "environment_config_boundary_rows", result.environment_config_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "incident-runbook-readiness-rows.json"), collectionEnvelope("incident-runbook-readiness-rows.v1", "incident_runbook_readiness_rows", result.incident_runbook_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "backup-restore-readiness-rows.json"), collectionEnvelope("backup-restore-readiness-rows.v1", "backup_restore_readiness_rows", result.backup_restore_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "slo-observability-readiness-rows.json"), collectionEnvelope("slo-observability-readiness-rows.v1", "slo_observability_readiness_rows", result.slo_observability_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-production-governance-review-rows.json"), collectionEnvelope("claude-production-governance-review-rows.v1", "claude_production_governance_review_rows", result.claude_production_governance_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-read-only-projection-rows.json"), collectionEnvelope("production-read-only-projection-rows.v1", "production_read_only_projection_rows", result.production_read_only_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-authority-guard-rows.json"), collectionEnvelope("production-authority-guard-rows.v1", "production_authority_guard_rows", result.production_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p16600-freeze-rows.json"), collectionEnvelope("p16600-freeze-rows.v1", "p16600_freeze_rows", result.p16600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-governance-boundary.json"), result.production_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "production-governance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.production_governance_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runProductionGovernanceHardeningCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runProductionGovernanceHardening(args);
    console.log(`Production Governance Hardening ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.production_governance_hardening_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P16201: ${result.summary.source_ready_for_p16201_handoff}`);
    console.log(`Claude production governance review receipt: ${result.summary.claude_production_governance_review_receipt_present_now}`);
    console.log(`Ready for P16601 handoff: ${result.summary.ready_for_p16601_handoff}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
    console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
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
    contract_id: "production-governance-hardening.contract.v1",
    generated_at: generatedAt,
    source_execution_write_authority_required: true,
    release_candidate_governance_required: true,
    production_evidence_bundle_required: true,
    environment_config_boundary_required: true,
    incident_runbook_readiness_required: true,
    backup_restore_readiness_required: true,
    slo_observability_readiness_required: true,
    claude_production_governance_review_required: true,
    read_only_production_projection_required: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p16201-p16600.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.execution_write_authority_boundary ?? {};
  const sourceStatus = summary.execution_write_authority_maturity_status ?? "missing";
  const sourceReady = summary.ready_for_p16201_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P15801-P16200 source artifact available", source.available],
    ["source.range", "P15801-P16200 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P16200 source status visible", sourceStatus === "ready_for_execution_write_authority_maturity" || sourceStatus === "blocked_execution_write_authority_maturity"],
    ["source.handoff", "P16200 ready_for_p16201_handoff", sourceReady],
    ["source.block_visible", "P16200 blocker visible", sourceReady || sourceBlocked],
    ["source.authority_rows", "P16200 action candidate allowlist write rollback validation projection rows available", Number(summary.action_class_registry_row_count ?? 0) >= 6 && Number(summary.receipt_gated_candidate_lane_row_count ?? 0) >= 6 && Number(summary.command_allowlist_policy_row_count ?? 0) >= 6 && Number(summary.write_scope_policy_row_count ?? 0) >= 6 && Number(summary.rollback_recovery_binding_row_count ?? 0) >= 6 && Number(summary.post_action_validation_row_count ?? 0) >= 6 && Number(summary.authority_read_only_projection_row_count ?? 0) >= 6],
    ["source.no_execution_write", "P16200 source did not open receipt application command runtime direct write patch apply or protected action", boundary.receipt_application_allowed_now === false && boundary.command_execution_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.direct_file_write_allowed_now === false && boundary.patch_apply_allowed_now === false && boundary.protected_action_allowed_now === false],
    ["source.no_release_trust_final", "P16200 source did not open deployment production trust protected closeout release write or final approval", boundary.deployment_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_trust_claim_allowed_now === false && boundary.protected_closeout_enabled === false && boundary.release_approval_allowed_now === false && boundary.write_action_allowed_now === false && boundary.final_approval_ui_enabled === false],
    ["source.no_raw_secret_connector", "P16200 source did not open connector write raw source exposure or secret read", boundary.connector_write_enabled === false && boundary.raw_source_exposure_allowed === false && boundary.secret_read_allowed_now === false],
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
    evidence_ref: "docs/hermes-roadmap-p16201-p16600.md#production-governance-hardening-contract",
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
    && claudeReview.data?.scope_production_governance_hardening === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_production_governance_review.${reviewId}`,
    category: "claude_production_governance_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p16201-p16600.md#P16481-P16520",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_production_governance_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_production_governance_review_receipt_present_now === true);
  return [
    ["freeze.source", "P16200 source ready for P16201", sourceReady],
    ["freeze.source_block_visible", "P16200 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.release_candidate", "release candidate governance ready", allPass(context.releaseRows)],
    ["freeze.production_evidence", "production evidence bundle ready", allPass(context.evidenceRows)],
    ["freeze.environment", "environment config boundary ready", allPass(context.environmentRows)],
    ["freeze.incident", "incident runbook readiness ready", allPass(context.incidentRows)],
    ["freeze.backup", "backup restore readiness ready", allPass(context.backupRows)],
    ["freeze.slo", "SLO observability readiness ready", allPass(context.sloRows)],
    ["freeze.claude_production_governance_review", "Claude production governance review receipt ready", claudeReady],
    ["freeze.projection", "read-only production projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "production authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_production_side_effects", "no deployment release approval production PASS enterprise PASS trust protected closeout or final approval opened", true],
    ["freeze.no_execution_raw_secret", "no config write migration rollback runtime write connector external mutation raw exposure or secret read opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p16600_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p16600-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceAvailable = context.source.available === true;
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const releaseReady = allPass(context.releaseRows);
  const evidenceReady = allPass(context.evidenceRows);
  const environmentReady = allPass(context.environmentRows);
  const incidentReady = allPass(context.incidentRows);
  const backupReady = allPass(context.backupRows);
  const sloReady = allPass(context.sloRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_production_governance_review_receipt_present_now === true);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = releaseReady && evidenceReady && environmentReady && incidentReady && backupReady && sloReady && allPass(context.claudeRows) && projectionReady && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_execution_write_authority_available: sourceAvailable,
    source_ready_for_p16201_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    release_candidate_governance_ready: releaseReady,
    production_evidence_bundle_ready: evidenceReady,
    environment_config_boundary_ready: environmentReady,
    incident_runbook_readiness_ready: incidentReady,
    backup_restore_readiness_ready: backupReady,
    slo_observability_readiness_ready: sloReady,
    claude_production_governance_review_receipt_present_now: claudeObserved,
    claude_production_governance_review_block_visible_now: claudeObserved === false,
    production_read_only_projection_ready: projectionReady,
    production_authority_guard_ready: authorityReady,
    p16600_production_governance_freeze_ready: freezeReady,
    ready_for_p16601_handoff: freezeReady,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P16201-P16600 phase rows incomplete", "docs/hermes-roadmap-p16201-p16600.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P16201-P16600"), "Architecture doc missing P16201-P16600 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 9 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P16200 source state must be available and blocker-visible", "production_governance_source_binding_rows");
  add("release.ready", "release", context.releaseRows.length === RELEASE_TERMS.length && allPass(context.releaseRows), "Release candidate rows incomplete", "release_candidate_governance_rows");
  add("evidence.ready", "evidence", context.evidenceRows.length === EVIDENCE_TERMS.length && allPass(context.evidenceRows), "Production evidence rows incomplete", "production_evidence_bundle_rows");
  add("environment.ready", "environment", context.environmentRows.length === ENVIRONMENT_TERMS.length && allPass(context.environmentRows), "Environment config rows incomplete", "environment_config_boundary_rows");
  add("incident.ready", "incident", context.incidentRows.length === INCIDENT_TERMS.length && allPass(context.incidentRows), "Incident runbook rows incomplete", "incident_runbook_readiness_rows");
  add("backup.ready", "backup", context.backupRows.length === BACKUP_TERMS.length && allPass(context.backupRows), "Backup restore rows incomplete", "backup_restore_readiness_rows");
  add("slo.ready", "slo", context.sloRows.length === SLO_TERMS.length && allPass(context.sloRows), "SLO observability rows incomplete", "slo_observability_readiness_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_production_governance_review_block_visible_now === true || context.boundary.claude_production_governance_review_receipt_present_now === true), "Claude production governance review missing without visible blocker", "claude_production_governance_review_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Production projection rows incomplete", "production_read_only_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Production authority guard rows incomplete", "production_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P16600 freeze rows missing", "p16600_freeze_rows");
  add("boundary.no.production.claim", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false, "Production governance opened deployment release production enterprise trust or protected closeout", "production_governance_boundary");
  add("boundary.no.execution.raw.secret", "boundary", context.boundary.environment_config_write_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Production governance opened config migration rollback runtime write connector mutation secret or raw exposure", "production_governance_boundary");
  add("boundary.no.final", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Production governance opened final approval", "production_governance_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p16601_handoff === context.boundary.p16600_production_governance_freeze_ready, "P16601 handoff state must match P16600 freeze state", "production_governance_boundary");
  return items;
}

function buildSummary(context) {
  return {
    production_governance_hardening_status: context.boundary.ready_for_p16601_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p16201_handoff: context.boundary.source_ready_for_p16201_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    release_candidate_governance_row_count: context.releaseRows.length,
    production_evidence_bundle_row_count: context.evidenceRows.length,
    environment_config_boundary_row_count: context.environmentRows.length,
    incident_runbook_readiness_row_count: context.incidentRows.length,
    backup_restore_readiness_row_count: context.backupRows.length,
    slo_observability_readiness_row_count: context.sloRows.length,
    claude_production_governance_review_row_count: context.claudeRows.length,
    claude_production_governance_review_receipt_present_now: context.boundary.claude_production_governance_review_receipt_present_now,
    claude_production_governance_review_block_visible_now: context.boundary.claude_production_governance_review_block_visible_now,
    production_read_only_projection_row_count: context.projectionRows.length,
    production_authority_guard_row_count: context.authorityRows.length,
    p16600_production_governance_freeze_ready: context.boundary.p16600_production_governance_freeze_ready,
    ready_for_p16601_handoff: context.boundary.ready_for_p16601_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
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
    "# Production Governance Hardening",
    "",
    `Status: ${result.summary.production_governance_hardening_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P16201: ${result.summary.source_ready_for_p16201_handoff}`,
    `Release candidate rows: ${result.summary.release_candidate_governance_row_count}`,
    `Production evidence rows: ${result.summary.production_evidence_bundle_row_count}`,
    `Environment config rows: ${result.summary.environment_config_boundary_row_count}`,
    `Claude production governance review receipt present: ${result.summary.claude_production_governance_review_receipt_present_now}`,
    `Ready for P16601 handoff: ${result.summary.ready_for_p16601_handoff}`,
    `Deployment allowed: ${result.summary.deployment_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.production_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.deployment_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Production Governance</title>
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
    <h1>Hermes Production Governance</h1>
    <p class="notice">This plane records release candidates, production evidence, environment boundaries, incident runbooks, backup posture, SLO readiness, and review receipts as Harness evidence. Shipment, release approval, production claims, enterprise claims, environment mutation, migrations, restore actions, and finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Deployment</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildExecutionWriteAuthority(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildExecutionWriteAuthorityMaturity({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.execution_write_authority_maturity", built);
}

function releaseExtras() {
  return { release_candidate_required: true, release_approval_allowed_now: false, promotion_allowed_now: false };
}

function evidenceExtras() {
  return { production_evidence_required: true, attestation_ref_required: true, production_pass_enabled: false };
}

function environmentExtras() {
  return { environment_boundary_required: true, environment_config_write_allowed_now: false, migration_execution_allowed_now: false, secret_read_allowed_now: false };
}

function incidentExtras() {
  return { incident_runbook_required: true, incident_auto_close_allowed_now: false, external_service_mutation_allowed_now: false };
}

function backupExtras() {
  return { backup_restore_required: true, rollback_execution_allowed_now: false, raw_source_exposure_allowed: false };
}

function sloExtras() {
  return { slo_observability_required: true, metric_write_allowed_now: false, alert_mutation_allowed_now: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, deployment_allowed_now: false, api_write_allowed_now: false };
}

function authorityExtras() {
  return {
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    environment_config_write_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.architectureDocPath,
    source_execution_write_authority_path: options.sourceExecutionWriteAuthorityPath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.sourceExecutionWriteAuthorityPath,
    claude_production_governance_review_receipt_path: options.claudeProductionGovernanceReviewReceiptPath ?? DEFAULT_PRODUCTION_GOVERNANCE_HARDENING_INPUTS.claudeProductionGovernanceReviewReceiptPath,
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
    else if (value === "--source-execution-write-authority-path") args.sourceExecutionWriteAuthorityPath = argv[++index];
    else if (value === "--claude-production-governance-review-receipt-path") args.claudeProductionGovernanceReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P16201-P16600 Production Governance Hardening artifacts.");
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
