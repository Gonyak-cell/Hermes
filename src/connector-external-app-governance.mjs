import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildSaasFactoryMode } from "./saas-factory-mode.mjs";

export const DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_OUT_DIR = "artifacts/connector-external-app-governance/latest";
export const DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS = {
  schemaPath: "schemas/connector-external-app-governance.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p15401-p15800.md",
  architectureDocPath: "docs/architecture.md",
  sourceSaasFactoryPath: "artifacts/saas-factory-mode/latest/saas-factory-mode.json",
  claudeConnectorGovernanceReviewReceiptPath: "artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json",
};

const COMMAND_NAME = "platform:connector-external-app-governance";
const SCHEMA_VERSION = "connector-external-app-governance.v1";
const CAPABILITY_ID = "platform.connector_external_app_governance";
const PROGRAM_RANGE = "P15401-P15800";
const SOURCE_PROGRAM_RANGE = "P15001-P15400";
const READY_STATUS = "ready_for_connector_external_app_governance";
const BLOCKED_STATUS = "blocked_connector_external_app_governance";

const PHASE_SPECS = [
  ["P15401-P15440", "P15400 Source Binding", "connector_governance_source_binding_rows"],
  ["P15441-P15480", "External App Registry Contract", "external_app_registry_rows"],
  ["P15481-P15520", "Connector Capability Matrix", "connector_capability_matrix_rows"],
  ["P15521-P15560", "Consent/Auth Receipt Contract", "consent_auth_receipt_rows"],
  ["P15561-P15600", "Ingestion Quarantine Contract", "ingestion_quarantine_rows"],
  ["P15601-P15640", "External App Evidence Mapping", "external_app_evidence_mapping_rows"],
  ["P15641-P15680", "Cross-App Boundary Guard", "cross_app_boundary_guard_rows"],
  ["P15681-P15720", "Claude Connector Governance Review Gate", "claude_connector_governance_review_rows"],
  ["P15721-P15760", "Connector Read-Only Projection", "connector_read_only_projection_rows"],
  ["P15761-P15800", "Connector Governance Freeze", "p15800_freeze_rows"],
];

