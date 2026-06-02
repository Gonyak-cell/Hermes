import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentInstallTrustGate } from "./platform-agent-install-trust-gate.mjs";

export const DEFAULT_PLATFORM_AGENT_ISOLATED_INSTALL_GATE_OUT_DIR = "artifacts/platform-agent-isolated-install-gate/latest";
export const DEFAULT_PLATFORM_AGENT_ISOLATED_INSTALL_GATE_INPUTS = {
  schemaPath: "schemas/platform-agent-isolated-install-gate.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-isolated-install-gate";
const SOURCE_COMMAND_NAME = "platform:agent-install-trust-gate";
const SCHEMA_VERSION = "platform-agent-isolated-install-gate.v1";
const CAPABILITY_ID = "platform.agent_operations.isolated_install_gate";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1057-P1064";
const PHASE_SLOT = "P1057";
const PREVIOUS_PHASE_SLOT = "P1056";
const NEXT_PHASE_SLOT = "P1065";
const READY_STATUS = "ready_for_agent_isolated_install_gate";
const DEFAULT_SELECTED_INSTALL_MODE = "repo_local_venv";

const EXECUTION_BLOCK_REASON = "missing_human_receipt";
const SMOKE_BLOCK_REASON = "install_not_yet_performed";

export async function runPlatformAgentIsolatedInstallGate(options = {}) {
  const result = await buildPlatformAgentIsolatedInstallGate(options);
  if (options.write !== false) await writePlatformAgentIsolatedInstallGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent isolated install gate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentIsolatedInstallGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_ISOLATED_INSTALL_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const installTrust = await buildPlatformAgentInstallTrustGate({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const policy = buildIsolatedInstallPolicy(generatedAt, installTrust);
  const selectionRows = buildSelectionRows(installTrust);
  const executionRows = buildExecutionRows(selectionRows);
  const receiptRows = buildReceiptTemplateRows(selectionRows);
  const smokeRows = buildSmokePlanRows(installTrust, selectionRows);
  const rollbackRows = buildRollbackBindingRows(installTrust, selectionRows);
  const claimRows = buildClaimRows({ selectionRows, executionRows, receiptRows, smokeRows, rollbackRows });
  const closeoutRows = buildCloseoutRows({ policy, installTrust, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, installTrust, policy, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, installTrust, policy, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, installTrust, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_isolated_install_gate_id: `platform-agent-isolated-install-gate.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_isolated_install_anchor: anchor,
    source_agent_install_trust_gate_summary: installTrust.summary,
    agent_isolated_install_policy: policy,
    agent_isolated_install_selection_rows: selectionRows,
    agent_isolated_install_execution_rows: executionRows,
    agent_isolated_install_receipt_template_rows: receiptRows,
    agent_doctor_smoke_plan_rows: smokeRows,
    agent_install_rollback_binding_rows: rollbackRows,
    agent_isolated_install_claim_rows: claimRows,
    agent_isolated_install_closeout_rows: closeoutRows,
    agent_isolated_install_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_isolated_install_gate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_isolated_install_gate_id = result.platform_agent_isolated_install_gate_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentIsolatedInstallGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-isolated-install-gate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-isolated-install-policy.json"), result.agent_isolated_install_policy);
  await writeJson(path.join(outDir, "agent-isolated-install-selection-rows.json"), collectionEnvelope("agent-isolated-install-selection-rows.v1", "agent_isolated_install_selection_rows", result.agent_isolated_install_selection_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-isolated-install-execution-rows.json"), collectionEnvelope("agent-isolated-install-execution-rows.v1", "agent_isolated_install_execution_rows", result.agent_isolated_install_execution_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-isolated-install-receipt-template-rows.json"), collectionEnvelope("agent-isolated-install-receipt-template-rows.v1", "agent_isolated_install_receipt_template_rows", result.agent_isolated_install_receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-smoke-plan-rows.json"), collectionEnvelope("agent-doctor-smoke-plan-rows.v1", "agent_doctor_smoke_plan_rows", result.agent_doctor_smoke_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-rollback-binding-rows.json"), collectionEnvelope("agent-install-rollback-binding-rows.v1", "agent_install_rollback_binding_rows", result.agent_install_rollback_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-isolated-install-claim-rows.json"), collectionEnvelope("agent-isolated-install-claim-rows.v1", "agent_isolated_install_claim_rows", result.agent_isolated_install_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-isolated-install-closeout-rows.json"), collectionEnvelope("agent-isolated-install-closeout-rows.v1", "agent_isolated_install_closeout_rows", result.agent_isolated_install_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-isolated-install-gate-rows.json"), collectionEnvelope("agent-isolated-install-gate-rows.v1", "agent_isolated_install_gate_rows", result.agent_isolated_install_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-isolated-install-gate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentIsolatedInstallGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentIsolatedInstallGate(args);
    console.log(`Platform agent isolated install gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_isolated_install_gate_status}`);
    console.log(`Selected mode: ${result.summary.selected_install_mode}`);
    console.log(`Execution rows: pass ${result.summary.pass_execution_count}, blocked ${result.summary.blocked_execution_count}`);
    console.log(`Smoke plans: ${result.summary.smoke_plan_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Install performed: ${result.summary.install_performed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIsolatedInstallPolicy(generatedAt, installTrust) {
  return {
    schema_version: "platform-agent-isolated-install-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_agent_install_trust_gate_ref: installTrust.platform_agent_install_trust_gate_id,
    source_agent_install_trust_gate_status: installTrust.summary.platform_agent_install_trust_gate_status,
    selected_install_mode: DEFAULT_SELECTED_INSTALL_MODE,
    selection_basis: "default_recommendation_pending_human_receipt",
    install_packet_creation_allowed: true,
    install_execution_allowed_now: false,
    package_download_allowed_now: false,
    command_execution_allowed_now: false,
    doctor_smoke_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    mcp_server_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_or_gateway_start_allowed_now: false,
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    secret_forwarding_allowed: false,
    raw_secret_context_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    human_receipt_required_before_install: true,
    human_receipt_present: false,
    selected_install_receipt_ref: `receipt.platform.agent.install.${DEFAULT_SELECTED_INSTALL_MODE}`,
    install_artifact_storage_policy: "no_venv_or_package_payload_committed",
    doctor_output_storage_policy: "redacted_summary_and_hash_only_after_execution",
    next_allowed_action: "collect human receipt for repo_local_venv or choose another PASS candidate before executing P1057 install",
    created_at: generatedAt,
  };
}

function buildSelectionRows(installTrust) {
  return installTrust.agent_install_mode_rows.map((row, index) => {
    const trustedCandidate = row.current_verdict === "pass";
    const selected = row.install_mode_id === DEFAULT_SELECTED_INSTALL_MODE;
    return {
      schema_version: "agent-isolated-install-selection-row.v1",
      row_id: `agent-isolated-install-selection.row.${String(index + 1).padStart(3, "0")}`,
      install_mode_id: row.install_mode_id,
      selected,
      current_verdict: trustedCandidate ? "pass" : "blocked",
      block_reason: trustedCandidate ? null : row.block_reason,
      install_command_candidate: row.install_command_candidate,
      rollback_command_candidate: row.rollback_command_candidate,
      trust_tier: row.trust_tier,
      source_install_mode_ref: row.row_id,
      human_receipt_required: trustedCandidate,
      human_receipt_present: false,
      evidence_ref: `evidence.platform.agent.isolated_install.selection.${row.install_mode_id}`,
      reviewer_ref: "reviewer.platform.agent_isolated_install_selection",
      hard_gate_ref: `gate.platform.agent.isolated_install.selection.${row.install_mode_id}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: selected
        ? "collect human receipt for selected repo-local venv install"
        : trustedCandidate
          ? "may be selected by human receipt before P1057 install execution"
          : row.next_allowed_action,
    };
  });
}

function buildExecutionRows(selectionRows) {
  return selectionRows
    .filter((row) => row.current_verdict === "pass")
    .map((row, index) => ({
      schema_version: "agent-isolated-install-execution-row.v1",
      row_id: `agent-isolated-install-execution.row.${String(index + 1).padStart(3, "0")}`,
      install_mode_id: row.install_mode_id,
      selected: row.selected,
      current_verdict: "blocked",
      block_reason: EXECUTION_BLOCK_REASON,
      install_command_candidate: row.install_command_candidate,
      install_execution_allowed_now: false,
      package_download_allowed_now: false,
      command_execution_performed: false,
      package_download_performed: false,
      package_install_performed: false,
      runtime_started: false,
      human_receipt_ref: `receipt.platform.agent.install.${row.install_mode_id}`,
      evidence_ref: `evidence.platform.agent.isolated_install.execution.${row.install_mode_id}`,
      reviewer_ref: "reviewer.platform.agent_isolated_install_execution",
      hard_gate_ref: `gate.platform.agent.isolated_install.execution.${row.install_mode_id}`,
      rollback_target_ref: `rollback.platform.agent.install.${row.install_mode_id}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: row.selected
        ? "provide human receipt, then run isolated install with redacted evidence capture"
        : "select this mode through human receipt before install execution",
    }));
}

function buildReceiptTemplateRows(selectionRows) {
  return selectionRows
    .filter((row) => row.current_verdict === "pass")
    .map((row, index) => ({
      schema_version: "agent-isolated-install-receipt-template-row.v1",
      row_id: `agent-isolated-install-receipt-template.row.${String(index + 1).padStart(3, "0")}`,
      receipt_template_id: `receipt.platform.agent.install.${row.install_mode_id}`,
      install_mode_id: row.install_mode_id,
      selected: row.selected,
      current_verdict: "pass",
      receipt_payload_present: false,
      receipt_application_allowed_now: false,
      required_fields: ["approver", "approved_install_mode", "scope", "rollback_command", "no_secret_confirmation", "timestamp"],
      evidence_ref: `evidence.platform.agent.isolated_install.receipt_template.${row.install_mode_id}`,
      reviewer_ref: "reviewer.platform.agent_isolated_install_receipt",
      hard_gate_ref: `gate.platform.agent.isolated_install.receipt_template.${row.install_mode_id}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: "collect and validate human receipt before install execution",
    }));
}

function buildSmokePlanRows(installTrust, selectionRows) {
  const selected = selectionRows.find((row) => row.selected);
  return installTrust.agent_smoke_command_rows.map((row, index) => ({
    schema_version: "agent-doctor-smoke-plan-row.v1",
    row_id: `agent-doctor-smoke-plan.row.${String(index + 1).padStart(3, "0")}`,
    smoke_id: row.smoke_id,
    install_mode_id: selected.install_mode_id,
    command_candidate: commandForInstallMode(row.command_candidate, selected.install_mode_id),
    current_verdict: "blocked",
    block_reason: SMOKE_BLOCK_REASON,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    provider_secret_required: false,
    raw_stdout_storage_allowed: false,
    redacted_summary_required: true,
    stdout_hash_required_after_execution: true,
    evidence_ref: `evidence.platform.agent.isolated_install.smoke.${row.smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_isolated_install_smoke",
    hard_gate_ref: `gate.platform.agent.isolated_install.smoke.${row.smoke_id}`,
    rollback_target_ref: `rollback.platform.agent.install.${selected.install_mode_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "run after selected install execution produces version evidence",
  }));
}

function buildRollbackBindingRows(installTrust, selectionRows) {
  const rollbackByMode = new Map(installTrust.agent_install_rollback_rows.map((row) => [row.install_mode_id, row]));
  return selectionRows
    .filter((row) => row.current_verdict === "pass")
    .map((row, index) => {
      const source = rollbackByMode.get(row.install_mode_id);
      return {
        schema_version: "agent-install-rollback-binding-row.v1",
        row_id: `agent-install-rollback-binding.row.${String(index + 1).padStart(3, "0")}`,
        install_mode_id: row.install_mode_id,
        selected: row.selected,
        current_verdict: "pass",
        rollback_command_candidate: source.rollback_command_candidate,
        rollback_execution_allowed_now: false,
        rollback_execution_performed: false,
        evidence_ref: `evidence.platform.agent.isolated_install.rollback.${row.install_mode_id}`,
        reviewer_ref: "reviewer.platform.agent_isolated_install_rollback",
        hard_gate_ref: `gate.platform.agent.isolated_install.rollback.${row.install_mode_id}`,
        rollback_target_ref: `rollback.platform.agent.install.${row.install_mode_id}`,
        responsible_owner: "platform_agent_owner",
        next_allowed_action: "keep rollback candidate attached before install execution",
      };
    });
}

function buildClaimRows({ selectionRows, executionRows, receiptRows, smokeRows, rollbackRows }) {
  const selectionClaims = selectionRows.map((row) => row.current_verdict === "pass"
    ? passClaim({
      claimId: `claim.platform.agent.isolated_install.selection.${row.install_mode_id}`,
      claimType: "install_mode_selection_candidate",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      nextAllowedAction: row.next_allowed_action,
    })
    : blockedClaim({
      claimId: `claim.platform.agent.isolated_install.selection.${row.install_mode_id}`,
      claimType: "install_mode_selection_candidate",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      blockReason: row.block_reason,
      nextAllowedAction: row.next_allowed_action,
    }));
  const executionClaims = executionRows.map((row) => blockedClaim({
    claimId: `claim.platform.agent.isolated_install.execution.${row.install_mode_id}`,
    claimType: "protected_install_execution",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    humanReceiptRef: row.human_receipt_ref,
    blockReason: row.block_reason,
    nextAllowedAction: row.next_allowed_action,
  }));
  const receiptClaims = receiptRows.map((row) => passClaim({
    claimId: `claim.platform.agent.isolated_install.receipt_template.${row.install_mode_id}`,
    claimType: "install_receipt_template",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    humanReceiptRef: row.receipt_template_id,
    nextAllowedAction: row.next_allowed_action,
  }));
  const smokeClaims = smokeRows.map((row) => blockedClaim({
    claimId: `claim.platform.agent.isolated_install.smoke.${row.smoke_id}`,
    claimType: "doctor_smoke_after_install",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    blockReason: row.block_reason,
    nextAllowedAction: row.next_allowed_action,
  }));
  const rollbackClaims = rollbackRows.map((row) => passClaim({
    claimId: `claim.platform.agent.isolated_install.rollback.${row.install_mode_id}`,
    claimType: "install_rollback_binding",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    nextAllowedAction: row.next_allowed_action,
  }));
  return [...selectionClaims, ...executionClaims, ...receiptClaims, ...smokeClaims, ...rollbackClaims].map((row, index) => ({
    ...row,
    row_id: `agent-isolated-install-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ policy, installTrust, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows }) {
  const rows = [
    ["source_install_trust_ready", installTrust.summary.platform_agent_install_trust_gate_status === "ready_for_agent_install_trust_gate", "source_agent_install_trust_gate"],
    ["selected_mode_is_trusted_candidate", selectionRows.some((row) => row.install_mode_id === policy.selected_install_mode && row.current_verdict === "pass"), "agent_isolated_install_selection_rows"],
    ["unsafe_modes_remain_blocked", selectionRows.filter((row) => row.current_verdict === "blocked").length >= 3, "agent_isolated_install_selection_rows"],
    ["install_execution_blocked_without_receipt", executionRows.every((row) => row.current_verdict === "blocked" && row.block_reason === EXECUTION_BLOCK_REASON), "agent_isolated_install_execution_rows"],
    ["receipt_templates_ready", receiptRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "agent_isolated_install_receipt_template_rows"],
    ["doctor_smoke_deferred", smokeRows.every((row) => row.current_verdict === "blocked" && row.command_execution_performed === false), "agent_doctor_smoke_plan_rows"],
    ["rollback_bindings_ready", rollbackRows.every((row) => row.current_verdict === "pass" && row.rollback_command_candidate), "agent_install_rollback_binding_rows"],
    ["no_install_or_download_performed", policy.install_execution_allowed_now === false && policy.package_download_allowed_now === false, "agent_isolated_install_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_isolated_install_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-isolated-install-closeout-row.v1",
    row_id: `agent-isolated-install-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    evidence_ref: `evidence.platform.agent.isolated_install.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_isolated_install_closeout",
    hard_gate_ref: `gate.platform.agent.isolated_install.closeout.${closeoutId}`,
    source_ref: sourceRef,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1064 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, installTrust, policy, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-isolated-install-anchor.v1",
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
    phase_ledger_present: phaseLedger.available,
    source_agent_install_trust_gate_status: installTrust.summary.platform_agent_install_trust_gate_status,
    selected_install_mode: policy.selected_install_mode,
    install_execution_allowed_now: policy.install_execution_allowed_now,
    package_download_allowed_now: policy.package_download_allowed_now,
    selection_count: selectionRows.length,
    execution_count: executionRows.length,
    receipt_template_count: receiptRows.length,
    smoke_plan_count: smokeRows.length,
    rollback_binding_count: rollbackRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, phaseLedger, installTrust, policy, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_install_trust_gate", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["phase_ledger_declares_isolated_install", phaseLedger.available && ["P1057-P1064", COMMAND_NAME, "Isolated Install And Doctor Gate"].every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["source_install_trust_ready", installTrust.summary.platform_agent_install_trust_gate_status === "ready_for_agent_install_trust_gate", "source_agent_install_trust_gate_summary"],
    ["selected_mode_trusted", selectionRows.some((row) => row.install_mode_id === policy.selected_install_mode && row.current_verdict === "pass"), "agent_isolated_install_selection_rows"],
    ["install_execution_blocked", executionRows.every((row) => row.current_verdict === "blocked" && row.install_execution_allowed_now === false), "agent_isolated_install_execution_rows"],
    ["receipt_templates_ready", receiptRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "agent_isolated_install_receipt_template_rows"],
    ["doctor_smoke_deferred", smokeRows.every((row) => row.current_verdict === "blocked" && row.command_execution_allowed_now === false), "agent_doctor_smoke_plan_rows"],
    ["rollback_bindings_ready", rollbackRows.every((row) => row.current_verdict === "pass"), "agent_install_rollback_binding_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_isolated_install_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_isolated_install_closeout_rows"],
    ["no_install_or_secret_use", policy.install_execution_allowed_now === false && policy.provider_secret_configuration_allowed_now === false && policy.secret_forwarding_allowed === false, "agent_isolated_install_policy"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-isolated-install-gate-row.v1",
    row_id: `agent-isolated-install-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.isolated_install.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_isolated_install_gate",
    hard_gate_ref: `gate.platform.agent.isolated_install.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    install_execution_performed_by_gate: false,
    package_download_performed_by_gate: false,
    command_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1064 closeout`,
  }));
}

function buildValidationItems({ gateRows, policy, installTrust, selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All isolated install gates must be ready."],
    ["source.ready", installTrust.summary.platform_agent_install_trust_gate_status === "ready_for_agent_install_trust_gate", "P1045-P1056 install trust source must be ready."],
    ["policy.no_install", policy.install_execution_allowed_now === false, "P1057-P1064 must not install without human receipt."],
    ["policy.no_download", policy.package_download_allowed_now === false, "P1057-P1064 must not download packages without human receipt."],
    ["selection.trusted", selectionRows.some((row) => row.install_mode_id === policy.selected_install_mode && row.current_verdict === "pass"), "Selected mode must be a trusted candidate."],
    ["execution.blocked", executionRows.every((row) => row.current_verdict === "blocked" && row.block_reason === EXECUTION_BLOCK_REASON), "Install execution rows must be blocked pending receipt."],
    ["receipts.ready", receiptRows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), "Receipt templates must be ready without payloads."],
    ["smoke.deferred", smokeRows.every((row) => row.current_verdict === "blocked" && row.block_reason === SMOKE_BLOCK_REASON), "Doctor smoke rows must be deferred."],
    ["rollback.ready", rollbackRows.every((row) => row.current_verdict === "pass"), "Rollback bindings must be ready."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_isolated_install_gate", passed, message));
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

function passClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef = null, nextAllowedAction }) {
  return {
    schema_version: "agent-isolated-install-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: null,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef = null, blockReason, nextAllowedAction }) {
  return {
    schema_version: "agent-isolated-install-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: blockReason,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildSummary({ selectionRows, executionRows, receiptRows, smokeRows, rollbackRows, claimRows, closeoutRows, gateRows, validation }) {
  return {
    platform_agent_isolated_install_gate_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    selected_install_mode: DEFAULT_SELECTED_INSTALL_MODE,
    selection_count: selectionRows.length,
    pass_selection_count: selectionRows.filter((row) => row.current_verdict === "pass").length,
    blocked_selection_count: selectionRows.filter((row) => row.current_verdict === "blocked").length,
    execution_count: executionRows.length,
    pass_execution_count: executionRows.filter((row) => row.current_verdict === "pass").length,
    blocked_execution_count: executionRows.filter((row) => row.current_verdict === "blocked").length,
    receipt_template_count: receiptRows.length,
    smoke_plan_count: smokeRows.length,
    rollback_binding_count: rollbackRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    install_performed: false,
    package_download_performed: false,
    command_execution_performed: false,
    human_receipt_present: false,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Isolated Install Gate",
    "",
    `Status: ${result.summary.platform_agent_isolated_install_gate_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Selected mode: ${result.summary.selected_install_mode}`,
    `Execution rows: ${result.summary.pass_execution_count} PASS / ${result.summary.blocked_execution_count} BLOCK`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Policy",
    "",
    "- Install execution allowed now: false",
    "- Package download allowed now: false",
    "- Doctor smoke execution allowed now: false",
    "- Human receipt present: false",
    "- Selected candidate: repo_local_venv",
    "",
    "## Next Allowed Action",
    "",
    result.agent_isolated_install_policy.next_allowed_action,
  ];
  return `${lines.join("\n")}\n`;
}

function commandForInstallMode(command, mode) {
  if (mode !== "repo_local_venv") return command;
  return command.replace(/^hermes\b/, ".hermes-agent-venv/bin/hermes");
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
  const defaults = DEFAULT_PLATFORM_AGENT_ISOLATED_INSTALL_GATE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
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
    } else if (arg === "--phase-ledger") {
      args.agentOperationsPhaseLedgerPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-isolated-install-gate.mjs [--check] [--out-dir DIR]\n\nCreates the P1057-P1064 isolated install and doctor gate without downloading, installing, or executing Hermes Agent.`);
}
