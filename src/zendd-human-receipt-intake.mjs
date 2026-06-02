import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddProtectedActionEscalation } from "./zendd-protected-action-escalation.mjs";
import { buildZenddVdrLddWorkflowAdapter } from "./zendd-vdr-ldd-workflow-adapter.mjs";

export const DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_OUT_DIR = "artifacts/zendd-human-receipt-intake/latest";
export const DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS = {
  schemaPath: "schemas/zendd-human-receipt-intake.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-human-receipt-intake";
const WORKFLOW_ADAPTER_COMMAND_NAME = "project:zendd-vdr-ldd-workflow-adapter";
const PROTECTED_ESCALATION_COMMAND_NAME = "project:zendd-protected-action-escalation";
const SCHEMA_VERSION = "zendd-human-receipt-intake.v1";
const CAPABILITY_ID = "project.zendd.human_receipt_intake";
const PHASE_RANGE = "P921-P940";
const PHASE_SLOT = "P921";
const PREVIOUS_PHASE_SLOT = "P920";
const NEXT_PHASE_SLOT = "P941";
const READY_STATUS = "ready_for_zendd_human_receipt_intake";

export async function runZenddHumanReceiptIntake(options = {}) {
  const result = await buildZenddHumanReceiptIntake(options);
  if (options.write !== false) await writeZenddHumanReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd human receipt intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddHumanReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const workflowAdapter = await buildZenddVdrLddWorkflowAdapter({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const protectedEscalation = await buildZenddProtectedActionEscalation({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });

  const policy = buildReceiptIntakePolicy(generatedAt, workflowAdapter, protectedEscalation);
  const templateRows = buildReceiptTemplateRows(workflowAdapter.vdr_ldd_workflow_adapter_rows, protectedEscalation.protected_action_human_gate_rows);
  const queueRows = buildReceiptQueueRows(templateRows);
  const validationPacketRows = buildReceiptValidationPacketRows(templateRows);
  const quarantineRows = buildReceiptQuarantineRows(generatedAt);
  const approvalCloseoutRows = buildApprovalCloseoutRows(templateRows);
  const failClosedRows = buildFailClosedRows({ policy, workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows });
  const closeoutRows = buildCloseoutRows({ policy, workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, workflowAdapter, protectedEscalation, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, workflowAdapter, protectedEscalation, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_human_receipt_intake_id: `zendd-human-receipt-intake.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    human_receipt_intake_anchor: anchor,
    source_vdr_ldd_workflow_adapter_summary: workflowAdapter.summary,
    source_protected_action_escalation_summary: protectedEscalation.summary,
    human_receipt_intake_policy: policy,
    zendd_receipt_template_rows: templateRows,
    zendd_receipt_queue_rows: queueRows,
    zendd_receipt_validation_packet_rows: validationPacketRows,
    zendd_receipt_quarantine_rows: quarantineRows,
    zendd_receipt_approval_closeout_rows: approvalCloseoutRows,
    zendd_receipt_fail_closed_rows: failClosedRows,
    zendd_receipt_intake_closeout_rows: closeoutRows,
    zendd_receipt_intake_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_human_receipt_intake")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_human_receipt_intake_id = result.zendd_human_receipt_intake_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddHumanReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-human-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "human-receipt-intake-policy.json"), result.human_receipt_intake_policy);
  await writeJson(path.join(outDir, "zendd-receipt-template-rows.json"), collectionEnvelope("zendd-human-receipt-template-rows.v1", "zendd_receipt_template_rows", result.zendd_receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-queue-rows.json"), collectionEnvelope("zendd-human-receipt-queue-rows.v1", "zendd_receipt_queue_rows", result.zendd_receipt_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-validation-packet-rows.json"), collectionEnvelope("zendd-human-receipt-validation-packet-rows.v1", "zendd_receipt_validation_packet_rows", result.zendd_receipt_validation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-quarantine-rows.json"), collectionEnvelope("zendd-human-receipt-quarantine-rows.v1", "zendd_receipt_quarantine_rows", result.zendd_receipt_quarantine_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-approval-closeout-rows.json"), collectionEnvelope("zendd-human-receipt-approval-closeout-rows.v1", "zendd_receipt_approval_closeout_rows", result.zendd_receipt_approval_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-fail-closed-rows.json"), collectionEnvelope("zendd-human-receipt-fail-closed-rows.v1", "zendd_receipt_fail_closed_rows", result.zendd_receipt_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-intake-closeout-rows.json"), collectionEnvelope("zendd-human-receipt-intake-closeout-rows.v1", "zendd_receipt_intake_closeout_rows", result.zendd_receipt_intake_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "zendd-receipt-intake-gate-rows.json"), collectionEnvelope("zendd-human-receipt-intake-gate-rows.v1", "zendd_receipt_intake_gate_rows", result.zendd_receipt_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-human-receipt-intake-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddHumanReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddHumanReceiptIntake(args);
    console.log(`Zendd human receipt intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_human_receipt_intake_status}`);
    console.log(`Receipt templates: ${result.summary.receipt_template_count}`);
    console.log(`Receipt queue rows: ${result.summary.receipt_queue_count}`);
    console.log(`Validation packets: ${result.summary.receipt_validation_packet_count}`);
    console.log(`Quarantine rows: ${result.summary.receipt_quarantine_count}`);
    console.log(`Receipt payload present: ${result.summary.receipt_payload_present}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReceiptIntakePolicy(generatedAt, workflowAdapter, protectedEscalation) {
  return {
    schema_version: "zendd-human-receipt-intake-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_vdr_ldd_workflow_adapter_ref: workflowAdapter.zendd_vdr_ldd_workflow_adapter_id,
    source_protected_action_escalation_ref: protectedEscalation.zendd_protected_action_escalation_id,
    receipt_intake_surface_creation_allowed: true,
    receipt_payload_present: false,
    receipt_payload_materialization_allowed_now: false,
    receipt_payload_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_pass_allowed_now: false,
    synthetic_receipt_allowed: false,
    unbound_receipt_allowed: false,
    cross_project_receipt_allowed: false,
    raw_receipt_attachment_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    receipt_pass_requires: [
      "receipt_template_ref",
      "claim_id",
      "source_ref",
      "evidence_ref",
      "reviewer_ref",
      "hard_gate_ref",
      "human_receipt_ref",
      "required_reviewer_role",
      "validated_receipt_payload",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "wait for explicit scoped human receipt payload and keep all protected Zendd claims blocked",
    created_at: generatedAt,
  };
}

function buildReceiptTemplateRows(workflowRows, humanGateRows) {
  const workflowTemplates = workflowRows.map((row, index) => {
    const key = normalizeKey(row.claim_id);
    return {
      schema_version: "zendd-human-receipt-template-row.v1",
      phase_slot: "P924-P926",
      row_id: `zendd-human-receipt-template.workflow.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      receipt_template_ref: `receipt-template.zendd.workflow.${key}`,
      source_type: "vdr_ldd_workflow_adapter",
      source_ref: row.workflow_adapter_ref,
      claim_id: row.claim_id,
      evidence_ref: row.source_trace_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_ref: row.human_receipt_ref,
      required_reviewer_role: "attorney_vdr_ldd_workflow_reviewer",
      required_receipt_fields: requiredReceiptFields(),
      receipt_scope_statement: "Human reviewer must approve the scoped Zendd VDR/LDD workflow claim using redacted evidence refs only.",
      receipt_payload_present: false,
      receipt_payload_materialized: false,
      synthetic_receipt_allowed: false,
      pass_without_receipt_allowed: false,
      current_verdict: "blocked",
      block_reason: "human_receipt_payload_missing",
      responsible_owner: "legal_domain_operator",
      next_allowed_action: "send scoped VDR/LDD workflow receipt template to authorized human reviewer",
    };
  });
  const protectedTemplates = humanGateRows.map((row, index) => {
    const key = normalizeKey(row.human_gate_ref);
    return {
      schema_version: "zendd-human-receipt-template-row.v1",
      phase_slot: "P924-P926",
      row_id: `zendd-human-receipt-template.protected.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      receipt_template_ref: `receipt-template.zendd.protected.${key}`,
      source_type: "protected_action_human_gate",
      source_ref: row.human_gate_ref,
      claim_id: row.protected_action_request_ref,
      evidence_ref: row.escalation_packet_ref,
      reviewer_ref: `review.${row.human_gate_ref}`,
      hard_gate_ref: row.human_gate_ref,
      human_receipt_ref: row.human_receipt_ref,
      required_reviewer_role: "operator_protected_action_reviewer",
      required_receipt_fields: requiredReceiptFields(),
      receipt_scope_statement: "Human reviewer must approve only the scoped protected-action request; this does not execute the action.",
      receipt_payload_present: false,
      receipt_payload_materialized: false,
      synthetic_receipt_allowed: false,
      pass_without_receipt_allowed: false,
      current_verdict: "blocked",
      block_reason: "human_receipt_payload_missing",
      responsible_owner: row.responsible_owner,
      next_allowed_action: "send protected-action receipt template to authorized human reviewer",
    };
  });
  return [...workflowTemplates, ...protectedTemplates];
}

function buildReceiptQueueRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-human-receipt-queue-row.v1",
    phase_slot: "P927-P929",
    row_id: `zendd-human-receipt-queue.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    receipt_queue_ref: `receipt-queue.zendd.${normalizeKey(row.receipt_template_ref)}`,
    receipt_template_ref: row.receipt_template_ref,
    claim_id: row.claim_id,
    source_type: row.source_type,
    source_ref: row.source_ref,
    required_reviewer_role: row.required_reviewer_role,
    queue_status: "queued_pending_human_input",
    receipt_payload_present: false,
    receipt_payload_materialized: false,
    raw_receipt_attachment_storage_allowed: false,
    synthetic_receipt_allowed: false,
    current_verdict: "blocked",
    block_reason: "receipt_payload_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "wait for explicit human receipt payload and keep claim blocked",
  }));
}

function buildReceiptValidationPacketRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-human-receipt-validation-packet-row.v1",
    phase_slot: "P930-P932",
    row_id: `zendd-human-receipt-validation-packet.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    receipt_validation_packet_ref: `receipt-validation-packet.zendd.${normalizeKey(row.receipt_template_ref)}`,
    receipt_template_ref: row.receipt_template_ref,
    claim_id: row.claim_id,
    source_ref: row.source_ref,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    validation_rules: ["identity_scope", "role_authority", "evidence_binding", "verdict_language", "redaction_ack", "timestamp_signature"],
    validation_allowed_now: false,
    receipt_payload_present: false,
    receipt_validated: false,
    pass_candidate_allowed_now: false,
    receipt_application_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "receipt_payload_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "run validation packet only after explicit receipt payload is supplied",
  }));
}

function buildReceiptQuarantineRows(generatedAt) {
  const rows = [
    ["unknown_claim_receipt", "receipt references an unknown Zendd claim"],
    ["cross_project_receipt", "receipt references a project other than project.zendd"],
    ["synthetic_receipt", "receipt appears generated or synthetic"],
    ["raw_vdr_attachment", "receipt payload includes raw VDR or client material"],
    ["secret_value_payload", "receipt payload includes secret-like values"],
    ["overbroad_scope", "receipt scope is broader than the bound claim"],
    ["missing_signature", "receipt lacks signature or acknowledgement ref"],
    ["role_mismatch", "reviewer role does not match the required authority"],
  ];
  return rows.map(([reason, description], index) => ({
    schema_version: "zendd-human-receipt-quarantine-row.v1",
    phase_slot: "P933-P935",
    row_id: `zendd-human-receipt-quarantine.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    quarantine_reason: reason,
    quarantine_description: description,
    quarantine_required: true,
    receipt_application_allowed_now: false,
    protected_pass_allowed_now: false,
    raw_receipt_attachment_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    synthetic_receipt_allowed: false,
    current_verdict: "blocked",
    block_reason: reason,
    responsible_owner: "receipt_intake_operator",
    next_allowed_action: "quarantine receipt candidate and request corrected scoped human receipt",
    created_at: generatedAt,
  }));
}

function buildApprovalCloseoutRows(templateRows) {
  return templateRows.map((row, index) => ({
    schema_version: "zendd-human-receipt-approval-closeout-row.v1",
    phase_slot: "P936-P938",
    row_id: `zendd-human-receipt-approval-closeout.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    receipt_template_ref: row.receipt_template_ref,
    claim_id: row.claim_id,
    source_ref: row.source_ref,
    human_receipt_ref: row.human_receipt_ref,
    human_receipt_ref_status: "missing",
    receipt_payload_present: false,
    receipt_validated: false,
    approval_application_allowed_now: false,
    protected_pass_allowed_now: false,
    receipt_application_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "validated_human_receipt_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "collect and validate human receipt before approval closeout can be reconsidered",
  }));
}

function buildFailClosedRows({ policy, workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows }) {
  const rows = [
    ["workflow_adapter_ready", workflowAdapter.validation.valid && workflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter", "P901-P920 workflow adapter is ready.", "repair VDR/LDD workflow adapter"],
    ["protected_escalation_ready", protectedEscalation.validation.valid && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation", "P841-P860 protected action escalation is ready.", "repair protected action escalation"],
    ["templates_blocked", templateRows.length >= 20 && templateRows.every(documentedTemplate), "Every source row has a blocked receipt template.", "complete receipt template rows"],
    ["queue_pending", queueRows.length === templateRows.length && queueRows.every(documentedQueue), "Receipt queue rows are pending human input.", "complete receipt queue rows"],
    ["validation_packets_future_only", validationPacketRows.length === templateRows.length && validationPacketRows.every(documentedValidationPacket), "Validation packets are future-only without payload.", "complete validation packet rows"],
    ["quarantine_policy_ready", quarantineRows.length >= 8 && quarantineRows.every(documentedQuarantine), "Malformed, synthetic, raw, secret, cross-project, or overbroad receipts are quarantined.", "complete receipt quarantine rows"],
    ["approval_closeout_blocked", approvalCloseoutRows.length === templateRows.length && approvalCloseoutRows.every(documentedApprovalCloseout), "Approval closeout rows keep protected PASS blocked.", "complete approval closeout rows"],
    ["no_payload_or_application", noReceiptApplication(policy) && [...templateRows, ...queueRows, ...validationPacketRows, ...approvalCloseoutRows].every(noPayloadOrApplication), "No receipt payload, validation, application, or protected PASS is materialized.", "restore receipt future-only policy"],
    ["no_synthetic_or_unbound_receipts", !policy.synthetic_receipt_allowed && !policy.unbound_receipt_allowed && !policy.cross_project_receipt_allowed, "Synthetic, unbound, and cross-project receipts are disallowed.", "restore receipt binding policy"],
    ["no_raw_or_secret_receipt_material", !policy.raw_receipt_attachment_storage_allowed && !policy.raw_vdr_or_client_material_copy_allowed_now && !policy.secret_read_allowed_now, "No raw receipt attachments, raw VDR/client material, or secret reads are allowed.", "restore receipt material boundary"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-human-receipt-fail-closed-row.v1",
    phase_slot: "P939",
    row_id: `zendd-human-receipt-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.human_receipt_intake.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    receipt_payload_present: false,
    receipt_payload_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_pass_allowed_now: false,
    synthetic_receipt_allowed: false,
    raw_receipt_attachment_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_human_receipt_intake_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ policy, workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows }) {
  const ready = workflowAdapter.validation.valid
    && workflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter"
    && protectedEscalation.validation.valid
    && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation"
    && policy.receipt_intake_surface_creation_allowed
    && noReceiptApplication(policy)
    && templateRows.every(documentedTemplate)
    && queueRows.every(documentedQueue)
    && validationPacketRows.every(documentedValidationPacket)
    && quarantineRows.every(documentedQuarantine)
    && approvalCloseoutRows.every(documentedApprovalCloseout)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-human-receipt-intake-closeout-row.v1",
    phase_slot: "P940",
    row_id: "zendd-human-receipt-intake-closeout.p940",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    human_receipt_intake_ready: ready,
    receipt_template_count: templateRows.length,
    receipt_queue_count: queueRows.length,
    receipt_validation_packet_count: validationPacketRows.length,
    receipt_quarantine_count: quarantineRows.length,
    receipt_approval_closeout_count: approvalCloseoutRows.length,
    receipt_payload_present: false,
    receipt_payload_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_pass_allowed_now: false,
    synthetic_receipt_allowed: false,
    raw_receipt_attachment_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P941-P960 recovery and incident drafts without applying receipts",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, workflowAdapter, protectedEscalation, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-human-receipt-intake-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    workflow_adapter_command_name: WORKFLOW_ADAPTER_COMMAND_NAME,
    protected_escalation_command_name: PROTECTED_ESCALATION_COMMAND_NAME,
    source_vdr_ldd_workflow_adapter_ref: workflowAdapter.zendd_vdr_ldd_workflow_adapter_id,
    source_vdr_ldd_workflow_adapter_status: workflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status,
    source_protected_action_escalation_ref: protectedEscalation.zendd_protected_action_escalation_id,
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    receipt_template_rows_hash: hashRows(templateRows, ["receipt_template_ref", "source_type", "receipt_payload_present"]),
    receipt_queue_rows_hash: hashRows(queueRows, ["receipt_queue_ref", "queue_status", "receipt_payload_present"]),
    validation_packet_rows_hash: hashRows(validationPacketRows, ["receipt_validation_packet_ref", "validation_allowed_now", "receipt_validated"]),
    quarantine_rows_hash: hashRows(quarantineRows, ["quarantine_reason", "quarantine_required", "current_verdict"]),
    approval_closeout_rows_hash: hashRows(approvalCloseoutRows, ["receipt_template_ref", "receipt_validated", "protected_pass_allowed_now"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "human_receipt_intake_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, workflowAdapter, protectedEscalation, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p921_workflow_adapter_ready", "P921", workflowAdapter.validation.valid && workflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter", "P901-P920 workflow adapter is ready.", "repair workflow adapter"),
    gateRow("p922_protected_escalation_ready", "P922", protectedEscalation.validation.valid && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation", "P841-P860 protected escalation is ready.", "repair protected action escalation"),
    gateRow("p923_policy_future_only", "P923", policy.receipt_intake_surface_creation_allowed && noReceiptApplication(policy), "Receipt intake policy creates a queue surface but keeps payloads, validation, application, and PASS disabled.", "restore receipt intake policy"),
    gateRow("p924_templates", "P924-P926", templateRows.length >= 20 && templateRows.every(documentedTemplate), "Receipt templates cover workflow and protected-action human gates.", "complete receipt templates"),
    gateRow("p927_queue", "P927-P929", queueRows.length === templateRows.length && queueRows.every(documentedQueue), "Receipt queue rows remain pending human input.", "complete receipt queue rows"),
    gateRow("p930_validation_packets", "P930-P932", validationPacketRows.length === templateRows.length && validationPacketRows.every(documentedValidationPacket), "Validation packets are declared but future-only.", "complete validation packet rows"),
    gateRow("p933_quarantine", "P933-P935", quarantineRows.length >= 8 && quarantineRows.every(documentedQuarantine), "Receipt quarantine rules block malformed, synthetic, raw, secret, and cross-project receipts.", "complete quarantine rows"),
    gateRow("p936_approval_closeout", "P936-P938", approvalCloseoutRows.length === templateRows.length && approvalCloseoutRows.every(documentedApprovalCloseout), "Approval closeout keeps every protected PASS blocked.", "complete approval closeout rows"),
    gateRow("p939_fail_closed", "P939", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no synthetic receipt, raw material, payload validation, application, or protected PASS.", "complete fail-closed fixtures"),
    gateRow("p940_closeout_ready", "P940", closeoutRows.every((row) => row.closeout_status === READY_STATUS && row.human_receipt_intake_ready), "P921-P940 closes with human receipt intake ready.", "complete human receipt intake closeout"),
    gateRow("package_script_registered", "P940", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P940", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P940", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P921-P940") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P921-P940.", "record P921-P940 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "human_receipt_intake_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.future_only", "receipt_boundary", noReceiptApplication(policy), "Receipt intake is future-only without payload validation or application."));
  items.push(validationItem("templates.blocked", "receipt_boundary", templateRows.every(documentedTemplate), "Receipt templates are blocked without payload."));
  items.push(validationItem("queue.pending", "receipt_boundary", queueRows.every(documentedQueue), "Receipt queues are pending human input."));
  items.push(validationItem("validation_packets.future_only", "receipt_boundary", validationPacketRows.every(documentedValidationPacket), "Validation packets are future-only."));
  items.push(validationItem("quarantine.ready", "receipt_boundary", quarantineRows.every(documentedQuarantine), "Quarantine rows block unsafe receipt candidates."));
  items.push(validationItem("approval_closeout.blocked", "receipt_boundary", approvalCloseoutRows.every(documentedApprovalCloseout), "Approval closeout rows keep PASS blocked."));
  items.push(validationItem("fail_closed.pass", "receipt_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS), "Closeout is ready without receipt application."));
  return items;
}

function buildSummary({ workflowAdapter, protectedEscalation, templateRows, queueRows, validationPacketRows, quarantineRows, approvalCloseoutRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_human_receipt_intake_status: validation.valid ? READY_STATUS : "documented_block_pending_human_receipt_intake",
    source_vdr_ldd_workflow_adapter_status: workflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status,
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    receipt_template_count: templateRows.length,
    receipt_queue_count: queueRows.length,
    receipt_validation_packet_count: validationPacketRows.length,
    receipt_quarantine_count: quarantineRows.length,
    receipt_approval_closeout_count: approvalCloseoutRows.length,
    receipt_fail_closed_count: failClosedRows.length,
    human_receipt_intake_ready: closeoutRows.every((row) => row.human_receipt_intake_ready),
    receipt_payload_present: false,
    receipt_payload_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_pass_allowed_now: false,
    synthetic_receipt_allowed: false,
    raw_receipt_attachment_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedTemplate(row) {
  return row.current_verdict === "blocked"
    && row.receipt_payload_present === false
    && row.receipt_payload_materialized === false
    && row.synthetic_receipt_allowed === false
    && row.pass_without_receipt_allowed === false
    && Boolean(row.receipt_template_ref)
    && Boolean(row.claim_id)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.required_reviewer_role)
    && row.required_receipt_fields?.length >= 7
    && documentedBlock(row);
}

function documentedQueue(row) {
  return row.current_verdict === "blocked"
    && row.queue_status === "queued_pending_human_input"
    && row.receipt_payload_present === false
    && row.receipt_payload_materialized === false
    && row.raw_receipt_attachment_storage_allowed === false
    && row.synthetic_receipt_allowed === false
    && Boolean(row.receipt_queue_ref)
    && Boolean(row.receipt_template_ref)
    && documentedBlock(row);
}

function documentedValidationPacket(row) {
  return row.current_verdict === "blocked"
    && row.validation_allowed_now === false
    && row.receipt_payload_present === false
    && row.receipt_validated === false
    && row.pass_candidate_allowed_now === false
    && row.receipt_application_allowed_now === false
    && row.validation_rules?.length >= 6
    && Boolean(row.receipt_validation_packet_ref)
    && Boolean(row.receipt_template_ref)
    && documentedBlock(row);
}

function documentedQuarantine(row) {
  return row.current_verdict === "blocked"
    && row.quarantine_required === true
    && row.receipt_application_allowed_now === false
    && row.protected_pass_allowed_now === false
    && row.raw_receipt_attachment_storage_allowed === false
    && row.raw_vdr_or_client_material_copy_allowed_now === false
    && row.secret_read_allowed_now === false
    && row.synthetic_receipt_allowed === false
    && Boolean(row.quarantine_reason)
    && documentedBlock(row);
}

function documentedApprovalCloseout(row) {
  return row.current_verdict === "blocked"
    && row.human_receipt_ref_status === "missing"
    && row.receipt_payload_present === false
    && row.receipt_validated === false
    && row.approval_application_allowed_now === false
    && row.protected_pass_allowed_now === false
    && row.receipt_application_allowed_now === false
    && Boolean(row.receipt_template_ref)
    && Boolean(row.human_receipt_ref)
    && documentedBlock(row);
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function noReceiptApplication(row) {
  return row.receipt_payload_present !== true
    && row.receipt_payload_materialization_allowed_now !== true
    && row.receipt_payload_validation_allowed_now !== true
    && row.validation_allowed_now !== true
    && row.receipt_validated !== true
    && row.receipt_application_allowed_now !== true
    && row.approval_application_allowed_now !== true
    && row.protected_pass_allowed_now !== true;
}

function noPayloadOrApplication(row) {
  return row.receipt_payload_present !== true
    && row.receipt_payload_materialized !== true
    && row.validation_allowed_now !== true
    && row.receipt_validated !== true
    && row.receipt_application_allowed_now !== true
    && row.approval_application_allowed_now !== true
    && row.protected_pass_allowed_now !== true;
}

function requiredReceiptFields() {
  return [
    "human_reviewer_id",
    "reviewer_role",
    "claim_id",
    "evidence_ref",
    "verdict",
    "scope_statement",
    "reviewed_at",
    "signature_or_ack_ref",
  ];
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-human-receipt-intake-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_human_receipt_intake_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_HUMAN_RECEIPT_INTAKE_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P921-P940 Zendd human receipt intake contract. --check validates
without materializing receipt payloads, validating or applying receipts,
promoting protected PASS, storing raw receipt attachments, copying raw VDR/client
material, reading secrets, or accepting synthetic receipts.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Human Receipt Intake Summary",
    "",
    `- Status: ${summary.zendd_human_receipt_intake_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Receipt templates: ${summary.receipt_template_count}`,
    `- Receipt queues: ${summary.receipt_queue_count}`,
    `- Validation packets: ${summary.receipt_validation_packet_count}`,
    `- Quarantine rows: ${summary.receipt_quarantine_count}`,
    `- Receipt payload present: ${summary.receipt_payload_present}`,
    `- Receipt application allowed: ${summary.receipt_application_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
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

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}
