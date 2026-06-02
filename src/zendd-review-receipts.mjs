import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddFactIssueBridge } from "./zendd-fact-issue-bridge.mjs";

export const DEFAULT_ZENDD_REVIEW_RECEIPTS_OUT_DIR = "artifacts/zendd-review-receipts/latest";
export const DEFAULT_ZENDD_REVIEW_RECEIPTS_INPUTS = {
  schemaPath: "schemas/zendd-review-receipts.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-review-receipts";
const FACT_ISSUE_COMMAND_NAME = "project:zendd-fact-issue-bridge";
const SCHEMA_VERSION = "zendd-review-receipts.v1";
const CAPABILITY_ID = "project.zendd.review_receipts";
const PHASE_RANGE = "P621-P640";
const PHASE_SLOT = "P621";
const PREVIOUS_PHASE_SLOT = "P620";
const NEXT_PHASE_SLOT = "P641";

export async function runZenddReviewReceipts(options = {}) {
  const result = await buildZenddReviewReceipts(options);
  if (options.write !== false) await writeZenddReviewReceipts(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd review receipts failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddReviewReceipts(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_REVIEW_RECEIPTS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const factIssue = await buildZenddFactIssueBridge({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildReceiptPolicy(generatedAt);
  const templateRows = buildReceiptTemplateRows(factIssue.fact_issue_review_binding_rows);
  const queueRows = buildReceiptQueueRows(templateRows);
  const ruleRows = buildReceiptValidationRuleRows(generatedAt);
  const workspaceRows = buildReceiptWorkspaceRows(templateRows);
  const approvalPlanRows = buildReceiptApprovalPlanRows(templateRows);
  const closeoutRows = buildReceiptCloseoutRows(templateRows);
  const freezeRows = buildReceiptFreezeRows(templateRows, closeoutRows);
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    factIssue,
    policy,
    templateRows,
    queueRows,
    ruleRows,
    workspaceRows,
    approvalPlanRows,
    closeoutRows,
    freezeRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    factIssue,
    policy,
    templateRows,
    queueRows,
    ruleRows,
    workspaceRows,
    approvalPlanRows,
    closeoutRows,
    freezeRows,
  });
  const validationItems = buildValidationItems({
    gateRows,
    policy,
    templateRows,
    queueRows,
    ruleRows,
    workspaceRows,
    approvalPlanRows,
    closeoutRows,
    freezeRows,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ factIssue, templateRows, queueRows, closeoutRows, freezeRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_review_receipts_id: `zendd-review-receipts.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    review_receipts_anchor: anchor,
    fact_issue_summary: factIssue.summary,
    review_receipt_policy: policy,
    receipt_template_rows: templateRows,
    receipt_queue_rows: queueRows,
    receipt_validation_rule_rows: ruleRows,
    receipt_workspace_rows: workspaceRows,
    receipt_approval_plan_rows: approvalPlanRows,
    receipt_closeout_rows: closeoutRows,
    receipt_freeze_rows: freezeRows,
    review_receipt_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_review_receipts")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ factIssue, templateRows, queueRows, closeoutRows, freezeRows, validation: result.validation });
  result.summary.zendd_review_receipts_id = result.zendd_review_receipts_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddReviewReceipts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-review-receipts.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-receipt-policy.json"), result.review_receipt_policy);
  await writeJson(path.join(outDir, "receipt-template-rows.json"), collectionEnvelope("zendd-receipt-template-rows.v1", "receipt_template_rows", result.receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-queue-rows.json"), collectionEnvelope("zendd-receipt-queue-rows.v1", "receipt_queue_rows", result.receipt_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-validation-rule-rows.json"), collectionEnvelope("zendd-receipt-validation-rule-rows.v1", "receipt_validation_rule_rows", result.receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workspace-rows.json"), collectionEnvelope("zendd-receipt-workspace-rows.v1", "receipt_workspace_rows", result.receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-approval-plan-rows.json"), collectionEnvelope("zendd-receipt-approval-plan-rows.v1", "receipt_approval_plan_rows", result.receipt_approval_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-closeout-rows.json"), collectionEnvelope("zendd-receipt-closeout-rows.v1", "receipt_closeout_rows", result.receipt_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-freeze-rows.json"), collectionEnvelope("zendd-receipt-freeze-rows.v1", "receipt_freeze_rows", result.receipt_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-review-receipts-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddReviewReceiptsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddReviewReceipts(args);
    console.log(`Zendd review receipts ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_review_receipts_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Receipt templates: ${result.summary.receipt_template_row_count}`);
    console.log(`Queued receipts: ${result.summary.receipt_queue_row_count}`);
    console.log(`Receipt payload present: ${result.summary.receipt_payload_present}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReceiptPolicy(generatedAt) {
  return {
    schema_version: "zendd-review-receipt-policy.v1",
    phase_slot: "P621",
    project_id: "project.zendd",
    receipt_payload_present: false,
    receipt_materialization_allowed_now: false,
    protected_pass_allowed_without_receipt: false,
    receipt_application_allowed_now: false,
    receipt_required_for: ["fact_claim", "issue_linkage", "source_contract", "client_output_trace", "privileged_source_exposure"],
    receipt_required_fields: ["human_reviewer_id", "reviewer_role", "claim_id", "evidence_ref", "verdict", "reviewed_at", "scope_statement", "signature_or_ack_ref"],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    verdict: "pass",
    next_allowed_action: "collect explicit human receipt before protected Zendd fact, issue, or client-output PASS",
    created_at: generatedAt,
  };
}

function buildReceiptTemplateRows(reviewRows) {
  return reviewRows.map((row, index) => {
    const role = requiredRoleFor(row);
    return {
      schema_version: "zendd-receipt-template-row.v1",
      phase_slot: "P622-P625",
      row_id: `zendd-receipt-template.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      binding_type: row.binding_type,
      evidence_ref: row.evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      receipt_template_ref: `receipt-template.zendd.${normalizeKey(row.claim_id)}`,
      required_reviewer_role: role,
      required_receipt_fields: ["human_reviewer_id", "reviewer_role", "claim_id", "evidence_ref", "verdict", "scope_statement"],
      receipt_payload_present: false,
      pass_without_receipt_allowed: false,
      current_verdict: "blocked_pending_human_receipt",
      block_reason: "human_receipt_missing",
      responsible_owner: "integration_operator",
      next_allowed_action: "send receipt template to required human reviewer",
    };
  });
}

function buildReceiptQueueRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-receipt-queue-row.v1",
    phase_slot: "P626-P628",
    row_id: `zendd-receipt-queue.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: row.claim_id,
    receipt_template_ref: row.receipt_template_ref,
    required_reviewer_role: row.required_reviewer_role,
    queue_status: "queued_pending_human_input",
    receipt_payload_present: false,
    current_verdict: "blocked",
    block_reason: "receipt_payload_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "wait for human receipt payload and keep claim blocked",
  }));
}

function buildReceiptValidationRuleRows(generatedAt) {
  const rows = [
    ["identity_scope", "receipt must identify human reviewer and scoped claim"],
    ["role_authority", "reviewer role must be authorized for the protected route"],
    ["evidence_binding", "receipt must bind evidence_ref, reviewer_ref, and hard_gate_ref"],
    ["verdict_language", "receipt verdict must be explicit approve, reject, or request_changes"],
    ["redaction_ack", "receipt must acknowledge redacted evidence and no raw VDR copy"],
    ["timestamp_signature", "receipt must carry reviewed_at and signature_or_ack_ref"],
  ];
  return rows.map(([ruleId, description], index) => ({
    schema_version: "zendd-receipt-validation-rule-row.v1",
    phase_slot: "P629-P631",
    row_id: `zendd-receipt-rule.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    rule_id: `receipt-rule.zendd.${ruleId}`,
    rule_description: description,
    validation_allowed_now: false,
    receipt_payload_present: false,
    current_verdict: "blocked_pending_receipt_payload",
    block_reason: "receipt_payload_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "apply validation rule only after receipt payload is supplied",
    created_at: generatedAt,
  }));
}

function buildReceiptWorkspaceRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-receipt-workspace-row.v1",
    phase_slot: "P632-P634",
    row_id: `zendd-receipt-workspace.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: row.claim_id,
    receipt_template_ref: row.receipt_template_ref,
    workspace_ref: `receipt-workspace.zendd.${normalizeKey(row.claim_id)}`,
    workspace_materialized_now: false,
    receipt_input_materialized: false,
    current_verdict: "blocked",
    block_reason: "receipt_workspace_not_materialized",
    responsible_owner: "integration_operator",
    next_allowed_action: "create receipt workspace only after explicit human-review collection step",
  }));
}

function buildReceiptApprovalPlanRows(templateRows) {
  const byRole = [...new Set(templateRows.map((row) => row.required_reviewer_role))].sort();
  return byRole.map((role, index) => ({
    schema_version: "zendd-receipt-approval-plan-row.v1",
    phase_slot: "P635-P636",
    row_id: `zendd-receipt-approval-plan.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    required_reviewer_role: role,
    claim_count: templateRows.filter((row) => row.required_reviewer_role === role).length,
    approval_application_allowed_now: false,
    receipt_payload_present: false,
    current_verdict: "blocked",
    block_reason: "approval_receipts_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "collect and validate role-appropriate receipts before approval application",
  }));
}

function buildReceiptCloseoutRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-receipt-closeout-row.v1",
    phase_slot: "P637-P638",
    row_id: `zendd-receipt-closeout.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: row.claim_id,
    receipt_template_ref: row.receipt_template_ref,
    human_receipt_ref_status: "missing",
    receipt_validated: false,
    protected_pass_allowed: false,
    current_verdict: "blocked",
    block_reason: "validated_human_receipt_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "validate receipt before changing claim verdict",
  }));
}

function buildReceiptFreezeRows(templateRows, closeoutRows) {
  return closeoutRows.map((row, index) => ({
    schema_version: "zendd-receipt-freeze-row.v1",
    phase_slot: "P639-P640",
    row_id: `zendd-receipt-freeze.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: row.claim_id,
    receipt_template_ref: row.receipt_template_ref,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: templateRows[index]?.next_allowed_action ?? row.next_allowed_action,
  }));
}

function requiredRoleFor(row) {
  if (row.issue_ref?.includes("client_output") || row.claim_id.includes("client_output")) return "attorney_client_output_reviewer";
  if (row.issue_ref?.includes("privileged") || row.claim_id.includes("privileged")) return "attorney_privilege_reviewer";
  if (row.binding_type === "issue_linkage") return "attorney_issue_reviewer";
  return "attorney_fact_reviewer";
}

function buildAnchor({ packageJson, phaseLedger, factIssue, policy, templateRows, queueRows, ruleRows, workspaceRows, approvalPlanRows, closeoutRows, freezeRows }) {
  return {
    schema_version: "zendd-review-receipts-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    fact_issue_command_name: FACT_ISSUE_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    fact_issue_summary_hash: hashValue(factIssue.summary),
    receipt_policy_hash: hashValue(policy),
    receipt_template_hash: hashRows(templateRows, ["claim_id", "required_reviewer_role", "receipt_payload_present", "pass_without_receipt_allowed"]),
    receipt_queue_hash: hashRows(queueRows, ["claim_id", "queue_status", "receipt_payload_present", "next_allowed_action"]),
    receipt_rule_hash: hashRows(ruleRows, ["rule_id", "validation_allowed_now", "receipt_payload_present"]),
    receipt_workspace_hash: hashRows(workspaceRows, ["claim_id", "workspace_materialized_now", "receipt_input_materialized"]),
    receipt_approval_plan_hash: hashRows(approvalPlanRows, ["required_reviewer_role", "approval_application_allowed_now", "claim_count"]),
    receipt_closeout_hash: hashRows(closeoutRows, ["claim_id", "receipt_validated", "protected_pass_allowed", "next_allowed_action"]),
    receipt_freeze_hash: hashRows(freezeRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, factIssue, policy, templateRows, queueRows, ruleRows, workspaceRows, approvalPlanRows, closeoutRows, freezeRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p621_policy_declared", "P621", !policy.receipt_payload_present && !policy.protected_pass_allowed_without_receipt && !policy.receipt_application_allowed_now, "Review receipt policy blocks protected PASS and receipt application until human receipt exists.", "declare review receipt policy"),
    gateRow("p622_templates_cover_review_rows", "P622-P625", templateRows.length === factIssue.fact_issue_review_binding_rows.length && templateRows.every((row) => row.receipt_template_ref && !row.pass_without_receipt_allowed), "Every fact/issue review row has a receipt template.", "complete receipt templates"),
    gateRow("p626_queue_rows_pending", "P626-P628", queueRows.length === templateRows.length && queueRows.every((row) => row.queue_status === "queued_pending_human_input" && !row.receipt_payload_present), "Every receipt template is queued without payload.", "complete receipt queue rows"),
    gateRow("p629_validation_rules_future_only", "P629-P631", ruleRows.length >= 6 && ruleRows.every((row) => !row.validation_allowed_now && !row.receipt_payload_present), "Receipt validation rules are declared but not applied without payload.", "complete validation rule rows"),
    gateRow("p632_workspace_not_materialized", "P632-P634", workspaceRows.length === templateRows.length && workspaceRows.every((row) => !row.workspace_materialized_now && !row.receipt_input_materialized), "Receipt workspaces are declared only and no receipt input is materialized.", "complete receipt workspace rows"),
    gateRow("p635_approval_plan_blocked", "P635-P636", approvalPlanRows.length >= 2 && approvalPlanRows.every((row) => !row.approval_application_allowed_now && row.block_reason), "Approval plans stay blocked pending validated receipts.", "complete receipt approval plan rows"),
    gateRow("p637_closeout_blocks_pass", "P637-P638", closeoutRows.length === templateRows.length && closeoutRows.every((row) => !row.receipt_validated && !row.protected_pass_allowed && row.current_verdict === "blocked"), "Closeout rows block protected PASS until receipt validation.", "complete receipt closeout rows"),
    gateRow("p639_freeze_rows_document_blocks", "P639-P640", freezeRows.length === templateRows.length && freezeRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Receipt freeze rows document BLOCK with next action.", "complete receipt freeze rows"),
    gateRow("package_script_registered", "P640", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P640", phaseLedger.available && phaseLedger.text.includes("P621-P640") && phaseLedger.text.includes(COMMAND_NAME), "P621-P640 phase ledger declares review receipt acceptance.", "record P621-P640 in phase ledger"),
    gateRow("fact_issue_chain_valid", "P640", factIssue.validation.valid && factIssue.summary.zendd_fact_issue_bridge_status === "ready_for_review_receipt_bridge", "P601-P620 fact/issue bridge remains valid before review receipts.", "repair fact/issue validation before review receipts"),
  ];
}

function buildValidationItems({ gateRows, policy, templateRows, queueRows, ruleRows, workspaceRows, approvalPlanRows, closeoutRows, freezeRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "review_receipt_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.protected_pass_without_receipt", "receipt_boundary", policy.protected_pass_allowed_without_receipt === false, "Protected PASS requires receipt"));
  items.push(validationItem("policy.receipt_payload_present", "receipt_boundary", policy.receipt_payload_present === false, "No receipt payload is present in bridge phase"));
  items.push(validationItem("templates.no_pass_without_receipt", "receipt_boundary", templateRows.every((row) => row.pass_without_receipt_allowed === false && row.receipt_template_ref), "Receipt templates block PASS without receipt"));
  items.push(validationItem("queue.pending", "receipt_boundary", queueRows.every((row) => row.queue_status === "queued_pending_human_input" && row.receipt_payload_present === false), "Receipt queue rows remain pending"));
  items.push(validationItem("rules.future_only", "receipt_boundary", ruleRows.every((row) => row.validation_allowed_now === false && row.receipt_payload_present === false), "Validation rules are future-only without payload"));
  items.push(validationItem("workspace.no_materialized_input", "receipt_boundary", workspaceRows.every((row) => row.workspace_materialized_now === false && row.receipt_input_materialized === false), "Receipt workspaces do not materialize input"));
  items.push(validationItem("approval.blocked", "receipt_boundary", approvalPlanRows.every((row) => row.approval_application_allowed_now === false && row.block_reason), "Approval plans stay blocked"));
  items.push(validationItem("closeout.blocks_pass", "claim_boundary", closeoutRows.every((row) => row.receipt_validated === false && row.protected_pass_allowed === false), "Closeout rows block protected PASS"));
  items.push(validationItem("freeze.next_allowed_action", "claim_boundary", freezeRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Freeze rows document blocks with next actions"));
  return items;
}

function buildSummary({ factIssue, templateRows, queueRows, closeoutRows, freezeRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_review_receipts_status: validation.valid
      ? "ready_for_client_output_gate_fusion"
      : "documented_block_pending_review_receipt_gate",
    zendd_project_root: factIssue.summary.zendd_project_root,
    zendd_git_head_short: factIssue.summary.zendd_git_head_short,
    fact_issue_status: factIssue.summary.zendd_fact_issue_bridge_status,
    receipt_template_row_count: templateRows.length,
    receipt_queue_row_count: queueRows.length,
    receipt_closeout_row_count: closeoutRows.length,
    freeze_row_count: freezeRows.length,
    receipt_payload_present: false,
    receipt_application_allowed_now: false,
    protected_pass_allowed_without_receipt: false,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-review-receipt-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_review_receipt_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_REVIEW_RECEIPTS_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_REVIEW_RECEIPTS_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_REVIEW_RECEIPTS_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_REVIEW_RECEIPTS_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.phaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P621-P640 Zendd-Hermes human review receipt bridge.
--check validates without writing artifacts, materializing receipts, or applying protected approvals.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Review Receipts Summary",
    "",
    `- Status: ${summary.zendd_review_receipts_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Receipt templates: ${summary.receipt_template_row_count}`,
    `- Queued receipts: ${summary.receipt_queue_row_count}`,
    `- Closeout rows: ${summary.receipt_closeout_row_count}`,
    `- Freeze rows: ${summary.freeze_row_count}`,
    `- Receipt payload present: ${summary.receipt_payload_present}`,
    `- Receipt application allowed now: ${summary.receipt_application_allowed_now}`,
    `- Protected PASS without receipt allowed: ${summary.protected_pass_allowed_without_receipt}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.review_receipt_policy.next_allowed_action,
    "",
  ].join("\n");
}
