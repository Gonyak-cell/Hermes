import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackSdkV2 } from "./domain-pack-sdk-v2.mjs";
import { buildSandboxPolicyModel } from "./sandbox-policy-model.mjs";

export const DEFAULT_CONTROLLED_EXECUTION_SANDBOX_OUT_DIR = "artifacts/controlled-execution-sandbox/latest";
export const DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS = {
  schemaPath: "schemas/controlled-execution-sandbox.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p12201-p12400.md",
  architectureDocPath: "docs/architecture.md",
  sourceDomainPackSdkV2Path: "artifacts/domain-pack-sdk-v2/latest/domain-pack-sdk-v2.json",
  sandboxPolicyModelPath: "artifacts/sandbox-policy-model/latest/sandbox-policy-model.json",
  claudeExecutionReviewReceiptPath: "artifacts/controlled-execution-sandbox/review/claude-execution-sandbox-review-receipt.json",
};

const COMMAND_NAME = "platform:controlled-execution-sandbox";
const SCHEMA_VERSION = "controlled-execution-sandbox.v1";
const CAPABILITY_ID = "platform.controlled_execution_sandbox";
const PROGRAM_RANGE = "P12201-P12400";
const SOURCE_PROGRAM_RANGE = "P12001-P12200";
const READY_STATUS = "ready_for_controlled_execution_sandbox";
const BLOCKED_STATUS = "blocked_controlled_execution_sandbox";

const PHASE_SPECS = [
  ["P12201-P12220", "P12200 Source Binding", "controlled_execution_source_binding_rows"],
  ["P12221-P12240", "Receipt-Gated Command Allowlist", "controlled_execution_allowlist_rows"],
  ["P12241-P12260", "Sandbox Backend Profile Matrix", "controlled_execution_sandbox_rows"],
  ["P12261-P12280", "Redaction And Secret Scan Contract", "controlled_execution_redaction_rows"],
  ["P12281-P12300", "Timeout Heartbeat Kill Contract", "controlled_execution_timeout_rows"],
  ["P12301-P12320", "Rollback And Evidence Binding", "controlled_execution_rollback_rows"],
  ["P12321-P12340", "Dry-Run No-Op Candidate Ledger", "controlled_execution_dry_run_rows"],
  ["P12341-P12360", "High-Risk Claude Review Receipt Gate", "controlled_execution_claude_review_rows"],
  ["P12361-P12380", "Read-Only Operator/API Projection", "controlled_execution_operator_projection_rows"],
  ["P12381-P12400", "Controlled Sandbox Freeze", "p12400_freeze_rows"],
];

const RECEIPT_SPECS = [
  ["command_execution_receipt", "command execution receipt"],
  ["install_command_receipt", "install command receipt"],
  ["doctor_smoke_receipt", "doctor/smoke receipt"],
  ["mcp_health_receipt", "MCP health receipt"],
  ["cron_job_receipt", "cron/job receipt"],
  ["rollback_receipt", "rollback receipt"],
  ["emergency_stop_receipt", "emergency stop receipt"],
];

const ALLOWLIST_SPECS = [
  ["git_status_short", "git status --short", "read_only_status"],
  ["git_diff_check", "git diff --check", "read_only_diff_check"],
  ["rg_read_only_search", "rg <pattern>", "read_only_search"],
  ["node_test_targeted", "node --test test/<target>.test.mjs", "targeted_test"],
  ["npm_platform_check", "npm run platform:<command> -- --check", "platform_check"],
  ["npm_validate_core", "npm run validate:core", "core_validation"],
  ["doctor_smoke_check", "npm run <doctor-or-smoke> -- --check", "doctor_smoke"],
  ["artifact_read_only", "read artifact summary", "artifact_read"],
];

const SANDBOX_SPECS = [
  ["repo_local_workdir", "repo-local workdir"],
  ["tmp_artifact_dir", "tmp artifact dir"],
  ["no_global_install", "no global install"],
  ["no_home_secret_read", "no home secret read"],
  ["no_network_by_default", "no network by default"],
  ["no_cross_project_access", "no cross-project access"],
];

