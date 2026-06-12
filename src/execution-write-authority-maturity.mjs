import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildConnectorExternalAppGovernance } from "./connector-external-app-governance.mjs";

export const DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_OUT_DIR = "artifacts/execution-write-authority-maturity/latest";
export const DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS = {
  schemaPath: "schemas/execution-write-authority-maturity.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p15801-p16200.md",
  architectureDocPath: "docs/architecture.md",
  sourceConnectorGovernancePath: "artifacts/connector-external-app-governance/latest/connector-external-app-governance.json",
  claudeExecutionWriteAuthorityReviewReceiptPath: "artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json",
};

const COMMAND_NAME = "platform:execution-write-authority-maturity";
const SCHEMA_VERSION = "execution-write-authority-maturity.v1";
const CAPABILITY_ID = "platform.execution_write_authority_maturity";
const PROGRAM_RANGE = "P15801-P16200";
const SOURCE_PROGRAM_RANGE = "P15401-P15800";
const READY_STATUS = "ready_for_execution_write_authority_maturity";
const BLOCKED_STATUS = "blocked_execution_write_authority_maturity";

const PHASE_SPECS = [
  ["P15801-P15840", "P15800 Source Binding", "execution_authority_source_binding_rows"],
  ["P15841-P15880", "Action Class Registry", "action_class_registry_rows"],
  ["P15881-P15920", "Receipt-Gated Candidate Lane", "receipt_gated_candidate_lane_rows"],
  ["P15921-P15960", "Command Allowlist Policy", "command_allowlist_policy_rows"],
  ["P15961-P16000", "Write Scope Policy", "write_scope_policy_rows"],
  ["P16001-P16040", "Rollback And Recovery Binding", "rollback_recovery_binding_rows"],
  ["P16041-P16080", "Post-Action Validation Contract", "post_action_validation_rows"],
  ["P16081-P16120", "Claude Execution/Write Authority Review Gate", "claude_execution_write_authority_review_rows"],
  ["P16121-P16160", "Read-Only Authority Projection", "authority_read_only_projection_rows"],
  ["P16161-P16200", "Execution/Write Authority Freeze", "p16200_freeze_rows"],
];

