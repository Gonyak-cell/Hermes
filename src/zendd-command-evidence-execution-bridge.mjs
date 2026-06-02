import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddCommandEvidence } from "./zendd-command-evidence.mjs";
import { buildZenddSafePatchLane } from "./zendd-safe-patch-lane.mjs";

export const DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_OUT_DIR = "artifacts/zendd-command-evidence-execution-bridge/latest";
export const DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS = {
  schemaPath: "schemas/zendd-command-evidence-execution-bridge.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-command-evidence-execution-bridge";
const SAFE_PATCH_LANE_COMMAND_NAME = "project:zendd-safe-patch-lane";
const COMMAND_EVIDENCE_COMMAND_NAME = "project:zendd-command-evidence";
const SCHEMA_VERSION = "zendd-command-evidence-execution-bridge.v1";
const CAPABILITY_ID = "project.zendd.command_evidence_execution_bridge";
const PHASE_RANGE = "P821-P840";
const PHASE_SLOT = "P821";
const PREVIOUS_PHASE_SLOT = "P820";
const NEXT_PHASE_SLOT = "P841";
const READY_STATUS = "ready_for_zendd_command_evidence_execution_bridge";

export async function runZenddCommandEvidenceExecutionBridge(options = {}) {
  const result = await buildZenddCommandEvidenceExecutionBridge(options);
  if (options.write !== false) await writeZenddCommandEvidenceExecutionBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd command evidence execution bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddCommandEvidenceExecutionBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const safePatchLane = await buildZenddSafePatchLane({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const commandEvidence = await buildZenddCommandEvidence({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });

  const policy = buildExecutionBridgePolicy(generatedAt, safePatchLane, commandEvidence);
  const candidateRows = buildVerificationCommandCandidateRows(commandEvidence.command_evidence_rows);
  const packetRows = buildCommandExecutionPacketRows(candidateRows);
  const outputRows = buildCommandOutputBindingRows(candidateRows);
  const blockRows = buildProtectedCommandExecutionBlockRows(commandEvidence.command_evidence_rows);
  const closeoutRows = buildCloseoutRows({ safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_command_evidence_execution_bridge_id: `zendd-command-evidence-execution-bridge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    command_evidence_execution_bridge_anchor: anchor,
    source_safe_patch_lane_summary: safePatchLane.summary,
    source_command_evidence_summary: commandEvidence.summary,
    command_evidence_execution_bridge_policy: policy,
    verification_command_candidate_rows: candidateRows,
    command_execution_packet_rows: packetRows,
    command_output_binding_rows: outputRows,
    protected_command_execution_block_rows: blockRows,
    command_evidence_execution_bridge_closeout_rows: closeoutRows,
    command_evidence_execution_bridge_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ safePatchLane, commandEvidence, candidateRows, packetRows, outputRows, blockRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_command_evidence_execution_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ safePatchLane, commandEvidence, candidateRows, packetRows, outputRows, blockRows, closeoutRows, validation: result.validation });
  result.summary.zendd_command_evidence_execution_bridge_id = result.zendd_command_evidence_execution_bridge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddCommandEvidenceExecutionBridge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-command-evidence-execution-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "command-evidence-execution-bridge-policy.json"), result.command_evidence_execution_bridge_policy);
  await writeJson(path.join(outDir, "verification-command-candidate-rows.json"), collectionEnvelope("zendd-verification-command-candidate-rows.v1", "verification_command_candidate_rows", result.verification_command_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-execution-packet-rows.json"), collectionEnvelope("zendd-command-execution-packet-rows.v1", "command_execution_packet_rows", result.command_execution_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-output-binding-rows.json"), collectionEnvelope("zendd-command-output-binding-rows.v1", "command_output_binding_rows", result.command_output_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-command-execution-block-rows.json"), collectionEnvelope("zendd-protected-command-execution-block-rows.v1", "protected_command_execution_block_rows", result.protected_command_execution_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-evidence-execution-bridge-closeout-rows.json"), collectionEnvelope("zendd-command-evidence-execution-bridge-closeout-rows.v1", "command_evidence_execution_bridge_closeout_rows", result.command_evidence_execution_bridge_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-evidence-execution-bridge-gate-rows.json"), collectionEnvelope("zendd-command-evidence-execution-bridge-gate-rows.v1", "command_evidence_execution_bridge_gate_rows", result.command_evidence_execution_bridge_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-command-evidence-execution-bridge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddCommandEvidenceExecutionBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddCommandEvidenceExecutionBridge(args);
    console.log(`Zendd command evidence execution bridge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_command_evidence_execution_bridge_status}`);
    console.log(`Verification candidates: ${result.summary.verification_command_candidate_count}`);
    console.log(`Execution packets: ${result.summary.command_execution_packet_count}`);
    console.log(`Output bindings: ${result.summary.command_output_binding_count}`);
    console.log(`Protected blocks: ${result.summary.protected_command_execution_block_count}`);
    console.log(`Command execution performed: ${result.summary.command_execution_performed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildExecutionBridgePolicy(generatedAt, safePatchLane, commandEvidence) {
  return {
    schema_version: "zendd-command-evidence-execution-bridge-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_safe_patch_lane_ref: safePatchLane.zendd_safe_patch_lane_id,
    source_command_evidence_ref: commandEvidence.zendd_command_evidence_id,
    check_mode_execution_allowed: false,
    future_verification_execution_candidates_allowed: true,
    command_execution_performed_now: false,
    file_write_executed_by_this_command: false,
    raw_log_storage_allowed: false,
    raw_stdout_stderr_storage_allowed: false,
    secret_read_allowed_now: false,
    raw_material_copy_allowed_now: false,
    database_migration_allowed_now: false,
    build_artifact_execution_allowed_now: false,
    release_package_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_action_execution_allowed: false,
    command_execution_pass_requires: [
      "command_evidence_ref",
      "command_execution_packet_ref",
      "redaction_report_ref",
      "stdout_hash_ref",
      "stderr_hash_ref",
      "reviewer_ref_or_hard_gate_ref",
      "human_receipt_ref_when_protected",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "select one verification command and create an explicit capture request before any future execution",
    created_at: generatedAt,
  };
}

function buildVerificationCommandCandidateRows(evidenceRows) {
  return evidenceRows
    .filter((row) => classifyCommandForExecution(row).execution_class === "verification_candidate")
    .map((row, index) => {
      const key = commandKey(row);
      return {
        schema_version: "zendd-verification-command-candidate-row.v1",
        phase_slot: "P823-P826",
        row_id: `zendd-verification-command-candidate.row.${String(index + 1).padStart(3, "0")}`,
        command_execution_candidate_id: `command-candidate.zendd.${key}`,
        project_id: "project.zendd",
        claim_id: row.claim_id,
        command_scope: row.command_scope,
        package_path: row.package_path,
        script_name: row.script_name,
        command_classification: row.command_classification,
        source_command_evidence_ref: row.command_evidence_ref,
        command_execution_evidence_ref: `evidence.zendd.command_execution.${key}`,
        reviewer_ref: row.reviewer_ref,
        hard_gate_ref: row.hard_gate_ref,
        command_execution_packet_ref: `packet.zendd.command_execution.${key}`,
        redaction_report_ref: `redaction.zendd.command_execution.${key}`,
        stdout_hash_ref: `hashref.zendd.command_execution.${key}.stdout.pending`,
        stderr_hash_ref: `hashref.zendd.command_execution.${key}.stderr.pending`,
        cwd_ref: `cwd.zendd.external_checkout.${row.command_scope}`,
        timeout_policy_ref: "timeout-policy.zendd.verification_command.explicit",
        future_execution_candidate: true,
        execution_allowed_in_check: false,
        command_execution_performed_now: false,
        raw_log_storage_allowed: false,
        secret_read_allowed_now: false,
        raw_material_copy_allowed_now: false,
        current_verdict: "pass",
        block_reason: null,
        responsible_owner: "zendd_maintainer",
        next_allowed_action: "create explicit command capture request and run only after operator selection",
      };
    });
}

function buildCommandExecutionPacketRows(candidateRows) {
  return candidateRows.map((row, index) => ({
    schema_version: "zendd-command-execution-packet-row.v1",
    phase_slot: "P827-P831",
    row_id: `zendd-command-execution-packet.row.${String(index + 1).padStart(3, "0")}`,
    command_execution_packet_ref: row.command_execution_packet_ref,
    command_execution_candidate_id: row.command_execution_candidate_id,
    claim_id: row.claim_id,
    command_scope: row.command_scope,
    package_path: row.package_path,
    script_name: row.script_name,
    command_line_ref: commandLineRef(row),
    cwd_ref: row.cwd_ref,
    timeout_policy_ref: row.timeout_policy_ref,
    source_command_evidence_ref: row.source_command_evidence_ref,
    command_execution_evidence_ref: row.command_execution_evidence_ref,
    redaction_report_ref: row.redaction_report_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    packet_status: "prepared_not_executed",
    execution_allowed_in_check: false,
    command_execution_performed_now: false,
    file_write_executed_now: false,
    next_allowed_action: "operator must authorize this packet before command execution evidence can be captured",
  }));
}

function buildCommandOutputBindingRows(candidateRows) {
  return candidateRows.map((row, index) => ({
    schema_version: "zendd-command-output-binding-row.v1",
    phase_slot: "P832-P835",
    row_id: `zendd-command-output-binding.row.${String(index + 1).padStart(3, "0")}`,
    command_execution_candidate_id: row.command_execution_candidate_id,
    command_execution_packet_ref: row.command_execution_packet_ref,
    command_execution_evidence_ref: row.command_execution_evidence_ref,
    stdout_hash_ref: row.stdout_hash_ref,
    stderr_hash_ref: row.stderr_hash_ref,
    redaction_report_ref: row.redaction_report_ref,
    safe_excerpt_ref: `excerpt.zendd.command_execution.${commandKey(row)}.safe.pending`,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    raw_log_storage_allowed: false,
    secret_value_storage_allowed: false,
    raw_vdr_or_client_material_storage_allowed: false,
    output_binding_status: "pending_hash_capture_not_executed",
    current_verdict: "pass",
    block_reason: null,
    next_allowed_action: "capture only hashes and redacted excerpt refs during future execution",
  }));
}

function buildProtectedCommandExecutionBlockRows(evidenceRows) {
  return evidenceRows
    .filter((row) => classifyCommandForExecution(row).execution_class !== "verification_candidate")
    .map((row, index) => {
      const classification = classifyCommandForExecution(row);
      const key = commandKey(row);
      return {
        schema_version: "zendd-protected-command-execution-block-row.v1",
        phase_slot: "P836-P838",
        row_id: `zendd-protected-command-execution-block.row.${String(index + 1).padStart(3, "0")}`,
        block_source: classification.block_source,
        command_execution_block_id: `command-execution-block.zendd.${key}`,
        project_id: "project.zendd",
        claim_id: row.claim_id,
        command_scope: row.command_scope,
        package_path: row.package_path,
        script_name: row.script_name,
        command_classification: row.command_classification,
        protected_action_class: classification.protected_action_class,
        source_command_evidence_ref: row.command_evidence_ref,
        command_execution_evidence_ref: `evidence.zendd.command_execution.${key}`,
        hard_gate_ref: classification.hard_gate_ref ?? row.hard_gate_ref,
        documented_human_gate_ref: classification.human_receipt_required ? `human-gate.zendd.command_execution.${key}` : null,
        human_receipt_required: classification.human_receipt_required,
        rollback_target_ref: `rollback-target.zendd.command_execution.${key}`,
        current_verdict: "blocked",
        block_reason: classification.block_reason,
        responsible_owner: classification.responsible_owner,
        execution_allowed_in_check: false,
        command_execution_performed_now: false,
        file_write_executed_now: false,
        raw_log_storage_allowed: false,
        secret_read_allowed_now: false,
        raw_material_copy_allowed_now: false,
        next_allowed_action: classification.next_allowed_action,
      };
    });
}

function classifyCommandForExecution(row) {
  const name = String(row.script_name ?? "").toLowerCase();
  const commandClass = String(row.command_classification ?? "").toLowerCase();
  if (/(test|lint|typecheck|check|verify|validate)/.test(name) && commandClass === "check_mode_candidate") {
    return {
      execution_class: "verification_candidate",
      protected_action_class: "verification_command",
    };
  }
  if (/(build|compile|bundle)/.test(name)) {
    return blockClassification({
      blockSource: "artifact_isolation",
      protectedActionClass: "build_artifact",
      blockReason: "build_command_requires_artifact_isolation_before_execution",
      responsibleOwner: "zendd_maintainer",
      humanReceiptRequired: false,
      nextAllowedAction: "create build artifact isolation sandbox before allowing build evidence capture",
    });
  }
  if (commandClass === "database" || /(migrate|migration|alembic|db|seed|postgres|sql)/.test(name)) {
    return blockClassification({
      blockSource: "protected_command",
      protectedActionClass: "database_migration",
      blockReason: "database_command_requires_human_receipt_and_migration_gate",
      responsibleOwner: "protected_action_operator",
      humanReceiptRequired: true,
      nextAllowedAction: "open protected action escalation with migration receipt and rollback target",
    });
  }
  if (commandClass === "packaging_or_release" || /(package|electron|installer|dist|release|publish|sign|notar)/.test(name)) {
    return blockClassification({
      blockSource: "protected_command",
      protectedActionClass: "release_package",
      blockReason: "release_package_command_requires_release_candidate_sandbox",
      responsibleOwner: "release_operator",
      humanReceiptRequired: true,
      nextAllowedAction: "defer to release candidate sandbox with human receipt",
    });
  }
  if (commandClass === "runtime_or_server" || /^(dev|start|serve|preview)$|(:dev|dev:|server|watch)/.test(name)) {
    return blockClassification({
      blockSource: "protected_command",
      protectedActionClass: "runtime_server",
      blockReason: "runtime_server_command_requires_sandbox_and_operator_receipt",
      responsibleOwner: "dev_harness_operator",
      humanReceiptRequired: true,
      nextAllowedAction: "open sandboxed dev-server request with stop condition and receipt",
    });
  }
  if (commandClass === "mutating_or_dependency" || /(install|postinstall|prepare|clean|rm|write|generate)/.test(name)) {
    return blockClassification({
      blockSource: "protected_command",
      protectedActionClass: "mutating_dependency",
      blockReason: "mutating_dependency_command_requires_protected_action_gate",
      responsibleOwner: "protected_action_operator",
      humanReceiptRequired: true,
      nextAllowedAction: "open protected action escalation before dependency or mutating command execution",
    });
  }
  return blockClassification({
    blockSource: "unclassified_command",
    protectedActionClass: "unclassified_command",
    blockReason: "command_not_classified_for_execution_bridge",
    responsibleOwner: "integration_operator",
    humanReceiptRequired: true,
    nextAllowedAction: "classify command and bind hard gate before future execution",
  });
}

function blockClassification({ blockSource, protectedActionClass, blockReason, responsibleOwner, humanReceiptRequired, nextAllowedAction }) {
  return {
    execution_class: "blocked",
    block_source: blockSource,
    protected_action_class: protectedActionClass,
    block_reason: blockReason,
    responsible_owner: responsibleOwner,
    human_receipt_required: humanReceiptRequired,
    next_allowed_action: nextAllowedAction,
  };
}

function buildCloseoutRows({ safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows }) {
  const ready = safePatchLane.validation.valid
    && safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane"
    && commandEvidence.validation.valid
    && commandEvidence.summary.zendd_command_evidence_status === "ready_for_vdr_ldd_source_contract_bridge"
    && !policy.check_mode_execution_allowed
    && !policy.command_execution_performed_now
    && candidateRows.length >= 1
    && candidateRows.every(documentedCandidate)
    && packetRows.length === candidateRows.length
    && packetRows.every(documentedPacket)
    && outputRows.length === candidateRows.length
    && outputRows.every(documentedOutputBinding)
    && blockRows.length >= 1
    && blockRows.every(documentedExecutionBlock);
  return [{
    schema_version: "zendd-command-evidence-execution-bridge-closeout-row.v1",
    phase_slot: "P840",
    closeout_status: ready ? READY_STATUS : "blocked",
    command_evidence_execution_bridge_ready: ready,
    source_safe_patch_lane_status: safePatchLane.summary.zendd_safe_patch_lane_status,
    source_command_evidence_status: commandEvidence.summary.zendd_command_evidence_status,
    verification_command_candidate_count: candidateRows.length,
    command_execution_packet_count: packetRows.length,
    command_output_binding_count: outputRows.length,
    protected_command_execution_block_count: blockRows.length,
    command_execution_performed_now: false,
    file_write_executed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    raw_material_copy_allowed_now: false,
    protected_action_execution_allowed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P841-P860 protected action escalation before protected Zendd execution",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows }) {
  return {
    schema_version: "zendd-command-evidence-execution-bridge-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    safe_patch_lane_command_name: SAFE_PATCH_LANE_COMMAND_NAME,
    command_evidence_command_name: COMMAND_EVIDENCE_COMMAND_NAME,
    source_safe_patch_lane_ref: safePatchLane.zendd_safe_patch_lane_id,
    source_safe_patch_lane_status: safePatchLane.summary.zendd_safe_patch_lane_status,
    source_command_evidence_ref: commandEvidence.zendd_command_evidence_id,
    source_command_evidence_status: commandEvidence.summary.zendd_command_evidence_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    verification_candidate_rows_hash: hashRows(candidateRows, ["command_execution_candidate_id", "current_verdict", "command_execution_performed_now"]),
    command_execution_packet_rows_hash: hashRows(packetRows, ["command_execution_packet_ref", "packet_status", "command_execution_performed_now"]),
    command_output_binding_rows_hash: hashRows(outputRows, ["command_execution_evidence_ref", "raw_log_storage_allowed", "output_binding_status"]),
    protected_command_execution_block_rows_hash: hashRows(blockRows, ["command_execution_block_id", "block_reason", "human_receipt_required", "next_allowed_action"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "command_evidence_execution_bridge_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, safePatchLane, commandEvidence, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const buildBlocks = blockRows.filter((row) => row.protected_action_class === "build_artifact");
  const protectedBlocks = blockRows.filter((row) => row.human_receipt_required);
  return [
    gateRow("p821_safe_patch_lane_ready", "P821", safePatchLane.validation.valid && safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane", "P801-P820 safe patch lane is ready.", "repair P801-P820 safe patch lane"),
    gateRow("p822_command_evidence_ready", "P822", commandEvidence.validation.valid && commandEvidence.summary.zendd_command_evidence_status === "ready_for_vdr_ldd_source_contract_bridge", "P561-P580 command evidence catalog is ready.", "repair P561-P580 command evidence"),
    gateRow("p823_policy_no_check_execution", "P823", !policy.check_mode_execution_allowed && !policy.command_execution_performed_now && !policy.file_write_executed_by_this_command, "Execution bridge policy does not execute commands during check.", "restore no-execution policy"),
    gateRow("p824_verification_candidates", "P824-P826", candidateRows.length >= 1 && candidateRows.every(documentedCandidate), "Verification commands are prepared as future candidates only.", "classify test/lint/typecheck/validate commands as future candidates"),
    gateRow("p827_execution_packets_prepared", "P827-P831", packetRows.length === candidateRows.length && packetRows.every(documentedPacket), "Execution packets are prepared without running commands.", "prepare packet rows for each verification candidate"),
    gateRow("p832_output_bindings_redacted", "P832-P835", outputRows.length === candidateRows.length && outputRows.every(documentedOutputBinding), "Output binding rows store hashes and redaction refs only.", "bind stdout/stderr hashes and redaction refs"),
    gateRow("p836_build_artifacts_isolated", "P836", buildBlocks.every(documentedExecutionBlock), "Build commands are blocked until artifact isolation exists.", "block build commands pending artifact isolation"),
    gateRow("p837_protected_commands_blocked", "P837-P838", protectedBlocks.length >= 1 && protectedBlocks.every(documentedExecutionBlock), "Protected Zendd commands require human gate and remain blocked.", "document protected command blocks"),
    gateRow("p839_no_raw_secret_or_material", "P839", [...candidateRows, ...outputRows, ...blockRows].every(noRawSecretOrMaterial), "Bridge stores no raw logs, secrets, VDR material, or client material.", "restore redacted/hash-only output policy"),
    gateRow("p839_no_execution_or_write", "P839", [...candidateRows, ...packetRows, ...blockRows].every((row) => !row.command_execution_performed_now && !row.file_write_executed_now) && !policy.protected_action_execution_allowed, "Bridge performs no Zendd command execution, file write, or protected action.", "restore non-executing bridge behavior"),
    gateRow("p840_closeout_ready", "P840", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.command_execution_performed_now), "P821-P840 closes as a ready command evidence execution bridge.", "complete command execution bridge closeout"),
    gateRow("package_script_registered", "P840", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P840", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P840", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P821-P840") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P821-P840.", "record P821-P840 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, candidateRows, packetRows, outputRows, blockRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "command_evidence_execution_bridge_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_check_execution", "execution_boundary", !policy.check_mode_execution_allowed && !policy.command_execution_performed_now && !policy.file_write_executed_by_this_command, "Check mode does not execute commands or write Zendd files."));
  items.push(validationItem("candidates.future_only", "execution_boundary", candidateRows.every(documentedCandidate), "Verification candidates are future-only and not executed."));
  items.push(validationItem("packets.not_executed", "execution_boundary", packetRows.every(documentedPacket), "Execution packets are prepared but not executed."));
  items.push(validationItem("outputs.hash_only", "output_boundary", outputRows.every(documentedOutputBinding), "Output bindings are hash/ref only."));
  items.push(validationItem("blocks.documented", "protected_command_boundary", blockRows.every(documentedExecutionBlock), "Blocked commands have reason, owner, rollback target, and next action."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.protected_action_execution_allowed), "Closeout is ready without command execution."));
  return items;
}

function buildSummary({ safePatchLane, commandEvidence, candidateRows, packetRows, outputRows, blockRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_command_evidence_execution_bridge_status: validation.valid ? READY_STATUS : "documented_block_pending_command_evidence_execution_bridge",
    source_safe_patch_lane_status: safePatchLane.summary.zendd_safe_patch_lane_status,
    source_command_evidence_status: commandEvidence.summary.zendd_command_evidence_status,
    verification_command_candidate_count: candidateRows.length,
    command_execution_packet_count: packetRows.length,
    command_output_binding_count: outputRows.length,
    protected_command_execution_block_count: blockRows.length,
    artifact_isolation_block_count: blockRows.filter((row) => row.protected_action_class === "build_artifact").length,
    command_evidence_execution_bridge_ready: closeoutRows.every((row) => row.command_evidence_execution_bridge_ready),
    command_execution_performed_now: false,
    file_write_executed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    raw_material_copy_allowed_now: false,
    protected_action_execution_allowed: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedCandidate(row) {
  return row.current_verdict === "pass"
    && row.future_execution_candidate === true
    && row.execution_allowed_in_check === false
    && row.command_execution_performed_now === false
    && row.raw_log_storage_allowed === false
    && Boolean(row.command_execution_packet_ref)
    && Boolean(row.command_execution_evidence_ref)
    && Boolean(row.redaction_report_ref)
    && Boolean(row.stdout_hash_ref)
    && Boolean(row.stderr_hash_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.next_allowed_action);
}

function documentedPacket(row) {
  return row.packet_status === "prepared_not_executed"
    && row.execution_allowed_in_check === false
    && row.command_execution_performed_now === false
    && row.file_write_executed_now === false
    && Boolean(row.command_execution_packet_ref)
    && Boolean(row.command_execution_evidence_ref)
    && Boolean(row.redaction_report_ref)
    && Boolean(row.cwd_ref)
    && Boolean(row.timeout_policy_ref)
    && Boolean(row.next_allowed_action);
}

function documentedOutputBinding(row) {
  return row.current_verdict === "pass"
    && row.raw_stdout_stored === false
    && row.raw_stderr_stored === false
    && row.raw_log_storage_allowed === false
    && row.secret_value_storage_allowed === false
    && row.raw_vdr_or_client_material_storage_allowed === false
    && Boolean(row.stdout_hash_ref)
    && Boolean(row.stderr_hash_ref)
    && Boolean(row.redaction_report_ref)
    && Boolean(row.safe_excerpt_ref)
    && Boolean(row.next_allowed_action);
}

function documentedExecutionBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.rollback_target_ref)
    && row.execution_allowed_in_check === false
    && row.command_execution_performed_now === false
    && row.file_write_executed_now === false
    && row.raw_log_storage_allowed === false
    && row.secret_read_allowed_now === false
    && row.raw_material_copy_allowed_now === false
    && Boolean(row.next_allowed_action)
    && (row.human_receipt_required === false || Boolean(row.documented_human_gate_ref));
}

function noRawSecretOrMaterial(row) {
  return row.raw_log_storage_allowed === false
    && (row.secret_read_allowed_now === undefined || row.secret_read_allowed_now === false)
    && (row.raw_material_copy_allowed_now === undefined || row.raw_material_copy_allowed_now === false)
    && (row.secret_value_storage_allowed === undefined || row.secret_value_storage_allowed === false)
    && (row.raw_vdr_or_client_material_storage_allowed === undefined || row.raw_vdr_or_client_material_storage_allowed === false);
}

function commandLineRef(row) {
  if (row.command_scope === "frontend") return `npm --prefix frontend run ${row.script_name}`;
  return `npm run ${row.script_name}`;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-command-evidence-execution-bridge-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_command_evidence_execution_bridge_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_COMMAND_EVIDENCE_EXECUTION_BRIDGE_INPUTS.zenddProjectRoot,
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

Creates the P821-P840 Zendd command evidence execution bridge. --check validates
without writing artifacts, mutating Zendd, executing Zendd commands, storing raw
logs, reading secrets, copying raw VDR/client material, applying receipts,
running database migrations, release/package actions, or protected recovery.
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

function commandKey(row) {
  return normalizeKey(`${row.command_scope}.${row.script_name}`);
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
    "# Zendd Command Evidence Execution Bridge Summary",
    "",
    `- Status: ${summary.zendd_command_evidence_execution_bridge_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Source safe patch lane: ${summary.source_safe_patch_lane_status}`,
    `- Source command evidence: ${summary.source_command_evidence_status}`,
    `- Verification candidates: ${summary.verification_command_candidate_count}`,
    `- Execution packets: ${summary.command_execution_packet_count}`,
    `- Output bindings: ${summary.command_output_binding_count}`,
    `- Protected blocks: ${summary.protected_command_execution_block_count}`,
    `- Artifact isolation blocks: ${summary.artifact_isolation_block_count}`,
    `- Command execution performed: ${summary.command_execution_performed_now}`,
    `- Raw log storage allowed: ${summary.raw_log_storage_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}