const REDACTION_SPECS = [
  ["stdout_redaction", "stdout redaction"],
  ["stderr_redaction", "stderr redaction"],
  ["env_redaction", "env redaction"],
  ["secret_pattern_scan", "secret pattern scan"],
  ["raw_material_redaction", "raw material redaction"],
];

const TIMEOUT_SPECS = [
  ["short_check_timeout", 30000, "short check timeout"],
  ["medium_test_timeout", 120000, "medium test timeout"],
  ["long_validation_timeout", 300000, "long validation timeout"],
  ["hard_kill_timeout", 600000, "hard-kill timeout"],
  ["heartbeat_timeout", 60000, "heartbeat timeout"],
];

const ROLLBACK_SPECS = [
  ["pre_execution_status", "pre execution status"],
  ["artifact_hash", "artifact hash"],
  ["file_restore_plan", "file restore plan"],
  ["reversal_note", "reversal note"],
  ["rollback_receipt", "rollback receipt"],
];

const DRY_RUN_SPECS = [
  ["dry_run_plan", "dry-run plan"],
  ["no_op_validation", "no-op validation"],
  ["evidence_preview", "evidence preview"],
  ["blocked_reason_preview", "blocked reason preview"],
  ["rollback_preview", "rollback preview"],
];

const CLAUDE_REVIEW_SPECS = [
  ["review_receipt_schema", "Claude Code Opus max review receipt schema"],
  ["review_scope", "controlled execution sandbox review scope"],
  ["review_evidence_ref", "review evidence ref"],
  ["review_finding_loop", "Claude finding loop"],
  ["review_receipt_observed", "Claude execution sandbox review receipt observed"],
];

const OPERATOR_PROJECTION_SPECS = [
  ["source_status", "source status"],
  ["missing_receipt", "missing receipt"],
  ["allowlist_state", "allowlist state"],
  ["sandbox_state", "sandbox state"],
  ["review_state", "review state"],
  ["next_action", "next action"],
];

