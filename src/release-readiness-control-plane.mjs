import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildHumanOwnerAdjudicationOption } from "./human-owner-adjudication-option.mjs";

export const DEFAULT_RELEASE_READINESS_CONTROL_PLANE_OUT_DIR = "artifacts/release-readiness-control-plane/latest";
export const DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS = {
  schemaPath: "schemas/release-readiness-control-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p12801-p13000.md",
  architectureDocPath: "docs/architecture.md",
  sourceHumanOwnerAdjudicationPath: "artifacts/human-owner-adjudication-option/latest/human-owner-adjudication-option.json",
  signedProvenanceReceiptPath: "artifacts/release-readiness-control-plane/provenance/signed-provenance-receipt.json",
  claudeReleaseReviewReceiptPath: "artifacts/release-readiness-control-plane/review/claude-release-readiness-review-receipt.json",
};

const COMMAND_NAME = "platform:release-readiness-control-plane";
const SCHEMA_VERSION = "release-readiness-control-plane.v1";
const CAPABILITY_ID = "platform.release_readiness_control_plane";
const PROGRAM_RANGE = "P12801-P13000";
const SOURCE_PROGRAM_RANGE = "P12601-P12800";
const READY_STATUS = "ready_for_release_readiness_control_plane";
const BLOCKED_STATUS = "blocked_release_readiness_control_plane";

const PHASE_SPECS = [
  ["P12801-P12820", "P12800 Source Binding", "release_source_binding_rows"],
  ["P12821-P12840", "Release Candidate Contract", "release_candidate_contract_rows"],
  ["P12841-P12860", "Migration Readiness", "migration_readiness_rows"],
  ["P12861-P12880", "Rollback And Restore Plan", "release_rollback_restore_rows"],
  ["P12881-P12900", "Incident Response Plan", "incident_response_plan_rows"],
  ["P12901-P12920", "Production Checklist", "production_checklist_rows"],
  ["P12921-P12940", "Signed Provenance And Attestation Gate", "signed_provenance_gate_rows"],
  ["P12941-P12960", "Claude Release Review Gate", "claude_release_review_rows"],
  ["P12961-P12980", "Read-Only Release Projection", "release_operator_projection_rows"],
  ["P12981-P13000", "Release Freeze", "p13000_freeze_rows"],
];

