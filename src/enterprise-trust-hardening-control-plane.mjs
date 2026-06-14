import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReleaseReadinessControlPlane } from "./release-readiness-control-plane.mjs";

export const DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_OUT_DIR = "artifacts/enterprise-trust-hardening-control-plane/latest";
export const DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS = {
  schemaPath: "schemas/enterprise-trust-hardening-control-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p13001-p13400.md",
  architectureDocPath: "docs/architecture.md",
  sourceReleaseReadinessPath: "artifacts/release-readiness-control-plane/latest/release-readiness-control-plane.json",
  claudeEnterpriseTrustReviewReceiptPath: "artifacts/enterprise-trust-hardening-control-plane/review/claude-enterprise-trust-review-receipt.json",
};

const COMMAND_NAME = "platform:enterprise-trust-hardening-control-plane";
const SCHEMA_VERSION = "enterprise-trust-hardening-control-plane.v1";
const CAPABILITY_ID = "platform.enterprise_trust_hardening_control_plane";
const PROGRAM_RANGE = "P13001-P13400";
const SOURCE_PROGRAM_RANGE = "P12801-P13000";
const READY_STATUS = "ready_for_enterprise_trust_hardening_control_plane";
const BLOCKED_STATUS = "blocked_enterprise_trust_hardening_control_plane";

const PHASE_SPECS = [
  ["P13001-P13040", "P13000 Source Binding", "enterprise_source_binding_rows"],
  ["P13041-P13080", "Independent Review Hardening", "independent_review_hardening_rows"],
  ["P13081-P13120", "Attestation Hardening", "attestation_hardening_rows"],
  ["P13121-P13160", "SBOM And Dependency Evidence", "sbom_dependency_evidence_rows"],
  ["P13161-P13200", "Supply-Chain Policy", "supply_chain_policy_rows"],
  ["P13201-P13240", "Audit Trail Hardening", "audit_trail_hardening_rows"],
  ["P13241-P13280", "Backup And Restore Posture", "backup_restore_posture_rows"],
  ["P13281-P13320", "Recovery Posture", "recovery_posture_rows"],
  ["P13321-P13360", "Claude Enterprise Trust Review Gate", "claude_enterprise_trust_review_rows"],
  ["P13361-P13400", "Enterprise Trust Freeze", "p13400_freeze_rows"],
];