export async function runControlledExecutionSandbox(options = {}) {
  const result = await buildControlledExecutionSandbox(options);
  if (options.write !== false) await writeControlledExecutionSandbox(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Controlled Execution Sandbox failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildControlledExecutionSandbox(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "domainPackSdkV2")
    ? normalizeInlineJsonSource("inline.domain_pack_sdk_v2", options.domainPackSdkV2)
    : await readJsonOrBuildDomainPackSdkV2(inputs.source_domain_pack_sdk_v2_path, generatedAt);
  const sandboxPolicy = Object.prototype.hasOwnProperty.call(options, "sandboxPolicyModel")
    ? normalizeInlineJsonSource("inline.sandbox_policy_model", options.sandboxPolicyModel)
    : await readJsonOrBuildSandboxPolicyModel(inputs.sandbox_policy_model_path, generatedAt);
  const claudeReview = Object.prototype.hasOwnProperty.call(options, "claudeExecutionReviewReceipt")
    ? normalizeInlineJsonSource("inline.claude_execution_review_receipt", options.claudeExecutionReviewReceipt)
    : await readJsonSource(inputs.claude_execution_review_receipt_path);

  const contract = buildContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceBindingRows(source, generatedAt);
  const receiptRows = buildReceiptRows(roadmapDoc.text, generatedAt);
  const allowlistRows = buildAllowlistRows(roadmapDoc.text, generatedAt);
  const sandboxRows = buildSandboxRows(roadmapDoc.text, sandboxPolicy, generatedAt);
  const redactionRows = buildRedactionRows(roadmapDoc.text, generatedAt);
  const timeoutRows = buildTimeoutRows(roadmapDoc.text, generatedAt);
  const rollbackRows = buildRollbackRows(roadmapDoc.text, generatedAt);
  const dryRunRows = buildDryRunRows(roadmapDoc.text, generatedAt);
  const claudeReviewRows = buildClaudeReviewRows(roadmapDoc.text, claudeReview, generatedAt);
  const operatorRows = buildOperatorProjectionRows(roadmapDoc.text, generatedAt);
  const freezeRows = buildFreezeRows({ sourceRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, dryRunRows, claudeReviewRows, operatorRows, generatedAt });
  const boundary = buildBoundary({ source, sourceRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, dryRunRows, claudeReviewRows, operatorRows, freezeRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, dryRunRows, claudeReviewRows, operatorRows, freezeRows, boundary });
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
      domain_pack_sdk_v2_path: source.path,
      sandbox_policy_model_path: sandboxPolicy.path,
      claude_execution_review_receipt_path: claudeReview.path,
    },
    source_domain_pack_sdk_v2_summary: source.data?.summary ?? null,
    observed_sandbox_policy_model_summary: sandboxPolicy.data?.summary ?? null,
    observed_claude_execution_review_summary: claudeReview.data?.summary ?? null,
    controlled_execution_sandbox_contract: contract,
    controlled_execution_phase_rows: phaseRows,
    controlled_execution_source_binding_rows: sourceRows,
    controlled_execution_receipt_rows: receiptRows,
    controlled_execution_allowlist_rows: allowlistRows,
    controlled_execution_sandbox_rows: sandboxRows,
    controlled_execution_redaction_rows: redactionRows,
    controlled_execution_timeout_rows: timeoutRows,
    controlled_execution_rollback_rows: rollbackRows,
    controlled_execution_dry_run_rows: dryRunRows,
    controlled_execution_claude_review_rows: claudeReviewRows,
    controlled_execution_operator_projection_rows: operatorRows,
    p12400_freeze_rows: freezeRows,
    controlled_execution_boundary: boundary,
    controlled_execution_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, dryRunRows, claudeReviewRows, operatorRows, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "controlled_execution_sandbox")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.controlled_execution_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.controlled_execution_validation_items);
  result.summary = buildSummary({ boundary, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, dryRunRows, claudeReviewRows, operatorRows, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeControlledExecutionSandbox(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "controlled-execution-sandbox.json"), serializableResult(result));
  await writeJson(path.join(outDir, "controlled-execution-phase-rows.json"), collectionEnvelope("controlled-execution-phase-rows.v1", "controlled_execution_phase_rows", result.controlled_execution_phase_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-source-binding-rows.json"), collectionEnvelope("controlled-execution-source-binding-rows.v1", "controlled_execution_source_binding_rows", result.controlled_execution_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-receipt-rows.json"), collectionEnvelope("controlled-execution-receipt-rows.v1", "controlled_execution_receipt_rows", result.controlled_execution_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-allowlist-rows.json"), collectionEnvelope("controlled-execution-allowlist-rows.v1", "controlled_execution_allowlist_rows", result.controlled_execution_allowlist_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-sandbox-rows.json"), collectionEnvelope("controlled-execution-sandbox-rows.v1", "controlled_execution_sandbox_rows", result.controlled_execution_sandbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-redaction-rows.json"), collectionEnvelope("controlled-execution-redaction-rows.v1", "controlled_execution_redaction_rows", result.controlled_execution_redaction_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-timeout-rows.json"), collectionEnvelope("controlled-execution-timeout-rows.v1", "controlled_execution_timeout_rows", result.controlled_execution_timeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-rollback-rows.json"), collectionEnvelope("controlled-execution-rollback-rows.v1", "controlled_execution_rollback_rows", result.controlled_execution_rollback_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-dry-run-rows.json"), collectionEnvelope("controlled-execution-dry-run-rows.v1", "controlled_execution_dry_run_rows", result.controlled_execution_dry_run_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-claude-review-rows.json"), collectionEnvelope("controlled-execution-claude-review-rows.v1", "controlled_execution_claude_review_rows", result.controlled_execution_claude_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-operator-projection-rows.json"), collectionEnvelope("controlled-execution-operator-projection-rows.v1", "controlled_execution_operator_projection_rows", result.controlled_execution_operator_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "p12400-freeze-rows.json"), collectionEnvelope("p12400-freeze-rows.v1", "p12400_freeze_rows", result.p12400_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-execution-boundary.json"), result.controlled_execution_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "controlled-execution-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.controlled_execution_validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runControlledExecutionSandboxCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runControlledExecutionSandbox(args);
    console.log(`Controlled Execution Sandbox ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.controlled_execution_sandbox_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Source ready for P12201: ${result.summary.source_ready_for_p12201_handoff}`);
    console.log(`Claude execution review receipt: ${result.summary.claude_execution_review_receipt_present_now}`);
    console.log(`Ready for P12401 handoff: ${result.summary.ready_for_p12401_handoff}`);
    console.log(`Command executed now: ${result.summary.actual_command_executed_now}`);
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
    contract_id: "controlled-execution-sandbox.contract.v1",
    generated_at: generatedAt,
    source_domain_pack_sdk_v2_required: true,
    claude_execution_review_required: true,
    receipt_gated_commands_required: true,
    allowlisted_commands_required: true,
    repo_local_sandbox_required: true,
    redaction_and_secret_scan_required: true,
    timeout_heartbeat_kill_required: true,
    rollback_and_evidence_binding_required: true,
    dry_run_no_op_ledger_required: true,
    operator_projection_read_only: true,
    actual_command_execution_allowed_now: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
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
    evidence_ref: `docs/hermes-roadmap-p12201-p12400.md#${phaseRange}`,
    phase_range: phaseRange,
    output_ref: output,
    generated_at: generatedAt,
  }));
}

