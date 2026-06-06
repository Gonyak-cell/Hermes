import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildProductOpsAutomation } from "./product-ops-automation.mjs";

export const DEFAULT_SECURITY_COMPLIANCE_MATURITY_OUT_DIR = "artifacts/security-compliance-maturity/latest";
export const DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS = {
  schemaPath: "schemas/security-compliance-maturity.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p14201-p14600.md",
  architectureDocPath: "docs/architecture.md",
  sourceProductOpsPath: "artifacts/product-ops-automation/latest/product-ops-automation.json",
  claudeSecurityComplianceReviewReceiptPath: "artifacts/security-compliance-maturity/review/claude-security-compliance-review-receipt.json",
};

const COMMAND_NAME = "platform:security-compliance-maturity";
const SCHEMA_VERSION = "security-compliance-maturity.v1";
const CAPABILITY_ID = "platform.security_compliance_maturity";
const PROGRAM_RANGE = "P14201-P14600";
const SOURCE_PROGRAM_RANGE = "P13801-P14200";
const READY_STATUS = "ready_for_security_compliance_maturity";
const BLOCKED_STATUS = "blocked_security_compliance_maturity";

const PHASE_SPECS = [
  ["P14201-P14240", "P14200 Source Binding", "security_source_binding_rows"],
  ["P14241-P14280", "SOC2-Style Control Signal", "soc2_control_signal_rows"],
  ["P14281-P14320", "Access Review Signal", "access_review_signal_rows"],
  ["P14321-P14360", "Secret Scanning Signal", "secret_scanning_signal_rows"],
  ["P14361-P14400", "Prompt Injection Guard", "prompt_injection_guard_rows"],
  ["P14401-P14440", "Data Retention Policy", "data_retention_policy_rows"],
  ["P14441-P14480", "Incident Workflow Signal", "incident_workflow_signal_rows"],
  ["P14481-P14520", "Compliance Evidence Link", "compliance_evidence_link_rows"],
  ["P14521-P14560", "Claude Security Compliance Review Gate", "claude_security_compliance_review_rows"],
  ["P14561-P14600", "Security Compliance Freeze", "p14600_freeze_rows"],
];