const REVIEW_TERMS = ["independent reviewer identity", "PR review evidence", "review freshness", "conflict-of-interest guard", "single-owner downgrade", "no self approval"];
const ATTESTATION_TERMS = ["signed attestation", "artifact digest", "commit sha binding", "verifier identity", "verification freshness", "attestation not overclaimed"];
const SBOM_TERMS = ["SBOM ref", "dependency snapshot", "license policy", "vulnerability scan ref", "dependency diff", "raw secret exclusion"];
const SUPPLY_TERMS = ["lockfile policy", "provenance policy", "trusted publisher policy", "dependency allowlist", "package integrity", "transitive risk note"];
const AUDIT_TERMS = ["append-only event ref", "actor id", "timestamp", "evidence hash chain", "receipt provenance", "audit gap visible"];
const BACKUP_TERMS = ["backup snapshot ref", "restore drill evidence", "retention policy", "recovery owner", "restore verification", "backup not overclaimed"];
const RECOVERY_TERMS = ["incident playbook", "RTO/RPO target", "rollback scenario", "dependency outage plan", "communication owner", "recovery exercise status"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max enterprise trust review receipt schema"],
  ["model_effort", "model effort"],
  ["trust_review_scope", "trust review scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const AUTHORITY_TERMS = ["no enterprise trust claim", "no production PASS", "no protected closeout", "no deployment", "no write action", "no final automated approval"];

export async function runEnterpriseTrustHardeningControlPlane(options = {}) {
  const result = await buildEnterpriseTrustHardeningControlPlane(options);
  if (options.write !== false) await writeEnterpriseTrustHardeningControlPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Enterprise Trust Hardening Control Plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEnterpriseTrustHardeningControlPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "releaseReadinessControlPlane")
    ? normalizeInlineJsonSource("inline.release_readiness_control_plane", options.releaseReadinessControlPlane)
    : await readJsonOrBuildReleaseReadiness(inputs.source_release_readiness_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeEnterpriseTrustReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_enterprise_trust_review_receipt", options.claudeEnterpriseTrustReviewReceipt)
    : await readJsonSource(inputs.claude_enterprise_trust_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const reviewRows = buildTermRows("independent_review_hardening", "Independent review", REVIEW_TERMS, roadmapDoc.text, "independent_review_hardening_rows", generatedAt, reviewExtras);
  const attestationRows = buildTermRows("attestation_hardening", "Attestation", ATTESTATION_TERMS, roadmapDoc.text, "attestation_hardening_rows", generatedAt, attestationExtras);
  const sbomRows = buildTermRows("sbom_dependency_evidence", "SBOM and dependency", SBOM_TERMS, roadmapDoc.text, "sbom_dependency_evidence_rows", generatedAt, sbomExtras);
  const supplyRows = buildTermRows("supply_chain_policy", "Supply-chain policy", SUPPLY_TERMS, roadmapDoc.text, "supply_chain_policy_rows", generatedAt, supplyExtras);
  const auditRows = buildTermRows("audit_trail_hardening", "Audit trail", AUDIT_TERMS, roadmapDoc.text, "audit_trail_hardening_rows", generatedAt, auditExtras);
  const backupRows = buildTermRows("backup_restore_posture", "Backup and restore", BACKUP_TERMS, roadmapDoc.text, "backup_restore_posture_rows", generatedAt, backupExtras);
  const recoveryRows = buildTermRows("recovery_posture", "Recovery posture", RECOVERY_TERMS, roadmapDoc.text, "recovery_posture_rows", generatedAt, recoveryExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const authorityRows = buildTermRows("enterprise_trust_authority_guard", "Enterprise trust authority guard", AUTHORITY_TERMS, roadmapDoc.text, "enterprise_trust_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, reviewRows, attestationRows, sbomRows, supplyRows, auditRows, backupRows, recoveryRows, claudeRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, reviewRows, attestationRows, sbomRows, supplyRows, auditRows, backupRows, recoveryRows, claudeRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, reviewRows, attestationRows, sbomRows, supplyRows, auditRows, backupRows, recoveryRows, claudeRows, authorityRows, freezeRows, boundary });
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
      release_readiness_control_plane_path: source.path,
      claude_enterprise_trust_review_receipt_path: claudeReview.path,
    },
    source_release_readiness_summary: source.data?.summary ?? null,
    observed_claude_enterprise_trust_review_summary: claudeReview.data?.summary ?? null,
    enterprise_trust_hardening_contract: buildContract(generatedAt),
    enterprise_trust_phase_rows: phaseRows,
    enterprise_source_binding_rows: sourceRows,
    independent_review_hardening_rows: reviewRows,
    attestation_hardening_rows: attestationRows,
    sbom_dependency_evidence_rows: sbomRows,
    supply_chain_policy_rows: supplyRows,
    audit_trail_hardening_rows: auditRows,
    backup_restore_posture_rows: backupRows,
    recovery_posture_rows: recoveryRows,
    claude_enterprise_trust_review_rows: claudeRows,
    enterprise_trust_authority_guard_rows: authorityRows,
    p13400_freeze_rows: freezeRows,
    enterprise_trust_boundary: boundary,
    enterprise_trust_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, reviewRows, attestationRows, sbomRows, supplyRows, auditRows, backupRows, recoveryRows, claudeRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "enterprise_trust_hardening_control_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.enterprise_trust_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.enterprise_trust_validation_items);
  result.summary = buildSummary({ boundary, reviewRows, attestationRows, sbomRows, supplyRows, auditRows, backupRows, recoveryRows, claudeRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeEnterpriseTrustHardeningControlPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "enterprise-trust-hardening-control-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "enterprise-trust-phase-rows.json"), collectionEnvelope("enterprise-trust-phase-rows.v1", "enterprise_trust_phase_rows", result.enterprise_trust_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "enterprise-source-binding-rows.json"), collectionEnvelope("enterprise-source-binding-rows.v1", "enterprise_source_binding_rows", result.enterprise_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "independent-review-hardening-rows.json"), collectionEnvelope("independent-review-hardening-rows.v1", "independent_review_hardening_rows", result.independent_review_hardening_rows, result.generated_at));
  await writeJson(path.join(outDir, "attestation-hardening-rows.json"), collectionEnvelope("attestation-hardening-rows.v1", "attestation_hardening_rows", result.attestation_hardening_rows, result.generated_at));
  await writeJson(path.join(outDir, "sbom-dependency-evidence-rows.json"), collectionEnvelope("sbom-dependency-evidence-rows.v1", "sbom_dependency_evidence_rows", result.sbom_dependency_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "supply-chain-policy-rows.json"), collectionEnvelope("supply-chain-policy-rows.v1", "supply_chain_policy_rows", result.supply_chain_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "audit-trail-hardening-rows.json"), collectionEnvelope("audit-trail-hardening-rows.v1", "audit_trail_hardening_rows", result.audit_trail_hardening_rows, result.generated_at));
  await writeJson(path.join(outDir, "backup-restore-posture-rows.json"), collectionEnvelope("backup-restore-posture-rows.v1", "backup_restore_posture_rows", result.backup_restore_posture_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-posture-rows.json"), collectionEnvelope("recovery-posture-rows.v1", "recovery_posture_rows", result.recovery_posture_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-enterprise-trust-review-rows.json"), collectionEnvelope("claude-enterprise-trust-review-rows.v1", "claude_enterprise_trust_review_rows", result.claude_enterprise_trust_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "enterprise-trust-authority-guard-rows.json"), collectionEnvelope("enterprise-trust-authority-guard-rows.v1", "enterprise_trust_authority_guard_rows", result.enterprise_trust_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p13400-freeze-rows.json"), collectionEnvelope("p13400-freeze-rows.v1", "p13400_freeze_rows", result.p13400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "enterprise-trust-boundary.json"), result.enterprise_trust_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "enterprise-trust-hardening-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.enterprise_trust_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runEnterpriseTrustHardeningControlPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runEnterpriseTrustHardeningControlPlane(args);
    console.log(`Enterprise Trust Hardening Control Plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.enterprise_trust_hardening_control_plane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P13001: ${result.summary.source_ready_for_p13001_handoff}`);
    console.log(`Claude enterprise trust review receipt: ${result.summary.claude_enterprise_trust_review_receipt_present_now}`);
    console.log(`Ready for P13401 handoff: ${result.summary.ready_for_p13401_handoff}`);
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
    contract_id: "enterprise-trust-hardening-control-plane.contract.v1",
    generated_at: generatedAt,
    source_release_readiness_required: true,
    claude_enterprise_trust_review_required: true,
    independent_review_hardening_required: true,
    attestation_hardening_required: true,
    sbom_dependency_evidence_required: true,
    supply_chain_policy_required: true,
    audit_trail_hardening_required: true,
    backup_restore_posture_required: true,
    recovery_posture_required: true,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p13001-p13400.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.release_readiness_boundary ?? {};
  const sourceStatus = summary.release_readiness_control_plane_status ?? "missing";
  const sourceReady = summary.ready_for_p13001_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P12801-P13000 source artifact available", source.available],
    ["source.range", "P12801-P13000 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P13000 source status visible", sourceStatus === "ready_for_release_readiness_control_plane" || sourceStatus === "blocked_release_readiness_control_plane"],
    ["source.handoff", "P13000 ready_for_p13001_handoff", sourceReady],
    ["source.block_visible", "P13000 blocker visible", sourceReady || sourceBlocked],
    ["source.release_contract", "P13000 release candidate and production checklist contracts available", Number(summary.release_candidate_row_count ?? 0) >= 6 && Number(summary.production_checklist_row_count ?? 0) >= 6],
    ["source.no_release_write", "P13000 source did not open release deploy write or protected action", boundary.deployment_allowed_now === false && boundary.release_approval_allowed_now === false && boundary.write_action_allowed_now === false && boundary.protected_action_allowed_now === false],
    ["source.no_final_trust", "P13000 source did not open production PASS enterprise PASS or enterprise trust", boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false && boundary.enterprise_trust_claim_allowed_now === false],
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
    evidence_ref: "docs/hermes-roadmap-p13001-p13400.md#enterprise-trust-hardening-contract",
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
    && claudeReview.data?.scope_enterprise_trust_hardening_control_plane === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_enterprise_trust_review.${reviewId}`,
    category: "claude_enterprise_trust_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p13001-p13400.md#P13321-P13360",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_enterprise_trust_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_enterprise_trust_review_receipt_present_now === true);
  return [
    ["freeze.source", "P13000 source ready for P13001", sourceReady],
    ["freeze.source_block_visible", "P13000 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.independent_review", "independent review hardening ready", allPass(context.reviewRows)],
    ["freeze.attestation", "attestation hardening ready", allPass(context.attestationRows)],
    ["freeze.sbom_dependency", "SBOM and dependency evidence ready", allPass(context.sbomRows)],
    ["freeze.supply_chain", "supply-chain policy ready", allPass(context.supplyRows)],
    ["freeze.audit_trail", "audit trail hardening ready", allPass(context.auditRows)],
    ["freeze.backup_restore", "backup and restore posture ready", allPass(context.backupRows)],
    ["freeze.recovery", "recovery posture ready", allPass(context.recoveryRows)],
    ["freeze.claude_enterprise_trust_review", "Claude enterprise trust review receipt ready", claudeReady],
    ["freeze.authority_guard", "enterprise trust authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_enterprise_trust_pass", "no enterprise trust claim production PASS enterprise PASS protected closeout or deployment opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p13400_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p13400-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeObserved = context.claudeRows.some((row) => row.claude_enterprise_trust_review_receipt_present_now === true);
  const reviewReady = allPass(context.reviewRows);
  const attestReady = allPass(context.attestationRows);
  const sbomReady = allPass(context.sbomRows);
  const supplyReady = allPass(context.supplyRows);
  const auditReady = allPass(context.auditRows);
  const backupReady = allPass(context.backupRows);
  const recoveryReady = allPass(context.recoveryRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = reviewReady && attestReady && sbomReady && supplyReady && auditReady && backupReady && recoveryReady && allPass(context.claudeRows) && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_release_readiness_available: sourceAvailable,
    source_ready_for_p13001_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    independent_review_hardening_ready: reviewReady,
    attestation_hardening_ready: attestReady,
    sbom_dependency_evidence_ready: sbomReady,
    supply_chain_policy_ready: supplyReady,
    audit_trail_hardening_ready: auditReady,
    backup_restore_posture_ready: backupReady,
    recovery_posture_ready: recoveryReady,
    claude_enterprise_trust_review_receipt_present_now: claudeObserved,
    claude_enterprise_trust_review_block_visible_now: claudeObserved === false,
    p13400_enterprise_trust_hardening_freeze_ready: freezeReady,
    ready_for_p13401_handoff: freezeReady,
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
    raw_body_exposure_allowed: false,
    secret_read_allowed_now: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P13001-P13400 phase rows incomplete", "docs/hermes-roadmap-p13001-p13400.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P13001-P13400"), "Architecture doc missing P13001-P13400 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P13000 source state must be available and blocker-visible", "enterprise_source_binding_rows");
  add("review.ready", "trust", context.reviewRows.length === REVIEW_TERMS.length && allPass(context.reviewRows), "Independent review hardening rows incomplete", "independent_review_hardening_rows");
  add("attestation.ready", "trust", context.attestationRows.length === ATTESTATION_TERMS.length && allPass(context.attestationRows), "Attestation hardening rows incomplete", "attestation_hardening_rows");
  add("sbom.ready", "trust", context.sbomRows.length === SBOM_TERMS.length && allPass(context.sbomRows), "SBOM dependency rows incomplete", "sbom_dependency_evidence_rows");
  add("supply.ready", "trust", context.supplyRows.length === SUPPLY_TERMS.length && allPass(context.supplyRows), "Supply-chain policy rows incomplete", "supply_chain_policy_rows");
  add("audit.ready", "trust", context.auditRows.length === AUDIT_TERMS.length && allPass(context.auditRows), "Audit trail rows incomplete", "audit_trail_hardening_rows");
  add("backup.ready", "trust", context.backupRows.length === BACKUP_TERMS.length && allPass(context.backupRows), "Backup restore rows incomplete", "backup_restore_posture_rows");
  add("recovery.ready", "trust", context.recoveryRows.length === RECOVERY_TERMS.length && allPass(context.recoveryRows), "Recovery posture rows incomplete", "recovery_posture_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_enterprise_trust_review_block_visible_now === true || context.boundary.claude_enterprise_trust_review_receipt_present_now === true), "Claude enterprise trust review missing without visible blocker", "claude_enterprise_trust_review_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "enterprise_trust_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P13400 freeze rows missing", "p13400_freeze_rows");
  add("boundary.no.trust.pass", "boundary", context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.protected_closeout_enabled === false, "Enterprise trust hardening opened trust/pass/protected closeout", "enterprise_trust_boundary");
  add("boundary.no.write.release", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false && context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false, "Enterprise trust hardening opened release/write/protected/runtime action", "enterprise_trust_boundary");
  add("boundary.no.secret.final", "boundary", context.boundary.secret_read_allowed_now === false && context.boundary.raw_body_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Enterprise trust hardening opened secret/raw/final approval", "enterprise_trust_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p13401_handoff === context.boundary.p13400_enterprise_trust_hardening_freeze_ready, "P13401 handoff state must match P13400 freeze state", "enterprise_trust_boundary");
  return items;
}

function buildSummary(context) {
  return {
    enterprise_trust_hardening_control_plane_status: context.boundary.ready_for_p13401_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p13001_handoff: context.boundary.source_ready_for_p13001_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    claude_enterprise_trust_review_receipt_present_now: context.boundary.claude_enterprise_trust_review_receipt_present_now,
    claude_enterprise_trust_review_block_visible_now: context.boundary.claude_enterprise_trust_review_block_visible_now,
    independent_review_hardening_row_count: context.reviewRows.length,
    attestation_hardening_row_count: context.attestationRows.length,
    sbom_dependency_evidence_row_count: context.sbomRows.length,
    supply_chain_policy_row_count: context.supplyRows.length,
    audit_trail_hardening_row_count: context.auditRows.length,
    backup_restore_posture_row_count: context.backupRows.length,
    recovery_posture_row_count: context.recoveryRows.length,
    claude_enterprise_trust_review_row_count: context.claudeRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p13400_enterprise_trust_hardening_freeze_ready: context.boundary.p13400_enterprise_trust_hardening_freeze_ready,
    ready_for_p13401_handoff: context.boundary.ready_for_p13401_handoff,
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
    "# Enterprise Trust Hardening Control Plane",
    "",
    `Status: ${result.summary.enterprise_trust_hardening_control_plane_status}`,
    `Program: ${result.program_range}`,
    `Independent review rows: ${result.summary.independent_review_hardening_row_count}`,
    `Attestation rows: ${result.summary.attestation_hardening_row_count}`,
    `SBOM/dependency rows: ${result.summary.sbom_dependency_evidence_row_count}`,
    `Source ready for P13001: ${result.summary.source_ready_for_p13001_handoff}`,
    `Claude enterprise trust review receipt present: ${result.summary.claude_enterprise_trust_review_receipt_present_now}`,
    `Ready for P13401 handoff: ${result.summary.ready_for_p13401_handoff}`,
    `Enterprise trust claim allowed: ${result.summary.enterprise_trust_claim_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.enterprise_trust_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.enterprise_trust_claim_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Enterprise Trust Hardening Control Plane</title>
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
    <h1>Hermes Enterprise Trust Hardening Control Plane</h1>
    <p class="notice">Enterprise trust hardening strengthens evidence requirements. It does not approve protected closeout, production readiness, enterprise trust, deployment, or final automated approval.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Enterprise Trust Claim</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildReleaseReadiness(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReleaseReadinessControlPlane({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.release_readiness_control_plane", built);
}

function reviewExtras() {
  return { independent_review_required: true, self_approval_allowed: false, single_owner_enterprise_trust_allowed: false };
}

function attestationExtras() {
  return { attestation_required: true, attestation_overclaimed_now: false, verification_required_before_trust: true };
}

function sbomExtras() {
  return { sbom_required: true, dependency_scan_required: true, raw_secret_exposure_allowed: false };
}

function supplyExtras() {
  return { supply_chain_policy_required: true, unpinned_dependency_allowed: false, untrusted_publisher_allowed: false };
}

function auditExtras() {
  return { audit_trail_required: true, append_only_required: true, audit_gap_visible: true };
}

function backupExtras() {
  return { backup_restore_required: true, backup_overclaimed_now: false, restore_execution_allowed_now: false };
}

function recoveryExtras() {
  return { recovery_posture_required: true, recovery_exercise_required: true, incident_auto_close_allowed: false };
}

function authorityExtras() {
  return {
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.architectureDocPath,
    source_release_readiness_path: options.sourceReleaseReadinessPath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.sourceReleaseReadinessPath,
    claude_enterprise_trust_review_receipt_path: options.claudeEnterpriseTrustReviewReceiptPath ?? DEFAULT_ENTERPRISE_TRUST_HARDENING_CONTROL_PLANE_INPUTS.claudeEnterpriseTrustReviewReceiptPath,
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
    else if (value === "--source-release-readiness-path") args.sourceReleaseReadinessPath = argv[++index];
    else if (value === "--claude-enterprise-trust-review-receipt-path") args.claudeEnterpriseTrustReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P13001-P13400 Enterprise Trust Hardening Control Plane artifacts.");
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