const EXTERNAL_APP_TERMS = ["app id", "app class", "owner project", "auth mode", "data boundary", "app blocker"];
const CONNECTOR_CAPABILITY_TERMS = ["connector id", "read scope", "write scope denied", "raw export policy", "secret handle ref", "capability blocker"];
const CONSENT_AUTH_TERMS = ["consent receipt id", "auth proof ref", "secret handle boundary", "expiry revocation", "scope diff", "missing receipt blocker"];
const QUARANTINE_TERMS = ["source classification", "quarantine queue", "redaction policy", "prompt injection scan", "schema normalization", "quarantine blocker"];
const EVIDENCE_TERMS = ["source evidence ref", "connector run ref", "provenance hash", "freshness window", "access log ref", "evidence blocker"];
const BOUNDARY_TERMS = ["tenant boundary", "project boundary", "domain pack boundary", "client/matter boundary", "no cross-app join", "boundary blocker"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max connector governance review receipt schema"],
  ["model_effort", "model effort"],
  ["connector_scope", "connector scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const PROJECTION_TERMS = ["read-only external app registry API row", "dashboard row", "connector preview", "quarantine rollup", "access scope rollup", "no connector execution"];
const AUTHORITY_TERMS = [
  "no connector connection",
  "no credential lookup",
  "no secret read",
  "no raw export",
  "no ingestion start",
  "no connector write",
  "no external service mutation",
  "no final automated approval",
];
const HEX_64 = /^[a-f0-9]{64}$/i;
const GIT_SHA = /^[a-f0-9]{7,64}$/i;
const LABEL_ONLY_ENGINE_IDS = new Set([
  "claude",
  "claude_code",
  "claude_code_opus_max",
  "opus",
  "opus_max",
  "fable",
  "fable_5",
]);
const UNSAFE_RECEIPT_AUTHORITY_FIELDS = [
  "project_creation_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "command_execution_allowed_now",
  "api_write_methods_allowed_now",
  "store_mutation_allowed_now",
  "codex_final_approval_allowed",
  "claude_final_approval_allowed",
  "fable_final_approval_allowed",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "final_approval_allowed",
  "final_approval_ui_enabled",
];

export async function runConnectorExternalAppGovernance(options = {}) {
  const result = await buildConnectorExternalAppGovernance(options);
  if (options.write !== false) await writeConnectorExternalAppGovernance(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Connector And External App Governance failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConnectorExternalAppGovernance(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "saasFactoryMode")
    ? normalizeInlineJsonSource("inline.saas_factory_mode", options.saasFactoryMode)
    : await readJsonOrBuildSaasFactory(inputs.source_saas_factory_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeConnectorGovernanceReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_connector_governance_review_receipt", options.claudeConnectorGovernanceReviewReceipt)
    : await readJsonSource(inputs.claude_connector_governance_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const appRows = buildTermRows("external_app_registry", "External app registry", EXTERNAL_APP_TERMS, roadmapDoc.text, "external_app_registry_rows", generatedAt, appExtras);
  const capabilityRows = buildTermRows("connector_capability_matrix", "Connector capability", CONNECTOR_CAPABILITY_TERMS, roadmapDoc.text, "connector_capability_matrix_rows", generatedAt, capabilityExtras);
  const consentRows = buildTermRows("consent_auth_receipt", "Consent auth receipt", CONSENT_AUTH_TERMS, roadmapDoc.text, "consent_auth_receipt_rows", generatedAt, consentExtras);
  const quarantineRows = buildTermRows("ingestion_quarantine", "Ingestion quarantine", QUARANTINE_TERMS, roadmapDoc.text, "ingestion_quarantine_rows", generatedAt, quarantineExtras);
  const evidenceRows = buildTermRows("external_app_evidence_mapping", "External app evidence", EVIDENCE_TERMS, roadmapDoc.text, "external_app_evidence_mapping_rows", generatedAt, evidenceExtras);
  const boundaryRows = buildTermRows("cross_app_boundary_guard", "Cross-app boundary", BOUNDARY_TERMS, roadmapDoc.text, "cross_app_boundary_guard_rows", generatedAt, boundaryExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const projectionRows = buildTermRows("connector_read_only_projection", "Connector projection", PROJECTION_TERMS, roadmapDoc.text, "connector_read_only_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("connector_authority_guard", "Connector authority guard", AUTHORITY_TERMS, roadmapDoc.text, "connector_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, appRows, capabilityRows, consentRows, quarantineRows, evidenceRows, boundaryRows, claudeRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, appRows, capabilityRows, consentRows, quarantineRows, evidenceRows, boundaryRows, claudeRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, appRows, capabilityRows, consentRows, quarantineRows, evidenceRows, boundaryRows, claudeRows, projectionRows, authorityRows, freezeRows, boundary });
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
      saas_factory_mode_path: source.path,
      claude_connector_governance_review_receipt_path: claudeReview.path,
    },
    source_saas_factory_summary: source.data?.summary ?? null,
    observed_claude_connector_governance_review_summary: claudeReview.data?.summary ?? null,
    connector_governance_contract: buildContract(generatedAt),
    connector_governance_phase_rows: phaseRows,
    connector_governance_source_binding_rows: sourceRows,
    external_app_registry_rows: appRows,
    connector_capability_matrix_rows: capabilityRows,
    consent_auth_receipt_rows: consentRows,
    ingestion_quarantine_rows: quarantineRows,
    external_app_evidence_mapping_rows: evidenceRows,
    cross_app_boundary_guard_rows: boundaryRows,
    claude_connector_governance_review_rows: claudeRows,
    connector_read_only_projection_rows: projectionRows,
    connector_authority_guard_rows: authorityRows,
    p15800_freeze_rows: freezeRows,
    connector_governance_boundary: boundary,
    connector_governance_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, appRows, capabilityRows, consentRows, quarantineRows, evidenceRows, boundaryRows, claudeRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "connector_external_app_governance")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.connector_governance_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.connector_governance_validation_items);
  result.summary = buildSummary({ boundary, appRows, capabilityRows, consentRows, quarantineRows, evidenceRows, boundaryRows, claudeRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeConnectorExternalAppGovernance(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "connector-external-app-governance.json"), serializableResult(result));
  await writeJson(path.join(outDir, "connector-governance-phase-rows.json"), collectionEnvelope("connector-governance-phase-rows.v1", "connector_governance_phase_rows", result.connector_governance_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-governance-source-binding-rows.json"), collectionEnvelope("connector-governance-source-binding-rows.v1", "connector_governance_source_binding_rows", result.connector_governance_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "external-app-registry-rows.json"), collectionEnvelope("external-app-registry-rows.v1", "external_app_registry_rows", result.external_app_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-capability-matrix-rows.json"), collectionEnvelope("connector-capability-matrix-rows.v1", "connector_capability_matrix_rows", result.connector_capability_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "consent-auth-receipt-rows.json"), collectionEnvelope("consent-auth-receipt-rows.v1", "consent_auth_receipt_rows", result.consent_auth_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-quarantine-rows.json"), collectionEnvelope("ingestion-quarantine-rows.v1", "ingestion_quarantine_rows", result.ingestion_quarantine_rows, result.generated_at));
  await writeJson(path.join(outDir, "external-app-evidence-mapping-rows.json"), collectionEnvelope("external-app-evidence-mapping-rows.v1", "external_app_evidence_mapping_rows", result.external_app_evidence_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-app-boundary-guard-rows.json"), collectionEnvelope("cross-app-boundary-guard-rows.v1", "cross_app_boundary_guard_rows", result.cross_app_boundary_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-connector-governance-review-rows.json"), collectionEnvelope("claude-connector-governance-review-rows.v1", "claude_connector_governance_review_rows", result.claude_connector_governance_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-read-only-projection-rows.json"), collectionEnvelope("connector-read-only-projection-rows.v1", "connector_read_only_projection_rows", result.connector_read_only_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-authority-guard-rows.json"), collectionEnvelope("connector-authority-guard-rows.v1", "connector_authority_guard_rows", result.connector_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p15800-freeze-rows.json"), collectionEnvelope("p15800-freeze-rows.v1", "p15800_freeze_rows", result.p15800_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "connector-governance-boundary.json"), result.connector_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "connector-governance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.connector_governance_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runConnectorExternalAppGovernanceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runConnectorExternalAppGovernance(args);
    console.log(`Connector And External App Governance ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.connector_external_app_governance_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P15401: ${result.summary.source_ready_for_p15401_handoff}`);
    console.log(`Claude connector governance review receipt: ${result.summary.claude_connector_governance_review_receipt_present_now}`);
    console.log(`Ready for P15801 handoff: ${result.summary.ready_for_p15801_handoff}`);
    console.log(`External app connection allowed: ${result.summary.external_app_connection_allowed_now}`);
    console.log(`Connector write enabled: ${result.summary.connector_write_enabled}`);
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
    contract_id: "connector-external-app-governance.contract.v1",
    generated_at: generatedAt,
    source_saas_factory_required: true,
    external_app_registry_required: true,
    connector_capability_matrix_required: true,
    consent_auth_receipt_required: true,
    ingestion_quarantine_required: true,
    external_app_evidence_mapping_required: true,
    cross_app_boundary_guard_required: true,
    claude_connector_governance_review_required: true,
    read_only_connector_projection_required: true,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p15401-p15800.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.saas_factory_boundary ?? {};
  const sourceStatus = summary.saas_factory_mode_status ?? "missing";
  const sourceReady = summary.ready_for_p15401_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P15001-P15400 source artifact available", source.available],
    ["source.range", "P15001-P15400 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P15400 source status visible", sourceStatus === "ready_for_saas_factory_mode" || sourceStatus === "blocked_saas_factory_mode"],
    ["source.handoff", "P15400 ready_for_p15401_handoff", sourceReady],
    ["source.block_visible", "P15400 blocker visible", sourceReady || sourceBlocked],
    ["source.factory_rows", "P15400 template requirement validation review domain release projection rows available", Number(summary.project_template_contract_row_count ?? 0) >= 6 && Number(summary.requirement_matrix_contract_row_count ?? 0) >= 6 && Number(summary.validation_plan_contract_row_count ?? 0) >= 6 && Number(summary.review_lane_contract_row_count ?? 0) >= 6 && Number(summary.domain_pack_composition_row_count ?? 0) >= 6 && Number(summary.release_gate_blueprint_row_count ?? 0) >= 6 && Number(summary.bootstrap_projection_row_count ?? 0) >= 6],
    ["source.no_factory_side_effects", "P15400 source did not open project creation repo write secret generation connector provisioning or deployment", boundary.project_creation_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.secret_generation_allowed_now === false && boundary.connector_provisioning_allowed_now === false && boundary.deployment_allowed_now === false],
    ["source.no_trust_write_final", "P15400 source did not open trust production protected closeout release write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.protected_closeout_enabled === false && boundary.release_approval_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
    ["source.no_connector_raw", "P15400 source did not open connector write or raw source exposure", boundary.connector_write_enabled === false && boundary.raw_source_exposure_allowed === false],
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
    evidence_ref: "docs/hermes-roadmap-p15401-p15800.md#connector-and-external-app-governance-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = isObservedConnectorGovernanceReviewReceipt(claudeReview);
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_connector_governance_review.${reviewId}`,
    category: "claude_connector_governance_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p15401-p15800.md#P15681-P15720",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_connector_governance_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function isObservedConnectorGovernanceReviewReceipt(claudeReview) {
  const data = claudeReview.data ?? {};
  const unresolvedFindingCount = Number(data.unresolved_finding_count);
  return claudeReview.available === true
    && data.review_engine === "claude_code_opus_max"
    && data.receipt_status === "complete"
    && data.scope_connector_external_app_governance === true
    && data.scope_id === "connector_external_app_governance"
    && Number.isFinite(unresolvedFindingCount)
    && unresolvedFindingCount === 0
    && typeof data.reviewed_commit_sha === "string"
    && GIT_SHA.test(data.reviewed_commit_sha)
    && typeof data.prompt_sha256 === "string"
    && HEX_64.test(data.prompt_sha256)
    && typeof data.raw_output_sha256 === "string"
    && HEX_64.test(data.raw_output_sha256)
    && isResolvedModelIdAcceptable(data.engine_resolved_model_id)
    && countUnsafeReceiptAuthorityFields(data) === 0;
}

function isResolvedModelIdAcceptable(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const normalized = value.trim().toLowerCase();
  return !LABEL_ONLY_ENGINE_IDS.has(normalized) && !normalized.includes("fable");
}

function countUnsafeReceiptAuthorityFields(data) {
  return UNSAFE_RECEIPT_AUTHORITY_FIELDS.filter((field) => data?.[field] === true).length;
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_connector_governance_review_receipt_present_now === true);
  return [
    ["freeze.source", "P15400 source ready for P15401", sourceReady],
    ["freeze.source_block_visible", "P15400 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.external_app_registry", "external app registry ready", allPass(context.appRows)],
    ["freeze.connector_capability", "connector capability matrix ready", allPass(context.capabilityRows)],
    ["freeze.consent_auth", "consent/auth receipt contract ready", allPass(context.consentRows)],
    ["freeze.ingestion_quarantine", "ingestion quarantine contract ready", allPass(context.quarantineRows)],
    ["freeze.external_app_evidence", "external app evidence mapping ready", allPass(context.evidenceRows)],
    ["freeze.cross_app_boundary", "cross-app boundary guard ready", allPass(context.boundaryRows)],
    ["freeze.claude_connector_governance_review", "Claude connector governance review receipt ready", claudeReady],
    ["freeze.projection", "connector read-only projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "connector authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_connector_side_effects", "no connector connection credential lookup secret read raw export ingestion start connector write mutation or final approval opened", true],
    ["freeze.no_release_trust_write", "no production PASS enterprise trust protected closeout release write runtime or raw source exposure opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p15800_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p15800-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceAvailable = context.source.available === true;
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const appReady = allPass(context.appRows);
  const capabilityReady = allPass(context.capabilityRows);
  const consentReady = allPass(context.consentRows);
  const quarantineReady = allPass(context.quarantineRows);
  const evidenceReady = allPass(context.evidenceRows);
  const crossBoundaryReady = allPass(context.boundaryRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_connector_governance_review_receipt_present_now === true);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = appReady && capabilityReady && consentReady && quarantineReady && evidenceReady && crossBoundaryReady && allPass(context.claudeRows) && projectionReady && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_saas_factory_available: sourceAvailable,
    source_ready_for_p15401_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    external_app_registry_ready: appReady,
    connector_capability_matrix_ready: capabilityReady,
    consent_auth_receipt_ready: consentReady,
    ingestion_quarantine_ready: quarantineReady,
    external_app_evidence_mapping_ready: evidenceReady,
    cross_app_boundary_guard_ready: crossBoundaryReady,
    claude_connector_governance_review_receipt_present_now: claudeObserved,
    claude_connector_governance_review_block_visible_now: claudeObserved === false,
    connector_read_only_projection_ready: projectionReady,
    connector_authority_guard_ready: authorityReady,
    p15800_connector_governance_freeze_ready: freezeReady,
    ready_for_p15801_handoff: freezeReady,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    raw_source_exposure_allowed: false,
    ingestion_start_allowed_now: false,
    connector_provisioning_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    cross_app_data_join_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P15401-P15800 phase rows incomplete", "docs/hermes-roadmap-p15401-p15800.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P15401-P15800"), "Architecture doc missing P15401-P15800 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 9 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P15400 source state must be available and blocker-visible", "connector_governance_source_binding_rows");
  add("app.ready", "external_app", context.appRows.length === EXTERNAL_APP_TERMS.length && allPass(context.appRows), "External app registry rows incomplete", "external_app_registry_rows");
  add("capability.ready", "connector", context.capabilityRows.length === CONNECTOR_CAPABILITY_TERMS.length && allPass(context.capabilityRows), "Connector capability matrix rows incomplete", "connector_capability_matrix_rows");
  add("consent.ready", "receipt", context.consentRows.length === CONSENT_AUTH_TERMS.length && allPass(context.consentRows), "Consent auth receipt rows incomplete", "consent_auth_receipt_rows");
  add("quarantine.ready", "quarantine", context.quarantineRows.length === QUARANTINE_TERMS.length && allPass(context.quarantineRows), "Ingestion quarantine rows incomplete", "ingestion_quarantine_rows");
  add("evidence.ready", "evidence", context.evidenceRows.length === EVIDENCE_TERMS.length && allPass(context.evidenceRows), "External app evidence mapping rows incomplete", "external_app_evidence_mapping_rows");
  add("boundary.ready", "boundary", context.boundaryRows.length === BOUNDARY_TERMS.length && allPass(context.boundaryRows), "Cross-app boundary rows incomplete", "cross_app_boundary_guard_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_connector_governance_review_block_visible_now === true || context.boundary.claude_connector_governance_review_receipt_present_now === true), "Claude connector governance review missing without visible blocker", "claude_connector_governance_review_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Connector projection rows incomplete", "connector_read_only_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Connector authority guard rows incomplete", "connector_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P15800 freeze rows missing", "p15800_freeze_rows");
  add("boundary.no.connector.side.effects", "boundary", context.boundary.external_app_connection_allowed_now === false && context.boundary.credential_lookup_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_export_allowed_now === false && context.boundary.ingestion_start_allowed_now === false && context.boundary.connector_provisioning_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.cross_app_data_join_allowed_now === false, "Connector governance opened connector connection credential secret raw export ingestion write mutation or cross-app join", "connector_governance_boundary");
  add("boundary.no.trust.release", "boundary", context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false && context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Connector governance opened release trust deployment or protected closeout", "connector_governance_boundary");
  add("boundary.no.write.final.raw", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Connector governance opened write runtime raw exposure or final approval", "connector_governance_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p15801_handoff === context.boundary.p15800_connector_governance_freeze_ready, "P15801 handoff state must match P15800 freeze state", "connector_governance_boundary");
  return items;
}

function buildSummary(context) {
  return {
    connector_external_app_governance_status: context.boundary.ready_for_p15801_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p15401_handoff: context.boundary.source_ready_for_p15401_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    external_app_registry_row_count: context.appRows.length,
    connector_capability_matrix_row_count: context.capabilityRows.length,
    consent_auth_receipt_row_count: context.consentRows.length,
    ingestion_quarantine_row_count: context.quarantineRows.length,
    external_app_evidence_mapping_row_count: context.evidenceRows.length,
    cross_app_boundary_guard_row_count: context.boundaryRows.length,
    claude_connector_governance_review_row_count: context.claudeRows.length,
    claude_connector_governance_review_receipt_present_now: context.boundary.claude_connector_governance_review_receipt_present_now,
    claude_connector_governance_review_block_visible_now: context.boundary.claude_connector_governance_review_block_visible_now,
    connector_read_only_projection_row_count: context.projectionRows.length,
    connector_authority_guard_row_count: context.authorityRows.length,
    p15800_connector_governance_freeze_ready: context.boundary.p15800_connector_governance_freeze_ready,
    ready_for_p15801_handoff: context.boundary.ready_for_p15801_handoff,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    ingestion_start_allowed_now: false,
    connector_provisioning_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    cross_app_data_join_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Connector And External App Governance",
    "",
    `Status: ${result.summary.connector_external_app_governance_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P15401: ${result.summary.source_ready_for_p15401_handoff}`,
    `External app rows: ${result.summary.external_app_registry_row_count}`,
    `Connector capability rows: ${result.summary.connector_capability_matrix_row_count}`,
    `Consent/auth rows: ${result.summary.consent_auth_receipt_row_count}`,
    `Claude connector governance review receipt present: ${result.summary.claude_connector_governance_review_receipt_present_now}`,
    `Ready for P15801 handoff: ${result.summary.ready_for_p15801_handoff}`,
    `External app connection allowed: ${result.summary.external_app_connection_allowed_now}`,
    `Connector write enabled: ${result.summary.connector_write_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.connector_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.connector_write_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Connector Governance</title>
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
    <h1>Hermes Connector Governance</h1>
    <p class="notice">This plane records external app registry, connector capability, consent/auth, quarantine, evidence, and boundary policy as reviewable Harness evidence. Connections, credential material, export, ingestion, service mutation, deployment, release, and finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Connector Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildSaasFactory(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildSaasFactoryMode({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.saas_factory_mode", built);
}

function appExtras() {
  return { external_app_registry_required: true, external_app_connection_allowed_now: false, data_boundary_required: true };
}

function capabilityExtras() {
  return { connector_capability_required: true, connector_write_enabled: false, raw_export_allowed_now: false };
}

function consentExtras() {
  return { consent_receipt_required: true, credential_lookup_allowed_now: false, secret_read_allowed_now: false };
}

function quarantineExtras() {
  return { quarantine_required: true, ingestion_start_allowed_now: false, raw_source_exposure_allowed: false };
}

function evidenceExtras() {
  return { evidence_mapping_required: true, provenance_hash_required: true, raw_export_allowed_now: false };
}

function boundaryExtras() {
  return { cross_app_boundary_required: true, cross_app_data_join_allowed_now: false, raw_source_exposure_allowed: false };
}

function projectionExtras() {
  return { read_only_projection_required: true, connector_execution_allowed_now: false, api_write_allowed_now: false };
}

function authorityExtras() {
  return {
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.architectureDocPath,
    source_saas_factory_path: options.sourceSaasFactoryPath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.sourceSaasFactoryPath,
    claude_connector_governance_review_receipt_path: options.claudeConnectorGovernanceReviewReceiptPath ?? DEFAULT_CONNECTOR_EXTERNAL_APP_GOVERNANCE_INPUTS.claudeConnectorGovernanceReviewReceiptPath,
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
    else if (value === "--source-saas-factory-path") args.sourceSaasFactoryPath = argv[++index];
    else if (value === "--claude-connector-governance-review-receipt-path") args.claudeConnectorGovernanceReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P15401-P15800 Connector And External App Governance artifacts.");
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