const SOC2_TERMS = ["control id", "control objective", "control owner", "evidence ref", "test frequency", "control blocker"];
const ACCESS_TERMS = ["identity ref", "role ref", "privilege level", "review cadence", "removal blocker", "segregation guard"];
const SECRET_TERMS = ["secret scanner id", "scan scope", "finding count", "remediation ref", "leak blocker", "raw secret guard"];
const PROMPT_INJECTION_TERMS = ["input channel", "untrusted content marker", "tool boundary", "policy instruction priority", "injection blocker", "quarantine route"];
const RETENTION_TERMS = ["data class", "retention period", "deletion hold", "legal hold ref", "retention owner", "destructive action blocker"];
const INCIDENT_TERMS = ["incident id", "severity", "response owner", "escalation route", "evidence capture", "postmortem blocker"];
const COMPLIANCE_TERMS = ["policy ref", "evidence ref", "review ref", "audit trail ref", "stale evidence blocker", "exception owner"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max security compliance review receipt schema"],
  ["model_effort", "model effort"],
  ["security_compliance_scope", "security compliance scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const AUTHORITY_TERMS = [
  "no access mutation",
  "no secret read",
  "no raw secret exposure",
  "no destructive delete",
  "no incident auto close",
  "no compliance PASS",
  "no production PASS",
  "no enterprise trust claim",
  "no connector write",
  "no final automated approval",
];

export async function runSecurityComplianceMaturity(options = {}) {
  const result = await buildSecurityComplianceMaturity(options);
  if (options.write !== false) await writeSecurityComplianceMaturity(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Security And Compliance Maturity failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSecurityComplianceMaturity(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "productOpsAutomation")
    ? normalizeInlineJsonSource("inline.product_ops_automation", options.productOpsAutomation)
    : await readJsonOrBuildProductOps(inputs.source_product_ops_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeSecurityComplianceReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_security_compliance_review_receipt", options.claudeSecurityComplianceReviewReceipt)
    : await readJsonSource(inputs.claude_security_compliance_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const soc2Rows = buildTermRows("soc2_control_signal", "SOC2-style control", SOC2_TERMS, roadmapDoc.text, "soc2_control_signal_rows", generatedAt, soc2Extras);
  const accessRows = buildTermRows("access_review_signal", "Access review", ACCESS_TERMS, roadmapDoc.text, "access_review_signal_rows", generatedAt, accessExtras);
  const secretRows = buildTermRows("secret_scanning_signal", "Secret scanning", SECRET_TERMS, roadmapDoc.text, "secret_scanning_signal_rows", generatedAt, secretExtras);
  const promptRows = buildTermRows("prompt_injection_guard", "Prompt injection", PROMPT_INJECTION_TERMS, roadmapDoc.text, "prompt_injection_guard_rows", generatedAt, promptExtras);
  const retentionRows = buildTermRows("data_retention_policy", "Data retention", RETENTION_TERMS, roadmapDoc.text, "data_retention_policy_rows", generatedAt, retentionExtras);
  const incidentRows = buildTermRows("incident_workflow_signal", "Incident workflow", INCIDENT_TERMS, roadmapDoc.text, "incident_workflow_signal_rows", generatedAt, incidentExtras);
  const complianceRows = buildTermRows("compliance_evidence_link", "Compliance evidence", COMPLIANCE_TERMS, roadmapDoc.text, "compliance_evidence_link_rows", generatedAt, complianceExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const authorityRows = buildTermRows("security_authority_guard", "Security authority guard", AUTHORITY_TERMS, roadmapDoc.text, "security_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, soc2Rows, accessRows, secretRows, promptRows, retentionRows, incidentRows, complianceRows, claudeRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, soc2Rows, accessRows, secretRows, promptRows, retentionRows, incidentRows, complianceRows, claudeRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, soc2Rows, accessRows, secretRows, promptRows, retentionRows, incidentRows, complianceRows, claudeRows, authorityRows, freezeRows, boundary });
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
      product_ops_automation_path: source.path,
      claude_security_compliance_review_receipt_path: claudeReview.path,
    },
    source_product_ops_summary: source.data?.summary ?? null,
    observed_claude_security_compliance_review_summary: claudeReview.data?.summary ?? null,
    security_compliance_contract: buildContract(generatedAt),
    security_compliance_phase_rows: phaseRows,
    security_source_binding_rows: sourceRows,
    soc2_control_signal_rows: soc2Rows,
    access_review_signal_rows: accessRows,
    secret_scanning_signal_rows: secretRows,
    prompt_injection_guard_rows: promptRows,
    data_retention_policy_rows: retentionRows,
    incident_workflow_signal_rows: incidentRows,
    compliance_evidence_link_rows: complianceRows,
    claude_security_compliance_review_rows: claudeRows,
    security_authority_guard_rows: authorityRows,
    p14600_freeze_rows: freezeRows,
    security_compliance_boundary: boundary,
    security_compliance_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, soc2Rows, accessRows, secretRows, promptRows, retentionRows, incidentRows, complianceRows, claudeRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "security_compliance_maturity")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.security_compliance_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.security_compliance_validation_items);
  result.summary = buildSummary({ boundary, soc2Rows, accessRows, secretRows, promptRows, retentionRows, incidentRows, complianceRows, claudeRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeSecurityComplianceMaturity(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "security-compliance-maturity.json"), serializableResult(result));
  await writeJson(path.join(outDir, "security-compliance-phase-rows.json"), collectionEnvelope("security-compliance-phase-rows.v1", "security_compliance_phase_rows", result.security_compliance_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-source-binding-rows.json"), collectionEnvelope("security-source-binding-rows.v1", "security_source_binding_rows", result.security_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "soc2-control-signal-rows.json"), collectionEnvelope("soc2-control-signal-rows.v1", "soc2_control_signal_rows", result.soc2_control_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "access-review-signal-rows.json"), collectionEnvelope("access-review-signal-rows.v1", "access_review_signal_rows", result.access_review_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scanning-signal-rows.json"), collectionEnvelope("secret-scanning-signal-rows.v1", "secret_scanning_signal_rows", result.secret_scanning_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "prompt-injection-guard-rows.json"), collectionEnvelope("prompt-injection-guard-rows.v1", "prompt_injection_guard_rows", result.prompt_injection_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "data-retention-policy-rows.json"), collectionEnvelope("data-retention-policy-rows.v1", "data_retention_policy_rows", result.data_retention_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "incident-workflow-signal-rows.json"), collectionEnvelope("incident-workflow-signal-rows.v1", "incident_workflow_signal_rows", result.incident_workflow_signal_rows, result.generated_at));
  await writeJson(path.join(outDir, "compliance-evidence-link-rows.json"), collectionEnvelope("compliance-evidence-link-rows.v1", "compliance_evidence_link_rows", result.compliance_evidence_link_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-security-compliance-review-rows.json"), collectionEnvelope("claude-security-compliance-review-rows.v1", "claude_security_compliance_review_rows", result.claude_security_compliance_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-authority-guard-rows.json"), collectionEnvelope("security-authority-guard-rows.v1", "security_authority_guard_rows", result.security_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p14600-freeze-rows.json"), collectionEnvelope("p14600-freeze-rows.v1", "p14600_freeze_rows", result.p14600_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-compliance-boundary.json"), result.security_compliance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "security-compliance-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.security_compliance_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runSecurityComplianceMaturityCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSecurityComplianceMaturity(args);
    console.log(`Security And Compliance Maturity ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.security_compliance_maturity_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P14201: ${result.summary.source_ready_for_p14201_handoff}`);
    console.log(`Claude security compliance review receipt: ${result.summary.claude_security_compliance_review_receipt_present_now}`);
    console.log(`Ready for P14601 handoff: ${result.summary.ready_for_p14601_handoff}`);
    console.log(`Secret read allowed: ${result.summary.secret_read_allowed_now}`);
    console.log(`Compliance PASS enabled: ${result.summary.compliance_pass_enabled}`);
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
    contract_id: "security-compliance-maturity.contract.v1",
    generated_at: generatedAt,
    source_product_ops_required: true,
    claude_security_compliance_review_required: true,
    soc2_control_signal_required: true,
    access_review_signal_required: true,
    secret_scanning_signal_required: true,
    prompt_injection_guard_required: true,
    data_retention_policy_required: true,
    incident_workflow_signal_required: true,
    compliance_evidence_link_required: true,
    compliance_pass_enabled: false,
    secret_read_allowed_now: false,
    destructive_delete_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p14201-p14600.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.product_ops_boundary ?? {};
  const sourceStatus = summary.product_ops_automation_status ?? "missing";
  const sourceReady = summary.ready_for_p14201_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P13801-P14200 source artifact available", source.available],
    ["source.range", "P13801-P14200 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P14200 source status visible", sourceStatus === "ready_for_product_ops_automation" || sourceStatus === "blocked_product_ops_automation"],
    ["source.handoff", "P14200 ready_for_p14201_handoff", sourceReady],
    ["source.block_visible", "P14200 blocker visible", sourceReady || sourceBlocked],
    ["source.product_ops_contract", "P14200 product ops signal rows available", Number(summary.roadmap_signal_row_count ?? 0) >= 6 && Number(summary.issue_signal_row_count ?? 0) >= 6 && Number(summary.product_ops_projection_row_count ?? 0) >= 6],
    ["source.no_product_write", "P14200 source did not open roadmap issue support customer or external project write", boundary.roadmap_write_allowed_now === false && boundary.issue_write_allowed_now === false && boundary.support_reply_allowed_now === false && boundary.customer_contact_allowed_now === false && boundary.external_project_write_allowed_now === false],
    ["source.no_trust_write_final", "P14200 source did not open trust production deployment write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.deployment_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
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
    evidence_ref: "docs/hermes-roadmap-p14201-p14600.md#security-and-compliance-maturity-contract",
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
    && claudeReview.data?.scope_security_compliance_maturity === true
    && Number(claudeReview.data?.unresolved_finding_count ?? 0) === 0;
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_security_compliance_review.${reviewId}`,
    category: "claude_security_compliance_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p14201-p14600.md#P14521-P14560",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_security_compliance_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const claudeReady = context.claudeRows.some((row) => row.claude_security_compliance_review_receipt_present_now === true);
  return [
    ["freeze.source", "P14200 source ready for P14201", sourceReady],
    ["freeze.source_block_visible", "P14200 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.soc2", "SOC2-style control signal ready", allPass(context.soc2Rows)],
    ["freeze.access", "access review signal ready", allPass(context.accessRows)],
    ["freeze.secret", "secret scanning signal ready", allPass(context.secretRows)],
    ["freeze.prompt_injection", "prompt injection guard ready", allPass(context.promptRows)],
    ["freeze.retention", "data retention policy ready", allPass(context.retentionRows)],
    ["freeze.incident", "incident workflow signal ready", allPass(context.incidentRows)],
    ["freeze.compliance_evidence", "compliance evidence link ready", allPass(context.complianceRows)],
    ["freeze.claude_security_compliance_review", "Claude security compliance review receipt ready", claudeReady],
    ["freeze.authority_guard", "security authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_security_or_unsafe_action", "no access mutation secret read raw secret destructive delete incident auto close compliance PASS production trust connector write or final approval opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p14600_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p14600-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const soc2Ready = allPass(context.soc2Rows);
  const accessReady = allPass(context.accessRows);
  const secretReady = allPass(context.secretRows);
  const promptReady = allPass(context.promptRows);
  const retentionReady = allPass(context.retentionRows);
  const incidentReady = allPass(context.incidentRows);
  const complianceReady = allPass(context.complianceRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_security_compliance_review_receipt_present_now === true);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = soc2Ready && accessReady && secretReady && promptReady && retentionReady && incidentReady && complianceReady && allPass(context.claudeRows) && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_product_ops_available: sourceAvailable,
    source_ready_for_p14201_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    soc2_control_signal_ready: soc2Ready,
    access_review_signal_ready: accessReady,
    secret_scanning_signal_ready: secretReady,
    prompt_injection_guard_ready: promptReady,
    data_retention_policy_ready: retentionReady,
    incident_workflow_signal_ready: incidentReady,
    compliance_evidence_link_ready: complianceReady,
    claude_security_compliance_review_receipt_present_now: claudeObserved,
    claude_security_compliance_review_block_visible_now: claudeObserved === false,
    security_authority_guard_ready: authorityReady,
    p14600_security_compliance_freeze_ready: freezeReady,
    ready_for_p14601_handoff: freezeReady,
    access_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_secret_exposure_allowed: false,
    destructive_delete_allowed_now: false,
    incident_auto_close_allowed_now: false,
    compliance_pass_enabled: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P14201-P14600 phase rows incomplete", "docs/hermes-roadmap-p14201-p14600.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P14201-P14600"), "Architecture doc missing P14201-P14600 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P14200 source state must be available and blocker-visible", "security_source_binding_rows");
  add("soc2.ready", "security", context.soc2Rows.length === SOC2_TERMS.length && allPass(context.soc2Rows), "SOC2-style control rows incomplete", "soc2_control_signal_rows");
  add("access.ready", "security", context.accessRows.length === ACCESS_TERMS.length && allPass(context.accessRows), "Access review rows incomplete", "access_review_signal_rows");
  add("secret.ready", "security", context.secretRows.length === SECRET_TERMS.length && allPass(context.secretRows), "Secret scanning rows incomplete", "secret_scanning_signal_rows");
  add("prompt.ready", "security", context.promptRows.length === PROMPT_INJECTION_TERMS.length && allPass(context.promptRows), "Prompt injection guard rows incomplete", "prompt_injection_guard_rows");
  add("retention.ready", "compliance", context.retentionRows.length === RETENTION_TERMS.length && allPass(context.retentionRows), "Data retention rows incomplete", "data_retention_policy_rows");
  add("incident.ready", "security", context.incidentRows.length === INCIDENT_TERMS.length && allPass(context.incidentRows), "Incident workflow rows incomplete", "incident_workflow_signal_rows");
  add("compliance.ready", "compliance", context.complianceRows.length === COMPLIANCE_TERMS.length && allPass(context.complianceRows), "Compliance evidence rows incomplete", "compliance_evidence_link_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_security_compliance_review_block_visible_now === true || context.boundary.claude_security_compliance_review_receipt_present_now === true), "Claude security compliance review missing without visible blocker", "claude_security_compliance_review_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Authority guard rows incomplete", "security_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P14600 freeze rows missing", "p14600_freeze_rows");
  add("boundary.no.security.action", "boundary", context.boundary.access_mutation_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_secret_exposure_allowed === false && context.boundary.destructive_delete_allowed_now === false && context.boundary.incident_auto_close_allowed_now === false && context.boundary.compliance_pass_enabled === false, "Security compliance opened security action or PASS", "security_compliance_boundary");
  add("boundary.no.raw.trust.release", "boundary", context.boundary.raw_contact_exposure_allowed === false && context.boundary.raw_source_exposure_allowed === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.deployment_allowed_now === false && context.boundary.release_approval_allowed_now === false, "Security compliance opened raw exposure trust production release or deployment", "security_compliance_boundary");
  add("boundary.no.write.final", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.protected_action_allowed_now === false && context.boundary.connector_write_enabled === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Security compliance opened write runtime connector or final approval", "security_compliance_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p14601_handoff === context.boundary.p14600_security_compliance_freeze_ready, "P14601 handoff state must match P14600 freeze state", "security_compliance_boundary");
  return items;
}

function buildSummary(context) {
  return {
    security_compliance_maturity_status: context.boundary.ready_for_p14601_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p14201_handoff: context.boundary.source_ready_for_p14201_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    soc2_control_signal_row_count: context.soc2Rows.length,
    access_review_signal_row_count: context.accessRows.length,
    secret_scanning_signal_row_count: context.secretRows.length,
    prompt_injection_guard_row_count: context.promptRows.length,
    data_retention_policy_row_count: context.retentionRows.length,
    incident_workflow_signal_row_count: context.incidentRows.length,
    compliance_evidence_link_row_count: context.complianceRows.length,
    claude_security_compliance_review_row_count: context.claudeRows.length,
    claude_security_compliance_review_receipt_present_now: context.boundary.claude_security_compliance_review_receipt_present_now,
    claude_security_compliance_review_block_visible_now: context.boundary.claude_security_compliance_review_block_visible_now,
    authority_guard_row_count: context.authorityRows.length,
    p14600_security_compliance_freeze_ready: context.boundary.p14600_security_compliance_freeze_ready,
    ready_for_p14601_handoff: context.boundary.ready_for_p14601_handoff,
    access_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_secret_exposure_allowed: false,
    destructive_delete_allowed_now: false,
    incident_auto_close_allowed_now: false,
    compliance_pass_enabled: false,
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
    "# Security And Compliance Maturity",
    "",
    `Status: ${result.summary.security_compliance_maturity_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P14201: ${result.summary.source_ready_for_p14201_handoff}`,
    `SOC2-style control rows: ${result.summary.soc2_control_signal_row_count}`,
    `Access review rows: ${result.summary.access_review_signal_row_count}`,
    `Secret scanning rows: ${result.summary.secret_scanning_signal_row_count}`,
    `Prompt injection rows: ${result.summary.prompt_injection_guard_row_count}`,
    `Data retention rows: ${result.summary.data_retention_policy_row_count}`,
    `Incident workflow rows: ${result.summary.incident_workflow_signal_row_count}`,
    `Claude security compliance review receipt present: ${result.summary.claude_security_compliance_review_receipt_present_now}`,
    `Ready for P14601 handoff: ${result.summary.ready_for_p14601_handoff}`,
    `Compliance PASS enabled: ${result.summary.compliance_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.security_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.compliance_pass_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Security And Compliance Maturity</title>
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
    <h1>Hermes Security And Compliance Maturity</h1>
    <p class="notice">This plane tracks security and compliance readiness as read-only evidence. Access changes, secret material, destructive deletion, incident closure, compliance pass, production approval, deployment, connector writes, and protected finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Compliance PASS</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildProductOps(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildProductOpsAutomation({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.product_ops_automation", built);
}

function soc2Extras() {
  return { soc2_control_required: true, control_test_required: true, compliance_pass_enabled: false };
}

function accessExtras() {
  return { access_review_required: true, access_mutation_allowed_now: false, privilege_escalation_allowed_now: false };
}

function secretExtras() {
  return { secret_scanning_required: true, secret_read_allowed_now: false, raw_secret_exposure_allowed: false };
}

function promptExtras() {
  return { prompt_injection_guard_required: true, tool_boundary_required: true, untrusted_instruction_priority_allowed: false };
}

function retentionExtras() {
  return { data_retention_required: true, destructive_delete_allowed_now: false, legal_hold_required: true };
}

function incidentExtras() {
  return { incident_workflow_required: true, incident_auto_close_allowed_now: false, postmortem_required: true };
}

function complianceExtras() {
  return { compliance_evidence_required: true, stale_evidence_blocker_required: true, exception_auto_approval_allowed: false };
}

function authorityExtras() {
  return {
    access_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_secret_exposure_allowed: false,
    destructive_delete_allowed_now: false,
    incident_auto_close_allowed_now: false,
    compliance_pass_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    connector_write_enabled: false,
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
    schema_path: options.schemaPath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.architectureDocPath,
    source_product_ops_path: options.sourceProductOpsPath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.sourceProductOpsPath,
    claude_security_compliance_review_receipt_path: options.claudeSecurityComplianceReviewReceiptPath ?? DEFAULT_SECURITY_COMPLIANCE_MATURITY_INPUTS.claudeSecurityComplianceReviewReceiptPath,
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
    else if (value === "--source-product-ops-path") args.sourceProductOpsPath = argv[++index];
    else if (value === "--claude-security-compliance-review-receipt-path") args.claudeSecurityComplianceReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P14201-P14600 Security And Compliance Maturity artifacts.");
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
