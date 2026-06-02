import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentOperatorSurface } from "./platform-agent-operator-surface.mjs";

export const DEFAULT_PLATFORM_AGENT_RUNTIME_RECEIPT_CONTRACT_OUT_DIR = "artifacts/platform-agent-runtime-receipt-contract/latest";
export const DEFAULT_PLATFORM_AGENT_RUNTIME_RECEIPT_CONTRACT_INPUTS = {
  schemaPath: "schemas/platform-agent-runtime-receipt-contract.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-runtime-receipt-contract";
const SOURCE_COMMAND_NAME = "platform:agent-operator-surface";
const SCHEMA_VERSION = "platform-agent-runtime-receipt-contract.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.runtime_receipt_contract";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1133-P1140";
const PHASE_SLOT = "P1133";
const PREVIOUS_PHASE_SLOT = "P1132";
const NEXT_PHASE_SLOT = "P1141";
const SOURCE_READY_STATUS = "ready_for_agent_operator_surface";
const READY_STATUS = "ready_for_agent_runtime_receipt_contract";

const REQUIRED_RECEIPT_FIELDS = [
  "receipt_id",
  "protected_action_id",
  "receipt_actor",
  "receipt_decision",
  "receipt_scope",
  "receipt_evidence_refs",
  "rollback_target_ref",
  "expires_at",
  "receipt_signed_at",
  "receipt_status",
  "human_receipt_ref",
];

const VALIDATION_RULE_SPECS = [
  ["receipt_identity", "Receipt id, actor, signed time, and status are required."],
  ["source_binding", "Receipt must bind to protected_action_id and source gate row."],
  ["scope_binding", "Receipt scope must match the requested install/runtime/tool/domain action."],
  ["evidence_binding", "Receipt must carry evidence refs and cannot replace evidence with prose."],
  ["rollback_binding", "Protected execution needs a rollback target ref."],
  ["expiry_binding", "Receipts expire and must be refreshed before reuse."],
  ["no_raw_secret_payload", "Receipt payload cannot include raw secrets or provider keys."],
  ["no_auto_pass", "Receipt validation cannot create final PASS without freeze refresh."],
];

const QUARANTINE_SPECS = [
  ["raw_secret_payload", "raw_secret_access", "replace raw secret with secret-handle evidence ref"],
  ["raw_client_vdr_payload", "raw_client_or_vdr_exposure", "replace raw material with source-span refs"],
  ["unscoped_runtime_receipt", "receipt_scope_missing", "collect scoped runtime receipt"],
  ["unsigned_receipt", "receipt_signature_missing", "collect signed human receipt"],
  ["stale_receipt", "receipt_expired", "collect fresh receipt before runtime action"],
  ["cross_domain_receipt", "domain_boundary_mismatch", "collect receipt from responsible domain owner"],
  ["agent_authored_receipt", "agent_cannot_author_receipt", "require human actor receipt"],
  ["pass_promotion_receipt", "direct_pass_authority", "route through freeze adjudication"],
];

export async function runPlatformAgentRuntimeReceiptContract(options = {}) {
  const result = await buildPlatformAgentRuntimeReceiptContract(options);
  if (options.write !== false) await writePlatformAgentRuntimeReceiptContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent runtime receipt contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentRuntimeReceiptContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_RUNTIME_RECEIPT_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const operatorSurface = await buildPlatformAgentOperatorSurface({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });

  const receiptTemplateRows = buildReceiptTemplateRows(operatorSurface);
  const protectedActionGateRows = buildProtectedActionGateRows(operatorSurface);
  const routeGateRows = buildRouteGateRows(operatorSurface);
  const validationRuleRows = buildValidationRuleRows();
  const quarantineRows = buildQuarantineRows();
  const claimRows = buildClaimRows({ receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows });
  const closeoutRows = buildCloseoutRows({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_runtime_receipt_contract_id: `platform-agent-runtime-receipt-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_runtime_receipt_contract_anchor: anchor,
    source_agent_operator_surface_summary: operatorSurface.summary,
    agent_runtime_receipt_template_rows: receiptTemplateRows,
    agent_runtime_receipt_protected_action_gate_rows: protectedActionGateRows,
    agent_runtime_receipt_route_gate_rows: routeGateRows,
    agent_runtime_receipt_validation_rule_rows: validationRuleRows,
    agent_runtime_receipt_quarantine_rows: quarantineRows,
    agent_runtime_receipt_claim_rows: claimRows,
    agent_runtime_receipt_closeout_rows: closeoutRows,
    agent_runtime_receipt_gate_rows: gateRows,
    agent_runtime_receipt_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_runtime_receipt_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_runtime_receipt_contract_id = result.platform_agent_runtime_receipt_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentRuntimeReceiptContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-runtime-receipt-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-runtime-receipt-template-rows.json"), collectionEnvelope("agent-runtime-receipt-template-rows.v1", "agent_runtime_receipt_template_rows", result.agent_runtime_receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-protected-action-gate-rows.json"), collectionEnvelope("agent-runtime-receipt-protected-action-gate-rows.v1", "agent_runtime_receipt_protected_action_gate_rows", result.agent_runtime_receipt_protected_action_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-route-gate-rows.json"), collectionEnvelope("agent-runtime-receipt-route-gate-rows.v1", "agent_runtime_receipt_route_gate_rows", result.agent_runtime_receipt_route_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-validation-rule-rows.json"), collectionEnvelope("agent-runtime-receipt-validation-rule-rows.v1", "agent_runtime_receipt_validation_rule_rows", result.agent_runtime_receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-quarantine-rows.json"), collectionEnvelope("agent-runtime-receipt-quarantine-rows.v1", "agent_runtime_receipt_quarantine_rows", result.agent_runtime_receipt_quarantine_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-claim-rows.json"), collectionEnvelope("agent-runtime-receipt-claim-rows.v1", "agent_runtime_receipt_claim_rows", result.agent_runtime_receipt_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-closeout-rows.json"), collectionEnvelope("agent-runtime-receipt-closeout-rows.v1", "agent_runtime_receipt_closeout_rows", result.agent_runtime_receipt_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-gate-rows.json"), collectionEnvelope("agent-runtime-receipt-gate-rows.v1", "agent_runtime_receipt_gate_rows", result.agent_runtime_receipt_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-receipt-boundary.json"), result.agent_runtime_receipt_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-runtime-receipt-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentRuntimeReceiptContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentRuntimeReceiptContract(args);
    console.log(`Platform agent runtime receipt contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_runtime_receipt_contract_status}`);
    console.log(`Receipt templates: ${result.summary.receipt_template_count}`);
    console.log(`Protected action gates: ${result.summary.protected_action_gate_count}`);
    console.log(`Route gates: ${result.summary.route_gate_count}`);
    console.log(`Receipt payload present: ${result.summary.receipt_payload_present}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReceiptTemplateRows(operatorSurface) {
  return operatorSurface.agent_operator_protected_queue_rows.map((row, index) => ({
    schema_version: "agent-runtime-receipt-template-row.v1",
    row_id: `agent-runtime-receipt-template.row.${String(index + 1).padStart(3, "0")}`,
    protected_action_id: row.protected_action_id,
    source_queue_ref: row.row_id,
    current_verdict: "pass",
    template_status: "ready_for_human_receipt_input",
    required_receipt_fields: REQUIRED_RECEIPT_FIELDS,
    allowed_receipt_decisions: ["approve_single_scoped_action", "return_with_missing_evidence", "keep_blocked"],
    human_receipt_required: true,
    receipt_payload_present: false,
    receipt_validated: false,
    receipt_applied: false,
    target_after_valid_receipt: "human_reviewed_action_candidate",
    protected_action_execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.runtime_receipt.template.${row.protected_action_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_template",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.template.${row.protected_action_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "collect scoped human receipt; do not execute protected action",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProtectedActionGateRows(operatorSurface) {
  return operatorSurface.agent_operator_protected_queue_rows.map((row, index) => ({
    schema_version: "agent-runtime-receipt-protected-action-gate-row.v1",
    row_id: `agent-runtime-receipt-protected-action-gate.row.${String(index + 1).padStart(3, "0")}`,
    protected_action_id: row.protected_action_id,
    source_queue_ref: row.row_id,
    current_verdict: "blocked",
    block_reason: "missing_validated_human_receipt",
    source_block_reason: row.source_block_reason,
    human_receipt_required: true,
    human_receipt_ref: row.human_receipt_ref,
    receipt_payload_present: false,
    receipt_validated: false,
    receipt_applied: false,
    install_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    raw_material_access_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: `evidence.platform.agent.runtime_receipt.protected_gate.${row.protected_action_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_protected_gate",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.protected_gate.${row.protected_action_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRouteGateRows(operatorSurface) {
  return operatorSurface.agent_operator_mutation_block_rows.map((row, index) => ({
    schema_version: "agent-runtime-receipt-route-gate-row.v1",
    row_id: `agent-runtime-receipt-route-gate.row.${String(index + 1).padStart(3, "0")}`,
    blocked_route_id: row.blocked_route_id,
    source_mutation_block_ref: row.row_id,
    method: row.method,
    current_verdict: "blocked",
    block_reason: "missing_validated_human_receipt",
    source_block_reason: row.block_reason,
    human_receipt_required: true,
    receipt_payload_present: false,
    receipt_validated: false,
    route_registered: false,
    route_execution_allowed_now: false,
    mutation_performed: false,
    protected_action_executed: false,
    raw_material_exposed: false,
    evidence_ref: `evidence.platform.agent.runtime_receipt.route_gate.${row.blocked_route_id}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_route_gate",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.route_gate.${row.blocked_route_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildValidationRuleRows() {
  return VALIDATION_RULE_SPECS.map(([ruleId, description], index) => ({
    schema_version: "agent-runtime-receipt-validation-rule-row.v1",
    row_id: `agent-runtime-receipt-validation-rule.row.${String(index + 1).padStart(3, "0")}`,
    rule_id: ruleId,
    current_verdict: "pass",
    rule_status: "ready_for_future_receipt_validation",
    description,
    receipt_payload_present: false,
    receipt_validated: false,
    pass_promoted: false,
    protected_action_executed: false,
    evidence_ref: `evidence.platform.agent.runtime_receipt.validation_rule.${ruleId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_validation_rule",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.validation_rule.${ruleId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "apply this rule only after a human receipt payload is provided",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildQuarantineRows() {
  return QUARANTINE_SPECS.map(([quarantineId, blockReason, nextAction], index) => ({
    schema_version: "agent-runtime-receipt-quarantine-row.v1",
    row_id: `agent-runtime-receipt-quarantine.row.${String(index + 1).padStart(3, "0")}`,
    quarantine_id: quarantineId,
    current_verdict: "pass",
    quarantine_status: "ready_for_future_receipt_quarantine",
    unsafe_payload_block_reason: blockReason,
    receipt_payload_present: false,
    unsafe_payload_accepted: false,
    evidence_ref: `evidence.platform.agent.runtime_receipt.quarantine.${quarantineId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_quarantine",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.quarantine.${quarantineId}`,
    responsible_owner: ownerForQuarantine(quarantineId),
    next_allowed_action: nextAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows }) {
  const passRows = [
    ...receiptTemplateRows.map((row) => passClaim("agent_runtime_receipt_template", `claim.platform.agent.runtime_receipt.template.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...validationRuleRows.map((row) => passClaim("agent_runtime_receipt_validation_rule", `claim.platform.agent.runtime_receipt.validation_rule.${row.rule_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...quarantineRows.map((row) => passClaim("agent_runtime_receipt_quarantine", `claim.platform.agent.runtime_receipt.quarantine.${row.quarantine_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
  ];
  const blockedRows = [
    ...protectedActionGateRows.map((row) => blockedClaim("agent_runtime_receipt_protected_action_gate", `claim.platform.agent.runtime_receipt.protected_gate.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action, row.human_receipt_ref)),
    ...routeGateRows.map((row) => blockedClaim("agent_runtime_receipt_route_gate", `claim.platform.agent.runtime_receipt.route_gate.${row.blocked_route_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action)),
  ];
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-runtime-receipt-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows }) {
  const rows = [
    ["source_operator_surface_ready", operatorSurface.summary.platform_agent_operator_surface_status === SOURCE_READY_STATUS, "source_agent_operator_surface_summary"],
    ["receipt_templates_ready", receiptTemplateRows.length === 16 && receiptTemplateRows.every((row) => row.current_verdict === "pass" && !row.receipt_payload_present), "agent_runtime_receipt_template_rows"],
    ["protected_action_gates_blocked", protectedActionGateRows.length === 16 && protectedActionGateRows.every((row) => row.current_verdict === "blocked" && row.block_reason && !row.protected_action_execution_allowed_now), "agent_runtime_receipt_protected_action_gate_rows"],
    ["route_gates_blocked", routeGateRows.length === 8 && routeGateRows.every((row) => row.current_verdict === "blocked" && !row.route_registered), "agent_runtime_receipt_route_gate_rows"],
    ["validation_rules_ready", validationRuleRows.length === 8 && validationRuleRows.every((row) => row.current_verdict === "pass" && !row.receipt_validated), "agent_runtime_receipt_validation_rule_rows"],
    ["quarantine_ready", quarantineRows.length === 8 && quarantineRows.every((row) => row.current_verdict === "pass" && !row.unsafe_payload_accepted), "agent_runtime_receipt_quarantine_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_runtime_receipt_claim_rows"],
    ["no_receipt_payload_or_execution", [...receiptTemplateRows, ...protectedActionGateRows, ...routeGateRows].every((row) => row.receipt_payload_present === false), "agent_runtime_receipt_boundary"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-runtime-receipt-closeout-row.v1",
    row_id: `agent-runtime-receipt-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.runtime_receipt.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_closeout",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1140 closeout`,
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-runtime-receipt-contract-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_operator_surface_status: operatorSurface.summary.platform_agent_operator_surface_status,
    receipt_template_count: receiptTemplateRows.length,
    protected_action_gate_count: protectedActionGateRows.length,
    route_gate_count: routeGateRows.length,
    validation_rule_count: validationRuleRows.length,
    quarantine_count: quarantineRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_operator_surface", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_receipt_contract", runtimePilotLedger.available && ["P1133-P1140", COMMAND_NAME, "Runtime Human Receipt Contract"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_operator_surface_ready", operatorSurface.summary.platform_agent_operator_surface_status === SOURCE_READY_STATUS, "source_agent_operator_surface_summary"],
    ["receipt_templates_ready", receiptTemplateRows.length === 16 && receiptTemplateRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "agent_runtime_receipt_template_rows"],
    ["protected_action_gates_blocked", protectedActionGateRows.length === 16 && protectedActionGateRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "agent_runtime_receipt_protected_action_gate_rows"],
    ["route_gates_blocked", routeGateRows.length === 8 && routeGateRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "agent_runtime_receipt_route_gate_rows"],
    ["validation_rules_ready", validationRuleRows.length === 8 && validationRuleRows.every((row) => row.current_verdict === "pass"), "agent_runtime_receipt_validation_rule_rows"],
    ["quarantine_ready", quarantineRows.length === 8 && quarantineRows.every((row) => row.current_verdict === "pass" && row.unsafe_payload_accepted === false), "agent_runtime_receipt_quarantine_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_runtime_receipt_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_runtime_receipt_closeout_rows"],
    ["no_receipt_or_execution", protectedActionGateRows.every((row) => !row.receipt_payload_present && !row.protected_action_execution_allowed_now) && routeGateRows.every((row) => !row.route_registered && !row.route_execution_allowed_now), "agent_runtime_receipt_boundary"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-runtime-receipt-gate-row.v1",
    row_id: `agent-runtime-receipt-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.runtime_receipt.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_receipt_gate",
    hard_gate_ref: `gate.platform.agent.runtime_receipt.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    receipt_received_by_gate: false,
    receipt_validated_by_gate: false,
    receipt_applied_by_gate: false,
    protected_action_executed_by_gate: false,
    runtime_execution_performed_by_gate: false,
    raw_material_exposed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1140 closeout`,
  }));
}

function buildBoundary({ generatedAt, operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "platform-agent-runtime-receipt-boundary.v1",
    generated_at: generatedAt,
    source_operator_surface_ref: operatorSurface.platform_agent_operator_surface_id,
    source_operator_surface_status: operatorSurface.summary.platform_agent_operator_surface_status,
    read_only: true,
    receipt_contract_declared: true,
    receipt_template_count: receiptTemplateRows.length,
    protected_action_gate_count: protectedActionGateRows.length,
    route_gate_count: routeGateRows.length,
    validation_rule_count: validationRuleRows.length,
    quarantine_count: quarantineRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    human_receipt_required: true,
    receipt_payload_present: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_applied: false,
    pass_promoted: false,
    install_execution_performed: false,
    runtime_execution_performed: false,
    terminal_execution_performed: false,
    mcp_connection_started: false,
    api_server_started: false,
    cron_gateway_started: false,
    provider_secret_configured: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    direct_zendd_mutation_performed: false,
    protected_action_executed: false,
    agent_final_pass_created: false,
  };
}

function buildValidationItems({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["source.operator_surface", operatorSurface.summary.platform_agent_operator_surface_status === SOURCE_READY_STATUS, "Source operator surface must be ready."],
    ["templates.ready", receiptTemplateRows.length === 16 && receiptTemplateRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "Receipt templates must be ready without payloads."],
    ["protected.gates_blocked", protectedActionGateRows.length === 16 && protectedActionGateRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "Protected actions must remain blocked without receipts."],
    ["route.gates_blocked", routeGateRows.length === 8 && routeGateRows.every((row) => row.current_verdict === "blocked" && row.route_registered === false), "Route gates must remain blocked."],
    ["rules.ready", validationRuleRows.length === 8 && validationRuleRows.every((row) => row.current_verdict === "pass"), "Validation rules must be ready."],
    ["quarantine.ready", quarantineRows.length === 8 && quarantineRows.every((row) => row.unsafe_payload_accepted === false), "Quarantine rows must reject unsafe payloads."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "Gate rows must be ready."],
    ["boundary.no_receipt_or_execution", boundary.receipt_payload_present === false && boundary.receipt_validated === false && boundary.receipt_applied === false && boundary.install_execution_performed === false && boundary.runtime_execution_performed === false && boundary.protected_action_executed === false && boundary.raw_secret_exposed === false && boundary.raw_client_or_vdr_exposed === false && boundary.direct_zendd_mutation_performed === false, "Receipt contract must not receive payloads or execute actions."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_runtime_receipt_contract", passed, message));
}

function passClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, nextAllowedAction) {
  return {
    schema_version: "agent-runtime-receipt-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: null,
    block_reason: null,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, blockReason, nextAllowedAction, humanReceiptRef = null) {
  return {
    schema_version: "agent-runtime-receipt-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: blockReason,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function isSupportedClaimState(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function buildSummary({ operatorSurface, receiptTemplateRows, protectedActionGateRows, routeGateRows, validationRuleRows, quarantineRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_runtime_receipt_contract_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_operator_surface_status: operatorSurface.summary.platform_agent_operator_surface_status,
    receipt_template_count: receiptTemplateRows.length,
    protected_action_gate_count: protectedActionGateRows.length,
    route_gate_count: routeGateRows.length,
    validation_rule_count: validationRuleRows.length,
    quarantine_count: quarantineRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    human_receipt_required: boundary.human_receipt_required,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    receipt_applied: boundary.receipt_applied,
    pass_promoted: boundary.pass_promoted,
    install_execution_performed: boundary.install_execution_performed,
    runtime_execution_performed: boundary.runtime_execution_performed,
    terminal_execution_performed: boundary.terminal_execution_performed,
    mcp_connection_started: boundary.mcp_connection_started,
    api_server_started: boundary.api_server_started,
    cron_gateway_started: boundary.cron_gateway_started,
    provider_secret_configured: boundary.provider_secret_configured,
    raw_secret_exposed: boundary.raw_secret_exposed,
    raw_client_or_vdr_exposed: boundary.raw_client_or_vdr_exposed,
    direct_zendd_mutation_performed: boundary.direct_zendd_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    agent_final_pass_created: boundary.agent_final_pass_created,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function ownerForQuarantine(quarantineId) {
  if (quarantineId.includes("secret")) return "security_owner";
  if (quarantineId.includes("client") || quarantineId.includes("vdr")) return "data_boundary_owner";
  if (quarantineId.includes("domain")) return "domain_pack_owner";
  return "platform_agent_owner";
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Runtime Receipt Contract",
    "",
    `Status: ${result.summary.platform_agent_runtime_receipt_contract_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Receipt templates: ${result.summary.receipt_template_count}`,
    `Protected action gates: ${result.summary.protected_action_gate_count}`,
    `Route gates: ${result.summary.route_gate_count}`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Boundary",
    "",
    "- Receipt payload present: false",
    "- Receipt validated: false",
    "- Receipt applied: false",
    "- Runtime execution performed: false",
    "- Protected action executed: false",
  ];
  return `${lines.join("\n")}\n`;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function validateChainIncludes(packageJson, commandName) {
  const validate = packageJson.data?.scripts?.validate ?? "";
  return validate.includes(`npm run ${commandName} -- --check`);
}

function validationItem(id, category, passed, message) {
  return {
    id,
    category,
    passed,
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_RUNTIME_RECEIPT_CONTRACT_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
    agent_runtime_pilot_ledger_path: path.resolve(options.agentRuntimePilotLedgerPath ?? defaults.agentRuntimePilotLedgerPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--agent-operations-ledger") {
      args.agentOperationsPhaseLedgerPath = argv[++index];
    } else if (arg === "--runtime-pilot-ledger") {
      args.agentRuntimePilotLedgerPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-runtime-receipt-contract.mjs [--check] [--out-dir DIR]\n\nCreates the P1133-P1140 Agent runtime receipt contract without receiving or applying receipts.`);
}