function buildSourceBindingRows(source, generatedAt) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.domain_pack_sdk_boundary ?? {};
  const sourceStatus = summary.domain_pack_sdk_v2_status ?? "missing";
  const sourceReady = summary.ready_for_p12201_handoff === true;
  const sourceBlocked = source.available && sourceReady === false;
  return [
    ["source.available", "P12001-P12200 source artifact available", source.available],
    ["source.range", "P12001-P12200 source range", source.data?.program_range === SOURCE_PROGRAM_RANGE],
    ["source.status_visible", "P12200 source status visible", sourceStatus === "ready_for_domain_pack_sdk_v2" || sourceStatus === "blocked_domain_pack_sdk_v2"],
    ["source.handoff", "P12200 ready_for_p12201_handoff", sourceReady],
    ["source.block_visible", "P12200 blocker visible", sourceReady || sourceBlocked],
    ["source.sdk_contract", "P12200 SDK contract rows available", Number(summary.sdk_contract_row_count ?? 0) >= 36],
    ["source.no_write", "P12200 source did not open write or protected action", boundary.write_control_enabled === false && boundary.protected_action_enabled === false && boundary.connector_write_enabled === false],
    ["source.no_final_trust", "P12200 source did not open final approval production PASS or enterprise PASS", boundary.final_approval_ui_enabled === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false],
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

function buildReceiptRows(roadmapText, generatedAt) {
  return RECEIPT_SPECS.map(([receiptId, label]) => verdictRow({
    row_id: `receipt.${receiptId}`,
    category: "receipt_gate",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#controlled-execution-contract",
    generated_at: generatedAt,
    receipt_id: receiptId,
    receipt_required_before_execution: true,
    receipt_applied_now: false,
    actual_command_executed_now: false,
    mutation_allowed_now: false,
  }));
}

function buildAllowlistRows(roadmapText, generatedAt) {
  return ALLOWLIST_SPECS.map(([commandId, template, commandClass]) => verdictRow({
    row_id: `allowlist.${commandId}`,
    category: "command_allowlist",
    label: `${commandId}: ${template}`,
    required: true,
    observed: includesText(roadmapText, template) || includesText(roadmapText, commandId.replaceAll("_", " ")),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12221-P12240",
    generated_at: generatedAt,
    command_id: commandId,
    command_template: template,
    command_class: commandClass,
    allowlist_status: "contract_defined",
    requires_receipt: true,
    requires_repo_local_sandbox: true,
    requires_redaction: true,
    requires_timeout: true,
    requires_rollback_binding: true,
    command_execution_allowed_now: false,
    mutation_allowed_now: false,
    secret_read_allowed_now: false,
    network_allowed_by_default: false,
  }));
}

function buildSandboxRows(roadmapText, sandboxPolicy, generatedAt) {
  return SANDBOX_SPECS.map(([policyId, label]) => verdictRow({
    row_id: `sandbox.${policyId}`,
    category: "sandbox_policy",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12241-P12260",
    generated_at: generatedAt,
    sandbox_policy_id: policyId,
    source_sandbox_policy_model_available: sandboxPolicy.available === true,
    repo_local_only: true,
    global_install_allowed: false,
    home_secret_read_allowed: false,
    network_allowed_by_default: false,
    cross_project_access_allowed: false,
    sandbox_enforced_before_execution: true,
    workspace_mutation_allowed_now: false,
  }));
}

function buildRedactionRows(roadmapText, generatedAt) {
  return REDACTION_SPECS.map(([policyId, label]) => verdictRow({
    row_id: `redaction.${policyId}`,
    category: "redaction_secret_scan",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12261-P12280",
    generated_at: generatedAt,
    redaction_policy_id: policyId,
    redacted_evidence_ref_required: true,
    raw_output_persistence_allowed: false,
    raw_secret_persistence_allowed: false,
    raw_material_access_allowed_now: false,
  }));
}

function buildTimeoutRows(roadmapText, generatedAt) {
  return TIMEOUT_SPECS.map(([policyId, milliseconds, label]) => verdictRow({
    row_id: `timeout.${policyId}`,
    category: "timeout_heartbeat_kill",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12281-P12300",
    generated_at: generatedAt,
    timeout_policy_id: policyId,
    timeout_ms: milliseconds,
    timeout_required: true,
    heartbeat_required: policyId === "heartbeat_timeout",
    hard_kill_required: policyId === "hard_kill_timeout",
    command_execution_allowed_now: false,
  }));
}

function buildRollbackRows(roadmapText, generatedAt) {
  return ROLLBACK_SPECS.map(([bindingId, label]) => verdictRow({
    row_id: `rollback.${bindingId}`,
    category: "rollback_evidence_binding",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12301-P12320",
    generated_at: generatedAt,
    rollback_binding_id: bindingId,
    evidence_ref_required: true,
    rollback_target_required: true,
    rollback_mutation_allowed_now: false,
  }));
}

function buildDryRunRows(roadmapText, generatedAt) {
  return DRY_RUN_SPECS.map(([candidateId, label]) => verdictRow({
    row_id: `dry_run.${candidateId}`,
    category: "dry_run_no_op_candidate",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12321-P12340",
    generated_at: generatedAt,
    dry_run_candidate_id: candidateId,
    dry_run_only: true,
    no_op_required: true,
    actual_command_execution_evidence_present: false,
    pass_authority_allowed_now: false,
  }));
}

function buildClaudeReviewRows(roadmapText, claudeReview, generatedAt) {
  const reviewObserved = claudeReview.available === true
    && claudeReview.data?.review_engine === "claude_code_opus_max"
    && claudeReview.data?.receipt_status === "complete"
    && claudeReview.data?.scope_controlled_execution_sandbox === true;
  return CLAUDE_REVIEW_SPECS.map(([reviewId, label]) => {
    const observed = reviewId === "review_receipt_observed"
      ? reviewObserved
      : includesText(roadmapText, label.replace("Claude Code Opus max ", ""));
    return verdictRow({
      row_id: `claude_review.${reviewId}`,
      category: "claude_execution_review_gate",
      label,
      required: true,
      observed,
      evidence_ref: reviewId === "review_receipt_observed" ? claudeReview.path : "docs/hermes-roadmap-p12201-p12400.md#P12341-P12360",
      generated_at: generatedAt,
      review_id: reviewId,
      claude_review_required: true,
      claude_review_receipt_present_now: reviewObserved,
      claude_review_final_approval_allowed: false,
      finding_loop_required: true,
    });
  });
}

function buildOperatorProjectionRows(roadmapText, generatedAt) {
  return OPERATOR_PROJECTION_SPECS.map(([projectionId, label]) => verdictRow({
    row_id: `operator_projection.${projectionId}`,
    category: "operator_api_projection",
    label,
    required: true,
    observed: includesText(roadmapText, label),
    evidence_ref: "docs/hermes-roadmap-p12201-p12400.md#P12361-P12380",
    generated_at: generatedAt,
    projection_id: projectionId,
    api_methods_allowed: ["GET", "HEAD"],
    mutation_method_allowed_now: false,
    form_button_execution_enabled: false,
    final_approval_ui_enabled: false,
  }));
}

function buildFreezeRows(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const claudeReviewReady = context.claudeReviewRows.find((row) => row.row_id === "claude_review.review_receipt_observed")?.current_verdict === "pass";
  return [
    ["freeze.source", "P12200 source ready for P12201", sourceReady],
    ["freeze.source_block_visible", "P12200 source blocker visible when not ready", sourceReady || sourceBlockVisible],
    ["freeze.receipts", "receipt gate contract ready", allPass(context.receiptRows)],
    ["freeze.allowlist", "allowlist contract ready", allPass(context.allowlistRows)],
    ["freeze.sandbox", "sandbox profile contract ready", allPass(context.sandboxRows)],
    ["freeze.redaction", "redaction and secret scan contract ready", allPass(context.redactionRows)],
    ["freeze.timeout", "timeout heartbeat kill contract ready", allPass(context.timeoutRows)],
    ["freeze.rollback", "rollback and evidence binding ready", allPass(context.rollbackRows)],
    ["freeze.dry_run", "dry-run no-op candidate ledger ready", allPass(context.dryRunRows)],
    ["freeze.claude_review", "Claude execution sandbox review receipt ready", claudeReviewReady],
    ["freeze.operator_projection", "read-only operator/API projection ready", allPass(context.operatorRows)],
    ["freeze.no_unsafe_execution", "no actual execution write protected action secret read production PASS or enterprise PASS opened", true],
  ].map(([rowId, label, observed]) => verdictRow({
    row_id: rowId,
    category: "p12400_freeze",
    label,
    required: true,
    observed,
    evidence_ref: "p12400-freeze",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const sourceReady = context.sourceRows.find((row) => row.row_id === "source.handoff")?.current_verdict === "pass";
  const sourceAvailable = context.source.available === true;
  const sourceBlockVisible = context.sourceRows.find((row) => row.row_id === "source.block_visible")?.current_verdict === "pass";
  const claudeObserved = context.claudeReviewRows.find((row) => row.row_id === "claude_review.review_receipt_observed")?.current_verdict === "pass";
  const contractReady = allPass(context.receiptRows)
    && allPass(context.allowlistRows)
    && allPass(context.sandboxRows)
    && allPass(context.redactionRows)
    && allPass(context.timeoutRows)
    && allPass(context.rollbackRows)
    && allPass(context.dryRunRows)
    && allPass(context.operatorRows);
  const freezeReady = sourceReady && claudeObserved && contractReady && allPass(context.freezeRows);
  return {
    source_domain_pack_sdk_v2_available: sourceAvailable,
    source_ready_for_p12201_handoff: sourceReady,
    source_block_visible_now: sourceAvailable && sourceReady === false && sourceBlockVisible,
    claude_execution_review_receipt_present_now: claudeObserved,
    claude_execution_review_block_visible_now: claudeObserved === false,
    controlled_execution_contract_ready: contractReady,
    p12400_controlled_execution_sandbox_freeze_ready: freezeReady,
    ready_for_p12401_handoff: freezeReady,
    execution_candidate_allowed_with_receipt: freezeReady,
    actual_command_executed_now: false,
    receipt_applied_now: false,
    runtime_execution_allowed_now: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    network_allowed_by_default: false,
    secret_read_allowed_now: false,
    raw_body_exposure_allowed: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    unsafe_flag_count: 0,
  };
}

function buildValidationItems(context) {
  const items = [];
  const add = (itemId, category, ok, message, evidenceRef = itemId) => items.push(validationItem(itemId, category, ok, ok ? "ok" : message, evidenceRef));
  add("package.script", "package", Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME]), `${COMMAND_NAME} missing from package.json`, "package.json");
  add("package.validate.chain", "package", String(context.packageJson.data?.scripts?.validate ?? "").includes(COMMAND_NAME), `${COMMAND_NAME} missing from npm validate chain`, "package.json#scripts.validate");
  add("roadmap.phase.rows", "roadmap", context.phaseRows.length === 10 && allPass(context.phaseRows), "P12201-P12400 phase rows incomplete", "docs/hermes-roadmap-p12201-p12400.md");
  add("architecture.reference", "architecture", context.architectureDoc.available && context.architectureDoc.text.includes("P12201-P12400"), "Architecture doc missing P12201-P12400 reference", "docs/architecture.md");
  add("source.state", "source", context.sourceRows.length >= 8 && context.sourceRows.every((row) => row.row_id === "source.handoff" || row.current_verdict === "pass"), "P12200 source state must be available and blocker-visible", "controlled_execution_source_binding_rows");
  add("receipts.ready", "execution_contract", context.receiptRows.length === RECEIPT_SPECS.length && allPass(context.receiptRows), "Receipt gate rows incomplete", "controlled_execution_receipt_rows");
  add("allowlist.ready", "execution_contract", context.allowlistRows.length === ALLOWLIST_SPECS.length && allPass(context.allowlistRows), "Allowlist rows incomplete", "controlled_execution_allowlist_rows");
  add("sandbox.ready", "execution_contract", context.sandboxRows.length === SANDBOX_SPECS.length && allPass(context.sandboxRows), "Sandbox rows incomplete", "controlled_execution_sandbox_rows");
  add("redaction.ready", "execution_contract", context.redactionRows.length === REDACTION_SPECS.length && allPass(context.redactionRows), "Redaction rows incomplete", "controlled_execution_redaction_rows");
  add("timeout.ready", "execution_contract", context.timeoutRows.length === TIMEOUT_SPECS.length && allPass(context.timeoutRows), "Timeout rows incomplete", "controlled_execution_timeout_rows");
  add("rollback.ready", "execution_contract", context.rollbackRows.length === ROLLBACK_SPECS.length && allPass(context.rollbackRows), "Rollback rows incomplete", "controlled_execution_rollback_rows");
  add("dry_run.ready", "execution_contract", context.dryRunRows.length === DRY_RUN_SPECS.length && allPass(context.dryRunRows), "Dry-run rows incomplete", "controlled_execution_dry_run_rows");
  add("claude_review.block_visible", "review", context.claudeReviewRows.length === CLAUDE_REVIEW_SPECS.length && (context.boundary.claude_execution_review_block_visible_now === true || context.boundary.claude_execution_review_receipt_present_now === true), "Claude execution review missing without visible blocker", "controlled_execution_claude_review_rows");
  add("operator_projection.ready", "projection", context.operatorRows.length === OPERATOR_PROJECTION_SPECS.length && allPass(context.operatorRows), "Operator projection rows incomplete", "controlled_execution_operator_projection_rows");
  add("freeze.structure", "freeze", context.freezeRows.length >= 12, "P12400 freeze rows missing", "p12400_freeze_rows");
  add("boundary.no.execution", "boundary", context.boundary.actual_command_executed_now === false && context.boundary.receipt_applied_now === false && context.boundary.runtime_execution_allowed_now === false, "Controlled sandbox executed or applied a receipt", "controlled_execution_boundary");
  add("boundary.no.write", "boundary", context.boundary.write_control_enabled === false && context.boundary.protected_action_enabled === false && context.boundary.connector_write_enabled === false, "Controlled sandbox opened write/protected/connector mutation", "controlled_execution_boundary");
  add("boundary.no.secret.network", "boundary", context.boundary.secret_read_allowed_now === false && context.boundary.network_allowed_by_default === false && context.boundary.raw_body_exposure_allowed === false, "Controlled sandbox opened secret/network/raw exposure", "controlled_execution_boundary");
  add("boundary.no.final.trust", "boundary", context.boundary.final_approval_ui_enabled === false && context.boundary.codex_final_approval_ui_enabled === false && context.boundary.claude_final_approval_ui_enabled === false && context.boundary.production_pass_enabled === false && context.boundary.enterprise_pass_enabled === false, "Controlled sandbox opened final approval or trust PASS", "controlled_execution_boundary");
  add("boundary.handoff.state", "boundary", context.boundary.ready_for_p12401_handoff === context.boundary.p12400_controlled_execution_sandbox_freeze_ready, "P12401 handoff state must match P12400 freeze state", "controlled_execution_boundary");
  return items;
}

function buildSummary(context) {
  return {
    controlled_execution_sandbox_status: context.boundary.ready_for_p12401_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    source_ready_for_p12201_handoff: context.boundary.source_ready_for_p12201_handoff,
    source_block_visible_now: context.boundary.source_block_visible_now,
    claude_execution_review_receipt_present_now: context.boundary.claude_execution_review_receipt_present_now,
    claude_execution_review_block_visible_now: context.boundary.claude_execution_review_block_visible_now,
    receipt_count: context.receiptRows.length,
    allowlist_command_count: context.allowlistRows.length,
    sandbox_policy_count: context.sandboxRows.length,
    redaction_policy_count: context.redactionRows.length,
    timeout_policy_count: context.timeoutRows.length,
    rollback_binding_count: context.rollbackRows.length,
    dry_run_candidate_count: context.dryRunRows.length,
    operator_projection_count: context.operatorRows.length,
    p12400_controlled_execution_sandbox_freeze_ready: context.boundary.p12400_controlled_execution_sandbox_freeze_ready,
    ready_for_p12401_handoff: context.boundary.ready_for_p12401_handoff,
    execution_candidate_allowed_with_receipt: context.boundary.execution_candidate_allowed_with_receipt,
    actual_command_executed_now: false,
    runtime_execution_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_error_count: context.validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Controlled Execution Sandbox",
    "",
    `Status: ${result.summary.controlled_execution_sandbox_status}`,
    `Program: ${result.program_range}`,
    `Allowlist commands: ${result.summary.allowlist_command_count}`,
    `Sandbox policies: ${result.summary.sandbox_policy_count}`,
    `Source ready for P12201: ${result.summary.source_ready_for_p12201_handoff}`,
    `Claude review receipt present: ${result.summary.claude_execution_review_receipt_present_now}`,
    `Ready for P12401 handoff: ${result.summary.ready_for_p12401_handoff}`,
    `Command executed now: ${result.summary.actual_command_executed_now}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.controlled_execution_allowlist_rows.map((row) => `<tr><td>${escapeHtml(row.command_id)}</td><td>${escapeHtml(row.command_template)}</td><td>${escapeHtml(row.current_verdict)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Controlled Execution Sandbox</title>
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
    <h1>Hermes Controlled Execution Sandbox</h1>
    <p class="notice">Receipt-gated sandbox contract. Source and review blockers remain visible; command execution, mutation, final authority, and trust badges remain disabled.</p>
    <table><thead><tr><th>Command</th><th>Template</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildDomainPackSdkV2(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildDomainPackSdkV2({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.domain_pack_sdk_v2", built);
}

async function readJsonOrBuildSandboxPolicyModel(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  try {
    const built = await buildSandboxPolicyModel({ runAt: generatedAt, write: false });
    return normalizeInlineJsonSource("built.sandbox_policy_model", built);
  } catch (error) {
    return { available: false, path: filePath, text: "", data: null, error: error.message };
  }
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
    schema_path: options.schemaPath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.architectureDocPath,
    source_domain_pack_sdk_v2_path: options.sourceDomainPackSdkV2Path ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.sourceDomainPackSdkV2Path,
    sandbox_policy_model_path: options.sandboxPolicyModelPath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.sandboxPolicyModelPath,
    claude_execution_review_receipt_path: options.claudeExecutionReviewReceiptPath ?? DEFAULT_CONTROLLED_EXECUTION_SANDBOX_INPUTS.claudeExecutionReviewReceiptPath,
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
    else if (value === "--source-domain-pack-sdk-v2-path") args.sourceDomainPackSdkV2Path = argv[++index];
    else if (value === "--sandbox-policy-model-path") args.sandboxPolicyModelPath = argv[++index];
    else if (value === "--claude-execution-review-receipt-path") args.claudeExecutionReviewReceiptPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check]`);
  console.log("Creates the P12201-P12400 Controlled Execution Sandbox artifacts.");
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
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