const ACTION_TERMS = ["action id", "action class", "risk tier", "protected flag", "owner engine", "action blocker"];
const CANDIDATE_TERMS = ["receipt id", "scope ref", "candidate command/diff", "expiry/revocation", "preflight blocker", "no automatic apply"];
const ALLOWLIST_TERMS = ["command id", "allowed mode", "repo-local sandbox", "timeout", "redaction", "execution blocker"];
const WRITE_SCOPE_TERMS = ["path scope", "generated patch only", "diff packet", "rollback plan", "protected path blocker", "no direct write"];
const ROLLBACK_TERMS = ["rollback target", "restore command ref", "evidence snapshot", "incident hook", "recovery owner", "rollback blocker"];
const POST_ACTION_TERMS = ["validator id", "pre/post evidence", "adjacent regression", "negative fixture", "status closeout", "validation blocker"];
const CLAUDE_REVIEW_TERMS = [
  ["review_receipt_schema", "Claude Code Opus max execution/write authority review receipt schema"],
  ["model_effort", "model effort"],
  ["authority_scope", "authority scope"],
  ["finding_loop", "finding loop"],
  ["observed_receipt_state", "observed receipt state"],
];
const PROJECTION_TERMS = ["read-only action registry API row", "dashboard row", "candidate preview", "receipt rollup", "validation rollup", "no execution"];
const AUTHORITY_TERMS = [
  "no receipt application",
  "no candidate execution",
  "no command execution",
  "no runtime execution",
  "no direct file write",
  "no patch apply",
  "no protected action",
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

export async function runExecutionWriteAuthorityMaturity(options = {}) {
  const result = await buildExecutionWriteAuthorityMaturity(options);
  if (options.write !== false) await writeExecutionWriteAuthorityMaturity(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Execution/Write Authority Maturity failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExecutionWriteAuthorityMaturity(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "connectorExternalAppGovernance")
    ? normalizeInlineJsonSource("inline.connector_external_app_governance", options.connectorExternalAppGovernance)
    : await readJsonOrBuildConnectorGovernance(inputs.source_connector_governance_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeExecutionWriteAuthorityReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_execution_write_authority_review_receipt", options.claudeExecutionWriteAuthorityReviewReceipt)
    : await readJsonSource(inputs.claude_execution_write_authority_review_receipt_path);

  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const actionRows = buildTermRows("action_class_registry", "Action class", ACTION_TERMS, roadmapDoc.text, "action_class_registry_rows", generatedAt, actionExtras);
  const candidateRows = buildTermRows("receipt_gated_candidate_lane", "Receipt-gated candidate", CANDIDATE_TERMS, roadmapDoc.text, "receipt_gated_candidate_lane_rows", generatedAt, candidateExtras);
  const allowlistRows = buildTermRows("command_allowlist_policy", "Command allowlist", ALLOWLIST_TERMS, roadmapDoc.text, "command_allowlist_policy_rows", generatedAt, allowlistExtras);
  const writeRows = buildTermRows("write_scope_policy", "Write scope", WRITE_SCOPE_TERMS, roadmapDoc.text, "write_scope_policy_rows", generatedAt, writeScopeExtras);
  const rollbackRows = buildTermRows("rollback_recovery_binding", "Rollback recovery", ROLLBACK_TERMS, roadmapDoc.text, "rollback_recovery_binding_rows", generatedAt, rollbackExtras);
  const postActionRows = buildTermRows("post_action_validation", "Post-action validation", POST_ACTION_TERMS, roadmapDoc.text, "post_action_validation_rows", generatedAt, postActionExtras);
  const claudeRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const projectionRows = buildTermRows("authority_read_only_projection", "Authority projection", PROJECTION_TERMS, roadmapDoc.text, "authority_read_only_projection_rows", generatedAt, projectionExtras);
  const authorityRows = buildTermRows("execution_write_authority_guard", "Execution write authority guard", AUTHORITY_TERMS, roadmapDoc.text, "execution_write_authority_guard_rows", generatedAt, authorityExtras);
  const freezeRows = buildFreezeRows({ sourceRows, actionRows, candidateRows, allowlistRows, writeRows, rollbackRows, postActionRows, claudeRows, projectionRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, actionRows, candidateRows, allowlistRows, writeRows, rollbackRows, postActionRows, claudeRows, projectionRows, authorityRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, actionRows, candidateRows, allowlistRows, writeRows, rollbackRows, postActionRows, claudeRows, projectionRows, authorityRows, freezeRows, boundary });
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
      connector_external_app_governance_path: source.path,
      claude_execution_write_authority_review_receipt_path: claudeReview.path,
    },
    source_connector_governance_summary: source.data?.summary ?? null,
    observed_claude_execution_write_authority_review_summary: claudeReview.data?.summary ?? null,
    execution_write_authority_contract: buildContract(generatedAt),
    execution_write_authority_phase_rows: phaseRows,
    execution_authority_source_binding_rows: sourceRows,
    action_class_registry_rows: actionRows,
    receipt_gated_candidate_lane_rows: candidateRows,
    command_allowlist_policy_rows: allowlistRows,
    write_scope_policy_rows: writeRows,
    rollback_recovery_binding_rows: rollbackRows,
    post_action_validation_rows: postActionRows,
    claude_execution_write_authority_review_rows: claudeRows,
    authority_read_only_projection_rows: projectionRows,
    execution_write_authority_guard_rows: authorityRows,
    p16200_freeze_rows: freezeRows,
    execution_write_authority_boundary: boundary,
    execution_write_authority_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, actionRows, candidateRows, allowlistRows, writeRows, rollbackRows, postActionRows, claudeRows, projectionRows, authorityRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "execution_write_authority_maturity")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.execution_write_authority_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.execution_write_authority_validation_items);
  result.summary = buildSummary({ boundary, actionRows, candidateRows, allowlistRows, writeRows, rollbackRows, postActionRows, claudeRows, projectionRows, authorityRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeExecutionWriteAuthorityMaturity(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "execution-write-authority-maturity.json"), serializableResult(result));
  await writeJson(path.join(outDir, "execution-write-authority-phase-rows.json"), collectionEnvelope("execution-write-authority-phase-rows.v1", "execution_write_authority_phase_rows", result.execution_write_authority_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-authority-source-binding-rows.json"), collectionEnvelope("execution-authority-source-binding-rows.v1", "execution_authority_source_binding_rows", result.execution_authority_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "action-class-registry-rows.json"), collectionEnvelope("action-class-registry-rows.v1", "action_class_registry_rows", result.action_class_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-gated-candidate-lane-rows.json"), collectionEnvelope("receipt-gated-candidate-lane-rows.v1", "receipt_gated_candidate_lane_rows", result.receipt_gated_candidate_lane_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-allowlist-policy-rows.json"), collectionEnvelope("command-allowlist-policy-rows.v1", "command_allowlist_policy_rows", result.command_allowlist_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "write-scope-policy-rows.json"), collectionEnvelope("write-scope-policy-rows.v1", "write_scope_policy_rows", result.write_scope_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-recovery-binding-rows.json"), collectionEnvelope("rollback-recovery-binding-rows.v1", "rollback_recovery_binding_rows", result.rollback_recovery_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-action-validation-rows.json"), collectionEnvelope("post-action-validation-rows.v1", "post_action_validation_rows", result.post_action_validation_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-execution-write-authority-review-rows.json"), collectionEnvelope("claude-execution-write-authority-review-rows.v1", "claude_execution_write_authority_review_rows", result.claude_execution_write_authority_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-read-only-projection-rows.json"), collectionEnvelope("authority-read-only-projection-rows.v1", "authority_read_only_projection_rows", result.authority_read_only_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-write-authority-guard-rows.json"), collectionEnvelope("execution-write-authority-guard-rows.v1", "execution_write_authority_guard_rows", result.execution_write_authority_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p16200-freeze-rows.json"), collectionEnvelope("p16200-freeze-rows.v1", "p16200_freeze_rows", result.p16200_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-write-authority-boundary.json"), result.execution_write_authority_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "execution-write-authority-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.execution_write_authority_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runExecutionWriteAuthorityMaturityCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExecutionWriteAuthorityMaturity(args);
    console.log(`Execution/Write Authority Maturity ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.execution_write_authority_maturity_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P15801: ${result.summary.source_ready_for_p15801_handoff}`);
    console.log(`Claude execution/write authority review receipt: ${result.summary.claude_execution_write_authority_review_receipt_present_now}`);
    console.log(`Ready for P16201 handoff: ${result.summary.ready_for_p16201_handoff}`);
    console.log(`Command execution allowed: ${result.summary.command_execution_allowed_now}`);
    console.log(`Patch apply allowed: ${result.summary.patch_apply_allowed_now}`);
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
    contract_id: "execution-write-authority-maturity.contract.v1",
    generated_at: generatedAt,
    source_connector_governance_required: true,
    action_class_registry_required: true,
    receipt_gated_candidate_lane_required: true,
    command_allowlist_policy_required: true,
    write_scope_policy_required: true,
    rollback_recovery_binding_required: true,
    post_action_validation_required: true,
    claude_execution_write_authority_review_required: true,
    read_only_authority_projection_required: true,
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([phaseRange, name, output]) => verdictRow({
    row_id: `phase.${phaseRange.toLowerCase()}`,
    category: "phase_plan",
    label: `${phaseRange} ${name}`,
    required: true,
    observed: includesAll(roadmapText, [phaseRange, name, output]),
    evidence_ref: `docs/hermes-roadmap-p15801-p16200.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.connector_governance_boundary ?? {};
  const sourceStatus = summary.connector_external_app_governance_status ?? "missing";
  const sourceReady = summary.ready_for_p15801_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P15401-P15800 source artifact available", source.available],
    ["source.range", "P15401-P15800 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P15800 source status visible", sourceStatus === "ready_for_connector_external_app_governance" || sourceStatus === "blocked_connector_external_app_governance"],
    ["source.handoff", "P15800 ready_for_p15801_handoff", sourceReady],
    ["source.block_visible", "P15800 blocker visible", sourceReady || sourceBlocked],
    ["source.connector_rows", "P15800 external app connector consent quarantine evidence boundary projection rows available", Number(summary.external_app_registry_row_count ?? 0) >= 6 && Number(summary.connector_capability_matrix_row_count ?? 0) >= 6 && Number(summary.consent_auth_receipt_row_count ?? 0) >= 6 && Number(summary.ingestion_quarantine_row_count ?? 0) >= 6 && Number(summary.external_app_evidence_mapping_row_count ?? 0) >= 6 && Number(summary.cross_app_boundary_guard_row_count ?? 0) >= 6 && Number(summary.connector_read_only_projection_row_count ?? 0) >= 6],
    ["source.no_connector_side_effects", "P15800 source did not open external app connection credential lookup secret read raw export ingestion connector write mutation or cross-app join", boundary.external_app_connection_allowed_now === false && boundary.credential_lookup_allowed_now === false && boundary.secret_read_allowed_now === false && boundary.raw_export_allowed_now === false && boundary.ingestion_start_allowed_now === false && boundary.connector_write_enabled === false && boundary.external_service_mutation_allowed_now === false && boundary.cross_app_data_join_allowed_now === false],
    ["source.no_trust_write_final", "P15800 source did not open trust production protected closeout deployment release write runtime or final approval", boundary.enterprise_trust_claim_allowed_now === false && boundary.production_pass_enabled === false && boundary.protected_closeout_enabled === false && boundary.deployment_allowed_now === false && boundary.release_approval_allowed_now === false && boundary.write_action_allowed_now === false && boundary.runtime_execution_allowed_now === false && boundary.final_approval_ui_enabled === false],
    ["source.no_raw_secret", "P15800 source did not open raw source exposure or secret read", boundary.raw_source_exposure_allowed === false && boundary.secret_read_allowed_now === false],
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
    evidence_ref: "docs/hermes-roadmap-p15801-p16200.md#execution-write-authority-maturity-contract",
    generated_at: generatedAt,
    output_ref: outputRef,
    term_id: slug(term),
    ...extraBuilder(term),
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = isObservedExecutionWriteAuthorityReviewReceipt(claudeReview);
  return CLAUDE_REVIEW_TERMS.map(([reviewId, label]) => verdictRow({
    row_id: `claude_execution_write_authority_review.${reviewId}`,
    category: "claude_execution_write_authority_review_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label.replace("Claude Code Opus max ", "")),
    evidence_ref: reviewObserved ? claudeReview.path : "docs/hermes-roadmap-p15801-p16200.md#P16081-P16120",
    generated_at: generatedAt,
    review_id: reviewId,
    claude_execution_write_authority_review_receipt_present_now: reviewObserved,
    claude_final_approval_allowed: false,
    finding_loop_required: true,
  }));
}

function isObservedExecutionWriteAuthorityReviewReceipt(claudeReview) {
  const data = claudeReview.data ?? {};
  const unresolvedFindingCount = Number(data.unresolved_finding_count);
  return claudeReview.available === true
    && data.review_engine === "claude_code_opus_max"
    && data.receipt_status === "complete"
    && data.scope_execution_write_authority_maturity === true
    && data.scope_id === "execution_write_authority_maturity"
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
  const claudeReady = context.claudeRows.some((row) => row.claude_execution_write_authority_review_receipt_present_now === true);
  return [
    ["freeze.source", "P15800 source ready for P15801", sourceReady],
    ["freeze.source_block_visible", "P15800 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.action_class", "action class registry ready", allPass(context.actionRows)],
    ["freeze.candidate_lane", "receipt-gated candidate lane ready", allPass(context.candidateRows)],
    ["freeze.command_allowlist", "command allowlist policy ready", allPass(context.allowlistRows)],
    ["freeze.write_scope", "write scope policy ready", allPass(context.writeRows)],
    ["freeze.rollback", "rollback and recovery binding ready", allPass(context.rollbackRows)],
    ["freeze.post_action_validation", "post-action validation contract ready", allPass(context.postActionRows)],
    ["freeze.claude_execution_write_authority_review", "Claude execution/write authority review receipt ready", claudeReady],
    ["freeze.projection", "read-only authority projection ready", allPass(context.projectionRows)],
    ["freeze.authority_guard", "execution/write authority guard ready", allPass(context.authorityRows)],
    ["freeze.no_execution_write_side_effects", "no receipt application candidate execution command runtime direct write patch apply protected action or final approval opened", true],
    ["freeze.no_release_trust_connector_raw", "no connector write external mutation deployment production trust release raw exposure or secret read opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p16200_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p16200-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceAvailable = context.source.available === true;
  const sourceReady = rowPass(context.sourceRows, "source.handoff");
  const sourceBlockVisible = rowPass(context.sourceRows, "source.block_visible");
  const actionReady = allPass(context.actionRows);
  const candidateReady = allPass(context.candidateRows);
  const allowlistReady = allPass(context.allowlistRows);
  const writeReady = allPass(context.writeRows);
  const rollbackReady = allPass(context.rollbackRows);
  const postActionReady = allPass(context.postActionRows);
  const claudeObserved = context.claudeRows.some((row) => row.claude_execution_write_authority_review_receipt_present_now === true);
  const projectionReady = allPass(context.projectionRows);
  const authorityReady = allPass(context.authorityRows);
  const contractReady = actionReady && candidateReady && allowlistReady && writeReady && rollbackReady && postActionReady && allPass(context.claudeRows) && projectionReady && authorityReady;
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_connector_governance_available: sourceAvailable,
    source_ready_for_p15801_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    action_class_registry_ready: actionReady,
    receipt_gated_candidate_lane_ready: candidateReady,
    command_allowlist_policy_ready: allowlistReady,
    write_scope_policy_ready: writeReady,
    rollback_recovery_binding_ready: rollbackReady,
    post_action_validation_ready: postActionReady,
    claude_execution_write_authority_review_receipt_present_now: claudeObserved,
    claude_execution_write_authority_review_block_visible_now: claudeObserved === false,
    authority_read_only_projection_ready: projectionReady,
    execution_write_authority_guard_ready: authorityReady,
    p16200_execution_write_authority_freeze_ready: freezeReady,
    ready_for_p16201_handoff: freezeReady,
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    deployment_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
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
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P15801-P16200 phase rows incomplete", "docs/hermes-roadmap-p15801-p16200.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P15801-P16200"), "Architecture doc missing P15801-P16200 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 9 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P15800 source state must be available and blocker-visible", "execution_authority_source_binding_rows");
  add("action.ready", "action", context.actionRows.length === ACTION_TERMS.length && allPass(context.actionRows), "Action class rows incomplete", "action_class_registry_rows");
  add("candidate.ready", "candidate", context.candidateRows.length === CANDIDATE_TERMS.length && allPass(context.candidateRows), "Receipt-gated candidate lane rows incomplete", "receipt_gated_candidate_lane_rows");
  add("allowlist.ready", "allowlist", context.allowlistRows.length === ALLOWLIST_TERMS.length && allPass(context.allowlistRows), "Command allowlist rows incomplete", "command_allowlist_policy_rows");
  add("write_scope.ready", "write_scope", context.writeRows.length === WRITE_SCOPE_TERMS.length && allPass(context.writeRows), "Write scope rows incomplete", "write_scope_policy_rows");
  add("rollback.ready", "rollback", context.rollbackRows.length === ROLLBACK_TERMS.length && allPass(context.rollbackRows), "Rollback rows incomplete", "rollback_recovery_binding_rows");
  add("post_action.ready", "validation", context.postActionRows.length === POST_ACTION_TERMS.length && allPass(context.postActionRows), "Post-action validation rows incomplete", "post_action_validation_rows");
  add("claude_review.block_visible", "review", context.claudeRows.length === CLAUDE_REVIEW_TERMS.length && (context.boundary.claude_execution_write_authority_review_block_visible_now === true || context.boundary.claude_execution_write_authority_review_receipt_present_now === true), "Claude execution/write authority review missing without visible blocker", "claude_execution_write_authority_review_rows");
  add("projection.ready", "projection", context.projectionRows.length === PROJECTION_TERMS.length && allPass(context.projectionRows), "Authority projection rows incomplete", "authority_read_only_projection_rows");
  add("authority.ready", "authority", context.authorityRows.length === AUTHORITY_TERMS.length && allPass(context.authorityRows), "Execution/write authority guard rows incomplete", "execution_write_authority_guard_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P16200 freeze rows missing", "p16200_freeze_rows");
  add("boundary.no.execution.write", "boundary", context.boundary.receipt_application_allowed_now === false && context.boundary.candidate_execution_allowed_now === false && context.boundary.command_execution_allowed_now === false && context.boundary.runtime_execution_allowed_now === false && context.boundary.direct_file_write_allowed_now === false && context.boundary.patch_apply_allowed_now === false && context.boundary.protected_action_allowed_now === false, "Execution/write authority opened receipt application execution write patch apply or protected action", "execution_write_authority_boundary");
  add("boundary.no.trust.release.connector.raw", "boundary", context.boundary.connector_write_enabled === false && context.boundary.external_service_mutation_allowed_now === false && context.boundary.deployment_allowed_now === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false && context.boundary.enterprise_trust_claim_allowed_now === false && context.boundary.protected_closeout_enabled === false && context.boundary.release_approval_allowed_now === false && context.boundary.secret_read_allowed_now === false && context.boundary.raw_source_exposure_allowed === false, "Execution/write authority opened connector write mutation deployment trust release secret or raw exposure", "execution_write_authority_boundary");
  add("boundary.no.final", "boundary", context.boundary.write_action_allowed_now === false && context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false, "Execution/write authority opened write action or final approval", "execution_write_authority_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p16201_handoff === context.boundary.p16200_execution_write_authority_freeze_ready, "P16201 handoff state must match P16200 freeze state", "execution_write_authority_boundary");
  return items;
}

function buildSummary(context) {
  return {
    execution_write_authority_maturity_status: context.boundary.ready_for_p16201_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p15801_handoff: context.boundary.source_ready_for_p15801_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    action_class_registry_row_count: context.actionRows.length,
    receipt_gated_candidate_lane_row_count: context.candidateRows.length,
    command_allowlist_policy_row_count: context.allowlistRows.length,
    write_scope_policy_row_count: context.writeRows.length,
    rollback_recovery_binding_row_count: context.rollbackRows.length,
    post_action_validation_row_count: context.postActionRows.length,
    claude_execution_write_authority_review_row_count: context.claudeRows.length,
    claude_execution_write_authority_review_receipt_present_now: context.boundary.claude_execution_write_authority_review_receipt_present_now,
    claude_execution_write_authority_review_block_visible_now: context.boundary.claude_execution_write_authority_review_block_visible_now,
    authority_read_only_projection_row_count: context.projectionRows.length,
    execution_write_authority_guard_row_count: context.authorityRows.length,
    p16200_execution_write_authority_freeze_ready: context.boundary.p16200_execution_write_authority_freeze_ready,
    ready_for_p16201_handoff: context.boundary.ready_for_p16201_handoff,
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    deployment_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    write_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Execution/Write Authority Maturity",
    "",
    `Status: ${result.summary.execution_write_authority_maturity_status}`,
    `Program: ${result.program_range}`,
    `Source ready for P15801: ${result.summary.source_ready_for_p15801_handoff}`,
    `Action class rows: ${result.summary.action_class_registry_row_count}`,
    `Receipt-gated candidate rows: ${result.summary.receipt_gated_candidate_lane_row_count}`,
    `Command allowlist rows: ${result.summary.command_allowlist_policy_row_count}`,
    `Claude execution/write authority review receipt present: ${result.summary.claude_execution_write_authority_review_receipt_present_now}`,
    `Ready for P16201 handoff: ${result.summary.ready_for_p16201_handoff}`,
    `Command execution allowed: ${result.summary.command_execution_allowed_now}`,
    `Patch apply allowed: ${result.summary.patch_apply_allowed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.execution_write_authority_guard_rows.map((row) => `<tr><td>${escapeHtml(row.term_id)}</td><td>${escapeHtml(row.current_verdict)}</td><td>${escapeHtml(row.command_execution_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Execution Write Authority</title>
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
    <h1>Hermes Execution Write Authority</h1>
    <p class="notice">This plane defines action classes, receipt-gated candidates, command allowlists, write scopes, rollback bindings, and post-action validation as reviewable Harness evidence. Receipt application, command runs, runtime runs, direct writes, patch use, guarded operations, deployment, release, and finalization stay closed.</p>
    <table><thead><tr><th>Authority Guard</th><th>Verdict</th><th>Command Execution</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildConnectorGovernance(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildConnectorExternalAppGovernance({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.connector_external_app_governance", built);
}

function actionExtras() {
  return { action_registry_required: true, protected_action_allowed_now: false, final_approval_allowed_now: false };
}

function candidateExtras() {
  return { receipt_gated_candidate_required: true, receipt_application_allowed_now: false, candidate_execution_allowed_now: false, automatic_apply_allowed_now: false };
}

function allowlistExtras() {
  return { command_allowlist_required: true, repo_local_sandbox_required: true, command_execution_allowed_now: false };
}

function writeScopeExtras() {
  return { write_scope_required: true, direct_file_write_allowed_now: false, patch_apply_allowed_now: false };
}

function rollbackExtras() {
  return { rollback_binding_required: true, restore_execution_allowed_now: false, incident_auto_close_allowed_now: false };
}

function postActionExtras() {
  return { post_action_validation_required: true, status_closeout_allowed_now: false, validation_blocker_required: true };
}

function projectionExtras() {
  return { read_only_projection_required: true, command_execution_allowed_now: false, api_write_allowed_now: false };
}

function authorityExtras() {
  return {
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
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
    schema_path: options.schemaPath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.architectureDocPath,
    source_connector_governance_path: options.sourceConnectorGovernancePath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.sourceConnectorGovernancePath,
    claude_execution_write_authority_review_receipt_path: options.claudeExecutionWriteAuthorityReviewReceiptPath ?? DEFAULT_EXECUTION_WRITE_AUTHORITY_MATURITY_INPUTS.claudeExecutionWriteAuthorityReviewReceiptPath,
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
    else if (value === "--source-connector-governance-path") args.sourceConnectorGovernancePath = argv[++index];
    else if (value === "--claude-execution-write-authority-review-receipt-path") args.claudeExecutionWriteAuthorityReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P15801-P16200 Execution/Write Authority Maturity artifacts.");
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