const RELEASE_CANDIDATE_TERMS = ["candidate id", "commit ref", "scope summary", "change risk tier", "validation bundle ref", "no deploy now"];
const MIGRATION_TERMS = ["migration id", "schema diff ref", "dry-run evidence ref", "backward compatibility", "data rollback plan", "migration not executed"];
const ROLLBACK_TERMS = ["rollback plan ref", "restore point ref", "backup snapshot ref", "verification command ref", "incident owner ref", "rollback not executed"];
const INCIDENT_TERMS = ["severity matrix", "escalation owner", "communication draft", "monitoring signal ref", "recovery objective", "incident drill not executed"];
const CHECKLIST_TERMS = ["environment readiness", "required checks", "secret scan", "dependency scan", "accessibility smoke", "launch checklist remains blocked"];
const PROVENANCE_TERMS = ["provenance bundle ref", "artifact digest", "commit sha binding", "signed attestation receipt", "verification receipt", "attestation not overclaimed"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max release review receipt schema"],
  ["model_effort", "model effort"],
  ["review_scope", "review scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const OPERATOR_TERMS = ["release state", "source state", "provenance state", "review state", "blockers", "next condition"];
const AUTHORITY_TERMS = ["no deployment", "no migration execution", "no rollback execution", "no release approval", "no production PASS", "no enterprise PASS"];

export async function runReleaseReadinessControlPlane(options = {}) {
  const result = await buildReleaseReadinessControlPlane(options);
  if (options.write !== false) await writeReleaseReadinessControlPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Release Readiness Control Plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildReleaseReadinessControlPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "humanOwnerAdjudicationOption")
    ? normalizeInlineJsonSource("inline.human_owner_adjudication_option", options.humanOwnerAdjudicationOption)
    : await readJsonOrBuildHumanOwnerAdjudicationOption(inputs.source_human_owner_adjudication_path, generatedAt);
  const provenanceReceipt = Object.prototype.hasOwnProperty.call(options, "signedProvenanceReceipt")
    ? normalizeInlineJsonSource("inline.signed_provenance_receipt", options.signedProvenanceReceipt)
    : await readJsonSource(inputs.signed_provenance_receipt_path);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeReleaseReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_release_review_receipt", options.claudeReleaseReviewReceipt)
    : await readJsonSource(inputs.claude_release_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const candidateRows = buildTermRows("release_candidate_contract", "Release candidate", RELEASE_CANDIDATE_TERMS, roadmapDoc.text, "release_candidate_contract_rows", generatedAt, candidateExtras);
  const migrationRows = buildTermRows("migration_readiness", "Migration readiness", MIGRATION_TERMS, roadmapDoc.text, "migration_readiness_rows", generatedAt, migrationExtras);
  const rollbackRows = buildTermRows("release_rollback_restore", "Rollback and restore", ROLLBACK_TERMS, roadmapDoc.text, "release_rollback_restore_rows", generatedAt, rollbackExtras);
  const incidentRows = buildTermRows("incident_response_plan", "Incident response", INCIDENT_TERMS, roadmapDoc.text, "incident_response_plan_rows", generatedAt, incidentExtras);
  const checklistRows = buildTermRows("production_checklist", "Production checklist", CHECKLIST_TERMS, roadmapDoc.text, "production_checklist_rows", generatedAt, checklistExtras);
  const provenanceRows = buildProvenanceRows(roadmapDoc.text, provenanceReceipt, generatedAt);
  const claudeReviewRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const operatorRows = buildTermRows("release_operator_projection", "Release operator projection", OPERATOR_TERMS, roadmapDoc.text, "release_operator_projection_rows", generatedAt, operatorExtras);
  const authorityRows = buildTermRows("release_authority_guard", "Release authority guard", AUTHORITY_TERMS, roadmapDoc.text, "release_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, candidateRows, migrationRows, rollbackRows, incidentRows, checklistRows, provenanceRows, claudeReviewRows, operatorRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, candidateRows, migrationRows, rollbackRows, incidentRows, checklistRows, provenanceRows, claudeReviewRows, operatorRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, candidateRows, migrationRows, rollbackRows, incidentRows, checklistRows, provenanceRows, claudeReviewRows, operatorRows, authorityRows, freezeRows, boundary });
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
      human_owner_adjudication_option_path: source.path,
      signed_provenance_receipt_path: provenanceReceipt.path,
      claude_release_review_receipt_path: claudeReview.path,
    },
    source_human_owner_adjudication_summary: source.data?.summary ?? null,
    observed_signed_provenance_summary: provenanceReceipt.data?.summary ?? null,
    observed_claude_release_review_summary: claudeReview.data?.summary ?? null,
    release_readiness_contract: contract,
    release_phase_rows: phaseRows,
    release_source_binding_rows: sourceRows,
    release_candidate_contract_rows: candidateRows,
    migration_readiness_rows: migrationRows,
    release_rollback_restore_rows: rollbackRows,
    incident_response_plan_rows: incidentRows,
    production_checklist_rows: checklistRows,
    signed_provenance_gate_rows: provenanceRows,
    claude_release_review_rows: claudeReviewRows,
    release_operator_projection_rows: operatorRows,
    release_authority_guard_rows: authorityRows,
    p13000_freeze_rows: freezeRows,
    release_readiness_boundary: boundary,
    release_readiness_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, candidateRows, migrationRows, rollbackRows, incidentRows, checklistRows, provenanceRows, claudeReviewRows, operatorRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "release_readiness_control_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.release_readiness_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.release_readiness_validation_items);
  result.summary = buildSummary({ boundary, candidateRows, migrationRows, rollbackRows, incidentRows, checklistRows, provenanceRows, claudeReviewRows, operatorRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReleaseReadinessControlPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "release-readiness-control-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-phase-rows.json"), collectionEnvelope("release-phase-rows.v1", "release_phase_rows", result.release_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-source-binding-rows.json"), collectionEnvelope("release-source-binding-rows.v1", "release_source_binding_rows", result.release_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-contract-rows.json"), collectionEnvelope("release-candidate-contract-rows.v1", "release_candidate_contract_rows", result.release_candidate_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "migration-readiness-rows.json"), collectionEnvelope("migration-readiness-rows.v1", "migration_readiness_rows", result.migration_readiness_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-rollback-restore-rows.json"), collectionEnvelope("release-rollback-restore-rows.v1", "release_rollback_restore_rows", result.release_rollback_restore_rows, result.generated_at));
  await writeJson(path.join(outDir, "incident-response-plan-rows.json"), collectionEnvelope("incident-response-plan-rows.v1", "incident_response_plan_rows", result.incident_response_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "production-checklist-rows.json"), collectionEnvelope("production-checklist-rows.v1", "production_checklist_rows", result.production_checklist_rows, result.generated_at));
  await writeJson(path.join(outDir, "signed-provenance-gate-rows.json"), collectionEnvelope("signed-provenance-gate-rows.v1", "signed_provenance_gate_rows", result.signed_provenance_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-release-review-rows.json"), collectionEnvelope("claude-release-review-rows.v1", "claude_release_review_rows", result.claude_release_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-operator-projection-rows.json"), collectionEnvelope("release-operator-projection-rows.v1", "release_operator_projection_rows", result.release_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-authority-guard-rows.json"), collectionEnvelope("release-authority-guard-rows.v1", "release_authority_guard_rows", result.release_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p13000-freeze-rows.json"), collectionEnvelope("p13000-freeze-rows.v1", "p13000_freeze_rows", result.p13000_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-readiness-boundary.json"), result.release_readiness_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "release-readiness-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.release_readiness_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReleaseReadinessControlPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runReleaseReadinessControlPlane(args);
    console.log(`Release Readiness Control Plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.release_readiness_control_plane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P12801: ${result.summary.source_ready_for_p12801_handoff}`);
    console.log(`Signed provenance receipt: ${result.summary.signed_provenance_receipt_present_now}`);
    console.log(`Claude release review receipt: ${result.summary.claude_release_review_receipt_present_now}`);
    console.log(`Ready for P13001 handoff: ${result.summary.ready_for_p13001_handoff}`);
    console.log(`Deployment allowed: ${result.summary.deployment_allowed_now}`);
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
    contract_id: "release-readiness-control-plane.contract.v1",
    generated_at: generatedAt,
    source_human_owner_adjudication_required: true,
    signed_provenance_receipt_required: true,
    claude_release_review_required: true,
    release_candidate_contract_required: true,
    migration_readiness_required: true,
    rollback_restore_plan_required: true,
    incident_response_plan_required: true,
    production_checklist_required: true,
    operator_projection_read_only: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
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
    evidence_ref: `docs/hermes-roadmap-p12801-p13000.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.human_owner_adjudication_boundary ?? {};
  const sourceStatus = summary.human_owner_adjudication_option_status ?? "missing";
  const sourceReady = summary.ready_for_p12801_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P12601-P12800 source artifact available", source.available],
    ["source.range", "P12601-P12800 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P12800 source status visible", sourceStatus === "ready_for_human_owner_adjudication_option" || sourceStatus === "blocked_human_owner_adjudication_option"],
    ["source.handoff", "P12800 ready_for_p12801_handoff", sourceReady],
    ["source.block_visible", "P12800 blocker visible", sourceReady || sourceBlocked],
    ["source.adjudication_contract", "P12800 owner adjudication and review separation contracts available", Number(summary.owner_adjudication_receipt_row_count ?? 0) >= 7 && Number(summary.independent_review_separation_row_count ?? 0) >= 6],
    ["source.no_write_release", "P12800 source did not open write release or protected action", boundary.write_action_allowed_now === false && boundary.protected_action_allowed_now === false && boundary.connector_write_enabled === false && boundary.runtime_execution_allowed_now === false],
    ["source.no_final_trust", "P12800 source did not open final approval production PASS or enterprise PASS", boundary.final_approval_ui_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false],
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
    evidence_ref: "docs/hermes-roadmap-p12801-p13000.md#release-readiness-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildProvenanceRows(roadmapText, provenanceReceipt, generatedAt) {
  const provenanceObserved = provenanceReceipt.available === true
    && provenanceReceipt.data?.schema_version === "release-signed-provenance-receipt.v1"
    && provenanceReceipt.data?.receipt_status === "observed"
    && provenanceReceipt.data?.signed_provenance_bundle_present_now === true
    && provenanceReceipt.data?.artifact_digest_bound_now === true
    && provenanceReceipt.data?.commit_sha_bound_now === true
    && provenanceReceipt.data?.attestation_verification_passed_now === true
    && provenanceReceipt.data?.raw_payload_inlined === false;
  return PROVENANCE_TERMS.map((term) => verdictRow({
    row_id: `signed_provenance.${slug(term)}`,
    category: "signed_provenance_gate",
    label: `Signed provenance gate: ${term}`,
    required: true,
    observed: includesText(roadmapText, term),
    evidence_ref: provenanceObserved ? provenanceReceipt.path : "docs/hermes-roadmap-p12801-p13000.md#P12921-P12940",
    generated_at: generatedAt,
    term_id: slug(term),
    signed_provenance_receipt_present_now: provenanceObserved,
    attestation_verification_passed_now: provenanceObserved,
    attestation_overclaimed_now: false,
    raw_payload_inlined: false,
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = claudeReview.available === true
    && claudeReview.data?.review_engine === "claude_code_opus_max"
    && claudeReview.data?.receipt_status === "complete"
    && claudeReview.data?.scope_release_readiness_control_plane === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_release_review.${reviewId}`,
    category: "claude_release_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p12801-p13000.md#P12941-P12960",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_release_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const provenanceReady = context.provenanceRows.some((row) => row.signed_provenance_receipt_present_now === true && row.attestation_verification_passed_now === true);
  const claudeReady = context.claudeReviewRows.some((row) => row.claude_release_review_receipt_present_now === true);
  return [
    ["freeze.source", "P12800 source ready for P12801", sourceReady],
    ["freeze.source_block_visible", "P12800 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.release_candidate", "release candidate contract ready", allPass(context.candidateRows)],
    ["freeze.migration", "migration readiness ready", allPass(context.migrationRows)],
    ["freeze.rollback_restore", "rollback and restore plan ready", allPass(context.rollbackRows)],
    ["freeze.incident", "incident response plan ready", allPass(context.incidentRows)],
    ["freeze.production_checklist", "production checklist ready", allPass(context.checklistRows)],
    ["freeze.signed_provenance", "signed provenance and attestation verification ready", provenanceReady],
    ["freeze.claude_release_review", "Claude release readiness review receipt ready", claudeReady],
    ["freeze.operator_projection", "read-only release operator/API projection ready", allPass(context.operatorRows)],
    ["freeze.authority_guard", "release authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_release_trust", "no deployment release approval production PASS or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p13000_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p13000-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const provenanceObserved = context.provenanceRows.some((row) => row.signed_provenance_receipt_present_now === true && row.attestation_verification_passed_now === true);
  const claudeObserved = context.claudeReviewRows.some((row) => row.claude_release_review_receipt_present_now === true);
  const candidateReady = allPass(context.candidateRows);
  const migrationReady = allPass(context.migrationRows);
  const rollbackReady = allPass(context.rollbackRows);
  const incidentReady = allPass(context.incidentRows);
  const checklistReady = allPass(context.checklistRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = candidateReady
    && migrationReady
    && rollbackReady
    && incidentReady
    && checklistReady
    && allPass(context.provenanceRows)
    && allPass(context.claudeReviewRows)
    && allPass(context.operatorRows)
    && authorityReady;
  const freezeReady = sourceReady && provenanceObserved && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_human_owner_adjudication_available: sourceAvailable,
    source_ready_for_p12801_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    signed_provenance_receipt_present_now: provenanceObserved,
    signed_provenance_block_visible_now: provenanceObserved === false,
    attestation_verification_passed_now: provenanceObserved,
    claude_release_review_receipt_present_now: claudeObserved,
    claude_release_review_block_visible_now: claudeObserved === false,
    release_candidate_contract_ready: candidateReady,
    migration_readiness_ready: migrationReady,
    rollback_restore_plan_ready: rollbackReady,
    incident_response_plan_ready: incidentReady,
    production_checklist_ready: checklistReady,
    release_authority_guard_ready: authorityReady,
    p13000_release_readiness_freeze_ready: freezeReady,
    ready_for_p13001_handoff: freezeReady,
    deployment_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    release_approval_allowed_now: false,
    protected_action_allowed_now: false,
    write_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    raw_body_exposure_allowed: false,
    secret_read_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P12801-P13000 phase rows incomplete", "docs/hermes-roadmap-p12801-p13000.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P12801-P13000"), "Architecture doc missing P12801-P13000 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P12800 source state must be available and blocker-visible", "release_source_binding_rows");
  add("candidate.ready", "release_candidate", context.candidateRows.length === RELEASE_CANDIDATE_TERMS.length && allPass(context.candidateRows), "Release candidate rows incomplete", "release_candidate_contract_rows");
  add("migration.ready", "migration", context.migrationRows.length === MIGRATION_TERMS.length && allPass(context.migrationRows), "Migration rows incomplete", "migration_readiness_rows");
  add("rollback.ready", "rollback", context.rollbackRows.length === ROLLBACK_TERMS.length && allPass(context.rollbackRows), "Rollback restore rows incomplete", "release_rollback_restore_rows");
  add("incident.ready", "incident", context.incidentRows.length === INCIDENT_TERMS.length && allPass(context.incidentRows), "Incident response rows incomplete", "incident_response_plan_rows");
  add("checklist.ready", "checklist", context.checklistRows.length === CHECKLIST_TERMS.length && allPass(context.checklistRows), "Production checklist rows incomplete", "production_checklist_rows");
  add("provenance.block_visible", "provenance", context.provenanceRows.length === PROVENANCE_TERMS.length && (context.boundary.signed_provenance_block_visible_now === true || context.boundary.signed_provenance_receipt_present_now === true), "Signed provenance missing without visible blocker", "signed_provenance_gate_rows");
  add("claude_release_review.block_visible", "review", context.claudeReviewRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_release_review_block_visible_now === true || context.boundary.claude_release_review_receipt_present_now === true), "Claude release review missing without visible blocker", "claude_release_review_rows");
  add("operator.ready", "projection", context.operatorRows.length === OPERATOR_TERMS.length && allPass(context.operatorRows), "Operator projection rows incomplete", "release_operator_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "release_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P13000 freeze rows missing", "p13000_freeze_rows");
  add("boundary.no.release.action", "boundary", context.boundary.deployment_allowed_now === false && context.boundary.migration_execution_allowed_now === false && context.boundary.rollback_execution_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Release readiness opened release/deploy/migration/rollback approval", "release_readiness_boundary");
  add("boundary.no.write", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false, "Release readiness opened write/protected/connector/runtime action", "release_readiness_boundary");
  add("boundary.no.secret.final.trust", "boundary", context.boundary.secret_read_allowed_now === false && context.boundary.raw_body_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false, "Release readiness opened secret/raw/final/trust boundary", "release_readiness_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p13001_handoff === context.boundary.p13000_release_readiness_freeze_ready, "P13001 handoff state must match P13000 freeze state", "release_readiness_boundary");
  return items;
}

function buildSummary(context) {
  return {
    release_readiness_control_plane_status: context.boundary.ready_for_p13001_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p12801_handoff: context.boundary.source_ready_for_p12801_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    signed_provenance_receipt_present_now: context.boundary.signed_provenance_receipt_present_now,
    signed_provenance_block_visible_now: context.boundary.signed_provenance_block_visible_now,
    attestation_verification_passed_now: context.boundary.attestation_verification_passed_now,
    claude_release_review_receipt_present_now: context.boundary.claude_release_review_receipt_present_now,
    claude_release_review_block_visible_now: context.boundary.claude_release_review_block_visible_now,
    release_candidate_row_count: context.candidateRows.length,
    migration_readiness_row_count: context.migrationRows.length,
    rollback_restore_row_count: context.rollbackRows.length,
    incident_response_row_count: context.incidentRows.length,
    production_checklist_row_count: context.checklistRows.length,
    signed_provenance_row_count: context.provenanceRows.length,
    claude_release_review_row_count: context.claudeReviewRows.length,
    operator_projection_row_count: context.operatorRows.length,
    authority_guard_row_count: context.authorityRows.length,
    p13000_release_readiness_freeze_ready: context.boundary.p13000_release_readiness_freeze_ready,
    ready_for_p13001_handoff: context.boundary.ready_for_p13001_handoff,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Release Readiness Control Plane",
    "",
    `Status: ${result.summary.release_readiness_control_plane_status}`,
    `Program: ${result.program_range}`,
    `Release candidate rows: ${result.summary.release_candidate_row_count}`,
    `Production checklist rows: ${result.summary.production_checklist_row_count}`,
    `Source ready for P12801: ${result.summary.source_ready_for_p12801_handoff}`,
    `Signed provenance receipt present: ${result.summary.signed_provenance_receipt_present_now}`,
    `Claude release review receipt present: ${result.summary.claude_release_review_receipt_present_now}`,
    `Ready for P13001 handoff: ${result.summary.ready_for_p13001_handoff}`,
    `Deployment allowed: ${result.summary.deployment_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.release_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.deployment_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Release Readiness Control Plane</title>
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
    <h1>Hermes Release Readiness Control Plane</h1>
    <p class="notice">Release readiness shows candidate, provenance, review, and blocker state. It does not approve deployment, migration execution, production readiness, or enterprise trust.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Deployment</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildHumanOwnerAdjudicationOption(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildHumanOwnerAdjudicationOption({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.human_owner_adjudication_option", built);
}

function candidateExtras() {
  return {
    release_candidate_contract_required: true,
    deploy_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
  };
}

function migrationExtras() {
  return {
    migration_readiness_required: true,
    migration_execution_allowed_now: false,
    dry_run_only: true,
    data_write_allowed_now: false,
  };
}

function rollbackExtras() {
  return {
    rollback_restore_plan_required: true,
    rollback_execution_allowed_now: false,
    restore_execution_allowed_now: false,
    backup_snapshot_required: true,
  };
}

function incidentExtras() {
  return {
    incident_response_plan_required: true,
    incident_drill_executed_now: false,
    customer_notification_sent_now: false,
    recovery_objective_required: true,
  };
}

function checklistExtras() {
  return {
    production_checklist_required: true,
    launch_checklist_remains_blocked: true,
    production_pass_enabled: false,
    release_approval_allowed_now: false,
  };
}

function operatorExtras() {
  return {
    api_methods_allowed: ["GET", "HEAD"],
    mutation_method_allowed_now: false,
    deploy_button_enabled: false,
    final_approval_ui_enabled: false,
  };
}

function authorityExtras() {
  return {
    deployment_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.architectureDocPath,
    source_human_owner_adjudication_path: options.sourceHumanOwnerAdjudicationPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.sourceHumanOwnerAdjudicationPath,
    signed_provenance_receipt_path: options.signedProvenanceReceiptPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.signedProvenanceReceiptPath,
    claude_release_review_receipt_path: options.claudeReleaseReviewReceiptPath ?? DEFAULT_RELEASE_READINESS_CONTROL_PLANE_INPUTS.claudeReleaseReviewReceiptPath,
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
    else if (value === "--source-human-owner-adjudication-path") args.sourceHumanOwnerAdjudicationPath = argv[++index];
    else if (value === "--signed-provenance-receipt-path") args.signedProvenanceReceiptPath = argv[++index];
    else if (value === "--claude-release-review-receipt-path") args.claudeReleaseReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P12801-P13000 Release Readiness Control Plane artifacts.");
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
