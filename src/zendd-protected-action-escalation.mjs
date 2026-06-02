import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddCommandEvidenceExecutionBridge } from "./zendd-command-evidence-execution-bridge.mjs";
import { buildZenddProtectedActionRollback } from "./zendd-protected-action-rollback.mjs";

export const DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_OUT_DIR = "artifacts/zendd-protected-action-escalation/latest";
export const DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS = {
  schemaPath: "schemas/zendd-protected-action-escalation.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-protected-action-escalation";
const COMMAND_EXECUTION_BRIDGE_COMMAND_NAME = "project:zendd-command-evidence-execution-bridge";
const PROTECTED_ACTION_ROLLBACK_COMMAND_NAME = "project:zendd-protected-action-rollback";
const SCHEMA_VERSION = "zendd-protected-action-escalation.v1";
const CAPABILITY_ID = "project.zendd.protected_action_escalation";
const PHASE_RANGE = "P841-P860";
const PHASE_SLOT = "P841";
const PREVIOUS_PHASE_SLOT = "P840";
const NEXT_PHASE_SLOT = "P861";
const READY_STATUS = "ready_for_zendd_protected_action_escalation";

export async function runZenddProtectedActionEscalation(options = {}) {
  const result = await buildZenddProtectedActionEscalation(options);
  if (options.write !== false) await writeZenddProtectedActionEscalation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd protected action escalation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddProtectedActionEscalation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const commandExecutionBridge = await buildZenddCommandEvidenceExecutionBridge({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const protectedRollback = await buildZenddProtectedActionRollback({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });

  const policy = buildEscalationPolicy(generatedAt, commandExecutionBridge, protectedRollback);
  const commandRequestRows = buildCommandEscalationRequestRows(commandExecutionBridge.protected_command_execution_block_rows);
  const domainRequestRows = buildDomainEscalationRequestRows(protectedRollback.protected_action_rows);
  const packetRows = buildEscalationPacketRows([...commandRequestRows, ...domainRequestRows]);
  const humanGateRows = buildHumanGateRequirementRows(packetRows);
  const failClosedRows = buildFailClosedRows({ policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows });
  const closeoutRows = buildCloseoutRows({ commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_protected_action_escalation_id: `zendd-protected-action-escalation.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    protected_action_escalation_anchor: anchor,
    source_command_evidence_execution_bridge_summary: commandExecutionBridge.summary,
    source_protected_action_rollback_summary: protectedRollback.summary,
    protected_action_escalation_policy: policy,
    command_protected_action_request_rows: commandRequestRows,
    domain_protected_action_request_rows: domainRequestRows,
    protected_action_escalation_packet_rows: packetRows,
    protected_action_human_gate_rows: humanGateRows,
    protected_action_fail_closed_rows: failClosedRows,
    protected_action_escalation_closeout_rows: closeoutRows,
    protected_action_escalation_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ commandExecutionBridge, protectedRollback, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_protected_action_escalation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ commandExecutionBridge, protectedRollback, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_protected_action_escalation_id = result.zendd_protected_action_escalation_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddProtectedActionEscalation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-protected-action-escalation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "protected-action-escalation-policy.json"), result.protected_action_escalation_policy);
  await writeJson(path.join(outDir, "command-protected-action-request-rows.json"), collectionEnvelope("zendd-command-protected-action-request-rows.v1", "command_protected_action_request_rows", result.command_protected_action_request_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-protected-action-request-rows.json"), collectionEnvelope("zendd-domain-protected-action-request-rows.v1", "domain_protected_action_request_rows", result.domain_protected_action_request_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-escalation-packet-rows.json"), collectionEnvelope("zendd-protected-action-escalation-packet-rows.v1", "protected_action_escalation_packet_rows", result.protected_action_escalation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-human-gate-rows.json"), collectionEnvelope("zendd-protected-action-human-gate-rows.v1", "protected_action_human_gate_rows", result.protected_action_human_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-fail-closed-rows.json"), collectionEnvelope("zendd-protected-action-fail-closed-rows.v1", "protected_action_fail_closed_rows", result.protected_action_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-escalation-closeout-rows.json"), collectionEnvelope("zendd-protected-action-escalation-closeout-rows.v1", "protected_action_escalation_closeout_rows", result.protected_action_escalation_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-escalation-gate-rows.json"), collectionEnvelope("zendd-protected-action-escalation-gate-rows.v1", "protected_action_escalation_gate_rows", result.protected_action_escalation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-protected-action-escalation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddProtectedActionEscalationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddProtectedActionEscalation(args);
    console.log(`Zendd protected action escalation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_protected_action_escalation_status}`);
    console.log(`Command requests: ${result.summary.command_protected_action_request_count}`);
    console.log(`Domain requests: ${result.summary.domain_protected_action_request_count}`);
    console.log(`Escalation packets: ${result.summary.protected_action_escalation_packet_count}`);
    console.log(`Human gates: ${result.summary.protected_action_human_gate_count}`);
    console.log(`Protected action execution allowed: ${result.summary.protected_action_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildEscalationPolicy(generatedAt, commandExecutionBridge, protectedRollback) {
  return {
    schema_version: "zendd-protected-action-escalation-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_command_evidence_execution_bridge_ref: commandExecutionBridge.zendd_command_evidence_execution_bridge_id,
    source_protected_action_rollback_ref: protectedRollback.zendd_protected_action_rollback_id,
    escalation_queue_open: true,
    protected_action_execution_allowed_now: false,
    command_execution_allowed_now: false,
    release_package_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    physical_code_move_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    synthetic_receipt_allowed: false,
    escalation_pass_requires: [
      "protected_action_request_ref",
      "escalation_packet_ref",
      "evidence_ref",
      "hard_gate_ref",
      "human_receipt_ref",
      "rollback_target_ref",
      "responsible_owner",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "collect explicit human receipt and validated protected action work order before any future protected execution",
    created_at: generatedAt,
  };
}

function buildCommandEscalationRequestRows(blockRows) {
  return blockRows.map((row, index) => {
    const key = normalizeKey(`${row.command_scope}.${row.script_name}.${row.protected_action_class}`);
    return {
      schema_version: "zendd-command-protected-action-request-row.v1",
      phase_slot: "P843-P846",
      row_id: `zendd-command-protected-action-request.row.${String(index + 1).padStart(3, "0")}`,
      project_id: "project.zendd",
      protected_action_request_ref: `protected-action-request.zendd.command.${key}`,
      source_type: "command_execution_block",
      source_ref: row.command_execution_block_id,
      claim_id: row.claim_id,
      command_scope: row.command_scope,
      script_name: row.script_name,
      protected_action_class: row.protected_action_class,
      evidence_ref: row.command_execution_evidence_ref,
      hard_gate_ref: row.hard_gate_ref,
      human_receipt_ref: row.documented_human_gate_ref ?? `receipt.zendd.command_escalation.${key}`,
      human_receipt_required: true,
      rollback_target_ref: row.rollback_target_ref,
      reviewer_ref: `review.zendd.protected.command.${key}`,
      escalation_packet_ref: `packet.zendd.protected.command.${key}`,
      request_payload_present: false,
      protected_action_execution_allowed_now: false,
      current_verdict: "blocked",
      block_reason: row.human_receipt_required === false
        ? "artifact_isolation_work_order_and_human_receipt_missing"
        : row.block_reason,
      responsible_owner: row.responsible_owner,
      next_allowed_action: `open protected action work order for ${row.protected_action_class} with human receipt and rollback target`,
    };
  });
}

function buildDomainEscalationRequestRows(protectedActionRows) {
  return protectedActionRows.map((row, index) => ({
    schema_version: "zendd-domain-protected-action-request-row.v1",
    phase_slot: "P847-P850",
    row_id: `zendd-domain-protected-action-request.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    protected_action_request_ref: `protected-action-request.zendd.domain.${normalizeKey(row.action_id)}`,
    source_type: "protected_action_rollback",
    source_ref: row.action_id,
    action_type: row.action_type,
    protected_action_class: row.action_type,
    evidence_ref: row.evidence_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    human_receipt_required: true,
    recovery_receipt_ref: row.recovery_receipt_ref,
    rollback_target_ref: row.rollback_target_ref,
    reviewer_ref: `review.zendd.protected.domain.${normalizeKey(row.action_id)}`,
    escalation_packet_ref: `packet.zendd.protected.domain.${normalizeKey(row.action_id)}`,
    request_payload_present: false,
    protected_action_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
  }));
}

function buildEscalationPacketRows(requestRows) {
  return requestRows.map((row, index) => ({
    schema_version: "zendd-protected-action-escalation-packet-row.v1",
    phase_slot: "P851-P854",
    row_id: `zendd-protected-action-escalation-packet.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    escalation_packet_ref: row.escalation_packet_ref,
    protected_action_request_ref: row.protected_action_request_ref,
    source_type: row.source_type,
    source_ref: row.source_ref,
    protected_action_class: row.protected_action_class,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    rollback_target_ref: row.rollback_target_ref,
    packet_status: "draft_only_not_submitted",
    request_payload_present: false,
    human_receipt_payload_present: false,
    human_receipt_validated: false,
    pass_candidate_allowed_now: false,
    protected_action_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "escalation_packet_missing_human_receipt_and_validated_work_order",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "collect human receipt, validate protected action packet, and keep execution disabled until future gate",
  }));
}

function buildHumanGateRequirementRows(packetRows) {
  return packetRows.map((row, index) => ({
    schema_version: "zendd-protected-action-human-gate-row.v1",
    phase_slot: "P855-P856",
    row_id: `zendd-protected-action-human-gate.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    human_gate_ref: `human-gate.zendd.protected.${normalizeKey(row.escalation_packet_ref)}`,
    escalation_packet_ref: row.escalation_packet_ref,
    protected_action_request_ref: row.protected_action_request_ref,
    human_receipt_ref: row.human_receipt_ref,
    human_receipt_required: true,
    synthetic_receipt_allowed: false,
    human_receipt_payload_present: false,
    human_receipt_validated: false,
    pass_without_human_receipt_allowed: false,
    protected_action_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "human_receipt_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "wait for explicit human receipt before protected action can be reconsidered",
  }));
}

function buildFailClosedRows({ policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows }) {
  const allRequests = [...commandRequestRows, ...domainRequestRows];
  const classSet = new Set(allRequests.map((row) => row.protected_action_class));
  const requiredClasses = ["database_migration", "release_package", "client_output_export", "receipt_application", "rollback_execution", "build_artifact"];
  const rows = [
    ["source_requests_documented", allRequests.length >= 1 && allRequests.every(documentedRequest), "All command and domain protected requests are documented BLOCK.", "document protected action request rows"],
    ["required_classes_covered", requiredClasses.every((className) => classSet.has(className)), "Required protected classes are covered by escalation rows.", "add missing protected action classes"],
    ["packets_draft_only", packetRows.length === allRequests.length && packetRows.every(documentedPacket), "Escalation packets are draft-only and not executable.", "prepare non-executable escalation packet rows"],
    ["human_gates_required", humanGateRows.length === packetRows.length && humanGateRows.every(documentedHumanGate), "Every packet has a human gate and no synthetic receipt.", "bind human gate rows"],
    ["no_protected_execution", !policy.protected_action_execution_allowed_now && allRequests.every((row) => row.protected_action_execution_allowed_now === false), "Protected action execution remains disabled.", "disable protected action execution"],
    ["no_receipt_application", !policy.receipt_application_allowed_now && packetRows.every((row) => row.receipt_application_allowed_now === false), "Receipt application remains disabled.", "keep receipt application future-only"],
    ["no_rollback_execution", !policy.rollback_execution_allowed_now && packetRows.every((row) => row.rollback_execution_allowed_now === false), "Rollback execution remains disabled.", "keep rollback execution future-only"],
    ["no_raw_or_secret_access", !policy.raw_material_copy_allowed_now && !policy.secret_read_allowed_now, "No raw material copy or secret read is allowed.", "restore reference-only protected action inputs"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-protected-action-fail-closed-row.v1",
    phase_slot: "P857-P858",
    row_id: `zendd-protected-action-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.protected_action_escalation.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    protected_action_execution_allowed_now: false,
    command_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    synthetic_receipt_allowed: false,
    message,
    next_allowed_action: passed ? "continue_to_next_protected_action_escalation_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows }) {
  const ready = commandExecutionBridge.validation.valid
    && commandExecutionBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge"
    && protectedRollback.validation.valid
    && protectedRollback.summary.zendd_protected_action_rollback_status === "ready_for_physical_integration_decision"
    && policy.escalation_queue_open
    && !policy.protected_action_execution_allowed_now
    && [...commandRequestRows, ...domainRequestRows].every(documentedRequest)
    && packetRows.every(documentedPacket)
    && humanGateRows.every(documentedHumanGate)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-protected-action-escalation-closeout-row.v1",
    phase_slot: "P860",
    row_id: "zendd-protected-action-escalation-closeout.p860",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    protected_action_escalation_ready: ready,
    command_protected_action_request_count: commandRequestRows.length,
    domain_protected_action_request_count: domainRequestRows.length,
    escalation_packet_count: packetRows.length,
    human_gate_count: humanGateRows.length,
    fail_closed_count: failClosedRows.length,
    protected_action_execution_allowed_now: false,
    command_execution_allowed_now: false,
    release_package_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    synthetic_receipt_allowed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P861-P880 diff review and rollback binding before applying any Zendd change",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-protected-action-escalation-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    command_execution_bridge_command_name: COMMAND_EXECUTION_BRIDGE_COMMAND_NAME,
    protected_action_rollback_command_name: PROTECTED_ACTION_ROLLBACK_COMMAND_NAME,
    source_command_evidence_execution_bridge_ref: commandExecutionBridge.zendd_command_evidence_execution_bridge_id,
    source_command_evidence_execution_bridge_status: commandExecutionBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_protected_action_rollback_ref: protectedRollback.zendd_protected_action_rollback_id,
    source_protected_action_rollback_status: protectedRollback.summary.zendd_protected_action_rollback_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    command_request_rows_hash: hashRows(commandRequestRows, ["protected_action_request_ref", "protected_action_class", "current_verdict"]),
    domain_request_rows_hash: hashRows(domainRequestRows, ["protected_action_request_ref", "protected_action_class", "current_verdict"]),
    packet_rows_hash: hashRows(packetRows, ["escalation_packet_ref", "packet_status", "current_verdict"]),
    human_gate_rows_hash: hashRows(humanGateRows, ["human_gate_ref", "synthetic_receipt_allowed", "current_verdict"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "protected_action_escalation_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, commandExecutionBridge, protectedRollback, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p841_command_execution_bridge_ready", "P841", commandExecutionBridge.validation.valid && commandExecutionBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "P821-P840 command execution bridge is ready.", "repair command execution bridge"),
    gateRow("p842_rollback_hardening_ready", "P842", protectedRollback.validation.valid && protectedRollback.summary.zendd_protected_action_rollback_status === "ready_for_physical_integration_decision", "P721-P740 rollback hardening remains ready.", "repair protected action rollback hardening"),
    gateRow("p843_policy_fail_closed", "P843", policy.escalation_queue_open && !policy.protected_action_execution_allowed_now && !policy.synthetic_receipt_allowed, "Escalation policy opens queue but keeps execution and synthetic receipts disabled.", "restore fail-closed escalation policy"),
    gateRow("p844_command_requests", "P844-P846", commandRequestRows.length >= 1 && commandRequestRows.every(documentedRequest), "Command execution blocks are converted to protected action requests.", "complete command protected action requests"),
    gateRow("p847_domain_requests", "P847-P850", domainRequestRows.length >= 10 && domainRequestRows.every(documentedRequest), "Domain protected actions are converted to escalation requests.", "complete domain protected action requests"),
    gateRow("p851_packets", "P851-P854", packetRows.length === commandRequestRows.length + domainRequestRows.length && packetRows.every(documentedPacket), "Each protected request has a draft-only escalation packet.", "create escalation packet rows"),
    gateRow("p855_human_gates", "P855-P856", humanGateRows.length === packetRows.length && humanGateRows.every(documentedHumanGate), "Every escalation packet requires human receipt and rejects synthetic receipts.", "bind human gate rows"),
    gateRow("p857_fail_closed", "P857-P858", failClosedRows.length >= 8 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures keep protected actions blocked.", "complete fail-closed fixtures"),
    gateRow("p859_no_raw_secret_or_execution", "P859", !policy.raw_material_copy_allowed_now && !policy.secret_read_allowed_now && !policy.command_execution_allowed_now && !policy.protected_action_execution_allowed_now, "No raw material, secret read, command execution, or protected execution is allowed.", "restore protected boundary policy"),
    gateRow("p860_closeout_ready", "P860", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.protected_action_execution_allowed_now), "P841-P860 closes with protected action escalation ready.", "complete protected action escalation closeout"),
    gateRow("package_script_registered", "P860", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P860", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P860", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P841-P860") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P841-P860.", "record P841-P860 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "protected_action_escalation_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "protected_action_boundary", !policy.protected_action_execution_allowed_now && !policy.command_execution_allowed_now && !policy.release_package_allowed_now && !policy.database_migration_allowed_now, "Protected execution surfaces remain disabled."));
  items.push(validationItem("requests.documented", "protected_action_boundary", [...commandRequestRows, ...domainRequestRows].every(documentedRequest), "Protected action requests are documented BLOCK rows."));
  items.push(validationItem("packets.draft_only", "protected_action_boundary", packetRows.every(documentedPacket), "Escalation packets are draft-only."));
  items.push(validationItem("human_gates.no_synthetic_receipts", "receipt_boundary", humanGateRows.every(documentedHumanGate), "Human gates require real receipts and block synthetic receipts."));
  items.push(validationItem("fail_closed.pass", "protected_action_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.protected_action_execution_allowed_now), "Closeout is ready without protected execution."));
  return items;
}

function buildSummary({ commandExecutionBridge, protectedRollback, commandRequestRows, domainRequestRows, packetRows, humanGateRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_protected_action_escalation_status: validation.valid ? READY_STATUS : "documented_block_pending_protected_action_escalation",
    source_command_evidence_execution_bridge_status: commandExecutionBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_protected_action_rollback_status: protectedRollback.summary.zendd_protected_action_rollback_status,
    command_protected_action_request_count: commandRequestRows.length,
    domain_protected_action_request_count: domainRequestRows.length,
    protected_action_escalation_packet_count: packetRows.length,
    protected_action_human_gate_count: humanGateRows.length,
    protected_action_fail_closed_count: failClosedRows.length,
    protected_action_escalation_ready: closeoutRows.every((row) => row.protected_action_escalation_ready),
    protected_action_execution_allowed_now: false,
    command_execution_allowed_now: false,
    release_package_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    synthetic_receipt_allowed: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedRequest(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.protected_action_request_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && row.human_receipt_required === true
    && Boolean(row.rollback_target_ref)
    && row.request_payload_present === false
    && row.protected_action_execution_allowed_now === false
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function documentedPacket(row) {
  return row.current_verdict === "blocked"
    && row.packet_status === "draft_only_not_submitted"
    && row.request_payload_present === false
    && row.human_receipt_payload_present === false
    && row.human_receipt_validated === false
    && row.pass_candidate_allowed_now === false
    && row.protected_action_execution_allowed_now === false
    && row.rollback_execution_allowed_now === false
    && row.receipt_application_allowed_now === false
    && Boolean(row.escalation_packet_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.next_allowed_action);
}

function documentedHumanGate(row) {
  return row.current_verdict === "blocked"
    && row.human_receipt_required === true
    && row.synthetic_receipt_allowed === false
    && row.human_receipt_payload_present === false
    && row.human_receipt_validated === false
    && row.pass_without_human_receipt_allowed === false
    && row.protected_action_execution_allowed_now === false
    && Boolean(row.human_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.next_allowed_action);
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-protected-action-escalation-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_protected_action_escalation_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_PROTECTED_ACTION_ESCALATION_INPUTS.zenddProjectRoot,
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

Creates the P841-P860 Zendd protected action escalation contract. --check
validates without executing protected actions, running Zendd commands, applying
receipts, executing rollback, running migrations, packaging releases, copying
raw material, reading secrets, or moving Zendd code.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Protected Action Escalation Summary",
    "",
    `- Status: ${summary.zendd_protected_action_escalation_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Command requests: ${summary.command_protected_action_request_count}`,
    `- Domain requests: ${summary.domain_protected_action_request_count}`,
    `- Escalation packets: ${summary.protected_action_escalation_packet_count}`,
    `- Human gates: ${summary.protected_action_human_gate_count}`,
    `- Protected action execution allowed: ${summary.protected_action_execution_allowed_now}`,
    `- Synthetic receipt allowed: ${summary.synthetic_receipt_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}
